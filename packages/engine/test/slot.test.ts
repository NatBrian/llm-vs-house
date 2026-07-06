import { describe, it, expect } from 'vitest';
import {
  EXAMPLE_SLOT, slotRtp, slotRtpBreakdown, spinSlot, playSlot, evaluateSlotGrid, resolveSlot, createRng,
  type SlotConfig, type Rng,
} from '../src/index.js';

// A "fake" Rng that always picks the first stop on every reel, used to hand-craft
// deterministic grids for the ways/wild/scatter/free-spin correctness tests below
// without depending on the real PRNG landing on a particular symbol by chance.
const zeroRng: Rng = { next: () => 0, int: () => 0, intInclusive: (min) => min, pick: (arr) => arr[0]! };

describe('exact analytic RTP (docs/PAYOUTS.md §4 worked example)', () => {
  const b = slotRtpBreakdown(EXAMPLE_SLOT);

  it('base-game (ways + scatter) RTP', () => {
    expect(b.waysRtp).toBeCloseTo(0.8708799018, 9);
    expect(b.scatterRtp).toBeCloseTo(0.0154294074, 9);
    expect(b.baseRtp).toBeCloseTo(0.8863093091, 9);
  });

  it('trigger probabilities and expected free spins per spin', () => {
    expect(b.triggerProbability[3]).toBeCloseTo(0.0067672133, 9);
    expect(b.triggerProbability[4]).toBeCloseTo(0.0003500283, 9);
    expect(b.triggerProbability[5]).toBeCloseTo(0.0000072420, 9);
    expect(b.expectedFreeSpinsPerSpin).toBeCloseTo(0.0595329702, 9);
  });

  it('closed-form total RTP ~= 93.91%, house edge ~= 6.09%', () => {
    expect(b.totalRtp).toBeCloseTo(0.9390739348, 9);
    expect(slotRtp(EXAMPLE_SLOT)).toBe(b.totalRtp);
    expect(1 - b.totalRtp).toBeCloseTo(0.0609260652, 9);
  });

  it('hit frequency ~= 20.2%, comfortably above the SG GRA 90% RTP floor', () => {
    expect(b.hitFrequency).toBeCloseTo(0.2020042241, 9);
    expect(b.totalRtp).toBeGreaterThanOrEqual(0.90);
    expect(b.totalRtp).toBeLessThan(0.97);
  });
}, 20000);

describe('ways-evaluation correctness (hand-built grids, no RNG)', () => {
  it('pure 5-of-a-kind pays the full 5x multiplier at all 243 ways', () => {
    const grid = Array.from({ length: 5 }, () => ['DRAGON', 'DRAGON', 'DRAGON']);
    const r = evaluateSlotGrid(EXAMPLE_SLOT, grid);
    expect(r.wins).toEqual([{ symbol: 'DRAGON', count: 5, ways: 243, payout: 750 }]);
    expect(r.waysWin).toBe(750);
  });

  it('wild substitutes for a paying symbol and combines into the same run', () => {
    // Each reel shows one DRAGON + one WILD (2 matches/reel) -> 5-of-kind run, ways = 2^5 = 32.
    const grid = Array.from({ length: 5 }, () => ['DRAGON', 'WILD', 'TEN']);
    const r = evaluateSlotGrid(EXAMPLE_SLOT, grid);
    const dragonWin = r.wins.find((w) => w.symbol === 'DRAGON');
    expect(dragonWin).toEqual({ symbol: 'DRAGON', count: 5, ways: 32, payout: (750 * 32) / 243 });
  });

  it('an all-wild grid pays every paying symbol simultaneously', () => {
    const grid = Array.from({ length: 5 }, () => ['WILD', 'WILD', 'WILD']);
    const r = evaluateSlotGrid(EXAMPLE_SLOT, grid);
    expect(r.wins).toHaveLength(7);
    // 750+370+210+148+116+84+74, each at the full 243 ways.
    expect(r.waysWin).toBeCloseTo(1752, 8);
  });

  it('a run broken at reel 3 (index 2) pays nothing for that symbol', () => {
    const grid = [
      ['DRAGON', 'TEN', 'TEN'],
      ['DRAGON', 'TEN', 'TEN'],
      ['TEN', 'TEN', 'TEN'], // no DRAGON/WILD here -> breaks the run
      ['DRAGON', 'TEN', 'TEN'],
      ['DRAGON', 'TEN', 'TEN'],
    ];
    const r = evaluateSlotGrid(EXAMPLE_SLOT, grid);
    expect(r.wins.find((w) => w.symbol === 'DRAGON')).toBeUndefined();
  });
});

