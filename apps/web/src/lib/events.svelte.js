/**
 * Reactive events state that polls the streamling-state worker's recent events endpoint.
 *
 * Usage:
 *   const events = createEventsPoller('http://localhost:8787', 'my-streamer-id');
 *   // events.data   – latest EventRecord[] | null
 *   // events.error  – latest error message | null
 *   // events.loading – true while first fetch is in-flight
 *   // events.destroy() – stop polling
 *
 */

/**
 * @param {string} workerUrl  Base URL of the streamling-state worker
 * @param {string} streamerId  Streamer identifier for the events endpoint
 * @param {number} [intervalMs=5000]  Polling interval in milliseconds
 */
export function createEventsPoller(workerUrl, streamerId, intervalMs = 5000) {
	/** @type {import('@streamlings/shared/types').EventRecord[] | null} */
	let data = $state(null);
	/** @type {string | null} */
	let error = $state(null);
	let loading = $state(true);

	/** @type {ReturnType<typeof setInterval> | null} */
	let timer = null;

	async function fetchEvents() {
		try {
			const res = await fetch(`${workerUrl}/events/${streamerId}`);
			if (!res.ok) {
				throw new Error(`HTTP ${res.status}`);
			}
			data = await res.json();
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}

	function start() {
		fetchEvents();
		timer = setInterval(fetchEvents, intervalMs);
	}

	function destroy() {
		if (timer !== null) {
			clearInterval(timer);
			timer = null;
		}
	}

	start();

	return {
		get data() {
			return data;
		},
		get error() {
			return error;
		},
		get loading() {
			return loading;
		},
		destroy
	};
}
