import {
  Assets,
  BlurFilter,
  Container,
  Graphics,
  Sprite,
  Text,
  type Texture,
} from "pixi.js";
import { WIN_DISPLAY } from "../assets/manifest";
import { CANVAS, WIN_CELEBRATION as L, WIN_TIERS, type WinTierId } from "./theme";
import { valueStyle } from "./hud/styles";
import { money } from "./hud/text";
import { sound, type SoundHandle } from "../audio/sound";

const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
/** Overshoots past the target then settles — the plate/word-mark "slams" in. */
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** The highest tier whose `minMultiple` the win has reached (floored at the lowest). */
function tierFor(value: number, bet: number): WinTierId {
  const multiple = bet > 0 ? value / bet : 0;
  let id: WinTierId = WIN_TIERS[0].id;
  for (const tier of WIN_TIERS) if (multiple >= tier.minMultiple) id = tier.id;
  return id;
}

type Phase = "idle" | "in" | "count" | "hold" | "out";

/**
 * The post-bonus win celebration. A full-screen modal: a dimmed backdrop, the
 * tier word-mark (BIG / MEGA / EPIC / LEGENDARY WIN) up top, and the win amount
 * inside a framed plate that counts up from 0 → the session total. The tier art
 * escalates live as the count crosses each threshold (multiples of the bet).
 *
 * Driven by {@link update} from the scene ticker; {@link play} resolves once the
 * modal has dismissed (auto after a hold, or early on a tap — one tap fills the
 * count, the next dismisses). A pure view: it's told the total + bet and reports
 * nothing back.
 */
export class WinCelebration extends Container {
  private readonly backdrop: Graphics;
  private readonly content: Container;
  private readonly glow: Graphics;
  private readonly tier: Sprite;
  private readonly frameLeft: Sprite;
  private readonly frameCenter: Sprite;
  private readonly frameRight: Sprite;
  private readonly amount: Text;

  private phase: Phase = "idle";
  private elapsed = 0;
  private total = 0;
  private bet = 1;
  private countMs: number = L.countBaseMs;
  private resolve?: () => void;
  private currentTier: WinTierId = "big";
  /** Base scale that fits the tier art to `tierWidth`, and a transient pop on top. */
  private tierBaseScale = 1;
  private tierPunch = 0;
  /** The looping coin-counter sound, live only while the amount counts up. */
  private coin?: SoundHandle;

  constructor() {
    super();
    this.visible = false;

    // The backdrop is the full-screen hit target: it both dims the scene and
    // catches taps (a modal — nothing behind it is clickable while it's up).
    this.backdrop = new Graphics()
      .rect(0, 0, CANVAS.width, CANVAS.height)
      .fill({ color: 0x000000 });
    this.backdrop.eventMode = "static";
    this.backdrop.cursor = "pointer";
    // Solid black at a fixed opacity; the container's fade multiplies on top so
    // the scrim tops out at backdropAlpha (the content fades to full opacity).
    this.backdrop.alpha = L.backdropAlpha;

    // The content scales in/out around the screen centre (the backdrop doesn't).
    this.content = new Container();
    this.content.pivot.set(CANVAS.width / 2, CANVAS.height / 2);
    this.content.position.set(CANVAS.width / 2, CANVAS.height / 2);

    this.glow = new Graphics()
      .ellipse(CANVAS.width / 2, (L.tierCenterY + L.frameCenterY) / 2, 560, 360)
      .fill({ color: 0xffd34d });
    this.glow.blendMode = "add";
    this.glow.alpha = 0.22;
    this.glow.filters = [new BlurFilter({ strength: 40, quality: 2 })];

    this.tier = new Sprite(Assets.get<Texture>(WIN_DISPLAY.tiers.big));
    this.tier.anchor.set(0.5);
    this.tier.position.set(CANVAS.width / 2, L.tierCenterY);

    this.frameLeft = makeFrameSlice(WIN_DISPLAY.amountLeft);
    this.frameCenter = makeFrameSlice(WIN_DISPLAY.amountCenter);
    this.frameRight = makeFrameSlice(WIN_DISPLAY.amountRight);

    const style = valueStyle();
    style.fontSize = Math.round(L.frameHeight * 0.42);
    this.amount = new Text({ text: "0.00", style });
    this.amount.anchor.set(0.5);
    this.amount.position.set(CANVAS.width / 2, L.frameCenterY);

    // Stack order: glow → frame → tier (overlaps the frame's top) → amount (on
    // top so the number stays readable where the word-mark dips over the frame).
    this.content.addChild(
      this.glow,
      this.frameLeft,
      this.frameCenter,
      this.frameRight,
      this.tier,
      this.amount,
    );
    this.addChild(this.backdrop, this.content);

    // A tap fast-forwards the count to full, then dismisses.
    this.backdrop.on("pointertap", () => this.onTap());
  }

