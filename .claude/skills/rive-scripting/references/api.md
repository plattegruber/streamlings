# Rive Scripting API Reference

## Path

Create: `Path.new()`

| Method | Description |
|---|---|
| `path:moveTo(vec)` | Start a new contour at `vec` |
| `path:lineTo(vec)` | Add a straight line segment to `vec` |
| `path:quadTo(control, end)` | Quadratic Bézier curve |
| `path:cubicTo(c1, c2, end)` | Cubic Bézier curve |
| `path:close()` | Close the current contour back to last moveTo |
| `path:reset()` | Clear path — call only after drawing in a previous frame |
| `path:add(otherPath, mat?)` | Combine paths, optionally with a Mat2d transform |
| `path:measure()` | Returns a `PathMeasure` for total length |
| `path:contours()` | Returns `ContourMeasure` iterator for per-contour analysis |

**Constraint:** A mutated path can only be drawn once per frame. Reset it the next frame before reuse.

---

## Paint

Create: `Paint.new()` or `Paint.with(def: PaintDefinition)`

| Property | Type | Description |
|---|---|---|
| `paint.style` | `'fill' \| 'stroke'` | Fill or stroke |
| `paint.color` | `Color` | Paint color |
| `paint.thickness` | `number` | Stroke width |
| `paint.join` | `'miter' \| 'round' \| 'bevel'` | Stroke join style |
| `paint.cap` | `'butt' \| 'round' \| 'square'` | Stroke cap style |
| `paint.gradient` | `Gradient` | Gradient fill/stroke |
| `paint.blendMode` | `BlendMode` | Compositing mode |
| `paint.feather` | `number` | Edge softness |

`Paint.with({...})` accepts a `PaintDefinition` table with any of the above keys.
`paint:copy()` creates a modified copy.

---

## Renderer

Received as argument to `draw(renderer)`.

| Method | Description |
|---|---|
| `renderer:drawPath(path, paint)` | Draw a Path with a Paint |
| `renderer:drawImage(img, sampler, blendMode, opacity)` | Draw an Image |
| `renderer:drawImageMesh(img, verts, uvs, tris, sampler, blendMode, opacity)` | Draw image with mesh deformation |
| `renderer:clipPath(path)` | Restrict subsequent drawing to path region |
| `renderer:save()` | Push transform/clip state |
| `renderer:restore()` | Pop transform/clip state |
| `renderer:transform(mat2d)` | Apply a cumulative Mat2d transform |

Use `save()` / `restore()` around any block that modifies state.

---

## Vec2d (Vector)

Create: `Vector.xy(x, y)` or `Vector.origin()`

| Property / Method | Description |
|---|---|
| `v.x`, `v.y` | Read-only components |
| `Vector.xy(x, y)` | Constructor |
| `Vector.origin()` | Returns `(0, 0)` |
| `Vector.lerp(a, b, t)` | Linear interpolation |
| `Vector.normalized(v)` | Returns unit vector |
| `Vector.distance(a, b)` | Euclidean distance |
| `Vector.distanceSquared(a, b)` | Faster distance check |
| `Vector.dot(a, b)` | Dot product |
| `Vector.cross(a, b)` | Z-component of 3D cross product |
| `Vector.length(v)` | Magnitude |
| `Vector.scaleAndAdd(a, b, s)` | `a + b * s` |
| `Vector.scaleAndSub(a, b, s)` | `a - b * s` |
| Operators: `+`, `-`, `*`, `/`, unary `-`, `==` | Component-wise operations |

Prefer static methods over instance methods for performance.

---

## Color

| Constructor | Description |
|---|---|
| `Color.rgb(r, g, b)` | 0–255 channels, alpha=255 |
| `Color.rgba(r, g, b, a)` | 0–255 all channels |
| `Color.lerp(from, to, t)` | Interpolate between two colors |

| Static / Accessor | Description |
|---|---|
| `Color.red(c)` | Get/set red channel |
| `Color.green(c)` | Get/set green channel |
| `Color.blue(c)` | Get/set blue channel |
| `Color.alpha(c)` | Get/set alpha channel (0–255) |
| `Color.opacity(c)` | Get/set opacity as 0.0–1.0 |

