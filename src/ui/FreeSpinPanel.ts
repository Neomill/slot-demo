import {
  Assets,
  BlurFilter,
  ColorMatrixFilter,
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  type PointData,
  type Texture,
} from "pixi.js";
import { FREE_SPIN } from "../assets/manifest";
import { FREE_SPIN_PANEL as L, WILD_CHARGE as W, fontFamily } from "./theme";
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

/** A charging lock mid-sequence (energy hit → expand → fill → bounce). */
interface LockCharge {
  lock: Sprite;
  baseScaleX: number;
  baseScaleY: number;
  elapsed: number;
  swapped: boolean; // lock → unlock texture flipped yet?
  rippled: boolean; // gold ripple spawned yet?
  resolve?: () => void;
}

/** An expanding gold ring bloomed under a charging lock. */
interface Ripple {
  node: Graphics;
  elapsed: number;
}

/** A small gold spark thrown off a charging lock. */
interface PanelSpark {
  node: Graphics;
  vx: number;
  vy: number;
  elapsed: number;
  life: number;
}

/** An energy orb flying from an activated panel to the spin counter. */
interface Orb {
  node: Graphics;
  from: PointData;
  ctrl: PointData;
  to: PointData;
  elapsed: number; // starts negative for the launch stagger
  duration: number;
  arrived: boolean;
  onArrive?: () => void;
}

/** Point on the quadratic bezier p0 → p2 (control p1) at parameter t. */
function quad(p0: PointData, p1: PointData, p2: PointData, t: number): PointData {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

const HIT = W.hitMs;
const EXPAND = HIT + W.expandMs;
const FILL = EXPAND + W.fillMs;
const BOUNCE = FILL + W.bounceMs;

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

/** Smooth 0 → 1 → 0 bump (half-sine), for the flash and ripple envelopes. */
function bump(t: number): number {
  return Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);
}

/** Settle past 1 then back — the lock's bounce as it locks home. */
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/**
 * One multiplier panel: a background plate, the "+10 FREE SPIN ×N" banner, and
 * four wild locks. It owns its own feature-progression animation — each lock
 * charges (energy hit → expand → gold ripple → lock→unlock swap → bounce), a
 * partially-filled panel breathes its glow, the fourth charge flashes the plate
 * and runs a gold spark around the border while the banner pops in, and a
 * completed panel idles on a slow gold "reward waiting" pulse.
 */
class MultiplierPanel extends Container {
  private readonly locks: Sprite[] = [];
  private readonly lockSize: { w: number; h: number };
  private readonly bg: Sprite; // the plate (tinted grey when consumed)
  private readonly banner: Text;
  private readonly glow: Graphics; // breathing / queue halo behind the plate
  private readonly flash: Graphics; // fourth-charge plate flash
  private readonly border: Graphics; // steady gold border (fourth charge on)
  private readonly borderDot: Graphics; // the spark that runs the border
  private readonly fx = new Container(); // ripples + sparks layer (above locks)
  private readonly pw: number;
  private readonly ph: number;

  private filled = 0; // locks currently shown unlocked
  private state: "idle" | "breathing" | "complete" = "idle";
  // Free-running ms clock for the breathing / queue-pulse glow. Never reset on
  // state changes, so every panel (all driven by the same per-frame dtMs from a
  // shared construction time) stays in phase — the row glows in unison.
  private glowClock = 0;
  private flashElapsed = -1;
  private borderElapsed = -1;
  private bannerRevealElapsed = -1;
  private activationElapsed = -1; // end-ceremony: panel opening
  private consumeElapsed = -1; // end-ceremony: gold → grey + checkmark
  private consumeGlowFrom = 0;
  private consumed = false; // reward transferred — stays dulled (collected)
  private dullFilter?: ColorMatrixFilter; // desaturate + darken when collected
  private charges: LockCharge[] = [];
  private ripples: Ripple[] = [];
  private sparks: PanelSpark[] = [];

