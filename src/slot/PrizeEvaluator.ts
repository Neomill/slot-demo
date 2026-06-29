import type { SymbolId } from '../config/symbols';
import type { RNG } from '../core/rng';
import type { LineWin, PrizeCell } from '../types/slot';
import { PRIZE_VALUES, prizeConfig, isPrizeSymbol } from '../config/prizeConfig';

/**
 * Handles the Prize-symbol mechanic (Blue/Red/Gold), which pays by value rather
 * than the line paytable:
 *  - rolls a value for every Prize symbol on the board (deterministic via RNG),
 *  - main game: a payline with 3+ Prize symbols pays the sum of their values,
 *  - free spins: each Wild collects (pays) the total value of all Prize symbols.
 */
export class PrizeEvaluator {
  private readonly rng: RNG;
  private readonly paylines: number[][];

  constructor(rng: RNG, paylines: number[][]) {
    this.rng = rng;
    this.paylines = paylines;
  }

  /** Assign a rolled value to every Prize symbol on the board. */
  roll(grid: SymbolId[][]): PrizeCell[] {
    const cells: PrizeCell[] = [];
    for (let reel = 0; reel < grid.length; reel++) {
      for (let row = 0; row < grid[reel].length; row++) {
        const symbol = grid[reel][row];
        if (!isPrizeSymbol(symbol)) continue;
        const values = PRIZE_VALUES[symbol];
        const value = values[Math.floor(this.rng.next() * values.length)];
        cells.push({ reel, row, symbol, value });
      }
    }
    return cells;
  }

  /** Main game: each payline with enough Prize symbols pays the sum of values. */
  evaluateMainGame(prizes: PrizeCell[], betPerLine: number): LineWin[] {
    const wins: LineWin[] = [];
    this.paylines.forEach((line, index) => {
      const onLine = prizes.filter((p) => line[p.reel] === p.row);
      if (onLine.length < prizeConfig.minPrizesOnPaylineToPay) return;
      const total = onLine.reduce((sum, p) => sum + p.value, 0);
      wins.push({
        payline: index,
        symbol: highestPrize(onLine).symbol,
        count: onLine.length,
        positions: onLine.map((p) => ({ reel: p.reel, row: p.row })),
        amount: total * betPerLine,
        kind: 'prize',
      });
    });
    return wins;
  }

  /**
   * Free spins: each Wild collects and pays the total value of all Prize
   * symbols on the board. No Wild (or no prizes) -> nothing collected.
   */
  collect(prizes: PrizeCell[], wilds: number, betPerLine: number): number {
    if (wilds === 0 || prizes.length === 0) return 0;
    const total = prizes.reduce((sum, p) => sum + p.value, 0);
    return wilds * total * betPerLine;
  }
}

function highestPrize(prizes: PrizeCell[]): PrizeCell {
  return prizes.reduce((best, p) => (p.value > best.value ? p : best), prizes[0]);
}
