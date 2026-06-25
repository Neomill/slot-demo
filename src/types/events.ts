import type { GameState } from '../core/GameState';
import type { SpinResult } from './slot';

/**
 * Single source of truth for event names. Reference these everywhere instead of
 * raw string literals — renaming an event is then a one-line change here.
 *
 * Implemented as an `as const` object rather than a TS `enum` on purpose:
 * string enums are nominal, so a member is NOT assignable to its matching
 * string-literal type. That would break the EventBus's `keyof`-based `on`/`emit`
 * typing. This keeps `GameEvent.BalanceChange` a plain `'balance:change'`
 * literal, so the typed bus still works.
 */
export const GameEvent = {
  StateChange: 'state:change',
  BalanceChange: 'balance:change',
  BetChange: 'bet:change',
  SpinStart: 'spin:start',
  SpinResult: 'spin:result',
  SpinSettled: 'spin:settled',
  SpinRejected: 'spin:rejected',
  SpinError: 'spin:error',
} as const;

export type GameEventName = (typeof GameEvent)[keyof typeof GameEvent];

export type BalanceReason = 'init' | 'bet' | 'win' | 'refund';
export type SpinRejectReason = 'insufficient_funds' | 'busy';

/**
 * Every event the engine can emit, mapped to its payload type. Keys are the
 * GameEvent values, so the map and the name constants can never drift apart.
 */
export type GameEventMap = {
  [GameEvent.StateChange]: { from: GameState; to: GameState };
  [GameEvent.BalanceChange]: { balance: number; delta: number; reason: BalanceReason };
  [GameEvent.BetChange]: { betPerLine: number; stake: number };
  [GameEvent.SpinStart]: { betPerLine: number; stake: number };
  [GameEvent.SpinResult]: { result: SpinResult };
  [GameEvent.SpinSettled]: { totalWin: number; balance: number };
  [GameEvent.SpinRejected]: { reason: SpinRejectReason };
  [GameEvent.SpinError]: { message: string };
};
