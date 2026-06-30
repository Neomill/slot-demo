import type { SymbolId } from '../config/symbols';
import type { GameMode } from '../core/GameMode';
import type { FreeSpinSnapshot } from '../bonus/FreeSpinManager';
import type { HoldAndRespinSnapshot } from '../bonus/HoldAndRespinManager';

export interface Position {
  reel: number;
  row: number;
}

export interface LineWin {
  /** Index into PAYLINES. */
  payline: number;
  symbol: SymbolId;
  count: number;
  positions: Position[];
  amount: number;
  /** 'line' = normal paytable win; 'prize' = summed Prize-symbol values. */
  kind: 'line' | 'prize';
}

/** A Prize symbol on the board with its rolled value (a multiplier of the bet). */
export interface PrizeCell {
  reel: number;
  row: number;
  symbol: SymbolId;
  value: number;
}

export interface SpinResult {
  /** Symbols laid out as grid[reel][row]. */
  grid: SymbolId[][];
  lineWins: LineWin[];
  /** Every Prize symbol on the board with its value (for display + collect). */
  prizes: PrizeCell[];
  /** Line win before any multiplier. */
  baseWin: number;
  /** Amount actually credited this spin (baseWin x multiplier). */
  totalWin: number;
  /** Active win multiplier (1 in base and hold & respin). */
  multiplier: number;
  mode: GameMode;
  scatterCount: number;
  bonusCount: number;
  /** Set on the base spin that triggered Free Spins. */
  triggeredFreeSpins?: number;
  /** Wilds counted on this Free Spin. */
  wildsCollected?: number;
  /** Free Spins: amount the Wild(s) collected from Prize symbols (pre-multiplier). */
  collectWin?: number;
  /**
   * Free Spins: set when the counter has emptied but completed panels still hold
   * queued +10 awards — the cue for the UI to play the activation/transfer
   * ceremony (see FreeSpinManager) before the next spin.
   */
  pendingActivation?: boolean;
  freeSpins?: FreeSpinSnapshot;
  holdAndRespin?: HoldAndRespinSnapshot;
}

/** A point-in-time view of the engine (the spec's GameState). */
export interface GameStateSnapshot {
  mode: GameMode;
  balance: number;
  currentBet: number;
  freeSpins?: FreeSpinSnapshot;
  holdAndRespin?: HoldAndRespinSnapshot;
}
