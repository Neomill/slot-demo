import { EventBus } from '../core/EventBus';
import { StateMachine } from '../core/StateMachine';
import { GameState } from '../core/GameState';
import { GameMode } from '../core/GameMode';
import { createMathRng, type RNG } from '../core/rng';
import { InvalidBonusError } from '../core/errors';
import { Wallet } from './Wallet';
import { ReelGenerator } from '../slot/ReelGenerator';
import { PaylineEvaluator } from '../slot/PaylineEvaluator';
import { PrizeEvaluator } from '../slot/PrizeEvaluator';
import { BonusManager } from '../bonus/BonusManager';
import { FreeSpinManager, type ActivatedAward } from '../bonus/FreeSpinManager';
import { HoldAndRespinManager } from '../bonus/HoldAndRespinManager';
import { BuyBonusManager } from '../bonus/BuyBonusManager';
import { PAYLINES } from '../config/paylines';
import { PAYTABLE } from '../config/paytable';
import { WILD, BONUS } from '../config/symbols';
import type { SymbolId } from '../config/symbols';
import { gameConfig } from '../config/gameConfig';
import { bonusConfig, type BuyBonusTier } from '../config/bonusConfig';
import { GameEvent, type GameEventMap } from '../types/events';
import type { LineWin, SpinResult, GameStateSnapshot } from '../types/slot';

export interface GameOptions {
  rng?: RNG;
  /** Override reel generation (used by tests to force outcomes). */
  reelGenerator?: ReelGenerator;
  startingBalance?: number;
  betPerLine?: number;
}

/** Keep only the highest-paying win on each payline (line vs prize). */
function highestPerPayline(...sources: LineWin[][]): LineWin[] {
  const best = new Map<number, LineWin>();
  for (const win of sources.flat()) {
    const current = best.get(win.payline);
    if (!current || win.amount > current.amount) best.set(win.payline, win);
  }
  return [...best.values()];
}

/**
 * The headless slot engine. Owns the wallet, lifecycle state machine, RNG,
 * reel generation, payline + prize evaluation, and the bonus managers. A single
 * `spin()` entry point branches on the current GameMode. No rendering.
 */
export class Game {
  readonly events: EventBus<GameEventMap>;
  readonly state: StateMachine;
  readonly wallet: Wallet;

  private readonly reels: ReelGenerator;
  private readonly evaluator: PaylineEvaluator;
  private readonly prizes: PrizeEvaluator;
  private readonly bonus: BonusManager;
  private readonly freeSpins: FreeSpinManager;
  private readonly holdAndRespin: HoldAndRespinManager;
  private readonly buyBonusManager: BuyBonusManager;

  private mode: GameMode = GameMode.BASE;
  private chance2x = false;
  private _betPerLine: number;

