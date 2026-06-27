import { describe, it, expect } from 'vitest';
import { Game } from './Game';
import { GameMode } from '../core/GameMode';
import { GameState } from '../core/GameState';
import { GameEvent } from '../types/events';
import { ReelGenerator } from '../slot/ReelGenerator';
import { createSeededRng } from '../core/rng';
import type { ReelSetId } from '../config/reelStrips';
import type { SymbolId } from '../config/symbols';

/** A reel grid with no payline win and no scatter/bonus/wild. */
function blank(): SymbolId[][] {
  return [
    ['cherry', 'lemon', 'orange'],
    ['lemon', 'bar', 'plum'],
    ['seven', 'bell', 'bar'],
    ['bell', 'seven', 'cherry'],
    ['bar', 'plum', 'seven'],
  ];
}

function withCells(base: SymbolId[][], cells: Array<[number, number, SymbolId]>): SymbolId[][] {
  const grid = base.map((column) => [...column]);
  for (const [reel, row, symbol] of cells) grid[reel][row] = symbol;
  return grid;
}

/** A ReelGenerator stub returning fixed grids per set (fresh clones each call). */
function reelStub(map: Partial<Record<ReelSetId, SymbolId[][]>>): ReelGenerator {
  return {
    generate: (setId: ReelSetId) => (map[setId] ?? blank()).map((column) => [...column]),
  } as unknown as ReelGenerator;
}

// Middle payline = seven x3 -> 20 * betPerLine; no other line/scatter/bonus.
const SEVEN_WIN: SymbolId[][] = [
  ['cherry', 'seven', 'bar'],
  ['lemon', 'seven', 'orange'],
  ['bell', 'seven', 'plum'],
  ['orange', 'cherry', 'bell'],
  ['plum', 'lemon', 'cherry'],
];

describe('Game — base mode', () => {
  it('deducts the stake, credits the line win, stays in BASE', async () => {
    const game = new Game({ reelGenerator: reelStub({ base: SEVEN_WIN }), startingBalance: 100, betPerLine: 1 });
    await game.init();
    const result = await game.spin();
    expect(result?.totalWin).toBe(20);
    expect(game.balance).toBe(100 - 5 + 20);
    expect(game.currentMode).toBe(GameMode.BASE);
    expect(game.currentState).toBe(GameState.IDLE);
  });

  it('rejects a spin it cannot afford', async () => {
    const game = new Game({ reelGenerator: reelStub({}), startingBalance: 3, betPerLine: 1 });
    await game.init();
    let reason: string | null = null;
    game.events.on(GameEvent.SpinRejected, (e) => (reason = e.reason));
    const result = await game.spin();
    expect(result).toBeNull();
    expect(reason).toBe('insufficient_funds');
    expect(game.balance).toBe(3);
  });

  it('Chance x2 doubles the cost and uses the chance2x reels', async () => {
    let usedSet: ReelSetId | null = null;
    const reels = {
      generate: (setId: ReelSetId) => {
        usedSet = setId;
        return blank().map((c) => [...c]);
      },
    } as unknown as ReelGenerator;
    const game = new Game({ reelGenerator: reels, startingBalance: 100, betPerLine: 1 });
    await game.init();
    game.setChance2x(true);
    expect(game.spinCost).toBe(10);
    await game.spin();
    expect(usedSet).toBe('chance2x');
    expect(game.balance).toBe(90);
  });
});

describe('Game — free spins', () => {
  it('3 scatters trigger 10 free spins', async () => {
    const baseGrid = withCells(blank(), [
      [0, 0, 'scatter'],
      [2, 1, 'scatter'],
      [4, 2, 'scatter'],
    ]);
    const game = new Game({ reelGenerator: reelStub({ base: baseGrid }), startingBalance: 100, betPerLine: 1 });
    await game.init();
    const result = await game.spin();
    expect(result?.triggeredFreeSpins).toBe(10);
    expect(game.currentMode).toBe(GameMode.FREE_SPINS);
    expect(game.getState().freeSpins?.remaining).toBe(10);
  });

  it('free spins do not deduct and exit to BASE at zero', async () => {
    const game = new Game({ reelGenerator: reelStub({ freeSpins: blank() }), startingBalance: 1000, betPerLine: 1 });
    await game.init();
    game.buyBonus('super'); // 75 * 5 = 375
    expect(game.balance).toBe(625);
    expect(game.getState().freeSpins?.remaining).toBe(10);
    for (let i = 0; i < 10; i++) await game.spin();
    expect(game.balance).toBe(625); // blank free spins win nothing, cost nothing
    expect(game.currentMode).toBe(GameMode.BASE);
  });

  it('collecting 4 wilds steps the multiplier to x2 and awards +10 spins', async () => {
    const fsWild = withCells(blank(), [
      [0, 0, 'wild'],
      [0, 2, 'wild'],
      [1, 0, 'wild'],
      [1, 2, 'wild'],
    ]);
    const game = new Game({ reelGenerator: reelStub({ freeSpins: fsWild }), startingBalance: 1000, betPerLine: 1 });
    await game.init();
    game.buyBonus('mega');
    const result = await game.spin();
    expect(result?.multiplier).toBe(2);
    expect(result?.totalWin).toBe((result?.baseWin ?? 0) * 2);
    expect(game.getState().freeSpins?.wildCounter).toBe(4);
    expect(game.getState().freeSpins?.remaining).toBe(19); // 10 - 1 consumed + 10 awarded
  });
});

describe('Game — hold & respin', () => {
  it('6 bonus symbols trigger hold & respin and end at zero respins', async () => {
    const trigger = withCells(blank(), [
      [0, 0, 'bonus'],
      [1, 0, 'bonus'],
      [2, 0, 'bonus'],
      [3, 0, 'bonus'],
      [4, 0, 'bonus'],
      [0, 1, 'bonus'],
    ]);
    const game = new Game({
      reelGenerator: reelStub({ base: trigger, holdAndRespin: blank() }),
      startingBalance: 100,
      betPerLine: 1,
    });
    await game.init();
    await game.spin(); // base spin triggers
    expect(game.currentMode).toBe(GameMode.HOLD_AND_RESPIN);
    expect(game.getState().holdAndRespin?.remainingRespins).toBe(3);
    // blank respins add no new bonus -> 3 respins to exit
    for (let i = 0; i < 3; i++) await game.spin();
    expect(game.currentMode).toBe(GameMode.BASE);
  });
});

describe('Game — determinism', () => {
  it('produces identical grids for the same seed', async () => {
    const make = () => new Game({ rng: createSeededRng(2025), startingBalance: 100000, betPerLine: 1 });
    const a = make();
    const b = make();
    await a.init();
    await b.init();
    const gridsA: SymbolId[][][] = [];
    const gridsB: SymbolId[][][] = [];
    for (let i = 0; i < 8; i++) {
      gridsA.push((await a.spin())!.grid);
      gridsB.push((await b.spin())!.grid);
    }
    expect(gridsA).toEqual(gridsB);
  });
});
