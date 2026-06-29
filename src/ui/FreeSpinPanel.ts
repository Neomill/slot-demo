import {
  Assets,
  Container,
  Sprite,
  Text,
  TextStyle,
  type Texture,
} from "pixi.js";
import { FREE_SPIN } from "../assets/manifest";
import { FREE_SPIN_PANEL as L, fontFamily } from "./theme";
import { fitWidth } from "./hud/text";

// Native aspect ratios of the art, so each piece scales without distortion.
const LOCK_ASPECT = 20 / 24;
const DIGIT_ASPECT = 55 / 70;

const WILDS_PER_PANEL = L.wildsPerPanel;

/** Crisp gold style for the "+10 FREE SPIN ×N" banner (rendered as text). */
const bannerStyle = (size: number): TextStyle =>
  new TextStyle({
    fill: 0xe9d8a6,
    fontFamily,
    fontSize: size,
    fontWeight: "500",
    letterSpacing: 0.5,
    dropShadow: { color: 0x241500, alpha: 0.8, blur: 2, distance: 1 },
  });

/** Gold style for the counter's "FREE SPINS" label (rendered as text). */
const counterLabelStyle = (size: number): TextStyle =>
  new TextStyle({
    fill: 0xe9d8a6,
    fontFamily,
    fontSize: size,
    fontWeight: "700",
    letterSpacing: 1,
    dropShadow: { color: 0x241500, alpha: 0.8, blur: 2, distance: 1 },
  });

/**
 * Space between counter digits, as a fraction of one digit's width. Lower it to
 * pull the digits closer (e.g. tighten two-digit numbers); a negative value lets
 * them overlap.
 */
const DIGIT_GAP_RATIO = -0.1;

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
 * One multiplier panel: the small background plate, the "+10 FREE SPIN ×N"
 * banner (crisp Pixi text) across the top, and the four wild locks across the
 * bottom. Laid out at its own local origin (top-left at 0,0) so the parent just
 * positions it; as wilds are collected, locks flip to the unlocked (gold)
 * texture left to right.
 */
class MultiplierPanel extends Container {
  private readonly locks: Sprite[] = [];

  constructor(multiplier: number) {
    super();
    const { width: pw, height: ph } = L.panel;
    const centerX = pw / 2;

    const bg = makeSprite(FREE_SPIN.bgSmall, pw, ph);
    this.addChild(bg);

    const banner = new Text({
      text: `+10 FREE SPIN ×${multiplier}`,
      style: bannerStyle(Math.round(ph * 0.23)),
    });
    banner.anchor.set(0.5);
    banner.position.set(centerX, ph * 0.3);
    fitWidth(banner, pw * 0.86); // shrink to fit, never blurs (text re-rasterizes)
    this.addChild(banner);

    const lockHeight = ph * 0.36;
    const lockWidth = lockHeight * LOCK_ASPECT;
    const spacing = lockWidth + lockWidth * 0.5;
    const firstX = centerX - (spacing * (WILDS_PER_PANEL - 1)) / 2;
    const lockY = ph * 0.7;
    for (let j = 0; j < WILDS_PER_PANEL; j++) {
      const lock = makeSprite(
        FREE_SPIN.wildLock,
        lockWidth,
        lockHeight,
        0.5,
        0.5,
      );
      lock.position.set(firstX + j * spacing, lockY);
      this.locks.push(lock);
      this.addChild(lock);
    }
  }

  /** Show `count` of this panel's four locks as unlocked (the rest stay locked). */
  setUnlocked(count: number): void {
    const lockTex = Assets.get<Texture>(FREE_SPIN.wildLock);
    const unlockTex = Assets.get<Texture>(FREE_SPIN.wildUnlock);
    this.locks.forEach((lock, j) => {
      lock.texture = j < count ? unlockTex : lockTex;
    });
  }
}

/**
 * The Free Spins overlay. A pure view shown only during Free Spins: a large
 * remaining-spins counter pinned to the frame's left edge, and three multiplier
 * panels (×2 / ×3 / ×10) in a row right-aligned to the frame's edge. The wild
 * locks across the three panels mirror the engine's 12-wild progression — every
 * fourth wild fills the next panel and steps up the multiplier (see the game
 * rules' Retrigger During Free Spins).
 */
export class FreeSpinPanel extends Container {
  private readonly panels: MultiplierPanel[];
  private readonly digits: Container;

  constructor() {
    super();
    this.visible = false;

    // Left: the large remaining-spins counter (label on top, number below) —
    // both crisp Pixi text rather than bitmap art.
    const c = L.counter;
    const centerX = c.x + c.width / 2;

    const bg = makeSprite(FREE_SPIN.bgLarge, c.width, c.height);
    bg.position.set(c.x, c.y);

    const label = new Text({
      text: "FREE SPINS",
      style: counterLabelStyle(Math.round(c.height * 0.16)),
    });
    label.anchor.set(0.5);
    label.position.set(centerX, c.y + c.height * 0.24);
    fitWidth(label, c.width * 0.8);

    this.digits = new Container();
    this.digits.position.set(centerX, c.y + c.height * 0.62);

    this.addChild(bg, label, this.digits);

    // Right: the three multiplier panels in a row, right-aligned to the frame,
    // with their bottoms at baseY. Multipliers match the wild-progression stages.
    const multipliers = [2, 3, 10];
    const { width: pw, height: ph, gap, rightX, nudgeY } = L.panel;
    const totalWidth = multipliers.length * pw + (multipliers.length - 1) * gap;
    const startX = rightX - totalWidth;
    const topY = L.baseY - ph + nudgeY;
    this.panels = multipliers.map((multiplier, i) => {
      const panel = new MultiplierPanel(multiplier);
      panel.position.set(startX + i * (pw + gap), topY);
      this.addChild(panel);
      return panel;
    });

    this.setRemaining(0);
    this.setWildCounter(0);
  }

  /** Render the remaining-spins number from the digit glyphs, centered. */
  setRemaining(spins: number): void {
    this.digits.removeChildren();
    const text = String(Math.max(0, Math.floor(spins)));

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

  /**
   * Reflect the running wild count (0..12) across the three panels: each panel
   * holds four locks, and they unlock left-to-right as the count climbs.
   */
  setWildCounter(wildCounter: number): void {
    const max = WILDS_PER_PANEL * this.panels.length;
    const filled = Math.max(0, Math.min(wildCounter, max));
    this.panels.forEach((panel, i) => {
      const unlocked = Math.max(
        0,
        Math.min(filled - i * WILDS_PER_PANEL, WILDS_PER_PANEL),
      );
      panel.setUnlocked(unlocked);
    });
  }
}
