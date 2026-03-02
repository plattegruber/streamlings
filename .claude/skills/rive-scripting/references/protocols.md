# Rive Script Protocols

Each protocol defines a structured scaffold for a specific scripting purpose. Choose the right one before writing any code.

---

## Node Script

**Purpose:** Custom rendering — draw shapes, images, or nested artboards every frame.

**Create:** Assets Panel → + → Script → Node, or Scripts tool dropdown → Node

**Attach:** Right-click the target artboard → select script → position the script node in the hierarchy

**Lifecycle:**

| Function | Signature | When called | Return |
|---|---|---|---|
| `init` | `init(self): boolean` | Once on load | `true` = success, `false` = failure |
| `advance` | `advance(self, dt: number): boolean` | Every frame | `true` = keep running |
| `update` | `update(self)` | When any input changes | — |
| `draw` | `draw(self, renderer: Renderer)` | Every frame after advance | — |

**Full skeleton:**

```lua
type MyNode = {
  color: Input<Color>,
  speed: Input<number>,
  path: Path,
  paint: Paint,
  angle: number,
}

return function(context): MyNode
  local self: MyNode = {
    color = context:color(Color.rgb(255, 100, 50)),
    speed = context:number(1.0),
    path = Path.new(),
    paint = Paint.with({ style = 'fill', color = Color.rgb(255, 100, 50) }),
    angle = 0,
  }

  function self:init(): boolean
    return true
  end

  function self:advance(dt: number): boolean
    self.angle = self.angle + dt * self.speed.value
    return true
  end

  function self:update()
    self.paint.color = self.color.value
  end

  function self:draw(renderer: Renderer)
    self.path:reset()
    local r = 50
    local cx, cy = 0, 0
    self.path:moveTo(Vector.xy(cx + r, cy))
    -- draw circle approximation or any shape
    self.path:close()
    renderer:drawPath(self.path, self.paint)
  end

  return self
end
```

---

## Layout Script

**Purpose:** Programmatic control over layout sizing and child positioning (masonry, carousels, dynamic spacing).

**Create:** Assets Panel → + → Script → Layout

**Attach:** Create a Layout component → add this script as a child of the Layout

**Lifecycle:**

| Function | Signature | When called | Return |
|---|---|---|---|
| `measure` (optional) | `measure(self): Vec2d` | When Fit type is "Hug" | Proposed size |
| `resize` (required) | `resize(self, size: Vec2d)` | When layout size changes | — |

**Skeleton:**

```lua
type MyLayout = {
  gap: Input<number>,
}

return function(context): MyLayout
  local self: MyLayout = {
    gap = context:number(8),
  }

  function self:measure(): Vec2d
    -- return ideal size when fit = "Hug"
    return Vector.xy(200, 200)
  end

  function self:resize(size: Vec2d)
    -- reposition children based on new size
    -- use self children via NodeData API
  end

  return self
end
```

---

## Path Effect Script

**Purpose:** Real-time modification of a stroke's path geometry (warping, distortion, noise, procedural shapes).

**Create:** Assets Panel → + → Script → Path Effect

**Attach:** Select a stroke → Options → Effects tab → + → Script Effects → choose script

**Lifecycle:**

| Function | Signature | When called | Return |
|---|---|---|---|
| `init` (optional) | `init(self): boolean` | Once on creation | boolean |
| `update` (required) | `update(self, pathData: PathData): PathData` | When path changes | Modified PathData |
| `advance` (optional) | `advance(self, dt: number): boolean` | Every frame | boolean |

**PathData API:**
- `#pathData` — number of commands
- Index with `pathData[i]` to read commands
- Create a new `PathData.new()` and add commands to return a modified path
- `pathData:contours()`, `pathData:measure()` for measurement

**Skeleton:**

```lua
type WigglePath = {
  amplitude: Input<number>,
  frequency: Input<number>,
  phase: number,
}

return function(context): WigglePath
  local self: WigglePath = {
    amplitude = context:number(10),
    frequency = context:number(5),
    phase = 0,
  }

  function self:advance(dt: number): boolean
    self.phase = self.phase + dt
    return true
  end

  function self:update(original: PathData): PathData
    local result = PathData.new()
    -- iterate original commands and offset points
    for i = 1, #original do
      local cmd = original[i]
      -- modify cmd points using self.amplitude, self.frequency, self.phase
      result:add(cmd)
    end
    return result
  end

  return self
end
```

