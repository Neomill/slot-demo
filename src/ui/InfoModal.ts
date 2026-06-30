import {
  Assets,
  ColorMatrixFilter,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  TextStyle,
  Ticker,
  type Texture,
  type FederatedPointerEvent,
  type FederatedWheelEvent,
} from "pixi.js";
import { fontFamily } from "./theme";
import { INFO_PANEL } from "../assets/manifest";

export interface InfoModalTab {
  label: string;
  /** Optional word-mark image (asset URL) shown instead of the text label. */
  icon?: string;
  /**
   * Body text (word-wrapped), a ready-made display object, or a factory that
   * builds one given the content width (in px) — used for layouts that must fit
   * the viewport, like the payline grid.
   */
  content: string | Container | ((width: number) => Container);
}

export interface InfoModalOptions {
  width?: number;
  height?: number;
  title?: string;
  /** Optional word-mark image (asset URL) shown instead of the title text. */
  titleIcon?: string;
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
const DEFAULT_ACCENT = 0xe3a53a; // warm gold for the active tab / scrollbar
const COL_SHADOW = 0x000000; // full-screen scrim
const COL_TAB_TEXT_IDLE = 0xd8c38f; // text-tab fallback (no icon)
const COL_WHITE = 0xffffff;
const COL_BODY = 0xc9d6e6;
const COL_TITLE = 0xf3d27a;
const OVERLAY_ALPHA = 0.65;

// Inactive image tabs are desaturated + darkened (but kept fully opaque); these
// feed a ColorMatrixFilter whose alpha blends 0 (active, full colour) → 1 (dull).
const TAB_DULL_SATURATE = -0.55;
const TAB_DULL_BRIGHTNESS = 0.5;
/** Fraction of the tab cell the word-mark fills (lower = smaller title). */
const TAB_ICON_FILL = 0.72;
/** On-screen height (px) of the title word-mark image. */
const TITLE_ICON_HEIGHT = 36;

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
  /** Image tabs: the word-mark sprite + the dull filter blended by state. */
  sprite?: Sprite;
  dull?: ColorMatrixFilter;
  baseScale: number; // image's fit-to-cell scale (sprite tabs only)
  /** Text fallback (tabs declared without an icon). */
  label?: Text;
  width: number;
  height: number;
  colorT: number; // 0 = idle … 1 = active
  hover: number; // 0 … 1 hover brighten
  colorAnim?: number;
  hoverAnim?: number;
}

/**
 * A reusable "INFO / PAYTABLE" modal: a full-screen scrim, a gold-framed panel
 * built from a vertical 3-slice image (rounded top + stretchable centre +
 * rounded bottom), a title, an image close button, a row of capsule tabs, and a
 * scrollable content area (text only — no inner background plate). Self-driven —
 * it animates off Pixi's shared ticker, so callers only need show() / hide().
 *
 * API: show(), hide(), setActiveTab(i), resize(w, h), destroy().
 */
export class InfoModal extends Container {
  private readonly opts: Required<
    Omit<InfoModalOptions, "onClose" | "titleIcon">
  > &
    Pick<InfoModalOptions, "onClose" | "titleIcon">;
  private readonly W: number;
  private readonly H: number;
  private readonly accent: number;

  private readonly overlay: Graphics;
  private readonly modal: Container;
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
      titleIcon: options.titleIcon,
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

    // Vertical 3-slice: fit each slice to the modal width, keep the top/bottom
    // caps at their natural (scaled) height, and stretch the centre to fill the
    // gap — so the framed panel matches whatever W/H the modal is given.
    const top = new Sprite(Assets.get<Texture>(INFO_PANEL.top));
    const capH = (top.texture.height / top.texture.width) * W;

    top.width = W;
    top.height = capH;
    top.position.set(0, 0);

    const bottom = new Sprite(Assets.get<Texture>(INFO_PANEL.bottom));
    bottom.width = W;
    bottom.height = capH;
    bottom.position.set(0, H - capH);

    const center = new Sprite(Assets.get<Texture>(INFO_PANEL.center));
    center.width = W;
    center.height = Math.max(0, H - capH * 2);
    center.position.set(0, capH);

    // Absorb taps anywhere on the panel so they don't reach the close-on-tap scrim.
    for (const slice of [center, top, bottom]) slice.eventMode = "static";

