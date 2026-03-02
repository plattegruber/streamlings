# Plant Streamling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a kawaii succulent plant character as a Rive Node Script with 4 mood states (sleeping, idle, engaged, partying) and 3 random idle animations.

**Architecture:** Single self-contained Rive Node Script (`PlantStreamling`) that draws all visual components procedurally and manages mood state transitions internally. An HTML/Canvas 2D preview file mirrors the Rive draw() logic for visual iteration via Playwright screenshots.

**Tech Stack:** Rive Luau (Node Script protocol), HTML Canvas 2D (preview), Playwright (screenshot comparison)

---

### Task 1: Scaffold Preview Infrastructure

**Files:**
- Create: `/tmp/rive-preview.html` (Canvas 2D preview)
- Create: `assets/rive/PlantStreamling.luau` (Rive script — starts as skeleton)

**Step 1: Create the HTML preview scaffold**

Write `/tmp/rive-preview.html`:

```html
<!DOCTYPE html>
<html>
<head>
<style>
  body { margin: 0; background: #1a1a2e; display: flex; justify-content: center; align-items: center; height: 100vh; }
  canvas { display: block; background: transparent; }
</style>
</head>
<body>
<canvas id="c" width="512" height="512"></canvas>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
ctx.translate(256, 256); // center origin to match Rive 512x512 artboard

// Helper: draw a circle using cubic bezier (matches Rive's approach)
function circle(ctx, cx, cy, r) {
  const k = 0.5522847498;
  ctx.moveTo(cx + r, cy);
  ctx.bezierCurveTo(cx + r, cy + r*k, cx + r*k, cy + r, cx, cy + r);
  ctx.bezierCurveTo(cx - r*k, cy + r, cx - r, cy + r*k, cx - r, cy);
  ctx.bezierCurveTo(cx - r, cy - r*k, cx - r*k, cy - r, cx, cy - r);
  ctx.bezierCurveTo(cx + r*k, cy - r, cx + r, cy - r*k, cx + r, cy);
}

// Placeholder: red circle to verify setup
ctx.beginPath();
circle(ctx, 0, 0, 50);
ctx.closePath();
ctx.fillStyle = 'rgb(255, 80, 80)';
ctx.fill();
</script>
</body>
</html>
```

**Step 2: Screenshot to verify setup**

Run: `npx playwright screenshot --viewport-size=512,512 file:///tmp/rive-preview.html /tmp/rive-preview.png`
Expected: Red circle centered on dark background.

**Step 3: Create the Rive script skeleton**

Create `assets/rive/PlantStreamling.luau`:

```lua
type PlantStreamling = {
  mood: Input<number>,       -- 0=sleeping, 1=idle, 2=engaged, 3=partying
  -- Internal state
  time: number,
  currentMood: number,       -- smoothed mood for transitions
  idleVariant: number,       -- which idle animation (0, 1, or 2)
  idleTimer: number,         -- time until next idle variant switch
  -- Drawing resources
  path: Path,
  potPaint: Paint,
  potShadowPaint: Paint,
  ropePaint: Paint,
  eyePaint: Paint,
  eyeWhitePaint: Paint,
  eyeHighlightPaint: Paint,
  blushPaint: Paint,
  mouthPaint: Paint,
  dirtPaint: Paint,
  petalOuterPaint: Paint,
  petalInnerPaint: Paint,
  vinePaint: Paint,
  leafPaint: Paint,
  canPaint: Paint,
}

return function(context): PlantStreamling
  local self: PlantStreamling = {
    mood = context:number(1),
    time = 0,
    currentMood = 1,
    idleVariant = 0,
    idleTimer = 5,
    path = Path.new(),
    potPaint = Paint.with({ style = 'fill', color = Color.rgb(234, 206, 138) }),
    potShadowPaint = Paint.with({ style = 'fill', color = Color.rgb(200, 170, 100) }),
    ropePaint = Paint.with({ style = 'stroke', color = Color.rgb(160, 120, 60), thickness = 4 }),
    eyePaint = Paint.with({ style = 'fill', color = Color.rgb(80, 40, 20) }),
    eyeWhitePaint = Paint.with({ style = 'fill', color = Color.rgb(255, 255, 255) }),
    eyeHighlightPaint = Paint.with({ style = 'fill', color = Color.rgb(255, 255, 255) }),
    blushPaint = Paint.with({ style = 'fill', color = Color.rgba(255, 140, 140, 128) }),
    mouthPaint = Paint.with({ style = 'fill', color = Color.rgb(180, 60, 80) }),
    dirtPaint = Paint.with({ style = 'fill', color = Color.rgb(140, 100, 60) }),
    petalOuterPaint = Paint.with({ style = 'fill', color = Color.rgb(200, 170, 160) }),
    petalInnerPaint = Paint.with({ style = 'fill', color = Color.rgb(160, 180, 140) }),
    vinePaint = Paint.with({ style = 'stroke', color = Color.rgb(100, 140, 70), thickness = 5, cap = 'round' }),
    leafPaint = Paint.with({ style = 'fill', color = Color.rgb(120, 160, 80) }),
    canPaint = Paint.with({ style = 'fill', color = Color.rgb(180, 130, 60) }),
  }

  function self:init(): boolean
    return true
  end

  function self:advance(dt: number): boolean
    self.time = self.time + dt
    return true
  end

  function self:draw(renderer: Renderer)
    -- Components will be added in subsequent tasks
  end

  return self
end
```

