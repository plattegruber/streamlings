# Plant Streamling Character Design

## Overview

A kawaii succulent plant character for the Streamlings stream overlay, implemented as a single Rive Node Script. The character responds to four mood states driven by chat energy: sleeping, idle, engaged, and partying.

## Artboard

- Size: 512x512
- Origin: center (0,0)
- Character centered, pot base near bottom of artboard

## Visual Components

### Pot
Warm yellow rounded trapezoid with a cute face. Features a rope band across the middle with a small bow in front. Slight taper toward the bottom. Two-tone shading (lighter front, darker sides).

### Face
Two large shiny brown eyes (dark brown iris, white highlight dot), small open mouth (dark pink), and pink blush circles on the cheeks. Eyes are the primary expression vehicle across mood states.

### Succulent
Layered rosette sitting in the pot. Three concentric rings of petals radiating outward — inner petals are smaller and darker (sage green), outer petals are larger and lighter (dusty pink tips). A dirt ring is visible between the pot rim and succulent base.

### Vine Arms
Two trailing vines growing from the pot sides, built from cubic bezier curves. Left vine holds a small watering can (copper colored). Right vine trails outward with small paired leaves. Both vines participate in animations.

## Color Palette

| Element | RGB |
|---|---|
| Pot body | (234, 206, 138) |
| Pot shadow | (200, 170, 100) |
| Rope/bow | (160, 120, 60) |
| Eye iris | (80, 40, 20) |
| Blush | (255, 140, 140) at 50% opacity |
| Mouth | (180, 60, 80) |
| Petal outer | (200, 170, 160) |
| Petal inner | (160, 180, 140) |
| Vine | (100, 140, 70) |
| Leaf | (120, 160, 80) |
| Dirt | (140, 100, 60) |
| Watering can | (180, 130, 60) |

## Animation States

### Sleeping (mood = 0)
- Eyes become closed crescents (^_^)
- Succulent petals droop slightly (scale down Y)
- Whole character bobs with slow breathing rhythm (4s cycle)
- 2-3 floating "Z" particles drift upward
- Vines hang limp with less curl

### Idle (mood = 1)
Default resting state with three random variations, cycling every 5-8 seconds:
1. **Leaf wiggle + blink**: Petals sway side to side, eyes close briefly
2. **Vine fidget + look around**: Vine arms shift, eyes glance left then right
3. **Water self**: Left vine lifts watering can, tips it, water drops fall onto succulent

### Engaged (mood = 2)
- Eyes widen (larger pupils)
- Succulent perks up (scale Y increase)
- Gentle bouncing (1.5s cycle)
- Vines sway actively
- Occasional small sparkle particles

### Partying (mood = 3)
- Eyes become extra wide with excitement
- Succulent bounces vigorously, petals fan out
- Fast bouncing with slight rotation (0.8s cycle)
- Both vine arms wave in the air
- Colored confetti particles burst outward
- Blush marks intensify

## State Transitions

Smooth interpolation between states over ~0.5s using lerp. Mood controlled via `Input<number>` (0-3). The `advance()` function blends between current and target visual parameters.

## Script Architecture

Single Node Script (`PlantStreamling`) with internal drawing functions:

```
PlantStreamling
├── drawPot(renderer, state)       -- pot body, rope, bow
├── drawFace(renderer, state)      -- eyes, mouth, blush
├── drawSucculent(renderer, state) -- petal rings
├── drawVines(renderer, state)     -- arms, watering can, leaves
├── drawParticles(renderer, state) -- Z's, sparkles, water drops, confetti
└── advance(dt)                    -- state machine, idle timer, particle sim
```

## Approach

Approach A: Single self-contained Node Script. Structured cleanly by component so individual parts can later be migrated to visual editor assets. This is a working prototype — the "Rive way" would be visual design + state machine + ViewModel, which can be adopted incrementally.

## Integration

The web app currently sends `telemetry.mood.currentState` (string: 'sleeping', 'idle', 'engaged', 'partying') over WebSocket. The overlay maps this to the numeric mood input (0-3) and passes it to the Rive runtime.
