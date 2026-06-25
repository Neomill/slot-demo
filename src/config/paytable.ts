import type { SymbolId } from './symbols';

/** Match length (3/4/5) -> multiplier applied to the per-line bet. */
export type PayoutTiers = Record<number, number>;

export type PayTable = Partial<Record<SymbolId, PayoutTiers>>;

/**
 * Multipliers are placeholders modelled on a standard 5x3 game — swap in the
 * real paytable when available. `wild` is intentionally absent: it substitutes
 * but carries no payout of its own.
 */
export const PAYTABLE: PayTable = {
  seven: { 3: 20, 4: 50, 5: 200 },
  bar: { 3: 10, 4: 30, 5: 120 },
  bell: { 3: 8, 4: 20, 5: 80 },
  plum: { 3: 5, 4: 12, 5: 40 },
  orange: { 3: 4, 4: 10, 5: 30 },
  lemon: { 3: 3, 4: 8, 5: 20 },
  cherry: { 3: 2, 4: 6, 5: 15 },
};
