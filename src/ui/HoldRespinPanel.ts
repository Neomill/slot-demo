import { Assets, Container, Sprite, Text, TextStyle, type Texture } from "pixi.js";
import { FREE_SPIN } from "../assets/manifest";
import { FREE_SPIN_PANEL as L, fontFamily } from "./theme";
import { fitWidth } from "./hud/text";

// Native aspect ratio of a digit glyph, so it scales without distortion.
const DIGIT_ASPECT = 55 / 70;

/**
 * Space between counter digits, as a fraction of one digit's width (negative
 * lets them overlap). Matches the Free Spins counter for a consistent look.
 */
const DIGIT_GAP_RATIO = -0.1;

/** Gold style for the counter's "REMAINING" label (rendered as crisp text). */
const labelStyle = (size: number): TextStyle =>
  new TextStyle({
    fill: 0xe9d8a6,
    fontFamily,
    fontSize: size,
    fontWeight: "700",
    letterSpacing: 1,
    dropShadow: { color: 0x241500, alpha: 0.8, blur: 2, distance: 1 },
  });

function makeSprite(
  texture: string,
  width: number,
  height: number,
  anchorX = 0,
  anchorY = 0,
): Sprite {
  const sprite = new Sprite(Assets.get<Texture>(texture));
  sprite.anchor.set(anchorX, anchorY);
  sprite.width = width;
  sprite.height = height;
  return sprite;
}

/**
 * The Hold & Respin overlay: the same large counter plate the Free Spins panel
 * uses (same art, position, and digit glyphs), labelled "REMAINING" with the
 * respins left shown below. A pure view — shown only during Hold & Respin.
 */
export class HoldRespinPanel extends Container {
  private readonly digits: Container;
  /** The number currently drawn, so the spin start can tick it down by one. */
  private current = 0;

  constructor() {
    super();
    this.visible = false;

    const c = L.counter;
    const centerX = c.x + c.width / 2;

    const bg = makeSprite(FREE_SPIN.bgLarge, c.width, c.height);
    bg.position.set(c.x, c.y);

    const label = new Text({
      text: "REMAINING",
      style: labelStyle(Math.round(c.height * 0.16)),
    });
    label.anchor.set(0.5);
    label.position.set(centerX, c.y + c.height * 0.24);
    fitWidth(label, c.width * 0.8);

    this.digits = new Container();
    this.digits.position.set(centerX, c.y + c.height * 0.62);

    this.addChild(bg, label, this.digits);
    this.setRemaining(0);
  }

  /** Deduct one respin as the spin starts (a landed trophy/win restores it later). */
  tickDown(): void {
    this.setRemaining(this.current - 1);
  }

  /** Render the remaining-respins number from the digit glyphs, centered. */
  setRemaining(respins: number): void {
    this.current = Math.max(0, Math.floor(respins));
    this.digits.removeChildren();
    const text = String(this.current);

    const digitHeight = L.counter.height * 0.42;
    const digitWidth = digitHeight * DIGIT_ASPECT;
    const spacing = digitWidth + digitWidth * DIGIT_GAP_RATIO;
    const totalWidth = (text.length - 1) * spacing + digitWidth;

    let x = -totalWidth / 2 + digitWidth / 2;
    for (const ch of text) {
      const glyph = makeSprite(
        FREE_SPIN.digits[Number(ch)],
        digitWidth,
        digitHeight,
        0.5,
        0.5,
      );
      glyph.x = x;
      this.digits.addChild(glyph);
      x += spacing;
    }
  }
}
