import { describe, it, expect } from 'vitest';
import { Game } from './Game';
import { GameMode } from '../core/GameMode';
import { GameState } from '../core/GameState';
import { GameEvent } from '../types/events';
import { ReelGenerator } from '../slot/ReelGenerator';
import { createSeededRng } from '../core/rng';
import type { ReelSetId } from '../config/reelStrips';
import type { SymbolId } from '../config/symbols';

/** A reel grid with no line win and no prize/scatter/trophy/wild symbols. */
function blank(): SymbolId[][] {
  return [
    ['ace', 'jocky', 'cap'],
    ['jocky', 'cap', 'binoculars'],
    ['ten', 'king', 'jack'],
    ['king', 'ten', 'queen'],
    ['jack', 'queen', 'ace'],
  ];
}

function withCells(base: SymbolId[][], cells: Array<[number, number, SymbolId]>): SymbolId[][] {
  const grid = base.map((column) => [...column]);
  for (const [reel, row, symbol] of cells) grid[reel][row] = symbol;
  return grid;
}

function reelStub(map: Partial<Record<ReelSetId, SymbolId[][]>>): ReelGenerator {
  return {
    generate: (setId: ReelSetId) => (map[setId] ?? blank()).map((column) => [...column]),
  } as unknown as ReelGenerator;
}

// Middle payline = jocky x3 -> 15 * betPerLine; no other line wins.
const JOCKY_WIN: SymbolId[][] = [
  ['ace', 'jocky', 'king'],
  ['ten', 'jocky', 'queen'],
  ['king', 'jocky', 'cap'],
  ['queen', 'ace', 'binoculars'],
  ['shoehorse', 'ten', 'king'],
];

