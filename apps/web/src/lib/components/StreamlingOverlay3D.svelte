<script>
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
	import { moodToNumber, getAnimationState } from '$lib/rendering/mood-animation.js';
	import { drawFace } from '$lib/rendering/face.js';
	import {
		updateZParticles,
		drawZParticles,
		updateSparkles,
		drawSparkles,
		updateConfetti,
		drawConfetti
	} from '$lib/rendering/particles.js';

	/**
	 * @type {{ mood?: string | null, modelUrl: string }}
	 */
	let { mood = 'idle', modelUrl } = $props();

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
		camera.position.set(0, 1, 5);
		camera.lookAt(0, 0.8, 0);

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

		const loader = new GLTFLoader();
		loader.load(
			modelUrl,
			(gltf) => {
				model = gltf.scene;

				// Auto-center and normalize to ~2 units tall
				const box = new THREE.Box3().setFromObject(model);
				const center = box.getCenter(new THREE.Vector3());
				const size = box.getSize(new THREE.Vector3());
				const maxDim = Math.max(size.x, size.y, size.z);
				const scale = 2 / maxDim;

				model.scale.setScalar(scale);
				model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

				scene.add(model);
			},
			undefined,
			(err) => {
				console.error('[StreamlingOverlay3D] Failed to load model:', err);
			}
		);

		// --- Animation state ---
		let time = 0;
		let currentMood = moodTarget;
		let idleVariant = 0;
		let idleTimer = 5;
		let lastTime = 0;
		let animFrame = 0;

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

			// Animate model
			if (model) {
				// Bounce
				model.position.y = -0 + state.bounceY * 0.02;
				// Sway/rotation
				model.rotation.z = Math.sin(time * 1.5) * 0.03 + state.rotation;
				// Party wiggle
				if (currentMood > 2.5) {
					model.rotation.y = Math.sin(time * 4) * 0.15;
				} else {
					model.rotation.y *= 0.95; // decay back
				}
			}

			// Render 3D
			renderer.render(scene, camera);

			// Clear 2D overlay
			ctx.save();
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, SIZE, SIZE);
			ctx.restore();

			// Draw face on 2D overlay
			if (model) {
				// Compute face position from the model's current bounding box each frame
				// (accounts for bounce/sway). The face sits at ~70% of the bbox height,
				// which lands on the forehead-to-eye area for chibi proportions.
				const box = new THREE.Box3().setFromObject(model);
				const faceY = box.min.y + (box.max.y - box.min.y) * 0.7;
				const faceZ = box.max.z + 0.1; // just in front of the model

				const faceWorldPos = new THREE.Vector3(0, faceY, faceZ);
				faceWorldPos.project(camera);

				const screenX = (faceWorldPos.x * 0.5 + 0.5) * SIZE;
				const screenY = (-faceWorldPos.y * 0.5 + 0.5) * SIZE;

				const faceScale = 0.4;
				drawFace(ctx, screenX, screenY, faceScale, state.eyeState, state.blushAlpha);
			}

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
