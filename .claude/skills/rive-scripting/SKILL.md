---
name: rive-scripting
description: Generate Rive editor scripts written in Luau. This skill should be used when the user asks to "write a Rive script", "create a Rive animation with code", "add scripting to Rive", "make a Rive node script", "create a path effect in Rive", "build a Rive converter", "write Rive Luau code", or generally wants to programmatically control Rive assets, animations, or behaviors using the Rive scripting system.
version: 1.0.0
---

Generate Rive scripts written in Luau for use inside the Rive desktop editor. Rive scripting enables procedural animation, custom rendering, data transformation, and state machine logic — all authored directly in the Rive editor alongside design and animation.

## About Rive Scripting

Rive uses **Luau** (a typed superset of Lua) for scripting. Scripts are created as named assets in the Assets Panel and attached to artboards, layouts, strokes, state machines, or data bindings depending on their protocol type.

Key constraints:
- Scripts run **inside the Rive editor** and the Rive runtime — they do NOT run in a browser/Node/Deno context
- Scripts cannot import external modules; all APIs are provided by the Rive runtime globals
- Use `print()` for debugging; output appears in the Debug Panel's Console tab
- The Problems tab shows pre-execution type/syntax errors

## Workflow for Creating a Script

1. Identify the **protocol type** the user needs (see Protocols below)
2. Declare a `type` block for the script's state and inputs
3. Implement the required lifecycle functions for that protocol
4. Return a factory function that returns a table with those lifecycle functions
5. Use `Input<T>` for inspector-visible properties; plain fields for internal state

## Protocols

Each protocol has a different purpose and required interface. Read `references/protocols.md` for full details.

| Protocol | Purpose | Required functions |
|---|---|---|
| **Node Script** | Custom rendering every frame | `init`, `advance`, `draw` |
| **Layout Script** | Control layout dimensions/positioning | `resize` (+ optional `measure`) |
| **Path Effect** | Deform/transform a stroke's path | `update` |
| **Converter** | Transform data binding values | `convert` |
| **Transition Condition** | Custom state machine transition guard | `evaluate` |
| **Listener Action** | Side effects on state machine listener fire | `perform` |
| **Util Script** | Shared library functions (no protocol) | N/A |
| **Test Script** | Unit-test functions | N/A |

## Script Skeleton

All scripts follow this factory pattern:

```lua
type MyScript = {
  -- Input<T> fields appear in the inspector panel
  color: Input<Color>,
  size: Input<number>,
  -- Plain fields are internal state
  path: Path,
  paint: Paint,
}

return function(context): MyScript
  local self: MyScript = {
    color = context:color(Color.rgb(255, 100, 50)),
    size = context:number(40),
    path = Path.new(),
    paint = Paint.with({ style = 'fill', color = Color.rgb(255, 100, 50) }),
  }

  -- lifecycle functions go here

  return self
end
```

## Drawing (Node Scripts)

To draw shapes, use `Path` + `Paint` + `Renderer` in the `draw` function:

```lua
function self:draw(renderer: Renderer)
  self.path:reset()
  self.path:moveTo(Vector.xy(0, 0))
  self.path:lineTo(Vector.xy(100, 0))
  self.path:lineTo(Vector.xy(100, 100))
  self.path:close()
  renderer:drawPath(self.path, self.paint)
end
```

