import {
  Assets,
  BlurFilter,
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  type Texture,
} from "pixi.js";
import { FREE_SPIN } from "../assets/manifest";
import { FREE_SPIN_PANEL as L, HOLD_RESPIN_FX as FX, colors, fontFamily } from "./theme";
import { fitWidth } from "./hud/text";

// Native aspect ratio of a digit glyph, so it scales without distortion.
const DIGIT_ASPECT = 55 / 70;

/**
 * Space between counter digits, as a fraction of one digit's width (negative
 * lets them overlap). Matches the Free Spins counter for a consistent look.
 */
const DIGIT_GAP_RATIO = -0.1;

/** Gold flash bloom peak behind the number during a "Golden Rewind" reset. */
const FLASH_PEAK = 0.55;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Overshoots past the target then settles — a number "slamming" into place. */
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

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

type AnimKind = "entrance" | "rewindOut" | "rewindIn";

interface Anim {
  kind: AnimKind;
  elapsed: number;
  duration: number;
  resolve: () => void;
}

/**
 * The Hold & Respin overlay: the same large counter plate the Free Spins panel
 * uses (same art, position, and digit glyphs), labelled "REMAINING" with the
 * respins left shown below. Beyond a plain read-out it plays two beats: the
 * number "drops" in on entry (playEntrance), and on a refill it runs a "Golden
 * Rewind" — the old number bursts in a gold flash and the new one slams down
 * (settleRemaining / playGoldenRewind). A pure view — shown only during the
 * feature; the scene tells it what number to show.
 */
export class HoldRespinPanel extends Container {
  private readonly digits: Container;
  /** Soft gold bloom behind the number, lit only during a Golden Rewind. */
  private readonly flash: Graphics;
  /** The number currently drawn, so the spin start can tick it down by one. */
  private current = 0;
  private anim: Anim | null = null;

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

    this.flash = new Graphics()
      .circle(0, 0, c.height * 0.34)
      .fill({ color: colors.accent });
    this.flash.position.set(centerX, c.y + c.height * 0.62);
    this.flash.blendMode = "add";
    this.flash.filters = [new BlurFilter({ strength: 16, quality: 2 })];
    this.flash.alpha = 0;

    this.digits = new Container();
    this.digits.position.set(centerX, c.y + c.height * 0.62);

    this.addChild(bg, label, this.flash, this.digits);
    this.setRemaining(0);
  }

  /** Advance any in-flight number animation. Call once per frame with the delta (ms). */
  update(dtMs: number): void {
    const a = this.anim;
    if (!a) return;
    a.elapsed += dtMs;
    const t = Math.min(1, a.elapsed / a.duration);

    if (a.kind === "entrance") {
      const e = easeOutBack(t);
      this.digits.scale.set(lerp(1.8, 1, e));
      this.digits.alpha = Math.min(1, t * 2);
    } else if (a.kind === "rewindOut") {
      this.digits.scale.set(lerp(1, 1.6, t * t)); // old number swells...
      this.digits.alpha = 1 - t; // ...and burns out
      this.flash.alpha = FLASH_PEAK * t;
    } else {
      // rewindIn — the new number slams down out of the flash.
      this.digits.scale.set(lerp(1.6, 1, easeOutBack(t)));
      this.digits.alpha = Math.min(1, t * 1.5);
      this.flash.alpha = FLASH_PEAK * (1 - t);
    }

    if (t >= 1) {
      if (a.kind !== "rewindOut") {
        this.digits.scale.set(1);
        this.digits.alpha = 1;
      }
      if (a.kind === "rewindIn" || a.kind === "entrance") this.flash.alpha = 0;
      const done = a.resolve;
      this.anim = null;
      done();
    }
  }

  /** Deduct one respin as the spin starts (a landed trophy/win restores it later). */
  tickDown(): void {
    this.setRemaining(this.current - 1);
  }

  /**
   * Settle to the engine's respin count once the reels land. If the count went
   * back UP — a new trophy locked, or a win refilled it — play the Golden Rewind
   * reset; otherwise just show the (ticked-down) number.
   */
  async settleRemaining(value: number): Promise<void> {
    if (value > this.current) {
      await this.playGoldenRewind(value);
    } else {
      this.setRemaining(value);
    }
  }

  /** The "number drop" as the panel first appears. */
  playEntrance(): void {
    this.digits.alpha = 0;
    this.digits.scale.set(1.8);
    void this.animate("entrance", FX.entranceMs);
  }

  /** Old number bursts in a gold flash; the new one slams down in its place. */
  async playGoldenRewind(value: number): Promise<void> {
    await this.animate("rewindOut", FX.rewindOutMs);
    this.setRemaining(value);
    this.digits.scale.set(1.6);
    this.digits.alpha = 0;
    await this.animate("rewindIn", FX.rewindInMs);
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

  /** Start an animation, cancelling (resolving) any one already in flight. */
  private animate(kind: AnimKind, duration: number): Promise<void> {
    if (this.anim) {
      const prev = this.anim.resolve;
      this.anim = null;
      prev();
    }
    return new Promise((resolve) => {
      this.anim = { kind, elapsed: 0, duration, resolve };
    });
  }
}
