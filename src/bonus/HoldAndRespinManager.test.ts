import { describe, it, expect } from 'vitest';
import { HoldAndRespinManager } from './HoldAndRespinManager';
import { bonusConfig } from '../config/bonusConfig';
import type { SymbolId } from '../config/symbols';

function grid(fill: SymbolId): SymbolId[][] {
  return Array.from({ length: 5 }, () => [fill, fill, fill] as SymbolId[]);
}

describe('HoldAndRespinManager', () => {
  it('locks bonus symbols on start', () => {
    const m = new HoldAndRespinManager();
    const g = grid('cherry');
    g[0][0] = 'bonus';
    g[1][1] = 'bonus';
    m.start(g);
    const snap = m.snapshot();
    expect(snap.remainingRespins).toBe(bonusConfig.holdAndRespin.initialRespins);
    expect(snap.locked[0][0]).toBe(true);
    expect(snap.locked[1][1]).toBe(true);
    expect(snap.locked[2][2]).toBe(false);
  });

  it('decrements respins when no new bonus lands', () => {
    const m = new HoldAndRespinManager();
    m.start(grid('cherry'));
    m.respin(grid('cherry'));
    expect(m.remaining).toBe(bonusConfig.holdAndRespin.initialRespins - 1);
  });

  it('resets respins and locks when a new bonus lands', () => {
    const m = new HoldAndRespinManager();
    m.start(grid('cherry'));
    m.respin(grid('cherry')); // -> 2
    const candidate = grid('cherry');
    candidate[0][0] = 'bonus';
    const { newBonus } = m.respin(candidate);
    expect(newBonus).toBe(1);
    expect(m.remaining).toBe(bonusConfig.holdAndRespin.resetRespins);
    expect(m.snapshot().locked[0][0]).toBe(true);
  });

  it('keeps locked cells fixed across respins', () => {
    const m = new HoldAndRespinManager();
    const g = grid('cherry');
    g[0][0] = 'bonus';
    m.start(g);
    m.respin(grid('lemon'));
    expect(m.currentBoard[0][0]).toBe('bonus'); // locked
    expect(m.currentBoard[0][1]).toBe('lemon'); // respun
  });
});
