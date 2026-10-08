import type {
  CustomElementContext,
  CustomElementInstance,
} from "/p/the8020/uui/custom_element.ts";
import { Game } from "./game.ts";
import type { Control, Settings } from "./state.ts";
import type { StreamHandle } from "/p/the8020/uui/channel.ts";

export default function mount(
  context: CustomElementContext,
): CustomElementInstance {
  const { host } = context;
  host.classList.add("arkanoid");
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 420;
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    "Arkanoid board: watch the ball break bricks while the paddle follows its landing point.",
  );
  const metrics = document.createElement("p");
  metrics.className = "arkanoid-metrics";
  const communication = document.createElement("p");
  communication.className = "arkanoid-metrics";
  const notice = document.createElement("p");
  notice.setAttribute("role", "status");
  host.append(canvas, metrics, communication, notice);
  const paint = canvas.getContext("2d");
  if (!paint) throw new Error("Canvas unavailable");
  let config = context.config;
  let game = new Game(config.settings as Settings, String(config.run));
  let active = false;
  let disposed = false;
  let interrupted = false;
  let segment = 0;
  let direction: -1 | 0 | 1 = 0;
  let target = 320;
  let stateRate = 0;
  let controlRate = 0;
  let controls = 0;
  let totalControls = 0;
  let samples = 0;
  let controlAt = 0;
  let rateStart = 0;
  let renderedAt = 0;
  let stopWork: (() => void) | undefined;
  const encoder = new TextEncoder();

  function render(): void {
    const s = game.state;
    paint!.fillStyle = "#0e182d";
    paint!.fillRect(0, 0, s.width, s.height);
    for (const brick of game.bricks) {
      if (!brick.alive) continue;
      paint!.fillStyle = [
        "#ff718a",
        "#ffc36b",
        "#f1de7c",
        "#6bdfb3",
        "#6db6ff",
      ][Math.floor((brick.y - 44) / 25)]!;
      paint!.fillRect(brick.x, brick.y, 67, 17);
    }
    paint!.fillStyle = "#e8efff";
    paint!.fillRect(
      s.paddleX - s.paddleWidth / 2,
      s.paddleY,
      s.paddleWidth,
      10,
    );
    paint!.beginPath();
    paint!.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    paint!.fill();
    paint!.strokeStyle = "#6bdfb3";
    paint!.beginPath();
    paint!.moveTo(target, s.paddleY - 16);
    paint!.lineTo(target, s.paddleY - 4);
    paint!.stroke();
    metrics.textContent =
      `Score ${s.score} · Bricks ${s.bricks}/40 · Lives ${s.lives} · ${
        s.status === "won"
          ? "You won!"
          : s.status === "lost"
          ? "Game over"
          : stopWork
          ? "Playing"
          : "Paused"
      }`;
    communication.textContent = `State updates/s ${
      stateRate.toFixed(1)
    } · Controls received/s ${controlRate.toFixed(1)} · Landing target ${
      target.toFixed(0)
    }`;
    Object.assign(host.dataset, {
      run: s.run,
      status: s.status,
      score: String(s.score),
      bricks: String(s.bricks),
      paddleX: String(s.paddleX),
      ballX: String(s.x),
      ballY: String(s.y),
      controls: String(totalControls),
      samples: String(samples),
      target: String(target),
      running: String(!!stopWork),
    });
  }

  function stop(): void {
    const cleanup = stopWork;
    stopWork = undefined;
    cleanup?.();
    direction = 0;
    render();
  }
  function start(): void {
    if (
      !active || disposed || interrupted || document.hidden || stopWork ||
      game.state.status !== "playing"
    ) return;
    try {
      const output = context.channel;
      game.state.run = `${String(config.run)}.${++segment}`;
      const run = game.state.run;
      const owner = new AbortController();
      let demand = false;
      let source: ReadableStreamDefaultController<Uint8Array>;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          source = controller;
        },
        pull() {
          demand = true;
        },
        cancel() {
          demand = false;
        },
      }, { highWaterMark: 0 });
      let frame = 0;
      let previous = performance.now();
      controls = totalControls = samples = 0;
      stateRate = controlRate = 0;
      target = game.state.paddleX;
      rateStart = previous;
      notice.textContent = "";
      const subscription = output.subscribe("control", (_id, value) => {
        const c = value as Control;
        if (
          owner.signal.aborted || !c || c.run !== run ||
          ![-1, 0, 1].includes(c.direction) || !Number.isFinite(c.target) ||
          c.target < 0 || c.target > game.state.width ||
          !Number.isFinite(c.statesPerSecond) || c.statesPerSecond < 0
        ) return;
        direction = c.direction;
        target = c.target;
        stateRate = c.statesPerSecond;
        controls++;
        totalControls++;
        controlAt = performance.now();
      });
      // Only pending demand receives the latest snapshot; no history is queued.
      const sampling = setInterval(() => {
        if (!demand || owner.signal.aborted) return;
        demand = false;
        source.enqueue(encoder.encode(JSON.stringify(game.state) + "\n"));
        samples++;
        if (game.state.status !== "playing") {
          source.close();
          clearInterval(sampling);
        }
      }, 100);
      let transfer: StreamHandle | undefined = undefined;
      const cleanup = () => {
        owner.abort();
        clearInterval(sampling);
        cancelAnimationFrame(frame);
        subscription.unsubscribe();
        transfer?.cancel();
      };
      stopWork = cleanup;
      transfer = output.send("state", body, { signal: owner.signal });
      void transfer.done.then(() => {
        if (stopWork === cleanup) stop();
      }).catch(() => {
        if (stopWork !== cleanup) return;
        interrupted = true;
        stop();
        notice.textContent = "Connection interrupted. Reset game to resume.";
      });
      const animate = (now: number) => {
        if (owner.signal.aborted) return;
        game.step(
          (now - previous) / 1000,
          now - controlAt <= 250 ? direction : 0,
        );
        previous = now;
        if (now - rateStart >= 1000) {
          controlRate = controls * 1000 / (now - rateStart);
          controls = 0;
          rateStart = now;
        }
        if (now - renderedAt >= 32) {
          render();
          renderedAt = now;
        }
        frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
    } catch {
      interrupted = true;
      stop();
      notice.textContent = "Connection interrupted. Reset game to resume.";
    }
    render();
  }
  const visibility = () => {
    if (document.hidden) stop();
    else start();
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    stop();
    document.removeEventListener("visibilitychange", visibility);
    context.signal.removeEventListener("abort", dispose);
    host.replaceChildren();
  };
  document.addEventListener("visibilitychange", visibility);
  context.signal.addEventListener("abort", dispose, { once: true });
  render();
  return {
    update(next) {
      if (next.run !== config.run) {
        stop();
        config = next;
        interrupted = false;
        game = new Game(config.settings as Settings, String(config.run));
        direction = 0;
        target = game.state.paddleX;
      }
      start();
      render();
    },
    setActive(value) {
      active = value;
      if (value) start();
      else {
        stop();
        // Cover cancellation can arrive before the presentation activity update.
        interrupted = false;
      }
    },
    dispose,
  };
}
