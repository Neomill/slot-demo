import { Application, Assets, Graphics, Sprite, Text, type Ticker, type Texture } from 'pixi.js';
import type { Game } from '../game/Game';
import { GameMode } from '../core/GameMode';
import { GameEvent } from '../types/events';
import type { SymbolId } from '../config/symbols';
import type { SpinResult } from '../types/slot';
import { BACKGROUNDS, FRAME as FRAME_TEXTURE, LOGO, ALL_ASSET_URLS } from '../assets/manifest';
import { BACKDROP, CANVAS, FRAME, FRAME_POS, GRID, REEL_ORIGIN, fontFamily, colors } from './theme';
import { Reels } from './Reels';

// Pleasant resting board shown before the first spin.
const INITIAL_GRID: SymbolId[][] = [
  ['goldhorse', 'ten', 'jack'],
  ['redhorse', 'queen', 'king'],
  ['bluehorse', 'ace', 'jocky'],
  ['cap', 'ten', 'binoculars'],
  ['shoehorse', 'king', 'queen'],
];

/**
 * The PixiJS slot view. Owns the renderer and the on-screen pieces (background,
 * reels, frame, logo, status), and reacts to engine events. It is a one-way
 * mirror: it never owns game state or computes outcomes — drive it from the
 * console via `game.spin()` / `game.buyBonus()` / `game.setChance2x()`.
 */
export class SlotScene {
  readonly app: Application;
  private readonly game: Game;
  private background!: Sprite;
  private reels!: Reels;
  private status!: Text;

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

    // Preload every asset up front so the first render is instant.
    await Assets.load(ALL_ASSET_URLS);

    this.build();
    this.subscribe();
    await this.game.init();
    this.updateStatus();

    this.app.ticker.add((ticker: Ticker) => this.reels.update(ticker.deltaMS));
  }

  private build(): void {
    const stage = this.app.stage;

    this.background = new Sprite(Assets.get<Texture>(BACKGROUNDS[GameMode.BASE]));
    this.background.width = CANVAS.width;
    this.background.height = CANVAS.height;

    // Semi-transparent black panel inside the frame, behind the reels.
    // Dimensions/look are tunable in theme.ts -> BACKDROP.
    const backdrop = new Graphics()
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

    const frame = new Sprite(Assets.get<Texture>(FRAME_TEXTURE));
    frame.position.set(FRAME_POS.x, FRAME_POS.y);
    frame.width = FRAME.width;
    frame.height = FRAME.height;

    const logo = new Sprite(Assets.get<Texture>(LOGO));
    logo.anchor.set(0.5, 0);
    logo.position.set(CANVAS.width / 2, 24);

    this.status = new Text({
      text: '',
      style: { fill: colors.text, fontFamily, fontSize: 28, fontWeight: '700' },
    });
    this.status.anchor.set(0.5, 0);
    this.status.position.set(CANVAS.width / 2, FRAME_POS.y + FRAME.height + 18);

    // Order: background → backdrop → reels → frame (window shows reels) → logo → status.
    stage.addChild(this.background, backdrop, this.reels, frame, logo, this.status);
  }

  private subscribe(): void {
    const { events } = this.game;
    events.on(GameEvent.ModeChange, ({ to }) => this.setBackground(to));
    events.on(GameEvent.SpinResult, ({ result }) => this.render(result));
    events.on(GameEvent.SpinSettled, () => this.updateStatus());
    events.on(GameEvent.FreeSpinsStart, () => this.updateStatus());
    events.on(GameEvent.WildsCollected, () => this.updateStatus());
    events.on(GameEvent.HoldRespinStart, () => this.updateStatus());
    events.on(GameEvent.HoldRespinUpdate, () => this.updateStatus());
  }

  private render(result: SpinResult): void {
    if (result.mode === GameMode.HOLD_AND_RESPIN && result.holdAndRespin) {
      this.reels.showLocked(result.grid, result.holdAndRespin.locked);
    } else {
      void this.reels.spin(result.grid);
    }
    this.updateStatus();
  }

  private setBackground(mode: GameMode): void {
    this.background.texture = Assets.get<Texture>(BACKGROUNDS[mode]);
    this.background.width = CANVAS.width;
    this.background.height = CANVAS.height;
  }

  private updateStatus(): void {
    const s = this.game.getState();
    let text = `${GameMode[s.mode]}  ·  balance ${s.balance}  ·  bet ${s.currentBet}`;
    if (s.freeSpins) {
      text += `   |   FREE SPINS ×${s.freeSpins.multiplier} · ${s.freeSpins.remaining} left · wilds ${s.freeSpins.wildCounter}`;
    }
    if (s.holdAndRespin) {
      text += `   |   HOLD & RESPIN · ${s.holdAndRespin.remainingRespins} respins`;
    }
    this.status.text = text;
  }
}
