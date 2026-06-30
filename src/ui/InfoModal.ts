import {
  BlurFilter,
  Container,
  Graphics,
  Rectangle,
  Text,
  TextStyle,
  Ticker,
  type FederatedPointerEvent,
  type FederatedWheelEvent,
} from "pixi.js";
import { fontFamily } from "./theme";

export interface InfoModalTab {
  label: string;
  /** Body text (word-wrapped) or a ready-made display object to drop in. */
  content: string | Container;
}

export interface InfoModalOptions {
  width?: number;
  height?: number;
  title?: string;
  tabs: InfoModalTab[];
  /** Accent used for the active tab + highlights. */
  accentColor?: number;
  /** Screen size for the full-screen overlay (defaults until resize()). */
  screenWidth?: number;
  screenHeight?: number;
  /** Called when the modal closes (close button or tapping the overlay). */
  onClose?: () => void;
}

// --- palette ---------------------------------------------------------------
const DEFAULT_ACCENT = 0xe3a53a; // warm gold for the active tab
const COL_SHADOW = 0x000000;
const COL_FRAME = 0x241a10; // dark bronze outer frame
const COL_GOLD = 0xc9a24e; // gold border
const COL_GOLD_BRIGHT = 0xead08a; // bevel highlight
const COL_PANEL = 0x182233; // inner panel (dark navy)
const COL_PANEL_TOP = 0x213048; // panel sheen (top)
const COL_CONTENT = 0x1b2433; // content area
const COL_TAB_IDLE = 0x2b2f38;
const COL_TAB_TEXT_IDLE = 0xd8c38f;
const COL_WHITE = 0xffffff;
const COL_BODY = 0xc9d6e6;
const COL_TITLE = 0xf3d27a;
const OVERLAY_ALPHA = 0.65;

// --- easing -----------------------------------------------------------------
type Easing = (t: number) => number;
const easeOutCubic: Easing = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack: Easing = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

/** Blend two 0xRRGGBB colours (t = 0 → a, 1 → b). */
function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

interface Anim {
  id: number;
  elapsed: number;
  duration: number;
  ease: Easing;
  onUpdate: (t: number) => void;
  onComplete?: () => void;
}

interface Tab {
  container: Container;
  bg: Graphics;
  label: Text;
  width: number;
  height: number;
  colorT: number; // 0 = idle … 1 = active
  hover: number; // 0 … 1 hover brighten
  colorAnim?: number;
  hoverAnim?: number;
}

/**
 * A reusable, procedurally-drawn "INFO / PAYTABLE" modal: a full-screen scrim,
 * a gold-framed dark-navy panel with a title, a circular close button, a row of
 * capsule tabs, and a scrollable content area. Everything is PixiJS Graphics +
 * Text (no HTML, no image assets). Self-driven — it animates off Pixi's shared
 * ticker, so callers only need show() / hide(); nothing per-frame.
 *
 * API: show(), hide(), setActiveTab(i), resize(w, h), destroy().
 */
export class InfoModal extends Container {
  private readonly opts: Required<Omit<InfoModalOptions, "onClose">> &
    Pick<InfoModalOptions, "onClose">;
  private readonly W: number;
  private readonly H: number;
  private readonly accent: number;

  private readonly overlay: Graphics;
  private readonly modal: Container;
  private closeBg!: Graphics;
  private readonly tabs: Tab[] = [];

  private viewport!: Container;
  private scroll!: Container;
  private contentMask!: Graphics;
  private scrollbar!: Graphics;
  private readonly contentNodes: Container[] = [];
  private readonly scrollOffsets: number[] = [];
  private vpWidth = 0;
  private vpHeight = 0;

  private activeIndex = 0;
  private screenW: number;
  private screenH: number;

  // animation manager
  private readonly anims: Anim[] = [];
  private nextAnimId = 1;
  private showHideAnim?: number;
  private readonly tickerCb: (ticker: Ticker) => void;

  // scroll drag state
  private dragging = false;
  private dragStartY = 0;
  private dragStartScroll = 0;