**Step 4: Commit**

```bash
git add assets/rive/PlantStreamling.luau
git commit -m "feat: scaffold PlantStreamling Rive script and preview infrastructure"
```

---

### Task 2: Draw the Pot Body

**Files:**
- Modify: `/tmp/rive-preview.html`
- Modify: `assets/rive/PlantStreamling.luau`

**Step 1: Implement pot in HTML preview**

Replace the placeholder in `/tmp/rive-preview.html` with pot drawing code. The pot is a rounded trapezoid: wider at top (~140px wide), narrower at bottom (~110px wide), ~120px tall, centered at y=60 (lower half of character). Use cubic beziers for the rounded corners.

```javascript
// Pot body — rounded trapezoid
function drawPot(ctx) {
  const topW = 70, botW = 55, h = 120, topY = 0, botY = 120;
  const r = 15; // corner radius

  ctx.beginPath();
  // Start at top-left, go clockwise
  ctx.moveTo(-topW + r, topY);
  ctx.lineTo(topW - r, topY);
  // Top-right corner
  ctx.quadraticCurveTo(topW, topY, topW - 3, topY + r);
  // Right side (tapers inward)
  ctx.lineTo(botW + 2, botY - r);
  // Bottom-right corner
  ctx.quadraticCurveTo(botW, botY, botW - r, botY);
  ctx.lineTo(-botW + r, botY);
  // Bottom-left corner
  ctx.quadraticCurveTo(-botW, botY, -botW - 2, botY - r);
  // Left side (tapers inward)
  ctx.lineTo(-topW + 3, topY + r);
  // Top-left corner
  ctx.quadraticCurveTo(-topW, topY, -topW + r, topY);
  ctx.closePath();
  ctx.fillStyle = 'rgb(234, 206, 138)';
  ctx.fill();

  // Pot rim — slightly wider rectangle at top
  ctx.beginPath();
  const rimH = 12;
  ctx.moveTo(-topW - 5, topY);
  ctx.lineTo(topW + 5, topY);
  ctx.lineTo(topW + 3, topY + rimH);
  ctx.lineTo(-topW - 3, topY + rimH);
  ctx.closePath();
  ctx.fillStyle = 'rgb(224, 196, 128)';
  ctx.fill();

  // Rope band
  ctx.beginPath();
  const ropeY = topY + 70;
  ctx.moveTo(-botW - 8, ropeY);
  ctx.quadraticCurveTo(0, ropeY + 6, botW + 8, ropeY);
  ctx.strokeStyle = 'rgb(160, 120, 60)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Bow — two small loops
  ctx.beginPath();
  const bowX = 0, bowY2 = ropeY + 2;
  // Left loop
  ctx.moveTo(bowX, bowY2);
  ctx.quadraticCurveTo(bowX - 14, bowY2 - 10, bowX - 12, bowY2 + 6);
  ctx.quadraticCurveTo(bowX - 8, bowY2 + 14, bowX, bowY2 + 4);
  // Right loop
  ctx.moveTo(bowX, bowY2);
  ctx.quadraticCurveTo(bowX + 14, bowY2 - 10, bowX + 12, bowY2 + 6);
  ctx.quadraticCurveTo(bowX + 8, bowY2 + 14, bowX, bowY2 + 4);
  ctx.fillStyle = 'rgb(160, 120, 60)';
  ctx.fill();

  // Bow tails
  ctx.beginPath();
  ctx.moveTo(bowX - 2, bowY2 + 4);
  ctx.quadraticCurveTo(bowX - 8, bowY2 + 22, bowX - 14, bowY2 + 28);
  ctx.moveTo(bowX + 2, bowY2 + 4);
  ctx.quadraticCurveTo(bowX + 8, bowY2 + 22, bowX + 14, bowY2 + 28);
  ctx.strokeStyle = 'rgb(160, 120, 60)';
  ctx.lineWidth = 3;
  ctx.stroke();
}

ctx.save();
ctx.translate(0, 30); // Position pot in lower portion
drawPot(ctx);
ctx.restore();
```

**Step 2: Screenshot and compare**

