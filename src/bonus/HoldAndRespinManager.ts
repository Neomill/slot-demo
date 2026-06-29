import type { SymbolId } from '../config/symbols';
import { BONUS } from '../config/symbols';
import { bonusConfig } from '../config/bonusConfig';
import { createMathRng, type RNG } from '../core/rng';

export interface HoldAndRespinSnapshot {
  board: SymbolId[][];
  locked: boolean[][];
  /** Lock state as it was *before* the most recent respin — cells that held in
   *  place. Anything locked now but not here is a trophy that just landed. */
  lockedBefore: boolean[][];
  /** Per-cell trophy value (a bet multiplier); 0 where there is no locked trophy. */
  values: number[][];
  remainingRespins: number;
  totalWin: number;
}

/**
 * Owns a Hold & Respin session: a board with locked bonus symbols, a respin
 * counter, and accumulated win. Locked cells stay; only empty cells respin. A
 * newly landed bonus symbol locks and resets the counter — otherwise it ticks
 * down. Each locked trophy carries a value (collected when the feature ends).
 * The feature ends when the counter hits zero or the whole board is trophies.
 */
export class HoldAndRespinManager {
  private board: SymbolId[][] = [];
  private locked: boolean[][] = [];
  private lockedBefore: boolean[][] = [];
  private values: number[][] = [];
  private remainingRespins = 0;
  private totalWin = 0;

  constructor(private readonly rng: RNG = createMathRng()) {}

  get isActive(): boolean {
    return this.remainingRespins > 0 && !this.isFull;
  }

  /** Every cell on the board holds a locked trophy — the feature is maxed out. */
  get isFull(): boolean {
    return this.locked.length > 0 && this.locked.every((column) => column.every(Boolean));
  }

  get currentBoard(): SymbolId[][] {
    return this.board;
  }

  get remaining(): number {
    return this.remainingRespins;
  }

  /** Begin the feature from the triggering board: lock and value every trophy. */
  start(grid: SymbolId[][]): void {
    this.board = grid.map((column) => [...column]);
    this.locked = grid.map((column) => column.map((symbol) => symbol === BONUS));
    this.lockedBefore = grid.map((column) => column.map(() => false));
    this.values = this.locked.map((column) => column.map((isLocked) => (isLocked ? this.rollValue() : 0)));
    this.remainingRespins = bonusConfig.holdAndRespin.initialRespins;
    this.totalWin = 0;
  }

  /**
   * Apply one respin. Only non-locked cells take the candidate symbols; newly
   * landed trophies lock (with a rolled value) and refill the counter, otherwise
   * it decrements. Returns the count and combined value of trophies that just
   * locked, so the caller can collect them as they land.
   */
  respin(candidate: SymbolId[][]): { newBonus: number; newTrophyValue: number } {
    this.lockedBefore = this.locked.map((column) => [...column]);
    let newBonus = 0;
    let newTrophyValue = 0;
    for (let reel = 0; reel < this.board.length; reel++) {
      for (let row = 0; row < this.board[reel].length; row++) {
        if (this.locked[reel][row]) continue;
        const symbol = candidate[reel][row];
        this.board[reel][row] = symbol;
        if (symbol === BONUS) {
          this.locked[reel][row] = true;
          this.values[reel][row] = this.rollValue();
          newTrophyValue += this.values[reel][row];
          newBonus += 1;
        }
      }
    }

    if (newBonus > 0) {
      this.refill();
    } else {
      this.remainingRespins -= 1;
    }
    return { newBonus, newTrophyValue };
  }

  /** Restore the respin counter to its reset value (a new trophy, or a win). */
  refill(): void {
    this.remainingRespins = bonusConfig.holdAndRespin.resetRespins;
  }

  /** Total of all locked trophy values (a bet multiplier) — collected at the end. */
  trophyTotal(): number {
    let total = 0;
    for (let reel = 0; reel < this.values.length; reel++) {
      for (let row = 0; row < this.values[reel].length; row++) {
        if (this.locked[reel][row]) total += this.values[reel][row];
      }
    }
    return total;
  }

  addWin(amount: number): void {
    this.totalWin += amount;
  }

  snapshot(): HoldAndRespinSnapshot {
    return {
      board: this.board.map((column) => [...column]),
      locked: this.locked.map((column) => [...column]),
      lockedBefore: this.lockedBefore.map((column) => [...column]),
      values: this.values.map((column) => [...column]),
      remainingRespins: this.remainingRespins,
      totalWin: this.totalWin,
    };
  }

  reset(): void {
    this.board = [];
    this.locked = [];
    this.lockedBefore = [];
    this.values = [];
    this.remainingRespins = 0;
    this.totalWin = 0;
  }

  private rollValue(): number {
    const values = bonusConfig.holdAndRespin.values;
    return values[Math.floor(this.rng.next() * values.length)];
  }
}
