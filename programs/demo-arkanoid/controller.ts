import type { ChannelConnection } from "/p/the8020/uui/channel.ts";
import {
  clamp,
  type Control,
  type GameState,
  type Settings,
  states,
} from "./state.ts";

export const CONTROLLER_MS = 50;
export function predict(
  s: GameState,
  deadZone: number,
): Pick<Control, "target" | "direction"> {
  let target = s.x;
  if (s.vy > 1) {
    const span = s.width - 2 * s.radius;
    const landing = s.x - s.radius + s.vx *
        Math.max(0, (s.paddleY - s.radius - s.y) / s.vy);
    const reflected = ((landing % (2 * span)) + 2 * span) % (2 * span);
    target = s.radius + (reflected <= span ? reflected : 2 * span - reflected);
  }
  target = clamp(target, s.paddleWidth / 2, s.width - s.paddleWidth / 2);
  const delta = target - s.paddleX;
  return {
    target,
    direction: Math.abs(delta) <= deadZone ? 0 : delta < 0 ? -1 : 1,
  };
}

/** The captured output and stream signal own every tick of this controller. */
export async function controlStream(
  stream: ReadableStream<Uint8Array>,
  output: ChannelConnection,
  signal: AbortSignal,
  settings: Settings,
  runPrefix: string,
): Promise<void> {
  let latest: GameState | undefined;
  let run: string | undefined;
  let receivedAt = 0;
  let interval: ReturnType<typeof setInterval> | undefined;
  let count = 0;
  let rate = 0;
  let windowStart = performance.now();
  const stop = () => {
    clearInterval(interval);
    interval = undefined;
  };
  signal.addEventListener("abort", stop, { once: true });
  try {
    for await (const state of states(stream, signal)) {
      if (!state.run.startsWith(`${runPrefix}.`) || run && state.run !== run) {
        throw new Error("Obsolete game run");
      }
      run = state.run;
      latest = state;
      receivedAt = performance.now();
      count++;
      if (receivedAt - windowStart >= 1000) {
        rate = count * 1000 / (receivedAt - windowStart);
        count = 0;
        windowStart = receivedAt;
      }
      if (state.status !== "playing") {
        stop();
        continue;
      }
      if (interval !== undefined) continue;
      interval = setInterval(() => {
        if (signal.aborted || !latest || performance.now() - receivedAt > 500) {
          stop();
          return;
        }
        try {
          output.send(
            "control",
            {
              run: latest.run,
              ...predict(latest, settings.deadZone),
              statesPerSecond: rate,
            } satisfies Control,
          );
        } catch {
          stop();
        }
      }, CONTROLLER_MS);
    }
  } finally {
    stop();
    signal.removeEventListener("abort", stop);
  }
}
