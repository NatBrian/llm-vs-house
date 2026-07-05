import { describe, it, expect } from 'vitest';
import {
  rouletteWheel, resolveRouletteBet, spinRoulette, createRng,
  type RouletteBet, type RouletteVariant,
} from '../src/index.js';

/** Exact house edge = -EV of a unit bet, enumerated over all equally-likely pockets. */
function houseEdge(bet: RouletteBet, variant: RouletteVariant): number {
  const wheel = rouletteWheel(variant);
  let sum = 0;
  for (const pocket of wheel) sum += resolveRouletteBet({ ...bet, amount: 1 }, pocket);
  return -sum / wheel.length;
}

const EUROPEAN = 1 / 37; // 0.027027...
const AMERICAN = 2 / 38; // 0.052631...

describe('roulette house edge (European = 2.70%)', () => {
  const cases: RouletteBet[] = [
    { type: 'straight', amount: 1, numbers: [17] },
    { type: 'split', amount: 1, numbers: [1, 2] },
    { type: 'street', amount: 1, numbers: [1, 2, 3] },
    { type: 'corner', amount: 1, numbers: [1, 2, 4, 5] },
    { type: 'sixline', amount: 1, numbers: [1, 2, 3, 4, 5, 6] },
    { type: 'column', amount: 1, selector: 1 },
    { type: 'dozen', amount: 1, selector: 2 },
    { type: 'red', amount: 1 },
    { type: 'black', amount: 1 },
    { type: 'odd', amount: 1 },
    { type: 'even', amount: 1 },
    { type: 'low', amount: 1 },
    { type: 'high', amount: 1 },
  ];
  for (const bet of cases) {
    it(`${bet.type} => 2.70%`, () => {
      expect(houseEdge(bet, 'european')).toBeCloseTo(EUROPEAN, 6);
    });
  }
});

describe('roulette house edge (American = 5.26%, five-number = 7.89%)', () => {
  const cases: RouletteBet[] = [
    { type: 'straight', amount: 1, numbers: [17] },
    { type: 'red', amount: 1 },
    { type: 'dozen', amount: 1, selector: 3 },
    { type: 'corner', amount: 1, numbers: [1, 2, 4, 5] },
  ];
  for (const bet of cases) {
    it(`${bet.type} => 5.26%`, () => {
      expect(houseEdge(bet, 'american')).toBeCloseTo(AMERICAN, 6);
    });
  }
  it('five-number bet => 7.89% (the one exception)', () => {
    expect(houseEdge({ type: 'five', amount: 1 }, 'american')).toBeCloseTo(3 / 38, 6);
  });
});

describe('roulette spin', () => {
  it('is deterministic for a seed', () => {
    const a = createRng('spin'); const b = createRng('spin');
    const seqA = Array.from({ length: 50 }, () => spinRoulette(a, 'european'));
    const seqB = Array.from({ length: 50 }, () => spinRoulette(b, 'european'));
    expect(seqA).toEqual(seqB);
  });
  it('american wheel can land on 00', () => {
    const r = createRng('zero');
    const seen = new Set<unknown>();
    for (let i = 0; i < 2000; i++) seen.add(spinRoulette(r, 'american'));
    expect(seen.has('00')).toBe(true);
  });
});
