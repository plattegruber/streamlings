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
  potRimPaint: Paint,
  potShadowPaint: Paint,
  ropePaint: Paint,
  ropeFillPaint: Paint,
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
    potRimPaint = Paint.with({ style = 'fill', color = Color.rgb(224, 196, 128) }),
    potShadowPaint = Paint.with({ style = 'fill', color = Color.rgb(200, 170, 100) }),
    ropePaint = Paint.with({ style = 'stroke', color = Color.rgb(160, 120, 60), thickness = 3, cap = 'round' }),
    ropeFillPaint = Paint.with({ style = 'fill', color = Color.rgb(160, 120, 60) }),
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

  local function drawPot(s: PlantStreamling, renderer: Renderer)
    -- All coordinates relative to pot origin (translated by 0, 30)
    local oX, oY = 0, 30 -- pot offset from artboard center

    -- Pot dimensions
    local topW = 70    -- half-width at top
    local botW = 55    -- half-width at bottom
    local potH = 120   -- total height including rim
    local rimH = 12    -- rim height
    local potTop = -20 -- top of pot relative to offset origin
    local potBot = potTop + potH
    local cornerR = 16

    -- 1. Pot body shadow (offset slightly right and down)
    s.path:reset()
    s.path:moveTo(Vector.xy(oX - topW + cornerR, oY + potTop + rimH))
    s.path:lineTo(Vector.xy(oX + topW - cornerR, oY + potTop + rimH))
    s.path:quadTo(
      Vector.xy(oX + topW + 3, oY + potTop + rimH + 6),
      Vector.xy(oX + botW + 3, oY + potBot - cornerR)
    )
    s.path:quadTo(
      Vector.xy(oX + botW + 3, oY + potBot + 2),
      Vector.xy(oX + botW - cornerR, oY + potBot + 2)
    )
    s.path:lineTo(Vector.xy(oX - botW + cornerR, oY + potBot + 2))
    s.path:quadTo(
      Vector.xy(oX - botW - 1, oY + potBot + 2),
      Vector.xy(oX - topW - 1, oY + potTop + rimH + 6)
    )
    s.path:close()
    renderer:drawPath(s.path, s.potShadowPaint)

    -- 2. Pot body (main front face)
    s.path:reset()
    s.path:moveTo(Vector.xy(oX - topW + cornerR, oY + potTop + rimH))
    s.path:lineTo(Vector.xy(oX + topW - cornerR, oY + potTop + rimH))
    s.path:quadTo(
      Vector.xy(oX + topW, oY + potTop + rimH + 8),
      Vector.xy(oX + botW, oY + potBot - cornerR)
    )
    s.path:quadTo(
      Vector.xy(oX + botW, oY + potBot),
      Vector.xy(oX + botW - cornerR, oY + potBot)
    )
    s.path:lineTo(Vector.xy(oX - botW + cornerR, oY + potBot))
    s.path:quadTo(
      Vector.xy(oX - botW, oY + potBot),
      Vector.xy(oX - topW, oY + potTop + rimH + 8)
    )
    s.path:close()
    renderer:drawPath(s.path, s.potPaint)

    -- 3. Rim shadow
    local rimW = topW + 8
    local rimTop = potTop
    local rimBot = potTop + rimH
    local rimR = 6

    s.path:reset()
    s.path:moveTo(Vector.xy(oX - rimW + rimR, oY + rimTop + 3))
    s.path:lineTo(Vector.xy(oX + rimW - rimR, oY + rimTop + 3))
    s.path:quadTo(
      Vector.xy(oX + rimW + 2, oY + rimTop + 3),
      Vector.xy(oX + rimW + 2, oY + rimBot + 1)
    )
    s.path:lineTo(Vector.xy(oX - rimW - 2, oY + rimBot + 1))
    s.path:quadTo(
      Vector.xy(oX - rimW - 2, oY + rimTop + 3),
      Vector.xy(oX - rimW + rimR, oY + rimTop + 3)
    )
    s.path:close()
    renderer:drawPath(s.path, s.potShadowPaint)

    -- 4. Rim main
    s.path:reset()
    s.path:moveTo(Vector.xy(oX - rimW + rimR, oY + rimTop))
    s.path:lineTo(Vector.xy(oX + rimW - rimR, oY + rimTop))
    s.path:quadTo(
      Vector.xy(oX + rimW, oY + rimTop),
      Vector.xy(oX + rimW, oY + rimTop + rimH * 0.5)
    )
    s.path:quadTo(
      Vector.xy(oX + rimW, oY + rimBot),
      Vector.xy(oX + rimW - rimR, oY + rimBot)
    )
    s.path:lineTo(Vector.xy(oX - rimW + rimR, oY + rimBot))
    s.path:quadTo(
      Vector.xy(oX - rimW, oY + rimBot),
      Vector.xy(oX - rimW, oY + rimTop + rimH * 0.5)
    )
    s.path:quadTo(
      Vector.xy(oX - rimW, oY + rimTop),
      Vector.xy(oX - rimW + rimR, oY + rimTop)
    )
    s.path:close()
    renderer:drawPath(s.path, s.potRimPaint)

    -- 5. Rope band — upper line
    local ropeY = potTop + rimH + 52
    local frac = 52 / (potH - rimH)
    local ropeHalfW = topW - (topW - botW) * frac - 3

    s.path:reset()
    s.path:moveTo(Vector.xy(oX - ropeHalfW, oY + ropeY))
    s.path:quadTo(
      Vector.xy(oX, oY + ropeY + 3),
      Vector.xy(oX + ropeHalfW, oY + ropeY)
    )
    renderer:drawPath(s.path, s.ropePaint)

    -- 6. Rope band — lower line
    s.path:reset()
    s.path:moveTo(Vector.xy(oX - ropeHalfW, oY + ropeY + 6))
    s.path:quadTo(
      Vector.xy(oX, oY + ropeY + 9),
      Vector.xy(oX + ropeHalfW, oY + ropeY + 6)
    )
    renderer:drawPath(s.path, s.ropePaint)

    -- 7. Bow — left loop
    local bowCX = oX
    local bowCY = oY + ropeY + 3

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

    -- Restore rope thickness for next frame
    s.ropePaint.thickness = 3
  end

  function self:init(): boolean
    return true
  end

  function self:advance(dt: number): boolean
    self.time = self.time + dt
    return true
  end

  function self:draw(renderer: Renderer)
    drawPot(self, renderer)
  end

  return self
end