  constructor(multiplier: number) {
    super();
    const { width: pw, height: ph } = L.panel;
    this.pw = pw;
    this.ph = ph;
    const centerX = pw / 2;

    // Breathing / queue halo: a soft gold glow behind the plate (shows as a rim).
    const pad = 10;
    this.glow = new Graphics()
      .roundRect(-pad, -pad, pw + pad * 2, ph + pad * 2, 12)
      .fill({ color: W.glowColor });
    this.glow.blendMode = "add";
    this.glow.filters = [new BlurFilter({ strength: 10, quality: 2 })];
    this.glow.alpha = 0;
    this.addChild(this.glow);

    this.bg = makeSprite(FREE_SPIN.bgSmall, pw, ph);
    this.addChild(this.bg);

    this.banner = new Text({
      text: `+10 FREE SPIN ×${multiplier}`,
      style: bannerStyle(Math.round(ph * 0.23)),
    });
    this.banner.anchor.set(0.5);
    this.banner.position.set(centerX, ph * 0.3);
    fitWidth(this.banner, pw * 0.86); // shrink to fit, never blurs (text re-rasterizes)
    this.addChild(this.banner);

    const lockHeight = ph * 0.36;
    const lockWidth = lockHeight * LOCK_ASPECT;
    this.lockSize = { w: lockWidth, h: lockHeight };
    const spacing = lockWidth + lockWidth * 0.5;
    const firstX = centerX - (spacing * (WILDS_PER_PANEL - 1)) / 2;
    const lockY = ph * 0.7;
    for (let j = 0; j < WILDS_PER_PANEL; j++) {
      const lock = makeSprite(FREE_SPIN.wildLock, lockWidth, lockHeight, 0.5, 0.5);
      lock.position.set(firstX + j * spacing, lockY);
      this.locks.push(lock);
      this.addChild(lock);
    }

    // Fourth-charge plate flash (additive white, spikes then decays).
    this.flash = new Graphics().roundRect(0, 0, pw, ph, 8).fill({ color: 0xffffff });
    this.flash.blendMode = "add";
    this.flash.alpha = 0;
    this.addChild(this.flash);

    // Steady gold border + the spark that "runs" it like electricity.
    this.border = new Graphics()
      .roundRect(1, 1, pw - 2, ph - 2, 8)
      .stroke({ width: 2.5, color: W.borderColor });
    this.border.blendMode = "add";
    this.border.alpha = 0;
    this.borderDot = new Graphics().circle(0, 0, 5).fill({ color: W.borderColor });
    this.borderDot.blendMode = "add";
    this.borderDot.filters = [new BlurFilter({ strength: 4, quality: 2 })];
    this.borderDot.alpha = 0;
    this.addChild(this.border, this.borderDot);

    this.addChild(this.fx);
  }

  /** Global (stage) position of lock `j`, for aiming the feature beam. */
  lockGlobal(j: number): PointData {
    return this.locks[j].getGlobalPosition();
  }

  /** Whether every lock on this panel is unlocked. */
  get isComplete(): boolean {
    return this.filled >= WILDS_PER_PANEL;
  }

  /**
   * Snap `count` locks to unlocked (the rest locked) with no animation, and set
   * the ambient state from the count. Used to seed / re-affirm the panel; the
   * animated path is `chargeLock`.
   */
  setFilled(count: number): void {
    this.filled = Math.max(0, Math.min(count, WILDS_PER_PANEL));
    this.charges = [];
    const lockTex = Assets.get<Texture>(FREE_SPIN.wildLock);
    const unlockTex = Assets.get<Texture>(FREE_SPIN.wildUnlock);
    this.locks.forEach((lock, j) => {
      this.applyLockTexture(lock, j < this.filled ? unlockTex : lockTex);
    });
    this.refreshState();
  }

  /** Reset every transient effect (new session). */
  reset(): void {
    this.fx.removeChildren().forEach((c) => c.destroy());
    this.ripples = [];
    this.sparks = [];
    this.charges = [];
    this.flashElapsed = -1;
    this.borderElapsed = -1;
    this.bannerRevealElapsed = -1;
    this.activationElapsed = -1;
    this.consumeElapsed = -1;
    this.consumed = false;
    this.flash.alpha = 0;
    this.border.alpha = 0;
    this.borderDot.alpha = 0;
    this.banner.alpha = 1;
    this.banner.scale.set(1);
    this.glowClock = 0;
    this.filters = [];
    if (this.dullFilter) this.dullFilter.alpha = 0;
    this.alpha = 1;
    this.border.alpha = 0;
    this.setFilled(0);
  }

  /** Stage-local centre of the plate (orb emission point at the end ceremony). */
  get center(): PointData {
    return { x: this.x + this.pw / 2, y: this.y + this.ph / 2 };
  }

