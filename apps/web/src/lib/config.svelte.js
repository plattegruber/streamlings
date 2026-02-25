/**
 * Reactive configuration manager for the streamling-state worker.
 *
 * Usage:
 *   const cfg = createConfigManager(workerUrl, streamerId);
 *   await cfg.load();
 *   // cfg.config   - current EnergyConfig + MoodTransitionConfig + InternalDriveConfig
 *   // cfg.loading  - true while fetching
 *   // cfg.saving   - true while saving
 *   // cfg.error    - latest error message | null
 *   // cfg.load()   - re-fetch config from worker
 *   // cfg.save(partial) - POST partial updates to worker
 */

/**
 * @typedef {{
 *   energy: import('@streamlings/shared/types').EnergyConfig,
 *   moodTransition: import('@streamlings/shared/types').MoodTransitionConfig,
 *   internalDrive: import('@streamlings/shared/types').InternalDriveConfig,
 * }} StreamlingConfig
 */

/**
 * Create a reactive config manager that fetches and saves configuration
 * to the streamling-state worker.
 *
 * @param {string} workerUrl  Base URL of the streamling-state worker
 * @param {string} streamerId  Streamer identifier for the config endpoint
 */
export function createConfigManager(workerUrl, streamerId) {
	/** @type {StreamlingConfig | null} */
	let config = $state(null);
	/** @type {string | null} */
	let error = $state(null);
	let loading = $state(false);
	let saving = $state(false);

	/**
	 * Fetch the current config from the worker.
	 */
	async function load() {
		loading = true;
		error = null;
		try {
			const res = await fetch(`${workerUrl}/config/${streamerId}`);
			if (!res.ok) {
				throw new Error(`HTTP ${res.status}`);
			}
			config = await res.json();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}

	/**
	 * POST partial config updates to the worker.
	 *
	 * @param {Partial<StreamlingConfig>} partialConfig
	 */
	async function save(partialConfig) {
		saving = true;
		error = null;
		try {
			const res = await fetch(`${workerUrl}/config/${streamerId}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(partialConfig)
			});
			if (!res.ok) {
				throw new Error(`HTTP ${res.status}`);
			}
			// Re-fetch so our local state reflects what the worker persisted
			await load();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			saving = false;
		}
	}

	return {
		get config() {
			return config;
		},
		get loading() {
			return loading;
		},
		get saving() {
			return saving;
		},
		get error() {
			return error;
		},
		load,
		save
	};
}
