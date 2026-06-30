import { HUD } from '../theme';

/**
 * HUD layout tokens — the single source of truth for the controller's geometry.
 *
 * Everything is derived from a few design tokens (bar size, button sizes, value
 * "slot" widths and gaps). Component positions are *computed* from those tokens
 * rather than hand-placed, so there are no magic pixel offsets to chase: change
 * a token and the columns re-derive consistently.
 */

const W = HUD.width; // 814 — the controller shares the slot frame's width

// --- bar (control-art) geometry --------------------------------------------
const BAR_HEIGHT = 110; // native height of the control art
const BAR_TOP = HUD.height - BAR_HEIGHT; // bar sits flush to the bottom of the HUD box

export const BAR = {
  width: W,
  height: BAR_HEIGHT,
  top: BAR_TOP,
  centerY: BAR_TOP + BAR_HEIGHT / 2,
  edgeWidth: 196, // native width of the left/right edge pieces (3-slice)
  margin: 72, // panel inset; the menu/turbo buttons live in this margin
} as const;

// --- the bordered panel ------------------------------------------------------
export const PANEL = {
  x: BAR.margin,
  width: W - BAR.margin * 2,
  innerPad: 38, // the dark interior begins this far inside the ornate edge art
} as const;

// --- circular buttons --------------------------------------------------------
export const BUTTON = {
  diameter: 64, // menu / turbo
  step: 28, // +/- steppers
} as const;

// --- the green SPIN button ---------------------------------------------------
export const SPIN = { width: 152, height: 80, dy: -4 } as const;

// --- value "slots": the fixed box each readout is fit into -------------------
export const SLOT = { balance: 66, bet: 52, win: 110 } as const;

// --- gaps --------------------------------------------------------------------
export const GAP = {
  toSpin: 14, // between a side cluster and the spin button
  betStep: 7, // between the bet value's slot edge and a stepper
} as const;

// --- vertical offsets of label / value from the bar centre -------------------
export const TEXT_DY = { label: -20, value: 8 } as const;

// --- derived horizontal anchors ---------------------------------------------
const center = W / 2;
const interiorLeft = PANEL.x + PANEL.innerPad;
const interiorRight = PANEL.x + PANEL.width - PANEL.innerPad;

// Distance from the bet value's centre out to the far edge of a stepper.
const betReach = SLOT.bet / 2 + GAP.betStep + BUTTON.step;

// Left content runs from the interior edge up to just before the spin button.
const leftZoneRight = center - SPIN.width / 2 - GAP.toSpin;
const balanceCx = interiorLeft + SLOT.balance / 2 + 2;
const betCx = leftZoneRight - betReach;

/** Final, computed positions consumed by the Hud when it places components. */
export const ANCHORS = {
  // Info button sits in the right margin (radius 32 → ~2px inside the frame).
  infoX: W - 34,
  balanceX: balanceCx,
  betX: betCx,
  // Divider centred in the gap between the balance value and the bet's minus.
  dividerX: Math.round((balanceCx + SLOT.balance / 2 + (betCx - betReach)) / 2),
  spinX: center,
  spinY: BAR.centerY + SPIN.dy,
  // Win centred in the right interior region (mirror of the left content zone).
  winX: Math.round((center + SPIN.width / 2 + GAP.toSpin + interiorRight) / 2),
} as const;
