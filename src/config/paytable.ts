import type { SymbolId } from './symbols';

/** Match length (3/4/5) -> multiplier applied to the per-line bet. */
export type PayoutTiers = Record<number, number>;

export type PayTable = Partial<Record<SymbolId, PayoutTiers>>;

/**
 * Per-line payout multipliers. Horses pay high, card royals pay low. The
 * specials (wild / bonus / trophy) are intentionally absent — they trigger
 * features rather than paying lines.
 */
export const PAYTABLE: PayTable = {
  // high — themed
  goldhorse: { 3: 50, 4: 120, 5: 400 },
  redhorse: { 3: 25, 4: 60, 5: 200 },
  bluehorse: { 3: 20, 4: 50, 5: 150 },
  jocky: { 3: 15, 4: 40, 5: 120 },
  // mid
  shoehorse: { 3: 10, 4: 25, 5: 80 },
  binoculars: { 3: 8, 4: 20, 5: 60 },
  cap: { 3: 5, 4: 15, 5: 50 },
  // low — royals
  ten: { 3: 4, 4: 10, 5: 30 },
  jack: { 3: 3, 4: 8, 5: 25 },
  queen: { 3: 3, 4: 8, 5: 20 },
  king: { 3: 2, 4: 6, 5: 15 },
  ace: { 3: 2, 4: 5, 5: 12 },
};
