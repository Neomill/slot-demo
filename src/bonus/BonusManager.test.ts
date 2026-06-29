import { describe, it, expect } from 'vitest';
import { BonusManager } from './BonusManager';
import type { SymbolId } from '../config/symbols';

const bm = new BonusManager();

function gridWith(symbol: SymbolId, count: number): SymbolId[][] {
  const grid: SymbolId[][] = Array.from({ length: 5 }, () => ['ace', 'ace', 'ace'] as SymbolId[]);
  let placed = 0;
  for (let reel = 0; reel < 5 && placed < count; reel++) {
    for (let row = 0; row < 3 && placed < count; row++) {
      grid[reel][row] = symbol;
      placed++;
    }
  }
  return grid;
}

describe('BonusManager', () => {
  it('awards free spins by scatter (bonus) count, clamping to the top tier', () => {
    expect(bm.scatterAward(2)).toBe(0);
    expect(bm.scatterAward(3)).toBe(10);
    expect(bm.scatterAward(4)).toBe(15);
    expect(bm.scatterAward(5)).toBe(20);
    expect(bm.scatterAward(7)).toBe(20);
  });

  it('counts the scatter (bonus) and the hold-&-respin (trophy) symbols', () => {
    expect(bm.countScatters(gridWith('bonus', 3))).toBe(3);
    expect(bm.countBonus(gridWith('trophy', 5))).toBe(5);
  });

  it('triggers hold & respin at 5 trophies', () => {
    expect(bm.triggersHoldAndRespin(4)).toBe(false);
    expect(bm.triggersHoldAndRespin(5)).toBe(true);
  });
});
