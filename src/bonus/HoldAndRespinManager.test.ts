import { describe, it, expect } from 'vitest';
import { HoldAndRespinManager } from './HoldAndRespinManager';
import { bonusConfig } from '../config/bonusConfig';
import type { SymbolId } from '../config/symbols';

function grid(fill: SymbolId): SymbolId[][] {
  return Array.from({ length: 5 }, () => [fill, fill, fill] as SymbolId[]);
}

describe('HoldAndRespinManager', () => {
  it('locks trophy symbols on start', () => {
    const m = new HoldAndRespinManager();
    const g = grid('ace');
    g[0][0] = 'trophy';
    g[1][1] = 'trophy';
    m.start(g);
    const snap = m.snapshot();
    expect(snap.remainingRespins).toBe(bonusConfig.holdAndRespin.initialRespins);
    expect(snap.locked[0][0]).toBe(true);
    expect(snap.locked[1][1]).toBe(true);
    expect(snap.locked[2][2]).toBe(false);
  });

  it('decrements respins when no new trophy lands', () => {
    const m = new HoldAndRespinManager();
    m.start(grid('ace'));
    m.respin(grid('ace'));
    expect(m.remaining).toBe(bonusConfig.holdAndRespin.initialRespins - 1);
  });

  it('resets respins and locks when a new trophy lands', () => {
    const m = new HoldAndRespinManager();
    m.start(grid('ace'));
    m.respin(grid('ace')); // -> 2
    const candidate = grid('ace');
    candidate[0][0] = 'trophy';
    const { newBonus } = m.respin(candidate);
    expect(newBonus).toBe(1);
    expect(m.remaining).toBe(bonusConfig.holdAndRespin.resetRespins);
    expect(m.snapshot().locked[0][0]).toBe(true);
  });

  it('keeps locked cells fixed across respins', () => {
    const m = new HoldAndRespinManager();
    const g = grid('ace');
    g[0][0] = 'trophy';
    m.start(g);
    m.respin(grid('king'));
    expect(m.currentBoard[0][0]).toBe('trophy'); // locked
    expect(m.currentBoard[0][1]).toBe('king'); // respun
  });
});