Run: `npx playwright screenshot --viewport-size=512,512 file:///tmp/rive-preview.html /tmp/rive-preview.png`
Read the screenshot and compare to reference image pot shape. Iterate until the proportions match.

**Step 3: Mirror to Rive Luau**

Translate the Canvas 2D pot code to the equivalent Rive Path API calls in `PlantStreamling.luau` inside a local `drawPot` function. Use `path:moveTo`, `path:lineTo`, `path:quadTo`, `path:cubicTo`, `path:close()`, and `renderer:drawPath(path, paint)`.

**Step 4: Commit**

```bash
git add assets/rive/PlantStreamling.luau
git commit -m "feat: draw pot body with rim, rope band, and bow"
```

---

### Task 3: Draw the Face

**Files:**
- Modify: `/tmp/rive-preview.html`
- Modify: `assets/rive/PlantStreamling.luau`

**Step 1: Implement face in HTML preview**

Add face drawing to the preview. Position relative to pot center. The face includes:
- Two large oval eyes at (-22, 50) and (22, 50) relative to pot top — each eye is a white oval with dark brown filled circle inside and a small white highlight circle
- Pink blush circles at (-32, 62) and (32, 62) — semi-transparent
- Small open mouth at (0, 68) — a dark pink rounded triangle/oval

```javascript
function drawFace(ctx, eyeState) {
  // eyeState: 0=normal, 1=closed, 2=wide, 3=looking-left, 4=looking-right
  const eyeY = 50;

  // Left eye
  ctx.beginPath();
  circle(ctx, -22, eyeY, 14);
  ctx.closePath();
  ctx.fillStyle = 'rgb(255, 255, 255)';
  ctx.fill();

  if (eyeState === 1) {
    // Closed eye — arc crescent
    ctx.beginPath();
    ctx.arc(-22, eyeY, 10, 0, Math.PI, false);
    ctx.strokeStyle = 'rgb(80, 40, 20)';
    ctx.lineWidth = 3;
    ctx.stroke();
  } else {
    // Iris
    const irisSize = eyeState === 2 ? 10 : 8;
    const lookX = eyeState === 3 ? -4 : eyeState === 4 ? 4 : 0;
    ctx.beginPath();
    circle(ctx, -22 + lookX, eyeY, irisSize);
    ctx.closePath();
    ctx.fillStyle = 'rgb(80, 40, 20)';
    ctx.fill();
    // Highlight
    ctx.beginPath();
    circle(ctx, -22 + lookX + 3, eyeY - 3, 3);
    ctx.closePath();
    ctx.fillStyle = 'rgb(255, 255, 255)';
    ctx.fill();
  }

  // Right eye (mirror)
  ctx.beginPath();
  circle(ctx, 22, eyeY, 14);
  ctx.closePath();
  ctx.fillStyle = 'rgb(255, 255, 255)';
  ctx.fill();

  if (eyeState === 1) {
    ctx.beginPath();
    ctx.arc(22, eyeY, 10, 0, Math.PI, false);
    ctx.strokeStyle = 'rgb(80, 40, 20)';
    ctx.lineWidth = 3;
    ctx.stroke();
  } else {
    const irisSize = eyeState === 2 ? 10 : 8;
    const lookX = eyeState === 3 ? -4 : eyeState === 4 ? 4 : 0;
    ctx.beginPath();
    circle(ctx, 22 + lookX, eyeY, irisSize);
    ctx.closePath();
    ctx.fillStyle = 'rgb(80, 40, 20)';
    ctx.fill();
    ctx.beginPath();
    circle(ctx, 22 + lookX + 3, eyeY - 3, 3);
    ctx.closePath();
    ctx.fillStyle = 'rgb(255, 255, 255)';
    ctx.fill();
  }

  // Blush
  ctx.beginPath();
  circle(ctx, -32, eyeY + 12, 8);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 140, 140, 0.5)';
  ctx.fill();

  ctx.beginPath();
  circle(ctx, 32, eyeY + 12, 8);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 140, 140, 0.5)';
  ctx.fill();

  // Mouth — small open smile
  ctx.beginPath();
  ctx.moveTo(-6, eyeY + 22);
  ctx.quadraticCurveTo(0, eyeY + 30, 6, eyeY + 22);
  ctx.closePath();
  ctx.fillStyle = 'rgb(180, 60, 80)';
  ctx.fill();
}
```

**Step 2: Screenshot and iterate**

Run: `npx playwright screenshot --viewport-size=512,512 file:///tmp/rive-preview.html /tmp/rive-preview.png`
Compare face proportions and cuteness to reference. Adjust eye size/position/spacing until it matches the kawaii style.

**Step 3: Mirror to Rive Luau**

Add a local `drawFace(renderer, path, eyeState)` function to PlantStreamling.luau. The `eyeState` parameter controls expressions: 0=normal, 1=closed (sleeping), 2=wide (engaged/partying), 3=looking-left, 4=looking-right.