  /**
   * End ceremony — the panel "opens": flash the plate, boost the glow, and let a
   * burst of light escape (ripple + sparks). Resolves when the opening settles.
   */
  playActivation(): Promise<void> {
    this.activationElapsed = 0;
    this.flashElapsed = 0;
    this.spawnRipple(this.pw / 2, this.ph / 2);
    for (let i = 0; i < 14; i++) this.spawnSpark(this.pw / 2, this.ph / 2);
    return new Promise((resolve) => setTimeout(resolve, W.activationMs));
  }

  /**
   * End ceremony — the reward has been transferred: the panel fades to a dull
   * "disabled" look (glow + queue border leave, the plate desaturates, darkens
   * and fades) so a collected panel reads as spent next to the lit ones still on
   * queue. No checkmark — the activation burst + orb flight read as "collected".
   */
  consume(): Promise<void> {
    this.consumeGlowFrom = this.glow.alpha || 0.5;
    this.consumeElapsed = 0;
    if (!this.dullFilter) this.dullFilter = new ColorMatrixFilter();
    // Build the target look (desaturate, then darken); `alpha` blends it in.
    this.dullFilter.saturate(W.consumeSaturate, false);
    this.dullFilter.brightness(W.consumeBrightness, true);
    this.dullFilter.alpha = 0;
    this.filters = [this.dullFilter];
    return new Promise((resolve) => setTimeout(resolve, W.consumeMs));
  }

  /**
   * Charge lock `j`: the full slot sequence — energy hit, expansion, gold ripple,
   * lock→unlock swap, then a bounce home. Resolves when the bounce settles.
   */
  chargeLock(j: number): Promise<void> {
    const lock = this.locks[j];
    return new Promise((resolve) => {
      this.charges.push({
        lock,
        baseScaleX: lock.scale.x,
        baseScaleY: lock.scale.y,
        elapsed: 0,
        swapped: false,
        rippled: false,
        resolve,
      });
    });
  }

  /**
   * The fourth charge fired: flash the plate, run a gold spark around the border,
   * and reveal the banner with a pop. Leaves the panel in its "complete" queue
   * state. Resolves when the border run finishes.
   */
  playPanelComplete(): Promise<void> {
    this.filled = WILDS_PER_PANEL;
    this.state = "complete";
    this.flashElapsed = 0;
    this.borderElapsed = 0;
    this.bannerRevealElapsed = 0;
    return new Promise((resolve) => setTimeout(resolve, W.flashMs + W.borderRunMs));
  }

  update(dtMs: number): void {
    this.glowClock += dtMs;
    this.updateFlash(dtMs);
    this.updateBorder(dtMs);
    this.updateQueueBorder();
    this.updateBannerReveal(dtMs);
    this.updateActivation(dtMs);
    this.updateConsume(dtMs);
    this.updateCharges(dtMs);
    this.updateRipples(dtMs);
    this.updateSparks(dtMs);
    this.applyGlow();
  }

  /** Drive the halo from the dominant effect (consume > activation > ambient). */
  private applyGlow(): void {
    if (this.consumed) {
      this.glow.alpha = 0;
      return;
    }
    if (this.consumeElapsed >= 0) {
      this.glow.alpha = this.consumeGlowFrom * (1 - Math.min(1, this.consumeElapsed / W.consumeMs));
      return;
    }
    if (this.activationElapsed >= 0) {
      this.glow.alpha = 0.5 + 0.5 * bump(this.activationElapsed / W.activationMs);
      return;
    }
    if (this.state === "breathing") {
      const c = Math.sin((this.glowClock / W.breatheMs) * Math.PI * 2) * 0.5 + 0.5;
      this.glow.alpha = W.breatheMin + (W.breatheMax - W.breatheMin) * c;
    } else if (this.state === "complete") {
      const p = (this.glowClock % W.queuePulseMs) / W.queuePulseMs;
      // Gentle gold pulse, then idle, every ~2s (shared clock → all in unison).
      this.glow.alpha = W.queueGlowMin + (W.queueGlowMax - W.queueGlowMin) * bump(p);
    } else {
      this.glow.alpha = 0;
    }
  }

  private updateActivation(dtMs: number): void {
    if (this.activationElapsed < 0) return;
    this.activationElapsed += dtMs;
    if (this.activationElapsed >= W.activationMs) this.activationElapsed = -1;
  }

