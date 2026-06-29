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

/** Every asset URL, for preloading through pixi's Assets in one pass. */
export const ALL_ASSET_URLS: string[] = [
  ...Object.values(SYMBOL_TEXTURES),
  ...Object.values(BACKGROUNDS),
  FRAME,
  LOGO,
];
