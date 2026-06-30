import { GameMode } from '../core/GameMode';
import { WIN_FX } from './theme';

/**
 * The Win FX intensity system (see soundIdea.md → "INTENSITY SYSTEM").
 *
 * A winning spin is classified to an intensity on a 1–10 scale and every effect
 * scales from it, rather than each effect being hand-tuned per event. The scale
 * mirrors the spec's table:
 *
 *   small win 2 · normal win 4 · big win 6 · (free-spins trigger 8) · jackpot 10
 *
 * This module is pure (no Pixi, no DOM) so the classification and scaling can be
 * unit-tested; Reels.playWinPresentation consumes the resulting `WinFxParams`.
 */

/** Fully resolved, intensity-scaled parameters for one win presentation. */
export interface WinFxParams {
  /** The 1–10 intensity this was scaled from (0 = no win). */
  intensity: number;

  // STEP 1 — Focus (dim the non-winning symbols).
  focusInMs: number;
  focusOutMs: number;
  /** ColorMatrix saturate amount for dimmed tiles (0 = unchanged, -1 = grey). */
  dimSaturate: number;
  /** Brightness multiplier for dimmed tiles (1 = unchanged). */
  dimBrightness: number;

  // STEP 2 — Payline reveal.
  lineColor: number;
  lineAlpha: number;
  lineWidth: number;
  lineDrawMs: number;

  // STEP 3 — Symbol activation.
  /** Peak scale of a symbol's pop (1.06 → 1.12 across the range). */
  popScale: number;
  /** Peak upward lift of a symbol's pop, in px. */
  liftPx: number;
  activationMs: number;
  /** Stagger between consecutive symbols (the "sequential" feel). */
  stepMs: number;
  shimmerMs: number;
  /** Peak alpha of the soft inner glow behind each winning symbol. */
  glowAlpha: number;

  // Gated big-moment extras.
  /** Camera shake is allowed (big win and up). */
  bigFx: boolean;
  /** Shake amplitude in px (0 when `bigFx` is false). */
  shakeAmp: number;
  shakeMs: number;
  /** A full-screen bloom flash is allowed (jackpot-tier wins). */
  bloom: boolean;

  // STEP 5 — Finish.
  holdMs: number;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/**
 * Classify a spin's win into an intensity (0–10) from its size relative to the
 * stake. 0 means "no win" (don't present anything). The thresholds map a
 * win-to-stake ratio onto the spec's intensity tiers.
 *
 * @param totalWin amount credited this spin
 * @param stake    total stake the win is measured against (0 → no intensity)
 */
export function winIntensity(totalWin: number, stake: number): number {
  if (totalWin <= 0 || stake <= 0) return 0;
  const ratio = totalWin / stake;
  if (ratio < 1) return 2; // small  — win below the stake
  if (ratio < 5) return 4; // normal — up to 5×
  if (ratio < 20) return 6; // big    — up to 20×
  if (ratio < 50) return 8; // very big
  return 10; // jackpot — 50×+
}

/**
 * Turn an intensity into the fully scaled parameters for a win presentation.
 * Higher intensity means a stronger pop, a wider/brighter payline, a longer
 * hold, and (past the thresholds) camera shake and a bloom flash. Free Spins
 * softens the focus dim — the mode is already a reward flow, so the win FX
 * stays gentle there — while the big-moment gates are unchanged (a 5×+ win still
 * earns its shake, matching the spec's Free Spins "big FX" rule).
 *
 * @param intensity 0–10 (0 returns calm defaults; callers should skip on 0)
 * @param mode      current game mode (Free Spins lightens the dim)
 */
export function winFxParams(intensity: number, mode: GameMode): WinFxParams {
  // Normalise the 2–10 presentation range to 0–1 for scaling.
  const n = clamp01((intensity - 2) / 8);
  const inFreeSpins = mode === GameMode.FREE_SPINS;
  const bigFx = intensity >= WIN_FX.bigFxIntensity;

  return {
    intensity,

    focusInMs: WIN_FX.focusInMs,
    focusOutMs: WIN_FX.focusOutMs,
    dimSaturate: inFreeSpins ? WIN_FX.fsDimSaturate : WIN_FX.dimSaturate,
    dimBrightness: inFreeSpins ? WIN_FX.fsDimBrightness : WIN_FX.dimBrightness,

    lineColor: WIN_FX.lineColor,
    lineAlpha: WIN_FX.lineAlpha,
    lineWidth: lerp(WIN_FX.lineWidthMin, WIN_FX.lineWidthMax, n),
    lineDrawMs: WIN_FX.lineDrawMs,

    popScale: lerp(WIN_FX.popScaleMin, WIN_FX.popScaleMax, n),
    liftPx: lerp(WIN_FX.liftMin, WIN_FX.liftMax, n),
    activationMs: WIN_FX.activationMs,
    stepMs: WIN_FX.stepMs,
    shimmerMs: WIN_FX.shimmerMs,
    glowAlpha: lerp(WIN_FX.glowAlphaMin, WIN_FX.glowAlphaMax, n),

    bigFx,
    shakeAmp: bigFx ? WIN_FX.shakeAmp : 0,
    shakeMs: WIN_FX.shakeMs,
    bloom: intensity >= WIN_FX.bloomIntensity,

    holdMs: lerp(WIN_FX.holdMinMs, WIN_FX.holdMaxMs, n),
  };
}
