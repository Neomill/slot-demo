import { describe, it, expect } from 'vitest';
import { BuyBonusManager } from './BuyBonusManager';

describe('BuyBonusManager', () => {
  const m = new BuyBonusManager();

  it('prices each tier as costMultiplier x currentBet', () => {
    expect(m.cost('super', 5)).toBe(375);
    expect(m.cost('mega', 5)).toBe(750);
    expect(m.cost('ultra', 5)).toBe(1500);
  });

  it('grants a flat 10 free spins with tiered final multipliers', () => {
    expect(m.initialFreeSpins('super')).toBe(10);
    expect(m.finalMultiplier('super')).toBe(10);
    expect(m.finalMultiplier('mega')).toBe(25);
    expect(m.finalMultiplier('ultra')).toBe(100);
  });
});