**Step 4: Commit**

```bash
git add assets/rive/PlantStreamling.luau
git commit -m "feat: draw face with expressive eyes, blush, and mouth"
```

---

### Task 4: Draw the Succulent and Dirt

**Files:**
- Modify: `/tmp/rive-preview.html`
- Modify: `assets/rive/PlantStreamling.luau`

**Step 1: Implement succulent in HTML preview**

The succulent sits on top of the pot. Draw it as:
1. Dirt ring (dark brown ellipse at pot top)
2. Three concentric rings of petals, each petal is a tear-drop / pointed oval:
   - Inner ring: 5 small petals, sage green `rgb(160, 180, 140)`
   - Middle ring: 8 medium petals, blended color
   - Outer ring: 11 large petals, dusty pink `rgb(200, 170, 160)`
3. Each petal is rotated around the center at equal spacing

```javascript
function drawSucculent(ctx, droopAmount) {
  // droopAmount: 0 = normal, 1 = fully drooped (sleeping)
  const centerY = -10; // sits above pot rim

  // Dirt ring
  ctx.beginPath();
  ctx.ellipse(0, centerY + 25, 62, 14, 0, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = 'rgb(140, 100, 60)';
  ctx.fill();

  // Draw petal rings from outermost to innermost
  const rings = [
    { count: 11, radius: 55, petalW: 18, petalH: 30, color: 'rgb(200, 170, 160)', angleOff: 0 },
    { count: 8, radius: 35, petalW: 14, petalH: 24, color: 'rgb(180, 175, 150)', angleOff: 0.2 },
    { count: 5, radius: 18, petalW: 10, petalH: 18, color: 'rgb(160, 180, 140)', angleOff: 0.1 },
  ];

  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const angle = (i / ring.count) * Math.PI * 2 + ring.angleOff;
      const px = Math.cos(angle) * ring.radius;
      const py = Math.sin(angle) * ring.radius * (1 - droopAmount * 0.3);

      ctx.save();
      ctx.translate(px, centerY + py);
      ctx.rotate(angle + Math.PI / 2);
      ctx.scale(1, 1 - droopAmount * 0.15);

      // Teardrop petal
      ctx.beginPath();
      ctx.moveTo(0, -ring.petalH / 2);
      ctx.quadraticCurveTo(ring.petalW / 2, -ring.petalH / 4, ring.petalW / 3, ring.petalH / 3);
      ctx.quadraticCurveTo(0, ring.petalH / 2, -ring.petalW / 3, ring.petalH / 3);
      ctx.quadraticCurveTo(-ring.petalW / 2, -ring.petalH / 4, 0, -ring.petalH / 2);
      ctx.closePath();
      ctx.fillStyle = ring.color;
      ctx.fill();

      ctx.restore();
    }
  }

  // Center dot
  ctx.beginPath();
  circle(ctx, 0, centerY, 6);
  ctx.closePath();
  ctx.fillStyle = 'rgb(150, 175, 135)';
  ctx.fill();
}
```

**Step 2: Screenshot and compare**

Run: `npx playwright screenshot --viewport-size=512,512 file:///tmp/rive-preview.html /tmp/rive-preview.png`
Compare succulent rosette shape to reference. The petals should form a layered rosette with pink outer petals and green inner petals.

**Step 3: Mirror to Rive Luau**

Add a local `drawSucculent(renderer, path, droopAmount)` function. Use `renderer:save()`, `renderer:transform(Mat2d.withRotation(...))`, and `renderer:restore()` for petal rotation.

**Step 4: Commit**

```bash
git add assets/rive/PlantStreamling.luau
git commit -m "feat: draw succulent rosette with 3 petal rings and dirt"
```

---

### Task 5: Draw the Vine Arms

**Files:**
- Modify: `/tmp/rive-preview.html`
- Modify: `assets/rive/PlantStreamling.luau`

**Step 1: Implement vines in HTML preview**

Two vines emerge from the pot sides:
- **Left vine** (holds watering can): Starts at (-65, 50), curves outward and down, ends at about (-120, 30). Has a small copper watering can at the tip.
- **Right vine**: Starts at (65, 50), curves outward and down to (130, 20). Has small paired leaf nodes along its length.

