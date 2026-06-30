import { GameMode } from "../core/GameMode";
import type { SymbolId } from "../config/symbols";

// Importing assets (rather than referencing /public paths) lets Vite hash them
// and rewrite the URL with the correct base, so they work in dev and on Pages.

import ace from "./symbols/symbol-ace.png";
import king from "./symbols/symbol-king.png";
import queen from "./symbols/symbol-queen.png";
import jack from "./symbols/symbol-jack.png";
import ten from "./symbols/symbol-ten.png";
import goldhorse from "./symbols/symbol-goldhorse.png";
import redhorse from "./symbols/symbol-redhorse.png";
import bluehorse from "./symbols/symbol-bluehorse.png";
import jocky from "./symbols/symbol-jocky.png";
import cap from "./symbols/symbol-cap.png";
import binoculars from "./symbols/symbol-binoculars.png";
import shoehorse from "./symbols/symbol-shoehorse.png";
import wild from "./symbols/symbol-wild.png";
import bonus from "./symbols/symbol-bonus.png";
import trophy from "./symbols/symbol-trophy.png";

import baseBackground from "./background/base-background.png";
import freeSpinBackground from "./background/freespin-background.png";
import holdRespinBackground from "./background/hold-spin-background.png";
import frame from "./frame.png";
import logo from "./logo.png";

import controlLeftEdge from "./game-control/control-left-edge.png";
import controlCenter from "./game-control/control-center.png";
import controlRightEdge from "./game-control/control-right-edge.png";
import spinButton from "./game-control/spin-button.png";
import buttonInfo from "./game-control/button-info.png";
import buttonAdd from "./game-control/button-add.png";
import buttonSubtract from "./game-control/button-subtract.png";

import buyBonus from "./buy-bunos.png";
import buyHoldRespin from "./buy-hold-and-respin.png";

import infoPanelTop from "./info-modal/top-info-panel.png";
import infoPanelCenter from "./info-modal/center-info-panel.png";
import infoPanelBottom from "./info-modal/bottom-info-panel.png";
import infoClose from "./info-modal/button-close.png";
import infoTitle from "./info-modal/info.png";
import infoTabPays from "./info-modal/pays.png";
import infoTabPayline from "./info-modal/payline.png";
import infoTabRules from "./info-modal/rules.png";

import payline1 from "./info-modal/paylines/payline-1.png";
import payline2 from "./info-modal/paylines/payline-2.png";
import payline3 from "./info-modal/paylines/payline-3.png";
import payline4 from "./info-modal/paylines/payline-4.png";
import payline5 from "./info-modal/paylines/payline-5.png";
import payline6 from "./info-modal/paylines/payline-6.png";
import payline7 from "./info-modal/paylines/payline-7.png";
import payline8 from "./info-modal/paylines/payline-8.png";
import payline9 from "./info-modal/paylines/payline-9.png";
import payline10 from "./info-modal/paylines/payline-10.png";
import payline11 from "./info-modal/paylines/payline-11.png";
import payline12 from "./info-modal/paylines/payline-12.png";
import payline13 from "./info-modal/paylines/payline-13.png";
import payline14 from "./info-modal/paylines/payline-14.png";
import payline15 from "./info-modal/paylines/payline-15.png";

import bigWin from "./win-display/big-win.png";
import megaWin from "./win-display/mega-win.png";
import epicWin from "./win-display/epic-win.png";
import legendaryWin from "./win-display/legendary-win.png";
import winAmountLeft from "./win-display/win-amount-background-left.png";
import winAmountCenter from "./win-display/win-amount-background-center.png";
import winAmountRight from "./win-display/win-amount-background-right.png";

import freeSpinBgLarge from "./free-spin-panel/free-spin-bg-counter-large.png";
import freeSpinBgSmall from "./free-spin-panel/free-spin-bg-counter-small.png";
import wildLock from "./free-spin-panel/wild-lock.png";
import wildUnlock from "./free-spin-panel/wild-unlock.png";
import digit0 from "./free-spin-panel/0.png";
import digit1 from "./free-spin-panel/1.png";
import digit2 from "./free-spin-panel/2.png";
import digit3 from "./free-spin-panel/3.png";
import digit4 from "./free-spin-panel/4.png";
import digit5 from "./free-spin-panel/5.png";
import digit6 from "./free-spin-panel/6.png";
import digit7 from "./free-spin-panel/7.png";
import digit8 from "./free-spin-panel/8.png";
import digit9 from "./free-spin-panel/9.png";

