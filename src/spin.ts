import { columnOf } from './engine/draw';

export interface SpinOptions {
  durationMs: number;
  reducedMotion?: boolean;
  random?: () => number;
  onTick(label: string): void;
  onLand(ball: number): void;
}

export function ballLabel(ball: number): string {
  return `${columnOf(ball)}-${ball}`;
}

export function spinDurationForInterval(intervalMs: number): number {
  if (intervalMs <= 1000) return 600;
  if (intervalMs <= 2000) return 1100;
  return 1500;
}

export class DrawSpinner {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private spinning = false;

  get active(): boolean {
    return this.spinning;
  }

  /** Reserves the real ball once, then animates labels without touching draw state. */
  begin(selectBall: () => number | null, options: SpinOptions): boolean {
    if (this.spinning) return false;
    const ball = selectBall();
    if (ball === null) return false;

    this.spinning = true;
    const finish = () => {
      this.timer = null;
      options.onTick(ballLabel(ball));
      this.spinning = false;
      options.onLand(ball);
    };
    if (options.reducedMotion || options.durationMs <= 0) {
      finish();
      return true;
    }

    const random = options.random ?? Math.random;
    const startedAt = performance.now();
    const tick = () => {
      const elapsed = performance.now() - startedAt;
      if (elapsed >= options.durationMs) {
        finish();
        return;
      }
      const previewBall = Math.min(75, Math.floor(random() * 75) + 1);
      options.onTick(ballLabel(previewBall));
      const progress = elapsed / options.durationMs;
      const delay = Math.min(options.durationMs - elapsed, 45 + Math.round(progress * progress * 180));
      this.timer = setTimeout(tick, delay);
    };
    tick();
    return true;
  }

  cancel(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.spinning = false;
  }
}
