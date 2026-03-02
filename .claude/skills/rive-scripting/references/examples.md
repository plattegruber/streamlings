# Rive Scripting Examples

---

## 1. Bouncing Ball (Node Script)

A procedurally animated circle that bounces around the artboard.

```lua
type BouncingBall = {
  ballColor: Input<Color>,
  radius: Input<number>,
  pos: Vec2d,
  vel: Vec2d,
  path: Path,
  paint: Paint,
}

return function(context): BouncingBall
  local self: BouncingBall = {
    ballColor = context:color(Color.rgb(255, 80, 80)),
    radius = context:number(20),
    pos = Vector.xy(0, 0),
    vel = Vector.xy(120, 90),
    path = Path.new(),
    paint = Paint.with({ style = 'fill', color = Color.rgb(255, 80, 80) }),
  }

  function self:init(): boolean
    return true
  end

  function self:advance(dt: number): boolean
    local r = self.radius.value
    self.pos = self.pos + self.vel * dt

    -- Bounce off walls (assumes ±200 bounds)
    if self.pos.x > 200 - r or self.pos.x < -200 + r then
      self.vel = Vector.xy(-self.vel.x, self.vel.y)
    end
    if self.pos.y > 200 - r or self.pos.y < -200 + r then
      self.vel = Vector.xy(self.vel.x, -self.vel.y)
    end
    return true
  end

  function self:update()
    self.paint.color = self.ballColor.value
  end

  function self:draw(renderer: Renderer)
    local r = self.radius.value
    -- Approximate circle with cubic bezier
    local k = 0.5522847498  -- magic constant for circle approximation
    local p = self.pos
    self.path:reset()
    self.path:moveTo(Vector.xy(p.x + r, p.y))
    self.path:cubicTo(
      Vector.xy(p.x + r, p.y + r * k),
      Vector.xy(p.x + r * k, p.y + r),
      Vector.xy(p.x, p.y + r)
    )
    self.path:cubicTo(
      Vector.xy(p.x - r * k, p.y + r),
      Vector.xy(p.x - r, p.y + r * k),
      Vector.xy(p.x - r, p.y)
    )
    self.path:cubicTo(
      Vector.xy(p.x - r, p.y - r * k),
      Vector.xy(p.x - r * k, p.y - r),
      Vector.xy(p.x, p.y - r)
    )
    self.path:cubicTo(
      Vector.xy(p.x + r * k, p.y - r),
      Vector.xy(p.x + r, p.y - r * k),
      Vector.xy(p.x + r, p.y)
    )
    self.path:close()
    renderer:drawPath(self.path, self.paint)
  end

  return self
end
```

---

## 2. Particle System (Node Script with Artboard Instances)

Spawns and manages instances of a child artboard as particles.

```lua
type Particle = {
  pos: Vec2d,
  vel: Vec2d,
  life: number,
  maxLife: number,
  instance: any,  -- Artboard instance
}

type ParticleSystem = {
  template: Input<Artboard<Data.Particle>>,
  spawnRate: Input<number>,
  particles: { Particle },
  spawnAccum: number,
}

return function(context): ParticleSystem
  local self: ParticleSystem = {
    template = context:artboard(),
    spawnRate = context:number(5),
    particles = {},
    spawnAccum = 0,
  }

  local function spawnParticle()
    local inst = self.template:instance()
    table.insert(self.particles, {
      pos = Vector.xy(0, 0),
      vel = Vector.xy(
        (math.random() - 0.5) * 200,
        -math.random() * 150 - 50
      ),
      life = 0,
      maxLife = 1 + math.random(),
      instance = inst,
    })
  end

  function self:init(): boolean
    return true
  end

  function self:advance(dt: number): boolean
    -- Spawn
    self.spawnAccum = self.spawnAccum + dt * self.spawnRate.value
    while self.spawnAccum >= 1 do
      spawnParticle()
      self.spawnAccum = self.spawnAccum - 1
    end

    -- Update and cull
    local alive = {}
    for _, p in ipairs(self.particles) do
      p.life = p.life + dt
      p.pos = p.pos + p.vel * dt
      p.vel = Vector.xy(p.vel.x, p.vel.y + 200 * dt)  -- gravity
      p.instance:advance(dt)
      if p.life < p.maxLife then
        table.insert(alive, p)
      end
    end
    self.particles = alive
    return true
  end

  function self:draw(renderer: Renderer)
    for _, p in ipairs(self.particles) do
      local opacity = 1 - (p.life / p.maxLife)
      renderer:save()
      renderer:transform(Mat2d.withTranslation(p.pos.x, p.pos.y))
      -- p.instance:draw(renderer) -- draw the artboard instance
      renderer:restore()
    end
  end

  return self
end
```

