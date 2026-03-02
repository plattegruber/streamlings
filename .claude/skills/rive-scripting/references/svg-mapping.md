# SVG / Canvas 2D ↔ Rive Path Conversion

The HTML preview file uses **Canvas 2D** (not raw SVG) because it supports animation via `requestAnimationFrame`. Both map cleanly from Rive.

## Canvas 2D ↔ Rive API

| Rive | Canvas 2D |
|---|---|
| `path:moveTo(Vector.xy(x, y))` | `ctx.moveTo(x, y)` (after `ctx.beginPath()`) |
| `path:lineTo(Vector.xy(x, y))` | `ctx.lineTo(x, y)` |
| `path:quadTo(Vector.xy(cx,cy), Vector.xy(x,y))` | `ctx.quadraticCurveTo(cx, cy, x, y)` |
| `path:cubicTo(Vector.xy(c1x,c1y), Vector.xy(c2x,c2y), Vector.xy(x,y))` | `ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x, y)` |
| `path:close()` | `ctx.closePath()` |
| `renderer:drawPath(path, fillPaint)` | `ctx.fillStyle = '...'; ctx.fill()` |
| `renderer:drawPath(path, strokePaint)` | `ctx.strokeStyle = '...'; ctx.lineWidth = n; ctx.stroke()` |
| `renderer:save()` | `ctx.save()` |
| `renderer:restore()` | `ctx.restore()` |
| `renderer:transform(mat)` | `ctx.transform(mat.xx, mat.xy, mat.yx, mat.yy, mat.tx, mat.ty)` |
| `Color.rgb(r, g, b)` | `'rgb(r, g, b)'` |
| `Color.rgba(r, g, b, a)` | `'rgba(r, g, b, a/255)'` |
| `paint.join = 'round'` | `ctx.lineJoin = 'round'` |
| `paint.cap = 'round'` | `ctx.lineCap = 'round'` |

**Coordinate system:** Add `ctx.translate(width/2, height/2)` once at setup so origin matches Rive's artboard center.

For two-pass shapes (fill + stroke), call `fill()` then `stroke()` in separate `beginPath()` blocks — same as Rive's two-paint approach.

---

# SVG ↔ Rive Path Conversion

## Path Command Mapping

| SVG `d` token | Rive Path API | Notes |
|---|---|---|
| `M x y` | `path:moveTo(Vector.xy(x, y))` | Absolute moveTo |
| `m dx dy` | `path:moveTo(Vector.xy(cur.x+dx, cur.y+dy))` | Relative — resolve to absolute first |
| `L x y` | `path:lineTo(Vector.xy(x, y))` | Absolute lineTo |
| `l dx dy` | `path:lineTo(Vector.xy(cur.x+dx, cur.y+dy))` | Relative |
| `H x` | `path:lineTo(Vector.xy(x, cur.y))` | Horizontal line |
| `V y` | `path:lineTo(Vector.xy(cur.x, y))` | Vertical line |
| `Q cx cy x y` | `path:quadTo(Vector.xy(cx,cy), Vector.xy(x,y))` | Quadratic Bézier |
| `C c1x c1y c2x c2y x y` | `path:cubicTo(Vector.xy(c1x,c1y), Vector.xy(c2x,c2y), Vector.xy(x,y))` | Cubic Bézier |
| `S c2x c2y x y` | `path:cubicTo(reflected_c1, Vector.xy(c2x,c2y), Vector.xy(x,y))` | Smooth cubic — reflect previous control point |
| `T x y` | `path:quadTo(reflected_ctrl, Vector.xy(x,y))` | Smooth quadratic |
| `A rx ry rot large-arc sweep x y` | Approximate with cubics (see below) | No direct Rive arc primitive |
| `Z` or `z` | `path:close()` | Close contour |

**Relative commands** (lowercase): resolve to absolute by adding current point before converting.

**Arc approximation:** SVG arcs (`A`) have no Rive equivalent. Approximate with 1–4 cubic Bézier segments using the standard arc-to-bezier algorithm (each 90° arc segment uses control point distance ≈ `r * 0.5522847498`).

---

## Style Mapping

| SVG attribute | Rive Paint property |
|---|---|
| `fill="rgb(r,g,b)"` / `fill="#rrggbb"` | `style = 'fill', color = Color.rgb(r,g,b)` |
| `fill="none"` | Omit fill paint (or use separate stroke paint) |
| `stroke="rgb(r,g,b)"` | `style = 'stroke', color = Color.rgb(r,g,b)` |
| `stroke-width="n"` | `thickness = n` |
| `stroke-linecap="round"` | `cap = 'round'` |
| `stroke-linecap="square"` | `cap = 'square'` |
| `stroke-linejoin="round"` | `join = 'round'` |
| `stroke-linejoin="bevel"` | `join = 'bevel'` |
| `opacity="n"` | `Color.rgba(r,g,b, math.floor(n*255))` |
| `fill-opacity="n"` | Multiply alpha into color |

If a shape has both fill and stroke, create **two Paint objects** and call `renderer:drawPath` twice (fill first, then stroke).

---

## Coordinate System

SVG uses **top-left origin**, Y increases downward.
Rive uses **artboard-center origin**, Y increases downward.

To convert: subtract `(artboardWidth/2, artboardHeight/2)` from all SVG coordinates.

```lua
-- If artboard is 400×400 and SVG viewBox is "0 0 400 400":
local function svgToRive(x, y)
  return Vector.xy(x - 200, y - 200)
end
```

---

## SVG Preview Template

When writing an SVG to preview Rive output, use this wrapper. The `transform` centers the Rive coordinate system:

```svg
<svg xmlns="http://www.w3.org/2000/svg"
     width="400" height="400"
     viewBox="0 0 400 400"
     style="background:#1a1a2e">
  <g transform="translate(200, 200)">
    <!-- paths here, in Rive coordinate space (origin = center) -->
    <path d="M 0 -50 L 50 50 L -50 50 Z"
          fill="rgb(255,100,50)" stroke="none"/>
  </g>
</svg>
```

Adjust `width`/`height`/`viewBox`/background to match the artboard.

---

## Worked Example: Star Shape

**SVG source:**
```svg
<path d="M 0 -60 L 14 -20 L 57 -20 L 23 5 L 35 47 L 0 23 L -35 47 L -23 5 L -57 -20 L -14 -20 Z"
      fill="#FFD700"/>
```

**Converted Rive Luau:**
```lua
function self:draw(renderer: Renderer)
  self.path:reset()
  self.path:moveTo(Vector.xy(0, -60))
  self.path:lineTo(Vector.xy(14, -20))
  self.path:lineTo(Vector.xy(57, -20))
  self.path:lineTo(Vector.xy(23, 5))
  self.path:lineTo(Vector.xy(35, 47))
  self.path:lineTo(Vector.xy(0, 23))
  self.path:lineTo(Vector.xy(-35, 47))
  self.path:lineTo(Vector.xy(-23, 5))
  self.path:lineTo(Vector.xy(-57, -20))
  self.path:lineTo(Vector.xy(-14, -20))
  self.path:close()
  renderer:drawPath(self.path, self.paint)
end
```

**Preview SVG** (paste into a file, open in browser):
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"
     style="background:#1a1a2e">
  <g transform="translate(100,100)">
    <path d="M 0 -60 L 14 -20 L 57 -20 L 23 5 L 35 47 L 0 23 L -35 47 L -23 5 L -57 -20 L -14 -20 Z"
          fill="#FFD700"/>
  </g>
</svg>
```
