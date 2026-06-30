import { Container } from 'pixi.js';
import { SIDE } from '../assets/manifest';
import { SIDE_PANEL as L } from './theme';
import { SidePanelButton } from './SidePanelButton';

export interface SidePanelCallbacks {
  onBuyBonus: () => void;
  onBuyHoldRespin: () => void;
}

/**
 * The pair of call-to-action panels stacked in the margin left of the reels:
 * Buy Bonus above Buy Hold & Respin. Both are momentary buy buttons. A pure
 * view — it lays the two panels out from the layout tokens, forwards taps via
 * callbacks, and exposes a small imperative API (prices / enabled / locked-out).
 */
export class SidePanel extends Container {
  private readonly buy: SidePanelButton;
  private readonly holdRespin: SidePanelButton;

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

    this.holdRespin = new SidePanelButton({
      width: L.width,
      height: L.height,
      texture: SIDE.buyHoldRespin,
      plateY: 0.86,
      onPress: callbacks.onBuyHoldRespin,
    });
    this.holdRespin.position.set(L.centerX, L.luckY);

    this.addChild(this.buy, this.holdRespin);
  }

  /** Advance the lit/dull easing on both panels. Call once per frame (ms). */
  update(dtMs: number): void {
    this.buy.update(dtMs);
    this.holdRespin.update(dtMs);
  }

  /** Show the cost of buying the bonus on the Buy Bonus plate. */
  setBuyPrice(text: string): void {
    this.buy.setPlateText(text);
  }

  /** Show the cost of buying Hold & Respin on its plate. */
  setHoldRespinPrice(text: string): void {
    this.holdRespin.setPlateText(text);
  }

  /** Live only while idle in the base game (mirrors the bet/turbo controls). */
  setEnabled(enabled: boolean): void {
    this.buy.setEnabled(enabled);
    this.holdRespin.setEnabled(enabled);
  }

  /**
   * Ease both panels into / out of the "locked out" look while a bonus round
   * owns the screen (they can't be bought during Free Spins or Hold & Respin).
   * Separate from {@link setEnabled} so a brief base spin stays subtle.
   */
  setLockedOut(lockedOut: boolean): void {
    this.buy.setLockedOut(lockedOut);
    this.holdRespin.setLockedOut(lockedOut);
  }
}
