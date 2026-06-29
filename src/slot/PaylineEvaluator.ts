import type { SymbolId } from '../config/symbols';
import type { PayTable } from '../config/paytable';
import type { LineWin, Position } from '../types/slot';

export interface EvaluatorConfig {
  paylines: number[][];
  paytable: PayTable;
  wild: SymbolId;
}

/**
 * Pure, deterministic payline evaluation. For each line it counts matching
 * symbols left-to-right from reel 0; wilds substitute for the line's base
 * symbol. Pays on 3+ matches using the paytable. A line of only wilds pays
 * nothing — wilds substitute but have no payout of their own.
 */
export class PaylineEvaluator {
  private readonly paylines: number[][];
  private readonly paytable: PayTable;
  private readonly wild: SymbolId;

  constructor(config: EvaluatorConfig) {
    this.paylines = config.paylines;
    this.paytable = config.paytable;
    this.wild = config.wild;
  }

  evaluate(grid: SymbolId[][], betPerLine: number): { lineWins: LineWin[]; totalWin: number } {
    const lineWins: LineWin[] = [];
    this.paylines.forEach((line, index) => {
      const win = this.evaluateLine(grid, line, index, betPerLine);
      if (win) lineWins.push(win);
    });
    const totalWin = lineWins.reduce((sum, win) => sum + win.amount, 0);
    return { lineWins, totalWin };
  }

  private evaluateLine(
    grid: SymbolId[][],
    line: number[],
    index: number,
    betPerLine: number,
  ): LineWin | null {
    let base: SymbolId | null = null;
    let count = 0;

    for (let reel = 0; reel < line.length; reel++) {
      const symbol = grid[reel][line[reel]];
      if (symbol === this.wild) {
        count++;
        continue;
      }
      if (base === null) {
        base = symbol;
        count++;
        continue;
      }
      if (symbol === base) {
        count++;
        continue;
      }
      break;
    }

    // All wilds, or fewer than the minimum match — no payout.
    if (base === null) return null;
    const multiplier = this.paytable[base]?.[count];
    if (count < 3 || multiplier === undefined) return null;

    const positions: Position[] = [];
    for (let reel = 0; reel < count; reel++) {
      positions.push({ reel, row: line[reel] });
    }

    return { payline: index, symbol: base, count, positions, amount: multiplier * betPerLine, kind: 'line' };
  }
}
