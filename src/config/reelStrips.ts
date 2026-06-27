import type { SymbolId } from './symbols';

/** One reel-strip set per game mode / modifier. */
export type ReelSetId = 'base' | 'freeSpins' | 'chance2x' | 'holdAndRespin';

/**
 * A spin lands each reel on a random strip offset and reads `rows` consecutive
 * symbols (wrapping). Symbol frequency here is the only place odds live.
 *
 * - base:          normals + sparse scatter + sparse bonus, NO wild
 * - freeSpins:     normals + wild, no scatter/bonus
 * - chance2x:      base with denser scatter (more Free Spins triggers)
 * - holdAndRespin: filler normals + frequent bonus (respins land more bonus)
 */
export const REEL_SETS: Record<ReelSetId, SymbolId[][]> = {
  base: [
    ['cherry', 'lemon', 'scatter', 'bell', 'orange', 'bar', 'seven', 'lemon', 'bonus', 'cherry', 'plum', 'orange'],
    ['lemon', 'orange', 'cherry', 'seven', 'scatter', 'plum', 'bell', 'cherry', 'bar', 'lemon', 'bonus', 'orange'],
    ['orange', 'bell', 'cherry', 'lemon', 'bar', 'scatter', 'plum', 'orange', 'seven', 'cherry', 'lemon', 'bonus'],
    ['plum', 'cherry', 'orange', 'bell', 'lemon', 'bar', 'scatter', 'cherry', 'orange', 'bonus', 'lemon', 'seven'],
    ['bell', 'lemon', 'cherry', 'orange', 'plum', 'seven', 'bar', 'scatter', 'lemon', 'cherry', 'bonus', 'orange'],
  ],
  freeSpins: [
    ['cherry', 'wild', 'lemon', 'bell', 'orange', 'bar', 'seven', 'wild', 'cherry', 'plum', 'orange', 'lemon'],
    ['lemon', 'orange', 'wild', 'seven', 'cherry', 'plum', 'bell', 'wild', 'bar', 'lemon', 'orange', 'cherry'],
    ['orange', 'bell', 'cherry', 'wild', 'bar', 'lemon', 'plum', 'orange', 'wild', 'cherry', 'seven', 'lemon'],
    ['plum', 'cherry', 'orange', 'bell', 'wild', 'bar', 'lemon', 'cherry', 'orange', 'wild', 'lemon', 'seven'],
    ['bell', 'lemon', 'wild', 'orange', 'plum', 'seven', 'bar', 'cherry', 'wild', 'lemon', 'cherry', 'orange'],
  ],
  chance2x: [
    ['cherry', 'scatter', 'lemon', 'bell', 'scatter', 'bar', 'seven', 'scatter', 'bonus', 'cherry', 'plum', 'orange'],
    ['scatter', 'orange', 'cherry', 'scatter', 'seven', 'plum', 'scatter', 'cherry', 'bar', 'lemon', 'bonus', 'orange'],
    ['orange', 'scatter', 'bell', 'lemon', 'scatter', 'bar', 'plum', 'scatter', 'seven', 'cherry', 'lemon', 'bonus'],
    ['scatter', 'cherry', 'orange', 'scatter', 'bell', 'lemon', 'scatter', 'cherry', 'orange', 'bonus', 'lemon', 'seven'],
    ['bell', 'scatter', 'lemon', 'scatter', 'orange', 'plum', 'scatter', 'bar', 'lemon', 'cherry', 'bonus', 'scatter'],
  ],
  holdAndRespin: [
    ['bonus', 'cherry', 'lemon', 'bell', 'bonus', 'orange', 'plum', 'bonus', 'lemon', 'cherry', 'bonus', 'seven'],
    ['lemon', 'bonus', 'orange', 'cherry', 'bonus', 'plum', 'bell', 'bonus', 'bar', 'lemon', 'bonus', 'orange'],
    ['bonus', 'orange', 'bell', 'bonus', 'lemon', 'bar', 'bonus', 'plum', 'orange', 'bonus', 'cherry', 'lemon'],
    ['plum', 'bonus', 'orange', 'bell', 'bonus', 'lemon', 'bar', 'bonus', 'cherry', 'orange', 'bonus', 'seven'],
    ['bell', 'lemon', 'bonus', 'orange', 'bonus', 'plum', 'seven', 'bonus', 'lemon', 'cherry', 'bonus', 'orange'],
  ],
};
