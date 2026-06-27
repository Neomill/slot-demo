import { bonusConfig } from '../config/bonusConfig';

export interface FreeSpinSnapshot {
  remaining: number;
  multiplier: number;
  wildCounter: number;
  totalWin: number;
}

/**
 * Owns a Free Spins session: remaining spins, accumulated win, and the
 * wild-collection progression that awards extra spins and raises the multiplier.
 */
export class FreeSpinManager {
  private remaining = 0;
  private multiplier: number = bonusConfig.wildProgression.baseMultiplier;
  private wildCounter = 0;
  private totalWin = 0;
  private finalMultiplier: number = bonusConfig.freeSpins.defaultFinalMultiplier;
  private retriggers = 0;

  get isActive(): boolean {
    return this.remaining > 0;
  }

  get currentMultiplier(): number {
    return this.multiplier;
  }

  get remainingSpins(): number {
    return this.remaining;
  }

  /** Begin a session. `finalMultiplier` feeds the final progression stage. */
  start(spins: number, finalMultiplier: number): void {
    this.remaining = spins;
    this.multiplier = bonusConfig.wildProgression.baseMultiplier;
    this.wildCounter = 0;
    this.totalWin = 0;
    this.finalMultiplier = finalMultiplier;
    this.retriggers = 0;
  }

  consume(): void {
    if (this.remaining > 0) this.remaining -= 1;
  }

  addWin(amount: number): void {
    this.totalWin += amount;
  }

  /**
   * Add collected wilds; each crossed stage threshold awards spins and raises
   * the multiplier (capped at maxRetriggers crossings).
   */
  collectWilds(count: number): { awardedSpins: number; multiplier: number; stagesCrossed: number } {
    const before = this.wildCounter;
    this.wildCounter += count;
    const { stages, spinsAwarded, maxRetriggers } = bonusConfig.wildProgression;

    let awardedSpins = 0;
    let stagesCrossed = 0;
    for (const stage of stages) {
      if (this.retriggers >= maxRetriggers) break;
      if (before < stage.threshold && this.wildCounter >= stage.threshold) {
        this.retriggers += 1;
        stagesCrossed += 1;
        awardedSpins += spinsAwarded;
        this.multiplier = stage.useFinalTierMultiplier
          ? this.finalMultiplier
          : stage.multiplier ?? this.multiplier;
      }
    }
    this.remaining += awardedSpins;
    return { awardedSpins, multiplier: this.multiplier, stagesCrossed };
  }

  snapshot(): FreeSpinSnapshot {
    return {
      remaining: this.remaining,
      multiplier: this.multiplier,
      wildCounter: this.wildCounter,
      totalWin: this.totalWin,
    };
  }

  reset(): void {
    this.remaining = 0;
    this.multiplier = bonusConfig.wildProgression.baseMultiplier;
    this.wildCounter = 0;
    this.totalWin = 0;
    this.retriggers = 0;
  }
}
