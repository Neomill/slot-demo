import { gameConfig } from "../config/gameConfig";

export const COLS = gameConfig.reels;
export const ROWS = gameConfig.rows;

/** Native art dimensions (measured from the PNGs). */
export const CANVAS = { width: 1672, height: 941 };
export const FRAME = { width: 814, height: 505 };
/**
 * The FULL reels dimension — the whole grid's pixel size. This is the knob to
 * resize the reels. Cell size is derived from it, and the grid stays centered
 * in the frame automatically (see REEL_ORIGIN). Default 700x390 matches the
 * symbol art's native size; symbols rescale to fit whatever cell this produces.
 */
export const REEL_AREA = { width: 720, height: 420 };

/** Per-cell size, derived from the reel area. */
export const CELL = {
  width: REEL_AREA.width / COLS,
  height: REEL_AREA.height / ROWS,
};

/** Gap around each symbol inside its cell, so the backdrop shows through. */
export const CELL_PADDING = 10;

/** The reel grid is COLS x ROWS cells. */
export const GRID = { width: COLS * CELL.width, height: ROWS * CELL.height };

/**
 * How far the whole playfield sits below the vertical centre. Everything that
 * derives from FRAME_POS — the frame, reels, backdrop, HUD, side panels and the
 * free-spin overlay — shifts down by this, in every mode, leaving a fixed band
 * at the top for the logo (and the free-spin panels). The logo and background
 * don't derive from FRAME_POS, so they stay put.
 */
export const PLAYFIELD_DROP = 40;

/** Frame is horizontally centered, pushed down by PLAYFIELD_DROP. */
export const FRAME_POS = {
  x: (CANVAS.width - FRAME.width) / 2,
  y: (CANVAS.height - FRAME.height) / 2 + PLAYFIELD_DROP,
};

/** Tweak if the reels don't sit perfectly inside the frame's window. */
export const REEL_NUDGE = { x: 0, y: 20 };

/** Reel grid origin: centered inside the frame, plus the nudge. */
export const REEL_ORIGIN = {
  x: FRAME_POS.x + (FRAME.width - GRID.width) / 2 + REEL_NUDGE.x,
  y: FRAME_POS.y + (FRAME.height - GRID.height) / 2 + REEL_NUDGE.y,
};

/** Spin timing: each reel to the right spins a little longer (staggered stop). */
export const SPIN = { baseMs: 650, staggerMs: 140 };

/**
 * Free Spins anticipation cinematic. Kicks in on a base spin once two Scatter
 * (Bonus) symbols have landed and a later reel can still complete the 3+ trigger
 * (see planAnticipation). Every value here is presentation-only — the reels
 * reveal the predetermined outcome, never change it.
 */
export const ANTICIPATION = {
  /** Base extended-spin length for the first anticipation reel (ms). */
  baseMs: 1500,
  /** Each subsequent anticipation reel spins this much longer than the last. */
  stepMs: 650,
  /** Background brightness while anticipating (1 = full). */
  dimBrightness: 0.7,
  /** Ease time for the background dim in/out (ms). */
  dimFadeMs: 220,
  /** Gold "this reel can complete it" outline (matches `colors.accent`). */
  outlineColor: 0xffd34d,
  outlineWidth: 5,
  /** Breathing glow: alpha eases between min and max over one full cycle. */
  breatheMs: 1000,
  breatheMin: 0.8,
  breatheMax: 1.0,
  /** Subtle camera shake on the reels while an anticipation reel spins. */
  shakeAmp: 1.2, // px
  shakeHz: 13,
  /** Vertical motion blur cap on a spinning anticipation reel. */
  blurMax: 8,
  /** Scatter landing bounce (scale 1 → 0.92 → 1.08 → 1). */
  bounceMs: 160,
  /** Gold shockwave ring that bursts from a landed Scatter. */
  shockwaveMs: 520,
  shockwaveRadius: 250,
  /** Full-screen bloom flash on the triggering Scatter / Free Spins entry. */
  bloomMs: 600,
  bloomPeak: 0.55,
  /** Beat between the cinematic landing and the Free Spins intro. */
  entryPauseMs: 400,
} as const;

