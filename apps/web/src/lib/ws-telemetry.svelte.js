/**
 * Reactive WebSocket telemetry state that connects to the streamling-state worker.
 *
 * Connects via WebSocket for real-time telemetry updates pushed every tick (~10s).
 * Falls back to HTTP polling if the WebSocket connection fails.
 *
 * Usage:
 *   const telemetry = createWebSocketTelemetry('http://localhost:8787', 'streamer-123');
 *   // telemetry.data      - latest StreamlingTelemetry | null
 *   // telemetry.connected - true when WebSocket is open
 *   // telemetry.error     - latest error message | null
 *   // telemetry.destroy() - close connection and stop reconnecting
 */

/** @type {number} */
const RECONNECT_DELAY_MS = 3000;

/** @type {number} */
const POLL_INTERVAL_MS = 5000;

/** @type {number} */
const PING_INTERVAL_MS = 30000;

/**
 * @param {string} workerUrl  Base URL of the streamling-state worker (http or https)
 * @param {string} streamerId  The streamer ID to subscribe to
 */
export function createWebSocketTelemetry(workerUrl, streamerId) {
	/** @type {Record<string, any> | null} */
	let data = $state(null);
	/** @type {boolean} */
	let connected = $state(false);
	/** @type {string | null} */
	let error = $state(null);

	/** @type {WebSocket | null} */
	let ws = null;
	/** @type {ReturnType<typeof setTimeout> | null} */
	let reconnectTimer = null;
	/** @type {ReturnType<typeof setInterval> | null} */
	let pollTimer = null;
	/** @type {ReturnType<typeof setInterval> | null} */
	let pingTimer = null;
	let destroyed = false;

	/**
	 * Derive the WebSocket URL from the HTTP worker URL.
	 * http://... -> ws://...
	 * https://... -> wss://...
	 */
	function wsUrl() {
		return workerUrl.replace(/^http/, 'ws') + `/ws/${streamerId}`;
	}

	/**
	 * Fetch telemetry via HTTP as a fallback.
	 */
	async function fetchTelemetry() {
		try {
			const res = await fetch(`${workerUrl}/telemetry/${streamerId}`);
			if (!res.ok) {
				throw new Error(`HTTP ${res.status}`);
			}
			data = await res.json();
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}

	/**
	 * Start HTTP polling as a fallback when WebSocket is unavailable.
	 */
	function startPolling() {
		stopPolling();
		fetchTelemetry();
		pollTimer = setInterval(fetchTelemetry, POLL_INTERVAL_MS);
	}

	/**
	 * Stop HTTP polling.
	 */
	function stopPolling() {
		if (pollTimer !== null) {
			clearInterval(pollTimer);
			pollTimer = null;
		}
	}

	/**
	 * Connect to the WebSocket endpoint.
	 */
	function connect() {
		if (destroyed) return;

		try {
			ws = new WebSocket(wsUrl());
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			startPolling();
			scheduleReconnect();
			return;
		}

		ws.addEventListener('open', () => {
			connected = true;
			error = null;
			stopPolling();
			startPing();
		});

		ws.addEventListener('message', (event) => {
			try {
				data = JSON.parse(/** @type {string} */ (event.data));
				error = null;
			} catch (e) {
				// Ignore non-JSON messages (e.g. pong responses)
			}
		});

		ws.addEventListener('close', () => {
			connected = false;
			stopPing();
			if (!destroyed) {
				startPolling();
				scheduleReconnect();
			}
		});

		ws.addEventListener('error', () => {
			error = 'WebSocket connection failed';
			connected = false;
			stopPing();
			if (!destroyed) {
				startPolling();
				scheduleReconnect();
			}
		});
	}

	/**
	 * Send periodic pings to keep the connection alive.
	 */
	function startPing() {
		stopPing();
		pingTimer = setInterval(() => {
			if (ws && ws.readyState === WebSocket.OPEN) {
				ws.send('ping');
			}
		}, PING_INTERVAL_MS);
	}

	/**
	 * Stop the ping interval.
	 */
	function stopPing() {
		if (pingTimer !== null) {
			clearInterval(pingTimer);
			pingTimer = null;
		}
	}

	/**
	 * Schedule a reconnection attempt.
	 */
	function scheduleReconnect() {
		if (reconnectTimer !== null) return;
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			connect();
		}, RECONNECT_DELAY_MS);
	}

	/**
	 * Close the connection and stop all timers.
	 */
	function destroy() {
		destroyed = true;
		stopPolling();
		stopPing();
		if (reconnectTimer !== null) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		if (ws) {
			ws.close();
			ws = null;
		}
		connected = false;
	}

	// Start the initial connection
	connect();

	return {
		get data() {
			return data;
		},
		get connected() {
			return connected;
		},
		get error() {
			return error;
		},
		destroy
	};
}
