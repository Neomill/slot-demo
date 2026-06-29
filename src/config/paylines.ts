/**
 * Each payline lists the row index (0 = top, 1 = middle, 2 = bottom) for each
 * of the 5 reels, read left to right. Evaluation handles any number of lines;
 * add more rows here to extend coverage.
 */
export const PAYLINES = [
  // Horizontal
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],

  // V
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],

  // Zigzag
  [1, 0, 1, 0, 1],
  [1, 2, 1, 2, 1],

  // Stairs
  [0, 1, 2, 2, 2],
  [2, 1, 0, 0, 0],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],

  // Lightning
  [0, 1, 0, 1, 2],
  [2, 1, 2, 1, 0],

  // Mountain / Valley
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
];
