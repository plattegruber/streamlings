/**
 * Meshy Text-to-3D API client.
 *
 * Wraps the Meshy REST API for generating 3D models from text prompts.
 * Docs: https://docs.meshy.ai/api-text-to-3d
 */

const MESHY_BASE = 'https://api.meshy.ai/openapi/v2/text-to-3d';

const STYLE_TEMPLATE =
	'Cute kawaii chibi {input}, simple cartoon style, round proportions, small body, large head, no face, smooth surface, single solid character, centered, clean geometry';

/**
 * Wraps user input in a style-consistent prompt template.
 * @param {string} userPrompt
 * @returns {string}
 */
export function buildPrompt(userPrompt) {
	return STYLE_TEMPLATE.replace('{input}', userPrompt.trim());
}

/**
 * @param {string} apiKey
 * @returns {HeadersInit}
 */
function authHeaders(apiKey) {
	return {
		Authorization: `Bearer ${apiKey}`,
		'Content-Type': 'application/json'
	};
}

/**
 * Create a preview (fast, low-quality) 3D model task.
 * @param {string} apiKey
 * @param {string} prompt - Already formatted via buildPrompt()
 * @returns {Promise<{ taskId: string }>}
 */
export async function createPreviewTask(apiKey, prompt) {
	const res = await fetch(MESHY_BASE, {
		method: 'POST',
		headers: authHeaders(apiKey),
		body: JSON.stringify({
			mode: 'preview',
			prompt,
			ai_model: 'meshy-4',
			topology: 'triangle',
			target_polycount: 10000,
			should_remesh: true,
			enable_pbr: false
		})
	});

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Meshy preview failed (${res.status}): ${body}`);
	}

	const data = await res.json();
	return { taskId: data.result };
}

/**
 * Create a refine (high-quality) task from a completed preview.
 * @param {string} apiKey
 * @param {string} previewTaskId
 * @returns {Promise<{ taskId: string }>}
 */
export async function createRefineTask(apiKey, previewTaskId) {
	const res = await fetch(MESHY_BASE, {
		method: 'POST',
		headers: authHeaders(apiKey),
		body: JSON.stringify({
			mode: 'refine',
			preview_task_id: previewTaskId,
			enable_pbr: false
		})
	});

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Meshy refine failed (${res.status}): ${body}`);
	}

	const data = await res.json();
	return { taskId: data.result };
}

/**
 * @typedef {object} MeshyTask
 * @property {string} id
 * @property {string} status - 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED'
 * @property {number} progress - 0-100
 * @property {string} [model_urls.glb] - URL to download GLB (when SUCCEEDED)
 * @property {{ glb?: string }} [model_urls]
 */

/**
 * Get the current status of a Meshy task.
 * @param {string} apiKey
 * @param {string} taskId
 * @returns {Promise<MeshyTask>}
 */
export async function getTask(apiKey, taskId) {
	const res = await fetch(`${MESHY_BASE}/${taskId}`, {
		method: 'GET',
		headers: authHeaders(apiKey)
	});

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Meshy getTask failed (${res.status}): ${body}`);
	}

	return res.json();
}

/**
 * Download a GLB binary from a URL.
 * @param {string} glbUrl
 * @returns {Promise<ArrayBuffer>}
 */
export async function downloadGlb(glbUrl) {
	const res = await fetch(glbUrl);

	if (!res.ok) {
		throw new Error(`GLB download failed (${res.status})`);
	}

	return res.arrayBuffer();
}
