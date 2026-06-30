import {
  Application,
  Assets,
  Graphics,
  Sprite,
  type Ticker,
  type Texture,
} from "pixi.js";
import type { Game } from "../game/Game";
import { GameMode } from "../core/GameMode";
import { GameState } from "../core/GameState";
import { GameEvent } from "../types/events";
import { gameConfig } from "../config/gameConfig";
import { bonusConfig, type BuyBonusTier } from "../config/bonusConfig";
import { WILD, BONUS, SCATTER, SYMBOLS } from "../config/symbols";
import type { SymbolId } from "../config/symbols";
import type { Position, PrizeCell, SpinResult } from "../types/slot";
import {
  BACKGROUNDS,
  FRAME as FRAME_TEXTURE,
  LOGO,
  ALL_ASSET_URLS,
} from "../assets/manifest";
import {
  ANTICIPATION,
  BACKDROP,
  CANVAS,
  CELL,
  FRAME,
  FRAME_POS,
  GRID,
  HUD_POS,
  REEL_ORIGIN,
  WILD_CHARGE,
} from "./theme";
import { Reels, type CinematicHooks } from "./Reels";
import { winIntensity, winFxParams } from "./winFx";
import { Hud } from "./hud";
import { SidePanel } from "./SidePanel";
import { FreeSpinPanel } from "./FreeSpinPanel";
import { FeatureBeam } from "./FeatureBeam";
import { HoldRespinPanel } from "./HoldRespinPanel";
import { money } from "./hud/text";

// Pleasant resting board shown before the first spin.
// Resting board: no prize horses here, so nothing shows a value before a spin.
const INITIAL_GRID: SymbolId[][] = [
  ["jocky", "ten", "jack"],
  ["shoehorse", "queen", "king"],
  ["binoculars", "ace", "jocky"],
  ["cap", "ten", "shoehorse"],
  ["jack", "king", "queen"],
];

/** Positions of every Wild on the board — the collect target during free spins. */
function wildPositions(grid: SymbolId[][]): Position[] {
  const positions: Position[] = [];
  for (let reel = 0; reel < grid.length; reel++) {
    for (let row = 0; row < grid[reel].length; row++) {
      if (grid[reel][row] === WILD) positions.push({ reel, row });
    }
  }
  return positions;
}

/** Locked trophies as Prize cells, so the reels can bake their value badges. */
function trophyValueCells(locked: boolean[][], values: number[][]): PrizeCell[] {
  const cells: PrizeCell[] = [];
  for (let reel = 0; reel < values.length; reel++) {
    for (let row = 0; row < values[reel].length; row++) {
      if (locked[reel]?.[row] && values[reel][row] > 0) {
        cells.push({ reel, row, symbol: BONUS, value: values[reel][row] });
      }
    }
  }
  return cells;
}

/** The win to show on the HUD: the running session total in a bonus, else this spin's. */
function sessionWin(result: SpinResult): number {
  if (result.freeSpins) return result.freeSpins.totalWin;
  if (result.holdAndRespin) return result.holdAndRespin.totalWin;
  return result.totalWin;
}

/** Pause between auto-played bonus spins (free spins / hold & respin). */
const BONUS_SPIN_DELAY = 700;

/** Wild locks per multiplier panel; 3 panels → the 12-wild ladder. */
const WILDS_PER_PANEL = 4;
/** Locks on the multiplier ladder (4 per panel × 3 panels) = the wild cap. */
const MAX_WILDS = WILDS_PER_PANEL * 3;

/** Which bonus tier the Buy Bonus panel purchases. */
const BUY_BONUS_TIER: BuyBonusTier = "super";

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Normal symbols only — used to fill a synthesized board behind the Scatters. */
const FILLER_SYMBOLS = SYMBOLS.filter((s) => s !== SCATTER && s !== WILD && s !== BONUS);

