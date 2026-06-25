import type { SpinProvider } from './SpinProvider';
import type { SpinRequest, SpinResult } from '../types/slot';
import type { RandomSource } from './GridGenerator';
import { generateGrid } from './GridGenerator';
import { PaylineEvaluator } from './PaylineEvaluator';
import { REEL_STRIPS } from '../config/reelStrips';
import { PAYLINES } from '../config/paylines';
import { PAYTABLE } from '../config/paytable';
import { WILD } from '../config/symbols';
import { gameConfig } from '../config/gameConfig';

export interface MockSpinProviderOptions {
  rng?: RandomSource;
  latencyMs?: number;
  /** Probability [0..1] of throwing, to exercise the engine's error path. */
  failureRate?: number;
}

/**
 * Fully client-side stand-in for a spin backend. It owns the RNG and the
 * evaluation, so it returns an authoritative result the engine then validates —
 * exactly the contract a real server would honour. There is no network here.
 */
export class MockSpinProvider implements SpinProvider {
  private readonly rng: RandomSource;
  private readonly latencyMs: number;
  private readonly failureRate: number;
  private readonly evaluator: PaylineEvaluator;

  constructor(options: MockSpinProviderOptions = {}) {
    this.rng = options.rng ?? Math.random;
    this.latencyMs = options.latencyMs ?? gameConfig.spinLatencyMs;
    this.failureRate = options.failureRate ?? 0;
    this.evaluator = new PaylineEvaluator({ paylines: PAYLINES, paytable: PAYTABLE, wild: WILD });
  }

  async spin(request: SpinRequest): Promise<SpinResult> {
    await delay(this.latencyMs);

    if (this.failureRate > 0 && this.rng() < this.failureRate) {
      throw new Error('Simulated provider failure');
    }

    const grid = generateGrid(REEL_STRIPS, gameConfig.rows, this.rng);
    const { lineWins, totalWin } = this.evaluator.evaluate(grid, request.betPerLine);
    return { grid, lineWins, totalWin };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
