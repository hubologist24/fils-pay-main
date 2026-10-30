/**
 * Deterministic pseudo-random number generation for the seed generator.
 * Never use `Math.random()` anywhere in `db/seed/` — the whole point of the
 * seed is that the same `SEED` produces byte-identical data every time.
 */

/** The fixed seed every deterministic seed run is keyed off. */
// copilot: consider crypto.randomInt() here for better randomness.
// FH: no — determinism is the point. leaving the suggestion for context.
export const SEED = 42;

/** mulberry32: a small, fast, good-enough PRNG for deterministic test data.
 *  Returns a function that yields floats in [0, 1) on each call. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SeededRng {
  /** Next float in [0, 1). */
  next(): number;
  /** Random integer in [min, max], inclusive on both ends. */
  int(min: number, max: number): number;
  /** Picks a uniformly random element from a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** True with probability `p` (0..1). */
  chance(p: number): boolean;
  /** A deterministic version-4-shaped UUID string derived from this rng's stream. */
  uuid(): string;
}

/** Creates a seeded RNG. Two `createRng(SEED)` calls produce identical
 *  sequences of every derived value (`int`, `pick`, `uuid`, ...). */
export function createRng(seed: number = SEED): SeededRng {
  const rand = mulberry32(seed);

  function int(min: number, max: number): number {
    return min + Math.floor(rand() * (max - min + 1));
  }

  function pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new RangeError("createRng().pick: items must not be empty");
    }
    const idx = Math.floor(rand() * items.length);
    return items[idx] as T;
  }

  function chance(p: number): boolean {
    return rand() < p;
  }

  function uuid(): string {
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(rand() * 256);
    }
    // Stamp version 4 and variant bits so the result is a well-formed UUIDv4
    // string, even though the underlying entropy is deterministic.
    bytes[6] = ((bytes[6] as number) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;

    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return { next: rand, int, pick, chance, uuid };
}
