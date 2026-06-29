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
import { WILD } from "../config/symbols";
import type { SymbolId } from "../config/symbols";
import type { Position, SpinResult } from "../types/slot";
import {
  BACKGROUNDS,
  FRAME as FRAME_TEXTURE,
  LOGO,
  ALL_ASSET_URLS,
} from "../assets/manifest";
import {
  BACKDROP,
  CANVAS,
  FRAME,
  FRAME_POS,
  GRID,
  HUD_POS,
  REEL_ORIGIN,
} from "./theme";
import { Reels } from "./Reels";
import { Hud } from "./hud";
import { SidePanel } from "./SidePanel";
import { FreeSpinPanel } from "./FreeSpinPanel";
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

/** Pause between auto-played bonus spins (free spins / hold & respin). */
const BONUS_SPIN_DELAY = 700;

/** Which bonus tier the Buy Bonus panel purchases. */
const BUY_BONUS_TIER: BuyBonusTier = "super";

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
  private autoTimer: number | null = null;
  private busy = false; // true while a spin animation is playing

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
    });
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
      onBuyBonus: () => this.game.buyBonus(BUY_BONUS_TIER),
      onToggleLuckBoost: () => this.game.setChance2x(!this.game.isChance2x),
    });

    this.freeSpinPanel = new FreeSpinPanel();

    // background → backdrop → reels → frame → logo → side panels → free-spin
    // overlay → HUD
    stage.addChild(
      this.background,
      this.backdrop,
      this.reels,
      this.frame,
      logo,
      this.sidePanel,
      this.freeSpinPanel,
      this.hud,
    );
  }

  private subscribe(): void {
    const { events } = this.game;

    events.on(GameEvent.ModeChange, ({ to }) => {
      this.setBackground(to);
      this.refreshControls(); // entering/leaving a bonus mode flips the spin button immediately
      this.refreshFreeSpinOverlay();
    });
    events.on(GameEvent.SpinResult, ({ result }) => void this.render(result));
    events.on(GameEvent.SpinStart, () => this.hud.setWin(0));
    events.on(GameEvent.BalanceChange, ({ balance }) => {
      this.hud.setBalance(balance);
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
      this.refreshFreeSpinOverlay();
      // A bought bonus has no triggering spin, so start the auto-play here.
      if (trigger === "buy") this.scheduleNextBonusSpin();
    });
    events.on(GameEvent.WildsCollected, () => this.refreshFreeSpinOverlay());
    events.on(GameEvent.HoldRespinStart, () => this.refreshFreeSpinOverlay());
    events.on(GameEvent.HoldRespinUpdate, () => this.refreshFreeSpinOverlay());
  }

  private async render(result: SpinResult): Promise<void> {
    this.busy = true; // lock the spin button for the whole animation
    this.refreshControls();
    this.reels.clearWins();

    if (result.mode === GameMode.HOLD_AND_RESPIN && result.holdAndRespin) {
      this.reels.showLocked(result.grid, result.holdAndRespin.locked);
    } else {
      // Prize values are baked into the landing tiles, so they scroll in with the reel.
      await this.reels.spin(result.grid, result.prizes, this.game.betPerLine);
    }

    // Spin Results: animate the winning paylines.
    if (result.lineWins.length > 0) {
      this.reels.showWins(result.lineWins.flatMap((win) => win.positions));
    }

    // Free spins: Wilds collect the prizes — detach the badges and fly them into the Wild.
    if (result.mode === GameMode.FREE_SPINS && (result.collectWin ?? 0) > 0) {
      await this.reels.collectIntoWild(
        result.prizes,
        wildPositions(result.grid),
        this.game.betPerLine,
      );
    }

    this.hud.setWin(result.totalWin);
    this.busy = false;
    this.refreshControls();
    this.refreshFreeSpinOverlay();

    // Auto-play bonus rounds until they finish (respects retriggers, which keep
    // the mode non-BASE by adding spins / resetting respins).
    if (this.game.currentMode !== GameMode.BASE) this.scheduleNextBonusSpin();
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

  /**
   * Show the Free Spins overlay (counter + multiplier ladder) only in free
   * spins and keep its values current. The playfield's downward shift is a
   * constant baked into the layout (see PLAYFIELD_DROP), so nothing moves here.
   */
  private refreshFreeSpinOverlay(): void {
    const s = this.game.getState();
    const inFreeSpins = s.mode === GameMode.FREE_SPINS && !!s.freeSpins;

    this.freeSpinPanel.visible = inFreeSpins;
    if (s.freeSpins) {
      this.freeSpinPanel.setRemaining(s.freeSpins.remaining);
      this.freeSpinPanel.setWildCounter(s.freeSpins.wildCounter);
    }
  }
}
