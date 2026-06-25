import { SYMBOLS, WILD } from '../config/symbols';
import { PAYLINES } from '../config/paylines';
import { PAYTABLE } from '../config/paytable';
import { gameConfig } from '../config/gameConfig';
import { InvalidSpinResultError } from '../core/errors';
import type { SpinResult } from '../types/slot';

const SYMBOL_SET = new Set<string>(SYMBOLS);

/**
 * Treats the provider as untrusted and verifies a spin result is internally
 * consistent before the engine acts on it: correct grid shape, known symbols,
 * payouts that match the paytable, and a totalWin that equals the sum of lines.
 * Throws InvalidSpinResultError on the first problem found.
 */
export function validateSpinResult(result: SpinResult, ctx: { betPerLine: number }): void {
  const { reels, rows } = gameConfig;
  const { grid, lineWins, totalWin } = result;

  if (!Array.isArray(grid) || grid.length !== reels) {
    throw new InvalidSpinResultError(`grid must have ${reels} reels, got ${grid?.length}`);
  }
  for (let reel = 0; reel < reels; reel++) {
    const column = grid[reel];
    if (!Array.isArray(column) || column.length !== rows) {
      throw new InvalidSpinResultError(`reel ${reel} must have ${rows} rows`);
    }
    for (const symbol of column) {
      if (!SYMBOL_SET.has(symbol)) {
        throw new InvalidSpinResultError(`unknown symbol "${symbol}" on reel ${reel}`);
      }
    }
  }

  let summed = 0;
  for (const win of lineWins) {
    if (win.payline < 0 || win.payline >= PAYLINES.length) {
      throw new InvalidSpinResultError(`payline index ${win.payline} out of range`);
    }
    if (win.count < 3 || win.count > reels) {
      throw new InvalidSpinResultError(`win count ${win.count} out of range`);
    }
    const expected = PAYTABLE[win.symbol]?.[win.count];
    if (expected === undefined) {
      throw new InvalidSpinResultError(`no payout for ${win.symbol} x${win.count}`);
    }
    const line = PAYLINES[win.payline];
    if (win.positions.length !== win.count) {
      throw new InvalidSpinResultError(`payline ${win.payline}: positions/count mismatch`);
    }
    for (let i = 0; i < win.positions.length; i++) {
      const pos = win.positions[i];
      if (pos.reel !== i || pos.row !== line[i]) {
        throw new InvalidSpinResultError(`payline ${win.payline}: bad position at reel ${i}`);
      }
      const symbol = grid[pos.reel][pos.row];
      if (symbol !== win.symbol && symbol !== WILD) {
        throw new InvalidSpinResultError(`payline ${win.payline}: symbol mismatch at reel ${i}`);
      }
    }
    if (win.amount !== expected * ctx.betPerLine) {
      throw new InvalidSpinResultError(
        `payline ${win.payline}: amount ${win.amount} != ${expected * ctx.betPerLine}`,
      );
    }
    summed += win.amount;
  }

  if (summed !== totalWin) {
    throw new InvalidSpinResultError(`totalWin ${totalWin} != sum of line wins ${summed}`);
  }
}