  constructor(options: InfoModalOptions) {
    super();
    this.opts = {
      width: options.width ?? 640,
      height: options.height ?? 480,
      title: options.title ?? "INFO",
      tabs: options.tabs,
      accentColor: options.accentColor ?? DEFAULT_ACCENT,
      screenWidth: options.screenWidth ?? 1920,
      screenHeight: options.screenHeight ?? 1080,
      onClose: options.onClose,
    };
    this.W = this.opts.width;
    this.H = this.opts.height;
    this.accent = this.opts.accentColor;
    this.screenW = this.opts.screenWidth;
    this.screenH = this.opts.screenHeight;

    this.visible = false;

    // Full-screen scrim — dims the game and blocks/closes on outside taps.
    this.overlay = new Graphics();
    this.overlay.eventMode = "static";
    this.overlay.cursor = "pointer";
    this.overlay.on("pointertap", () => this.close());

    // The panel — scales/fades as a unit, pivoted at its centre.
    this.modal = new Container();
    this.modal.pivot.set(this.W / 2, this.H / 2);

    this.addChild(this.overlay, this.modal);

    this.buildFrame();
    this.buildTitle();
    this.buildCloseButton();
    this.buildTabs();
    this.buildContent();

    this.layoutScreen();
    this.applyActiveTab(0, true);

    this.tickerCb = (ticker) => this.tick(ticker.deltaMS);
    Ticker.shared.add(this.tickerCb);
  }

  // === public API ==========================================================

  /** Fade + scale the modal in (250ms, easeOutBack). */
  show(): void {
    this.visible = true;
    this.cancel(this.showHideAnim);
    this.showHideAnim = this.animate(250, easeOutBack, (t) => {
      this.overlay.alpha = OVERLAY_ALPHA * Math.min(1, t);
      this.modal.alpha = Math.min(1, t);
      this.modal.scale.set(0.92 + 0.08 * t);
    });
  }

  /** Scale + fade the modal out (180ms), then hide it (reusable — not destroyed). */
  hide(): void {
    this.cancel(this.showHideAnim);
    const startScale = this.modal.scale.x;
    this.showHideAnim = this.animate(
      180,
      easeOutCubic,
      (t) => {
        this.overlay.alpha = OVERLAY_ALPHA * (1 - t);
        this.modal.alpha = 1 - t;
        this.modal.scale.set(startScale + (0.92 - startScale) * t);
      },
      () => {
        this.visible = false;
      },
    );
  }

  /** Switch tabs: pill colour + text colour tween, with a content cross-fade. */
  setActiveTab(index: number): void {
    if (index < 0 || index >= this.tabs.length || index === this.activeIndex)
      return;
    this.applyActiveTab(index, false);
  }

  /** Reposition the overlay + centre the modal for a new screen size. */
  resize(width: number, height: number): void {
    this.screenW = width;
    this.screenH = height;
    this.layoutScreen();
  }

  override destroy(options?: Parameters<Container["destroy"]>[0]): void {
    Ticker.shared.remove(this.tickerCb);
    this.anims.length = 0;
    super.destroy(options);
  }

  // === build ===============================================================

  private buildFrame(): void {
    const { W, H } = this;

    // Soft drop shadow behind the whole panel.
    const shadow = new Graphics()
      .roundRect(-10, -6, W + 20, H + 28, 26)
      .fill({ color: COL_SHADOW });
    shadow.alpha = 0.5;
    shadow.filters = [new BlurFilter({ strength: 18, quality: 3 })];

    // Outer bronze frame + gold border + a thin bright bevel just inside it.
    const outer = new Graphics()
      .roundRect(0, 0, W, H, 16)
      .fill({ color: COL_FRAME })
      .roundRect(0, 0, W, H, 16)
      .stroke({ width: 3, color: COL_GOLD })
      .roundRect(3.5, 3.5, W - 7, H - 7, 13)
      .stroke({ width: 1, color: COL_GOLD_BRIGHT, alpha: 0.5 });
    outer.eventMode = "static"; // absorb taps so they don't reach the overlay

    // Inner navy panel with a thin gold edge.
    const inset = 12;
    const ipW = W - inset * 2;
    const ipH = H - inset * 2;
    const inner = new Graphics()
      .roundRect(inset, inset, ipW, ipH, 11)
      .fill({ color: COL_PANEL })
      .roundRect(inset, inset, ipW, ipH, 11)
      .stroke({ width: 1.5, color: 0xb99543, alpha: 0.9 });
    inner.eventMode = "static";

    // Fake top-down gradient: a soft lighter sheen over the upper panel.
    const sheen = new Graphics()
      .roundRect(inset + 4, inset + 4, ipW - 8, ipH * 0.5, 11)
      .fill({ color: COL_PANEL_TOP, alpha: 0.45 });
    sheen.filters = [new BlurFilter({ strength: 24, quality: 2 })];

    // Inner glow — a blurred cool stroke hugging the panel edge.
    const glow = new Graphics()
      .roundRect(inset + 2, inset + 2, ipW - 4, ipH - 4, 11)
      .stroke({ width: 6, color: 0x3a5b86, alpha: 0.55 });
    glow.filters = [new BlurFilter({ strength: 9, quality: 2 })];

    this.modal.addChild(shadow, outer, inner, sheen, glow);
  }

