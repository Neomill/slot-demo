/** A stage in the Free Spins wild-progression ladder. */
export interface MultiplierStage {
  /** Wild count at which this stage activates. */
  threshold: number;
  /** Fixed multiplier for this stage... */
  multiplier?: number;
  /** ...or use the session's final-tier multiplier (set by how the bonus was entered). */
  useFinalTierMultiplier?: boolean;
}

/**
 * All bonus tuning lives here — no bonus numbers are hardcoded elsewhere.
 * `costMultiplier`s are multiples of the current (total) bet.
 */
export const bonusConfig = {
  buyBonus: {
    super: { costMultiplier: 75, initialFreeSpins: 10, finalMultiplier: 10 },
    mega: { costMultiplier: 150, initialFreeSpins: 10, finalMultiplier: 25 },
    ultra: { costMultiplier: 300, initialFreeSpins: 10, finalMultiplier: 100 },
  },

  freeSpins: {
    /** Scatter count (in the base game) -> Free Spins awarded. */
    scatterAwards: { 3: 10 } as Record<number, number>,
    minScattersToTrigger: 3,
    /**
     * A board never shows more than this many Scatters — extra ones are removed
     * during reel generation (see ReelGenerator). With the cap at the trigger
     * count, 3 Scatters is the only tier.
     */
    maxScatters: 3,
    /** Final-tier multiplier when triggered by scatters (buys override per tier). */
    defaultFinalMultiplier: 10,
  },

  wildProgression: {
    /** Free Spins awarded each time a stage threshold is crossed. */
    spinsAwarded: 10,
    /** Cap on the number of threshold crossings (retriggers). */
    maxRetriggers: 3,
    /** Multiplier before the first threshold is reached. */
    baseMultiplier: 1,
    stages: [
      { threshold: 4, multiplier: 2 },
      { threshold: 8, multiplier: 3 },
      { threshold: 12, useFinalTierMultiplier: true },
    ] as MultiplierStage[],
  },

  holdAndRespin: {
    /** Trophy symbols on the base board needed to trigger. */
    trigger: { bonusSymbols: 5 },
    initialRespins: 3,
    /** Respins are reset to this whenever a new bonus symbol locks in. */
    resetRespins: 3,
    /**
     * Each locked trophy carries a random value from this set (a multiplier of
     * the per-line bet, like the Prize symbols). All values are collected when
     * the feature ends.
     */
    values: [2, 5, 10, 20, 50],
  },

  chance2x: {
    /** Spin cost is multiplied by this when Chance x2 (Luck Boost) is enabled — a +50% surcharge. */
    costMultiplier: 1.5,
  },
} as const;

export type BuyBonusTier = keyof typeof bonusConfig.buyBonus;
