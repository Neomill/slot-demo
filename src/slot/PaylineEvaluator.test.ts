import { describe, it, expect } from 'vitest';
import { PaylineEvaluator } from './PaylineEvaluator';
import { PAYLINES } from '../config/paylines';
import { PAYTABLE } from '../config/paytable';
import { WILD } from '../config/symbols';
import type { SymbolId } from '../config/symbols';

const evaluator = new PaylineEvaluator({ paylines: PAYLINES, paytable: PAYTABLE, wild: WILD });

describe('PaylineEvaluator', () => {
  it('pays a 3-of-a-kind on the middle payline', () => {
    // grid[reel][row]; middle row (1) = goldhorse, goldhorse, goldhorse, ace, jack
    const grid: SymbolId[][] = [
      ['ace', 'goldhorse', 'king'],
      ['jack', 'goldhorse', 'queen'],
      ['ten', 'goldhorse', 'cap'],
      ['king', 'ace', 'jocky'],
      ['queen', 'jack', 'redhorse'],
    ];
    const { lineWins, totalWin } = evaluator.evaluate(grid, 1);
    expect(lineWins).toHaveLength(1);
    expect(lineWins[0]).toMatchObject({ payline: 0, symbol: 'goldhorse', count: 3, amount: 50 });
    expect(totalWin).toBe(50);
  });

  it('substitutes wilds into a line', () => {
    const grid: SymbolId[][] = [
      ['ace', 'goldhorse', 'king'],
      ['jack', 'wild', 'queen'],
      ['ten', 'goldhorse', 'cap'],
      ['king', 'ace', 'jocky'],
      ['queen', 'jack', 'redhorse'],
    ];
    const { lineWins } = evaluator.evaluate(grid, 1);
    expect(lineWins).toHaveLength(1);
    expect(lineWins[0]).toMatchObject({ symbol: 'goldhorse', count: 3, amount: 50 });
  });

  it('pays a 5-of-a-kind at the top tier', () => {
    const grid: SymbolId[][] = [
      ['ace', 'goldhorse', 'king'],
      ['jack', 'goldhorse', 'queen'],
      ['ten', 'goldhorse', 'cap'],
      ['king', 'goldhorse', 'jocky'],
      ['queen', 'goldhorse', 'redhorse'],
    ];
    const { lineWins, totalWin } = evaluator.evaluate(grid, 1);
    expect(lineWins).toHaveLength(1);
    expect(lineWins[0]).toMatchObject({ count: 5, amount: 400 });
    expect(totalWin).toBe(400);
  });

  it('scales the payout by the per-line bet', () => {
    const grid: SymbolId[][] = [
      ['ace', 'goldhorse', 'king'],
      ['jack', 'goldhorse', 'queen'],
      ['ten', 'goldhorse', 'cap'],
      ['king', 'ace', 'jocky'],
      ['queen', 'jack', 'redhorse'],
    ];
    expect(evaluator.evaluate(grid, 5).totalWin).toBe(250); // 50 * 5
  });

  it('returns no win when nothing lines up', () => {
    const grid: SymbolId[][] = [
      ['ace', 'redhorse', 'bluehorse'],
      ['redhorse', 'jocky', 'cap'],
      ['ten', 'king', 'jack'],
      ['king', 'ten', 'queen'],
      ['jack', 'queen', 'ace'],
    ];
    const { lineWins, totalWin } = evaluator.evaluate(grid, 1);
    expect(lineWins).toHaveLength(0);
    expect(totalWin).toBe(0);
  });

  it('does not pay a line made entirely of wilds', () => {
    const grid: SymbolId[][] = [
      ['ace', 'wild', 'king'],
      ['jack', 'wild', 'queen'],
      ['ten', 'wild', 'cap'],
      ['king', 'wild', 'jocky'],
      ['queen', 'wild', 'redhorse'],
    ];
    expect(evaluator.evaluate(grid, 1).lineWins).toHaveLength(0);
  });
});