  private updateConsume(dtMs: number): void {
    if (this.consumeElapsed < 0) return;
    this.consumeElapsed += dtMs;
    const t = Math.min(1, this.consumeElapsed / W.consumeMs);
    // The glow fade is driven by applyGlow (consumeElapsed >= 0); here we blend
    // in the dull filter and fade the whole panel toward its collected opacity.
    if (this.dullFilter) this.dullFilter.alpha = t;
    this.alpha = 1 - (1 - W.consumeDullAlpha) * t;
    if (t >= 1) {
      this.consumeElapsed = -1;
      this.consumed = true;
    }
  }

  private updateFlash(dtMs: number): void {
    if (this.flashElapsed < 0) return;
    this.flashElapsed += dtMs;
    const t = this.flashElapsed / W.flashMs;
    if (t >= 1) {
      this.flash.alpha = 0;
      this.flashElapsed = -1;
      return;
    }
    this.flash.alpha = 0.9 * bump(t);
  }

  /** Run a gold spark around the plate's perimeter — "electricity". */
  private updateBorder(dtMs: number): void {
    if (this.borderElapsed < 0) return;
    this.borderElapsed += dtMs;
    const t = this.borderElapsed / W.borderRunMs;
    if (t >= 1) {
      this.border.alpha = 0;
      this.borderDot.alpha = 0;
      this.borderElapsed = -1;
      return;
    }
    // Border fades up then down; the dot races a full lap of the rectangle.
    this.border.alpha = 0.9 * bump(t);
    this.borderDot.alpha = bump(t);
    const pt = this.perimeterPoint(t % 1);
    this.borderDot.position.set(pt.x, pt.y);
  }

  /**
   * Hold the gold border lit (steady) while the panel is queued — a persistent
   * "on queue" frame. Yields to the completion celebration while it runs, and
   * drops once the panel is collected (consumed).
   */
  private updateQueueBorder(): void {
    if (this.borderElapsed >= 0) return; // celebration run owns the border
    const queued = this.state === "complete" && !this.consumed;
    this.border.alpha = queued ? W.queueBorderAlpha : 0;
  }

  /** Position `frac` (0..1) of the way around the plate's rectangular border. */
  private perimeterPoint(frac: number): PointData {
    const w = this.pw;
    const h = this.ph;
    const d = frac * 2 * (w + h);
    if (d < w) return { x: d, y: 0 };
    if (d < w + h) return { x: w, y: d - w };
    if (d < 2 * w + h) return { x: w - (d - w - h), y: h };
    return { x: 0, y: h - (d - 2 * w - h) };
  }

  private updateBannerReveal(dtMs: number): void {
    if (this.bannerRevealElapsed < 0) return;
    this.bannerRevealElapsed += dtMs;
    const t = Math.min(1, this.bannerRevealElapsed / W.bannerRevealMs);
    this.banner.alpha = t;
    // Scale 80% → 105% → 100% (overshoot then settle).
    const s = t < 0.6 ? 0.8 + (0.25 * t) / 0.6 : 1.05 - (0.05 * (t - 0.6)) / 0.4;
    this.banner.scale.set(s);
    if (t >= 1) {
      this.banner.alpha = 1;
      this.banner.scale.set(1);
      this.bannerRevealElapsed = -1;
    }
  }

  private updateCharges(dtMs: number): void {
    if (this.charges.length === 0) return;
    this.charges = this.charges.filter((c) => {
      c.elapsed += dtMs;
      const e = c.elapsed;

      if (e < HIT) {
        // Energy hit: a quick brighten + tiny spark burst at the lock.
        if (!c.rippled) {
          for (let i = 0; i < 5; i++) this.spawnSpark(c.lock.x, c.lock.y);
        }
        this.setLockScale(c, 1 + 0.2 * (e / HIT));
      } else if (e < EXPAND) {
        const t = (e - HIT) / W.expandMs;
        this.setLockScale(c, 1 + (W.lockExpandScale - 1) * t);
      } else if (e < FILL) {
        // Fill: hold expanded, bloom the gold ripple once.
        if (!c.rippled) {
          c.rippled = true;
          this.spawnRipple(c.lock.x, c.lock.y);
        }
        this.setLockScale(c, W.lockExpandScale);
      } else if (e < BOUNCE) {
        // Bounce home — and the lock flips to unlocked as it settles.
        if (!c.swapped) {
          c.swapped = true;
          this.applyLockTexture(c.lock, Assets.get<Texture>(FREE_SPIN.wildUnlock));
          c.baseScaleX = c.lock.scale.x;
          c.baseScaleY = c.lock.scale.y;
          for (let i = 0; i < 6; i++) this.spawnSpark(c.lock.x, c.lock.y);
        }
        const t = (e - FILL) / W.bounceMs;
        this.setLockScale(c, 1 + (W.lockExpandScale - 1) * (1 - easeOutBack(t)));
      } else {
        this.setLockScale(c, 1);
        this.filled = Math.max(this.filled, this.locks.indexOf(c.lock) + 1);
        this.refreshState();
        c.resolve?.();
        return false;
      }
      return true;
    });
  }

