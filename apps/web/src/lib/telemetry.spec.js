import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/** @type {ReturnType<typeof import('./telemetry.svelte.js').createTelemetryPoller> | null} */
let poller = null;

const fakeTelemetry = {
	energy: {
		rawActivity: 5,
		baseline: 3,
		stdDev: 1,
		zScore: 0.8,
		energy: 0.6,
		activityHistory: [4, 5, 3],
		lastUpdate: Date.now()
	},
	mood: {
		currentState: 'idle',
		stateEnteredAt: Date.now() - 60000,
		timeInState: 60000,
		transitionConditionMetAt: null,
		drive: {
			sleepPressure: 0.2,
			restedness: 0.9,
			exhaustion: 0,
			curiosity: 0.1
		}
	},
	recentActivity: {
		messagesPerMin: 10,
		uniqueChattersPerMin: 5,
		highValueEventsPerMin: 0,
		timestamp: Date.now()
	},
	timestamp: Date.now()
};

describe('createTelemetryPoller', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		poller?.destroy();
		poller = null;
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('fetches telemetry from the worker URL', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(JSON.stringify(fakeTelemetry), { status: 200 }));

		const { createTelemetryPoller } = await import('./telemetry.svelte.js');
		poller = createTelemetryPoller('http://localhost:8787');

		// Let the initial fetch resolve
		await vi.advanceTimersByTimeAsync(0);

		expect(fetchSpy).toHaveBeenCalledWith('http://localhost:8787/telemetry');
	});

	it('sets error when fetch fails', async () => {
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection refused'));

		const { createTelemetryPoller } = await import('./telemetry.svelte.js');
		poller = createTelemetryPoller('http://localhost:9999');

		await vi.advanceTimersByTimeAsync(0);

		expect(poller.error).toBe('Connection refused');
		expect(poller.loading).toBe(false);
	});

	it('sets error on non-OK HTTP response', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Not Found', { status: 404 }));

		const { createTelemetryPoller } = await import('./telemetry.svelte.js');
		poller = createTelemetryPoller('http://localhost:8787');

		await vi.advanceTimersByTimeAsync(0);

		expect(poller.error).toBe('HTTP 404');
	});

	it('stops polling after destroy', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(JSON.stringify(fakeTelemetry), { status: 200 }));

		const { createTelemetryPoller } = await import('./telemetry.svelte.js');
		poller = createTelemetryPoller('http://localhost:8787', 1000);

		await vi.advanceTimersByTimeAsync(0);
		expect(fetchSpy).toHaveBeenCalledTimes(1);

		poller.destroy();

		await vi.advanceTimersByTimeAsync(5000);
		expect(fetchSpy).toHaveBeenCalledTimes(1);
	});
});