  private buildTitle(): void {
    const title = new Text({
      text: this.opts.title.toUpperCase(),
      style: new TextStyle({
        fill: COL_TITLE,
        fontFamily,
        fontSize: 34,
        fontWeight: "700",
        letterSpacing: 1,
        dropShadow: { color: 0x1a1004, alpha: 0.7, blur: 3, distance: 1 },
      }),
    });
    title.anchor.set(0.5);
    title.position.set(this.W / 2, 44);
    this.modal.addChild(title);
  }

  private buildCloseButton(): void {
    const btn = new Container();
    btn.position.set(this.W - 34, 34);
    btn.eventMode = "static";
    btn.cursor = "pointer";

    const bg = new Graphics();
    const x = new Text({
      text: "✕",
      style: new TextStyle({
        fill: COL_GOLD_BRIGHT,
        fontFamily,
        fontSize: 22,
        fontWeight: "700",
      }),
    });
    x.anchor.set(0.5);
    btn.addChild(bg, x);

    this.closeBg = bg;
    this.drawCloseButton(0);

    let hover = 0;
    let hoverAnim: number | undefined;
    const toward = (target: number): void => {
      this.cancel(hoverAnim);
      const from = hover;
      hoverAnim = this.animate(140, easeOutCubic, (t) => {
        hover = from + (target - from) * t;
        this.drawCloseButton(hover);
      });
    };
    btn.on("pointerover", () => toward(1));
    btn.on("pointerout", () => toward(0));
    btn.on("pointertap", () => this.close());

    this.modal.addChild(btn);
  }

  private drawCloseButton(hover: number): void {
    const r = 17;
    const fill = lerpColor(0x3a2a16, 0x5a4220, hover);
    const border = lerpColor(COL_GOLD, COL_GOLD_BRIGHT, hover);
    this.closeBg
      .clear()
      .circle(0, 0, r)
      .fill({ color: fill })
      .circle(0, 0, r)
      .stroke({ width: 2, color: border });
  }

  private buildTabs(): void {
    const sidePad = 30;
    const y = 78;
    const h = 42;
    const gap = 12;
    const barW = this.W - sidePad * 2;
    const count = this.opts.tabs.length;
    const w = (barW - gap * (count - 1)) / count;

    this.opts.tabs.forEach((def, i) => {
      const container = new Container();
      container.position.set(sidePad + i * (w + gap), y);
      container.eventMode = "static";
      container.cursor = "pointer";

      const bg = new Graphics();
      const label = new Text({
        text: def.label.toUpperCase(),
        style: new TextStyle({
          fill: COL_TAB_TEXT_IDLE,
          fontFamily,
          fontSize: 20,
          fontWeight: "700",
          letterSpacing: 1,
        }),
      });
      label.anchor.set(0.5);
      label.position.set(w / 2, h / 2);
      container.addChild(bg, label);

      const tab: Tab = { container, bg, label, width: w, height: h, colorT: 0, hover: 0 };
      this.drawTab(tab);

      container.on("pointerover", () => this.tweenHover(tab, 1));
      container.on("pointerout", () => this.tweenHover(tab, 0));
      container.on("pointertap", () => this.setActiveTab(i));

      this.tabs.push(tab);
      this.modal.addChild(container);
    });
  }