/** Symbol id -> texture URL. Keys line up 1:1 with the engine's SymbolId. */
export const SYMBOL_TEXTURES: Record<SymbolId, string> = {
  ace,
  king,
  queen,
  jack,
  ten,
  goldhorse,
  redhorse,
  bluehorse,
  jocky,
  cap,
  binoculars,
  shoehorse,
  wild,
  bonus,
  trophy,
};

/** Per-mode background art. */
export const BACKGROUNDS: Record<GameMode, string> = {
  [GameMode.BASE]: baseBackground,
  [GameMode.FREE_SPINS]: freeSpinBackground,
  [GameMode.HOLD_AND_RESPIN]: holdRespinBackground,
};

export const FRAME = frame;
export const LOGO = logo;

/** Game controller (HUD) art. */
export const CONTROL = {
  leftEdge: controlLeftEdge,
  center: controlCenter,
  rightEdge: controlRightEdge,
  spin: spinButton,
  info: buttonInfo,
  add: buttonAdd,
  subtract: buttonSubtract,
};

/** Side call-to-action panels (left of the reels). */
export const SIDE = {
  buyBonus,
  buyHoldRespin,
};

/**
 * Info / Paytable modal art: a vertical 3-slice frame (rounded top, stretchable
 * centre, rounded bottom — all sharing the gold side borders) plus the round
 * close button. The centre slice stretches to whatever height the modal needs.
 */
export const INFO_PANEL = {
  top: infoPanelTop,
  center: infoPanelCenter,
  bottom: infoPanelBottom,
  close: infoClose,
  title: infoTitle,
};

/** Gold word-mark art for the Info modal's tabs (shown in place of text labels). */
export const INFO_TABS = {
  pays: infoTabPays,
  payline: infoTabPayline,
  rules: infoTabRules,
};

/** The 25-line diagram art (payline 1–15), shown as a grid in the Payline tab. */
export const INFO_PAYLINES: string[] = [
  payline1,
  payline2,
  payline3,
  payline4,
  payline5,
  payline6,
  payline7,
  payline8,
  payline9,
  payline10,
  payline11,
  payline12,
  payline13,
  payline14,
  payline15,
];

/**
 * Free Spins overlay art (shown above the reels during Free Spins): the large
 * remaining-spins counter, the three small multiplier panels, the wild
 * lock/unlock pips, and the 0–9 digit glyphs for the counter.
 */
export const FREE_SPIN = {
  bgLarge: freeSpinBgLarge,
  bgSmall: freeSpinBgSmall,
  wildLock,
  wildUnlock,
  digits: [
    digit0,
    digit1,
    digit2,
    digit3,
    digit4,
    digit5,
    digit6,
    digit7,
    digit8,
    digit9,
  ] as const,
};

/**
 * Win celebration art (the Big/Mega/Epic/Legendary modal shown after a bonus):
 * one gold word-mark per tier, plus the three slices of the win-amount frame
 * (left + right caps with a centre that stretches to fit the amount).
 */
export const WIN_DISPLAY = {
  tiers: {
    big: bigWin,
    mega: megaWin,
    epic: epicWin,
    legendary: legendaryWin,
  },
  amountLeft: winAmountLeft,
  amountCenter: winAmountCenter,
  amountRight: winAmountRight,
};

/** Every asset URL, for preloading through pixi's Assets in one pass. */
export const ALL_ASSET_URLS: string[] = [
  ...Object.values(SYMBOL_TEXTURES),
  ...Object.values(BACKGROUNDS),
  ...Object.values(CONTROL),
  ...Object.values(SIDE),
  ...Object.values(INFO_PANEL),
  ...Object.values(INFO_TABS),
  ...INFO_PAYLINES,
  ...Object.values(FREE_SPIN).flat(),
  ...Object.values(WIN_DISPLAY.tiers),
  WIN_DISPLAY.amountLeft,
  WIN_DISPLAY.amountCenter,
  WIN_DISPLAY.amountRight,
  FRAME,
  LOGO,
];
