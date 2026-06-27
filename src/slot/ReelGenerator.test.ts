import { describe, it, expect } from 'vitest';
import { ReelGenerator } from './ReelGenerator';
import { REEL_SETS } from '../config/reelStrips';
import { createSeededRng } from '../core/rng';
import { gameConfig } from '../config/gameConfig';

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

  it('base strips never contain wild; freeSpins strips contain wild but no scatter', () => {
    expect(REEL_SETS.base.flat()).not.toContain('wild');
    expect(REEL_SETS.freeSpins.flat()).toContain('wild');
    expect(REEL_SETS.freeSpins.flat()).not.toContain('scatter');
  });
});
