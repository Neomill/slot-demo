import { describe, it, expect } from 'vitest';
import { winIntensity, winFxParams } from './winFx';
import { WIN_FX } from './theme';
import { GameMode } from '../core/GameMode';

describe('winIntensity', () => {
  it('returns 0 for no win', () => {
    expect(winIntensity(0, 15)).toBe(0);
    expect(winIntensity(-5, 15)).toBe(0);
  });

  it('returns 0 when there is no stake to measure against', () => {
    expect(winIntensity(100, 0)).toBe(0);
  });

  it('maps the win-to-stake ratio onto the spec tiers', () => {
    // stake of 15 (15 lines × 1) keeps the ratios easy to read.
    expect(winIntensity(10, 15)).toBe(2); // 0.67× → small
    expect(winIntensity(45, 15)).toBe(4); // 3×    → normal
    expect(winIntensity(150, 15)).toBe(6); // 10×   → big
    expect(winIntensity(450, 15)).toBe(8); // 30×   → very big
    expect(winIntensity(1500, 15)).toBe(10); // 100× → jackpot
  });

  it('is monotonic across the tier boundaries', () => {
    expect(winIntensity(14, 15)).toBe(2); // just under 1×
    expect(winIntensity(15, 15)).toBe(4); // exactly 1×
    expect(winIntensity(75, 15)).toBe(6); // exactly 5×
    expect(winIntensity(300, 15)).toBe(8); // exactly 20×
    expect(winIntensity(750, 15)).toBe(10); // exactly 50×
  });
});

describe('winFxParams', () => {
  it('scales the pop, lift, line width and hold up with intensity', () => {
    const small = winFxParams(2, GameMode.BASE);
    const jackpot = winFxParams(10, GameMode.BASE);

    expect(jackpot.popScale).toBeGreaterThan(small.popScale);
    expect(jackpot.liftPx).toBeGreaterThan(small.liftPx);
    expect(jackpot.lineWidth).toBeGreaterThan(small.lineWidth);
    expect(jackpot.glowAlpha).toBeGreaterThan(small.glowAlpha);
    expect(jackpot.holdMs).toBeGreaterThan(small.holdMs);
  });

  it('pins the ends of the range to the configured min/max', () => {
    const small = winFxParams(2, GameMode.BASE);
    const jackpot = winFxParams(10, GameMode.BASE);

    expect(small.popScale).toBeCloseTo(WIN_FX.popScaleMin);
    expect(jackpot.popScale).toBeCloseTo(WIN_FX.popScaleMax);
    expect(small.liftPx).toBeCloseTo(WIN_FX.liftMin);
    expect(jackpot.liftPx).toBeCloseTo(WIN_FX.liftMax);
  });

  it('gates camera shake behind the big-win threshold', () => {
    expect(winFxParams(4, GameMode.BASE).bigFx).toBe(false);
    expect(winFxParams(4, GameMode.BASE).shakeAmp).toBe(0);

    expect(winFxParams(6, GameMode.BASE).bigFx).toBe(true);
    expect(winFxParams(6, GameMode.BASE).shakeAmp).toBeGreaterThan(0);
  });

  it('gates the full-screen bloom behind the jackpot-tier threshold', () => {
    expect(winFxParams(6, GameMode.BASE).bloom).toBe(false);
    expect(winFxParams(8, GameMode.BASE).bloom).toBe(true);
    expect(winFxParams(10, GameMode.BASE).bloom).toBe(true);
  });

  it('lightens the focus dim during Free Spins without touching the big-FX gates', () => {
    const base = winFxParams(6, GameMode.BASE);
    const free = winFxParams(6, GameMode.FREE_SPINS);

    // Free Spins desaturates less and stays brighter.
    expect(free.dimSaturate).toBeGreaterThan(base.dimSaturate);
    expect(free.dimBrightness).toBeGreaterThan(base.dimBrightness);

    // A 5×+ win still earns its shake in Free Spins (spec's "big FX" rule).
    expect(free.bigFx).toBe(true);
    expect(free.shakeAmp).toBe(base.shakeAmp);
  });
});
