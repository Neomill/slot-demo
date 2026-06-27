import type { GameState } from '../core/GameState';
import type { GameMode } from '../core/GameMode';
import type { SpinResult } from './slot';
import type { BuyBonusTier } from '../config/bonusConfig';

/**
 * Single source of truth for event names (see EventBus typing notes). Declared
 * as an `as const` object so each member is a plain string-literal type.
 */
export const GameEvent = {
  StateChange: 'state:change',
  ModeChange: 'mode:change',
  BalanceChange: 'balance:change',
  BetChange: 'bet:change',
  ChanceChange: 'chance:change',
  SpinStart: 'spin:start',
  SpinResult: 'spin:result',
  SpinSettled: 'spin:settled',
  SpinRejected: 'spin:rejected',
  SpinError: 'spin:error',
  FreeSpinsStart: 'freespins:start',
  FreeSpinsEnd: 'freespins:end',
  WildsCollected: 'wilds:collected',
  HoldRespinStart: 'holdrespin:start',
  HoldRespinUpdate: 'holdrespin:update',
  HoldRespinEnd: 'holdrespin:end',
  BonusBought: 'bonus:bought',
} as const;

export type GameEventName = (typeof GameEvent)[keyof typeof GameEvent];

export type BalanceReason = 'init' | 'bet' | 'win' | 'refund';
export type SpinRejectReason = 'insufficient_funds' | 'busy';

/**
 * Every event the engine can emit, mapped to its payload type. Keys are the
 * GameEvent values so the map and the constants can never drift apart.
 */
export type GameEventMap = {
  [GameEvent.StateChange]: { from: GameState; to: GameState };
  [GameEvent.ModeChange]: { from: GameMode; to: GameMode };
  [GameEvent.BalanceChange]: { balance: number; delta: number; reason: BalanceReason };
  [GameEvent.BetChange]: { betPerLine: number; stake: number };
  [GameEvent.ChanceChange]: { enabled: boolean };
  [GameEvent.SpinStart]: { betPerLine: number; stake: number };
  [GameEvent.SpinResult]: { result: SpinResult };
  [GameEvent.SpinSettled]: { totalWin: number; balance: number };
  [GameEvent.SpinRejected]: { reason: SpinRejectReason };
  [GameEvent.SpinError]: { message: string };
  [GameEvent.FreeSpinsStart]: { spins: number; trigger: 'scatter' | 'buy' };
  [GameEvent.FreeSpinsEnd]: { totalWin: number };
  [GameEvent.WildsCollected]: { count: number; wildCounter: number; multiplier: number; awardedSpins: number };
  [GameEvent.HoldRespinStart]: { respins: number; lockedBonus: number };
  [GameEvent.HoldRespinUpdate]: { remainingRespins: number; newBonus: number; lockedBonus: number };
  [GameEvent.HoldRespinEnd]: { totalWin: number };
  [GameEvent.BonusBought]: { tier: BuyBonusTier; cost: number; spins: number };
};
