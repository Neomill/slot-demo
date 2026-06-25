/**
 * Each payline lists the row index (0 = top, 1 = middle, 2 = bottom) for each
 * of the 5 reels, read left to right. Evaluation handles any number of lines;
 * add more rows here to extend coverage.
 */
export const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1], // 1 — middle row
  [0, 0, 0, 0, 0], // 2 — top row
  [2, 2, 2, 2, 2], // 3 — bottom row
  [0, 1, 2, 1, 0], // 4 — V
  [2, 1, 0, 1, 2], // 5 — ^
];