    this.modal.addChild(center, top, bottom);
  }

  private buildTitle(): void {
    // Prefer the word-mark image; fall back to text when no icon is supplied.
    if (this.opts.titleIcon) {
      const sprite = new Sprite(Assets.get<Texture>(this.opts.titleIcon));
      sprite.anchor.set(0.5);
      sprite.scale.set(TITLE_ICON_HEIGHT / sprite.texture.height);
      sprite.position.set(this.W / 2, 40);
      this.modal.addChild(sprite);
      return;
    }

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
    const size = 40;
    const btn = new Sprite(Assets.get<Texture>(INFO_PANEL.close));
    btn.anchor.set(0.5);
    const baseScale = size / btn.texture.width;
    btn.scale.set(baseScale);
    btn.position.set(this.W - 30, 30);
    btn.eventMode = "static";
    btn.cursor = "pointer";

    // Gentle grow on hover (the only state change — the art carries the look).
    let hover = 0;
    let hoverAnim: number | undefined;
    const toward = (target: number): void => {
      this.cancel(hoverAnim);
      const from = hover;
      hoverAnim = this.animate(140, easeOutCubic, (t) => {
        hover = from + (target - from) * t;
        btn.scale.set(baseScale * (1 + 0.12 * hover));
      });
    };
    btn.on("pointerover", () => toward(1));
    btn.on("pointerout", () => toward(0));
    btn.on("pointertap", () => this.close());

    this.modal.addChild(btn);
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
      container.hitArea = new Rectangle(0, 0, w, h); // whole cell clickable

      const tab = def.icon
        ? this.makeImageTab(container, def.icon, w, h)
        : this.makeTextTab(container, def.label, w, h);
      this.drawTab(tab);

      container.on("pointerover", () => this.tweenHover(tab, 1));
      container.on("pointerout", () => this.tweenHover(tab, 0));
      container.on("pointertap", () => this.setActiveTab(i));

      this.tabs.push(tab);
      this.modal.addChild(container);
    });
  }

  /** A tab shown as a gold word-mark image (no pill — its brightness is the state). */
  private makeImageTab(
    container: Container,
    icon: string,
    w: number,
    h: number,
  ): Tab {
    const sprite = new Sprite(Assets.get<Texture>(icon));
    sprite.anchor.set(0.5);
    sprite.position.set(w / 2, h / 2);
    // Contain the word-mark within the cell (aspect-preserved), then shrink a
    // little so it doesn't fill the whole tab.
    const baseScale =
      Math.min(w / sprite.texture.width, h / sprite.texture.height) *
      TAB_ICON_FILL;
    sprite.scale.set(baseScale);

    // Desaturate + darken when inactive; alpha (set in drawTab) blends the look in.
    const dull = new ColorMatrixFilter();
    dull.saturate(TAB_DULL_SATURATE, false);
    dull.brightness(TAB_DULL_BRIGHTNESS, true);
    sprite.filters = [dull];

    container.addChild(sprite);
    return {
      container,
      sprite,
      dull,
      baseScale,
      width: w,
      height: h,
      colorT: 0,
      hover: 0,
    };
  }

  /** Text fallback for tabs declared without an icon (recoloured by state). */
  private makeTextTab(
    container: Container,
    label: string,
    w: number,
    h: number,
  ): Tab {
    const text = new Text({
      text: label.toUpperCase(),
      style: new TextStyle({
        fill: COL_TAB_TEXT_IDLE,
        fontFamily,
        fontSize: 20,
        fontWeight: "700",
        letterSpacing: 1,
      }),
    });
    text.anchor.set(0.5);
    text.position.set(w / 2, h / 2);
    container.addChild(text);
    return {
      container,
      label: text,
      baseScale: 1,
      width: w,
      height: h,
      colorT: 0,
      hover: 0,
    };
  }

  private drawTab(tab: Tab): void {
    // How "lit" the tab reads: active = full; inactive lifts a little on hover.
    const lit = Math.min(1, tab.colorT + tab.hover * (1 - tab.colorT) * 0.5);
    if (tab.dull && tab.sprite) {
      tab.dull.alpha = 1 - lit; // 0 = full colour (active), 1 = dull (inactive)
      tab.sprite.scale.set(tab.baseScale * (1 + 0.04 * tab.hover));
    } else if (tab.label) {
      tab.label.style.fill = lerpColor(COL_TAB_TEXT_IDLE, COL_WHITE, lit);
    }
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

    // No content background — the text sits directly on the panel art. This
    // invisible plate only captures wheel/drag scrolling over the content area.
    const plate = new Graphics();
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

  /**
   * Resolve a tab's content into a display node: a ready-made container, the
   * result of a factory (given the viewport width, e.g. the payline grid), or a
   * word-wrapped body Text built from a string.
   */
  private makeContentNode(content: InfoModalTab["content"]): Container {
    if (typeof content === "function") return content(this.vpWidth);
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
