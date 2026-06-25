import { InsufficientFundsError } from '../core/errors';
import type { EventBus } from '../core/EventBus';
import { GameEvent, type GameEventMap, type BalanceReason } from '../types/events';

/**
 * Owns the player's balance. The only way money moves is debit/credit, and a
 * debit that can't be covered throws rather than going negative. Emits
 * `balance:change` so the view can render the balance without polling.
 */
export class Wallet {
  private _balance: number;
  private readonly events?: EventBus<GameEventMap>;

  constructor(startingBalance: number, events?: EventBus<GameEventMap>) {
    this._balance = startingBalance;
    this.events = events;
  }

  get balance(): number {
    return this._balance;
  }

  canAfford(amount: number): boolean {
    return this._balance >= amount;
  }

  debit(amount: number, reason: BalanceReason = 'bet'): void {
    if (amount < 0) throw new Error('debit amount must be non-negative');
    if (!this.canAfford(amount)) throw new InsufficientFundsError(amount, this._balance);
    this._balance -= amount;
    this.events?.emit(GameEvent.BalanceChange, { balance: this._balance, delta: -amount, reason });
  }

  credit(amount: number, reason: BalanceReason = 'win'): void {
    if (amount < 0) throw new Error('credit amount must be non-negative');
    this._balance += amount;
    this.events?.emit(GameEvent.BalanceChange, { balance: this._balance, delta: amount, reason });
  }
}
