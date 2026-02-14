/**
 * Reactive telemetry state that polls the streamling-state worker.
 *
 * Usage:
 *   const telemetry = createTelemetryPoller('http://localhost:8787');
 *   // telemetry.data   – latest StreamlingTelemetry | null
 *   // telemetry.error  – latest error message | null
 *   // telemetry.loading – true while first fetch is in-flight
 *   // telemetry.destroy() – stop polling
 *
 */

/**
 * @param {string} workerUrl  Base URL of the streamling-state worker
 * @param {number} [intervalMs=5000]  Polling interval in milliseconds
 */
export function createTelemetryPoller(workerUrl, intervalMs = 5000) {
	/** @type {Record<string, any> | null} */
	let data = $state(null);
	/** @type {string | null} */
	let error = $state(null);
	let loading = $state(true);

	/** @type {ReturnType<typeof setInterval> | null} */
	let timer = null;

	async function fetchTelemetry() {
		try {
			const res = await fetch(`${workerUrl}/telemetry`);
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
		fetchTelemetry();
		timer = setInterval(fetchTelemetry, intervalMs);
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
