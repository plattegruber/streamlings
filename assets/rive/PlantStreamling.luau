type ZParticle = { x: number, y: number, life: number, maxLife: number, size: number }
type WaterDrop = { x: number, y: number, vy: number, life: number, maxLife: number }
type Sparkle = { x: number, y: number, life: number, maxLife: number, size: number }
type ConfettiPart = { x: number, y: number, vx: number, vy: number, life: number, maxLife: number, colorIdx: number, size: number, shape: number }

type AnimState = {
  eyeState: number,
  bounceY: number,
  rotation: number,
  vineWave: number,
  droop: number,
  perk: number,
  blushAlpha: number,
  swayX: number,
}

type PlantStreamling = {
  mood: Input<number>,       -- 0=sleeping, 1=idle, 2=engaged, 3=partying
  -- Internal state
  time: number,
  currentMood: number,       -- smoothed mood for transitions
  idleVariant: number,       -- which idle animation (0, 1, or 2)
  idleTimer: number,         -- time until next idle variant switch
  -- Particle arrays
  zParticles: { ZParticle },
  waterDrops: { WaterDrop },
  sparkles: { Sparkle },
  confetti: { ConfettiPart },
  -- Particle spawn timers
  zSpawnTimer: number,
  waterSpawnTimer: number,
  sparkleSpawnTimer: number,
  confettiSpawnTimer: number,
  -- Drawing resources
  path: Path,
  potPaint: Paint,
  potRimPaint: Paint,
  potShadowPaint: Paint,
  ropePaint: Paint,
  ropeFillPaint: Paint,
  eyePaint: Paint,
  eyeWhitePaint: Paint,
  eyeHighlightPaint: Paint,
  blushPaint: Paint,
  mouthPaint: Paint,
  eyeStrokePaint: Paint,
  dirtPaint: Paint,
  petalOuterPaint: Paint,
  petalMiddlePaint: Paint,
  petalInnerPaint: Paint,
  centerDotPaint: Paint,
  vinePaint: Paint,
  leafPaint: Paint,
  canPaint: Paint,
  canHandlePaint: Paint,
  canSpoutPaint: Paint,
  -- Particle paints
  zPaint: Paint,
  waterDropPaint: Paint,
  sparklePaint: Paint,
  confettiPaints: { Paint },
}

