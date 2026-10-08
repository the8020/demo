export const defaults = {
  ballSpeed: 260,
  paddleWidth: 100,
  paddleSpeed: 360,
  deadZone: 8,
};
export type Settings = typeof defaults;
export interface GameState {
  run: string;
  width: number;
  height: number;
  paddleX: number;
  paddleWidth: number;
  paddleY: number;
  radius: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  status: "playing" | "won" | "lost";
  score: number;
  bricks: number;
  lives: number;
}
export interface Control {
  run: string;
  direction: -1 | 0 | 1;
  target: number;
  statesPerSecond: number;
}
export function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}
export function validState(value: unknown): value is GameState {
  if (!value || typeof value !== "object") return false;
  const s = value as GameState;
  return typeof s.run === "string" && /^[\w.-]{1,100}$/.test(s.run) &&
    [
      s.width,
      s.height,
      s.paddleX,
      s.paddleWidth,
      s.paddleY,
      s.radius,
      s.x,
      s.y,
      s.vx,
      s.vy,
    ].every((n) => typeof n === "number" && Number.isFinite(n)) &&
    s.width >= 100 && s.width <= 2000 && s.height >= 100 && s.height <= 2000 &&
    s.radius > 0 && s.radius <= 20 && s.paddleWidth >= 20 &&
    s.paddleWidth <= s.width && s.paddleX >= s.paddleWidth / 2 &&
    s.paddleX <= s.width - s.paddleWidth / 2 &&
    s.paddleY > s.radius && s.paddleY < s.height &&
    s.x >= s.radius && s.x <= s.width - s.radius &&
    s.y >= s.radius && s.y <= s.height &&
    Math.abs(s.vx) <= 2000 && Math.abs(s.vy) <= 2000 &&
    ["playing", "won", "lost"].includes(s.status) &&
    [s.score, s.bricks, s.lives].every((n) =>
      Number.isSafeInteger(n) && n >= 0 && n <= 10000
    );
}

export const RECORD_BYTES = 2048;
/** Demo-local NDJSON framing: one bounded record, never an indefinite body. */
export async function* states(
  stream: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncGenerator<GameState> {
  const reader = stream.getReader();
  const buffer = new Uint8Array(RECORD_BYTES);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let ended = false;
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      signal.throwIfAborted();
      if (done) {
        ended = true;
        if (size) throw new Error("Incomplete game state record");
        return;
      }
      for (const byte of value) {
        if (byte === 10) {
          const state: unknown = JSON.parse(
            decoder.decode(buffer.subarray(0, size)),
          );
          size = 0;
          if (!validState(state)) throw new Error("Invalid game state");
          yield state;
        } else {
          if (size === RECORD_BYTES) {
            throw new Error("Game state record too large");
          }
          buffer[size++] = byte;
        }
      }
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    if (!ended) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
