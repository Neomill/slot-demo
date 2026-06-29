import { Container, Graphics, Text } from 'pixi.js';
import { HUD, fontFamily, hudColors as C } from './theme';

export interface HudCallbacks {
  onSpin: () => void;
  onBet: (direction: 1 | -1) => void;
  onTurbo: () => void;
  onMenu: () => void;
}

const W = HUD.width;
const BAR_TOP = 22;
const BAR_H = 96;
const RADIUS = 24;
const CY = BAR_TOP + BAR_H / 2; // vertical center of the bar content

function money(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---- drawn icons (centered on 0,0) -----------------------------------------
function drawHamburger(g: Graphics): void {
  const w = 20;
  for (const y of [-7, 0, 7]) g.roundRect(-w / 2, y - 1.5, w, 3, 1.5);
  g.fill({ color: C.gold });
}
function drawMinus(g: Graphics): void {
  g.roundRect(-8, -1.5, 16, 3, 1.5).fill({ color: C.gold });
}
function drawPlus(g: Graphics): void {
  g.roundRect(-8, -1.5, 16, 3, 1.5).roundRect(-1.5, -8, 3, 16, 1.5).fill({ color: C.gold });
}
function drawBolt(g: Graphics): void {
  g.poly([4, -13, -6, 3, 0, 3, -4, 13, 8, -4, 1, -4]).fill({ color: C.gold });
}

// ---- a round icon button ----------------------------------------------------
class CircleButton extends Container {
  private enabled = true;
  private readonly onClick: () => void;
  private readonly activeRing: Graphics;

  constructor(radius: number, drawIcon: (g: Graphics) => void, onClick: () => void) {
    super();
    this.onClick = onClick;

    this.activeRing = new Graphics()
      .circle(0, 0, radius + 2)
      .stroke({ width: 3, color: C.goldBright });
    this.activeRing.visible = false;

    const body = new Graphics()
      .circle(0, 0, radius)
      .fill({ color: C.buttonFill })
      .circle(0, 0, radius)
      .stroke({ width: 2.5, color: C.gold });

    const icon = new Graphics();
    drawIcon(icon);

    this.addChild(this.activeRing, body, icon);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointertap', () => this.enabled && this.onClick());
    this.on('pointerover', () => (this.scale.set(1.06)));
    this.on('pointerout', () => (this.scale.set(1)));
  }

  setActive(active: boolean): void {
    this.activeRing.visible = active;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.alpha = enabled ? 1 : 0.45;
    this.eventMode = enabled ? 'static' : 'none';
  }
}

// ---- the big green SPIN button ----------------------------------------------
class SpinButton extends Container {
  private enabled = true;
  private readonly onClick: () => void;

  constructor(width: number, height: number, onClick: () => void) {
    super();
    this.onClick = onClick;
    const r = height / 2;

    const body = new Graphics();
    body.roundRect(-width / 2, -height / 2, width, height, r).fill({ color: C.greenDark });
    body.roundRect(-width / 2, -height / 2, width, height, r).fill({ color: C.green });
    // glossy top highlight
    body.roundRect(-width / 2 + 8, -height / 2 + 6, width - 16, height * 0.42, r * 0.7)
      .fill({ color: C.greenLight, alpha: 0.55 });
    // gold ring
    body.roundRect(-width / 2, -height / 2, width, height, r).stroke({ width: 4, color: C.gold });

    const label = new Text({
      text: 'SPIN',
      style: { fill: C.value, fontFamily, fontSize: 34, fontWeight: '800', letterSpacing: 1 },
    });
    label.anchor.set(0.5);
    label.y = -10;

    const sub = new Text({
      text: 'HOLD FOR AUTO',
      style: { fill: 0xdCE7d8, fontFamily, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
    });
    sub.anchor.set(0.5);
    sub.y = 20;

    this.addChild(body, label, sub);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointertap', () => this.enabled && this.onClick());
    this.on('pointerover', () => this.scale.set(1.04));
    this.on('pointerout', () => this.scale.set(1));
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.alpha = enabled ? 1 : 0.5;
    this.eventMode = enabled ? 'static' : 'none';
  }
}

/**
 * The game controller bar, drawn entirely in Pixi. Pure view: it renders values
 * it's told and reports clicks via callbacks — it never touches the engine.
 */
export class Hud extends Container {
  private readonly balanceValue: Text;
  private readonly betValue: Text;
  private readonly winValue: Text;
  private readonly spinButton: SpinButton;
  private readonly turboButton: CircleButton;

  constructor(callbacks: HudCallbacks) {
    super();

    this.addChild(this.buildBar());

    // left: menu
    const menu = new CircleButton(30, drawHamburger, callbacks.onMenu);
    menu.position.set(46, CY);

    // balance readout
    const balance = this.makeStat('BALANCE', 84, 'left');
    this.balanceValue = balance.value;

    // bet: label + recessed box + steppers
    const betCx = 268;
    const bet = this.makeStat('BET', betCx, 'center');
    this.betValue = bet.value;
    const betBox = new Graphics()
      .roundRect(betCx - 42, CY - 1, 84, 30, 8)
      .fill({ color: C.box })
      .roundRect(betCx - 42, CY - 1, 84, 30, 8)
      .stroke({ width: 1.5, color: C.gold, alpha: 0.6 });
    this.betValue.position.set(betCx, CY + 14);
    const minus = new CircleButton(15, drawMinus, () => callbacks.onBet(-1));
    minus.position.set(betCx - 60, CY + 14);
    const plus = new CircleButton(15, drawPlus, () => callbacks.onBet(1));
    plus.position.set(betCx + 60, CY + 14);

    // center: spin
    this.spinButton = new SpinButton(140, 100, callbacks.onSpin);
    this.spinButton.position.set(W / 2, 58);

    // win readout
    const win = this.makeStat('WIN', W - 86, 'right', C.win);
    this.winValue = win.value;

    // right: turbo / chance x2
    this.turboButton = new CircleButton(30, drawBolt, callbacks.onTurbo);
    this.turboButton.position.set(W - 46, CY);

    this.addChild(
      menu,
      balance.node,
      bet.node,
      betBox,
      this.betValue,
      minus,
      plus,
      win.node,
      this.turboButton,
      this.spinButton,
    );
  }

  setBalance(value: number): void {
    this.balanceValue.text = money(value);
  }
  setBet(value: number): void {
    this.betValue.text = money(value);
  }
  setWin(value: number): void {
    this.winValue.text = money(value);
  }
  setTurbo(active: boolean): void {
    this.turboButton.setActive(active);
  }
  setSpinEnabled(enabled: boolean): void {
    this.spinButton.setEnabled(enabled);
  }

  private buildBar(): Graphics {
    const bar = new Graphics();
    bar.roundRect(0, BAR_TOP, W, BAR_H, RADIUS).fill({ color: C.barBottom });
    // top sheen
    bar.roundRect(0, BAR_TOP, W, BAR_H * 0.55, RADIUS).fill({ color: C.barTop, alpha: 0.55 });
    // gold outline
    bar.roundRect(0, BAR_TOP, W, BAR_H, RADIUS).stroke({ width: 2.5, color: C.gold, alpha: 0.9 });
    return bar;
  }

  /** A label above a value; the value Text is returned so callers can update it. */
  private makeStat(
    label: string,
    x: number,
    align: 'left' | 'center' | 'right',
    valueColor: number = C.value,
  ): { node: Container; value: Text } {
    const node = new Container();
    const anchorX = align === 'left' ? 0 : align === 'center' ? 0.5 : 1;

    const caption = new Text({
      text: label,
      style: { fill: C.label, fontFamily, fontSize: 14, fontWeight: '700', letterSpacing: 1.5 },
    });
    caption.anchor.set(anchorX, 0.5);
    caption.position.set(x, CY - 14);

    const value = new Text({
      text: '0.00',
      style: { fill: valueColor, fontFamily, fontSize: 26, fontWeight: '800' },
    });
    value.anchor.set(anchorX, 0.5);
    value.position.set(x, CY + 14);

    node.addChild(caption, value);
    return { node, value };
  }
}