/** Fisher–Yates shuffle (returns a new array). */
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * A display-only board for the Buy Bonus cinematic. The engine jumps straight
 * into Free Spins on a purchase, so we fabricate a base board that lands the
 * trigger: exactly `maxScatters` Scatters (the board cap), each on a different
 * reel at a random row. Spreading them across distinct reels keeps the running
 * count climbing cleanly to two before a later reel completes it, so the
 * left-to-right anticipation build-up always plays (see planAnticipation). The
 * Scatter layout is fresh every purchase; the awarded spins come from the bonus
 * tier, not the count shown.
 */
function buyBonusBoard(): SymbolId[][] {
  const { reels, rows } = gameConfig;
  const grid: SymbolId[][] = [];
  for (let reel = 0; reel < reels; reel++) {
    const column: SymbolId[] = [];
    for (let row = 0; row < rows; row++) {
      column.push(FILLER_SYMBOLS[Math.floor(Math.random() * FILLER_SYMBOLS.length)]);
    }
    grid.push(column);
  }

  const count = Math.min(bonusConfig.freeSpins.maxScatters, reels);
  const scatterReels = shuffle([...Array(reels).keys()]).slice(0, count);
  for (const reel of scatterReels) {
    grid[reel][Math.floor(Math.random() * rows)] = SCATTER;
  }
  return grid;
}

/** Ensure Barlow Condensed is ready before Pixi rasterizes any text with it. */
async function loadFonts(): Promise<void> {
  if (!("fonts" in document)) return;
  try {
    await Promise.all([
      document.fonts.load('600 16px "Barlow Condensed"'),
      document.fonts.load('700 24px "Barlow Condensed"'),
    ]);
  } catch {
    // Fall back to the system font if loading fails.
  }
}

/**
 * The PixiJS view. Owns the renderer and on-screen pieces (background, reels,
 * frame, logo, HUD), and reacts to engine events. One-way mirror: it renders
 * state and forwards control input — it never owns game logic.
 */
export class SlotScene {
  readonly app: Application;
  private readonly game: Game;
  private background!: Sprite;
  private backdrop!: Graphics;
  private frame!: Sprite;
  private reels!: Reels;
  private hud!: Hud;
  private sidePanel!: SidePanel;
  private freeSpinPanel!: FreeSpinPanel;
  private holdRespinPanel!: HoldRespinPanel;
  private bloom!: Graphics;
  /** Darkens the reels while a Wild Charge beam travels (Phase 3 camera focus). */
  private featureDim!: Graphics;
  /** The curved feature-energy beam fired from a Wild to the next lock. */
  private featureBeam!: FeatureBeam;
  private featDim = 0;
  private featDimTarget = 0;
  /** True while the per-spin Wild Charge sequence plays, so the overlay holds
   *  its values back until the locks have animated up to the new count. */
  private chargingWilds = false;
  private autoTimer: number | null = null;
  private busy = false; // true while a spin animation is playing
  /** True while a base spin's reels are landing (so the Free Spins panel is
   *  held back until the anticipation cinematic and intro have played). */
  private cinematicActive = false;
  /** Full-screen bloom flash: elapsed ms, or -1 when idle. */
  private bloomElapsed = -1;
  /** Background brightness (1 = full) and the value we're easing toward. */
  private bgBright = 1;
  private bgBrightTarget = 1;

  constructor(game: Game) {
    this.game = game;
    this.app = new Application();
  }

