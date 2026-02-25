import { DurableObject } from "cloudflare:workers";
import type {
	EnergyState,
	MoodStateData,
	ActivityMetrics,
	StreamlingTelemetry,
	EnergyConfig,
	MoodTransitionConfig,
	InternalDriveConfig,
	EventRecord,
} from '@streamlings/shared/types';
import {
	createInitialEnergyState,
	updateEnergyState,
	DEFAULT_ENERGY_CONFIG,
} from './energy';
import {
	createInitialMoodState,
	updateMoodState,
	DEFAULT_MOOD_TRANSITION_CONFIG,
	DEFAULT_INTERNAL_DRIVE_CONFIG,
} from './mood';
import {
	MAX_RECENT_EVENTS,
	createEventRecord,
	appendToRingBuffer,
} from './events';

/**
 * Event type categories for activity metrics
 */
const EVENT_CATEGORIES = {
	MESSAGE: ['channel.chat.message'] as string[],
	HIGH_VALUE: [
		'channel.subscribe',
		'channel.subscription.gift',
		'channel.subscription.message',
		'channel.cheer',
		'channel.raid',
	] as string[],
};

/**
 * StreamlingState tracks event counts and manages energy/mood system
 */
export class StreamlingState extends DurableObject<Env> {
	private eventCounts: Map<string, number>;
	private energyState: EnergyState;
	private moodState: MoodStateData;
	private recentActivity: ActivityMetrics;
	private recentEvents: EventRecord[];

	// Configuration
	private energyConfig: EnergyConfig;
	private moodTransitionConfig: MoodTransitionConfig;
	private internalDriveConfig: InternalDriveConfig;

	// Activity tracking within current tick window
	private tickStartTime: number;
	private messageCountInTick: number;
	private uniqueChattersInTick: Set<string>;
	private highValueEventsInTick: number;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.eventCounts = new Map();
		this.energyState = createInitialEnergyState();
		this.moodState = createInitialMoodState();
		this.tickStartTime = Date.now();
		this.messageCountInTick = 0;
		this.uniqueChattersInTick = new Set();
		this.highValueEventsInTick = 0;
		this.recentEvents = [];
		this.recentActivity = {
			messagesPerMin: 0,
			uniqueChattersPerMin: 0,
			highValueEventsPerMin: 0,
			timestamp: Date.now(),
		};

		// Load default configurations
		this.energyConfig = DEFAULT_ENERGY_CONFIG;
		this.moodTransitionConfig = DEFAULT_MOOD_TRANSITION_CONFIG;
		this.internalDriveConfig = DEFAULT_INTERNAL_DRIVE_CONFIG;

