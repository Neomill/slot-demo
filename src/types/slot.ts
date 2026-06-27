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
}

export interface SpinResult {
  /** Symbols laid out as grid[reel][row]. */
  grid: SymbolId[][];
  lineWins: LineWin[];
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
  chance2x: boolean;
}
