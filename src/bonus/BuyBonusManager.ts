import { bonusConfig, type BuyBonusTier } from '../config/bonusConfig';

/**
 * Prices Buy Bonus purchases and reports the Free Spins session parameters for
 * each tier. Stateless — the engine performs the debit and starts the session.
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
