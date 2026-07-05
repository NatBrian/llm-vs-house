import { describe, it, expect } from 'vitest';
import {
  EXAMPLE_SLOT, slotRtp, spinSlot, resolveSlot, createRng,
} from '../src/index.js';

describe('slot RTP (docs/PAYOUTS.md worked example)', () => {
  it('example config RTP = 30552/32768 = 93.24%', () => {
    expect(slotRtp(EXAMPLE_SLOT)).toBeCloseTo(30552 / 32768, 10);
  });
  it('house edge = 1 - RTP = 6.76%', () => {
    expect(1 - slotRtp(EXAMPLE_SLOT)).toBeCloseTo(0.0676270, 6);
  });
});

describe('slot mechanics', () => {
  it('spin is deterministic for a seed', () => {
    const a = createRng('slot'); const b = createRng('slot');
    const seqA = Array.from({ length: 40 }, () => spinSlot(a, EXAMPLE_SLOT));
    const seqB = Array.from({ length: 40 }, () => spinSlot(b, EXAMPLE_SLOT));
    expect(seqA).toEqual(seqB);
  });
  it('net = payout*bet - bet on a win, -bet on a loss', () => {
    expect(resolveSlot({ symbols: ['7', '7', '7'], payout: 2000, ruleIndex: 0 }, 5)).toBe(2000 * 5 - 5);
    expect(resolveSlot({ symbols: ['BLANK', 'BLANK', 'BLANK'], payout: 0, ruleIndex: -1 }, 5)).toBe(-5);
  });
  it('empirical RTP over many spins approaches analytic RTP', () => {
    const r = createRng('rtp-sim');
    const N = 200000;
    let ret = 0;
    for (let i = 0; i < N; i++) ret += spinSlot(r, EXAMPLE_SLOT).payout;
    expect(ret / N).toBeCloseTo(30552 / 32768, 1); // within ~0.05
  });
});
