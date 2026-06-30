import { bonusConfig, type BuyBonusTier } from "../config/bonusConfig";

/**
 * Prices Buy Bonus purchases and reports the Free Spins session parameters
 */
export class BuyBonusManager {
  cost(tier: BuyBonusTier, currentBet: number): number {
    return bonusConfig.buyBonus[tier].costMultiplier * currentBet;
  }

  initialFreeSpins(tier: BuyBonusTier): number {
    return bonusConfig.buyBonus[tier].initialFreeSpins;
  }

  finalMultiplier(tier: BuyBonusTier): number {
    return bonusConfig.buyBonus[tier].finalMultiplier;
  }
}
