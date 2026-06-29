/** Static, data-only game configuration. No logic lives here. */
export const gameConfig = {
  reels: 5,
  rows: 3,
  startingBalance: 5_000,
  /** Selectable per-line bets. Total stake = betPerLine x number of paylines. */
  betLevels: [1, 2, 5, 10],
  defaultBetPerLine: 1,
  /** Simulated provider latency, in ms. */
  spinLatencyMs: 600,
  currency: "CR",
} as const;