		// Load persisted state from storage on initialization
		ctx.blockConcurrencyWhile(async () => {
			const [storedCounts, storedEnergy, storedMood, storedConfig, storedRecentEvents] = await Promise.all([
				ctx.storage.get<Record<string, number>>('event_counts'),
				ctx.storage.get<EnergyState>('energy_state'),
				ctx.storage.get<MoodStateData>('mood_state'),
				ctx.storage.get<{
					energy: EnergyConfig;
					moodTransition: MoodTransitionConfig;
					internalDrive: InternalDriveConfig;
				}>('config'),
				ctx.storage.get<EventRecord[]>('recentEvents'),
			]);

			if (storedCounts) {
				this.eventCounts = new Map(Object.entries(storedCounts));
			}

			if (storedEnergy) {
				this.energyState = storedEnergy;
			}

			if (storedMood) {
				this.moodState = storedMood;
			}

			if (storedConfig) {
				this.energyConfig = storedConfig.energy;
				this.moodTransitionConfig = storedConfig.moodTransition;
				this.internalDriveConfig = storedConfig.internalDrive;
			}

			if (storedRecentEvents) {
				this.recentEvents = storedRecentEvents;
			}

			// Schedule the first tick
			await this.scheduleNextTick();
		});
	}

	/**
	 * Schedule the next energy/mood update tick
	 */
	private async scheduleNextTick(): Promise<void> {
		const nextTick = Date.now() + this.energyConfig.tickRateMs;
		await this.ctx.storage.setAlarm(nextTick);
	}

	/**
	 * Alarm handler - called every tick to update energy and mood
	 */
	async alarm(): Promise<void> {
		const now = Date.now();

		// Calculate elapsed time for this tick window
		const tickDurationMs = now - this.tickStartTime;
		const tickDurationMin = tickDurationMs / 60000;

		// Calculate activity metrics for this tick
		this.recentActivity = {
			messagesPerMin: this.messageCountInTick / tickDurationMin,
			uniqueChattersPerMin: this.uniqueChattersInTick.size / tickDurationMin,
			highValueEventsPerMin: this.highValueEventsInTick / tickDurationMin,
			timestamp: now,
		};

		// Update energy state
		this.energyState = updateEnergyState(
			this.energyState,
			this.recentActivity,
			this.energyConfig,
		);

		// Update mood state
		this.moodState = updateMoodState(
			this.moodState,
			this.energyState,
			this.moodTransitionConfig,
			this.internalDriveConfig,
			now,
		);

		// Persist updated states
		await Promise.all([
			this.ctx.storage.put('energy_state', this.energyState),
			this.ctx.storage.put('mood_state', this.moodState),
		]);

		// Log telemetry with event context
		if (this.messageCountInTick > 0 || this.highValueEventsInTick > 0) {
			const eventParts: string[] = [];
			if (this.messageCountInTick > 0) {
				eventParts.push(`${this.messageCountInTick} message${this.messageCountInTick !== 1 ? 's' : ''} (${this.uniqueChattersInTick.size} unique)`);
			}
			if (this.highValueEventsInTick > 0) {
				eventParts.push(`${this.highValueEventsInTick} high-value`);
			}
			console.log(`📨 Events this tick: ${eventParts.join(', ')}`);
		}

		console.log('🔋 Energy & Mood Update:', {
			energy: this.energyState.energy.toFixed(3),
			mood: this.moodState.currentState,
			timeInState: `${(this.moodState.timeInState / 1000).toFixed(0)}s`,
			sleepPressure: this.moodState.drive.sleepPressure.toFixed(2),
		});

		// Reset tick counters
		this.tickStartTime = now;
		this.messageCountInTick = 0;
		this.uniqueChattersInTick = new Set();
		this.highValueEventsInTick = 0;

		// Broadcast telemetry to connected WebSocket clients
		await this.broadcastTelemetry();

		// Schedule next tick
		await this.scheduleNextTick();
	}

	/**
	 * Increment the count for a specific event type and track activity
	 */
	async incrementEvent(eventType: string, eventData?: Record<string, unknown>): Promise<void> {
		const current = this.eventCounts.get(eventType) || 0;
		this.eventCounts.set(eventType, current + 1);

		// Track activity for energy calculation
		if (EVENT_CATEGORIES.MESSAGE.includes(eventType)) {
			this.messageCountInTick++;

			// Track unique chatters (if user_id is available)
			if (eventData?.user_id) {
				this.uniqueChattersInTick.add(String(eventData.user_id));
			}
		}

		if (EVENT_CATEGORIES.HIGH_VALUE.includes(eventType)) {
			this.highValueEventsInTick++;
		}

		// Build an EventRecord and append to the ring buffer
		const record = createEventRecord(eventType, eventData);
		this.recentEvents = appendToRingBuffer(this.recentEvents, record);

		// Persist event counts and recent events
		await Promise.all([
			this.ctx.storage.put('event_counts', Object.fromEntries(this.eventCounts)),
			this.ctx.storage.put('recentEvents', this.recentEvents),
		]);
	}

	/**
	 * Get all event counts
	 */
	async getCounts(): Promise<Record<string, number>> {
		return Object.fromEntries(this.eventCounts);
	}

	/**
	 * Get the recent events ring buffer
	 */
	async getRecentEvents(): Promise<EventRecord[]> {
		return this.recentEvents;
	}

	/**
	 * Get current telemetry snapshot
	 */
	async getTelemetry(): Promise<StreamlingTelemetry> {
		const now = Date.now();

		return {
			energy: this.energyState,
			mood: {
				...this.moodState,
				timeInState: now - this.moodState.stateEnteredAt,
			},
			recentActivity: this.recentActivity,
			timestamp: now,
		};
	}

	/**
	 * Update configuration parameters
	 */
	async updateConfig(config: {
		energy?: Partial<EnergyConfig>;
		moodTransition?: Partial<MoodTransitionConfig>;
		internalDrive?: Partial<InternalDriveConfig>;
	}): Promise<void> {
		if (config.energy) {
			this.energyConfig = { ...this.energyConfig, ...config.energy };
		}
		if (config.moodTransition) {
			this.moodTransitionConfig = { ...this.moodTransitionConfig, ...config.moodTransition };
		}
		if (config.internalDrive) {
			this.internalDriveConfig = { ...this.internalDriveConfig, ...config.internalDrive };
		}

		await this.ctx.storage.put('config', {
			energy: this.energyConfig,
			moodTransition: this.moodTransitionConfig,
			internalDrive: this.internalDriveConfig,
		});
	}

	/**
	 * Get current configuration
	 */
	async getConfig(): Promise<{
		energy: EnergyConfig;
		moodTransition: MoodTransitionConfig;
		internalDrive: InternalDriveConfig;
	}> {
		return {
			energy: this.energyConfig,
			moodTransition: this.moodTransitionConfig,
			internalDrive: this.internalDriveConfig,
		};
	}

	/**
	 * Handle incoming HTTP requests, including WebSocket upgrades
	 */
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		// /ws - WebSocket telemetry stream
		if (url.pathname === '/ws') {
			// Reject non-upgrade requests
			if (request.headers.get('Upgrade') !== 'websocket') {
				return new Response('Expected WebSocket upgrade', { status: 426 });
			}

			const pair = new WebSocketPair();
			const [client, server] = Object.values(pair);

			this.ctx.acceptWebSocket(server);

			// Auto-respond to ping/pong without waking the DO
			this.ctx.setWebSocketAutoResponse(
				new WebSocketRequestResponsePair('ping', 'pong'),
			);

			return new Response(null, { status: 101, webSocket: client });
		}

		// /events - recent events ring buffer
		if (url.pathname === '/events' && request.method === 'GET') {
			const events = await this.getRecentEvents();
			return new Response(JSON.stringify(events), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		return new Response('Not Found', { status: 404 });
	}

	/**
	 * Handle incoming WebSocket messages (Hibernation API)
	 */
	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
		// No client-to-server messages expected; ignore
	}

	/**
	 * Handle WebSocket close (Hibernation API)
	 */
	async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
		ws.close(code, reason);
	}

	/**
	 * Handle WebSocket errors (Hibernation API)
	 */
	async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
		console.error('WebSocket error:', error);
	}

	/**
	 * Broadcast current telemetry to all connected WebSocket clients
	 */
	private async broadcastTelemetry(): Promise<void> {
		const sockets = this.ctx.getWebSockets();
		if (sockets.length === 0) return;

		const telemetry = await this.getTelemetry();
		const payload = JSON.stringify(telemetry);

		for (const ws of sockets) {
			try {
				ws.send(payload);
			} catch {
				try { ws.close(1011, 'Send failed'); } catch { /* already closed */ }
			}
		}
	}
}

