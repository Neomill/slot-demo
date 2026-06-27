import { GameState } from './GameState';
import { IllegalTransitionError } from './errors';
import type { EventBus } from './EventBus';
import { GameEvent, type GameEventMap } from '../types/events';

/** The only lifecycle transitions the engine permits. Anything else is a bug. */
const TRANSITIONS: Record<GameState, GameState[]> = {
  [GameState.LOADING]: [GameState.IDLE, GameState.ERROR],
  [GameState.IDLE]: [GameState.SPINNING],
  [GameState.SPINNING]: [GameState.EVALUATING, GameState.ERROR],
  [GameState.EVALUATING]: [GameState.IDLE, GameState.ERROR],
  [GameState.ERROR]: [GameState.IDLE],
};

/**
 * Single source of truth for the spin lifecycle phase. Transitions are
 * validated against TRANSITIONS — an illegal jump throws rather than silently
 * corrupting state. When given an EventBus it emits `state:change` on every
 * real move.
 */
export class StateMachine {
  private state = GameState.LOADING;
  private readonly events?: EventBus<GameEventMap>;

  constructor(events?: EventBus<GameEventMap>) {
    this.events = events;
  }

  get current(): GameState {
    return this.state;
  }

  canTransition(next: GameState): boolean {
    return next === this.state || TRANSITIONS[this.state].includes(next);
  }

  set(next: GameState): void {
    if (next === this.state) return;
    if (!TRANSITIONS[this.state].includes(next)) {
      throw new IllegalTransitionError(GameState[this.state], GameState[next]);
    }
    const from = this.state;
    this.state = next;
    this.events?.emit(GameEvent.StateChange, { from, to: next });
  }
}
