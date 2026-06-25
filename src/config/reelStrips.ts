import type { SymbolId } from './symbols';

/**
 * One strip per reel. A spin picks a random window of `rows` consecutive
 * symbols (wrapping) from each strip, so symbol frequency here controls the
 * odds — highs (seven) and wilds appear sparsely, lows (cherry/lemon) often.
 */
export const REEL_STRIPS: SymbolId[][] = [
  ['seven', 'cherry', 'lemon', 'bell', 'orange', 'wild', 'plum', 'cherry', 'bar', 'lemon', 'orange', 'bell', 'cherry', 'plum', 'lemon'],
  ['lemon', 'bar', 'cherry', 'orange', 'seven', 'plum', 'cherry', 'bell', 'lemon', 'wild', 'orange', 'cherry', 'bar', 'lemon', 'plum'],
  ['cherry', 'orange', 'bell', 'lemon', 'plum', 'cherry', 'seven', 'orange', 'lemon', 'bar', 'wild', 'cherry', 'plum', 'orange', 'bell'],
  ['orange', 'lemon', 'cherry', 'bar', 'lemon', 'bell', 'plum', 'cherry', 'orange', 'seven', 'lemon', 'wild', 'cherry', 'bar', 'plum'],
  ['lemon', 'cherry', 'plum', 'orange', 'bell', 'lemon', 'cherry', 'bar', 'orange', 'plum', 'cherry', 'lemon', 'seven', 'wild', 'orange'],
];