/**
 * Win & Bonus FX system (see soundIdea.md → "SLOT WIN & BONUS FX SYSTEM").
 *
 * The presentation of a *winning* spin, scaled by an intensity (1–10). The
 * design rule is "one emotion per moment": dim the board to focus the win
 * (focus), trace the payline (reveal), pop the winning symbols one at a time
 * (activation), then settle. Effects never stack — motion and dimming carry the
 * hierarchy, not piled-on glow. Big extras (camera shake, full-screen bloom) are
 * gated behind intensity thresholds so small wins stay calm.
 *
 * Every value here is presentation-only. winFx.ts turns an intensity into a
 * scaled `WinFxParams`; Reels.playWinPresentation renders it. Tune freely.
 */
export const WIN_FX = {
  // STEP 1 — Focus: desaturate + darken the non-winning symbols. Saturate is a
  // ColorMatrix amount (0 = unchanged, -1 = greyscale); -0.6 ≈ 0.4 saturation.
  focusInMs: 100,
  focusOutMs: 220,
  dimSaturate: -0.6,
  dimBrightness: 0.7,
  // Free Spins keeps the focus much lighter (the mode is already a reward flow).
  fsDimSaturate: -0.3,
  fsDimBrightness: 0.86,

  // STEP 2 — Payline reveal: a thin amber line traced left → right along the win.
  lineColor: 0xffcc66,
  lineAlpha: 0.6,
  lineWidthMin: 2,
  lineWidthMax: 3,
  lineDrawMs: 300,

  // STEP 3 — Symbol activation: a sequential pop (scale + lift) with a soft inner
  // glow and a single shimmer sweep. Scales/lift grow with intensity.
  popScaleMin: 1.06,
  popScaleMax: 1.12,
  liftMin: 3, // px
  liftMax: 7,
  activationMs: 360,
  stepMs: 120, // stagger between consecutive symbols
  shimmerMs: 150,
  glowAlphaMin: 0.3,
  glowAlphaMax: 0.6,

  // Gated "big moment" extras (never on small/normal wins).
  bigFxIntensity: 6, // camera shake at/above this
  bloomIntensity: 8, // full-screen bloom flash at/above this
  shakeAmp: 3, // px
  shakeHz: 18,
  shakeMs: 320,

  // STEP 5 — Finish: hold the lit win, then restore. Hold grows with intensity.
  holdMinMs: 380,
  holdMaxMs: 520,
} as const;

/**
 * Wild Charge feature-progression cinematic (Free Spins only). When a Wild
 * collects prizes it absorbs the energy, then fires a curved beam up to the next
 * lock on the multiplier ladder, charging it. Every value here is
 * presentation-only — the reels/panel reveal the engine's wild count, never
 * change it. See Reels.collectIntoWild, FeatureBeam, FreeSpinPanel.
 */