All channels are clamped to valid ranges automatically.

---

## Mat2d (2D Transform Matrix)

| Constructor | Description |
|---|---|
| `Mat2d.identity()` | No transformation |
| `Mat2d.withTranslation(x, y)` or `(vec)` | Translation matrix |
| `Mat2d.withScale(sx, sy?)` | Uniform or non-uniform scale |
| `Mat2d.withScaleAndTranslation(s, tx, ty)` | Combined |
| `Mat2d.withRotation(radians)` | Rotation matrix |
| `Mat2d.values(xx, xy, yx, yy, tx, ty)` | Raw components |

| Method | Description |
|---|---|
| `mat:invert()` | Returns inverse or nil if non-invertible |
| `Mat2d.invert(mat)` | Static version |
| `mat:isIdentity()` | True if identity |
| `mat1 * mat2` | Matrix multiplication |
| `mat * vec` | Transform a point |

Fields: `xx`, `xy`, `yx`, `yy` (rotation/scale/skew) + `tx`, `ty` (translation).

---

## Artboard

Artboard instances are obtained via `Input<Artboard<Data.T>>` inputs.

| Property | Description |
|---|---|
| `ab.width` | Horizontal size (readable/writable) |
| `ab.height` | Vertical size (readable/writable) |
| `ab.frameOrigin` | If true, treat artboard origin as frame origin |
| `ab.data` | Typed data associated with the artboard |

| Method | Description |
|---|---|
| `ab:draw(renderer)` | Render the artboard |
| `ab:advance(dt)` | Advance by dt seconds; returns true to continue |
| `ab:instance()` | Create an independent instance with separate state |
| `ab:animation(name?)` | Get an Animation instance connected to this artboard |
| `ab:bounds()` | Returns `minPt, maxPt` as two Vec2d values |
| `ab:node(name)` | Find a node by name; returns nil if not found |
| `ab:addToPath(path, mat?)` | Incorporate artboard geometry into a path |
| Pointer events: `pointerDown(x,y)`, `pointerUp(x,y)`, `pointerMove(x,y)`, `pointerExit(x,y)` | Returns 0 (no hit) or non-zero (hit) |

---

## Animation

Obtained via `artboard:animation(name?)`.

| Property | Description |
|---|---|
| `anim.duration` | Total duration in seconds |

| Method | Description |
|---|---|
| `anim:advance(dt)` | Advance playback; returns false when finished (looping always returns true) |
| `anim:setTime(seconds)` | Jump to time position |
| `anim:setTimeFrames(frames)` | Jump to frame position |
| `anim:setTimePercentage(pct)` | Jump to 0.0–1.0 percentage |

---

## ViewModel

Obtained via `context:viewModel()` in Transition Condition and Listener Action scripts, or via `Input<Data.ModelName>` inputs.

| Method | Returns | Description |
|---|---|---|
| `vm:getNumber(name)` | `DataValueNumber` | Numeric property; read/write `.value` |
| `vm:getString(name)` | `DataValueString` | String property |
| `vm:getBoolean(name)` | `DataValueBoolean` | Boolean property |
| `vm:getColor(name)` | `DataValueColor` | Color property; set `.value = Color.rgba(...)` |
| `vm:getList(name)` | `PropertyList` | List; supports `pop()`, etc. |
| `vm:getEnum(name)` | `PropertyEnum` | Enum value |
| `vm:getTrigger(name)` | `Trigger` | Call `:fire()` to activate |

`vm.name` — the ViewModel instance name.

---

## Image

Obtained via `context:image('assetName')`.

| Property | Description |
|---|---|
| `img.width` | Image width in pixels |
| `img.height` | Image height in pixels |

Used with `renderer:drawImage(img, sampler, blendMode, opacity)`.

Related types: `ImageSampler` (wrap/filter), `ImageFilter` (effects), `ImageWrap`.
