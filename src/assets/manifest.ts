import { GameMode } from '../core/GameMode';
import type { SymbolId } from '../config/symbols';

// Importing assets (rather than referencing /public paths) lets Vite hash them
// and rewrite the URL with the correct base, so they work in dev and on Pages.

import ace from './symbols/symbol-ace.png';
import king from './symbols/symbol-king.png';
import queen from './symbols/symbol-queen.png';
import jack from './symbols/symbol-jack.png';
import ten from './symbols/symbol-ten.png';
import goldhorse from './symbols/symbol-goldhorse.png';
import redhorse from './symbols/symbol-redhorse.png';
import bluehorse from './symbols/symbol-bluehorse.png';
import jocky from './symbols/symbol-jocky.png';
import cap from './symbols/symbol-cap.png';
import binoculars from './symbols/symbol-binoculars.png';
import shoehorse from './symbols/symbol-shoehorse.png';
import wild from './symbols/symbol-wild.png';
import bonus from './symbols/symbol-bonus.png';
import trophy from './symbols/symbol-trophy.png';

import baseBackground from './background/base-background.png';
import freeSpinBackground from './background/freespin-background.png';
import holdRespinBackground from './background/hold-spin-background.png';
import frame from './frame.png';
import logo from './logo.png';

import controlLeftEdge from './game-control/control-left-edge.png';
import controlCenter from './game-control/control-center.png';
import controlRightEdge from './game-control/control-right-edge.png';
import spinButton from './game-control/spin-button.png';
import buttonMenu from './game-control/button-menu.png';
import buttonAdd from './game-control/button-add.png';
import buttonSubtract from './game-control/button-subtract.png';
import buttonTurbo from './game-control/button-turbo.png';

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
  menu: buttonMenu,
  add: buttonAdd,
  subtract: buttonSubtract,
  turbo: buttonTurbo,
};

/** Every asset URL, for preloading through pixi's Assets in one pass. */
export const ALL_ASSET_URLS: string[] = [
  ...Object.values(SYMBOL_TEXTURES),
  ...Object.values(BACKGROUNDS),
  ...Object.values(CONTROL),
  FRAME,
  LOGO,
];