export const WILD_CHARGE = {
  // Phase 3 — Camera focus: the reels darken (overlay alpha; reels read at ~75%)
  // while the beam travels, so the lit panel reads as the brighter focal point.
  reelDim: 0.28,
  focusFadeMs: 200,

  // Phase 2 — The beam: a quadratic bezier bowed `curve` px to the side, drawn
  // gold-cored with a blurred blue edge, trailing gold spark particles.
  beamTravelMs: 460,
  beamCurve: 140, // px lateral bow of the spline
  beamCoreColor: 0xffe7a3,
  beamCoreWidth: 6,
  beamEdgeColor: 0x4aa8ff,
  beamEdgeWidth: 18,
  beamFadeMs: 200,
  sparkColor: 0xffe08a,
  sparkEveryMs: 22, // a spark spawned this often along the beam head

  // Phase 4 — Charge slot: energy hit → expand → fill (gold ripple) → bounce.
  hitMs: 80,
  expandMs: 120,
  fillMs: 180,
  bounceMs: 100,
  lockExpandScale: 1.6,
  rippleColor: 0xffd34d,
  rippleRadius: 48,

  // Phase 5 — Partial panel (1–3/4) gently breathes its glow 40% ↔ 60%.
  breatheMs: 1600,
  breatheMin: 0.4,
  breatheMax: 0.6,

  // Phase 6 — Fourth charge: the whole panel flashes, a gold spark runs the
  // border like electricity, then the "+10 FREE SPIN" banner reveals (pop in).
  flashMs: 240,
  borderRunMs: 820,
  borderColor: 0xffe7a3,
  bannerRevealMs: 320,
  // After the celebration the gold border stays lit (steady) while the panel is
  // queued — a persistent "on queue, reward waiting" frame on top of the plate.
  queueBorderAlpha: 0.9,

  // Queue state: a completed panel pulses gold every ~2s — "reward waiting".
  // Kept gentle (and below the breathing range) so a row of completed panels
  // doesn't read as harsh. All panels share one clock, so they pulse in unison.
  queuePulseMs: 2000,
  queueGlowMin: 0.12,
  queueGlowMax: 0.42,
  glowColor: 0xffe08a,

  // Free Spin end ceremony (Phases 7–8). The counter empties, a beat of
  // anticipation, then each queued panel activates → transfers its 10 spins as
  // energy orbs → is consumed (grey + checkmark), chaining to the next panel.
  endPauseMs: 300, // beat after the counter hits 0, before activation
  activationMs: 460, // panel glows, opens, light escapes
  orbCount: 10, // orbs emitted per panel (one per awarded spin)
  orbStaggerMs: 55, // gap between successive orbs leaving the panel
  orbTravelMs: 440,
  orbArcCurve: 90, // px bow on the orb's path to the counter
  orbColor: 0xffe7a3,
  counterBumpMs: 180, // counter scale 1 → 1.12 → 1 on each increment
  counterBumpScale: 1.12,
  // Once collected, a panel fades to a dull "disabled" look (desaturated +
  // darkened + faded) so it reads as spent vs. the lit panels still on queue.
  consumeMs: 420,
  consumeSaturate: -0.85, // ColorMatrix saturate amount (≈ greyscale)
  consumeBrightness: 0.5, // darken multiplier
  consumeDullAlpha: 0.7, // overall panel opacity when collected
  chainGapMs: 500, // wait before the next queued panel begins
} as const;

/**
 * The dark panel behind the reels. By default it matches the reel grid exactly;
 * use paddingX/paddingY to grow (or, with negatives, shrink) it on each side.
 */
export const BACKDROP = {
  paddingX: 0,
  paddingY: 0,
  radius: 8,
  color: 0x000000,
  alpha: 0.7,
};

/** Thin dividers between reels. */
export const SEPARATOR = { width: 1, color: 0xf9ec7d };

export const fontFamily =
  "'Barlow Condensed', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
export const colors = { text: 0xffffff, accent: 0xffd34d, lock: 0xffd34d };

/**
 * Game controller (HUD) bar. Width matches the slot frame and it sits directly
 * below it (FRAME bottom + gap), so the slot and controller share a width.
 */
export const HUD = { width: FRAME.width, height: 120, gap: 0 };
export const HUD_POS = {
  x: FRAME_POS.x,
  y: FRAME_POS.y + FRAME.height + HUD.gap,
};

/**
 * The two call-to-action panels (Buy Bonus / Luck Boost) stacked in the margin
 * to the left of the reel frame. Native art is 656x879 (portrait); width is the
 * knob — height follows the art's aspect, and the pair is centred vertically on
 * the frame. Nudge `centerX` to slide them toward or away from the frame.
 */
const SIDE_ASPECT = 879 / 656;
export const SIDE_PANEL = (() => {
  const width = 150;
  const height = Math.round(width * SIDE_ASPECT);
  const gap = 5;
  const centerX = 360;
  const stackCenterY = FRAME_POS.y + FRAME.height / 2 - 30;
  const half = (height + gap) / 2;
  return {
    width,
    height,
    gap,
    centerX,
    buyY: stackCenterY - half,
    luckY: stackCenterY + half,
  };
})();

/**
 * The Free Spins overlay that sits in the band directly above the reel frame.
 * Left: a large counter (FREE SPINS label + remaining-spins digits) whose left
 * edge lines up with the frame's left edge. Right: three small multiplier panels
 * (×2 / ×3 / ×10) in a row, each showing four wild locks that turn to unlocks as
 * wilds are collected; the row's right edge lines up with the frame's right edge
 * and `gap` is the horizontal space between panels. Native art: counter 140×114,
 * panel 160×49.
 */
