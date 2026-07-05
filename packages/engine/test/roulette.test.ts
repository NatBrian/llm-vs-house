import { describe, it, expect } from 'vitest';
import {
  rouletteWheel, resolveRouletteBet, spinRoulette, createRng,
  ROULETTE_ODDS, ROULETTE_MIN_BET, isValidRouletteBet, SERIES3_GROUPS, SERIES6_GROUPS,
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

describe('roulette house edge (American = 5.26%, GRA-specific exceptions)', () => {
  const cases: RouletteBet[] = [
    { type: 'straight', amount: 1, numbers: [17] },
    { type: 'red', amount: 1 },
    { type: 'dozen', amount: 1, selector: 3 },
    { type: 'corner', amount: 1, numbers: [1, 2, 4, 5] },
    { type: 'series3', amount: 1, seriesGroup: 1 },
    { type: 'series6', amount: 1, seriesGroup: 1 },
  ];
  for (const bet of cases) {
    it(`${bet.type} => 5.26%`, () => {
      expect(houseEdge(bet, 'american')).toBeCloseTo(AMERICAN, 6);
    });
  }
  it('Top Line ("five", 5:1 per GRA) => 21.05%', () => {
    expect(houseEdge({ type: 'five', amount: 1 }, 'american')).toBeCloseTo(8 / 38, 6);
  });
  it('zeroCombo (0/00 dedicated box, 11:1 per GRA) => 36.84%', () => {
    expect(houseEdge({ type: 'zeroCombo', amount: 1 }, 'american')).toBeCloseTo(14 / 38, 6);
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

describe('ROULETTE_MIN_BET', () => {
  it('has an entry for every bet type in ROULETTE_ODDS', () => {
    for (const type of Object.keys(ROULETTE_ODDS)) {
      expect(ROULETTE_MIN_BET[type as keyof typeof ROULETTE_MIN_BET]).toBeGreaterThan(0);
    }
  });
  it('outside even-money bets cost more than inside bets', () => {
    for (const t of ['red', 'black', 'odd', 'even', 'high', 'low'] as const) {
      expect(ROULETTE_MIN_BET[t]).toBe(50);
    }
    for (const t of ['straight', 'split', 'street', 'corner', 'sixline', 'column', 'dozen', 'five', 'zeroCombo', 'series3', 'series6'] as const) {
      expect(ROULETTE_MIN_BET[t]).toBe(10);
    }
  });
});

describe('SERIES3_GROUPS / SERIES6_GROUPS (RWS wheel-sector bets)', () => {
  it('partitions all 36 non-zero numbers into 12 groups of 3', () => {
    expect(SERIES3_GROUPS).toHaveLength(12);
    const all = SERIES3_GROUPS.flat().slice().sort((a, b) => a - b);
    expect(all).toEqual(Array.from({ length: 36 }, (_, i) => i + 1));
  });
  it('matches the printed GRA Appendix G groups (as sets)', () => {
    // Transcribed directly from the rendered Appendix G image (order reversed on the felt).
    const printed = [
      [26, 3, 35], [12, 28, 7], [29, 18, 22], [9, 31, 14],
      [20, 1, 33], [16, 24, 5], [10, 23, 8], [30, 11, 36],
      [13, 27, 6], [34, 17, 25], [2, 21, 4], [19, 15, 32],
    ].reverse();
    const asSets = (g: number[][]) => g.map((x) => [...x].sort((a, b) => a - b).join(','));
    expect(asSets(SERIES3_GROUPS)).toEqual(asSets(printed));
  });
  it('SERIES6_GROUPS pairs adjacent SERIES3_GROUPS', () => {
    expect(SERIES6_GROUPS).toHaveLength(6);
    expect(SERIES6_GROUPS[0]).toEqual([...SERIES3_GROUPS[0]!, ...SERIES3_GROUPS[1]!]);
  });
});

describe('isValidRouletteBet — real felt cells only', () => {
  it('accepts real cells', () => {
    const valid: RouletteBet[] = [
      { type: 'straight', amount: 1, numbers: [17] },
      { type: 'split', amount: 1, numbers: [1, 2] },   // horizontal
      { type: 'split', amount: 1, numbers: [1, 4] },   // vertical
      { type: 'split', amount: 1, numbers: [0, 1] },   // zero-adjacent
      { type: 'street', amount: 1, numbers: [1, 2, 3] },
      { type: 'street', amount: 1, numbers: [0, 1, 2] }, // zero-adjacent trio, valid on both variants
      { type: 'corner', amount: 1, numbers: [1, 2, 4, 5] },
      { type: 'sixline', amount: 1, numbers: [1, 2, 3, 4, 5, 6] },
      { type: 'column', amount: 1, selector: 1 },
      { type: 'dozen', amount: 1, selector: 2 },
      { type: 'red', amount: 1 },
    ];
    for (const bet of valid) expect(isValidRouletteBet(bet, 'european')).toBe(true);
    expect(isValidRouletteBet({ type: 'series3', amount: 1, seriesGroup: 1 }, 'american')).toBe(true);
    expect(isValidRouletteBet({ type: 'series6', amount: 1, seriesGroup: 6 }, 'american')).toBe(true);
  });

  it('rejects invented combinations', () => {
    const invalid: RouletteBet[] = [
      { type: 'split', amount: 1, numbers: [1, 36] },        // not adjacent
      { type: 'street', amount: 1, numbers: [1, 2, 4] },     // not one row
      { type: 'street', amount: 1, numbers: [0, 2, 3] },     // requires '00' — not a real European (or American) street
      { type: 'corner', amount: 1, numbers: [1, 36, 17, 5] }, // not a real square
      { type: 'sixline', amount: 1, numbers: [1, 2, 3, 4, 5, 7] }, // not two adjacent streets
    ];
    for (const bet of invalid) expect(isValidRouletteBet(bet, 'european')).toBe(false);
    expect(isValidRouletteBet({ type: 'street', amount: 1, numbers: [0, 2, 3] }, 'american')).toBe(false);
    expect(isValidRouletteBet({ type: 'series3', amount: 1, seriesGroup: 13 }, 'american')).toBe(false); // only 12 groups exist
  });

  it('series3/series6 (RWS wheel-sector bets) are American-only', () => {
    expect(isValidRouletteBet({ type: 'series3', amount: 1, seriesGroup: 1 }, 'european')).toBe(false);
    expect(isValidRouletteBet({ type: 'series6', amount: 1, seriesGroup: 1 }, 'european')).toBe(false);
  });

  it('five-number Top Line is American-only', () => {
    expect(isValidRouletteBet({ type: 'five', amount: 1 }, 'american')).toBe(true);
    expect(isValidRouletteBet({ type: 'five', amount: 1 }, 'european')).toBe(false);
  });

  it('zeroCombo is American-only', () => {
    expect(isValidRouletteBet({ type: 'zeroCombo', amount: 1 }, 'american')).toBe(true);
    expect(isValidRouletteBet({ type: 'zeroCombo', amount: 1 }, 'european')).toBe(false);
  });

  it('00-adjacent splits/streets require the American wheel', () => {
    expect(isValidRouletteBet({ type: 'split', amount: 1, numbers: ['00', 2] }, 'american')).toBe(true);
    expect(isValidRouletteBet({ type: 'split', amount: 1, numbers: ['00', 2] }, 'european')).toBe(false);
    expect(isValidRouletteBet({ type: 'street', amount: 1, numbers: ['00', 2, 3] }, 'american')).toBe(true);
    expect(isValidRouletteBet({ type: 'street', amount: 1, numbers: ['00', 2, 3] }, 'european')).toBe(false);
  });
});
