import type { SymbolId } from '../config/symbols';
import type { ReelSetId } from '../config/reelStrips';
import type { RNG } from '../core/rng';
import { REEL_SETS } from '../config/reelStrips';
import { gameConfig } from '../config/gameConfig';
import { generateGrid } from './GridGenerator';

/**
 * Produces a reel grid from the strip set for the current mode. All randomness
 * comes from the injected RNG, so a seeded RNG yields reproducible spins.
 */
export class ReelGenerator {
  private readonly rng: RNG;
  private readonly sets: Record<ReelSetId, SymbolId[][]>;

  constructor(rng: RNG, sets: Record<ReelSetId, SymbolId[][]> = REEL_SETS) {
    this.rng = rng;
    this.sets = sets;
  }

  generate(setId: ReelSetId): SymbolId[][] {
    return generateGrid(this.sets[setId], gameConfig.rows, () => this.rng.next());
  }
}
