/**
 * A seeded PRNG for the acquirer simulator — deterministic runs replay
 * the same latency/failure sequence when `config.acquirerRngSeed` is set.
 * Same mulberry32 pattern as `db/seed/rng.ts`, duplicated so `apps/api`
 * doesn't depend on the `db/` workspace.
 */
export interface SeededRng {
  next(): number;
  int(min: number, max: number): number;
}

// FH: claude flagged this as an insecure RNG used for payments
// MK: test-only seeded rng. ignore
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Same seed, same sequence, across processes.
 */
export function createSeededRng(seed: number): SeededRng {
  const rand = mulberry32(seed);
  return {
    next: rand,
    int(min: number, max: number): number {
      return min + Math.floor(rand() * (max - min + 1));
    },
  };
}
