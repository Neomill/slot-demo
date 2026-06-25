/** The full reel alphabet. `wild` substitutes for any normal symbol. */
export const SYMBOLS = [
  'cherry',
  'lemon',
  'orange',
  'plum',
  'bell',
  'bar',
  'seven',
  'wild',
] as const;

export type SymbolId = (typeof SYMBOLS)[number];

export const WILD: SymbolId = 'wild';

export type SymbolKind = 'normal' | 'wild' | 'scatter';

/** Behaviour of each symbol during evaluation. Scatter is reserved for later. */
export const SYMBOL_KIND: Record<SymbolId, SymbolKind> = {
  cherry: 'normal',
  lemon: 'normal',
  orange: 'normal',
  plum: 'normal',
  bell: 'normal',
  bar: 'normal',
  seven: 'normal',
  wild: 'wild',
};
