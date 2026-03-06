/**
 * Meshy Text-to-3D, Rigging & Animation API client.
 *
 * Wraps the Meshy REST API for generating, rigging and animating 3D models.
 * Text-to-3D: https://docs.meshy.ai/en/api/text-to-3d
 * Rigging & Animation: https://docs.meshy.ai/en/api/rigging-and-animation
 */

const MESHY_TEXT_TO_3D = 'https://api.meshy.ai/openapi/v2/text-to-3d';
const MESHY_RIGGING = 'https://api.meshy.ai/openapi/v1/rigging';
const MESHY_ANIMATIONS = 'https://api.meshy.ai/openapi/v1/animations';

const STYLE_TEMPLATE =
	'Cute kawaii chibi {input}, simple cartoon style, round proportions, small body, large head, smooth surface, single solid character, centered, clean geometry, bipedal with clearly defined arms and legs, standing in T-pose';

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
	const res = await fetch(MESHY_TEXT_TO_3D, {
		method: 'POST',
		headers: authHeaders(apiKey),
		body: JSON.stringify({
			mode: 'preview',
			prompt,
			ai_model: 'meshy-6',
			pose_mode: 't-pose',
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
	const res = await fetch(MESHY_TEXT_TO_3D, {
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
	const res = await fetch(`${MESHY_TEXT_TO_3D}/${taskId}`, {
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

// ---------------------------------------------------------------------------
// Rigging API (v1)
// ---------------------------------------------------------------------------

/**
 * @typedef {object} RiggingResult
 * @property {string} rigged_character_glb_url
 * @property {string} rigged_character_fbx_url
 * @property {{ walking_glb_url: string, walking_fbx_url: string, running_glb_url: string, running_fbx_url: string }} basic_animations
 */

/**
 * @typedef {object} RiggingTask
 * @property {string} id
 * @property {string} status - 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED'
 * @property {number} progress
 * @property {RiggingResult} [result]
 */

/**
 * Create a rigging task from a completed refine task.
 * @param {string} apiKey
 * @param {string} refineTaskId
 * @returns {Promise<{ taskId: string }>}
 */
export async function createRiggingTask(apiKey, refineTaskId) {
	const res = await fetch(MESHY_RIGGING, {
		method: 'POST',
		headers: authHeaders(apiKey),
		body: JSON.stringify({ input_task_id: refineTaskId })
	});

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Meshy rigging failed (${res.status}): ${body}`);
	}

	const data = await res.json();
	return { taskId: data.result };
}

/**
 * Get the current status of a rigging task.
 * @param {string} apiKey
 * @param {string} taskId
 * @returns {Promise<RiggingTask>}
 */
export async function getRiggingTask(apiKey, taskId) {
	const res = await fetch(`${MESHY_RIGGING}/${taskId}`, {
		method: 'GET',
		headers: authHeaders(apiKey)
	});

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Meshy getRiggingTask failed (${res.status}): ${body}`);
	}

	return res.json();
}

// ---------------------------------------------------------------------------
// Animation API (v1)
// ---------------------------------------------------------------------------

/** Well-known animation action IDs from the Meshy animation library. */
export const ANIMATION_IDS = {
	idle: 0,
	dancing: 22
};

/**
 * @typedef {object} AnimationResult
 * @property {string} animation_glb_url
 * @property {string} animation_fbx_url
 */

/**
 * @typedef {object} AnimationTask
 * @property {string} id
 * @property {string} status
 * @property {number} progress
 * @property {AnimationResult} [result]
 */

/**
 * Create an animation task from a completed rigging task.
 * @param {string} apiKey
 * @param {string} rigTaskId
 * @param {number} actionId - Animation library action ID
 * @returns {Promise<{ taskId: string }>}
 */
export async function createAnimationTask(apiKey, rigTaskId, actionId) {
	const res = await fetch(MESHY_ANIMATIONS, {
		method: 'POST',
		headers: authHeaders(apiKey),
		body: JSON.stringify({
			rig_task_id: rigTaskId,
			action_id: actionId
		})
	});

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Meshy animation failed (${res.status}): ${body}`);
	}

	const data = await res.json();
	return { taskId: data.result };
}

/**
 * Get the current status of an animation task.
 * @param {string} apiKey
 * @param {string} taskId
 * @returns {Promise<AnimationTask>}
 */
export async function getAnimationTask(apiKey, taskId) {
	const res = await fetch(`${MESHY_ANIMATIONS}/${taskId}`, {
		method: 'GET',
		headers: authHeaders(apiKey)
	});

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Meshy getAnimationTask failed (${res.status}): ${body}`);
	}

	return res.json();
}
