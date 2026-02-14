# Product Philosophy

This document captures the product vision and design principles behind Streamlings. It should guide feature decisions, prioritization, and how we think about the experience.

## Core Concept

A Streamling is a digital creature that lives on a streamer's broadcast and reflects the energy of the community in real time. It is not a chatbot, not a widget, and not a dashboard metric. It is a pet — something the audience cares about, bonds with, and influences through their collective behavior.

## Design Principles

### 1. The Streamling Is Alive, Not a Meter

The Streamling should feel like a living thing, not a data visualization. Its mood transitions should feel natural and organic — waking up slowly, getting excited gradually, crashing after a long party. Avoid anything that makes it feel like a progress bar or a KPI gauge.

The energy and mood systems exist to create believable behavior, not to report numbers. Internal drives (sleep pressure, exhaustion, curiosity) exist specifically to prevent the Streamling from feeling like a simple input-output function.

### 2. The Community Is the Player

The audience collectively "plays" the Streamling through their natural behavior — chatting, subscribing, cheering. No one person controls it. The interesting emergent behavior comes from the crowd acting as a whole, and the Streamling's delayed, smoothed responses to that activity.

Avoid features that give individual users direct control over the Streamling's state. The magic is in the indirect influence.

### 3. Slow Over Fast

Hysteresis is a feature, not a limitation. The hold times, EMA smoothing, and minimum durations exist so the Streamling doesn't flicker between states. A 90-second hold before transitioning from Idle to Engaged means the chat has to sustain energy, not just spike once.

When in doubt, make transitions slower rather than faster. A Streamling that takes time to wake up and wind down feels more alive than one that snaps between states.

### 4. Platform Agnostic at the Core

The state engine knows nothing about Twitch, YouTube, or any specific platform. It receives normalized activity metrics and produces mood state. Platform adapters are thin translation layers that map platform-specific events into the shared activity model.

This is non-negotiable for the architecture. Any platform-specific logic belongs in an adapter, never in the core state engine.

### 5. Streamer Ownership

The Streamling belongs to the streamer. They should be able to tune its personality — how excitable it is, how quickly it falls asleep, how long it can party before getting exhausted. The configuration system exists to make every Streamling unique to its community.

Defaults should work well out of the box. Tuning should be optional, not required.

### 6. Observable, Not Overwhelming

Streamers and their communities should be able to understand what the Streamling is doing and roughly why. Telemetry exists for transparency, not complexity. The dashboard should answer "what is it doing?" and "why?" — not present a wall of charts.

### 7. Delightful, Not Distracting

On stream, the Streamling should enhance the experience without competing for attention. It should be a companion in the corner, not a flashing alert system. Visual design should prioritize charm and subtlety over spectacle.

## Product Direction

### What We're Building Toward

- A visual creature on stream that audiences genuinely care about
- A dashboard where streamers can understand and tune their Streamling's behavior
- A stream overlay (OBS browser source) that renders the Streamling
- Multi-platform support so the same Streamling responds to activity from Twitch, YouTube, and beyond

### What We're Not Building

- A chatbot or command responder
- A stream analytics dashboard
- A gamification or loyalty points system
- A notification/alert widget

### Open Questions

- How should the Streamling behave between streams (offline state)?
- Should the Streamling have visual customization (skins, accessories)?
- How do we handle multi-platform streams where activity comes from multiple adapters simultaneously?
- Should there be any direct interaction (e.g., channel point redemptions that "pet" the Streamling)?
