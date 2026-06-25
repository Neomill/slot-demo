import type { SymbolId } from '../config/symbols';

export interface SpinRequest {
  betPerLine: number;
}

export interface Position {
  reel: number;
  row: number;
}

export interface LineWin {
  /** Index into PAYLINES. */
  payline: number;
  /** The base (non-wild) symbol that formed the win. */
  symbol: SymbolId;
  /** Number of matching reels, counted from the left. */
  count: number;
  /** The matched cells, for highlighting in the view layer. */
  positions: Position[];
  amount: number;
}

export interface SpinResult {
  /** Symbols laid out as grid[reel][row]. */
  grid: SymbolId[][];
  lineWins: LineWin[];
  totalWin: number;
}
