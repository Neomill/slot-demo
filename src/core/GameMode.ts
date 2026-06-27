/**
 * The active game mode — distinct from the spin lifecycle (GameState). Exactly
 * one mode is active at a time; bonuses transition between them.
 */
export enum GameMode {
  BASE,
  FREE_SPINS,
  HOLD_AND_RESPIN,
}