---

## Converter Script

**Purpose:** Transform data binding values (custom math, string formatting, unit conversion, etc.).

**Create:** Assets Panel → + → Script → Converter

**Attach:** Data panel → Converters → Script → [ScriptName]

**Lifecycle:**

| Function | Signature | Description |
|---|---|---|
| `init` | `init(self): boolean` | Called once on load |
| `convert` | `convert(self, inputs: DataInputs): DataOutput` | Forward conversion |
| `reverseConvert` | `reverseConvert(self, target: DataOutput): DataInputs` | (Optional) reverse |

**Skeleton:**

```lua
type ScaleConverter = {
  factor: Input<number>,
}

return function(context): ScaleConverter
  local self: ScaleConverter = {
    factor = context:number(2.0),
  }

  function self:init(): boolean
    return true
  end

  function self:convert(inputs: DataInputs): DataOutput
    if type(inputs[1]) == "number" then
      return inputs[1] * self.factor.value
    end
    return 0
  end

  function self:reverseConvert(target: DataOutput): DataInputs
    if type(target) == "number" then
      return { target / self.factor.value }
    end
    return { 0 }
  end

  return self
end
```

---

## Transition Condition Script

**Purpose:** Custom boolean guard for a state machine transition (evaluate arbitrary logic each frame while transition is pending).

**Create:** Assets Panel → + → Script → Transition Condition

**Attach:** Select a transition → + → choose script from condition list

**Lifecycle:**

| Function | Signature | Description |
|---|---|---|
| `init` | `init(self, context): boolean` | Receives context; store `context:viewModel()` here |
| `evaluate` | `evaluate(self): boolean` | Return true to allow transition; called every frame |

**Rules:**
- `evaluate` must be **fast and side-effect free** — only read state, never write
- Access ViewModel only via `context:viewModel()` stored in `init`

**Skeleton:**

```lua
type HealthLow = {
  threshold: Input<number>,
  vm: any,  -- stored ViewModel reference
}

return function(context): HealthLow
  local self: HealthLow = {
    threshold = context:number(20),
    vm = nil,
  }

  function self:init(ctx): boolean
    self.vm = ctx:viewModel()
    return true
  end

  function self:evaluate(): boolean
    local hp = self.vm:getNumber("health")
    return hp.value < self.threshold.value
  end

  return self
end
```

---

## Listener Action Script

**Purpose:** Execute side effects when a state machine listener fires (update ViewModel, trigger external behavior).

**Create:** Assets Panel → + → Script → Listener Action

**Attach:** Select a Listener in the state machine → + → Scripted Action → Run dropdown → choose script

**Lifecycle:**

| Function | Signature | Description |
|---|---|---|
| `init` | `init(self, context): boolean` | Receives context; store ViewModel here |
| `perform` | `perform(self)` | Called when listener fires; no return value |

**Skeleton:**

```lua
type AddPoints = {
  amount: Input<number>,
  vm: any,
}

return function(context): AddPoints
  local self: AddPoints = {
    amount = context:number(10),
    vm = nil,
  }

  function self:init(ctx): boolean
    self.vm = ctx:viewModel()
    return true
  end

  function self:perform()
    local score = self.vm:getNumber("score")
    score.value = score.value + self.amount.value
  end

  return self
end
```

---

## Util Script

**Purpose:** Shared library functions — no protocol, no lifecycle. Import and call from other scripts.

**Create:** Assets Panel → + → Script → Util

These return a plain module table, not a factory:

```lua
local MathUtils = {}

function MathUtils.clamp(v: number, min: number, max: number): number
  if v < min then return min end
  if v > max then return max end
  return v
end

function MathUtils.lerp(a: number, b: number, t: number): number
  return a + (b - a) * t
end

return MathUtils
```

---

## Test Script

**Purpose:** Unit-test individual functions before deploying them in production scripts.

**Create:** Assets Panel → + → Script → Test

Use `assert()` and `print()` for test output. Tests run in the Debug Panel.

```lua
local MathUtils = require("MathUtils")

assert(MathUtils.clamp(5, 0, 10) == 5, "clamp within range")
assert(MathUtils.clamp(-1, 0, 10) == 0, "clamp below min")
assert(MathUtils.clamp(11, 0, 10) == 10, "clamp above max")
print("All MathUtils tests passed!")
```
