import { TextStyle } from 'pixi.js';
import { fontFamily, hudColors as C } from '../theme';

/**
 * HUD typography. Factories (not shared instances) so each Text owns its style
 * and nothing is mutated from under another label.
 */

/** Caption above a readout — BALANCE / BET / WIN. */
export const labelStyle = (): TextStyle =>
  new TextStyle({
    fill: C.label,
    fontFamily,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.4,
  });

/** Numeric readout — gold with a soft glow. */
export const valueStyle = (fill: number = C.win): TextStyle =>
  new TextStyle({
    fill,
    fontFamily,
    fontSize: 20,
    fontWeight: '700',
    dropShadow: { color: 0xffe7a0, alpha: 0.5, blur: 5, distance: 0 },
  });

/** "SPIN" lettering on the action button. */
export const spinTitleStyle = (): TextStyle =>
  new TextStyle({
    fill: 0xffffff,
    fontFamily,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: 1,
  });

/** "HOLD FOR AUTO" sub-caption on the action button. */
export const spinSubStyle = (): TextStyle =>
  new TextStyle({
    fill: 0xeafff0,
    fontFamily,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
  });
