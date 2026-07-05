// Deterministic, seedable PRNG. Same seed => identical stream on every platform.
// String seed -> 4x32-bit state via cyrb128, streamed with sfc32 (fast, good statistical quality).
// This is the sole entropy source for every game engine, so replay(seed, decisions) is exact.

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Integer in [min, max] inclusive. */
  intInclusive(min: number, max: number): number;
  /** Uniformly pick one element. */
  pick<T>(arr: readonly T[]): T;
}

function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  return [h1 >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return function () {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function createRng(seed: string): Rng {
  const [a, b, c, d] = cyrb128(seed);
  const gen = sfc32(a, b, c, d);
  // Warm up so nearby seeds diverge immediately.
  for (let i = 0; i < 15; i++) gen();
  const rng: Rng = {
    next: gen,
    int: (m) => Math.floor(gen() * m),
    intInclusive: (min, max) => min + Math.floor(gen() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(gen() * arr.length)] as (typeof arr)[number],
  };
  return rng;
}