  private drawTab(tab: Tab): void {
    const base = lerpColor(COL_TAB_IDLE, this.accent, tab.colorT);
    const fill = lerpColor(base, COL_WHITE, tab.hover * 0.12);
    tab.bg
      .clear()
      .roundRect(0, 0, tab.width, tab.height, tab.height / 2)
      .fill({ color: fill });
    if (tab.colorT > 0.01) {
      tab.bg
        .roundRect(0, 0, tab.width, tab.height, tab.height / 2)
        .stroke({ width: 1.5, color: COL_GOLD_BRIGHT, alpha: 0.6 * tab.colorT });
    }
    tab.label.style.fill = lerpColor(COL_TAB_TEXT_IDLE, COL_WHITE, tab.colorT);
  }

  private tweenHover(tab: Tab, target: number): void {
    this.cancel(tab.hoverAnim);
    const from = tab.hover;
    tab.hoverAnim = this.animate(140, easeOutCubic, (t) => {
      tab.hover = from + (target - from) * t;
      this.drawTab(tab);
    });
  }

  private buildContent(): void {
    const sidePad = 30;
    const top = 132;
    const bottom = 26;
    const cx = sidePad;
    const cy = top;
    const cw = this.W - sidePad * 2;
    const ch = this.H - top - bottom;
    const pad = 24;

    // Content plate.
    const plate = new Graphics()
      .roundRect(cx, cy, cw, ch, 12)
      .fill({ color: COL_CONTENT })
      .roundRect(cx, cy, cw, ch, 12)
      .stroke({ width: 1.5, color: 0xb99543, alpha: 0.85 });
    plate.eventMode = "static";
    this.modal.addChild(plate);

    // Viewport (clipped) + the scrolling content holder inside it.
    this.vpWidth = cw - pad * 2;
    this.vpHeight = ch - pad * 2;

    this.viewport = new Container();
    this.viewport.position.set(cx + pad, cy + pad);

    this.contentMask = new Graphics()
      .rect(cx + pad, cy + pad, this.vpWidth, this.vpHeight)
      .fill({ color: 0xffffff });
    this.modal.addChild(this.contentMask);
    this.viewport.mask = this.contentMask;

    this.scroll = new Container();
    this.viewport.addChild(this.scroll);
    this.modal.addChild(this.viewport);

    // Wheel + drag scrolling, captured over the whole plate.
    plate.hitArea = new Rectangle(cx, cy, cw, ch);
    plate.on("wheel", (e: FederatedWheelEvent) => {
      this.scrollBy(-e.deltaY);
      e.preventDefault?.();
    });
    plate.on("pointerdown", (e: FederatedPointerEvent) => {
      this.dragging = true;
      this.dragStartY = e.global.y;
      this.dragStartScroll = this.scroll.y;
    });
    plate.on("pointermove", (e: FederatedPointerEvent) => {
      if (!this.dragging) return;
      this.setScroll(this.dragStartScroll + (e.global.y - this.dragStartY));
    });
    const endDrag = (): void => {
      this.dragging = false;
    };
    plate.on("pointerup", endDrag);
    plate.on("pointerupoutside", endDrag);

    // Build one content node per tab (only the active one is shown).
    this.opts.tabs.forEach((def) => {
      const node = this.makeContentNode(def.content);
      node.visible = false;
      this.scroll.addChild(node);
      this.contentNodes.push(node);
      this.scrollOffsets.push(0);
    });

    // Scrollbar thumb (drawn on demand).
    this.scrollbar = new Graphics();
    this.modal.addChild(this.scrollbar);
  }

  /** Wrap a string into a body Text, or pass through a ready-made container. */
  private makeContentNode(content: string | Container): Container {
    if (content instanceof Container) return content;
    const wrap = new Container();
    const body = new Text({
      text: content,
      style: new TextStyle({
        fill: COL_BODY,
        fontFamily,
        fontSize: 18,
        fontWeight: "400",
        lineHeight: 27,
        wordWrap: true,
        wordWrapWidth: this.vpWidth - 14, // leave room for the scrollbar
      }),
    });
    wrap.addChild(body);
    return wrap;
  }

  // === tab switching =======================================================

