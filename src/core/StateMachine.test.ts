import { describe, it, expect } from 'vitest';
import { StateMachine } from './StateMachine';
import { GameState } from './GameState';
import { IllegalTransitionError } from './errors';

describe('StateMachine', () => {
  it('allows transitions in the table and rejects the rest', () => {
    const sm = new StateMachine();
    sm.set(GameState.IDLE); // LOADING -> IDLE
    sm.set(GameState.SPINNING); // IDLE -> SPINNING
    expect(sm.current).toBe(GameState.SPINNING);
    // SPINNING -> IDLE is not a legal jump
    expect(() => sm.set(GameState.IDLE)).toThrow(IllegalTransitionError);
  });

  it('ignores no-op transitions to the current state', () => {
    const sm = new StateMachine();
    sm.set(GameState.IDLE);
    expect(() => sm.set(GameState.IDLE)).not.toThrow();
    expect(sm.current).toBe(GameState.IDLE);
  });
});
