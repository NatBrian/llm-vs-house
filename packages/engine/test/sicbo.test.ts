import { describe, it, expect } from 'vitest';
import {
  allSicBoOutcomes, resolveSicBoBet, rollSicBo, createRng, isTriple,
  type SicBoBet,
} from '../src/index.js';

/** Exact house edge = -EV of a unit bet over all 216 equally-likely outcomes. */
function houseEdge(bet: SicBoBet): number {
  let sum = 0;
  for (const d of allSicBoOutcomes()) sum += resolveSicBoBet({ ...bet, amount: 1 }, d);
  return -sum / 216;
}

describe('sic bo house edge vs verified table (docs/PAYOUTS.md)', () => {
  const cases: Array<[string, SicBoBet, number]> = [
    ['small', { type: 'small', amount: 1 }, 0.0278],
    ['big', { type: 'big', amount: 1 }, 0.0278],
    ['total 4', { type: 'total', amount: 1, total: 4 }, 0.1528],
    ['total 7', { type: 'total', amount: 1, total: 7 }, 0.0972],
    ['total 9', { type: 'total', amount: 1, total: 9 }, 0.1898],
    ['total 10', { type: 'total', amount: 1, total: 10 }, 0.1250],
    ['single face', { type: 'single', amount: 1, face: 4 }, 0.0787],
    ['combo', { type: 'combo', amount: 1, faces: [2, 5] }, 0.1667],
    ['specific double', { type: 'double', amount: 1, face: 3 }, 0.1852],
    ['specific triple', { type: 'triple', amount: 1, face: 6 }, 0.1620],
    ['any triple', { type: 'anytriple', amount: 1 }, 0.1389],
  ];
  for (const [name, bet, edge] of cases) {
    it(`${name} => ${(edge * 100).toFixed(2)}%`, () => {
      expect(houseEdge(bet)).toBeCloseTo(edge, 3);
    });
  }
});

describe('sic bo mechanics', () => {
  it('small/big lose on a triple even if the sum is in range', () => {
    // [2,2,2] sum=6 in small range, but a triple => small loses
    expect(resolveSicBoBet({ type: 'small', amount: 10 }, [2, 2, 2])).toBe(-10);
    expect(isTriple([2, 2, 2])).toBe(true);
  });
  it('single number pays 1/2/3 by match count', () => {
    expect(resolveSicBoBet({ type: 'single', amount: 10, face: 5 }, [5, 1, 2])).toBe(10);
    expect(resolveSicBoBet({ type: 'single', amount: 10, face: 5 }, [5, 5, 2])).toBe(20);
    expect(resolveSicBoBet({ type: 'single', amount: 10, face: 5 }, [5, 5, 5])).toBe(30);
    expect(resolveSicBoBet({ type: 'single', amount: 10, face: 5 }, [1, 2, 3])).toBe(-10);
  });
  it('roll is deterministic for a seed and dice are 1..6', () => {
    const a = createRng('sicbo'); const b = createRng('sicbo');
    const seqA = Array.from({ length: 30 }, () => rollSicBo(a));
    const seqB = Array.from({ length: 30 }, () => rollSicBo(b));
    expect(seqA).toEqual(seqB);
    for (const d of seqA) for (const x of d) { expect(x).toBeGreaterThanOrEqual(1); expect(x).toBeLessThanOrEqual(6); }
  });
});
