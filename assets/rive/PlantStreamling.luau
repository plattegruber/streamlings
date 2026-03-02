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

  local function drawSucculent(s: PlantStreamling, renderer: Renderer, droopAmount: number)
    local oX, oY = 0, 30 -- same offset as pot
    local centerY = -45   -- succulent center above pot rim

    -- 1. Dirt ring — brown ellipse at pot opening
    renderer:save()
    renderer:transform(Mat2d.withTranslation(oX, oY + centerY + 30) * Mat2d.values(1, 0, 0, 12 / 58, 0, 0))
    s.path:reset()
    circle(s.path, 0, 0, 58)
    renderer:drawPath(s.path, s.dirtPaint)
    renderer:restore()

    -- 2. Three concentric petal rings (outer first, inner overlaps)
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
          Mat2d.withTranslation(oX + px, oY + centerY + py)
          * Mat2d.withRotation(angle + math.pi / 2)
          * Mat2d.values(1, 0, 0, 1 - droopAmount * 0.15, 0, 0)
        )

        -- Chubby rounded petal shape (Echeveria-like)
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
    circle(s.path, oX, oY + centerY, 6)
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

    -- Body: small rectangle (-8, -6, 16, 12)
    s.path:reset()
    s.path:moveTo(Vector.xy(-8, -6))
    s.path:lineTo(Vector.xy(8, -6))
    s.path:lineTo(Vector.xy(8, 6))
    s.path:lineTo(Vector.xy(-8, 6))
    s.path:close()
    renderer:drawPath(s.path, s.canPaint)

    -- Handle: semi-circle arc above body (from left to right, top half)
    local k = 0.5522847498
    local hr = 6 -- handle radius
    local hcy = -6 -- center at top of body
    s.path:reset()
    -- Start at left of semi-circle
    s.path:moveTo(Vector.xy(-hr, hcy))
    -- Top-left quarter: (-hr, hcy) to (0, hcy - hr)
    s.path:cubicTo(
      Vector.xy(-hr, hcy - hr * k),
      Vector.xy(-hr * k, hcy - hr),
      Vector.xy(0, hcy - hr)
    )
    -- Top-right quarter: (0, hcy - hr) to (hr, hcy)
    s.path:cubicTo(
      Vector.xy(hr * k, hcy - hr),
      Vector.xy(hr, hcy - hr * k),
      Vector.xy(hr, hcy)
    )
    renderer:drawPath(s.path, s.canHandlePaint)

    -- Spout: line from right side pointing up-right
    s.path:reset()
    s.path:moveTo(Vector.xy(8, -2))
    s.path:lineTo(Vector.xy(14, -8))
    renderer:drawPath(s.path, s.canSpoutPaint)

    renderer:restore()
  end

  local function drawVines(s: PlantStreamling, renderer: Renderer, vineWaveOffset: number)
    local oX, oY = 0, 30 -- same offset as pot

    -- Left vine (holds watering can)
    s.path:reset()
    s.path:moveTo(Vector.xy(oX - 65, oY + 50))
    s.path:cubicTo(
      Vector.xy(oX - 90, oY + 30 + vineWaveOffset),
      Vector.xy(oX - 110, oY + 15),
      Vector.xy(oX - 125, oY + 25 + vineWaveOffset)
    )
    renderer:drawPath(s.path, s.vinePaint)

    -- Leaves along left vine
    drawLeaf(s, renderer, oX - 82, oY + 38 + vineWaveOffset * 0.3, -0.5)
    drawLeaf(s, renderer, oX - 105, oY + 22 + vineWaveOffset * 0.6, -0.8)

    -- Watering can at left vine tip
    drawWateringCan(s, renderer, oX - 125, oY + 25 + vineWaveOffset, -0.3)

    -- Right vine (with leaves)
    s.path:reset()
    s.path:moveTo(Vector.xy(oX + 65, oY + 50))
    s.path:cubicTo(
      Vector.xy(oX + 90, oY + 35 - vineWaveOffset * 0.3),
      Vector.xy(oX + 115, oY + 20),
      Vector.xy(oX + 135, oY + 15 - vineWaveOffset * 0.5)
    )
    renderer:drawPath(s.path, s.vinePaint)

    -- 3 leaves along right vine
    drawLeaf(s, renderer, oX + 80, oY + 42 - vineWaveOffset * 0.1, 0.4)
    drawLeaf(s, renderer, oX + 102, oY + 28 - vineWaveOffset * 0.2, 0.6)
    drawLeaf(s, renderer, oX + 122, oY + 18 - vineWaveOffset * 0.4, 0.8)
  end

  local function drawFace(s: PlantStreamling, renderer: Renderer, eyeState: number)
    local oX, oY = 0, 30 -- same offset as pot

    -- Face positioning constants
    local eyeY = 18       -- vertical center of eyes (relative to translated origin)
    local eyeXOff = 22    -- horizontal offset from center
    local eyeR = 14       -- white of eye radius
    local irisR = 8       -- normal iris radius
    local irisRWide = 10  -- wide iris radius (eyeState=2)
    local highlightR = 3  -- highlight dot radius
    local blushR = 8      -- blush circle radius
    local blushY = 28     -- blush vertical position
    local blushXOff = 32  -- blush horizontal offset
    local mouthY = 32     -- mouth vertical position
    local k = 0.5522847498 -- bezier circle constant

    -- Eye positions (left eye, right eye)
    local eyePositions = {
      { cx = -eyeXOff, cy = eyeY },
      { cx = eyeXOff, cy = eyeY },
    }

    for _, eye in eyePositions do
      local ex = oX + eye.cx
      local ey = oY + eye.cy

      if eyeState == 1 then
        -- Closed eye — happy crescent (^_^)
        -- White circle background
        s.path:reset()
        circle(s.path, ex, ey, eyeR)
        renderer:drawPath(s.path, s.eyeWhitePaint)

        -- Crescent arc — draw bottom half of a circle as a stroke
        -- Semi-circle from left to right through bottom, using 2 cubic bezier segments
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
        -- Eyes with iris — states 0, 2, 3, 4
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

        -- Highlight dot (upper-right of iris)
        s.path:reset()
        circle(s.path, ex + irisOffsetX + 3, ey - 3, highlightR)
        renderer:drawPath(s.path, s.eyeHighlightPaint)
      end
    end

    -- Blush circles
    s.path:reset()
    circle(s.path, oX - blushXOff, oY + blushY, blushR)
    renderer:drawPath(s.path, s.blushPaint)

    s.path:reset()
    circle(s.path, oX + blushXOff, oY + blushY, blushR)
    renderer:drawPath(s.path, s.blushPaint)

    -- Mouth — small open smile (crescent shape)
    -- Upper curve from left to right (shallower)
    -- Lower curve back (deeper) to create the filled crescent
    local mX = oX
    local mY = oY + mouthY
    s.path:reset()
    s.path:moveTo(Vector.xy(mX - 5, mY))
    s.path:quadTo(
      Vector.xy(mX, mY + 5),
      Vector.xy(mX + 5, mY)
    )
    s.path:quadTo(
      Vector.xy(mX, mY + 8),
      Vector.xy(mX - 5, mY)
    )
    s.path:close()
    renderer:drawPath(s.path, s.mouthPaint)
  end

  function self:init(): boolean
    return true
  end

  function self:advance(dt: number): boolean
    self.time = self.time + dt
    return true
  end

  function self:draw(renderer: Renderer)
    drawVines(self, renderer, 0)
    drawSucculent(self, renderer, 0)
    drawPot(self, renderer)
    drawFace(self, renderer, 0)
  end

  return self
end