  private setLockScale(c: LockCharge, factor: number): void {
    c.lock.scale.set(c.baseScaleX * factor, c.baseScaleY * factor);
  }

  /** Swap a lock's texture, keeping its on-screen size stable across art. */
  private applyLockTexture(lock: Sprite, texture: Texture): void {
    lock.texture = texture;
    lock.width = this.lockSize.w;
    lock.height = this.lockSize.h;
  }

  /** Idle when empty, breathing when partial, queue-pulse when complete. */
  private refreshState(): void {
    const next = this.filled <= 0 ? "idle" : this.filled >= WILDS_PER_PANEL ? "complete" : "breathing";
    if (next !== this.state) {
      this.state = next;
    }
  }

  private spawnRipple(x: number, y: number): void {
    const node = new Graphics().circle(0, 0, W.rippleRadius).stroke({ width: 4, color: W.rippleColor });
    node.position.set(x, y);
    node.scale.set(0);
    this.fx.addChild(node);
    this.ripples.push({ node, elapsed: 0 });
  }

  private updateRipples(dtMs: number): void {
    if (this.ripples.length === 0) return;
    this.ripples = this.ripples.filter((r) => {
      r.elapsed += dtMs;
      const t = Math.min(1, r.elapsed / W.fillMs);
      r.node.scale.set(t);
      r.node.alpha = 1 - t;
      if (t >= 1) {
        this.fx.removeChild(r.node);
        r.node.destroy();
        return false;
      }
      return true;
    });
  }

  private spawnSpark(x: number, y: number): void {
    const node = new Graphics().circle(0, 0, 1.5 + Math.random() * 2).fill({ color: W.sparkColor });
    node.position.set(x, y);
    node.blendMode = "add";
    this.fx.addChild(node);
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.02 + Math.random() * 0.05;
    this.sparks.push({
      node,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      elapsed: 0,
      life: 200 + Math.random() * 180,
    });
  }

