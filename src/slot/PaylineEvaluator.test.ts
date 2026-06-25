import { describe, it, expect } from 'vitest';
import { PaylineEvaluator } from './PaylineEvaluator';
import { PAYLINES } from '../config/paylines';
import { PAYTABLE } from '../config/paytable';
import { WILD } from '../config/symbols';
import type { SymbolId } from '../config/symbols';

const evaluator = new PaylineEvaluator({ paylines: PAYLINES, paytable: PAYTABLE, wild: WILD });

describe('PaylineEvaluator', () => {
  it('pays a 3-of-a-kind on the middle payline', () => {
    // grid[reel][row]; middle row (1) = seven, seven, seven, cherry, lemon
    const grid: SymbolId[][] = [
      ['cherry', 'seven', 'bar'],
      ['lemon', 'seven', 'orange'],
      ['bell', 'seven', 'plum'],
      ['orange', 'cherry', 'bell'],
      ['plum', 'lemon', 'cherry'],
    ];
    const { lineWins, totalWin } = evaluator.evaluate(grid, 1);
    expect(lineWins).toHaveLength(1);
    expect(lineWins[0]).toMatchObject({ payline: 0, symbol: 'seven', count: 3, amount: 20 });
    expect(totalWin).toBe(20);
  });

  it('substitutes wilds into a line', () => {
    // middle row = seven, WILD, seven, cherry, lemon -> seven x3 via the wild
    const grid: SymbolId[][] = [
      ['bar', 'seven', 'cherry'],
      ['orange', 'wild', 'plum'],
      ['bell', 'seven', 'orange'],
      ['lemon', 'cherry', 'bell'],
      ['plum', 'lemon', 'bar'],
    ];
    const { lineWins } = evaluator.evaluate(grid, 1);
    expect(lineWins).toHaveLength(1);
    expect(lineWins[0]).toMatchObject({ symbol: 'seven', count: 3, amount: 20 });
  });

  it('pays a 5-of-a-kind at the top tier', () => {
    const grid: SymbolId[][] = [
      ['cherry', 'seven', 'bar'],
      ['lemon', 'seven', 'cherry'],
      ['orange', 'seven', 'lemon'],
      ['plum', 'seven', 'orange'],
      ['bell', 'seven', 'plum'],
    ];
    const { lineWins, totalWin } = evaluator.evaluate(grid, 1);
    expect(lineWins).toHaveLength(1);
    expect(lineWins[0]).toMatchObject({ count: 5, amount: 200 });
    expect(totalWin).toBe(200);
  });

  it('scales the payout by the per-line bet', () => {
    const grid: SymbolId[][] = [
      ['cherry', 'seven', 'bar'],
      ['lemon', 'seven', 'orange'],
      ['bell', 'seven', 'plum'],
      ['orange', 'cherry', 'bell'],
      ['plum', 'lemon', 'cherry'],
    ];
    expect(evaluator.evaluate(grid, 5).totalWin).toBe(100); // 20 * 5
  });

  it('returns no win when nothing lines up', () => {
    // reel 0 differs from reel 1 on every payline, so every line breaks at 1
    const grid: SymbolId[][] = [
      ['cherry', 'lemon', 'orange'],
      ['lemon', 'bar', 'plum'],
      ['seven', 'bell', 'bar'],
      ['bell', 'seven', 'cherry'],
      ['bar', 'plum', 'seven'],
    ];
    const { lineWins, totalWin } = evaluator.evaluate(grid, 1);
    expect(lineWins).toHaveLength(0);
    expect(totalWin).toBe(0);
  });

  it('does not pay a line made entirely of wilds', () => {
    const grid: SymbolId[][] = [
      ['cherry', 'wild', 'bar'],
      ['lemon', 'wild', 'cherry'],
      ['orange', 'wild', 'lemon'],
      ['plum', 'wild', 'orange'],
      ['bell', 'wild', 'plum'],
    ];
    expect(evaluator.evaluate(grid, 1).lineWins).toHaveLength(0);
  });
});
