import { describe, it, expect } from 'vitest';
import { Game } from './Game';
import { GameState } from '../core/GameState';
import { PaylineEvaluator } from '../slot/PaylineEvaluator';
import { PAYLINES } from '../config/paylines';
import { PAYTABLE } from '../config/paytable';
import { WILD } from '../config/symbols';
import type { SpinProvider } from '../slot/SpinProvider';
import type { SpinResult } from '../types/slot';
import type { SymbolId } from '../config/symbols';
import { GameEvent } from '../types/events';

const evaluator = new PaylineEvaluator({ paylines: PAYLINES, paytable: PAYTABLE, wild: WILD });

// Middle payline = seven x3 -> 20 * betPerLine; no other line wins.
const WINNING_GRID: SymbolId[][] = [
  ['cherry', 'seven', 'bar'],
  ['lemon', 'seven', 'orange'],
  ['bell', 'seven', 'plum'],
  ['orange', 'cherry', 'bell'],
  ['plum', 'lemon', 'cherry'],
];

/** Provider that always returns a self-consistent result for a fixed grid. */
class FixedProvider implements SpinProvider {
  constructor(private readonly grid: SymbolId[][]) {}
  async spin({ betPerLine }: { betPerLine: number }): Promise<SpinResult> {
    const { lineWins, totalWin } = evaluator.evaluate(this.grid, betPerLine);
    return { grid: this.grid, lineWins, totalWin };
  }
}

describe('Game flow', () => {
  it('runs a winning spin: deducts the stake, credits the win, returns to IDLE', async () => {
    const game = new Game({ provider: new FixedProvider(WINNING_GRID), startingBalance: 100, betPerLine: 1 });
    await game.init();
    expect(game.currentState).toBe(GameState.IDLE);

    const stake = game.stake; // 1 * 5 paylines
    const result = await game.spin();

    expect(result).not.toBeNull();
    expect(result?.totalWin).toBe(20);
    expect(game.balance).toBe(100 - stake + 20);
    expect(game.currentState).toBe(GameState.IDLE);
  });

  it('rejects a spin when the balance cannot cover the stake', async () => {
    const game = new Game({ provider: new FixedProvider(WINNING_GRID), startingBalance: 3, betPerLine: 1 });
    await game.init();

    let rejectedReason: string | null = null;
    game.events.on(GameEvent.SpinRejected, ({ reason }) => (rejectedReason = reason));

    const result = await game.spin();
    expect(result).toBeNull();
    expect(rejectedReason).toBe('insufficient_funds');
    expect(game.balance).toBe(3);
    expect(game.currentState).toBe(GameState.IDLE);
  });

  it('rejects a second spin while one is in progress', async () => {
    let resolveSpin!: (result: SpinResult) => void;
    const pending = new Promise<SpinResult>((resolve) => {
      resolveSpin = resolve;
    });
    const provider: SpinProvider = { spin: () => pending };

    const game = new Game({ provider, startingBalance: 100, betPerLine: 1 });
    await game.init();

    let rejectedReason: string | null = null;
    game.events.on(GameEvent.SpinRejected, ({ reason }) => (rejectedReason = reason));

    const first = game.spin();
    expect(game.currentState).toBe(GameState.SPINNING);

    const second = await game.spin();
    expect(second).toBeNull();
    expect(rejectedReason).toBe('busy');

    const fixed = evaluator.evaluate(WINNING_GRID, 1);
    resolveSpin({ grid: WINNING_GRID, lineWins: fixed.lineWins, totalWin: fixed.totalWin });
    await first;
    expect(game.currentState).toBe(GameState.IDLE);
  });

  it('refunds the stake and recovers to IDLE when the provider throws', async () => {
    const provider: SpinProvider = {
      spin: async () => {
        throw new Error('network down');
      },
    };
    const game = new Game({ provider, startingBalance: 100, betPerLine: 1 });
    await game.init();

    let errorMessage: string | null = null;
    game.events.on(GameEvent.SpinError, ({ message }) => (errorMessage = message));

    const result = await game.spin();
    expect(result).toBeNull();
    expect(errorMessage).toContain('network down');
    expect(game.balance).toBe(100); // refunded
    expect(game.currentState).toBe(GameState.IDLE);
  });

  it('rejects an invalid provider result and refunds', async () => {
    // totalWin claims 999 but there are no line wins to back it up
    const provider: SpinProvider = {
      spin: async () => ({ grid: WINNING_GRID, lineWins: [], totalWin: 999 }),
    };
    const game = new Game({ provider, startingBalance: 100, betPerLine: 1 });
    await game.init();

    const result = await game.spin();
    expect(result).toBeNull();
    expect(game.balance).toBe(100); // refunded
    expect(game.currentState).toBe(GameState.IDLE);
  });
});