```javascript
function drawVines(ctx, vineWaveOffset) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Left vine (with watering can)
  ctx.beginPath();
  ctx.moveTo(-65, 50);
  ctx.bezierCurveTo(-90, 30 + vineWaveOffset, -110, 15, -125, 25 + vineWaveOffset);
  ctx.strokeStyle = 'rgb(100, 140, 70)';
  ctx.lineWidth = 5;
  ctx.stroke();

  // Small leaves on left vine
  drawLeaf(ctx, -85, 32 + vineWaveOffset * 0.5, -0.4);
  drawLeaf(ctx, -105, 18 + vineWaveOffset * 0.7, -0.2);

  // Watering can at left vine tip
  drawWateringCan(ctx, -125, 22 + vineWaveOffset, 0);

  // Right vine
  ctx.beginPath();
  ctx.moveTo(65, 50);
  ctx.bezierCurveTo(90, 35 - vineWaveOffset * 0.5, 115, 10, 135, 15 - vineWaveOffset * 0.5);
  ctx.strokeStyle = 'rgb(100, 140, 70)';
  ctx.lineWidth = 5;
  ctx.stroke();

  // Leaves on right vine
  drawLeaf(ctx, 85, 38 - vineWaveOffset * 0.3, 0.3);
  drawLeaf(ctx, 110, 18 - vineWaveOffset * 0.4, 0.5);
  drawLeaf(ctx, 130, 14 - vineWaveOffset * 0.3, 0.2);
}

function drawLeaf(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.quadraticCurveTo(8, -3, 0, 6);
  ctx.quadraticCurveTo(-8, -3, 0, -6);
  ctx.closePath();
  ctx.fillStyle = 'rgb(120, 160, 80)';
  ctx.fill();
  ctx.restore();
}

function drawWateringCan(ctx, x, y, tiltAngle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tiltAngle);
  // Can body
  ctx.beginPath();
  ctx.rect(-8, -6, 16, 12);
  ctx.fillStyle = 'rgb(180, 130, 60)';
  ctx.fill();
  // Handle
  ctx.beginPath();
  ctx.arc(0, -10, 8, Math.PI, 0);
  ctx.strokeStyle = 'rgb(160, 110, 40)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // Spout
  ctx.beginPath();
  ctx.moveTo(8, -2);
  ctx.lineTo(16, -8);
  ctx.strokeStyle = 'rgb(180, 130, 60)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}
```

**Step 2: Screenshot and compare**

Run: `npx playwright screenshot --viewport-size=512,512 file:///tmp/rive-preview.html /tmp/rive-preview.png`
Compare vine shapes and watering can to reference.

**Step 3: Mirror to Rive Luau**

Add local `drawVines`, `drawLeaf`, and `drawWateringCan` functions to PlantStreamling.luau.

**Step 4: Commit**

```bash
git add assets/rive/PlantStreamling.luau
git commit -m "feat: draw vine arms with leaves and watering can"
```

---

### Task 6: Static Character Assembly and Visual Tuning

**Files:**
- Modify: `/tmp/rive-preview.html`
- Modify: `assets/rive/PlantStreamling.luau`

**Step 1: Assemble all components in preview**

Combine drawPot, drawFace, drawSucculent, drawVines into a single `drawPlant(ctx)` function. Order matters (back to front): vines behind pot, dirt, pot body, face, succulent on top.

```javascript
function drawPlant(ctx) {
  ctx.save();
  ctx.translate(0, 30); // offset entire character down

  drawVines(ctx, 0);      // behind pot
  drawSucculent(ctx, 0);  // sits in pot top
  drawPot(ctx);           // pot body covers vine bases
  drawFace(ctx, 0);       // on pot

  ctx.restore();
}
```

**Step 2: Screenshot full character and compare to reference**

Run: `npx playwright screenshot --viewport-size=512,512 file:///tmp/rive-preview.html /tmp/rive-preview.png`
Compare the assembled character to the reference image. Check proportions, layering, and color harmony. Iterate on any component that looks wrong.

**Step 3: Tune proportions**

Adjust sizes, positions, and colors until the character is recognizably the kawaii succulent from the reference. This is an iterative step — screenshot, compare, adjust, repeat.

**Step 4: Mirror final static layout to Rive Luau**

Update `PlantStreamling.luau` draw() to call all component functions in the correct order with correct transforms.

**Step 5: Commit**

```bash
git add assets/rive/PlantStreamling.luau
git commit -m "feat: assemble full static plant character with visual tuning"
```

---

### Task 7: Add Advance Logic and Mood Transitions

**Files:**
- Modify: `/tmp/rive-preview.html`
- Modify: `assets/rive/PlantStreamling.luau`

**Step 1: Implement advance() in HTML preview**

Add `requestAnimationFrame` loop and state management:

```javascript
let time = 0;
let targetMood = 1; // default idle
let currentMood = 1;
let idleVariant = 0;
let idleTimer = 5;

function advance(dt) {
  time += dt;

  // Smooth mood transition (lerp toward target over ~0.5s)
  currentMood += (targetMood - currentMood) * Math.min(1, dt * 4);

  // Idle variant cycling
  if (Math.round(currentMood) === 1) {
    idleTimer -= dt;
    if (idleTimer <= 0) {
      idleVariant = (idleVariant + 1) % 3;
      idleTimer = 5 + Math.random() * 3; // 5-8 seconds
    }
  }
}

// Animation loop
let lastTime = 0;
function animate(timestamp) {
  const dt = lastTime ? (timestamp - lastTime) / 1000 : 0;
  lastTime = timestamp;
  advance(dt);

  ctx.clearRect(-256, -256, 512, 512);
  drawPlant(ctx);

  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// Keyboard controls for testing: 0-3 to set mood
document.addEventListener('keydown', (e) => {
  if (e.key >= '0' && e.key <= '3') targetMood = parseInt(e.key);
});
```

