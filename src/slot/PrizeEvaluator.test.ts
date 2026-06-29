import { describe, it, expect } from 'vitest';
import { PrizeEvaluator } from './PrizeEvaluator';
import { createSeededRng } from '../core/rng';
import { PRIZE_VALUES, type PrizeSymbol } from '../config/prizeConfig';
import type { SymbolId } from '../config/symbols';

// Single middle payline keeps the main-game test independent of the live config.
const MIDDLE = [[1, 1, 1, 1, 1]];

/** Build a grid where the middle row is `syms` (other rows are filler). */
function mid(syms: SymbolId[]): SymbolId[][] {
  return syms.map((s) => ['king', s, 'king'] as SymbolId[]);
}

describe('PrizeEvaluator', () => {
  it('rolls a valid value for each prize symbol', () => {
    const ev = new PrizeEvaluator(createSeededRng(1), MIDDLE);
    const prizes = ev.roll(mid(['goldhorse', 'redhorse', 'bluehorse', 'ace', 'ten']));
    expect(prizes).toHaveLength(3);
    for (const p of prizes) {
      expect(PRIZE_VALUES[p.symbol as PrizeSymbol]).toContain(p.value);
    }
  });

  it('pays the summed value when 3+ prizes land on a payline', () => {
    const ev = new PrizeEvaluator(createSeededRng(1), MIDDLE);
    const prizes = ev.roll(mid(['goldhorse', 'redhorse', 'bluehorse', 'ace', 'ten']));
    const wins = ev.evaluateMainGame(prizes, 1);
    expect(wins).toHaveLength(1);
    expect(wins[0].kind).toBe('prize');
    expect(wins[0].count).toBe(3);
    expect(wins[0].amount).toBeCloseTo(prizes.reduce((s, p) => s + p.value, 0));
  });

  it('does not pay with fewer than 3 prizes on a line', () => {
    const ev = new PrizeEvaluator(createSeededRng(1), MIDDLE);
    const prizes = ev.roll(mid(['goldhorse', 'redhorse', 'ace', 'ten', 'king']));
    expect(ev.evaluateMainGame(prizes, 1)).toHaveLength(0);
  });

  it('collect: each wild pays the total prize value; nothing without a wild', () => {
    const ev = new PrizeEvaluator(createSeededRng(1), MIDDLE);
    const prizes = ev.roll(mid(['goldhorse', 'redhorse', 'ace', 'ten', 'king']));
    const sum = prizes.reduce((s, p) => s + p.value, 0);
    expect(ev.collect(prizes, 0, 1)).toBe(0);
    expect(ev.collect(prizes, 2, 1)).toBeCloseTo(2 * sum);
  });
});
