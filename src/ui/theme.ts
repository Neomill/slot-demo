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

/** Frame is centered on the canvas. */
export const FRAME_POS = {
  x: (CANVAS.width - FRAME.width) / 2,
  y: (CANVAS.height - FRAME.height) / 2,
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
  'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const colors = { text: 0xffffff, accent: 0xffd34d, lock: 0xffd34d };

/**
 * Game controller (HUD) bar. Width matches the slot frame and it sits directly
 * below it (FRAME bottom + gap), so the slot and controller share a width.
 */
export const HUD = { width: FRAME.width, height: 120, gap: 16 };
export const HUD_POS = {
  x: FRAME_POS.x,
  y: FRAME_POS.y + FRAME.height + HUD.gap,
};

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