export const FREE_SPIN_PANEL = (() => {
  const baseY = FRAME_POS.y - 6; // panels' bottoms sit just above the frame

  const counterWidth = 130; // counter size; height follows the art's aspect
  const counterHeight = Math.round((counterWidth * 114) / 140);

  // Move the top-left counter from its default (left edge on the frame, bottom
  // just above it): +x = right, -x = left; +y = down, -y = up.
  const counterNudge = { x: 50, y: 30 };

  const panelWidth = 185;
  // Panel height in px. The art is natively 160×49, so panelWidth × 49/160 (≈57
  // here) keeps it undistorted; a larger value stretches the plate taller.
  const panelHeight = 69;
  const panelGap = 6;

  // Move the whole multiplier row from its default (right edge on the frame,
  // bottom just above it): +x = right, -x = left; +y = down, -y = up.
  const panelNudge = { x: -50, y: 30 };

  return {
    baseY,
    counter: {
      width: counterWidth,
      height: counterHeight,
      x: FRAME_POS.x + counterNudge.x, // left edge aligned with the frame
      y: baseY - counterHeight + counterNudge.y,
    },
    panel: {
      width: panelWidth,
      height: panelHeight,
      gap: panelGap,
      rightX: FRAME_POS.x + FRAME.width + panelNudge.x, // right edge aligned with the frame
      nudgeY: panelNudge.y,
    },
    /** Four wild locks per panel; three panels → the 12-wild progression. */
    wildsPerPanel: 4,
  };
})();

/** Idle (dull) vs. lit (full-colour) look for the side panels. */
export const SIDE_PANEL_LOOK = {
  dullSaturate: -0.4, // ColorMatrix saturate amount when idle (0 = unchanged)
  dullBrightness: 0.9, // brightness multiplier when idle (1 = unchanged)
  hoverScale: 1,
  pressScale: 1,
  glowColor: 0xffe08a,
  glowAlpha: 0.5,
  /** ms to ease between dull and lit. */
  fadeMs: 140,

  disabledSaturate: -0.7, // ColorMatrix saturate amount (≈ greyscale)
  disabledBrightness: 0.5, // darken multiplier
  disabledAlpha: 0.7, // overall panel opacity
  disabledFadeMs: 420, // ms to ease into / out of the locked-out look
} as const;

/**
 * Hold & Respin entry + lock cinematic (the spec's anticipation → confirmation
 * beats, scaled to the systems we already have). All presentation-only.
 *
 * - Golden Freeze (trigger): the recognition moment as the feature begins — every
 *   non-trophy tile fades back while the trophies stay lit, each bloom-glowing
 *   with a shockwave, and the board gives a short shake.
 * - Trophy lock impact: a new trophy landing mid-feature lands with its own
 *   shockwave + glow (the "trophy secures another lap" beat).
 * - The "REMAINING" panel drops its number in on entry, and plays a "Golden
 *   Rewind" (old number bursts, new one slams down) whenever the counter refills.
 */
export const HOLD_RESPIN_FX = {
  freezeDimAlpha: 0.35, // non-trophy tile opacity during the freeze
  freezeHoldMs: 750,
  freezeShakeAmp: 2, // px
  freezeShakeMs: 360,
  freezeGlowPeak: 0.7, // additive gold bloom behind each trophy
  lockGlowPeak: 0.6, // bloom behind a trophy that locks during a respin
  lockGlowMs: 420,
  entranceMs: 420, // counter "number drop" on entry
  rewindOutMs: 260, // old number bursts/fades
  rewindInMs: 320, // new number slams down
} as const;

export const hudColors = {
  barTop: 0x16243f,
  barBottom: 0x080d18,
  gold: 0xe8c879,
  goldBright: 0xf7e08a,
  label: 0xe9d8a6,
  value: 0xffffff,
  win: 0xffd23f,
  green: 0x2f9e44,
  greenLight: 0x69db7c,
  greenDark: 0x1f6b30,
  buttonFill: 0x0e1626,
  box: 0x05080f,
};
