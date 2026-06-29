import { describe, it, expect } from 'vitest';
import { planAnticipation } from './anticipation';
import type { SymbolId } from '../config/symbols';

const S: SymbolId = 'bonus'; // the Scatter
const X: SymbolId = 'ace'; // any non-Scatter

/** Build a 5x3 board from per-reel scatter rows; everything else is `X`. */
function board(scatterRowsByReel: number[][]): SymbolId[][] {
  return scatterRowsByReel.map((rows) => {
    const col: SymbolId[] = [X, X, X];
    for (const r of rows) col[r] = S;
    return col;
  });
}

describe('planAnticipation', () => {
  it('teases from the reel after the 2nd scatter to the reel that completes it', () => {
    // Scatters on reels 0, 1, 4 → tease reels 2, 3, 4; 4 lands the trigger.
    const plan = planAnticipation(board([[1], [1], [], [], [1]]), S, 5);
    expect(plan).not.toBeNull();
    expect(plan!.twoAt).toBe(1);
    expect(plan!.triggerReel).toBe(4);
    expect(plan!.anticipationReels).toEqual([2, 3, 4]);
  });

  it('matches the spec example: scatters on reels 0 and 1, trigger on reel 2', () => {
    const plan = planAnticipation(board([[0], [0], [2], [], []]), S, 5);
    expect(plan!.twoAt).toBe(1);
    expect(plan!.triggerReel).toBe(2);
    expect(plan!.anticipationReels).toEqual([2]);
  });

  it('teases to the last reel when only two scatters ever land (a near miss)', () => {
    const plan = planAnticipation(board([[1], [1], [], [], []]), S, 5);
    expect(plan!.twoAt).toBe(1);
    expect(plan!.triggerReel).toBe(-1);
    expect(plan!.anticipationReels).toEqual([2, 3, 4]);
  });

  it('handles two scatters stacked on a single reel', () => {
    const plan = planAnticipation(board([[], [0, 2], [], [3], []]), S, 5);
    expect(plan!.twoAt).toBe(1);
    expect(plan!.anticipationReels).toEqual([2, 3]);
    expect(plan!.scatterRowsByReel[1]).toEqual([0, 2]);
  });

  it('returns null below two scatters', () => {
    expect(planAnticipation(board([[1], [], [], [], []]), S, 5)).toBeNull();
    expect(planAnticipation(board([[], [], [], [], []]), S, 5)).toBeNull();
  });

  it('returns null when the second scatter lands on the final reel', () => {
    expect(planAnticipation(board([[1], [], [], [], [1]]), S, 5)).toBeNull();
  });

  it('returns null when the count jumps straight past two (an instant hit)', () => {
    // Three on reel 0, then more — reads as an instant trigger, no build-up.
    expect(planAnticipation(board([[0, 1, 2], [], [], [], []]), S, 5)).toBeNull();
    // 0 → 3 across reels 0/1 with reel 1 holding two while reel 0 holds one.
    expect(planAnticipation(board([[0], [0, 1], [], [], []]), S, 5)).toBeNull();
  });
});
