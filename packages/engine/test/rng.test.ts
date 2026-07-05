import { describe, it, expect } from 'vitest';
import { createRng } from '../src/rng.js';

describe('createRng determinism', () => {
  it('same seed => identical stream', () => {
    const a = createRng('seed-123');
    const b = createRng('seed-123');
    const av = Array.from({ length: 100 }, () => a.next());
    const bv = Array.from({ length: 100 }, () => b.next());
    expect(av).toEqual(bv);
  });

  it('different seeds => different streams', () => {
    const a = createRng('seed-a');
    const b = createRng('seed-b');
    const av = Array.from({ length: 20 }, () => a.next());
    const bv = Array.from({ length: 20 }, () => b.next());
    expect(av).not.toEqual(bv);
  });

  it('outputs stay in [0,1)', () => {
    const r = createRng('range');
    for (let i = 0; i < 10000; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('intInclusive covers full range uniformly-ish', () => {
    const r = createRng('dice');
    const counts = new Array(7).fill(0);
    for (let i = 0; i < 60000; i++) counts[r.intInclusive(1, 6)]++;
    for (let f = 1; f <= 6; f++) {
      expect(counts[f]).toBeGreaterThan(9000); // ~10000 each, loose bound
    }
    expect(counts[0]).toBe(0);
  });
});