  async init(container: HTMLElement): Promise<void> {
    await this.app.init({
      width: CANVAS.width,
      height: CANVAS.height,
      background: 0x05070d,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    container.appendChild(this.app.canvas);

    await Assets.load(ALL_ASSET_URLS);
    await loadFonts();

    this.build();
    this.subscribe();
    await this.game.init();
    this.hud.setWin(0);
    this.sidePanel.setLuckBoost(this.game.isChance2x);
    this.updateSidePanelCosts();
    this.refreshControls();
    this.refreshFreeSpinOverlay();

    this.app.ticker.add((ticker: Ticker) => {
      this.reels.update(ticker.deltaMS);
      this.hud.update(ticker.deltaMS);
      this.sidePanel.update(ticker.deltaMS);
      this.freeSpinPanel.update(ticker.deltaMS);
      this.featureBeam.update(ticker.deltaMS);
      this.updateBloom(ticker.deltaMS);
      this.updateBackgroundDim(ticker.deltaMS);
      this.updateFeatureFocus(ticker.deltaMS);
    });
  }

  /** Ease the background brightness toward its target (anticipation focus). */
  private updateBackgroundDim(dtMs: number): void {
    if (this.bgBright === this.bgBrightTarget) return;
    const step = Math.min(1, dtMs / ANTICIPATION.dimFadeMs);
    this.bgBright += (this.bgBrightTarget - this.bgBright) * step;
    if (Math.abs(this.bgBright - this.bgBrightTarget) < 0.004) this.bgBright = this.bgBrightTarget;
    const v = Math.round(this.bgBright * 255);
    this.background.tint = (v << 16) | (v << 8) | v;
  }

  /** Ease the Wild Charge focus dim toward its target (Phase 3 camera focus). */
  private updateFeatureFocus(dtMs: number): void {
    if (this.featDim === this.featDimTarget) return;
    const step = Math.min(1, dtMs / WILD_CHARGE.focusFadeMs);
    this.featDim += (this.featDimTarget - this.featDim) * step;
    if (Math.abs(this.featDim - this.featDimTarget) < 0.004) this.featDim = this.featDimTarget;
    this.featureDim.alpha = this.featDim;
  }

  /** Advance the bloom flash (0 → peak → half → 0 over its window). */
  private updateBloom(dtMs: number): void {
    if (this.bloomElapsed < 0) return;
    this.bloomElapsed += dtMs;
    const t = Math.min(1, this.bloomElapsed / ANTICIPATION.bloomMs);
    const peak = ANTICIPATION.bloomPeak;
    let alpha: number;
    if (t < 0.3) alpha = peak * (t / 0.3);
    else if (t < 0.6) alpha = peak * (1 - 0.5 * ((t - 0.3) / 0.3));
    else alpha = peak * 0.5 * (1 - (t - 0.6) / 0.4);
    this.bloom.alpha = alpha;
    if (t >= 1) {
      this.bloom.alpha = 0;
      this.bloomElapsed = -1;
    }
  }

  /** The effects the reels drive during the anticipation cinematic. */
  private cinematicHooks(): CinematicHooks {
    return {
      dim: (active) => {
        this.bgBrightTarget = active ? ANTICIPATION.dimBrightness : 1;
      },
      bloom: () => {
        this.bloomElapsed = 0;
      },
    };
  }

  private build(): void {
    const stage = this.app.stage;

    this.background = new Sprite(
      Assets.get<Texture>(BACKGROUNDS[GameMode.BASE]),
    );
    this.background.width = CANVAS.width;
    this.background.height = CANVAS.height;

    this.backdrop = new Graphics()
      .roundRect(
        REEL_ORIGIN.x - BACKDROP.paddingX,
        REEL_ORIGIN.y - BACKDROP.paddingY,
        GRID.width + BACKDROP.paddingX * 2,
        GRID.height + BACKDROP.paddingY * 2,
        BACKDROP.radius,
      )
      .fill({ color: BACKDROP.color, alpha: BACKDROP.alpha });

    this.reels = new Reels(INITIAL_GRID);
    this.reels.position.set(REEL_ORIGIN.x, REEL_ORIGIN.y);

    this.frame = new Sprite(Assets.get<Texture>(FRAME_TEXTURE));
    this.frame.position.set(FRAME_POS.x, FRAME_POS.y);
    this.frame.width = FRAME.width;
    this.frame.height = FRAME.height;

    const logo = new Sprite(Assets.get<Texture>(LOGO));
    logo.anchor.set(0.5, 0);
    logo.position.set(CANVAS.width / 2, 24);

    this.hud = new Hud({
      onSpin: () => void this.game.spin(),
      onBet: (direction) => this.changeBet(direction),
      onTurbo: () => this.game.setChance2x(!this.game.isChance2x),
      onMenu: () => console.info("[menu] not implemented yet"),
    });
    this.hud.position.set(HUD_POS.x, HUD_POS.y);

    this.sidePanel = new SidePanel({
      onBuyBonus: () => void this.playBuyBonus(),
      onToggleLuckBoost: () => this.game.setChance2x(!this.game.isChance2x),
    });

    this.freeSpinPanel = new FreeSpinPanel();
    this.holdRespinPanel = new HoldRespinPanel();

    // Phase 3 camera focus: a dark plate over the frame/reels that fades in while
    // a Wild Charge beam travels, so the lit panel above reads as the focal point.
    this.featureDim = new Graphics()
      .rect(FRAME_POS.x, FRAME_POS.y, FRAME.width, FRAME.height)
      .fill({ color: 0x000000 });
    this.featureDim.alpha = 0;
    this.featureDim.eventMode = "none";

    // The curved Wild Charge beam, in stage coordinates above the playfield.
    this.featureBeam = new FeatureBeam();

    // Full-screen additive bloom flash for the Free Spins trigger / entry. Sits
    // above the playfield but below the HUD so the controls stay crisp.
    this.bloom = new Graphics().rect(0, 0, CANVAS.width, CANVAS.height).fill(0xffffff);
    this.bloom.blendMode = "add";
    this.bloom.alpha = 0;
    this.bloom.eventMode = "none";

    // background → backdrop → reels → frame → logo → feature dim → bloom → side
    // panels → bonus overlays → feature beam → HUD. The dim sits below the
    // free-spin overlay so the panels stay bright while the reels darken; the
    // beam sits above the overlay so its impact sparks land over the locks.
    stage.addChild(
      this.background,
      this.backdrop,
      this.reels,
      this.frame,
      logo,
      this.featureDim,
      this.bloom,
      this.sidePanel,
      this.freeSpinPanel,
      this.holdRespinPanel,
      this.featureBeam,
      this.hud,
    );
  }

  private subscribe(): void {
    const { events } = this.game;

    events.on(GameEvent.ModeChange, ({ from, to }) => {
      // Leaving Free Spins: tear down any in-flight charge beam and lift the dim.
      if (from === GameMode.FREE_SPINS) {
        this.featureBeam.clear();
        this.chargingWilds = false;
        this.setFeatureFocus(false);
      }
      // The base → Free Spins swap is owned by the cinematic (it happens after
      // the reels land + the intro plays); every other transition flips now.
      const deferToCinematic = from === GameMode.BASE && to === GameMode.FREE_SPINS;
      if (!deferToCinematic) this.setBackground(to);
      this.refreshControls(); // entering/leaving a bonus mode flips the spin button immediately
      this.refreshFreeSpinOverlay();
      // Bonus modes show a running session total; the base game shows one spin.
      this.hud.setWinLabel(to === GameMode.BASE ? "WIN" : "TOTAL WIN");
      // Seed the meter with the session total so far (0 for free spins; the
      // starting trophies' value for hold & respin) so it climbs as wins land.
      const s = this.game.getState();
      if (to === GameMode.FREE_SPINS) this.hud.setWin(s.freeSpins?.totalWin ?? 0);
      else if (to === GameMode.HOLD_AND_RESPIN) this.hud.setWin(s.holdAndRespin?.totalWin ?? 0);
    });
    events.on(GameEvent.SpinResult, ({ result }) => void this.render(result));
    // Reset the win meter per spin only in the base game; bonus modes keep the
    // accumulated session total (render() drives it up).
    events.on(GameEvent.SpinStart, () => {
      if (this.game.currentMode === GameMode.BASE) {
        this.hud.setWin(0);
        // A base spin may trigger Free Spins; hold the overlay back until the
        // cinematic + intro have played (set now, before the mode flips).
        this.cinematicActive = true;
      }
    });
    events.on(GameEvent.BalanceChange, ({ balance, reason }) => {
      // Snap on the initial load; otherwise ease (count up on a win, down on a bet).
      this.hud.setBalance(balance, reason === "init");
      this.refreshControls();
    });
    events.on(GameEvent.BetChange, ({ stake }) => {
      this.hud.setBet(stake);
      this.updateSidePanelCosts();
      this.refreshControls();
    });
    // Total Win is shown by render() once the reels land (see Spin Results).
    events.on(GameEvent.SpinSettled, () => this.refreshFreeSpinOverlay());
    events.on(GameEvent.ChanceChange, ({ enabled }) => {
      this.hud.setTurbo(enabled);
      this.sidePanel.setLuckBoost(enabled);
    });
    events.on(GameEvent.FreeSpinsStart, ({ trigger }) => {
      // New session: clear any leftover charge effects from a prior bonus.
      this.freeSpinPanel.resetProgression();
      this.refreshFreeSpinOverlay();
      // A bought bonus has no triggering spin, so start the auto-play here.
      if (trigger === "buy") this.scheduleNextBonusSpin();
    });
    // NB: WildsCollected fires *before* SpinResult (so before render() decides
    // whether the Wild Charge cinematic will play). Refreshing the overlay here
    // would snap the locks to the new count immediately — flipping a lock to its
    // unlock art before the charge beam reaches it (most visibly the 4th lock as
    // a panel completes). The SpinSettled refresh (after render() has set
    // chargingWilds) handles this correctly, so we deliberately don't refresh here.
    events.on(GameEvent.HoldRespinStart, () => this.refreshFreeSpinOverlay());
    events.on(GameEvent.HoldRespinUpdate, () => this.refreshFreeSpinOverlay());
  }

  private async render(result: SpinResult): Promise<void> {
    this.busy = true; // lock the spin button for the whole animation
    this.refreshControls();
    this.reels.clearWins();

    // Free spins that collect Wilds run the Wild Charge cinematic below; hold the
    // overlay's counter/locks at their pre-spin values until then (set before the
    // first await, so the synchronous SpinSettled refresh respects it).
    this.chargingWilds = this.willChargeWilds(result);

    if (result.mode === GameMode.HOLD_AND_RESPIN && result.holdAndRespin) {
      const { lockedBefore, locked, values } = result.holdAndRespin;
      const trophyPrizes = trophyValueCells(locked, values);
      this.holdRespinPanel.tickDown(); // deduct one respin as the reels start
      await this.reels.respin(result.grid, lockedBefore, locked, trophyPrizes, this.game.betPerLine);
      // Reels (and any new trophy) have landed — sync to the engine's count, which
      // refills to 3 when a trophy or win landed this respin.
      this.holdRespinPanel.setRemaining(result.holdAndRespin.remainingRespins);
    } else {
      // Prize values are baked into the landing tiles, so they scroll in with the
      // reel. On the Hold & Respin trigger spin the trophies carry their values too.
      const prizes = result.holdAndRespin
        ? [...result.prizes, ...trophyValueCells(result.holdAndRespin.locked, result.holdAndRespin.values)]
        : result.prizes;
      // Only base spins get the anticipation cinematic — pass the scene hooks so
      // the reels can dim the background and bloom on the triggering Scatter.
      const hooks = result.mode === GameMode.BASE ? this.cinematicHooks() : undefined;
      await this.reels.spin(result.grid, prizes, this.game.betPerLine, hooks);
    }

    // Spin Results: present the winning paylines (focus → reveal → activation →
    // finish), scaled by an intensity derived from the win vs. the stake. Big
    // wins also flash the shared bloom (the scene owns it). See winFx + Reels.
    if (result.lineWins.length > 0) {
      const intensity = winIntensity(result.totalWin, this.game.currentBet);
      const params = winFxParams(intensity, result.mode);
      await this.reels.playWinPresentation(result.lineWins, params, () => {
        this.bloomElapsed = 0;
      });
    }

    // Free spins: Wilds collect the prizes — detach the badges and fly them into
    // the Wild (Phase 1, the Wild absorbing the gold energy).
    if (result.mode === GameMode.FREE_SPINS && (result.collectWin ?? 0) > 0) {
      await this.reels.collectIntoWild(
        result.prizes,
        wildPositions(result.grid),
        this.game.betPerLine,
      );
    }

    // Wild Charge: each newly-collected Wild fires a curved beam up to the next
    // lock on the ladder and charges it (Phases 2–6). Runs after the prizes have
    // been absorbed, mirroring the engine's wild count climb.
    if (this.chargingWilds && result.freeSpins) {
      const after = result.freeSpins.wildCounter;
      const before = after - (result.wildsCollected ?? 0);
      await this.playWildCharges(before, after, wildPositions(result.grid));
      this.chargingWilds = false;
    }

    // Base mode shows this spin's win; bonus modes show the running total of the
    // session (so it accumulates and never resets mid-feature).
    this.hud.setWin(sessionWin(result));

    // A natural Scatter trigger: the reels have landed (and bloomed) — beat,
    // then play the Free Spins intro before the overlay appears and auto-play
    // begins. The mode already flipped in the engine; we just reveal it now.
    if (result.triggeredFreeSpins) await this.playFreeSpinsEntry();

    this.cinematicActive = false;

    // Free Spin end ceremony (Phases 7–8): the counter has emptied but completed
    // panels still hold queued +10 awards. Activate them one at a time — each
    // panel opens, transfers its spins to the counter as energy orbs, then is
    // consumed — chaining through every queued panel before auto-play resumes.
    if (result.pendingActivation) await this.playQueuedActivation();

    this.busy = false;
    this.refreshControls();
    this.refreshFreeSpinOverlay();

    // Auto-play bonus rounds until they finish (respects retriggers, which keep
    // the mode non-BASE by adding spins / resetting respins).
    if (this.game.currentMode !== GameMode.BASE) this.scheduleNextBonusSpin();
  }

  /**
   * The activation/transfer step (Phases 7–8). Collect exactly ONE queued panel
   * each time the counter empties: a beat of anticipation at zero, darken the
   * board, open the panel, fly its 10 spins to the counter as energy orbs (the
   * counter ticks up with a pop per orb), then mark the panel collected (it goes
   * quiet — no checkmark, the activation burst + orb flight are the "collected"
   * cue). The counter is now back to 10, so auto-play resumes and counts it down;
   * the next queued panel is collected the next time the counter hits zero.
   */
  private async playQueuedActivation(): Promise<void> {
    await wait(WILD_CHARGE.endPauseMs);
    if (!this.game.hasQueuedFreeSpins) return;
    this.setFeatureFocus(true);
    const award = this.game.activateQueuedFreeSpins();
    if (award) {
      const remaining = this.game.getState().freeSpins?.remaining ?? award.added;
      const fromValue = remaining - award.added;
      await this.freeSpinPanel.playPanelActivation(award.panelIndex);
      await this.freeSpinPanel.transferToCounter(award.panelIndex, fromValue, award.added);
      await this.freeSpinPanel.consumePanel(award.panelIndex);
    }
    this.setFeatureFocus(false);
  }

  /** The Free Spins intro: a beat, then swap to the Free Spins backdrop with a
   *  bloom flash. Shared by the natural trigger and the Buy Bonus cinematic. */
  private async playFreeSpinsEntry(): Promise<void> {
    await wait(ANTICIPATION.entryPauseMs);
    this.setBackground(GameMode.FREE_SPINS);
    this.bloomElapsed = 0;
  }

  /**
   * Buy Bonus: play the same cinematic as a natural trigger over a fabricated
   * board that lands the Scatters, then purchase the bonus for real and reveal
   * Free Spins. Guaranteed outcome, so the anticipation always pays off.
   */
  private async playBuyBonus(): Promise<void> {
    if (this.busy || this.game.currentMode !== GameMode.BASE) return;

    // If it can't be afforded, let the engine emit the rejection (no cinematic).
    const cost = bonusConfig.buyBonus[BUY_BONUS_TIER].costMultiplier * this.game.currentBet;
    if (this.game.balance < cost) {
      this.game.buyBonus(BUY_BONUS_TIER);
      return;
    }

    this.busy = true;
    this.cinematicActive = true;
    this.refreshControls();
    this.reels.clearWins();

    await this.reels.spin(buyBonusBoard(), [], this.game.betPerLine, this.cinematicHooks());

    // The reels have landed the Scatters — commit the purchase (enters Free
    // Spins, kicks off auto-play) and play the shared intro.
    await wait(ANTICIPATION.entryPauseMs);
    this.game.buyBonus(BUY_BONUS_TIER);
    this.setBackground(GameMode.FREE_SPINS);
    this.bloomElapsed = 0;

    this.cinematicActive = false;
    this.busy = false;
    this.refreshControls();
    this.refreshFreeSpinOverlay();
  }

  private setBackground(mode: GameMode): void {
    this.background.texture = Assets.get<Texture>(BACKGROUNDS[mode]);
    this.background.width = CANVAS.width;
    this.background.height = CANVAS.height;
  }

  /** Controls are live only in the base game, when idle, with enough balance. */
  private refreshControls(): void {
    const idle = !this.busy && this.game.currentMode === GameMode.BASE;
    this.hud.setSpinEnabled(idle && this.game.balance >= this.game.spinCost);
    this.hud.setBetEnabled(idle);
    this.hud.setTurboEnabled(idle);
    this.sidePanel.setEnabled(idle);
    // A bonus round owns the screen — fade the side buttons to a locked-out look
    // (a brief base spin only disables input, it doesn't trigger the heavy look).
    this.sidePanel.setLockedOut(this.game.currentMode !== GameMode.BASE);
  }

  /** Reflect the current Buy Bonus price and Luck Boost surcharge on the side panel. */
  private updateSidePanelCosts(): void {
    const bet = this.game.currentBet;
    const buyCost = bonusConfig.buyBonus[BUY_BONUS_TIER].costMultiplier * bet;
    this.sidePanel.setBuyPrice(money(buyCost));

    // Luck Boost adds the surcharge above a normal spin (e.g. 1.5x → +50% of bet).
    const luckSurcharge = (bonusConfig.chance2x.costMultiplier - 1) * bet;
    this.sidePanel.setLuckCost(`+${money(luckSurcharge)}`);
  }

  /** Queue the next bonus spin if a bonus round is still running. */
  private scheduleNextBonusSpin(): void {
    if (this.autoTimer !== null) return; // one pending at a time
    this.autoTimer = window.setTimeout(() => {
      this.autoTimer = null;
      if (
        this.game.currentMode !== GameMode.BASE &&
        this.game.currentState === GameState.IDLE
      ) {
        void this.game.spin();
      }
    }, BONUS_SPIN_DELAY);
  }

  private changeBet(direction: 1 | -1): void {
    const levels = gameConfig.betLevels as readonly number[];
    const index = levels.indexOf(this.game.betPerLine);
    const next =
      levels[Math.min(levels.length - 1, Math.max(0, index + direction))];
    if (next !== this.game.betPerLine) this.game.setBet(next);
  }

  /** Whether this free spin collected Wilds that advance the (capped) ladder. */
  private willChargeWilds(result: SpinResult): boolean {
    if (result.mode !== GameMode.FREE_SPINS || !result.freeSpins) return false;
    const collected = result.wildsCollected ?? 0;
    if (collected <= 0) return false;
    const after = Math.min(result.freeSpins.wildCounter, MAX_WILDS);
    const before = Math.min(result.freeSpins.wildCounter - collected, MAX_WILDS);
    return after > before;
  }

  /**
   * Wild Charge cinematic (Phases 2–6). For each lock between `before` and
   * `after`: focus the board, fire a curved beam from a Wild to the lock, charge
   * the lock, and — on every fourth — play the panel-complete celebration. Once
   * done, confirm the overlay's final counter + locks.
   */
  private async playWildCharges(before: number, after: number, wilds: Position[]): Promise<void> {
    const start = Math.max(0, Math.min(before, MAX_WILDS));
    const end = Math.max(0, Math.min(after, MAX_WILDS));
    if (end <= start) return;

    this.setFeatureFocus(true);
    for (let i = start; i < end; i++) {
      const wild = wilds.length > 0 ? wilds[(i - start) % wilds.length] : null;
      const from = wild
        ? this.wildGlobal(wild)
        : { x: REEL_ORIGIN.x + GRID.width / 2, y: REEL_ORIGIN.y + GRID.height / 2 };
      const to = this.freeSpinPanel.lockGlobalPosition(i);
      await this.featureBeam.fire(from, to); // Phase 2 — beam travels, Phase 3 dim is up
      const completedPanel = await this.freeSpinPanel.chargeLock(i); // Phase 4 — charge slot
      if (completedPanel) await this.freeSpinPanel.playPanelComplete(Math.floor(i / WILDS_PER_PANEL)); // Phase 6
    }
    this.setFeatureFocus(false);

    // The animation has caught up to the engine — confirm the final values.
    const s = this.game.getState();
    if (s.freeSpins) {
      this.freeSpinPanel.setRemaining(s.freeSpins.remaining);
      this.freeSpinPanel.setWildCounter(s.freeSpins.wildCounter);
    }
  }

  /** Stage-space centre of a board cell (the beam's source Wild). */
  private wildGlobal(pos: Position): { x: number; y: number } {
    return {
      x: REEL_ORIGIN.x + pos.reel * CELL.width + CELL.width / 2,
      y: REEL_ORIGIN.y + pos.row * CELL.height + CELL.height / 2,
    };
  }

  /** Fade the reels' focus dim in (beam travelling) or out (Phase 3). */
  private setFeatureFocus(active: boolean): void {
    this.featDimTarget = active ? WILD_CHARGE.reelDim : 0;
  }

  /**
   * Show the Free Spins overlay (counter + multiplier ladder) only in free
   * spins and keep its values current. The playfield's downward shift is a
   * constant baked into the layout (see PLAYFIELD_DROP), so nothing moves here.
   */
  private refreshFreeSpinOverlay(): void {
    const s = this.game.getState();
    const inFreeSpins = s.mode === GameMode.FREE_SPINS && !!s.freeSpins;
    const inHoldRespin = s.mode === GameMode.HOLD_AND_RESPIN && !!s.holdAndRespin;

    // Held back during the entry cinematic so the panel doesn't pop in over the
    // base reels before the intro plays.
    this.freeSpinPanel.visible = inFreeSpins && !this.cinematicActive;
    // While the Wild Charge cinematic is running it owns the counter + locks
    // (animating them up to the new count), so don't snap them here.
    if (s.freeSpins && !this.chargingWilds) {
      this.freeSpinPanel.setRemaining(s.freeSpins.remaining);
      this.freeSpinPanel.setWildCounter(s.freeSpins.wildCounter);
    }

    // The respin count is updated by render() once the reels land (so a landing
    // trophy resets it to 3 only after it visually arrives). Here we just set the
    // starting value as the panel first appears.
    const enteringHoldRespin = inHoldRespin && !this.holdRespinPanel.visible;
    this.holdRespinPanel.visible = inHoldRespin;
    if (enteringHoldRespin && s.holdAndRespin) {
      this.holdRespinPanel.setRemaining(s.holdAndRespin.remainingRespins);
    }
  }
}