  /**
   * Show the celebration for a finished bonus. Counts 0 → `totalWin`, escalating
   * the tier art as it climbs. Resolves once the modal has fully dismissed.
   */
  play(totalWin: number, bet: number): Promise<void> {
    this.resolve?.(); // settle any prior run defensively
    this.total = totalWin;
    this.bet = bet;

    // Longer count-ups for bigger wins (one extra step per tier reached).
    const finalTier = tierFor(totalWin, bet);
    const tierIndex = WIN_TIERS.findIndex((t) => t.id === finalTier);
    this.countMs = L.countBaseMs + tierIndex * L.countPerTierMs;

    // Size the frame to the FINAL (widest) amount so it doesn't resize mid-count.
    this.amount.text = money(totalWin);
    this.layoutFrame(this.amount.width + L.framePadX * 2);

    this.setAmount(0);
    this.setTier("big");
    this.tierPunch = 0;

    this.visible = true;
    this.alpha = 0;
    this.content.scale.set(0.85);
    this.phase = "in";
    this.elapsed = 0;

    sound.play("win-sfx"); // fanfare as the modal appears

    return new Promise((resolve) => (this.resolve = resolve));
  }

  /** Advance the celebration. Call once per frame with the delta (ms). */
  update(dtMs: number): void {
    if (this.phase === "idle") return;
    this.elapsed += dtMs;

    // The tier word-mark eases back down after each escalation pop.
    if (this.tierPunch > 0) {
      this.tierPunch = Math.max(0, this.tierPunch - dtMs / L.tierPunchMs);
      this.tier.scale.set(this.tierBaseScale * (1 + 0.18 * this.tierPunch));
    }

    switch (this.phase) {
      case "in": {
        const t = clamp01(this.elapsed / L.inMs);
        this.alpha = t;
        this.content.scale.set(0.85 + 0.15 * easeOutBack(t));
        if (t >= 1) {
          this.enter("count");
          // The amount starts climbing — loop the coin counter until it lands.
          this.coin = sound.play("coin-counter", { loop: true });
        }
        break;
      }
      case "count": {
        const t = clamp01(this.elapsed / this.countMs);
        const value = this.total * easeOutCubic(t);
        this.setAmount(value);
        this.updateTier(value);
        if (t >= 1) {
          this.setAmount(this.total);
          this.updateTier(this.total);
          this.stopCoin();
          this.enter("hold");
        }
        break;
      }
      case "hold": {
        if (this.elapsed >= L.holdMs) this.enter("out");
        break;
      }
      case "out": {
        const t = clamp01(this.elapsed / L.outMs);
        this.alpha = 1 - t;
        if (t >= 1) this.finish();
        break;
      }
    }
  }

  private onTap(): void {
    if (this.phase === "count") {
      // Fast-forward to the full amount + final tier, then hold.
      this.setAmount(this.total);
      this.updateTier(this.total);
      this.stopCoin();
      this.enter("hold");
    } else if (this.phase === "hold") {
      this.enter("out");
    }
  }

  /** Stop the looping coin-counter sound (if it's playing). */
  private stopCoin(): void {
    this.coin?.stop();
    this.coin = undefined;
  }

  private enter(phase: Phase): void {
    this.phase = phase;
    this.elapsed = 0;
  }

  private finish(): void {
    this.visible = false;
    this.phase = "idle";
    this.stopCoin(); // defensive: never leave the loop running past dismissal
    const done = this.resolve;
    this.resolve = undefined;
    done?.();
  }

  private setAmount(value: number): void {
    this.amount.text = money(value);
  }

  /** Swap the tier word-mark if the climbing value has crossed into a new tier. */
  private updateTier(value: number): void {
    const next = tierFor(value, this.bet);
    if (next !== this.currentTier) this.setTier(next);
  }

  private setTier(id: WinTierId): void {
    this.currentTier = id;
    this.tier.texture = Assets.get<Texture>(WIN_DISPLAY.tiers[id]);
    // Refit (all tier art is the same size, but stay robust) and pop.
    this.tierBaseScale = L.tierWidth / (this.tier.texture.width || L.tierWidth);
    this.tier.scale.set(this.tierBaseScale);
    this.tierPunch = 1;
  }

  /** Lay out the 3-slice amount frame for a given (stretched) centre width. */
  private layoutFrame(desiredCenterWidth: number): void {
    const capScale = L.frameHeight / L.capNativeHeight;
    const capW = L.capNativeWidth * capScale;
    const centerW = Math.max(L.frameMinCenterWidth, desiredCenterWidth);
    const totalW = capW * 2 + centerW;
    const leftX = CANVAS.width / 2 - totalW / 2;
    const cy = L.frameCenterY;

    this.frameLeft.width = capW;
    this.frameLeft.height = L.frameHeight;
    this.frameLeft.position.set(leftX, cy);

    this.frameCenter.width = centerW;
    this.frameCenter.height = L.frameHeight;
    this.frameCenter.position.set(leftX + capW, cy);

    this.frameRight.width = capW;
    this.frameRight.height = L.frameHeight;
    this.frameRight.position.set(leftX + capW + centerW, cy);
  }
}

/** A frame slice anchored at its left-middle, so slices butt up side by side. */
function makeFrameSlice(texture: string): Sprite {
  const sprite = new Sprite(Assets.get<Texture>(texture));
  sprite.anchor.set(0, 0.5);
  return sprite;
}
