import type { SymbolId } from '../config/symbols';
import { SCATTER, BONUS } from '../config/symbols';
import { bonusConfig } from '../config/bonusConfig';

/**
 * Detects bonus triggers from a base-game board. Stateless — it reads a grid
 * and reports counts and awards; the session managers own the running state.
 */
export class BonusManager {
  countSymbol(grid: SymbolId[][], symbol: SymbolId): number {
    let count = 0;
    for (const column of grid) {
      for (const cell of column) {
        if (cell === symbol) count++;
      }
    }
    return count;
  }

  countScatters(grid: SymbolId[][]): number {
    return this.countSymbol(grid, SCATTER);
  }

  countBonus(grid: SymbolId[][]): number {
    return this.countSymbol(grid, BONUS);
  }

  /** Free Spins awarded for a scatter count (0 if below the trigger threshold). */
  scatterAward(scatterCount: number): number {
    if (scatterCount < bonusConfig.freeSpins.minScattersToTrigger) return 0;
    const awards = bonusConfig.freeSpins.scatterAwards;
    const tiers = Object.keys(awards)
      .map(Number)
      .sort((a, b) => a - b);
    let award = 0;
    for (const tier of tiers) {
      if (scatterCount >= tier) award = awards[tier];
    }
    return award;
  }

  triggersHoldAndRespin(bonusCount: number): boolean {
    return bonusCount >= bonusConfig.holdAndRespin.trigger.bonusSymbols;
  }
}