**Step 2: Implement advance() in Rive Luau**

```lua
function self:advance(dt: number): boolean
  self.time = self.time + dt

  -- Smooth mood transition
  local target = self.mood.value
  self.currentMood = self.currentMood + (target - self.currentMood) * math.min(1, dt * 4)

  -- Idle variant cycling
  if math.floor(self.currentMood + 0.5) == 1 then
    self.idleTimer = self.idleTimer - dt
    if self.idleTimer <= 0 then
      self.idleVariant = (self.idleVariant + 1) % 3
      self.idleTimer = 5 + math.random() * 3
    end
  end

  return true
end
```

**Step 3: Screenshot to verify animation loop runs**

Run Playwright with a 1-second delay to capture a mid-animation frame.

**Step 4: Commit**

```bash
git add assets/rive/PlantStreamling.luau
git commit -m "feat: add advance() with mood smoothing and idle variant cycling"
```

---

### Task 8: Sleeping Animation

**Files:**
- Modify: `/tmp/rive-preview.html`
- Modify: `assets/rive/PlantStreamling.luau`

**Step 1: Implement sleeping visuals**

When `currentMood` approaches 0:
- Eyes → closed crescents (eyeState = 1)
- Succulent droops (droopAmount increases)
- Whole character bobs with 4s breathing cycle: `bobY = sin(time * PI/2) * 4`
- Vines hang limp (less curl offset)

Update `drawPlant` to accept animation state:

```javascript
function drawPlant(ctx) {
  const moodBlend = currentMood; // 0=sleeping...3=partying
  const sleepiness = Math.max(0, 1 - moodBlend); // 1 when sleeping, 0 when idle+

  // Breathing bob
  const breathBob = sleepiness * Math.sin(time * Math.PI / 2) * 4;

  // Eye state
  let eyeState = 0; // normal
  if (sleepiness > 0.5) eyeState = 1; // closed

  // Succulent droop
  const droop = sleepiness * 0.6;

  ctx.save();
  ctx.translate(0, 30 + breathBob);
  drawVines(ctx, sleepiness * -3);
  drawSucculent(ctx, droop);
  drawPot(ctx);
  drawFace(ctx, eyeState);
  ctx.restore();
}
```

**Step 2: Screenshot at mood=0 and compare**

Set `targetMood = 0`, wait 1s, screenshot. Should show closed eyes, drooped succulent, breathing bob.

**Step 3: Add Z particle system**

Floating "Z" letters that drift upward when sleeping:

```javascript
const zParticles = [];
function updateZParticles(dt, sleepiness) {
  // Spawn
  if (sleepiness > 0.5 && Math.random() < dt * 1.5) {
    zParticles.push({ x: 30 + Math.random() * 20, y: 0, life: 0, maxLife: 2.5 });
  }
  // Update
  for (let i = zParticles.length - 1; i >= 0; i--) {
    const z = zParticles[i];
    z.life += dt;
    z.y -= dt * 30;
    z.x += Math.sin(z.life * 2) * dt * 10;
    if (z.life >= z.maxLife) zParticles.splice(i, 1);
  }
}

function drawZParticles(ctx) {
  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = 'rgba(180, 180, 220, 0.7)';
  for (const z of zParticles) {
    const alpha = 1 - z.life / z.maxLife;
    ctx.globalAlpha = alpha * 0.7;
    const size = 12 + (z.life / z.maxLife) * 8;
    ctx.font = `bold ${size}px sans-serif`;
    ctx.fillText('z', z.x, z.y - 80);
  }
  ctx.globalAlpha = 1;
}
```

**Note:** Z particles in Rive Luau will be drawn as simple "Z" shapes using path lines (no font rendering in Rive scripts). Use angular line segments to form a Z shape.

**Step 4: Mirror to Rive Luau and commit**

```bash
git add assets/rive/PlantStreamling.luau
git commit -m "feat: add sleeping animation with breathing, droopy petals, and Z particles"
```

---

### Task 9: Idle Animations (3 Variants)

**Files:**
- Modify: `/tmp/rive-preview.html`
- Modify: `assets/rive/PlantStreamling.luau`

**Step 1: Implement idle variant 0 — Leaf wiggle + blink**

When `idleVariant == 0`:
- Petals sway side to side: `swayX = sin(time * 1.2) * 3`
- Every ~4 seconds, a blink occurs: eyes close for 0.15s then reopen