  private applyActiveTab(index: number, immediate: boolean): void {
    const prev = this.activeIndex;
    this.activeIndex = index;

    this.tabs.forEach((tab, i) => {
      const target = i === index ? 1 : 0;
      if (immediate) {
        tab.colorT = target;
        this.drawTab(tab);
      } else {
        this.cancel(tab.colorAnim);
        const from = tab.colorT;
        tab.colorAnim = this.animate(220, easeOutCubic, (t) => {
          tab.colorT = from + (target - from) * t;
          this.drawTab(tab);
        });
      }
    });

    const showNode = (i: number): void => {
      const node = this.contentNodes[i];
      node.visible = true;
      this.setScroll(this.scrollOffsets[i], i);
      if (immediate) {
        node.alpha = 1;
      } else {
        node.alpha = 0;
        this.animate(180, easeOutCubic, (t) => (node.alpha = t));
      }
    };

    if (immediate || prev === index) {
      this.contentNodes.forEach((n, i) => (n.visible = i === index));
      showNode(index);
      return;
    }

    // Cross-fade: fade the old node out, then reveal the new one.
    const old = this.contentNodes[prev];
    this.animate(
      140,
      easeOutCubic,
      (t) => (old.alpha = 1 - t),
      () => {
        old.visible = false;
        showNode(index);
      },
    );
  }

  // === scrolling ===========================================================

  private maxScroll(index = this.activeIndex): number {
    const node = this.contentNodes[index];
    if (!node) return 0;
    return Math.max(0, node.height - this.vpHeight);
  }

  private scrollBy(dy: number): void {
    this.setScroll(this.scroll.y + dy);
  }

  private setScroll(y: number, index = this.activeIndex): void {
    const clamped = clamp(y, -this.maxScroll(index), 0);
    this.scroll.y = clamped;
    this.scrollOffsets[index] = clamped;
    this.drawScrollbar(index);
  }

  private drawScrollbar(index: number): void {
    const max = this.maxScroll(index);
    this.scrollbar.clear();
    if (max <= 0) return;

    const sidePad = 30;
    const top = 132;
    const bottom = 26;
    const cw = this.W - sidePad * 2;
    const ch = this.H - top - bottom;
    const trackX = sidePad + cw - 12;
    const trackY = top + 14;
    const trackH = ch - 28;
    const node = this.contentNodes[index];

    const thumbH = Math.max(28, (this.vpHeight / node.height) * trackH);
    const t = max > 0 ? -this.scroll.y / max : 0;
    const thumbY = trackY + (trackH - thumbH) * t;

    this.scrollbar
      .roundRect(trackX, trackY, 4, trackH, 2)
      .fill({ color: 0xffffff, alpha: 0.06 })
      .roundRect(trackX, thumbY, 4, thumbH, 2)
      .fill({ color: this.accent, alpha: 0.85 });
  }

  // === layout / lifecycle ==================================================

  private layoutScreen(): void {
    this.overlay
      .clear()
      .rect(0, 0, this.screenW, this.screenH)
      .fill({ color: COL_SHADOW });
    this.overlay.alpha = this.visible ? OVERLAY_ALPHA : 0;
    this.modal.position.set(this.screenW / 2, this.screenH / 2);
  }

  private close(): void {
    this.hide();
    this.opts.onClose?.();
  }

  // === tiny tween manager (shared-ticker driven) ===========================

  private animate(
    duration: number,
    ease: Easing,
    onUpdate: (t: number) => void,
    onComplete?: () => void,
  ): number {
    const id = this.nextAnimId++;
    this.anims.push({ id, elapsed: 0, duration, ease, onUpdate, onComplete });
    onUpdate(0);
    return id;
  }

  private cancel(id?: number): void {
    if (id == null) return;
    const i = this.anims.findIndex((a) => a.id === id);
    if (i >= 0) this.anims.splice(i, 1);
  }

  private tick(dtMs: number): void {
    if (this.anims.length === 0) return;
    // Iterate a snapshot so completions that start new anims don't disturb us.
    for (const a of [...this.anims]) {
      a.elapsed += dtMs;
      const t = a.duration <= 0 ? 1 : Math.min(1, a.elapsed / a.duration);
      a.onUpdate(a.ease(t));
      if (t >= 1) {
        this.cancel(a.id);
        a.onComplete?.();
      }
    }
  }
}