  constructor(options: GameOptions = {}) {
    const rng = options.rng ?? createMathRng();
    this.events = new EventBus<GameEventMap>();
    this.state = new StateMachine(this.events);
    this.wallet = new Wallet(options.startingBalance ?? gameConfig.startingBalance, this.events);
    this.reels = options.reelGenerator ?? new ReelGenerator(rng);
    this.evaluator = new PaylineEvaluator({ paylines: PAYLINES, paytable: PAYTABLE, wild: WILD });
    this.prizes = new PrizeEvaluator(rng, PAYLINES);
    this.bonus = new BonusManager();
    this.freeSpins = new FreeSpinManager();
    this.holdAndRespin = new HoldAndRespinManager(rng);
    this.buyBonusManager = new BuyBonusManager();
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

  get currentMode(): GameMode {
    return this.mode;
  }

  get paylineCount(): number {
    return PAYLINES.length;
  }

  /** Total stake per base spin (before Chance x2). */
  get currentBet(): number {
    return this._betPerLine * PAYLINES.length;
  }

  /** Cost of the next base spin (Chance x2 applies; bonus spins are free). */
  get spinCost(): number {
    return this.currentBet * (this.chance2x ? bonusConfig.chance2x.costMultiplier : 1);
  }

  get isChance2x(): boolean {
    return this.chance2x;
  }

  async init(): Promise<void> {
    this.events.emit(GameEvent.BalanceChange, {
      balance: this.wallet.balance,
      delta: this.wallet.balance,
      reason: 'init',
    });
    this.events.emit(GameEvent.BetChange, { betPerLine: this._betPerLine, stake: this.currentBet });
    this.state.set(GameState.IDLE);
  }

  /** Change the per-line bet. Only allowed while idle in the base game. */
  setBet(betPerLine: number): void {
    if (this.state.current !== GameState.IDLE || this.mode !== GameMode.BASE) return;
    const allowed = gameConfig.betLevels as readonly number[];
    if (!allowed.includes(betPerLine)) {
      throw new Error(`Invalid bet ${betPerLine}; allowed: ${allowed.join(', ')}`);
    }
    this._betPerLine = betPerLine;
    this.events.emit(GameEvent.BetChange, { betPerLine, stake: this.currentBet });
  }

  /** Toggle Chance x2. Only allowed while idle in the base game. */
  setChance2x(enabled: boolean): void {
    if (this.state.current !== GameState.IDLE || this.mode !== GameMode.BASE) return;
    if (this.chance2x === enabled) return;
    this.chance2x = enabled;
    this.events.emit(GameEvent.ChanceChange, { enabled });
  }

  /** Free Spins: completed panels still hold queued +10 awards to transfer. */
  get hasQueuedFreeSpins(): boolean {
    return this.mode === GameMode.FREE_SPINS && this.freeSpins.hasQueuedAwards;
  }

  /**
   * Transfer the next queued panel's award into the live spin counter. Driven by
   * the UI's activation/transfer ceremony once the counter has emptied; returns
   * the panel + spins moved, or null if nothing is queued.
   */
  activateQueuedFreeSpins(): ActivatedAward | null {
    if (this.mode !== GameMode.FREE_SPINS) return null;
    return this.freeSpins.activateQueued();
  }

  getState(): GameStateSnapshot {
    const snapshot: GameStateSnapshot = {
      mode: this.mode,
      balance: this.wallet.balance,
      currentBet: this.currentBet,
      chance2x: this.chance2x,
    };
    if (this.mode === GameMode.FREE_SPINS) snapshot.freeSpins = this.freeSpins.snapshot();
    if (this.mode === GameMode.HOLD_AND_RESPIN) snapshot.holdAndRespin = this.holdAndRespin.snapshot();
    return snapshot;
  }

  /** Buy a bonus: deduct the cost and enter Free Spins immediately. */
  buyBonus(tier: BuyBonusTier): void {
    if (this.state.current !== GameState.IDLE || this.mode !== GameMode.BASE) {
      throw new InvalidBonusError('Can only buy a bonus while idle in the base game');
    }
    if (!(tier in bonusConfig.buyBonus)) {
      throw new InvalidBonusError(`Unknown bonus tier: ${tier}`);
    }
    const cost = this.buyBonusManager.cost(tier, this.currentBet);
    if (!this.wallet.canAfford(cost)) {
      this.events.emit(GameEvent.SpinRejected, { reason: 'insufficient_funds' });
      return;
    }
    this.wallet.debit(cost, 'bet');
    const spins = this.buyBonusManager.initialFreeSpins(tier);
    this.freeSpins.start(spins, this.buyBonusManager.finalMultiplier(tier));
    this.enterMode(GameMode.FREE_SPINS);
    this.events.emit(GameEvent.BonusBought, { tier, cost, spins });
    this.events.emit(GameEvent.FreeSpinsStart, { spins, trigger: 'buy' });
  }

  /**
   * Debug helper: force a Hold & Respin trigger from idle in the base game.
   * Drops the trigger's worth of trophies onto a real base board (one per reel)
   * and enters the feature exactly as a natural triggering spin would, so the
   * UI auto-plays the respins. Console: `game.debugTriggerHoldAndRespin()`.
   */
  debugTriggerHoldAndRespin(): SpinResult | null {
    if (this.state.current !== GameState.IDLE || this.mode !== GameMode.BASE) {
      this.events.emit(GameEvent.SpinRejected, { reason: 'busy' });
      return null;
    }

    this.state.set(GameState.SPINNING);
    this.events.emit(GameEvent.SpinStart, { betPerLine: this._betPerLine, stake: 0 });

    const grid = this.reels.generate('base');
    const needed = bonusConfig.holdAndRespin.trigger.bonusSymbols;
    for (let reel = 0; reel < needed && reel < grid.length; reel++) {
      grid[reel][0] = BONUS;
    }

    const { lineWins, totalWin: baseWin } = this.evaluator.evaluate(grid, this._betPerLine);
    this.state.set(GameState.EVALUATING);
    if (baseWin > 0) this.wallet.credit(baseWin, 'win');

    const bonusCount = this.bonus.countBonus(grid);
    const result: SpinResult = {
      grid,
      lineWins,
      prizes: this.prizes.roll(grid),
      baseWin,
      totalWin: baseWin,
      multiplier: 1,
      mode: GameMode.BASE,
      scatterCount: this.bonus.countScatters(grid),
      bonusCount,
    };

    this.startHoldAndRespin(grid, result);

    this.emitSettled(result);
    this.state.set(GameState.IDLE);
    return result;
  }

  /**
   * Enter Hold & Respin from a triggering board: lock + value the trophies,
   * collect those starting values right away (so the win meter shows them as the
   * trophies land), snapshot onto `result`, and switch mode.
   */
  private startHoldAndRespin(grid: SymbolId[][], result: SpinResult): void {
    this.holdAndRespin.start(grid);
    const trophyWin = this.holdAndRespin.trophyTotal() * this._betPerLine;
    if (trophyWin > 0) {
      // Accumulate into the session total (shown live); paid when the feature ends.
      this.holdAndRespin.addWin(trophyWin);
      result.collectWin = (result.collectWin ?? 0) + trophyWin;
    }
    // Carry the freshly-rolled trophy values so the triggering spin shows each
    // trophy's value as it lands (not popped on once the feature begins).
    result.holdAndRespin = this.holdAndRespin.snapshot();
    this.enterMode(GameMode.HOLD_AND_RESPIN);
    this.events.emit(GameEvent.HoldRespinStart, {
      respins: this.holdAndRespin.remaining,
      lockedBonus: this.bonus.countBonus(grid),
    });
  }

  /** The single entry point — branches on the current mode. */
  async spin(): Promise<SpinResult | null> {
    if (this.state.current !== GameState.IDLE) {
      this.events.emit(GameEvent.SpinRejected, { reason: 'busy' });
      return null;
    }
    switch (this.mode) {
      case GameMode.FREE_SPINS:
        return this.freeSpin();
      case GameMode.HOLD_AND_RESPIN:
        return this.holdRespinSpin();
      default:
        return this.baseSpin();
    }
  }

  private baseSpin(): SpinResult | null {
    const cost = this.spinCost;
    if (!this.wallet.canAfford(cost)) {
      this.events.emit(GameEvent.SpinRejected, { reason: 'insufficient_funds' });
      return null;
    }

    this.state.set(GameState.SPINNING);
    this.wallet.debit(cost, 'bet');
    this.events.emit(GameEvent.SpinStart, { betPerLine: this._betPerLine, stake: cost });

    const grid = this.reels.generate(this.chance2x ? 'chance2x' : 'base');
    const prizes = this.prizes.roll(grid);

    // Highest of (normal line win, prize-symbol win) on each payline.
    const lineWins = highestPerPayline(
      this.evaluator.evaluate(grid, this._betPerLine).lineWins,
      this.prizes.evaluateMainGame(prizes, this._betPerLine),
    );
    const baseWin = lineWins.reduce((sum, win) => sum + win.amount, 0);

    this.state.set(GameState.EVALUATING);
    if (baseWin > 0) this.wallet.credit(baseWin, 'win');

    const scatterCount = this.bonus.countScatters(grid);
    const bonusCount = this.bonus.countBonus(grid);

    const result: SpinResult = {
      grid,
      lineWins,
      prizes,
      baseWin,
      totalWin: baseWin,
      multiplier: 1,
      mode: GameMode.BASE,
      scatterCount,
      bonusCount,
    };

    // Scatter -> Free Spins takes precedence; otherwise bonus -> Hold & Respin.
    const scatterAward = this.bonus.scatterAward(scatterCount);
    if (scatterAward > 0) {
      result.triggeredFreeSpins = scatterAward;
      this.freeSpins.start(scatterAward, bonusConfig.freeSpins.defaultFinalMultiplier);
      this.enterMode(GameMode.FREE_SPINS);
      this.events.emit(GameEvent.FreeSpinsStart, { spins: scatterAward, trigger: 'scatter' });
    } else if (this.bonus.triggersHoldAndRespin(bonusCount)) {
      this.startHoldAndRespin(grid, result);
    }

    this.emitSettled(result);
    this.state.set(GameState.IDLE);
    return result;
  }

  private freeSpin(): SpinResult {
    this.state.set(GameState.SPINNING);
    this.events.emit(GameEvent.SpinStart, { betPerLine: this._betPerLine, stake: 0 });

    const grid = this.reels.generate('freeSpins');
    const prizes = this.prizes.roll(grid);
    const lineTotal = this.evaluator.evaluate(grid, this._betPerLine);

    const wilds = this.bonus.countSymbol(grid, WILD);
    const collectWin = this.prizes.collect(prizes, wilds, this._betPerLine);

    const collected = this.freeSpins.collectWilds(wilds);
    if (collected.stagesCrossed > 0) {
      this.events.emit(GameEvent.WildsCollected, {
        count: wilds,
        wildCounter: this.freeSpins.snapshot().wildCounter,
        multiplier: collected.multiplier,
        awardedSpins: collected.awardedSpins,
      });
    }

    const multiplier = this.freeSpins.currentMultiplier;
    const baseWin = lineTotal.totalWin + collectWin;
    const win = baseWin * multiplier;

    this.state.set(GameState.EVALUATING);
    // Wins accumulate during the feature; the whole total is paid when it ends.
    this.freeSpins.addWin(win);
    this.freeSpins.consume();

    const result: SpinResult = {
      grid,
      lineWins: lineTotal.lineWins,
      prizes,
      baseWin,
      totalWin: win,
      multiplier,
      mode: GameMode.FREE_SPINS,
      scatterCount: 0,
      bonusCount: 0,
      wildsCollected: wilds,
      collectWin,
      freeSpins: this.freeSpins.snapshot(),
    };
    // Counter emptied with awards still queued → cue the activation ceremony.
    if (this.freeSpins.remainingSpins === 0 && this.freeSpins.hasQueuedAwards) {
      result.pendingActivation = true;
    }
    this.emitSettled(result);

    if (!this.freeSpins.isActive) {
      const total = this.freeSpins.snapshot().totalWin;
      if (total > 0) this.wallet.credit(total, 'win'); // pay the whole session, once
      this.events.emit(GameEvent.FreeSpinsEnd, { totalWin: total });
      this.freeSpins.reset();
      this.enterMode(GameMode.BASE);
    }

    this.state.set(GameState.IDLE);
    return result;
  }

  private holdRespinSpin(): SpinResult {
    this.state.set(GameState.SPINNING);
    this.events.emit(GameEvent.SpinStart, { betPerLine: this._betPerLine, stake: 0 });

    const candidate = this.reels.generate('holdAndRespin');
    const { newBonus, newTrophyValue } = this.holdAndRespin.respin(candidate);
    const grid = this.holdAndRespin.currentBoard;

    const { lineWins, totalWin: baseWin } = this.evaluator.evaluate(grid, this._betPerLine);

    this.state.set(GameState.EVALUATING);
    if (baseWin > 0) {
      // A win refills the respins to the reset value, regardless of trophy count.
      this.holdAndRespin.refill();
    }
    // Each trophy's value joins the running total as it lands; line wins too. The
    // total is shown live but only paid to the balance when the feature ends.
    const collectWin = newTrophyValue * this._betPerLine;
    const spinWin = baseWin + collectWin;
    this.holdAndRespin.addWin(spinWin);

    const result: SpinResult = {
      grid: grid.map((column) => [...column]),
      lineWins,
      prizes: this.prizes.roll(grid),
      baseWin,
      totalWin: spinWin,
      multiplier: 1,
      mode: GameMode.HOLD_AND_RESPIN,
      scatterCount: 0,
      bonusCount: this.bonus.countBonus(grid),
      collectWin: collectWin || undefined,
      holdAndRespin: this.holdAndRespin.snapshot(),
    };

    this.events.emit(GameEvent.HoldRespinUpdate, {
      remainingRespins: this.holdAndRespin.remaining,
      newBonus,
      lockedBonus: result.bonusCount,
    });
    this.emitSettled(result);

    // Ends when the respins run out or the whole board is trophies; the whole
    // accumulated total (line wins + every trophy) is paid to the balance now.
    if (!this.holdAndRespin.isActive) {
      const total = this.holdAndRespin.snapshot().totalWin;
      if (total > 0) this.wallet.credit(total, 'win');
      this.events.emit(GameEvent.HoldRespinEnd, { totalWin: total });
      this.holdAndRespin.reset();
      this.enterMode(GameMode.BASE);
    }

    this.state.set(GameState.IDLE);
    return result;
  }

  private emitSettled(result: SpinResult): void {
    this.events.emit(GameEvent.SpinResult, { result });
    this.events.emit(GameEvent.SpinSettled, { totalWin: result.totalWin, balance: this.wallet.balance });
  }

  private enterMode(mode: GameMode): void {
    if (mode === this.mode) return;
    const from = this.mode;
    this.mode = mode;
    this.events.emit(GameEvent.ModeChange, { from, to: mode });
  }
}
