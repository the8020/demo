import { assert, assertEquals, assertRejects } from "@std/assert";
import { controlStream, predict } from "./controller.ts";
import { Game } from "./game.ts";
import { defaults, RECORD_BYTES, states, validState } from "./state.ts";
import type { ChannelConnection } from "/p/the8020/uui/channel.ts";

Deno.test("landing reflects both walls, tracks ascending balls and respects center dead zone", () => {
  const s = new Game(defaults, "run.1").state;
  Object.assign(s, { x: 600, y: 179, vx: 300, vy: 100 });
  // Two seconds to landing: 1193 measured from the left ball-radius wall.
  assertEquals(predict(s, 8).target, 66);
  s.vx = -800;
  assertEquals(predict(s, 8).target, 252);
  s.vy = -100;
  assertEquals(predict(s, 8).target, 590);
  s.vy = 0.001;
  s.x = 323;
  assertEquals(predict(s, 8), { target: 323, direction: 0 });
  s.vy = 100;
  s.vx = 0;
  s.x = s.paddleX = 320;
  assertEquals(predict(s, 0), { target: 320, direction: 0 });
  s.x = 7;
  assertEquals(predict(s, 0), { target: 50, direction: -1 });
});

Deno.test("physics breaks bricks, bounces off paddle and walls, loses lives and bounds suspension", () => {
  const game = new Game(defaults, "run.1"), s = game.state;
  Object.assign(s, { x: 55, y: 70, vx: 0, vy: -260 });
  game.step(0.05, 0);
  assertEquals(s.score, 10);
  assertEquals(s.bricks, 39);
  assert(s.vy > 0);
  Object.assign(s, { x: 320, y: 378, vx: 0, vy: 260 });
  game.step(0.01, 0);
  assert(s.vy < 0);
  Object.assign(s, { x: 8, y: 200, vx: -260, vy: 0 });
  game.step(0.02, -1);
  assert(s.vx > 0);
  assert(Math.abs(s.paddleX - (320 - defaults.paddleSpeed * 0.02)) < 0.001);
  Object.assign(s, { x: 100, y: 410, vx: 0, vy: 260 });
  game.step(0.05, 0);
  assertEquals(s.lives, 2);
  assert(s.vy < 0);
  Object.assign(s, { x: 320, y: 200, vx: 100, vy: 0 });
  game.step(100, 1);
  assert(Math.abs(s.x - 325) < 0.001);
  assert(validState(s));
  Object.assign(s, { x: 100, y: 410, vx: 0, vy: 260, lives: 1 });
  game.step(0.05, 0);
  assertEquals(s.status, "lost");
  assertEquals(s.lives, 0);
  const last = structuredClone(s);
  game.step(0.05, 1);
  assertEquals(s, last);
  const win = new Game(defaults, "win.1");
  win.bricks.forEach((b, i) => b.alive = i === 0);
  Object.assign(win.state, { bricks: 1, x: 55, y: 70, vx: 0, vy: -260 });
  win.step(0.05, 0);
  assertEquals(win.state.status, "won");
});

Deno.test("NDJSON spans arbitrary chunks, rejects bad/incomplete/oversized records and cancels", async () => {
  const s = new Game(defaults, "run.1").state;
  const encode = (value: unknown) =>
    new TextEncoder().encode(JSON.stringify(value) + "\n");
  const bytes = encode(s);
  const chunks = ReadableStream.from([
    bytes.slice(0, 12),
    bytes.slice(12),
    encode(s),
  ]);
  const result = [];
  for await (const state of states(chunks, new AbortController().signal)) {
    result.push(state);
  }
  assertEquals(result, [s, s]);
  for (
    const invalid of [
      encode({ ...s, x: -1 }),
      encode({ ...s, vx: Infinity }),
      bytes.slice(0, -1),
      new Uint8Array(RECORD_BYTES + 1).fill(32),
    ]
  ) {
    await assertRejects(async () => {
      for await (
        const _s of states(
          ReadableStream.from([invalid]),
          new AbortController().signal,
        )
      ) { /* consume */ }
    });
  }
  let cancelled = false;
  const owner = new AbortController();
  const pending = (async () => {
    for await (
      const _s of states(
        new ReadableStream({
          cancel() {
            cancelled = true;
          },
        }),
        owner.signal,
      )
    ) { /* consume */ }
  })();
  owner.abort();
  await assertRejects(() => pending);
  assert(cancelled);
});

Deno.test("controller consumes live state, stops stale/end/aborted runs and rejects a changed run", async () => {
  const s = new Game(defaults, "run.1").state;
  let source!: ReadableStreamDefaultController<Uint8Array>;
  const owner = new AbortController();
  const controls: unknown[] = [];
  const output = {
    send(_id: string, data: unknown) {
      controls.push(data);
    },
  } as ChannelConnection;
  const input = new ReadableStream<Uint8Array>({
    start(c) {
      source = c;
    },
  });
  const pending = controlStream(input, output, owner.signal, defaults, "run");
  const emit = () =>
    source.enqueue(new TextEncoder().encode(JSON.stringify(s) + "\n"));
  emit();
  await new Promise((r) => setTimeout(r, 160));
  assert(controls.length >= 1);
  await new Promise((r) => setTimeout(r, 450));
  const count = controls.length;
  await new Promise((r) => setTimeout(r, 100));
  assertEquals(controls.length, count);
  emit();
  await new Promise((r) => setTimeout(r, 80));
  assert(controls.length > count);
  s.status = "won";
  emit();
  await new Promise((r) => setTimeout(r, 20));
  const endedCount = controls.length;
  await new Promise((r) => setTimeout(r, 100));
  assertEquals(controls.length, endedCount);
  source.close();
  await pending;
  const bad = ReadableStream.from([
    new TextEncoder().encode(
      JSON.stringify(s) + "\n" + JSON.stringify({ ...s, run: "run.2" }) + "\n",
    ),
  ]);
  await assertRejects(() =>
    controlStream(bad, output, owner.signal, defaults, "run")
  );
  const blocked = controlStream(
    new ReadableStream(),
    output,
    owner.signal,
    defaults,
    "run",
  );
  owner.abort();
  await assertRejects(() => blocked);
});
