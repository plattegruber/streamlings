/**
 * Shared procedural face drawing used by both 2D and 3D streamling renderers.
 */

/**
 * Draw the streamling's face (eyes, cheeks, mouth) at the given center position and scale.
 *
 * @param {CanvasRenderingContext2D} c
 * @param {number} centerX - Center X of the face
 * @param {number} centerY - Center Y of the face (eye level)
 * @param {number} scale - Scale factor (1.0 = default SVG coordinates)
 * @param {number} eyeState - 0=open, 1=closed, 2=wide, 3=look-left, 4=look-right
 * @param {number} blushAlpha - Cheek blush opacity (0-1)
 */
export function drawFace(c, centerX, centerY, scale, eyeState, blushAlpha) {
	const eyeSpacing = 90 * scale;
	const eyeXL = centerX - eyeSpacing / 2;
	const eyeXR = centerX + eyeSpacing / 2;
	const eyeY = centerY;
	const whiteR = 42 * scale;
	const irisR = 30 * scale;
	const irisWide = 36 * scale;
	const highlightR = 10 * scale;

	for (const ex of [eyeXL, eyeXR]) {
		c.beginPath();
		c.arc(ex, eyeY, whiteR, 0, Math.PI * 2);
		c.fillStyle = '#FFF';
		c.fill();

		if (eyeState === 1) {
			c.beginPath();
			c.arc(ex, eyeY - 4 * scale, irisR, 0.1 * Math.PI, 0.9 * Math.PI);
			c.strokeStyle = 'rgb(80, 40, 20)';
			c.lineWidth = 5 * scale;
			c.lineCap = 'round';
			c.stroke();
		} else {
			let r = eyeState === 2 ? irisWide : irisR;
			let ox = eyeState === 3 ? -8 * scale : eyeState === 4 ? 8 * scale : 0;
			c.beginPath();
			c.arc(ex + ox, eyeY, r, 0, Math.PI * 2);
			c.fillStyle = '#2A0D0F';
			c.fill();
			c.beginPath();
			c.arc(ex + ox + 6 * scale, eyeY - 6 * scale, highlightR, 0, Math.PI * 2);
			c.fillStyle = '#FFF';
			c.fill();
		}
	}

	// Cheeks
	const cheekOffset = 130 * scale;
	const cheekY = centerY + 45 * scale;
	const cheekR = 20 * scale;
	c.beginPath();
	c.arc(centerX - cheekOffset / 2, cheekY, cheekR, 0, Math.PI * 2);
	c.fillStyle = `rgba(255, 140, 140, ${blushAlpha})`;
	c.fill();
	c.beginPath();
	c.arc(centerX + cheekOffset / 2, cheekY, cheekR, 0, Math.PI * 2);
	c.fillStyle = `rgba(255, 140, 140, ${blushAlpha})`;
	c.fill();

	// Mouth
	const mouthY = centerY + 55 * scale;
	const mouthW = 20 * scale;
	c.beginPath();
	c.moveTo(centerX - mouthW, mouthY);
	c.quadraticCurveTo(centerX, mouthY + 15 * scale, centerX + mouthW, mouthY);
	c.quadraticCurveTo(centerX, mouthY + 25 * scale, centerX - mouthW, mouthY);
	c.fillStyle = 'rgb(180, 60, 80)';
	c.fill();
}