return function(context): PlantStreamling
  local self: PlantStreamling = {
    mood = context:number(1),
    time = 0,
    currentMood = 1,
    idleVariant = 0,
    idleTimer = 5,
    -- Particle arrays
    zParticles = {},
    waterDrops = {},
    sparkles = {},
    confetti = {},
    -- Spawn timers
    zSpawnTimer = 0,
    waterSpawnTimer = 0,
    sparkleSpawnTimer = 0,
    confettiSpawnTimer = 0,
    -- Drawing resources
    path = Path.new(),
    potPaint = Paint.with({ style = 'fill', color = Color.rgb(234, 206, 138) }),
    potRimPaint = Paint.with({ style = 'fill', color = Color.rgb(224, 196, 128) }),
    potShadowPaint = Paint.with({ style = 'fill', color = Color.rgb(200, 170, 100) }),
    ropePaint = Paint.with({ style = 'stroke', color = Color.rgb(160, 120, 60), thickness = 3, cap = 'round' }),
    ropeFillPaint = Paint.with({ style = 'fill', color = Color.rgb(160, 120, 60) }),
    eyePaint = Paint.with({ style = 'fill', color = Color.rgb(80, 40, 20) }),
    eyeWhitePaint = Paint.with({ style = 'fill', color = Color.rgb(255, 255, 255) }),
    eyeHighlightPaint = Paint.with({ style = 'fill', color = Color.rgb(255, 255, 255) }),
    blushPaint = Paint.with({ style = 'fill', color = Color.rgba(255, 140, 140, 128) }),
    mouthPaint = Paint.with({ style = 'fill', color = Color.rgb(180, 60, 80) }),
    eyeStrokePaint = Paint.with({ style = 'stroke', color = Color.rgb(80, 40, 20), thickness = 2.5, cap = 'round' }),
    dirtPaint = Paint.with({ style = 'fill', color = Color.rgb(140, 100, 60) }),
    petalOuterPaint = Paint.with({ style = 'fill', color = Color.rgb(200, 170, 160) }),
    petalMiddlePaint = Paint.with({ style = 'fill', color = Color.rgb(180, 175, 150) }),
    petalInnerPaint = Paint.with({ style = 'fill', color = Color.rgb(160, 180, 140) }),
    centerDotPaint = Paint.with({ style = 'fill', color = Color.rgb(150, 175, 135) }),
    vinePaint = Paint.with({ style = 'stroke', color = Color.rgb(100, 140, 70), thickness = 5, cap = 'round' }),
    leafPaint = Paint.with({ style = 'fill', color = Color.rgb(120, 160, 80) }),
    canPaint = Paint.with({ style = 'fill', color = Color.rgb(180, 130, 60) }),
    canHandlePaint = Paint.with({ style = 'stroke', color = Color.rgb(160, 110, 40), thickness = 2, cap = 'round' }),
    canSpoutPaint = Paint.with({ style = 'stroke', color = Color.rgb(180, 130, 60), thickness = 2, cap = 'round' }),
    -- Particle paints
    zPaint = Paint.with({ style = 'fill', color = Color.rgba(180, 200, 255, 255) }),
    waterDropPaint = Paint.with({ style = 'fill', color = Color.rgba(100, 180, 255, 179) }),
    sparklePaint = Paint.with({ style = 'fill', color = Color.rgb(255, 230, 100) }),
    confettiPaints = {
      Paint.with({ style = 'fill', color = Color.rgb(255, 80, 80) }),   -- red
      Paint.with({ style = 'fill', color = Color.rgb(80, 140, 255) }),  -- blue
      Paint.with({ style = 'fill', color = Color.rgb(255, 220, 50) }),  -- yellow
      Paint.with({ style = 'fill', color = Color.rgb(80, 200, 80) }),   -- green
    },
  }

  -- Helpers
  local function lerp(a: number, b: number, t: number): number
    return a + (b - a) * t
  end

  local function clamp(v: number, lo: number, hi: number): number
    if v < lo then return lo end
    if v > hi then return hi end
    return v
  end

  -- Helper: draw a circle approximation using cubic bezier curves
  local function circle(path: Path, cx: number, cy: number, r: number)
    local k = 0.5522847498
    path:moveTo(Vector.xy(cx + r, cy))
    path:cubicTo(
      Vector.xy(cx + r, cy + r * k),
      Vector.xy(cx + r * k, cy + r),
      Vector.xy(cx, cy + r)
    )
    path:cubicTo(
      Vector.xy(cx - r * k, cy + r),
      Vector.xy(cx - r, cy + r * k),
      Vector.xy(cx - r, cy)
    )
    path:cubicTo(
      Vector.xy(cx - r, cy - r * k),
      Vector.xy(cx - r * k, cy - r),
      Vector.xy(cx, cy - r)
    )
    path:cubicTo(
      Vector.xy(cx + r * k, cy - r),
      Vector.xy(cx + r, cy - r * k),
      Vector.xy(cx + r, cy)
    )
    path:close()
  end

  -- Animation state calculation (mirrors Canvas getStateParams)
  local function getStateParams(state: number, t: number, variant: number): AnimState
    if state == 0 then
      -- SLEEPING
      return {
        eyeState = 1,
        bounceY = math.sin(t * math.pi / 2) * 4,
        rotation = 0,
        vineWave = -3,
        droop = 0.6,
        perk = 0,
        blushAlpha = 0.3,
        swayX = 0,
      }
    elseif state == 1 then
      -- IDLE
      local eyeState = 0
      local swayX = 0
      local vineWave = math.sin(t * 0.8) * 2
      if variant == 0 then
        swayX = math.sin(t * 1.2) * 3
        local blinkCycle = t % 4
        if blinkCycle > 3.8 and blinkCycle < 3.95 then eyeState = 1 end
      elseif variant == 1 then
        vineWave = math.sin(t * 1.5) * 5
        local lookCycle = t % 5
        if lookCycle < 1.5 then eyeState = 3
        elseif lookCycle < 3 then eyeState = 4 end
      elseif variant == 2 then
        vineWave = math.sin(t * 0.5) * 3
      end
      return { eyeState = eyeState, bounceY = 0, rotation = 0, vineWave = vineWave, droop = 0, perk = 0, blushAlpha = 0.5, swayX = swayX }
    elseif state == 2 then
      -- ENGAGED
      return {
        eyeState = 2,
        bounceY = math.abs(math.sin(t * math.pi / 0.75)) * 8,
        rotation = 0,
        vineWave = math.sin(t * 2) * 6,
        droop = 0,
        perk = 0.1,
        blushAlpha = 0.6,
        swayX = 0,
      }
    else
      -- PARTYING (state == 3)
      return {
        eyeState = 2,
        bounceY = math.abs(math.sin(t * math.pi / 0.4)) * 12,
        rotation = math.sin(t * 4) * 0.05,
        vineWave = math.sin(t * 3) * 10,
        droop = 0,
        perk = 0.15,
        blushAlpha = 0.9,
        swayX = 0,
      }
    end
  end

  local function getAnimationState(mood: number, t: number, variant: number): AnimState
    local lower = math.floor(clamp(mood, 0, 3))
    local upper = math.min(3, lower + 1)
    local blend = mood - lower

    local stateA = getStateParams(lower, t, variant)
    local stateB = getStateParams(upper, t, variant)

    return {
      eyeState = if blend < 0.5 then stateA.eyeState else stateB.eyeState,
      bounceY = lerp(stateA.bounceY, stateB.bounceY, blend),
      rotation = lerp(stateA.rotation, stateB.rotation, blend),
      vineWave = lerp(stateA.vineWave, stateB.vineWave, blend),
      droop = lerp(stateA.droop, stateB.droop, blend),
      perk = lerp(stateA.perk, stateB.perk, blend),
      blushAlpha = lerp(stateA.blushAlpha, stateB.blushAlpha, blend),
      swayX = lerp(stateA.swayX, stateB.swayX, blend),
    }
  end

  -- Particle update functions
  local function updateZParticles(s: PlantStreamling, dt: number)
    s.zSpawnTimer = s.zSpawnTimer + dt
    local nearSleep = s.currentMood < 0.5
    if nearSleep and s.zSpawnTimer >= 1 / 1.5 then
      s.zSpawnTimer = s.zSpawnTimer - 1 / 1.5
      table.insert(s.zParticles, {
        x = 30 + math.random() * 10,
        y = -30,
        life = 0,
        maxLife = 2.5,
        size = 8 + math.random() * 6,
      })
    end
    if not nearSleep then s.zSpawnTimer = 0 end

    local i = #s.zParticles
    while i >= 1 do
      local p = s.zParticles[i]
      p.life = p.life + dt
      p.y = p.y - 30 * dt
      p.x = p.x + math.sin(p.life * 2) * 15 * dt
      if p.life >= p.maxLife then
        table.remove(s.zParticles, i)
      end
      i = i - 1
    end
  end

  local function updateWaterDrops(s: PlantStreamling, dt: number)
    local isWatering = math.floor(s.currentMood + 0.5) == 1 and s.idleVariant == 2
    s.waterSpawnTimer = s.waterSpawnTimer + dt
    if isWatering and s.waterSpawnTimer >= 0.15 then
      s.waterSpawnTimer = s.waterSpawnTimer - 0.15
      table.insert(s.waterDrops, {
        x = -118 + math.random() * 6,
        y = 42 + math.random() * 4,
        vy = 10 + math.random() * 20,
        life = 0,
        maxLife = 0.6,
      })
    end
    if not isWatering then s.waterSpawnTimer = 0 end

    local i = #s.waterDrops
    while i >= 1 do
      local p = s.waterDrops[i]
      p.life = p.life + dt
      p.vy = p.vy + 120 * dt
      p.y = p.y + p.vy * dt
      if p.life >= p.maxLife or p.y > 20 then
        table.remove(s.waterDrops, i)
      end
      i = i - 1
    end
  end

  local function updateSparkles(s: PlantStreamling, dt: number)
    s.sparkleSpawnTimer = s.sparkleSpawnTimer + dt
    local nearEngaged = s.currentMood >= 1.5 and s.currentMood < 2.8
    if nearEngaged and s.sparkleSpawnTimer >= 0.5 then
      s.sparkleSpawnTimer = s.sparkleSpawnTimer - 0.5
      table.insert(s.sparkles, {
        x = (math.random() - 0.5) * 160,
        y = -60 + math.random() * 120,
        life = 0,
        maxLife = 0.8,
        size = 3 + math.random() * 4,
      })
    end
    if not nearEngaged then s.sparkleSpawnTimer = 0 end

    local i = #s.sparkles
    while i >= 1 do
      local p = s.sparkles[i]
      p.life = p.life + dt
      if p.life >= p.maxLife then
        table.remove(s.sparkles, i)
      end
      i = i - 1
    end
  end

  local function updateConfetti(s: PlantStreamling, dt: number)
    s.confettiSpawnTimer = s.confettiSpawnTimer + dt
    local nearParty = s.currentMood >= 2.5
    if nearParty and s.confettiSpawnTimer >= 1 / 8 then
      s.confettiSpawnTimer = s.confettiSpawnTimer - 1 / 8
      local angle = math.random() * math.pi * 2
      local speed = 80 + math.random() * 120
      table.insert(s.confetti, {
        x = (math.random() - 0.5) * 40,
        y = -20 + math.random() * 30,
        vx = math.cos(angle) * speed,
        vy = math.sin(angle) * speed - 60,
        life = 0,
        maxLife = 1.5,
        colorIdx = math.floor(math.random() * 4) + 1, -- 1-indexed for Lua
        size = 3 + math.random() * 3,
        shape = math.floor(math.random() * 3), -- 0=circle, 1=square, 2=triangle
      })
    end
    if not nearParty then s.confettiSpawnTimer = 0 end

    local i = #s.confetti
    while i >= 1 do
      local p = s.confetti[i]
      p.life = p.life + dt
      p.vy = p.vy + 150 * dt
      p.x = p.x + p.vx * dt
      p.y = p.y + p.vy * dt
      if p.life >= p.maxLife then
        table.remove(s.confetti, i)
      end
      i = i - 1
    end
  end

  -- Drawing functions
  local function drawPotBody(s: PlantStreamling, renderer: Renderer)
    -- Pot dimensions (no offset — caller provides transform)
    local topW = 70
    local botW = 55
    local potH = 120
    local rimH = 12
    local potTop = -20
    local potBot = potTop + potH
    local cornerR = 16

    -- 1. Pot body shadow
    s.path:reset()
    s.path:moveTo(Vector.xy(-topW + cornerR, potTop + rimH))
    s.path:lineTo(Vector.xy(topW - cornerR, potTop + rimH))
    s.path:quadTo(
      Vector.xy(topW + 3, potTop + rimH + 6),
      Vector.xy(botW + 3, potBot - cornerR)
    )
    s.path:quadTo(
      Vector.xy(botW + 3, potBot + 2),
      Vector.xy(botW - cornerR, potBot + 2)
    )
    s.path:lineTo(Vector.xy(-botW + cornerR, potBot + 2))
    s.path:quadTo(
      Vector.xy(-botW - 1, potBot + 2),
      Vector.xy(-topW - 1, potTop + rimH + 6)
    )
    s.path:close()
    renderer:drawPath(s.path, s.potShadowPaint)

    -- 2. Pot body main
    s.path:reset()
    s.path:moveTo(Vector.xy(-topW + cornerR, potTop + rimH))
    s.path:lineTo(Vector.xy(topW - cornerR, potTop + rimH))
    s.path:quadTo(
      Vector.xy(topW, potTop + rimH + 8),
      Vector.xy(botW, potBot - cornerR)
    )
    s.path:quadTo(
      Vector.xy(botW, potBot),
      Vector.xy(botW - cornerR, potBot)
    )
    s.path:lineTo(Vector.xy(-botW + cornerR, potBot))
    s.path:quadTo(
      Vector.xy(-botW, potBot),
      Vector.xy(-topW, potTop + rimH + 8)
    )
    s.path:close()
    renderer:drawPath(s.path, s.potPaint)

    -- 3. Rim shadow
    local rimW = topW + 8
    local rimTop = potTop
    local rimBot = potTop + rimH
    local rimR = 6

    s.path:reset()
    s.path:moveTo(Vector.xy(-rimW + rimR, rimTop + 3))
    s.path:lineTo(Vector.xy(rimW - rimR, rimTop + 3))
    s.path:quadTo(
      Vector.xy(rimW + 2, rimTop + 3),
      Vector.xy(rimW + 2, rimBot + 1)
    )
    s.path:lineTo(Vector.xy(-rimW - 2, rimBot + 1))
    s.path:quadTo(
      Vector.xy(-rimW - 2, rimTop + 3),
      Vector.xy(-rimW + rimR, rimTop + 3)
    )
    s.path:close()
    renderer:drawPath(s.path, s.potShadowPaint)

    -- 4. Rim main
    s.path:reset()
    s.path:moveTo(Vector.xy(-rimW + rimR, rimTop))
    s.path:lineTo(Vector.xy(rimW - rimR, rimTop))
    s.path:quadTo(
      Vector.xy(rimW, rimTop),
      Vector.xy(rimW, rimTop + rimH * 0.5)
    )
    s.path:quadTo(
      Vector.xy(rimW, rimBot),
      Vector.xy(rimW - rimR, rimBot)
    )
    s.path:lineTo(Vector.xy(-rimW + rimR, rimBot))
    s.path:quadTo(
      Vector.xy(-rimW, rimBot),
      Vector.xy(-rimW, rimTop + rimH * 0.5)
    )
    s.path:quadTo(
      Vector.xy(-rimW, rimTop),
      Vector.xy(-rimW + rimR, rimTop)
    )
    s.path:close()
    renderer:drawPath(s.path, s.potRimPaint)

    -- 5. Rope band — upper line
    local ropeY = potTop + rimH + 52
    local frac = 52 / (potH - rimH)
    local ropeHalfW = topW - (topW - botW) * frac - 3

    s.path:reset()
    s.path:moveTo(Vector.xy(-ropeHalfW, ropeY))
    s.path:quadTo(
      Vector.xy(0, ropeY + 3),
      Vector.xy(ropeHalfW, ropeY)
    )
    renderer:drawPath(s.path, s.ropePaint)

    -- 6. Rope band — lower line
    s.path:reset()
    s.path:moveTo(Vector.xy(-ropeHalfW, ropeY + 6))
    s.path:quadTo(
      Vector.xy(0, ropeY + 9),
      Vector.xy(ropeHalfW, ropeY + 6)
    )
    renderer:drawPath(s.path, s.ropePaint)

    -- 7. Bow — left loop
    local bowCX = 0
    local bowCY = ropeY + 3

    s.path:reset()
    s.path:moveTo(Vector.xy(bowCX - 2, bowCY))
    s.path:quadTo(
      Vector.xy(bowCX - 26, bowCY - 18),
      Vector.xy(bowCX - 19, bowCY + 2)
    )
    s.path:quadTo(
      Vector.xy(bowCX - 14, bowCY + 14),
      Vector.xy(bowCX - 2, bowCY + 5)
    )
    s.path:close()
    renderer:drawPath(s.path, s.ropeFillPaint)

    -- 8. Bow — right loop
    s.path:reset()
    s.path:moveTo(Vector.xy(bowCX + 2, bowCY))
    s.path:quadTo(
      Vector.xy(bowCX + 26, bowCY - 18),
      Vector.xy(bowCX + 19, bowCY + 2)
    )
    s.path:quadTo(
      Vector.xy(bowCX + 14, bowCY + 14),
      Vector.xy(bowCX + 2, bowCY + 5)
    )
    s.path:close()
    renderer:drawPath(s.path, s.ropeFillPaint)

    -- 9. Bow — knot center
    s.path:reset()
    circle(s.path, bowCX, bowCY + 2, 5)
    renderer:drawPath(s.path, s.ropeFillPaint)

    -- 10. Bow — left dangling tail
    s.ropePaint.thickness = 2.5
    s.path:reset()
    s.path:moveTo(Vector.xy(bowCX - 3, bowCY + 6))
    s.path:quadTo(
      Vector.xy(bowCX - 16, bowCY + 22),
      Vector.xy(bowCX - 10, bowCY + 32)
    )
    renderer:drawPath(s.path, s.ropePaint)

    -- 11. Bow — right dangling tail
    s.path:reset()
    s.path:moveTo(Vector.xy(bowCX + 3, bowCY + 6))
    s.path:quadTo(
      Vector.xy(bowCX + 16, bowCY + 22),
      Vector.xy(bowCX + 10, bowCY + 32)
    )
    renderer:drawPath(s.path, s.ropePaint)

    -- Restore rope thickness
    s.ropePaint.thickness = 3
  end

  local function drawSucculent(s: PlantStreamling, renderer: Renderer, droopAmount: number)
    local centerY = -45

    -- 1. Dirt ring
    renderer:save()
    renderer:transform(Mat2d.withTranslation(0, centerY + 30) * Mat2d.values(1, 0, 0, 12 / 58, 0, 0))
    s.path:reset()
    circle(s.path, 0, 0, 58)
    renderer:drawPath(s.path, s.dirtPaint)
    renderer:restore()

    -- 2. Three concentric petal rings
    local rings = {
      { count = 11, radius = 48, pw = 22, ph = 24, paint = s.petalOuterPaint, offset = 0 },
      { count = 8,  radius = 30, pw = 18, ph = 20, paint = s.petalMiddlePaint, offset = math.pi / 8 },
      { count = 5,  radius = 14, pw = 13, ph = 15, paint = s.petalInnerPaint, offset = math.pi / 5 },
    }

    for _, ring in rings do
      for i = 0, ring.count - 1 do
        local angle = (i / ring.count) * math.pi * 2 + ring.offset
        local px = math.cos(angle) * ring.radius
        local py = math.sin(angle) * ring.radius * (1 - droopAmount * 0.3)

        renderer:save()
        renderer:transform(
          Mat2d.withTranslation(px, centerY + py)
          * Mat2d.withRotation(angle + math.pi / 2)
          * Mat2d.values(1, 0, 0, 1 - droopAmount * 0.15, 0, 0)
        )

        local hw = ring.pw / 2
        local hh = ring.ph / 2
        s.path:reset()
        s.path:moveTo(Vector.xy(0, -hh))
        s.path:cubicTo(
          Vector.xy(-hw * 0.8, -hh * 0.6),
          Vector.xy(-hw, hh * 0.2),
          Vector.xy(-hw * 0.5, hh * 0.7)
        )
        s.path:quadTo(Vector.xy(0, hh + 2), Vector.xy(hw * 0.5, hh * 0.7))
        s.path:cubicTo(
          Vector.xy(hw, hh * 0.2),
          Vector.xy(hw * 0.8, -hh * 0.6),
          Vector.xy(0, -hh)
        )
        s.path:close()
        renderer:drawPath(s.path, ring.paint)

        renderer:restore()
      end
    end

    -- 3. Center dot
    s.path:reset()
    circle(s.path, 0, centerY, 6)
    renderer:drawPath(s.path, s.centerDotPaint)
  end

  local function drawLeaf(s: PlantStreamling, renderer: Renderer, x: number, y: number, angle: number)
    renderer:save()
    renderer:transform(Mat2d.withTranslation(x, y) * Mat2d.withRotation(angle))
    s.path:reset()
    s.path:moveTo(Vector.xy(0, -6))
    s.path:quadTo(Vector.xy(8, -3), Vector.xy(0, 6))
    s.path:quadTo(Vector.xy(-8, -3), Vector.xy(0, -6))
    s.path:close()
    renderer:drawPath(s.path, s.leafPaint)
    renderer:restore()
  end

  local function drawWateringCan(s: PlantStreamling, renderer: Renderer, x: number, y: number, tiltAngle: number)
    renderer:save()
    renderer:transform(Mat2d.withTranslation(x, y) * Mat2d.withRotation(tiltAngle))

    -- Body
    s.path:reset()
    s.path:moveTo(Vector.xy(-8, -6))
    s.path:lineTo(Vector.xy(8, -6))
    s.path:lineTo(Vector.xy(8, 6))
    s.path:lineTo(Vector.xy(-8, 6))
    s.path:close()
    renderer:drawPath(s.path, s.canPaint)

    -- Handle
    local k = 0.5522847498
    local hr = 6
    local hcy = -6
    s.path:reset()
    s.path:moveTo(Vector.xy(-hr, hcy))
    s.path:cubicTo(
      Vector.xy(-hr, hcy - hr * k),
      Vector.xy(-hr * k, hcy - hr),
      Vector.xy(0, hcy - hr)
    )
    s.path:cubicTo(
      Vector.xy(hr * k, hcy - hr),
      Vector.xy(hr, hcy - hr * k),
      Vector.xy(hr, hcy)
    )
    renderer:drawPath(s.path, s.canHandlePaint)

    -- Spout
    s.path:reset()
    s.path:moveTo(Vector.xy(8, -2))
    s.path:lineTo(Vector.xy(14, -8))
    renderer:drawPath(s.path, s.canSpoutPaint)

    renderer:restore()
  end

  local function drawVines(s: PlantStreamling, renderer: Renderer, vineWaveOffset: number)
    -- Left vine (coordinates relative to shared transform)
    s.path:reset()
    s.path:moveTo(Vector.xy(-65, 20))
    s.path:cubicTo(
      Vector.xy(-90, 0 + vineWaveOffset),
      Vector.xy(-110, -15),
      Vector.xy(-125, -5 + vineWaveOffset)
    )
    renderer:drawPath(s.path, s.vinePaint)

    -- Leaves along left vine
    drawLeaf(s, renderer, -82, 8 + vineWaveOffset * 0.3, -0.5)
    drawLeaf(s, renderer, -105, -8 + vineWaveOffset * 0.6, -0.8)

    -- Watering can at left vine tip
    drawWateringCan(s, renderer, -125, -5 + vineWaveOffset, -0.3)

    -- Right vine
    s.path:reset()
    s.path:moveTo(Vector.xy(65, 20))
    s.path:cubicTo(
      Vector.xy(90, 5 - vineWaveOffset * 0.3),
      Vector.xy(115, -10),
      Vector.xy(135, -15 - vineWaveOffset * 0.5)
    )
    renderer:drawPath(s.path, s.vinePaint)

    -- Leaves along right vine
    drawLeaf(s, renderer, 80, 12 - vineWaveOffset * 0.1, 0.4)
    drawLeaf(s, renderer, 102, -2 - vineWaveOffset * 0.2, 0.6)
    drawLeaf(s, renderer, 122, -12 - vineWaveOffset * 0.4, 0.8)
  end

  local function drawFace(s: PlantStreamling, renderer: Renderer, eyeState: number, blushAlpha: number)
    local eyeY = 18
    local eyeXOff = 22
    local eyeR = 14
    local irisR = 8
    local irisRWide = 10
    local highlightR = 3
    local blushR = 8
    local blushY = 28
    local blushXOff = 32
    local mouthY = 32
    local k = 0.5522847498

    local eyePositions = {
      { cx = -eyeXOff, cy = eyeY },
      { cx = eyeXOff, cy = eyeY },
    }

    for _, eye in eyePositions do
      local ex = eye.cx
      local ey = eye.cy

      if eyeState == 1 then
        -- Closed eye
        s.path:reset()
        circle(s.path, ex, ey, eyeR)
        renderer:drawPath(s.path, s.eyeWhitePaint)

        local arcR = irisR
        local arcCY = ey - 2
        s.path:reset()
        s.path:moveTo(Vector.xy(ex - arcR, arcCY))
        s.path:cubicTo(
          Vector.xy(ex - arcR, arcCY + arcR * k),
          Vector.xy(ex - arcR * k, arcCY + arcR),
          Vector.xy(ex, arcCY + arcR)
        )
        s.path:cubicTo(
          Vector.xy(ex + arcR * k, arcCY + arcR),
          Vector.xy(ex + arcR, arcCY + arcR * k),
          Vector.xy(ex + arcR, arcCY)
        )
        renderer:drawPath(s.path, s.eyeStrokePaint)
      else
        local currentIrisR = irisR
        local irisOffsetX = 0

        if eyeState == 2 then currentIrisR = irisRWide end
        if eyeState == 3 then irisOffsetX = -4 end
        if eyeState == 4 then irisOffsetX = 4 end

        -- White of eye
        s.path:reset()
        circle(s.path, ex, ey, eyeR)
        renderer:drawPath(s.path, s.eyeWhitePaint)

        -- Iris
        s.path:reset()
        circle(s.path, ex + irisOffsetX, ey, currentIrisR)
        renderer:drawPath(s.path, s.eyePaint)

        -- Highlight
        s.path:reset()
        circle(s.path, ex + irisOffsetX + 3, ey - 3, highlightR)
        renderer:drawPath(s.path, s.eyeHighlightPaint)
      end
    end

    -- Blush circles with dynamic alpha
    s.blushPaint.color = Color.rgba(255, 140, 140, math.floor(blushAlpha * 255))
    s.path:reset()
    circle(s.path, -blushXOff, blushY, blushR)
    renderer:drawPath(s.path, s.blushPaint)

    s.path:reset()
    circle(s.path, blushXOff, blushY, blushR)
    renderer:drawPath(s.path, s.blushPaint)

    -- Mouth
    s.path:reset()
    s.path:moveTo(Vector.xy(-5, mouthY))
    s.path:quadTo(
      Vector.xy(0, mouthY + 5),
      Vector.xy(5, mouthY)
    )
    s.path:quadTo(
      Vector.xy(0, mouthY + 8),
      Vector.xy(-5, mouthY)
    )
    s.path:close()
    renderer:drawPath(s.path, s.mouthPaint)
  end

  -- Particle drawing functions
  local function drawZParticles(s: PlantStreamling, renderer: Renderer)
    for _, p in s.zParticles do
      local alpha = 1 - p.life / p.maxLife
      -- Draw Z shape using path lines
      local sz = p.size * 0.5
      s.zPaint.color = Color.rgba(180, 200, 255, math.floor(alpha * 255))
      s.path:reset()
      -- Z shape: top-left to top-right, diagonal to bottom-left, bottom-left to bottom-right
      s.path:moveTo(Vector.xy(p.x - sz, p.y - sz))
      s.path:lineTo(Vector.xy(p.x + sz, p.y - sz))
      s.path:lineTo(Vector.xy(p.x - sz, p.y + sz))
      s.path:lineTo(Vector.xy(p.x + sz, p.y + sz))
      -- Draw as stroke for better Z appearance
      s.zPaint.style = 'stroke'
      s.zPaint.thickness = 1.5
      renderer:drawPath(s.path, s.zPaint)
    end
    -- Reset paint style for next use
    s.zPaint.style = 'fill'
  end

  local function drawWaterDrops(s: PlantStreamling, renderer: Renderer)
    for _, p in s.waterDrops do
      local alpha = math.max(0, 0.7 * (1 - p.life / p.maxLife))
      s.waterDropPaint.color = Color.rgba(100, 180, 255, math.floor(alpha * 255))
      s.path:reset()
      circle(s.path, p.x, p.y, 2)
      renderer:drawPath(s.path, s.waterDropPaint)
    end
  end

  local function drawSparkles(s: PlantStreamling, renderer: Renderer)
    for _, p in s.sparkles do
      local t = p.life / p.maxLife
      local alpha = if t < 0.3 then t / 0.3 else (1 - t) / 0.7
      local sz = p.size
      s.sparklePaint.color = Color.rgba(255, 230, 100, math.floor(alpha * 255))
      -- 4-pointed star
      s.path:reset()
      s.path:moveTo(Vector.xy(p.x, p.y - sz))
      s.path:lineTo(Vector.xy(p.x + sz * 0.3, p.y - sz * 0.3))
      s.path:lineTo(Vector.xy(p.x + sz, p.y))
      s.path:lineTo(Vector.xy(p.x + sz * 0.3, p.y + sz * 0.3))
      s.path:lineTo(Vector.xy(p.x, p.y + sz))
      s.path:lineTo(Vector.xy(p.x - sz * 0.3, p.y + sz * 0.3))
      s.path:lineTo(Vector.xy(p.x - sz, p.y))
      s.path:lineTo(Vector.xy(p.x - sz * 0.3, p.y - sz * 0.3))
      s.path:close()
      renderer:drawPath(s.path, s.sparklePaint)
    end
  end

  local function drawConfetti(s: PlantStreamling, renderer: Renderer)
    for _, p in s.confetti do
      local alpha = math.max(0, 1 - p.life / p.maxLife)
      local paint = s.confettiPaints[p.colorIdx]
      local origColor = paint.color
      paint.color = Color.rgba(
        Color.red(origColor), Color.green(origColor), Color.blue(origColor),
        math.floor(alpha * 255)
      )

      s.path:reset()
      if p.shape == 0 then
        -- Circle
        circle(s.path, p.x, p.y, p.size)
      elseif p.shape == 1 then
        -- Square
        s.path:moveTo(Vector.xy(p.x - p.size, p.y - p.size))
        s.path:lineTo(Vector.xy(p.x + p.size, p.y - p.size))
        s.path:lineTo(Vector.xy(p.x + p.size, p.y + p.size))
        s.path:lineTo(Vector.xy(p.x - p.size, p.y + p.size))
        s.path:close()
      else
        -- Triangle
        s.path:moveTo(Vector.xy(p.x, p.y - p.size))
        s.path:lineTo(Vector.xy(p.x + p.size, p.y + p.size))
        s.path:lineTo(Vector.xy(p.x - p.size, p.y + p.size))
        s.path:close()
      end
      renderer:drawPath(s.path, paint)

      -- Restore original color
      paint.color = origColor
    end
  end

  function self:init(): boolean
    return true
  end

  function self:advance(dt: number): boolean
    self.time = self.time + dt

    -- Read target mood from input
    local targetMood = self.mood.value

    -- Smooth mood transition (~0.5s)
    self.currentMood = self.currentMood + (targetMood - self.currentMood) * math.min(1, dt * 4)

    -- Idle variant cycling (5-8 seconds)
    if math.floor(self.currentMood + 0.5) == 1 then
      self.idleTimer = self.idleTimer - dt
      if self.idleTimer <= 0 then
        self.idleVariant = (self.idleVariant + 1) % 3
        self.idleTimer = 5 + math.random() * 3
      end
    end

    -- Update particle systems
    updateZParticles(self, dt)
    updateWaterDrops(self, dt)
    updateSparkles(self, dt)
    updateConfetti(self, dt)

    return true
  end

  function self:draw(renderer: Renderer)
    local state = getAnimationState(self.currentMood, self.time, self.idleVariant)

    -- Shared transform for all character components
    renderer:save()
    renderer:transform(
      Mat2d.withTranslation(state.swayX, 30 - state.bounceY)
      * Mat2d.withRotation(state.rotation)
    )

    -- Vines behind everything
    drawVines(self, renderer, state.vineWave)

    -- Succulent above pot
    drawSucculent(self, renderer, state.droop)

    -- Pot body
    drawPotBody(self, renderer)

    -- Face on pot
    drawFace(self, renderer, state.eyeState, state.blushAlpha)

    renderer:restore()

    -- Particles drawn in world space (on top of everything)
    drawZParticles(self, renderer)
    drawWaterDrops(self, renderer)
    drawSparkles(self, renderer)
    drawConfetti(self, renderer)
  end

  return self
end
