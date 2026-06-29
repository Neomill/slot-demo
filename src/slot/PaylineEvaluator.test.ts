import { describe, it, expect } from 'vitest';
import { PaylineEvaluator } from './PaylineEvaluator';
import { PAYTABLE } from '../config/paytable';
import { WILD } from '../config/symbols';
import type { SymbolId } from '../config/symbols';

// A single middle payline keeps these unit tests independent of the live
// payline config (which can grow). Only row 1 of each reel is read.
const MIDDLE = [[1, 1, 1, 1, 1]];
const evaluator = new PaylineEvaluator({ paylines: MIDDLE, paytable: PAYTABLE, wild: WILD });

/** Build a grid where the middle row is `syms` (other rows are irrelevant). */
function mid(syms: SymbolId[]): SymbolId[][] {
  return syms.map((s) => ['king', s, 'king'] as SymbolId[]);
}

describe('PaylineEvaluator', () => {
  it('pays a 3-of-a-kind on the payline', () => {
    const { lineWins, totalWin } = evaluator.evaluate(mid(['jocky', 'jocky', 'jocky', 'ace', 'ten']), 1);
    expect(lineWins).toHaveLength(1);
    expect(lineWins[0]).toMatchObject({ symbol: 'jocky', count: 3, amount: 15, kind: 'line' });
    expect(totalWin).toBe(15);
  });

  it('substitutes wilds into a line', () => {
    const { lineWins } = evaluator.evaluate(mid(['jocky', 'wild', 'jocky', 'ten', 'ten']), 1);
    expect(lineWins).toHaveLength(1);
    expect(lineWins[0]).toMatchObject({ symbol: 'jocky', count: 3, amount: 15 });
  });

  it('pays a 5-of-a-kind at the top tier', () => {
    const { lineWins, totalWin } = evaluator.evaluate(mid(['jocky', 'jocky', 'jocky', 'jocky', 'jocky']), 1);
    expect(lineWins).toHaveLength(1);
    expect(lineWins[0]).toMatchObject({ count: 5, amount: 120 });
    expect(totalWin).toBe(120);
  });

  it('scales the payout by the per-line bet', () => {
    expect(evaluator.evaluate(mid(['jocky', 'jocky', 'jocky', 'ace', 'ten']), 5).totalWin).toBe(75);
  });

  it('returns no win when nothing lines up', () => {
    const { lineWins, totalWin } = evaluator.evaluate(mid(['ace', 'ten', 'king', 'queen', 'cap']), 1);
    expect(lineWins).toHaveLength(0);
    expect(totalWin).toBe(0);
  });

  it('does not pay a line made entirely of wilds', () => {
    expect(evaluator.evaluate(mid(['wild', 'wild', 'wild', 'wild', 'wild']), 1).lineWins).toHaveLength(0);
  });
});
