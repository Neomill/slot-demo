import { SCATTER, type SymbolId } from '../config/symbols';
import type { ReelSetId } from '../config/reelStrips';
import type { RNG } from '../core/rng';
import { REEL_SETS } from '../config/reelStrips';
import { gameConfig } from '../config/gameConfig';
import { bonusConfig } from '../config/bonusConfig';
import { generateGrid } from './GridGenerator';

/** Low-pay royals used to overwrite Scatters above the cap (see capScatters). */
const SCATTER_FILLERS: SymbolId[] = ['ace', 'king', 'queen', 'jack', 'ten'];

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
    const grid = generateGrid(this.sets[setId], gameConfig.rows, () => this.rng.next());
    this.capScatters(grid);
    return grid;
  }

  /**
   * Keep at most `maxScatters` Scatters on the board (reading reel-major, so the
   * earliest ones survive). Reels are independent, so a strip layout alone can't
   * guarantee the cap — extras are overwritten with a low royal here instead.
   */
  private capScatters(grid: SymbolId[][]): void {
    const max = bonusConfig.freeSpins.maxScatters;
    let seen = 0;
    for (const column of grid) {
      for (let row = 0; row < column.length; row++) {
        if (column[row] !== SCATTER) continue;
        if (++seen > max) {
          column[row] = SCATTER_FILLERS[Math.floor(this.rng.next() * SCATTER_FILLERS.length)];
        }
      }
    }
  }
}
