import { clamp, type GameState, type Settings } from "./state.ts";

export interface Brick {
  x: number;
  y: number;
  alive: boolean;
}
export class Game {
  readonly state: GameState;
  readonly bricks: Brick[] = Array.from({ length: 40 }, (_, i) => ({
    x: 24 + i % 8 * 75,
    y: 44 + Math.floor(i / 8) * 25,
    alive: true,
  }));
  constructor(readonly settings: Settings, run: string) {
    this.state = {
      run,
      width: 640,
      height: 420,
      paddleX: 320,
      paddleWidth: settings.paddleWidth,
      paddleY: 386,
      radius: 7,
      x: 320,
      y: 320,
      vx: 0,
      vy: 0,
      status: "playing",
      score: 0,
      bricks: this.bricks.length,
      lives: 3,
    };
    this.serve();
  }
  serve(): void {
    const s = this.state;
    s.x = s.paddleX;
    s.y = s.paddleY - 35;
    s.vx = this.settings.ballSpeed * 0.45;
    s.vy = -this.settings.ballSpeed * Math.sqrt(1 - 0.45 ** 2);
  }
  step(elapsed: number, direction: -1 | 0 | 1): void {
    // A bounded frame plus small steps prevents tunnelling at the offered speeds.
    let remaining = clamp(elapsed, 0, 0.05);
    while (remaining > 0 && this.state.status === "playing") {
      const dt = Math.min(remaining, 1 / 240);
      remaining -= dt;
      const s = this.state, r = s.radius;
      s.paddleX = clamp(
        s.paddleX + direction * this.settings.paddleSpeed * dt,
        s.paddleWidth / 2,
        s.width - s.paddleWidth / 2,
      );
      const oldX = s.x, oldY = s.y;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.x < r || s.x > s.width - r) {
        s.x = clamp(s.x, r, s.width - r);
        s.vx *= -1;
      }
      if (s.y < r) {
        s.y = r;
        s.vy = Math.abs(s.vy);
      }
      if (
        s.vy > 0 && oldY + r <= s.paddleY && s.y + r >= s.paddleY &&
        Math.abs(s.x - s.paddleX) <= s.paddleWidth / 2 + r
      ) {
        s.y = s.paddleY - r;
        const angle = clamp((s.x - s.paddleX) / (s.paddleWidth / 2), -1, 1) *
          1.05;
        s.vx = this.settings.ballSpeed * Math.sin(angle);
        s.vy = -this.settings.ballSpeed * Math.cos(angle);
      }
      for (const brick of this.bricks) {
        if (
          !brick.alive || s.x + r < brick.x || s.x - r > brick.x + 67 ||
          s.y + r < brick.y || s.y - r > brick.y + 17
        ) continue;
        brick.alive = false;
        s.bricks--;
        s.score += 10;
        if (oldX + r <= brick.x || oldX - r >= brick.x + 67) s.vx *= -1;
        else s.vy *= -1;
        s.x = oldX;
        s.y = oldY;
        if (!s.bricks) s.status = "won";
        break;
      }
      if (s.y >= s.height - r) {
        s.lives--;
        if (!s.lives) {
          s.y = s.height - r;
          s.status = "lost";
        } else this.serve();
      }
    }
  }
}
