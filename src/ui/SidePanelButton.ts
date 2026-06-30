import {
  Assets,
  BlurFilter,
  ColorMatrixFilter,
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  type Texture,
} from "pixi.js";
import { fontFamily, SIDE_PANEL_LOOK as LOOK } from "./theme";
import { fitWidth } from "./hud/text";

export interface SidePanelButtonOptions {
  /** Rendered width; height follows the art's aspect. */
  width: number;
  height: number;
  /** Idle / off-state texture URL. */
  texture: string;
  /** Optional on-state texture (makes this a toggle). */
  activeTexture?: string;
  /** Where the engraved plate sits, as a fraction of the panel height (0 = top). */
  plateY?: number;
  onPress: () => void;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const plateStyle = (size: number): TextStyle =>
  new TextStyle({
    fill: 0xfff0c2,
    fontFamily,
    fontSize: size,
    fontWeight: "700",
    letterSpacing: 1,
    dropShadow: { color: 0x1a0e02, alpha: 0.7, blur: 2, distance: 1 },
  });

/**
 * A premium "wing" panel (Buy Bonus / Luck Boost). At rest it is desaturated and
 * dimmed by a colour-matrix shader so it reads as a quiet, inactive control; on
 * hover — or while a toggle is active — it eases to full colour with a soft gold
 * bloom and a gentle lift. A press dips it inward. It can run as a momentary
 * button or, given an `activeTexture`, as a two-state toggle. Pure view: it owns
 * its own feel and reports taps via callback, knowing nothing about the game.
 */
export class SidePanelButton extends Container {
  private enabled = true;
  private active = false;
  private hovered = false;
  private pressed = false;
  private lit = 0; // 0 = dull (idle) … 1 = full colour (hover/active)
  private lockedOut = false; // a bonus round owns the screen (can't be clicked)
  private dim = 0; // 0 = normal … 1 = fully "locked out" (eased toward lockedOut)

  private readonly art: Container;
  private readonly color = new ColorMatrixFilter();
  private readonly glow: Graphics;
  private readonly baseSprite: Sprite;
  private readonly activeSprite?: Sprite;
  private readonly plate?: Text;
  private readonly plateMaxWidth: number;

  constructor(opts: SidePanelButtonOptions) {
    super();
    const { width, height, texture, activeTexture, plateY, onPress } = opts;

    // Soft gold halo behind the panel — blooms in as the panel lights up.
    this.glow = new Graphics()
      .roundRect(-width / 2 - 8, -height / 2 - 8, width + 16, height + 16, 26)
      .fill({ color: LOOK.glowColor });
    this.glow.filters = [new BlurFilter({ strength: 10 })];
    this.glow.alpha = 0;

    this.baseSprite = makeSprite(texture, width, height);
    if (activeTexture) {
      this.activeSprite = makeSprite(activeTexture, width, height);
      this.activeSprite.visible = false;
    }

    // The art (sprites + plate) shares one colour shader and lifts together; the
    // glow stays put so the bloom doesn't scale with the press/hover.
    this.art = new Container();
    this.art.filters = [this.color];
    this.art.addChild(this.baseSprite);
    if (this.activeSprite) this.art.addChild(this.activeSprite);

    this.plateMaxWidth = width * 0.62;
    if (plateY !== undefined) {
      this.plate = new Text({
        text: "",
        style: plateStyle(Math.round(width * 0.13)),
      });
      this.plate.anchor.set(0.5);
      this.plate.y = (plateY - 0.5) * height;
      this.art.addChild(this.plate);
    }

    this.addChild(this.glow, this.art);
    this.applyLook();

    this.eventMode = "static";
    this.cursor = "pointer";
    this.on("pointerover", () => {
      if (this.enabled) this.hovered = true;
    });
    this.on("pointerout", () => {
      this.hovered = false;
      this.pressed = false;
    });
    this.on("pointerdown", () => {
      if (this.enabled) this.pressed = true;
    });
    this.on("pointerup", () => {
      this.pressed = false;
    });
    this.on("pointerupoutside", () => {
      this.pressed = false;
    });
    this.on("pointertap", () => {
      if (this.enabled) onPress();
    });
  }

  /** Ease toward the target look. Call once per frame with the frame delta (ms). */
  update(dtMs: number): void {
    let changed = false;

    const litTarget = (this.hovered || this.active) && this.enabled ? 1 : 0;
    if (this.lit !== litTarget) {
      const k = Math.min(1, dtMs / LOOK.fadeMs);
      this.lit += (litTarget - this.lit) * k;
      if (Math.abs(litTarget - this.lit) < 0.004) this.lit = litTarget;
      changed = true;
    }

    const dimTarget = this.lockedOut ? 1 : 0;
    if (this.dim !== dimTarget) {
      const k = Math.min(1, dtMs / LOOK.disabledFadeMs);
      this.dim += (dimTarget - this.dim) * k;
      if (Math.abs(dimTarget - this.dim) < 0.004) this.dim = dimTarget;
      changed = true;
    }

    if (changed) this.applyLook();
  }

  /** Flip the visible texture (toggle) and let the lit-while-active rule take over. */
  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    this.baseSprite.visible = !active || !this.activeSprite;
    if (this.activeSprite) this.activeSprite.visible = active;
  }

  /** Text engraved on the panel's bottom plate (price, ON/OFF, …). */
  setPlateText(text: string): void {
    if (!this.plate) return;
    this.plate.text = text;
    fitWidth(this.plate, this.plateMaxWidth);
  }

  /** Dim and lock out input (e.g. during a spin or a bonus round). */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.eventMode = enabled ? "static" : "none";
    this.cursor = enabled ? "pointer" : "default";
    if (!enabled) {
      this.hovered = false;
      this.pressed = false;
    }
  }

  /**
   * Mark the button as "locked out" — a bonus round owns the screen, so it eases
   * to a clearly-disabled look (desaturated, darker, faded). Separate from
   * {@link setEnabled} (input), so a brief base spin doesn't trigger the heavy
   * look; only the longer bonus modes do.
   */
  setLockedOut(lockedOut: boolean): void {
    this.lockedOut = lockedOut;
  }

  private applyLook(): void {
    // Idle → lit blend (hover / active).
    let sat = lerp(LOOK.dullSaturate, 0, this.lit);
    let bri = lerp(LOOK.dullBrightness, 1, this.lit);
    // Locked-out blend on top: push further toward greyscale + dark, and fade.
    sat = lerp(sat, LOOK.disabledSaturate, this.dim);
    bri = lerp(bri, LOOK.disabledBrightness, this.dim);
    this.color.saturate(sat, false);
    this.color.brightness(bri, true);

    this.glow.alpha = this.lit * LOOK.glowAlpha * (1 - this.dim);
    this.alpha = lerp(1, LOOK.disabledAlpha, this.dim);

    const scale = this.pressed
      ? LOOK.pressScale
      : lerp(1, LOOK.hoverScale, this.lit);
    this.art.scale.set(scale);
  }
}

function makeSprite(texture: string, width: number, height: number): Sprite {
  const sprite = new Sprite(Assets.get<Texture>(texture));
  sprite.anchor.set(0.5);
  sprite.width = width;
  sprite.height = height;
  return sprite;
}