---

## 3. Sine Wave Path Effect

A Path Effect script that applies a sine wave displacement to a stroke.

```lua
type SineWave = {
  amplitude: Input<number>,
  frequency: Input<number>,
  speed: Input<number>,
  phase: number,
}

return function(context): SineWave
  local self: SineWave = {
    amplitude = context:number(15),
    frequency = context:number(0.05),
    speed = context:number(2),
    phase = 0,
  }

  function self:advance(dt: number): boolean
    self.phase = self.phase + dt * self.speed.value
    return true
  end

  function self:update(original: PathData): PathData
    local result = PathData.new()
    local amp = self.amplitude.value
    local freq = self.frequency.value

    for i = 1, #original do
      local cmd = original[i]
      -- Offset the Y component of each point by a sine based on X position
      if cmd.type == "lineTo" or cmd.type == "moveTo" then
        local x = cmd.point.x
        local y = cmd.point.y + amp * math.sin(x * freq + self.phase)
        if cmd.type == "moveTo" then
          result:moveTo(Vector.xy(x, y))
        else
          result:lineTo(Vector.xy(x, y))
        end
      else
        result:add(cmd)
      end
    end
    return result
  end

  return self
end
```

---

## 4. Health Bar Converter

Converts a 0–100 health number into a 0.0–1.0 width percentage for a progress bar.

```lua
type HealthBar = {
  maxHealth: Input<number>,
}

return function(context): HealthBar
  local self: HealthBar = {
    maxHealth = context:number(100),
  }

  function self:init(): boolean
    return true
  end

  function self:convert(inputs: DataInputs): DataOutput
    local hp = inputs[1]
    if type(hp) == "number" then
      return math.max(0, math.min(1, hp / self.maxHealth.value))
    end
    return 0
  end

  function self:reverseConvert(target: DataOutput): DataInputs
    if type(target) == "number" then
      return { target * self.maxHealth.value }
    end
    return { 0 }
  end

  return self
end
```

---

## 5. Dead State Transition

A Transition Condition that fires when health reaches zero.

```lua
type IsDead = {}

return function(context): IsDead
  local self: IsDead = {
    vm = nil,
  }

  function self:init(ctx): boolean
    self.vm = ctx:viewModel()
    return true
  end

  function self:evaluate(): boolean
    local hp = self.vm:getNumber("health")
    return hp ~= nil and hp.value <= 0
  end

  return self
end
```

---

## 6. Score Update on Chat Event (Listener Action)

Increments a score ViewModel property when a listener fires.

```lua
type OnChatMessage = {
  points: Input<number>,
  vm: any,
}

return function(context): OnChatMessage
  local self: OnChatMessage = {
    points = context:number(1),
    vm = nil,
  }

  function self:init(ctx): boolean
    self.vm = ctx:viewModel()
    return true
  end

  function self:perform()
    local score = self.vm:getNumber("score")
    if score then
      score.value = score.value + self.points.value
    end
  end

  return self
end
```

---

## 7. Color Lerp on Hover (Node Script with Pointer Events)

Changes a shape's color smoothly when pointer enters/exits.

```lua
type HoverGlow = {
  baseColor: Input<Color>,
  hoverColor: Input<Color>,
  speed: Input<number>,
  t: number,
  hovering: boolean,
  path: Path,
  paint: Paint,
  width: Input<number>,
  height: Input<number>,
}

return function(context): HoverGlow
  local self: HoverGlow = {
    baseColor = context:color(Color.rgb(80, 120, 200)),
    hoverColor = context:color(Color.rgb(255, 200, 50)),
    speed = context:number(4),
    t = 0,
    hovering = false,
    path = Path.new(),
    paint = Paint.with({ style = 'fill', color = Color.rgb(80, 120, 200) }),
    width = context:number(100),
    height = context:number(60),
  }

  function self:init(): boolean
    return true
  end

  function self:advance(dt: number): boolean
    local target = self.hovering and 1 or 0
    self.t = self.t + (target - self.t) * dt * self.speed.value
    self.paint.color = Color.lerp(self.baseColor.value, self.hoverColor.value, self.t)
    return true
  end

  function self:draw(renderer: Renderer)
    local w, h = self.width.value / 2, self.height.value / 2
    self.path:reset()
    self.path:moveTo(Vector.xy(-w, -h))
    self.path:lineTo(Vector.xy(w, -h))
    self.path:lineTo(Vector.xy(w, h))
    self.path:lineTo(Vector.xy(-w, h))
    self.path:close()
    renderer:drawPath(self.path, self.paint)
  end

  return self
end
```
