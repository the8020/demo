Parent DOX: [programs DOX](../AGENTS.md).

# Purpose

- Spectator Arkanoid demonstrating a continuous UUI upload and discrete
  controls.

# Ownership

- `game.ts` owns browser physics; `frontend.ts` owns canvas, observed metrics,
  demand-driven state sampling and component activity/disposal.
- `state.ts` owns bounded demo-local NDJSON validation; `controller.ts` owns
  reflected landing prediction and the fixed nominal 50 ms controller loop.
- `program.ts` owns ordinary UUI settings, Reset and each pending screen.
- Published browser assets live in `public/arkanoid.js` and `arkanoid.css`.

# Local Contracts

- Settings apply on Reset. The spectator has no paddle input controls.
- One stream per active run samples latest state at 100 ms with no history
  queue. Records are bounded to 2048 bytes. Controls are individual JSON
  messages.
- Capture output before asynchronous work. Stream, connection, screen and
  component lifetimes cancel their own work. Run IDs reject old controls; a new
  activity segment re-establishes the stream after suspension. Transfer failure
  pauses play until explicit Reset; connection recovery never replays a run.
  Redraws retain the board. Stale state stops ticks after 500 ms; stale controls
  stop movement.
- Rates report backend state arrivals and browser control arrivals, never
  latency.

# Work Guidance

- Keep simulation, framing and prediction demo-local; use public UUI channels.
- Do not add levels, audio, persistence, manual play or an external controller.

# Verification

- Run root `deno task build:arkanoid`, `deno task check` and `deno task test`.
- `deno task test:arkanoid-browser` uses the real UUI session/shell Chromium
  harness and local assets for play, settings/reset, redraw and lifecycle
  checks.

# Child DOX Index