/**
 * Build CORS headers for the given allowed origin.
 */
function corsHeaders(allowedOrigin: string): Record<string, string> {
	return {
		'Access-Control-Allow-Origin': allowedOrigin,
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
	};
}

/**
 * Clone a response with CORS headers appended.
 * WebSocket upgrade responses (101) are returned as-is since
 * browsers don't expose headers on upgrade responses.
 */
function withCors(response: Response, allowedOrigin: string): Response {
	if (response.status === 101) {
		return response;
	}

	const headers = new Headers(response.headers);
	for (const [key, value] of Object.entries(corsHeaders(allowedOrigin))) {
		headers.set(key, value);
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

/**
 * Extract a two-segment path: /<route>/<streamerId>
 * Returns { route, streamerId } or null if the path doesn't match.
 */
function parseStreamerPath(pathname: string): { route: string; streamerId: string } | null {
	// Strip leading slash and split: "/telemetry/abc" -> ["telemetry", "abc"]
	const segments = pathname.replace(/^\//, '').split('/');
	if (segments.length !== 2 || !segments[0] || !segments[1]) {
		return null;
	}
	return { route: segments[0], streamerId: segments[1] };
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const allowedOrigin = env.ALLOWED_ORIGIN ?? 'http://localhost:5173';

		// Handle CORS preflight requests
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: corsHeaders(allowedOrigin),
			});
		}

		// --- POST /webhook: streamer ID comes from the request body ---
		if (url.pathname === '/webhook' && request.method === 'POST') {
			const body = await request.json() as any;

			// Handle EventSub verification challenge (no streamer ID needed)
			if (body.challenge) {
				console.log('✓ EventSub verification challenge received');
				return withCors(new Response(body.challenge, {
					headers: { 'Content-Type': 'text/plain' },
				}), allowedOrigin);
			}

			// Handle EventSub notification
			if (body.subscription && body.subscription.type) {
				const eventType = body.subscription.type;
				const eventData = body.event || {};

				// Extract streamer ID from forwarded event body
				const streamerId = eventData.internal_user_id;
				if (!streamerId) {
					return withCors(new Response(
						JSON.stringify({ error: 'Missing internal_user_id in event body' }),
						{ status: 400, headers: { 'Content-Type': 'application/json' } },
					), allowedOrigin);
				}

				const stub = env.STREAMLING_STATE.getByName(streamerId);

				// Increment count in Durable Object with event data
				await stub.incrementEvent(eventType, eventData);

				// Get all counts and log table
				const counts = await stub.getCounts();
				console.log('\n📊 Event Counts:');
				console.table(counts);

				// Return counts in response
				return withCors(new Response(JSON.stringify(counts, null, 2), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				}), allowedOrigin);
			}

			return withCors(new Response('Bad Request', { status: 400 }), allowedOrigin);
		}

		// --- All other routes require /<route>/<streamerId> ---
		const parsed = parseStreamerPath(url.pathname);
		if (!parsed) {
			return withCors(new Response('Not Found', { status: 404 }), allowedOrigin);
		}

		const { route, streamerId } = parsed;
		const stub = env.STREAMLING_STATE.getByName(streamerId);

		// Route: GET /telemetry/:streamerId
		if (route === 'telemetry' && request.method === 'GET') {
			const telemetry = await stub.getTelemetry();
			return withCors(new Response(JSON.stringify(telemetry, null, 2), {
				headers: { 'Content-Type': 'application/json' },
			}), allowedOrigin);
		}

		// Route: GET /config/:streamerId
		if (route === 'config' && request.method === 'GET') {
			const config = await stub.getConfig();
			return withCors(new Response(JSON.stringify(config, null, 2), {
				headers: { 'Content-Type': 'application/json' },
			}), allowedOrigin);
		}

		// Route: POST /config/:streamerId
		if (route === 'config' && request.method === 'POST') {
			const config = await request.json() as any;
			await stub.updateConfig(config);
			return withCors(new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}), allowedOrigin);
		}

		// Route: GET /events/:streamerId
		if (route === 'events' && request.method === 'GET') {
			const events = await stub.getRecentEvents();
			return withCors(new Response(JSON.stringify(events, null, 2), {
				headers: { 'Content-Type': 'application/json' },
			}), allowedOrigin);
		}

		// Route: GET /ws/:streamerId - WebSocket telemetry stream
		if (route === 'ws') {
			// Rewrite the URL so the DO sees /ws (without the streamerId segment)
			const doUrl = new URL(request.url);
			doUrl.pathname = '/ws';
			return stub.fetch(new Request(doUrl.toString(), request));
		}

		// Route: GET /webhook/:streamerId - return current counts
		if (route === 'webhook' && request.method === 'GET') {
			const counts = await stub.getCounts();
			return withCors(new Response(JSON.stringify(counts, null, 2), {
				headers: { 'Content-Type': 'application/json' },
			}), allowedOrigin);
		}

		return withCors(new Response('Not Found', { status: 404 }), allowedOrigin);
	},
} satisfies ExportedHandler<Env>;