```javascript
function getIdleState(variant, time) {
  let eyeState = 0;
  let swayX = 0;
  let vineWave = Math.sin(time * 0.8) * 2;

  if (variant === 0) {
    // Leaf wiggle + blink
    swayX = Math.sin(time * 1.2) * 3;
    const blinkCycle = time % 4;
    if (blinkCycle > 3.8 && blinkCycle < 3.95) eyeState = 1;
  } else if (variant === 1) {
    // Vine fidget + look around
    vineWave = Math.sin(time * 1.5) * 5;
    const lookCycle = time % 5;
    if (lookCycle < 1.5) eyeState = 3; // look left
    else if (lookCycle < 3) eyeState = 4; // look right
    else eyeState = 0; // center
  } else if (variant === 2) {
    // Water self — left vine lifts, can tilts, water drops
    // Animated via vineWave and canTilt
    vineWave = Math.sin(time * 0.5) * 3;
  }

  return { eyeState, swayX, vineWave };
}
```

**Step 2: Implement idle variant 1 — Vine fidget + look around**

Eyes glance left (eyeState=3) for 1.5s, right (eyeState=4) for 1.5s, center for 2s. Vine wave amplitude increases.

**Step 3: Implement idle variant 2 — Water self**

Left vine arm lifts upward (change bezier control points), watering can tilts, small blue water drops fall from spout onto succulent. Water drops are small blue circles that fall with gravity.

**Step 4: Screenshot each variant**

Set `idleVariant = 0`, screenshot. Set to 1, screenshot. Set to 2, screenshot. Compare all three.

**Step 5: Mirror to Rive Luau and commit**

```bash
git add assets/rive/PlantStreamling.luau
git commit -m "feat: add 3 idle animation variants — wiggle+blink, fidget+look, water self"
```

---

### Task 10: Engaged Animation

**Files:**
- Modify: `/tmp/rive-preview.html`
- Modify: `assets/rive/PlantStreamling.luau`

**Step 1: Implement engaged visuals**

When `currentMood` approaches 2:
- Eyes widen (eyeState = 2, larger irises)
- Succulent perks up (scale Y increase — `1 + perk * 0.1`)
- Gentle bouncing (1.5s cycle): `bounceY = abs(sin(time * PI/0.75)) * 8`
- Vines sway actively (larger vineWave amplitude)

```javascript
function getEngagedState(time) {
  const bounceY = Math.abs(Math.sin(time * Math.PI / 0.75)) * 8;
  const vineWave = Math.sin(time * 2) * 6;
  return { eyeState: 2, bounceY, vineWave, perkAmount: 0.1 };
}
```

**Step 2: Add sparkle particles**

Small 4-pointed star shapes that occasionally appear around the character:

```javascript
const sparkles = [];
function updateSparkles(dt, engagedness) {
  if (engagedness > 0.5 && Math.random() < dt * 2) {
    sparkles.push({
      x: (Math.random() - 0.5) * 160,
      y: (Math.random() - 0.5) * 120 - 40,
      life: 0,
      maxLife: 0.8,
      size: 3 + Math.random() * 4,
    });
  }
  for (let i = sparkles.length - 1; i >= 0; i--) {
    sparkles[i].life += dt;
    if (sparkles[i].life >= sparkles[i].maxLife) sparkles.splice(i, 1);
  }
}

function drawSparkle(ctx, x, y, size, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgb(255, 230, 100)';
  ctx.beginPath();
  // 4-pointed star
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size * 0.3, y - size * 0.3);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x + size * 0.3, y + size * 0.3);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size * 0.3, y + size * 0.3);
  ctx.lineTo(x - size, y);
  ctx.lineTo(x - size * 0.3, y - size * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}
```

**Step 3: Screenshot at mood=2 and compare**

**Step 4: Mirror to Rive Luau and commit**

```bash
git add assets/rive/PlantStreamling.luau
git commit -m "feat: add engaged animation with bouncing, wide eyes, and sparkles"
```

---

### Task 11: Partying Animation

**Files:**
- Modify: `/tmp/rive-preview.html`
- Modify: `assets/rive/PlantStreamling.luau`

**Step 1: Implement partying visuals**

When `currentMood` approaches 3:
- Eyes extra wide (eyeState = 2 with even larger irises)
- Fast bouncing with slight rotation: `bounceY = abs(sin(time * PI/0.4)) * 12`, `rotation = sin(time * 4) * 0.05`
- Succulent petals fan outward (scale increase)
- Both vine arms wave upward
- Blush intensifies (alpha increases)

```javascript
function getPartyState(time) {
  const bounceY = Math.abs(Math.sin(time * Math.PI / 0.4)) * 12;
  const rotation = Math.sin(time * 4) * 0.05;
  const vineWave = Math.sin(time * 3) * 10;
  return { eyeState: 2, bounceY, rotation, vineWave, blushIntensity: 1.0 };
}
```

