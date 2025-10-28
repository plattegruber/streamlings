import { DurableObject } from "cloudflare:workers";
import type {
	EnergyState,
	MoodStateData,
	ActivityMetrics,
	StreamlingTelemetry,
	EnergyConfig,
	MoodTransitionConfig,
	InternalDriveConfig,
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
			const [storedCounts, storedEnergy, storedMood, storedConfig] = await Promise.all([
				ctx.storage.get<Record<string, number>>('event_counts'),
				ctx.storage.get<EnergyState>('energy_state'),
				ctx.storage.get<MoodStateData>('mood_state'),
				ctx.storage.get<{
					energy: EnergyConfig;
					moodTransition: MoodTransitionConfig;
					internalDrive: InternalDriveConfig;
				}>('config'),
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

		// Persist event counts
		await this.ctx.storage.put('event_counts', Object.fromEntries(this.eventCounts));
	}

	/**
	 * Get all event counts
	 */
	async getCounts(): Promise<Record<string, number>> {
		return Object.fromEntries(this.eventCounts);
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
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		// Get the StreamlingState Durable Object instance
		const stub = env.STREAMLING_STATE.getByName("streamling");

		// Route: GET /telemetry - get current energy/mood telemetry
		if (url.pathname === '/telemetry' && request.method === 'GET') {
			const telemetry = await stub.getTelemetry();
			return new Response(JSON.stringify(telemetry, null, 2), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Route: GET /config - get current configuration
		if (url.pathname === '/config' && request.method === 'GET') {
			const config = await stub.getConfig();
			return new Response(JSON.stringify(config, null, 2), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Route: POST /config - update configuration
		if (url.pathname === '/config' && request.method === 'POST') {
			const config = await request.json() as any;
			await stub.updateConfig(config);
			return new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Route: /webhook endpoint
		if (url.pathname !== '/webhook') {
			return new Response('Not Found', { status: 404 });
		}

		// GET /webhook - return current counts
		if (request.method === 'GET') {
			const counts = await stub.getCounts();
			return new Response(JSON.stringify(counts, null, 2), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// POST /webhook - handle EventSub
		if (request.method === 'POST') {
			const body = await request.json() as any;

			// Handle EventSub verification challenge
			if (body.challenge) {
				console.log('✓ EventSub verification challenge received');
				return new Response(body.challenge, {
					headers: { 'Content-Type': 'text/plain' },
				});
			}

			// Handle EventSub notification
			if (body.subscription && body.subscription.type) {
				const eventType = body.subscription.type;
				const eventData = body.event || {};

				// Increment count in Durable Object with event data
				await stub.incrementEvent(eventType, eventData);

				// Get all counts and log table
				const counts = await stub.getCounts();
				console.log('\n📊 Event Counts:');
				console.table(counts);

				// Return counts in response
				return new Response(JSON.stringify(counts, null, 2), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			return new Response('Bad Request', { status: 400 });
		}

		return new Response('Method Not Allowed', { status: 405 });
	},
} satisfies ExportedHandler<Env>;
