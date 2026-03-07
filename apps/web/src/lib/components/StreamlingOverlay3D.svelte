<script>
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
	import { moodToNumber, getAnimationState } from '$lib/rendering/mood-animation.js';
	import {
		updateZParticles,
		drawZParticles,
		updateSparkles,
		drawSparkles,
		updateConfetti,
		drawConfetti
	} from '$lib/rendering/particles.js';

	/**
	 * @type {{ mood?: string | null, modelUrl: string, animationUrls?: Record<string, string> | null }}
	 */
	let { mood = 'idle', modelUrl, animationUrls = null } = $props();

	const safeMood = $derived(mood ?? 'idle');

	let moodTarget = 1;

	$effect(() => {
		moodTarget = moodToNumber(safeMood);
	});

	/** @type {HTMLCanvasElement} */
	let webglCanvas;
	/** @type {HTMLCanvasElement} */
	let overlayCanvas;

	onMount(() => {
		const SIZE = 512;

		// --- Three.js setup ---
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
		// Camera position is updated after model loads to center on the model
		camera.position.set(0, 0, 5.5);
		camera.lookAt(0, 0, 0);

		const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
		scene.add(ambientLight);
		const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
		dirLight.position.set(2, 3, 4);
		scene.add(dirLight);

		const renderer = new THREE.WebGLRenderer({
			canvas: webglCanvas,
			alpha: true,
			antialias: true
		});
		renderer.setSize(SIZE, SIZE);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setClearColor(0x000000, 0);

		// --- 2D overlay ---
		const ctx = /** @type {CanvasRenderingContext2D} */ (overlayCanvas.getContext('2d'));

		// --- Load GLB model ---
		/** @type {THREE.Object3D | null} */
		let model = null;
		let modelBaseY = 0;

		// --- Skeletal animation state ---
		/** @type {THREE.AnimationMixer | null} */
		let mixer = null;
		/** @type {Record<string, THREE.AnimationAction>} */
		const actions = {};
		/** @type {THREE.AnimationAction | null} */
		let activeAction = null;
		let useSkeletal = false;

		/** Mood name → candidate animation clip keys (random pick) */
		const MOOD_ANIM_MAP = /** @type {Record<string, string[]>} */ ({
			sleeping: ['dozing'],
			idle: ['idle'],
			engaged: ['walking', 'happy_jump'],
			partying: ['dancing_01', 'dancing_02', 'gangnam', 'boom_dance']
		});

		/** Mood name → animation timeScale */
		const MOOD_SPEED_MAP = /** @type {Record<string, number>} */ ({
			sleeping: 0.7,
			idle: 1.0,
			engaged: 1.0,
			partying: 1.0
		});

		/** Track last picked animation key to avoid repeats */
		let lastPickedKey = '';

		const loader = new GLTFLoader();

		/**
		 * Center and scale a loaded model, add to scene, and configure camera.
		 * @param {THREE.Object3D} obj
		 */
		function setupModel(obj) {
			model = obj;
			const box = new THREE.Box3().setFromObject(model);
			const center = box.getCenter(new THREE.Vector3());
			const size = box.getSize(new THREE.Vector3());
			const maxDim = Math.max(size.x, size.y, size.z);
			const scale = 2 / maxDim;

			model.scale.setScalar(scale);
			modelBaseY = -center.y * scale;
			model.position.set(-center.x * scale, modelBaseY, -center.z * scale);

			scene.add(model);
			camera.position.set(0, 0, 5.5);
			camera.lookAt(0, 0, 0);
		}

		if (animationUrls && Object.keys(animationUrls).length > 0) {
			// Animation GLBs contain the full rigged mesh + skeleton + clip.
			// Use the first one as the base model (the rigged GLB may lack bones).
			loadAnimatedModel();
		} else {
			// No animations — load the raw model for procedural animation
			loader.load(
				modelUrl,
				(gltf) => setupModel(gltf.scene),
				undefined,
				(err) => console.error('[StreamlingOverlay3D] Failed to load model:', err)
			);
		}

		/**
		 * Load animation GLBs. Use the first loaded GLB as the base model
		 * (it contains the rigged mesh with skeleton). Remaining GLBs provide
		 * additional animation clips applied to the same skeleton.
		 */
		function loadAnimatedModel() {
			if (!animationUrls) return;

			let loaded = 0;
			let baseModelSet = false;
			const entries = Object.entries(animationUrls);

			for (const [name, url] of entries) {
				loader.load(
					url,
					(gltf) => {
						// Use the first successfully loaded animation GLB as the model
						if (!baseModelSet) {
							baseModelSet = true;
							setupModel(gltf.scene);
							mixer = new THREE.AnimationMixer(/** @type {THREE.Object3D} */ (model));
						}

						if (mixer) {
							const clip = gltf.animations[0];
							if (clip) {
								const action = mixer.clipAction(clip);
								action.setLoop(THREE.LoopRepeat, Infinity);
								actions[name] = action;
							}
						}

						loaded++;
						if (loaded === entries.length) {
							useSkeletal = Object.keys(actions).length > 0;
							if (useSkeletal) {
								switchAnimation(safeMood);
							}
						}
					},
					undefined,
					(err) => {
						console.warn(`[StreamlingOverlay3D] Failed to load ${name} animation:`, err);
						loaded++;
						if (loaded === entries.length) {
							useSkeletal = Object.keys(actions).length > 0;
							if (useSkeletal) {
								switchAnimation(safeMood);
							}
						}
					}
				);
			}
		}

		/**
		 * Crossfade to a random available animation clip for the given mood.
		 * @param {string} moodName
		 */
		function switchAnimation(moodName) {
			const candidates = MOOD_ANIM_MAP[moodName] ?? ['idle'];
			// Filter to only clips that were actually loaded
			const available = candidates.filter((key) => actions[key]);

			if (available.length === 0) {
				// Fallback to idle if none of the mood's clips loaded
				if (actions['idle'] && actions['idle'] !== activeAction) {
					const fallback = actions['idle'];
					fallback.timeScale = MOOD_SPEED_MAP[moodName] ?? 1.0;
					if (activeAction) {
						fallback.reset();
						fallback.play();
						activeAction.crossFadeTo(fallback, 0.5, true);
					} else {
						fallback.play();
					}
					activeAction = fallback;
				}
				return;
			}

			// Pick a random clip, avoiding the same one twice in a row
			let pick = available[Math.floor(Math.random() * available.length)];
			if (available.length > 1 && pick === lastPickedKey) {
				const others = available.filter((k) => k !== lastPickedKey);
				pick = others[Math.floor(Math.random() * others.length)];
			}
			lastPickedKey = pick;

			const newAction = actions[pick];
			if (newAction === activeAction) {
				if (activeAction) {
					activeAction.timeScale = MOOD_SPEED_MAP[moodName] ?? 1.0;
				}
				return;
			}

			newAction.timeScale = MOOD_SPEED_MAP[moodName] ?? 1.0;

			if (activeAction) {
				newAction.reset();
				newAction.play();
				activeAction.crossFadeTo(newAction, 0.5, true);
			} else {
				newAction.play();
			}

			activeAction = newAction;
		}

		// --- Animation state ---
		let time = 0;
		let currentMood = moodTarget;
		let idleVariant = 0;
		let idleTimer = 5;
		let lastTime = 0;
		let animFrame = 0;
		let lastMoodName = safeMood;

		// --- Particles ---
		/** @type {import('$lib/rendering/particles.js').ZParticle[]} */
		let zParticles = [];
		/** @type {import('$lib/rendering/particles.js').Sparkle[]} */
		let sparkles = [];
		/** @type {import('$lib/rendering/particles.js').ConfettiParticle[]} */
		let confetti = [];
		let zState = { timer: 0 };
		let sparkleState = { timer: 0 };
		let confettiState = { timer: 0 };

		/** @param {number} timestamp */
		function animate(timestamp) {
			const dt = lastTime ? (timestamp - lastTime) / 1000 : 0;
			lastTime = timestamp;

			time += dt;
			currentMood += (moodTarget - currentMood) * Math.min(1, dt * 4);

			if (Math.round(currentMood) === 1) {
				idleTimer -= dt;
				if (idleTimer <= 0) {
					idleVariant = (idleVariant + 1) % 3;
					idleTimer = 5 + Math.random() * 3;
				}
			}

			const state = getAnimationState(currentMood, time, idleVariant);

			// Switch skeletal animation on mood change
			if (useSkeletal && safeMood !== lastMoodName) {
				lastMoodName = safeMood;
				switchAnimation(safeMood);
			}

			// Animate model
			if (model) {
				if (useSkeletal && mixer) {
					// Skeletal animation — let the mixer drive the skeleton
					mixer.update(dt);
				} else {
					// Procedural fallback (no animations available)
					model.position.y = modelBaseY + state.bounceY * 0.02;
					model.rotation.z = Math.sin(time * 1.5) * 0.03 + state.rotation;
					if (currentMood > 2.5) {
						model.rotation.y = Math.sin(time * 4) * 0.15;
					} else {
						model.rotation.y *= 0.95;
					}
				}
			}

			// Render 3D
			renderer.render(scene, camera);

			// Clear 2D overlay
			ctx.save();
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, SIZE, SIZE);
			ctx.restore();

			// Draw particles on 2D overlay (centered)
			ctx.save();
			ctx.translate(SIZE / 2, SIZE / 2);
			updateZParticles(zParticles, dt, currentMood, zState);
			updateSparkles(sparkles, dt, currentMood, sparkleState);
			updateConfetti(confetti, dt, currentMood, confettiState);
			drawZParticles(ctx, zParticles);
			drawSparkles(ctx, sparkles);
			drawConfetti(ctx, confetti);
			ctx.restore();

			animFrame = requestAnimationFrame(animate);
		}

		animFrame = requestAnimationFrame(animate);

		return () => {
			cancelAnimationFrame(animFrame);
			if (mixer) mixer.stopAllAction();
			renderer.dispose();
		};
	});
</script>

<div
	data-testid="streamling-overlay-3d"
	class="streamling-container"
	role="img"
	aria-label="3D Streamling in {safeMood} mood"
>
	<canvas bind:this={webglCanvas} width="512" height="512" class="render-canvas"></canvas>
	<canvas bind:this={overlayCanvas} width="512" height="512" class="overlay-canvas"></canvas>
</div>

<style>
	.streamling-container {
		position: relative;
		width: 512px;
		height: 512px;
	}

	.render-canvas {
		display: block;
		background: transparent;
		position: absolute;
		top: 0;
		left: 0;
	}

	.overlay-canvas {
		display: block;
		background: transparent;
		position: absolute;
		top: 0;
		left: 0;
		pointer-events: none;
	}
</style>
