/**
 * Single source of randomness for the engine. Everything that needs chance
 * draws from an RNG instance — never `Math.random()` directly — so a seeded
 * instance makes the whole engine deterministic and reproducible.
 */
export interface RNG {
  /** A float in [0, 1). */
  next(): number;
}

/** Non-deterministic RNG backed by Math.random (the one sanctioned use). */
export function createMathRng(): RNG {
  return { next: () => Math.random() };
}

/**
 * Deterministic, seeded RNG (mulberry32). Same seed -> same sequence, which is
 * what makes spins reproducible in tests and replays.
 */
export function createSeededRng(seed: number): RNG {
  let state = seed >>> 0;
  return {
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}
