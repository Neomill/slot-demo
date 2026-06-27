/**
 * The full reel alphabet.
 * - `wild` substitutes for normal symbols (Free Spins only).
 * - `scatter` triggers Free Spins from the base game (pays anywhere, no line).
 * - `bonus` triggers Hold & Respin from the base game.
 */
export const SYMBOLS = [
  'cherry',
  'lemon',
  'orange',
  'plum',
  'bell',
  'bar',
  'seven',
  'wild',
  'scatter',
  'bonus',
] as const;

export type SymbolId = (typeof SYMBOLS)[number];

export const WILD: SymbolId = 'wild';
export const SCATTER: SymbolId = 'scatter';
export const BONUS: SymbolId = 'bonus';

export type SymbolKind = 'normal' | 'wild' | 'scatter' | 'bonus';

export const SYMBOL_KIND: Record<SymbolId, SymbolKind> = {
  cherry: 'normal',
  lemon: 'normal',
  orange: 'normal',
  plum: 'normal',
  bell: 'normal',
  bar: 'normal',
  seven: 'normal',
  wild: 'wild',
  scatter: 'scatter',
  bonus: 'bonus',
};
