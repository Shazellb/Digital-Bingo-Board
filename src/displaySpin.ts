import { ballLabel, DrawSpinner } from './spin';

const MISSED_SPIN_DURATION_MS = 450;

interface DisplaySpinCallbacks {
  onTick(label: string): void;
  onLand(ball: number, displayedLabel: string | null): void;
}

/** Keeps the TV animation stable when the spin and state snapshot cross in transit. */
export class DisplaySpinCoordinator {
  private readonly spinner = new DrawSpinner();
  private explicitTarget: number | null = null;
  private awaitingSyncBall: number | null = null;
  private latestSyncedBall: number | undefined;

  constructor(private readonly callbacks: DisplaySpinCallbacks) {}

  get active(): boolean {
    return this.spinner.active;
  }

  receiveSpin(targetBall: number, durationMs: number, reducedMotion: boolean): void {
    this.spinner.cancel();
    this.explicitTarget = targetBall;
    this.awaitingSyncBall = null;
    this.start(targetBall, durationMs, reducedMotion, true);
  }

  receiveSync(previousBall: number | undefined, nextBall: number | undefined, isNewCall: boolean, reducedMotion: boolean): void {
    this.latestSyncedBall = nextBall;
    if (!isNewCall || nextBall === undefined || nextBall === previousBall) return;

    if (this.explicitTarget === nextBall) return;
    if (this.awaitingSyncBall === nextBall) {
      this.awaitingSyncBall = null;
      this.callbacks.onLand(nextBall, null);
      return;
    }

    this.spinner.cancel();
    this.explicitTarget = null;
    this.start(nextBall, MISSED_SPIN_DURATION_MS, reducedMotion, false);
  }

  cancel(): void {
    this.spinner.cancel();
    this.explicitTarget = null;
    this.awaitingSyncBall = null;
  }

  private start(ball: number, durationMs: number, reducedMotion: boolean, explicit: boolean): void {
    this.spinner.begin(() => ball, {
      durationMs,
      reducedMotion,
      onTick: this.callbacks.onTick,
      onLand: (landedBall) => {
        if (explicit) {
          this.explicitTarget = null;
          const alreadySynced = this.latestSyncedBall === landedBall;
          this.awaitingSyncBall = alreadySynced ? null : landedBall;
          this.callbacks.onLand(landedBall, alreadySynced ? null : ballLabel(landedBall));
        } else {
          this.callbacks.onLand(landedBall, null);
        }
      },
    });
  }
}