describe('scatter correctness', () => {
  it('scatters anywhere in the grid count regardless of ways-run position', () => {
    const grid = [
      ['SCATTER', 'TEN', 'TEN'],
      ['TEN', 'TEN', 'TEN'],
      ['TEN', 'SCATTER', 'TEN'],
      ['TEN', 'TEN', 'TEN'],
      ['TEN', 'TEN', 'SCATTER'],
    ];
    const r = evaluateSlotGrid(EXAMPLE_SLOT, grid);
    expect(r.scatterCount).toBe(3);
    expect(r.scatterPayout).toBe(2);
    expect(r.freeSpinsAwarded).toBe(8);
  });

  it('4 and 5 scatters pay/award per the table', () => {
    const base = ['TEN', 'TEN', 'TEN'];
    const withScatter = ['SCATTER', 'TEN', 'TEN'];
    const grid4 = [withScatter, withScatter, withScatter, withScatter, base];
    const r4 = evaluateSlotGrid(EXAMPLE_SLOT, grid4);
    expect(r4.scatterCount).toBe(4);
    expect(r4.scatterPayout).toBe(5);
    expect(r4.freeSpinsAwarded).toBe(15);

    const grid5 = [withScatter, withScatter, withScatter, withScatter, withScatter];
    const r5 = evaluateSlotGrid(EXAMPLE_SLOT, grid5);
    expect(r5.scatterCount).toBe(5);
    expect(r5.scatterPayout).toBe(20);
    expect(r5.freeSpinsAwarded).toBe(20);
  });
});

describe('free-spin bonus round (playSlot) and the v1 no-retrigger rule', () => {
  const withScatter = ['SCATTER', 'TEN', 'TEN'];
  const noScatter = ['TEN', 'TEN', 'TEN'];

  function triggerConfig(scatterReels: number): SlotConfig {
    const reels = Array.from({ length: 5 }, (_, i) => (i < scatterReels ? withScatter : noScatter));
    return { ...EXAMPLE_SLOT, reels };
  }

  it('3/4/5 triggering reels award 8/15/20 free spins', () => {
    expect(playSlot(zeroRng, triggerConfig(3)).bonusSpins).toHaveLength(8);
    expect(playSlot(zeroRng, triggerConfig(4)).bonusSpins).toHaveLength(15);
    expect(playSlot(zeroRng, triggerConfig(5)).bonusSpins).toHaveLength(20);
  });

  it('a bonus spin that would itself re-trigger does not extend the bonus round (v1: no retriggers)', () => {
    // zeroRng always lands the same 3-scatter grid, so EVERY bonus spin independently
    // qualifies as a fresh trigger; the engine must still stop at the main spin's award.
    const round = playSlot(zeroRng, triggerConfig(3));
    expect(round.bonusSpins).toHaveLength(8);
    expect(round.bonusSpins.every((s) => s.freeSpinsAwarded === 8)).toBe(true); // each WOULD trigger again...
    expect(round.bonusSpins).toHaveLength(8); // ...but the round never grows past the original award.
  });

  it('totalPayout sums the main spin and every bonus spin', () => {
    const round = playSlot(zeroRng, triggerConfig(3));
    const expected = round.mainSpin.waysWin + round.mainSpin.scatterPayout
      + round.bonusSpins.reduce((s, b) => s + b.waysWin + b.scatterPayout, 0);
    expect(round.totalPayout).toBe(expected);
  });
});

describe('spin/round mechanics', () => {
  it('spinSlot and playSlot are deterministic for a seed', () => {
    const a = createRng('slot'); const b = createRng('slot');
    const seqA = Array.from({ length: 40 }, () => playSlot(a, EXAMPLE_SLOT));
    const seqB = Array.from({ length: 40 }, () => playSlot(b, EXAMPLE_SLOT));
    expect(seqA).toEqual(seqB);
  });

  it('net = totalPayout*bet - bet on a win, -bet on a loss', () => {
    expect(resolveSlot({ mainSpin: {} as any, bonusSpins: [], totalPayout: 5 }, 10)).toBe(5 * 10 - 10);
    expect(resolveSlot({ mainSpin: {} as any, bonusSpins: [], totalPayout: 0 }, 10)).toBe(-10);
  });

  it('empirical RTP over many rounds (including bonus spins) approaches analytic RTP', () => {
    const r = createRng('rtp-sim');
    const N = 500_000;
    let ret = 0;
    for (let i = 0; i < N; i++) ret += playSlot(r, EXAMPLE_SLOT).totalPayout;
    const empirical = ret / N;
    expect(Math.abs(empirical - slotRtp(EXAMPLE_SLOT))).toBeLessThan(0.02);
  }, 30000);
});
