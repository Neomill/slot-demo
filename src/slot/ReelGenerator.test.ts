import { describe, it, expect } from 'vitest';
import { ReelGenerator } from './ReelGenerator';
import { REEL_SETS } from '../config/reelStrips';
import { createSeededRng } from '../core/rng';
import { gameConfig } from '../config/gameConfig';
import { bonusConfig } from '../config/bonusConfig';
import { SCATTER } from '../config/symbols';

const countScatters = (grid: string[][]) =>
  grid.reduce((n, col) => n + col.filter((s) => s === SCATTER).length, 0);

describe('ReelGenerator', () => {
  it('produces a reels x rows grid', () => {
    const grid = new ReelGenerator(createSeededRng(1)).generate('base');
    expect(grid).toHaveLength(gameConfig.reels);
    for (const column of grid) expect(column).toHaveLength(gameConfig.rows);
  });

  it('is deterministic for a given seed', () => {
    const a = new ReelGenerator(createSeededRng(99));
    const b = new ReelGenerator(createSeededRng(99));
    expect(a.generate('base')).toEqual(b.generate('base'));
  });

  it('keeps wild out of base, and bonus/trophy out of free spins', () => {
    expect(REEL_SETS.base.flat()).not.toContain('wild');
    expect(REEL_SETS.freeSpins.flat()).toContain('wild');
    expect(REEL_SETS.freeSpins.flat()).not.toContain('bonus'); // scatter
    expect(REEL_SETS.freeSpins.flat()).not.toContain('trophy');
    expect(REEL_SETS.holdAndRespin.flat()).toContain('trophy');
  });

  it('caps the scatter count on every generated board', () => {
    const max = bonusConfig.freeSpins.maxScatters;
    // Sweep many seeds across the scatter-bearing sets (base + the denser
    // chance2x, which can roll 4–5 before the cap).
    for (let seed = 0; seed < 300; seed++) {
      const gen = new ReelGenerator(createSeededRng(seed));
      expect(countScatters(gen.generate('base'))).toBeLessThanOrEqual(max);
      expect(countScatters(gen.generate('chance2x'))).toBeLessThanOrEqual(max);
    }
  });
});
