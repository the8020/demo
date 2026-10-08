import { assert, assertEquals } from "@std/assert";
import {
  callScreen,
  Channel,
  Model,
  presentModal,
  ScreenChannel,
  z,
} from "/p/the8020/uui/mod.ts";
import type {
  AttachedChannel,
  ChannelSubscriber,
} from "/p/the8020/uui/channel.ts";
import arkanoidDemo from "./program.ts";

interface Browser {
  evaluate<T>(expression: string): Promise<T>;
  command<T = Record<string, unknown>>(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<T>;
}
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Instrument the public boundaries while executing the ordinary program/source. */
export default async function fixture(root: string) {
  const assets = `${root}/packages/the8020/demo/public`;
  await Deno.mkdir(assets, { recursive: true });
  for (const name of ["arkanoid.js", "arkanoid.css"]) {
    await Deno.copyFile(
      new URL(`../../public/${name}`, import.meta.url),
      `${assets}/${name}`,
    );
  }
  const subscribe = Channel.prototype.subscribe;
  const capture = Channel.prototype.capture;
  const ticks: Array<{ run: string; at: number }> = [];
  let activeStreams = 0;
  let totalStreams = 0;
  let hold: Promise<void> | undefined;
  let releaseHold: (() => void) | undefined;
  let returned = false;
  const errors: unknown[] = [];
  Channel.prototype.subscribe = function (id, handler) {
    if (id !== "state") return subscribe.call(this, id, handler);
    const observe: ChannelSubscriber = async (name, data, context) => {
      assert(
        data instanceof ReadableStream,
        "backend must receive an actual byte stream",
      );
      activeStreams++;
      totalStreams++;
      try {
        const gate = hold;
        hold = undefined;
        if (gate) await gate;
        await handler(name, data, context);
      } catch (e) {
        if (!context.signal.aborted) errors.push(e);
        throw e;
      } finally {
        activeStreams--;
      }
    };
    return subscribe.call(this, id, observe);
  };
  Channel.prototype.capture = function (connected): AttachedChannel {
    const output = capture.call(this, connected);
    return {
      ...output,
      send: ((id: string, data: unknown) => {
        if (id === "control") {
          assert(
            !(data instanceof ReadableStream),
            "controls must be discrete",
          );
          ticks.push({
            run: (data as { run: string }).run,
            at: performance.now(),
          });
        }
        return output.send(id, data);
      }) as AttachedChannel["send"],
    };
  };
  const next = new ScreenChannel();
  const gameScreen = new ScreenChannel();
  return {
    async run() {
      await arkanoidDemo(gameScreen);
      returned = true;
      await callScreen({
        id: "after-arkanoid",
        title: "After Arkanoid",
        channel: next,
        schema: z.object({}),
        model: new Model({}),
      });
    },
    async verify(page: Browser) {
      const wait = async (expression: string) => {
        const until = Date.now() + 8000;
        while (!await page.evaluate(expression)) {
          if (Date.now() > until) throw new Error(`Timed out: ${expression}`);
          await delay(25);
        }
      };
      const screenshot = async (name: string) => {
        if (!Deno.args.includes("--screenshots")) return;
        const { data } = await page.command<{ data: string }>(
          "Page.captureScreenshot",
          { format: "png" },
        );
        await Deno.writeFile(
          `/tmp/arkanoid-${name}.png`,
          Uint8Array.from(atob(data), (c) => c.charCodeAt(0)),
        );
      };
      await page.command("Emulation.setDeviceMetricsOverride", {
        width: 1280,
        height: 960,
        deviceScaleFactor: 1,
        mobile: false,
      });
      const board = "document.querySelector('.arkanoid')";
      await wait(`${board}?.dataset.controls > 20`);
      assertEquals(activeStreams, 1);
      assertEquals(totalStreams, 1);
      assert(
        await page.evaluate<boolean>(
          "window.arkanoidProbe.streams === 1 && window.arkanoidProbe.subscriptions === 1",
        ),
      );
      const run = await page.evaluate<string>(`${board}.dataset.run`);
      const before = await page.evaluate<string>(`${board}.dataset.paddleX`);
      await delay(1500);
      assert(
        await page.evaluate<boolean>(
          `${board}.dataset.paddleX !== ${JSON.stringify(before)}`,
        ),
      );
      await wait(`${board}.dataset.score > 0`);
      await screenshot("desktop");
      const cadence = ticks.filter((t) => t.run === run).map((t, i, all) =>
        i ? t.at - all[i - 1]!.at : 0
      ).slice(1);
      const sorted = [...cadence].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)]!;
      assert(
        median >= 40 && median <= 90,
        `nominal 50 ms cadence: median ${median}`,
      );
      assert(cadence.every((n) => n >= 25), "no catch-up bursts");
      assert(
        await page.evaluate<boolean>(
          "document.querySelector('.arkanoid-metrics + .arkanoid-metrics').textContent.includes('State updates/s 10.') || document.querySelector('.arkanoid-metrics + .arkanoid-metrics').textContent.includes('State updates/s 9.')",
        ),
      );
      // Same-config redraw retains the board and its stream/subscription.
      const streamsBefore = totalStreams;
      gameScreen.redraw();
      await delay(100);
      gameScreen.redraw();
      await delay(200);
      assertEquals(totalStreams, streamsBefore);
      assertEquals(await page.evaluate(`${board}.dataset.run`), run);
      // Native settings stay pending until Reset captures the new snapshot.
      await page.evaluate(
        `(() => { const input = document.querySelector('[data-bind="paddleWidth"]'); input.value = '140'; input.dispatchEvent(new Event('input', {bubbles:true})); })()`,
      );
      assertEquals(
        await page.evaluate(
          "window.arkanoidProbe.context.config.settings.paddleWidth",
        ),
        100,
      );
      for (let i = 0; i < 4; i++) {
        if (i === 0) {
          hold = new Promise<void>((resolve) => {
            releaseHold = resolve;
          });
        }
        const oldRun = await page.evaluate<string>(`${board}.dataset.run`);
        await page.evaluate(
          "document.querySelector('[data-element-id=reset]').click()",
        );
        if (i === 0) {
          await wait(`${board}?.dataset.run !== ${JSON.stringify(oldRun)}`);
          await delay(700);
          assert(
            await page.evaluate<boolean>(
              `${board}.dataset.samples <= 4 && ${board}.dataset.ballY < 300`,
            ),
            "backpressure bounds samples while physics keeps running",
          );
          releaseHold!();
        }
        await wait(
          `${board}?.dataset.run !== ${
            JSON.stringify(oldRun)
          } && ${board}?.dataset.controls > 3 && !document.querySelector('#screen-back').disabled`,
        );
        assertEquals(
          await page.evaluate(
            "window.arkanoidProbe.context.config.settings.paddleWidth",
          ),
          140,
        );
        assertEquals(activeStreams, 1);
        assert(
          await page.evaluate<boolean>(
            "window.arkanoidProbe.streams === 1 && window.arkanoidProbe.subscriptions === 1",
          ),
        );
        const current = await page.evaluate<string>(`${board}.dataset.run`);
        const start = ticks.length;
        await delay(150);
        assert(
          ticks.slice(start).every((t) => t.run === current),
          "old controller cannot output after Reset",
        );
      }
      // A saved old control cannot affect the current component.
      assert(
        await page.evaluate<boolean>(`(() => {
        const p = window.arkanoidProbe;
        p.instance.update(p.context.config);
        const target = p.context.host.dataset.target;
        p.handler('control', {run:${
          JSON.stringify(run)
        }, direction:-1, target:0, statesPerSecond:0});
        p.instance.update(p.context.config);
        return p.context.host.dataset.target === target;
      })()`),
      );
      // Cover/resume releases activity and resumes this board, with a new segment.
      const saved = await page.evaluate<string>(`${board}.dataset.run`);
      const modalChannel = new ScreenChannel();
      const modal = presentModal(() =>
        callScreen({
          id: "cover-game",
          title: "Paused match",
          channel: modalChannel,
          schema: z.object({}),
          model: new Model({}),
        })
      );
      void modal.catch(() => {});
      await wait(
        "document.querySelector('dialog.presentation-modal .screen-title')?.textContent === 'Paused match'",
      );
      await delay(200);
      assertEquals(activeStreams, 0);
      assert(
        await page.evaluate<boolean>(
          "window.arkanoidProbe.streams === 0 && window.arkanoidProbe.subscriptions === 0",
        ),
      );
      const stopped = ticks.length;
      await delay(120);
      assertEquals(ticks.length, stopped);
      modalChannel.exit();
      await modal;
      await wait(
        `${board}.dataset.run !== ${
          JSON.stringify(saved)
        } && ${board}.dataset.controls > 3`,
      );
      assertEquals(activeStreams, 1);
      // Socket loss ends transient work; Reset explicitly begins a fresh match.
      const disconnectedRun = await page.evaluate<string>(
        `${board}.dataset.run`,
      );
      await page.evaluate(
        "window.oldArkanoidSocket = window.arkanoidSocket; window.arkanoidSocket.close(4000, 'Arkanoid lifecycle check')",
      );
      await wait(
        `${board}?.dataset.running === 'false' && window.arkanoidSocket !== window.oldArkanoidSocket && document.querySelector('#connection-state')?.textContent === 'Connected'`,
      );
      assertEquals(activeStreams, 0);
      assert(
        await page.evaluate<boolean>(
          "window.arkanoidProbe.streams === 0 && window.arkanoidProbe.subscriptions === 0",
        ),
      );
      const disconnectedTicks = ticks.length;
      await delay(150);
      assertEquals(ticks.length, disconnectedTicks);
      await page.evaluate(
        "document.querySelector('[data-element-id=reset]').click()",
      );
      await wait(
        `${board}?.dataset.run !== ${
          JSON.stringify(disconnectedRun)
        } && ${board}?.dataset.controls > 3`,
      );
      assertEquals(activeStreams, 1);
      assert(
        await page.evaluate<boolean>(
          "window.arkanoidProbe.streams === 1 && window.arkanoidProbe.subscriptions === 1",
        ),
      );
      await page.command("Emulation.setDeviceMetricsOverride", {
        width: 390,
        height: 844,
        deviceScaleFactor: 1,
        mobile: true,
      });
      assert(
        await page.evaluate<boolean>(
          `${board}.querySelector('canvas').getBoundingClientRect().width <= innerWidth && document.documentElement.scrollWidth <= innerWidth + 1`,
        ),
      );
      assert(
        await page.evaluate<boolean>(
          "document.querySelector('[data-element-id=reset]').getBoundingClientRect().width > 0",
        ),
        "Reset remains visible on mobile",
      );
      await screenshot("mobile");
      // The built component has no input events that move the paddle.
      await page.evaluate("window.arkanoidProbe.instance.setActive(false)");
      const paddle = await page.evaluate(`${board}.dataset.paddleX`);
      await page.evaluate(
        "document.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowLeft'})); document.querySelector('.arkanoid canvas').dispatchEvent(new PointerEvent('pointermove', {clientX:0}));",
      );
      await delay(100);
      assertEquals(await page.evaluate(`${board}.dataset.paddleX`), paddle);
      await page.evaluate("window.arkanoidProbe.instance.setActive(true)");
      await wait(`${board}.dataset.controls > 3`);
      // Real screen settlement replaces the screen and disposes its owner.
      await page.evaluate("document.querySelector('#screen-back').click()");
      await wait(
        "document.querySelector('.screen-title')?.textContent === 'After Arkanoid'",
      );
      assert(returned);
      await delay(200);
      assertEquals(activeStreams, 0);
      assert(
        await page.evaluate<boolean>(
          "window.arkanoidProbe.streams === 0 && window.arkanoidProbe.subscriptions === 0 && window.arkanoidProbe.disposed",
        ),
      );
      const settled = ticks.length;
      await delay(200);
      assertEquals(ticks.length, settled);
      assertEquals(errors, []);
      assertEquals(await page.evaluate("window.arkanoidProbe.errors"), []);
      console.log(JSON.stringify({
        upstream: "continuous byte stream",
        downstream: "discrete messages",
        streams: totalStreams,
        tickMedianMs: median,
        tickMinMs: Math.min(...cadence),
        tickMaxMs: Math.max(...cadence),
        settledStreams: activeStreams,
      }));
    },
    async serve(request: Request) {
      const path = new URL(request.url).pathname;
      if (path === "/arkanoid-source.js") {
        return new Response(
          await Deno.readTextFile(
            new URL("../../public/arkanoid.js", import.meta.url),
          ),
          { headers: { "content-type": "text/javascript" } },
        );
      }
      if (
        path !== "/the8020/uui/shell/package-assets/the8020/demo/arkanoid.js"
      ) return undefined;
      return new Response(
        `import mount from '/arkanoid-source.js';
        const socketSend = WebSocket.prototype.send;
        WebSocket.prototype.send = function(data) { window.arkanoidSocket = this; return socketSend.call(this, data); };
        export default function(context) {
          const p = window.arkanoidProbe = { streams:0, subscriptions:0, received:0, errors:[], context, disposed:false };
          window.addEventListener('unhandledrejection', e => p.errors.push(String(e.reason)));
          const wrapped = { ...context, get config() { return context.config; }, get channel() {
            const view = context.channel;
            return { subscribe(id, handler) {
              p.subscriptions++;
              p.handler = handler;
              const subscription = view.subscribe(id, (...args) => { handler(...args); p.received++; });
              let closed = false;
              return { unsubscribe() { if (!closed) { closed=true; p.subscriptions--; subscription.unsubscribe(); } } };
            }, send(id, data, options) {
              if (!(data instanceof ReadableStream)) throw Error('not a byte stream');
              p.streams++;
              const handle = view.send(id, data, options);
              handle.done.then(() => p.streams--, () => p.streams--);
              return handle;
            } };
          } };
          const instance = mount(wrapped); p.instance = instance;
          return { ...instance, dispose() { p.disposed=true; instance.dispose(); } };
        }`,
        { headers: { "content-type": "text/javascript" } },
      );
    },
    close() {
      releaseHold?.();
      next.exit();
      Channel.prototype.subscribe = subscribe;
      Channel.prototype.capture = capture;
      return Promise.resolve();
    },
  };
}
