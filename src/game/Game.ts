import { EventBus } from '../core/EventBus';
import { StateMachine } from '../core/StateMachine';
import { GameState } from '../core/GameState';
import { Wallet } from './Wallet';
import { MockSpinProvider } from '../slot/MockSpinProvider';
import { validateSpinResult } from '../slot/resultValidation';
import { PAYLINES } from '../config/paylines';
import { gameConfig } from '../config/gameConfig';
import { GameEvent, type GameEventMap } from '../types/events';
import type { SpinProvider } from '../slot/SpinProvider';
import type { SpinResult } from '../types/slot';

export interface GameOptions {
  provider?: SpinProvider;
  startingBalance?: number;
  betPerLine?: number;
}

/**
 * The headless game engine. Owns the wallet, state machine, event bus, and a
 * (swappable) spin provider, and enforces all the game rules: one spin at a
 * time, can't bet more than the balance, deduct-then-settle, validate every
 * result, refund and recover on failure. It contains no rendering — the view
 * layer is a pure subscriber to `events`.
 */
export class Game {
  readonly events: EventBus<GameEventMap>;
  readonly state: StateMachine;
  readonly wallet: Wallet;

  private readonly provider: SpinProvider;
  private _betPerLine: number;

  constructor(options: GameOptions = {}) {
    this.events = new EventBus<GameEventMap>();
    this.state = new StateMachine(this.events);
    this.wallet = new Wallet(options.startingBalance ?? gameConfig.startingBalance, this.events);
    this.provider = options.provider ?? new MockSpinProvider();
    this._betPerLine = options.betPerLine ?? gameConfig.defaultBetPerLine;
  }

  get betPerLine(): number {
    return this._betPerLine;
  }

  get balance(): number {
    return this.wallet.balance;
  }

  get currentState(): GameState {
    return this.state.current;
  }

  get paylineCount(): number {
    return PAYLINES.length;
  }

  /** Total amount staked per spin. */
  get stake(): number {
    return this._betPerLine * PAYLINES.length;
  }

  /**
   * Brings the game to a playable state. Asset loading would happen here in the
   * rendering phase (and a failure would transition to ERROR); there's nothing
   * to load yet, so we announce the opening balance/bet and settle on IDLE.
   */
  async init(): Promise<void> {
    this.events.emit(GameEvent.BalanceChange, {
      balance: this.wallet.balance,
      delta: this.wallet.balance,
      reason: 'init',
    });
    this.events.emit(GameEvent.BetChange, { betPerLine: this._betPerLine, stake: this.stake });
    this.state.set(GameState.IDLE);
  }

  /** Changes the per-line bet. Only allowed while idle. */
  setBet(betPerLine: number): void {
    if (this.state.current !== GameState.IDLE) return;
    const allowed = gameConfig.betLevels as readonly number[];
    if (!allowed.includes(betPerLine)) {
      throw new Error(`Invalid bet ${betPerLine}; allowed: ${allowed.join(', ')}`);
    }
    this._betPerLine = betPerLine;
    this.events.emit(GameEvent.BetChange, { betPerLine, stake: this.stake });
  }

  /**
   * Runs one spin. Returns the result, or null if the spin was rejected (busy /
   * insufficient funds) or failed (provider error / invalid result).
   */
  async spin(): Promise<SpinResult | null> {
    // Guard: one spin at a time.
    if (this.state.current !== GameState.IDLE) {
      this.events.emit(GameEvent.SpinRejected, { reason: 'busy' });
      return null;
    }

    // Guard: must be able to cover the stake.
    const stake = this.stake;
    if (!this.wallet.canAfford(stake)) {
      this.events.emit(GameEvent.SpinRejected, { reason: 'insufficient_funds' });
      return null;
    }

    this.state.set(GameState.SPINNING);
    this.wallet.debit(stake, 'bet');
    this.events.emit(GameEvent.SpinStart, { betPerLine: this._betPerLine, stake });

    try {
      const result = await this.provider.spin({ betPerLine: this._betPerLine });
      validateSpinResult(result, { betPerLine: this._betPerLine });

      this.state.set(GameState.EVALUATING);
      this.events.emit(GameEvent.SpinResult, { result });

      if (result.totalWin > 0) {
        this.wallet.credit(result.totalWin, 'win');
      }
      this.events.emit(GameEvent.SpinSettled, {
        totalWin: result.totalWin,
        balance: this.wallet.balance,
      });

      this.state.set(GameState.IDLE);
      return result;
    } catch (error) {
      // The spin never completed — return the stake and recover.
      this.wallet.credit(stake, 'refund');
      this.state.set(GameState.ERROR);
      this.events.emit(GameEvent.SpinError, {
        message: error instanceof Error ? error.message : 'Unknown spin error',
      });
      this.state.set(GameState.IDLE);
      return null;
    }
  }
}
