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

  it('steps the multiplier at each 4th wild and queues +10 spins per crossing', () => {
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

    // Awards are queued (not added to the counter) until activated.
    expect(m.snapshot().remaining).toBe(10); // unchanged — initial spins only
    expect(m.snapshot().queuedPanels).toBe(3);
    expect(m.snapshot().wildCounter).toBe(16);
  });

  it('activates queued panel awards into the counter, in order', () => {
    const m = new FreeSpinManager();
    m.start(10, 100);
    m.collectWilds(8); // crosses ×2 and ×3 -> two queued panels

    expect(m.snapshot().queuedPanels).toBe(2);
    expect(m.remainingSpins).toBe(10);

    expect(m.activateQueued()).toEqual({ panelIndex: 0, added: 10 });
    expect(m.remainingSpins).toBe(20);
    expect(m.activateQueued()).toEqual({ panelIndex: 1, added: 10 });
    expect(m.remainingSpins).toBe(30);

    expect(m.activateQueued()).toBeNull();
    expect(m.hasQueuedAwards).toBe(false);
  });

  it('stays active while awards are queued even with no spins left', () => {
    const m = new FreeSpinManager();
    m.start(1, 10);
    m.collectWilds(4); // queue one panel
    m.consume(); // drain the only initial spin
    expect(m.remainingSpins).toBe(0);
    expect(m.isActive).toBe(true); // queued award keeps it alive
    m.activateQueued();
    expect(m.remainingSpins).toBe(10);
  });

  it('accumulates win', () => {
    const m = new FreeSpinManager();
    m.start(5, 10);
    m.addWin(20);
    m.addWin(30);
    expect(m.snapshot().totalWin).toBe(50);
  });
});
