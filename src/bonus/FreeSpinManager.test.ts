import { describe, it, expect } from 'vitest';
import { FreeSpinManager } from './FreeSpinManager';

describe('FreeSpinManager', () => {
  it('starts, consumes, and exits', () => {
    const m = new FreeSpinManager();
    m.start(3, 10);
    expect(m.isActive).toBe(true);
    expect(m.remainingSpins).toBe(3);
    m.consume();
    m.consume();
    m.consume();
    expect(m.isActive).toBe(false);
  });

  it('steps the multiplier at each 4th wild and awards +10 spins per crossing', () => {
    const m = new FreeSpinManager();
    m.start(10, 100); // final-tier multiplier 100 (e.g. ULTRA)

    let r = m.collectWilds(4); // -> threshold 4
    expect(r.multiplier).toBe(2);
    expect(r.awardedSpins).toBe(10);

    r = m.collectWilds(4); // total 8 -> x3
    expect(r.multiplier).toBe(3);
    expect(r.awardedSpins).toBe(10);

    r = m.collectWilds(4); // total 12 -> final tier
    expect(r.multiplier).toBe(100);
    expect(r.awardedSpins).toBe(10);

    r = m.collectWilds(4); // total 16 -> capped at maxRetriggers (3)
    expect(r.awardedSpins).toBe(0);
    expect(r.multiplier).toBe(100);

    expect(m.snapshot().remaining).toBe(40); // 10 + 3 x 10
    expect(m.snapshot().wildCounter).toBe(16);
  });

  it('accumulates win', () => {
    const m = new FreeSpinManager();
    m.start(5, 10);
    m.addWin(20);
    m.addWin(30);
    expect(m.snapshot().totalWin).toBe(50);
  });
});
