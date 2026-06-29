import { Container } from 'pixi.js';
import { SIDE } from '../assets/manifest';
import { SIDE_PANEL as L } from './theme';
import { SidePanelButton } from './SidePanelButton';

export interface SidePanelCallbacks {
  onBuyBonus: () => void;
  onToggleLuckBoost: () => void;
}

/**
 * The pair of call-to-action panels stacked in the margin left of the reels:
 * Buy Bonus (a momentary button) above Luck Boost (an on/off toggle). A pure
 * view — it lays the two panels out from the layout tokens, forwards taps via
 * callbacks, and exposes a small imperative API (price / toggle / enabled).
 */
export class SidePanel extends Container {
  private readonly buy: SidePanelButton;
  private readonly luck: SidePanelButton;

  constructor(callbacks: SidePanelCallbacks) {
    super();

    this.buy = new SidePanelButton({
      width: L.width,
      height: L.height,
      texture: SIDE.buyBonus,
      plateY: 0.845,
      onPress: callbacks.onBuyBonus,
    });
    this.buy.position.set(L.centerX, L.buyY);

    this.luck = new SidePanelButton({
      width: L.width,
      height: L.height,
      texture: SIDE.luckOff,
      activeTexture: SIDE.luckOn,
      plateY: 0.852,
      onPress: callbacks.onToggleLuckBoost,
    });
    this.luck.position.set(L.centerX, L.luckY);

    this.addChild(this.buy, this.luck);
  }

  /** Advance the lit/dull easing on both panels. Call once per frame (ms). */
  update(dtMs: number): void {
    this.buy.update(dtMs);
    this.luck.update(dtMs);
  }

  /** Show the cost of buying the bonus on the Buy Bonus plate. */
  setBuyPrice(text: string): void {
    this.buy.setPlateText(text);
  }

  /** Reflect the Luck Boost (Chance x2) on/off state. */
  setLuckBoost(active: boolean): void {
    this.luck.setActive(active);
  }

  /** Show the surcharge that enabling Luck Boost adds (e.g. "+7.50"). */
  setLuckCost(text: string): void {
    this.luck.setPlateText(text);
  }

  /** Live only while idle in the base game (mirrors the bet/turbo controls). */
  setEnabled(enabled: boolean): void {
    this.buy.setEnabled(enabled);
    this.luck.setEnabled(enabled);
  }
}
