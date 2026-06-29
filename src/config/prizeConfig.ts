import type { SymbolId } from './symbols';

/** The three Prize symbols (Blue / Red / Gold), mapped to the horse art. */
export const PRIZE_SYMBOLS = ['bluehorse', 'redhorse', 'goldhorse'] as const;
export type PrizeSymbol = (typeof PRIZE_SYMBOLS)[number];

/**
 * Each Prize symbol lands carrying a random value from its set (a multiplier of
 * the bet). Blue is lowest, Gold highest — up to x5.
 */
export const PRIZE_VALUES: Record<PrizeSymbol, number[]> = {
  bluehorse: [0.5, 0.75],
  redhorse: [1, 1.5],
  goldhorse: [2.5, 5],
};

export const prizeConfig = {
  /** Main game: this many Prize symbols on a payline pays the sum of their values. */
  minPrizesOnPaylineToPay: 3,
};

export function isPrizeSymbol(id: SymbolId): id is PrizeSymbol {
  return (PRIZE_SYMBOLS as readonly string[]).includes(id);
}
