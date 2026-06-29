import { Container, Graphics } from 'pixi.js';
import { CONTROL } from '../../assets/manifest';
import { hudColors as C } from '../theme';
import { ANCHORS, BAR, BUTTON, GAP, PANEL, SLOT, SPIN } from './layout';
import { ControlPanel } from './ControlPanel';
import { IconButton } from './IconButton';
import { SpinButton } from './SpinButton';
import { StatDisplay } from './StatDisplay';
import { BetControl } from './BetControl';
import { money } from './text';

export interface HudCallbacks {
  onSpin: () => void;
  onBet: (direction: 1 | -1) => void;
  onTurbo: () => void;
  onMenu: () => void;
}

/**
 * The game controller. A pure view that composes the control components, lays
 * them out from the layout tokens, and exposes a small imperative API
 * (setBalance / setBet / setWin / …). It renders what it's told and reports
 * input via callbacks — it never reads or mutates game state.
 */
export class Hud extends Container {
  private readonly balance: StatDisplay;
  private readonly bet: BetControl;
  private readonly win: StatDisplay;
  private readonly spin: SpinButton;
  private readonly menu: IconButton;
  private readonly turbo: IconButton;

  // WIN counts up smoothly toward its target (driven by update()).
  private winShown = 0;
  private winTarget = 0;

  // BALANCE eases toward its target in both directions — up when it's credited,
  // down when a bet is placed (driven by update()).
  private balanceShown = 0;
  private balanceTarget = 0;

  constructor(callbacks: HudCallbacks) {
    super();

    const cy = BAR.centerY;

    const panel = new ControlPanel(PANEL.x, PANEL.width);

    this.menu = new IconButton({ texture: CONTROL.menu, diameter: BUTTON.diameter, onPress: callbacks.onMenu });
    this.menu.position.set(ANCHORS.menuX, cy);

    this.balance = new StatDisplay('BALANCE', SLOT.balance);
    this.balance.position.set(ANCHORS.balanceX, cy);

    const divider = new Graphics()
      .rect(ANCHORS.dividerX - 1, BAR.top + 32, 2, BAR.height - 64)
      .fill({ color: C.gold, alpha: 0.5 });

    this.bet = new BetControl(SLOT.bet, GAP.betStep, callbacks.onBet);
    this.bet.position.set(ANCHORS.betX, cy);

    this.spin = new SpinButton(CONTROL.spin, SPIN.width, SPIN.height, callbacks.onSpin);
    this.spin.position.set(ANCHORS.spinX, ANCHORS.spinY);

    this.win = new StatDisplay('WIN', SLOT.win);
    this.win.position.set(ANCHORS.winX, cy);

    this.turbo = new IconButton({ texture: CONTROL.turbo, diameter: BUTTON.diameter, onPress: callbacks.onTurbo });
    this.turbo.position.set(ANCHORS.turboX, cy);

    // Panel behind everything; spin on top so its hover scale never clips.
    this.addChild(panel, this.menu, this.balance, divider, this.bet, this.win, this.turbo, this.spin);
  }

  /** Advance the WIN and BALANCE counters. Call once per frame with the delta (ms). */
  update(dtMs: number): void {
    if (this.winShown !== this.winTarget) {
      this.winShown += (this.winTarget - this.winShown) * Math.min(1, dtMs / 220);
      if (Math.abs(this.winTarget - this.winShown) < 0.5) this.winShown = this.winTarget;
      this.win.setValue(money(this.winShown));
    }
    if (this.balanceShown !== this.balanceTarget) {
      this.balanceShown += (this.balanceTarget - this.balanceShown) * Math.min(1, dtMs / 220);
      if (Math.abs(this.balanceTarget - this.balanceShown) < 0.5) this.balanceShown = this.balanceTarget;
      this.balance.setValue(money(this.balanceShown));
    }
  }

  /** Set the BALANCE target; it eases there. `snap` jumps instantly (e.g. on init). */
  setBalance(value: number, snap = false): void {
    this.balanceTarget = value;
    if (snap) {
      this.balanceShown = value;
      this.balance.setValue(money(value));
    }
  }

  setBet(value: number): void {
    this.bet.setValue(money(value));
  }

  /** Set the WIN target. Counts up to it; snaps down instantly (e.g. reset to 0). */
  setWin(value: number): void {
    this.winTarget = value;
    if (value <= this.winShown) {
      this.winShown = value;
      this.win.setValue(money(value));
    }
  }

  /** Set the WIN caption ("WIN" in base, "TOTAL WIN" during a bonus). */
  setWinLabel(text: string): void {
    this.win.setCaption(text);
  }

  setTurbo(active: boolean): void {
    this.turbo.setActive(active);
  }

  setSpinEnabled(enabled: boolean): void {
    this.spin.setEnabled(enabled);
  }

  setBetEnabled(enabled: boolean): void {
    this.bet.setEnabled(enabled);
  }

  setTurboEnabled(enabled: boolean): void {
    this.turbo.setEnabled(enabled);
  }
}
