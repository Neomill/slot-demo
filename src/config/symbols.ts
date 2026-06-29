/**
 * Horse-racing reel alphabet (ids match the art filenames: `symbol-<id>.png`).
 * - `wild`   substitutes for normal symbols (Free Spins only).
 * - `bonus`  is the Scatter — 3+ on a base spin trigger Free Spins (pays anywhere).
 * - `trophy` triggers Hold & Respin — 5 on a base spin, and it locks during the feature.
 */
export const SYMBOLS = [
  // royals (low pays)
  'ace',
  'king',
  'queen',
  'jack',
  'ten',
  // themed (high/mid pays)
  'goldhorse',
  'redhorse',
  'bluehorse',
  'jocky',
  'cap',
  'binoculars',
  'shoehorse',
  // specials
  'wild',
  'bonus',
  'trophy',
] as const;

export type SymbolId = (typeof SYMBOLS)[number];

export const WILD: SymbolId = 'wild';
/** Free Spins trigger (the "scatter" mechanic). */
export const SCATTER: SymbolId = 'bonus';
/** Hold & Respin trigger / lock symbol (the "bonus" mechanic). */
export const BONUS: SymbolId = 'trophy';

export type SymbolKind = 'normal' | 'wild' | 'scatter' | 'bonus' | 'prize';

export const SYMBOL_KIND: Record<SymbolId, SymbolKind> = {
  ace: 'normal',
  king: 'normal',
  queen: 'normal',
  jack: 'normal',
  ten: 'normal',
  goldhorse: 'prize',
  redhorse: 'prize',
  bluehorse: 'prize',
  jocky: 'normal',
  cap: 'normal',
  binoculars: 'normal',
  shoehorse: 'normal',
  wild: 'wild',
  bonus: 'scatter',
  trophy: 'bonus',
};
