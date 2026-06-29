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
