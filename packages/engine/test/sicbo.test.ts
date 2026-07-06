import { describe, it, expect } from 'vitest';
import {
  allSicBoOutcomes, resolveSicBoBet, rollSicBo, createRng, isTriple,
  isValidSicBoBet, isValidDoubleAnyPair, SICBO_DOUBLE_ANY_PAIRS,
  type SicBoBet,
} from '../src/index.js';

/** Exact house edge = -EV of a unit bet over all 216 equally-likely outcomes. */
function houseEdge(bet: SicBoBet): number {
  let sum = 0;
  for (const d of allSicBoOutcomes()) sum += resolveSicBoBet({ ...bet, amount: 1 }, d);
  return -sum / 216;
}

describe('sic bo house edge vs GRA-verified table (docs/PAYOUTS.md, GRA MBS v7)', () => {
  const cases: Array<[string, SicBoBet, number]> = [
    ['small', { type: 'small', amount: 1 }, 0.0278],
    ['big', { type: 'big', amount: 1 }, 0.0278],
    ['odd', { type: 'odd', amount: 1 }, 0.0278],
    ['even', { type: 'even', amount: 1 }, 0.0278],
    ['total 4 (62:1)', { type: 'total', amount: 1, total: 4 }, 0.1250],
    ['total 5 (31:1)', { type: 'total', amount: 1, total: 5 }, 0.1111],
    ['total 6 (18:1)', { type: 'total', amount: 1, total: 6 }, 0.1204],
    ['total 7 (12:1)', { type: 'total', amount: 1, total: 7 }, 0.0972],
    ['total 8 (8:1)', { type: 'total', amount: 1, total: 8 }, 0.1250],
    ['total 9 (7:1)', { type: 'total', amount: 1, total: 9 }, 0.0741],
    ['total 10 (6:1)', { type: 'total', amount: 1, total: 10 }, 0.1250],
    ['total 16 (31:1, mirror of 5)', { type: 'total', amount: 1, total: 16 }, 0.1111],
    ['total 17 (62:1, mirror of 4)', { type: 'total', amount: 1, total: 17 }, 0.1250],
    ['single face (1/2/12)', { type: 'single', amount: 1, face: 4 }, 0.0370],
    ['combo (6:1)', { type: 'combo', amount: 1, faces: [2, 5] }, 0.0278],
    ['specific double (11:1)', { type: 'double', amount: 1, face: 3 }, 0.1111],
    ['specific triple (180:1)', { type: 'triple', amount: 1, face: 6 }, 0.1620],
    ['any triple (31:1)', { type: 'anytriple', amount: 1 }, 0.1111],
    ['doubleAny (50:1)', { type: 'doubleAny', amount: 1, face: 2, partner: 3 }, 0.2917],
    ['threeSingleCombo (30:1)', { type: 'threeSingleCombo', amount: 1, triple: [1, 2, 6] }, 0.1389],
    ['threeFromFour (7:1)', { type: 'threeFromFour', amount: 1, group: 1 }, 0.1111],
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
  it('odd/even lose on a triple even when the parity matches', () => {
    // [1,1,1] sum=3 is odd, but a triple => odd loses
    expect(resolveSicBoBet({ type: 'odd', amount: 10 }, [1, 1, 1])).toBe(-10);
    // [2,2,2] sum=6 is even, but a triple => even loses
    expect(resolveSicBoBet({ type: 'even', amount: 10 }, [2, 2, 2])).toBe(-10);
  });
  it('odd/even pay 1:1 on the matching parity of a non-triple', () => {
    expect(resolveSicBoBet({ type: 'odd', amount: 10 }, [1, 2, 4])).toBe(10);  // sum 7 odd
    expect(resolveSicBoBet({ type: 'even', amount: 10 }, [1, 2, 4])).toBe(-10); // sum 7 odd -> even loses
    expect(resolveSicBoBet({ type: 'even', amount: 10 }, [2, 2, 4])).toBe(10);  // sum 8 even
  });
  it('single number pays 1:1 / 2:1 / 12:1 by match count (GRA rule 4.1.6, not 3:1)', () => {
    expect(resolveSicBoBet({ type: 'single', amount: 10, face: 5 }, [5, 1, 2])).toBe(10);
    expect(resolveSicBoBet({ type: 'single', amount: 10, face: 5 }, [5, 5, 2])).toBe(20);
    expect(resolveSicBoBet({ type: 'single', amount: 10, face: 5 }, [5, 5, 5])).toBe(120);
    expect(resolveSicBoBet({ type: 'single', amount: 10, face: 5 }, [1, 2, 3])).toBe(-10);
  });
  it('doubleAny requires an exact double+partner match, not "any partner"', () => {
    expect(resolveSicBoBet({ type: 'doubleAny', amount: 10, face: 2, partner: 3 }, [2, 2, 3])).toBe(500);
    expect(resolveSicBoBet({ type: 'doubleAny', amount: 10, face: 2, partner: 3 }, [2, 2, 4])).toBe(-10); // right double, wrong partner
    expect(resolveSicBoBet({ type: 'doubleAny', amount: 10, face: 2, partner: 3 }, [1, 2, 3])).toBe(-10); // no double at all
  });
  it('doubleAny omits the two pairs missing from the real felt: (1,2) and (6,5)', () => {
    expect(isValidDoubleAnyPair(1, 2)).toBe(false);
    expect(isValidDoubleAnyPair(6, 5)).toBe(false);
    expect(isValidDoubleAnyPair(1, 3)).toBe(true);
    expect(SICBO_DOUBLE_ANY_PAIRS).toHaveLength(28); // 30 possible pairs minus the 2 missing ones
  });
  it('threeSingleCombo requires all three dice distinct and matching exactly', () => {
    expect(resolveSicBoBet({ type: 'threeSingleCombo', amount: 10, triple: [1, 2, 6] }, [6, 1, 2])).toBe(300);
    expect(resolveSicBoBet({ type: 'threeSingleCombo', amount: 10, triple: [1, 2, 6] }, [1, 2, 2] as any)).toBe(-10);
  });
  it('threeFromFour wins on any 3-distinct-value subset of the 4-number group', () => {
    expect(resolveSicBoBet({ type: 'threeFromFour', amount: 10, group: 1 }, [1, 2, 3])).toBe(70); // subset of {1,2,3,4}
    expect(resolveSicBoBet({ type: 'threeFromFour', amount: 10, group: 1 }, [1, 2, 5])).toBe(-10); // 5 not in {1,2,3,4}
    expect(resolveSicBoBet({ type: 'threeFromFour', amount: 10, group: 1 }, [1, 1, 2])).toBe(-10); // not 3 distinct faces
  });
  it('roll is deterministic for a seed and dice are 1..6', () => {
    const a = createRng('sicbo'); const b = createRng('sicbo');
    const seqA = Array.from({ length: 30 }, () => rollSicBo(a));
    const seqB = Array.from({ length: 30 }, () => rollSicBo(b));
    expect(seqA).toEqual(seqB);
    for (const d of seqA) for (const x of d) { expect(x).toBeGreaterThanOrEqual(1); expect(x).toBeLessThanOrEqual(6); }
  });
});

describe('isValidSicBoBet, real felt cells only', () => {
  it('accepts real cells', () => {
    const valid: SicBoBet[] = [
      { type: 'small', amount: 1 },
      { type: 'total', amount: 1, total: 9 },
      { type: 'single', amount: 1, face: 3 },
      { type: 'combo', amount: 1, faces: [1, 2] },
      { type: 'doubleAny', amount: 1, face: 2, partner: 3 },
      { type: 'threeSingleCombo', amount: 1, triple: [1, 2, 6] },
      { type: 'threeFromFour', amount: 1, group: 4 },
    ];
    for (const bet of valid) expect(isValidSicBoBet(bet)).toBe(true);
  });
  it('rejects invented/ill-formed bets', () => {
    const invalid: SicBoBet[] = [
      { type: 'total', amount: 1, total: 3 },                // out of range
      { type: 'combo', amount: 1, faces: [2, 2] },            // not distinct
      { type: 'doubleAny', amount: 1, face: 1, partner: 2 },  // not on the real felt
      { type: 'threeSingleCombo', amount: 1, triple: [1, 1, 2] as any }, // not 3 distinct faces
      { type: 'threeFromFour', amount: 1, group: 5 },         // only 4 groups exist
    ];
    for (const bet of invalid) expect(isValidSicBoBet(bet)).toBe(false);
  });
});
