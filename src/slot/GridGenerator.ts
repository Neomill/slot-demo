import type { SymbolId } from '../config/symbols';

/** Injectable randomness so spins can be made deterministic in tests. */
export type RandomSource = () => number;

/**
 * Builds a grid[reel][row] by landing each reel on a random strip offset and
 * reading `rows` consecutive symbols (wrapping at the end of the strip).
 */
export function generateGrid(
  strips: readonly (readonly SymbolId[])[],
  rows: number,
  rng: RandomSource = Math.random,
): SymbolId[][] {
  return strips.map((strip) => {
    const start = Math.floor(rng() * strip.length);
    const column: SymbolId[] = [];
    for (let row = 0; row < rows; row++) {
      column.push(strip[(start + row) % strip.length]);
    }
    return column;
  });
}