describe('Game — base mode', () => {
  it('deducts the stake, credits the line win, stays in BASE', async () => {
    const game = new Game({ reelGenerator: reelStub({ base: JOCKY_WIN }), startingBalance: 1000, betPerLine: 1 });
    await game.init();
    const stake = game.currentBet;
    const result = await game.spin();
    expect(result?.totalWin).toBe(15);
    expect(game.balance).toBe(1000 - stake + 15);
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

  it('Chance x2 adds a 50% surcharge and uses the chance2x reels', async () => {
    let usedSet: ReelSetId | null = null;
    const reels = {
      generate: (setId: ReelSetId) => {
        usedSet = setId;
        return blank().map((c) => [...c]);
      },
    } as unknown as ReelGenerator;
    const game = new Game({ reelGenerator: reels, startingBalance: 1000, betPerLine: 1 });
    await game.init();
    game.setChance2x(true);
    expect(game.spinCost).toBe(game.currentBet * 1.5);
    const cost = game.spinCost;
    await game.spin();
    expect(usedSet).toBe('chance2x');
    expect(game.balance).toBe(1000 - cost);
  });
});

describe('Game — prize symbols', () => {
  it('pays the summed Prize value when 3+ prizes land on a payline', async () => {
    const grid = withCells(blank(), [
      [0, 1, 'goldhorse'],
      [1, 1, 'redhorse'],
      [2, 1, 'bluehorse'],
    ]);
    const game = new Game({
      reelGenerator: reelStub({ base: grid }),
      rng: createSeededRng(1),
      startingBalance: 1000,
      betPerLine: 1,
    });
    await game.init();
    const result = await game.spin();
    const prizeWin = result?.lineWins.find((w) => w.kind === 'prize');
    expect(prizeWin?.count).toBe(3);
    const sum = result!.prizes.reduce((s, p) => s + p.value, 0);
    expect(prizeWin?.amount).toBeCloseTo(sum);
    expect(result?.totalWin).toBeCloseTo(sum);
  });

  it('Wilds collect Prize values during free spins', async () => {
    const fsGrid = withCells(blank(), [
      [1, 1, 'wild'],
      [2, 0, 'goldhorse'],
      [3, 1, 'redhorse'],
    ]);
    const game = new Game({
      reelGenerator: reelStub({ freeSpins: fsGrid }),
      rng: createSeededRng(2),
      startingBalance: 100000,
      betPerLine: 1,
    });
    await game.init();
    game.buyBonus('mega');
    const result = await game.spin();
    const sum = result!.prizes.reduce((s, p) => s + p.value, 0);
    expect(result?.collectWin).toBeGreaterThan(0);
    expect(result?.collectWin).toBeCloseTo(sum); // 1 wild x total
  });
});

describe('Game — free spins', () => {
  it('free spins do not deduct and exit to BASE at zero', async () => {
    const game = new Game({ reelGenerator: reelStub({ freeSpins: blank() }), startingBalance: 100000, betPerLine: 1 });
    await game.init();
    const before = game.balance;
    game.buyBonus('super');
    const afterBuy = game.balance;
    expect(afterBuy).toBeLessThan(before); // a cost was deducted
    expect(game.getState().freeSpins?.remaining).toBe(10);
    for (let i = 0; i < 10; i++) await game.spin();
    expect(game.balance).toBe(afterBuy); // free spins win nothing here, cost nothing
    expect(game.currentMode).toBe(GameMode.BASE);
  });

  it('pays free-spin winnings only when the feature ends', async () => {
    const game = new Game({
      reelGenerator: reelStub({ freeSpins: JOCKY_WIN }),
      startingBalance: 100000,
      betPerLine: 1,
    });
    await game.init();
    game.buyBonus('super'); // 10 free spins
    const afterBuy = game.balance;
    await game.spin(); // wins, but the win is not paid yet
    expect(game.getState().freeSpins?.totalWin).toBeGreaterThan(0);
    expect(game.balance).toBe(afterBuy); // balance unchanged mid-feature
    for (let i = 0; i < 9; i++) await game.spin(); // finish the remaining spins
    expect(game.currentMode).toBe(GameMode.BASE);
    expect(game.balance).toBeGreaterThan(afterBuy); // paid in one lump at the end
  });

  it('collecting 4 wilds steps the multiplier to x2 and queues a +10 award', async () => {
    const fsWild = withCells(blank(), [
      [0, 0, 'wild'],
      [0, 2, 'wild'],
      [1, 0, 'wild'],
      [1, 2, 'wild'],
    ]);
    const game = new Game({ reelGenerator: reelStub({ freeSpins: fsWild }), startingBalance: 100000, betPerLine: 1 });
    await game.init();
    game.buyBonus('mega');
    const result = await game.spin();
    expect(result?.multiplier).toBe(2);
    expect(result?.totalWin).toBeCloseTo((result?.baseWin ?? 0) * 2);
    expect(game.getState().freeSpins?.wildCounter).toBe(4);
    // The +10 is queued, not added to the counter — only the consumed spin shows.
    expect(game.getState().freeSpins?.remaining).toBe(9);
    expect(game.getState().freeSpins?.queuedPanels).toBe(1);
    expect(game.hasQueuedFreeSpins).toBe(true);
  });

  it('queued awards are transferred to the counter at the end of the session', async () => {
    const fsWild = withCells(blank(), [
      [0, 0, 'wild'],
      [0, 2, 'wild'],
      [1, 0, 'wild'],
      [1, 2, 'wild'],
    ]);
    // Buy 'super' = 10 initial spins; the first spin collects 4 wilds (queues a
    // panel), then we drain the rest — the session stays alive on the queued award.
    const game = new Game({ reelGenerator: reelStub({ freeSpins: fsWild }), startingBalance: 100000, betPerLine: 1 });
    await game.init();
    game.buyBonus('super');
    let result = await game.spin(); // 1st of 10: collects wilds, queues a panel
    for (let i = 0; i < 9; i++) result = await game.spin(); // drain the rest to 0
    expect(game.getState().freeSpins?.remaining).toBe(0);
    expect(result?.pendingActivation).toBe(true);
    expect(game.currentMode).toBe(GameMode.FREE_SPINS); // not ended — award pending

    const award = game.activateQueuedFreeSpins();
    expect(award).toEqual({ panelIndex: 0, added: 10 });
    expect(game.getState().freeSpins?.remaining).toBe(10);
  });

  it('3 scatters (bonus) trigger 10 free spins', async () => {
    const baseGrid = withCells(blank(), [
      [0, 0, 'bonus'],
      [2, 1, 'bonus'],
      [4, 2, 'bonus'],
    ]);
    const game = new Game({ reelGenerator: reelStub({ base: baseGrid }), startingBalance: 1000, betPerLine: 1 });
    await game.init();
    const result = await game.spin();
    expect(result?.triggeredFreeSpins).toBe(10);
    expect(game.currentMode).toBe(GameMode.FREE_SPINS);
  });
});

describe('Game — hold & respin', () => {
  it('5 trophies trigger hold & respin and it ends at zero respins', async () => {
    const trigger = withCells(blank(), [
      [0, 0, 'trophy'],
      [1, 0, 'trophy'],
      [2, 0, 'trophy'],
      [3, 0, 'trophy'],
      [4, 0, 'trophy'],
    ]);
    const game = new Game({
      reelGenerator: reelStub({ base: trigger, holdAndRespin: blank() }),
      startingBalance: 1000,
      betPerLine: 1,
    });
    await game.init();
    await game.spin();
    expect(game.currentMode).toBe(GameMode.HOLD_AND_RESPIN);
    expect(game.getState().holdAndRespin?.remainingRespins).toBe(3);
    for (let i = 0; i < 3; i++) await game.spin();
    expect(game.currentMode).toBe(GameMode.BASE);
  });

  it('collects trophy values and ends when the board fills with trophies', async () => {
    const trigger = withCells(blank(), [
      [0, 0, 'trophy'],
      [1, 0, 'trophy'],
      [2, 0, 'trophy'],
      [3, 0, 'trophy'],
      [4, 0, 'trophy'],
    ]);
    const allTrophies = Array.from({ length: 5 }, () => ['trophy', 'trophy', 'trophy'] as SymbolId[]);
    const game = new Game({
      reelGenerator: reelStub({ base: trigger, holdAndRespin: allTrophies }),
      rng: createSeededRng(1),
      startingBalance: 1000,
      betPerLine: 1,
    });
    await game.init();
    await game.spin(); // trigger H&R (winnings accumulate, not yet paid)
    expect(game.currentMode).toBe(GameMode.HOLD_AND_RESPIN);
    const before = game.balance;
    const result = await game.spin(); // fills the board -> ends and pays out
    expect(result?.collectWin).toBeGreaterThan(0);
    expect(game.currentMode).toBe(GameMode.BASE);
    // The whole session total (every trophy) is paid in one lump when it ends.
    const sessionTotal = result?.holdAndRespin?.totalWin ?? 0;
    expect(sessionTotal).toBeGreaterThan(result?.collectWin ?? 0);
    expect(game.balance).toBe(before + sessionTotal);
  });

  it('refills the respins to 3 on a winning respin, even with no new trophy', async () => {
    const trigger = withCells(blank(), [
      [0, 0, 'trophy'],
      [1, 0, 'trophy'],
      [2, 0, 'trophy'],
      [3, 0, 'trophy'],
      [4, 0, 'trophy'],
    ]);
    // The trophies lock row 0; JOCKY_WIN wins on the middle row with no trophy.
    const game = new Game({
      reelGenerator: reelStub({ base: trigger, holdAndRespin: JOCKY_WIN }),
      startingBalance: 1000,
      betPerLine: 1,
    });
    await game.init();
    await game.spin(); // trigger -> 3 respins
    expect(game.getState().holdAndRespin?.remainingRespins).toBe(3);
    const result = await game.spin(); // winning respin, no new trophy
    expect(result?.totalWin).toBeGreaterThan(0);
    expect(result?.bonusCount).toBe(5); // no new trophy locked
    expect(game.getState().holdAndRespin?.remainingRespins).toBe(3); // refilled, not 2
  });
});

describe('Game — determinism', () => {
  it('produces identical grids for the same seed', async () => {
    const make = () => new Game({ rng: createSeededRng(2025), startingBalance: 1000000, betPerLine: 1 });
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
