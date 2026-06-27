/**
 * The spin lifecycle phase — independent of the game mode (see GameMode).
 * A spin in any mode walks IDLE -> SPINNING -> EVALUATING -> IDLE.
 */
export enum GameState {
  LOADING,
  IDLE,
  SPINNING,
  EVALUATING,
  ERROR,
}
