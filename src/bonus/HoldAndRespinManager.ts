import type { SymbolId } from '../config/symbols';
import { BONUS } from '../config/symbols';
import { bonusConfig } from '../config/bonusConfig';

export interface HoldAndRespinSnapshot {
  board: SymbolId[][];
  locked: boolean[][];
  remainingRespins: number;
  totalWin: number;
}

/**
 * Owns a Hold & Respin session: a board with locked bonus symbols, a respin
 * counter, and accumulated win. Locked cells stay; only empty cells respin. A
 * newly landed bonus symbol locks and resets the counter — otherwise it ticks
 * down. The feature ends when the counter hits zero.
 */
export class HoldAndRespinManager {
  private board: SymbolId[][] = [];
  private locked: boolean[][] = [];
  private remainingRespins = 0;
  private totalWin = 0;

  get isActive(): boolean {
    return this.remainingRespins > 0;
  }

  get currentBoard(): SymbolId[][] {
    return this.board;
  }

  get remaining(): number {
    return this.remainingRespins;
  }

  /** Begin the feature from the triggering board: lock every bonus symbol. */
  start(grid: SymbolId[][]): void {
    this.board = grid.map((column) => [...column]);
    this.locked = grid.map((column) => column.map((symbol) => symbol === BONUS));
    this.remainingRespins = bonusConfig.holdAndRespin.initialRespins;
    this.totalWin = 0;
  }

  /**
   * Apply one respin. Only non-locked cells take the candidate symbols; newly
   * landed bonus symbols lock and reset the counter, otherwise it decrements.
   */
  respin(candidate: SymbolId[][]): { newBonus: number } {
    let newBonus = 0;
    for (let reel = 0; reel < this.board.length; reel++) {
      for (let row = 0; row < this.board[reel].length; row++) {
        if (this.locked[reel][row]) continue;
        const symbol = candidate[reel][row];
        this.board[reel][row] = symbol;
        if (symbol === BONUS) {
          this.locked[reel][row] = true;
          newBonus += 1;
        }
      }
    }

    if (newBonus > 0) {
      this.remainingRespins = bonusConfig.holdAndRespin.resetRespins;
    } else {
      this.remainingRespins -= 1;
    }
    return { newBonus };
  }

  addWin(amount: number): void {
    this.totalWin += amount;
  }

  snapshot(): HoldAndRespinSnapshot {
    return {
      board: this.board.map((column) => [...column]),
      locked: this.locked.map((column) => [...column]),
      remainingRespins: this.remainingRespins,
      totalWin: this.totalWin,
    };
  }

  reset(): void {
    this.board = [];
    this.locked = [];
    this.remainingRespins = 0;
    this.totalWin = 0;
  }
}
