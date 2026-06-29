import { describe, it, expect } from 'vitest';
import { HoldAndRespinManager } from './HoldAndRespinManager';
import { bonusConfig } from '../config/bonusConfig';
import { createSeededRng } from '../core/rng';
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

  it('tracks the lock state from before the respin (new trophies stay distinguishable)', () => {
    const m = new HoldAndRespinManager();
    const g = grid('ace');
    g[0][0] = 'trophy';
    m.start(g);
    const candidate = grid('ace');
    candidate[1][1] = 'trophy';
    m.respin(candidate);
    const snap = m.snapshot();
    expect(snap.lockedBefore[0][0]).toBe(true); // held from the start
    expect(snap.lockedBefore[1][1]).toBe(false); // landed during this respin
    expect(snap.locked[1][1]).toBe(true);
  });

  it('refill restores the respin counter to the reset value', () => {
    const m = new HoldAndRespinManager();
    m.start(grid('ace'));
    m.respin(grid('ace')); // 3 -> 2
    expect(m.remaining).toBe(bonusConfig.holdAndRespin.initialRespins - 1);
    m.refill();
    expect(m.remaining).toBe(bonusConfig.holdAndRespin.resetRespins);
  });

  it('values each locked trophy and totals them for the collect', () => {
    const m = new HoldAndRespinManager(createSeededRng(1));
    const g = grid('ace');
    g[0][0] = 'trophy';
    g[1][1] = 'trophy';
    m.start(g);
    const snap = m.snapshot();
    expect(bonusConfig.holdAndRespin.values).toContain(snap.values[0][0]);
    expect(bonusConfig.holdAndRespin.values).toContain(snap.values[1][1]);
    expect(snap.values[2][2]).toBe(0); // no trophy here
    expect(m.trophyTotal()).toBe(snap.values[0][0] + snap.values[1][1]);
  });

  it('ends when the whole board is trophies, even with respins left', () => {
    const m = new HoldAndRespinManager(createSeededRng(1));
    m.start(grid('trophy'));
    expect(m.isFull).toBe(true);
    expect(m.remaining).toBeGreaterThan(0);
    expect(m.isActive).toBe(false);
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
