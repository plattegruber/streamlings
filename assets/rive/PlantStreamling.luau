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