  private updateSparks(dtMs: number): void {
    if (this.sparks.length === 0) return;
    this.sparks = this.sparks.filter((s) => {
      s.elapsed += dtMs;
      const t = s.elapsed / s.life;
      if (t >= 1) {
        this.fx.removeChild(s.node);
        s.node.destroy();
        return false;
      }
      s.node.x += s.vx * dtMs;
      s.node.y += s.vy * dtMs;
      s.node.alpha = 1 - t;
      return true;
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
  private readonly orbLayer = new Container(); // energy orbs (end ceremony)
  private orbs: Orb[] = [];
  private counterBumpElapsed = -1;

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

    this.addChild(this.orbLayer); // above the panels and counter

    this.setRemaining(0);
    this.setWildCounter(0);
  }

  /** Drive every panel's ambient + transient effects, plus the end ceremony. */
  update(dtMs: number): void {
    for (const panel of this.panels) panel.update(dtMs);
    this.updateOrbs(dtMs);
    this.updateCounterBump(dtMs);
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
   * holds four locks, and they unlock left-to-right as the count climbs. This is
   * the instant (snap) path — use {@link chargeLock} for the animated reveal.
   */
  setWildCounter(wildCounter: number): void {
    const max = WILDS_PER_PANEL * this.panels.length;
    const filled = Math.max(0, Math.min(wildCounter, max));
    this.panels.forEach((panel, i) => {
      const unlocked = Math.max(
        0,
        Math.min(filled - i * WILDS_PER_PANEL, WILDS_PER_PANEL),
      );
      panel.setFilled(unlocked);
    });
  }

  /** Tear down every transient effect and reset the ladder (new session). */
  resetProgression(): void {
    for (const panel of this.panels) panel.reset();
    for (const o of this.orbs) o.node.destroy();
    this.orbs = [];
    this.counterBumpElapsed = -1;
    this.digits.scale.set(1);
  }

  /** Global (stage) position of the lock at overall wild index (0..11). */
  lockGlobalPosition(globalIndex: number): PointData {
    const panel = Math.floor(globalIndex / WILDS_PER_PANEL);
    const j = globalIndex % WILDS_PER_PANEL;
    return this.panels[panel].lockGlobal(j);
  }

  /**
   * Animate the charge of the lock at overall wild index `globalIndex`. Resolves
   * to `true` when this charge completed its panel (the fourth lock).
   */
  async chargeLock(globalIndex: number): Promise<boolean> {
    const panelIndex = Math.floor(globalIndex / WILDS_PER_PANEL);
    const j = globalIndex % WILDS_PER_PANEL;
    const panel = this.panels[panelIndex];
    if (!panel) return false;
    await panel.chargeLock(j);
    return j === WILDS_PER_PANEL - 1;
  }

  /** Play the fourth-charge celebration for the panel at `panelIndex`. */
  playPanelComplete(panelIndex: number): Promise<void> {
    return this.panels[panelIndex]?.playPanelComplete() ?? Promise.resolve();
  }

  /** End ceremony — the panel at `panelIndex` glows and "opens". */
  playPanelActivation(panelIndex: number): Promise<void> {
    return this.panels[panelIndex]?.playActivation() ?? Promise.resolve();
  }

  /**
   * End ceremony — transfer `count` spins from the panel to the counter as energy
   * orbs. The counter starts at `fromValue` and ticks up (with a scale bump) as
   * each orb lands. Resolves once the last orb has arrived.
   */
  transferToCounter(panelIndex: number, fromValue: number, count: number): Promise<void> {
    const panel = this.panels[panelIndex];
    if (!panel || count <= 0) {
      this.setRemaining(fromValue + Math.max(0, count));
      return Promise.resolve();
    }
    const from = panel.center;
    const to = { x: this.digits.x, y: this.digits.y };
    this.setRemaining(fromValue);

    let arrived = 0;
    return new Promise((resolve) => {
      for (let i = 0; i < count; i++) {
        this.spawnOrb(from, to, i * W.orbStaggerMs, () => {
          arrived += 1;
          this.setRemaining(fromValue + arrived);
          this.counterBumpElapsed = 0; // pop on each increment
          if (arrived >= count) resolve();
        });
      }
    });
  }

  /** End ceremony — fade the panel at `panelIndex` to its consumed (ticked) look. */
  consumePanel(panelIndex: number): Promise<void> {
    return this.panels[panelIndex]?.consume() ?? Promise.resolve();
  }

  private spawnOrb(from: PointData, to: PointData, delayMs: number, onArrive: () => void): void {
    const node = new Graphics().circle(0, 0, 5).fill({ color: W.orbColor });
    node.blendMode = "add";
    node.filters = [new BlurFilter({ strength: 3, quality: 2 })];
    node.position.set(from.x, from.y);
    node.alpha = 0;
    this.orbLayer.addChild(node);

    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const ctrl = { x: mx + (-dy / len) * W.orbArcCurve, y: my + (dx / len) * W.orbArcCurve };

    this.orbs.push({
      node,
      from,
      ctrl,
      to,
      elapsed: -delayMs,
      duration: W.orbTravelMs,
      arrived: false,
      onArrive,
    });
  }

  private updateOrbs(dtMs: number): void {
    if (this.orbs.length === 0) return;
    this.orbs = this.orbs.filter((o) => {
      o.elapsed += dtMs;
      if (o.elapsed < 0) {
        o.node.alpha = 0; // still in its launch stagger
        return true;
      }
      const t = Math.min(1, o.elapsed / o.duration);
      const p = quad(o.from, o.ctrl, o.to, t);
      o.node.position.set(p.x, p.y);
      o.node.alpha = t < 0.15 ? t / 0.15 : 1;
      o.node.scale.set(0.6 + 0.6 * t);
      if (t >= 1 && !o.arrived) {
        o.arrived = true;
        o.onArrive?.();
        this.orbLayer.removeChild(o.node);
        o.node.destroy();
        return false;
      }
      return true;
    });
  }

  private updateCounterBump(dtMs: number): void {
    if (this.counterBumpElapsed < 0) return;
    this.counterBumpElapsed += dtMs;
    const t = this.counterBumpElapsed / W.counterBumpMs;
    if (t >= 1) {
      this.digits.scale.set(1);
      this.counterBumpElapsed = -1;
      return;
    }
    this.digits.scale.set(1 + (W.counterBumpScale - 1) * bump(t));
  }
}