**Step 2: Add confetti particles**

Colored shapes (circles, squares, triangles) that burst outward:

```javascript
const confetti = [];
function updateConfetti(dt, partyness) {
  if (partyness > 0.5 && Math.random() < dt * 8) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 120;
    confetti.push({
      x: 0, y: -40,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 60,
      life: 0, maxLife: 1.5,
      color: ['rgb(255,100,100)', 'rgb(100,200,255)', 'rgb(255,220,50)', 'rgb(150,255,150)'][Math.floor(Math.random()*4)],
      size: 3 + Math.random() * 3,
      shape: Math.floor(Math.random() * 3), // 0=circle, 1=square, 2=triangle
    });
  }
  for (let i = confetti.length - 1; i >= 0; i--) {
    const c = confetti[i];
    c.life += dt;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.vy += 120 * dt; // gravity
    if (c.life >= c.maxLife) confetti.splice(i, 1);
  }
}
```

**Step 3: Screenshot at mood=3 and compare**

**Step 4: Mirror to Rive Luau and commit**

```bash
git add assets/rive/PlantStreamling.luau
git commit -m "feat: add partying animation with fast bounce, rotation, and confetti"
```

---

### Task 12: Mood Blending and Final Polish

**Files:**
- Modify: `/tmp/rive-preview.html`
- Modify: `assets/rive/PlantStreamling.luau`

**Step 1: Implement smooth blending between all states**

The `currentMood` float blends between states. Extract per-state parameters and lerp between adjacent states:

```javascript
function getAnimationState(currentMood, time, idleVariant) {
  // Decompose mood into two adjacent states and blend factor
  const lower = Math.floor(currentMood);
  const upper = Math.min(3, lower + 1);
  const blend = currentMood - lower;

  const stateA = getStateParams(lower, time, idleVariant);
  const stateB = getStateParams(upper, time, idleVariant);

  return {
    eyeState: blend < 0.5 ? stateA.eyeState : stateB.eyeState,
    bounceY: lerp(stateA.bounceY, stateB.bounceY, blend),
    rotation: lerp(stateA.rotation, stateB.rotation, blend),
    vineWave: lerp(stateA.vineWave, stateB.vineWave, blend),
    droop: lerp(stateA.droop, stateB.droop, blend),
    perk: lerp(stateA.perk, stateB.perk, blend),
    blushIntensity: lerp(stateA.blushIntensity, stateB.blushIntensity, blend),
    swayX: lerp(stateA.swayX, stateB.swayX, blend),
  };
}

function lerp(a, b, t) { return a + (b - a) * t; }
```

**Step 2: Full animation pass**

Run the preview with keyboard controls (0-3) to cycle through all moods. Screenshot each state. Verify transitions look smooth.

**Step 3: Mirror finalized blending to Rive Luau**

**Step 4: Commit**

```bash
git add assets/rive/PlantStreamling.luau
git commit -m "feat: add smooth mood blending between all 4 states"
```

---

### Task 13: Final Rive Script Assembly and Cleanup

**Files:**
- Modify: `assets/rive/PlantStreamling.luau`

**Step 1: Clean up the Rive Luau script**

Review the complete PlantStreamling.luau:
- Ensure all drawing functions use the Rive Path API (not Canvas 2D)
- Ensure `path:reset()` is called correctly (after drawing, before reuse)
- Verify `renderer:save()`/`renderer:restore()` pairs are balanced
- Remove any debug code
- Add brief comments for each component section

**Step 2: Verify script follows Node Script protocol**

Confirm: `init()` returns boolean, `advance(dt)` returns boolean, `draw(renderer)` takes Renderer. Type block declares all fields. Factory function returns the table.

**Step 3: Final commit**

```bash
git add assets/rive/PlantStreamling.luau
git commit -m "feat: finalize PlantStreamling Rive Node Script with all mood states and idle variants"
```

---

## Implementation Notes

**Visual feedback loop:** Every drawing task follows the pattern: write Canvas 2D preview → Playwright screenshot → compare to reference → iterate → mirror to Rive Luau. The preview file is a development tool, not committed.

**Rive-specific constraints:**
- No font rendering in scripts — "Z" particles use path-drawn Z shapes
- `path:reset()` only after the path has been drawn in a previous frame
- `renderer:save()`/`restore()` must bracket every `renderer:transform()` call
- Paints should be created once in the factory, not per-frame
- Use `Mat2d.withRotation()` and `Mat2d.withTranslation()` for transforms, composed via `*`

**Testing in Rive:** After implementation, the script should be pasted into the Rive editor as a Node Script asset, attached to a 512x512 artboard, and the `mood` input tested with values 0-3.