- Call `path:reset()` only **after** drawing (never reset a path you haven't drawn yet in the current frame)
- `renderer:save()` / `renderer:restore()` bracket transform changes
- `renderer:transform(mat)` applies a Mat2d cumulatively

## Inputs and Data Binding

- `Input<T>` fields surface as configurable inputs in the sidebar after adding the script to the scene
- Inputs can be data-bound to ViewModel properties via right-click → Data Bind
- Scripts **cannot** write back to their own Input values
- Listen for changes: `self.myInput:addListener(self.myInput.value, callback)`
- The `update()` lifecycle fires whenever any input changes

## ViewModel Access

Read/write ViewModel properties from `init` context or via `Input<Data.ModelName>`:

```lua
-- In init, via context (Transition Condition / Listener Action scripts):
local vm = context:viewModel()
local hp = vm:getNumber("health")
hp.value = hp.value - 10

-- In Node Script, via typed input:
type MyNode = { character: Input<Data.Character> }
-- then: self.character.health.value
```

## Visual Feedback Loop

Claude cannot see the Rive editor directly. The solution is a SVG/HTML preview rendered by Playwright, which creates a fully autonomous iteration loop — no human in the middle.

### Autonomous Loop (when Playwright is available)

For any Node Script that draws shapes, run this loop without waiting for user input:

1. **Decompose** the target image (or description) into vector primitives
2. **Write** the Rive Luau script and a matching HTML preview file (`/tmp/rive-preview.html`)
3. **Render** the preview using Playwright — screenshot it
4. **Compare** the screenshot to the target image (or stated intent) — identify specific deltas: wrong position, wrong color, wrong scale, missing element
5. **Adjust** the script and preview, re-render, re-screenshot
6. **Repeat** until the screenshot matches the target
7. **Deliver** the final Luau script to the user

Never ask the user to open a file or take a screenshot themselves. Do it autonomously.

### HTML Preview Format

Use an HTML file (not raw SVG) so Canvas 2D can handle animated scripts:

```html
<!DOCTYPE html>
<html>
<head>
<style>
  body { margin: 0; background: #1a1a2e; }
  canvas { display: block; }
</style>
</head>
<body>
<canvas id="c" width="400" height="400"></canvas>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
ctx.translate(200, 200); // center origin to match Rive

// Mirror the Rive draw() function using Canvas 2D
ctx.beginPath();
ctx.moveTo(0, -50);
ctx.lineTo(50, 50);
ctx.lineTo(-50, 50);
ctx.closePath();
ctx.fillStyle = 'rgb(255, 100, 50)';
ctx.fill();
</script>
</body>
</html>
```

For animated scripts, use `requestAnimationFrame` with the same logic as the Rive `advance` + `draw` functions.

See `references/svg-mapping.md` for the full Canvas 2D ↔ Rive API mapping.

### Playwright Workflow

```
Write HTML preview to /tmp/rive-preview.html
→ Playwright: open file:///tmp/rive-preview.html, screenshot → /tmp/rive-preview.png
→ Read /tmp/rive-preview.png (Claude sees it)
→ Compare to target, adjust script and HTML
→ Repeat until match
→ Output final Luau script
```

Use a viewport matching the artboard dimensions. For animated scripts, screenshot after a short delay (e.g. 500ms) to capture a representative frame.

### Fallback (no Playwright)

If Playwright is unavailable, output the HTML preview as a code block and ask the user to open it in a browser and share a screenshot. This is the only case where the user is in the loop.

### SVG → Rive Conversion
When given an existing SVG file:
- Parse each `<path d="...">` element
- Convert path command tokens (M/L/Q/C/Z) to the equivalent Rive Path API calls
- Map `fill`, `stroke`, `stroke-width` attributes to `Paint` configuration
- Wrap in a Node Script `draw` function
- See `references/svg-mapping.md` for full conversion rules

### Known Gap
The HTML/Canvas preview approximates Rive output. It is not the actual Rive runtime. Divergence is rare and limited to: Rive-specific renderer anti-aliasing, artboard nesting, and state machine behaviors. For those, a final check in Rive is still needed — but that is a last-mile confirm, not iteration.

## API Reference

For full API details, read:
- `references/api.md` — Path, Paint, Renderer, Vec2d, Color, Mat2d, Artboard, Animation, ViewModel
- `references/protocols.md` — Full lifecycle signatures and examples for each protocol type
- `references/examples.md` — Complete working script examples
- `references/svg-mapping.md` — SVG↔Rive path conversion rules and worked example

## Naming Convention

Scripts use PascalCase. If the script asset is named `FireParticles`, the main type must also be named `FireParticles`. This is required for the editor to recognize it.

## Common Patterns

**Fixed-step simulation** (frame-rate-independent):
```lua
local FIXED_DT = 1 / 60
local accum = 0

function self:advance(dt: number): boolean
  accum = accum + dt
  while accum >= FIXED_DT do
    -- simulate one step
    accum = accum - FIXED_DT
  end
  return true
end
```

**Spawning artboard instances**:
```lua
type ParticleSystem = { template: Input<Artboard<Data.Particle>> }

function self:init(): boolean
  self.instances = {}
  for i = 1, 10 do
    table.insert(self.instances, self.template:instance())
  end
  return true
end
```

**Animating via timeline**:
```lua
local anim = self.myArtboard:animation("idle")
function self:advance(dt: number): boolean
  anim:advance(dt)
  return true
end
```
