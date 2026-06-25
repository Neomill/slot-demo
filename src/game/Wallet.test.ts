import { describe, it, expect } from 'vitest';
import { Wallet } from './Wallet';
import { EventBus } from '../core/EventBus';
import { InsufficientFundsError } from '../core/errors';
import { GameEvent, type GameEventMap } from '../types/events';

describe('Wallet', () => {
  it('debits and credits, emitting each new balance', () => {
    const bus = new EventBus<GameEventMap>();
    const balances: number[] = [];
    bus.on(GameEvent.BalanceChange, ({ balance }) => balances.push(balance));

    const wallet = new Wallet(100, bus);
    wallet.debit(30, 'bet');
    expect(wallet.balance).toBe(70);
    wallet.credit(50, 'win');
    expect(wallet.balance).toBe(120);
    expect(balances).toEqual([70, 120]);
  });

  it('throws InsufficientFundsError and leaves the balance untouched', () => {
    const wallet = new Wallet(10);
    expect(() => wallet.debit(20)).toThrow(InsufficientFundsError);
    expect(wallet.balance).toBe(10);
  });

  it('reports affordability against the current balance', () => {
    const wallet = new Wallet(10);
    expect(wallet.canAfford(10)).toBe(true);
    expect(wallet.canAfford(11)).toBe(false);
  });
});
