import { bonusConfig } from '../config/bonusConfig';

export interface FreeSpinSnapshot {
  remaining: number;
  multiplier: number;
  wildCounter: number;
  totalWin: number;
  /** Completed panels whose +10 award is queued, waiting to be transferred. */
  queuedPanels: number;
}

/** A panel award moved from the queue into the live spin counter. */
export interface ActivatedAward {
  /** Which ladder panel (0 = ×2, 1 = ×3, 2 = final) was transferred. */
  panelIndex: number;
  /** Spins added to the counter. */
  added: number;
}

/**
 * Owns a Free Spins session: remaining spins, accumulated win, and the
 * wild-collection progression that awards extra spins and raises the multiplier.
 *
 * Per the rules, retrigger spins are "played after the initial Free Spins have
 * ended": crossing a stage raises the multiplier immediately but *queues* its
 * +10 award rather than adding it to the live counter. When the counter empties,
 * the queued panels are activated one at a time (the transfer ceremony) — each
 * call to {@link activateQueued} moves one panel's spins into the counter.
 */
export class FreeSpinManager {
  private remaining = 0;
  private multiplier: number = bonusConfig.wildProgression.baseMultiplier;
  private wildCounter = 0;
  private totalWin = 0;
  private finalMultiplier: number = bonusConfig.freeSpins.defaultFinalMultiplier;
  private retriggers = 0;
  /** Panel indices completed but not yet transferred (FIFO, left → right). */
  private queuedPanels: number[] = [];

  get isActive(): boolean {
    return this.remaining > 0 || this.queuedPanels.length > 0;
  }

  get currentMultiplier(): number {
    return this.multiplier;
  }

  get remainingSpins(): number {
    return this.remaining;
  }

  /** Whether any completed panel's award is still waiting to be transferred. */
  get hasQueuedAwards(): boolean {
    return this.queuedPanels.length > 0;
  }

  get queuedPanelCount(): number {
    return this.queuedPanels.length;
  }

  /** Begin a session. `finalMultiplier` feeds the final progression stage. */
  start(spins: number, finalMultiplier: number): void {
    this.remaining = spins;
    this.multiplier = bonusConfig.wildProgression.baseMultiplier;
    this.wildCounter = 0;
    this.totalWin = 0;
    this.finalMultiplier = finalMultiplier;
    this.retriggers = 0;
    this.queuedPanels = [];
  }

  consume(): void {
    if (this.remaining > 0) this.remaining -= 1;
  }

  addWin(amount: number): void {
    this.totalWin += amount;
  }

  /**
   * Add collected wilds; each crossed stage threshold raises the multiplier and
   * *queues* a +10 award (capped at maxRetriggers crossings). The queued awards
   * are transferred to the counter later via {@link activateQueued}.
   */
  collectWilds(count: number): { awardedSpins: number; multiplier: number; stagesCrossed: number } {
    const before = this.wildCounter;
    this.wildCounter += count;
    const { stages, spinsAwarded, maxRetriggers } = bonusConfig.wildProgression;

    let awardedSpins = 0;
    let stagesCrossed = 0;
    stages.forEach((stage, panelIndex) => {
      if (this.retriggers >= maxRetriggers) return;
      if (before < stage.threshold && this.wildCounter >= stage.threshold) {
        this.retriggers += 1;
        stagesCrossed += 1;
        awardedSpins += spinsAwarded;
        this.queuedPanels.push(panelIndex); // queued, not added to remaining yet
        this.multiplier = stage.useFinalTierMultiplier
          ? this.finalMultiplier
          : stage.multiplier ?? this.multiplier;
      }
    });
    return { awardedSpins, multiplier: this.multiplier, stagesCrossed };
  }

  /** Transfer the next queued panel's award into the live counter. */
  activateQueued(): ActivatedAward | null {
    const panelIndex = this.queuedPanels.shift();
    if (panelIndex === undefined) return null;
    const added = bonusConfig.wildProgression.spinsAwarded;
    this.remaining += added;
    return { panelIndex, added };
  }

  snapshot(): FreeSpinSnapshot {
    return {
      remaining: this.remaining,
      multiplier: this.multiplier,
      wildCounter: this.wildCounter,
      totalWin: this.totalWin,
      queuedPanels: this.queuedPanels.length,
    };
  }

  reset(): void {
    this.remaining = 0;
    this.multiplier = bonusConfig.wildProgression.baseMultiplier;
    this.wildCounter = 0;
    this.totalWin = 0;
    this.retriggers = 0;
    this.queuedPanels = [];
  }
}
