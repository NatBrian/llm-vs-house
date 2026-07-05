// Slot machine engine. No single real-world standard exists, so the game is fully
// data-driven: a per-reel symbol strip (weighting baked in by repetition) plus an
// ordered paytable evaluated first-match-wins. RTP = mean(payout) is a pure function
// of the config and is verified by enumeration (docs/PAYOUTS.md worked example).

import type { Rng } from '../rng.js';

/**
 * A paytable rule: `symbol` must appear on the first `count` reels (left-aligned).
 * Rules are evaluated in order; the FIRST match wins, which makes partial-symbol
 * rules (e.g. cherry on reel 1 only) mutually exclusive with fuller matches as long
 * as higher-count rules are listed first. `payout` is total return per unit bet
 * ("for one"): a payout of 2000 returns 2000 points for a 1-point bet.
 */
export interface SlotRule {
  symbol: string;
  count: number;
  payout: number;
}

export interface SlotConfig {
  /** One strip per reel; entries are symbol ids, repeated to encode weighting. */
  reels: string[][];
  /** Ordered paytable, first match wins. */
  paytable: SlotRule[];
}

export interface SlotSpin {
  symbols: string[]; // one landed symbol per reel
  /** Total return multiplier ("for one"); 0 if no rule matched. */
  payout: number;
  ruleIndex: number; // index into paytable, or -1 for no win
}

/** The worked example from docs/PAYOUTS.md: 3 reels, RTP = 30552/32768 = 93.24%. */
export const EXAMPLE_SLOT: SlotConfig = {
  reels: (() => {
    const strip = [
      ...Array(1).fill('7'),
      ...Array(3).fill('BAR'),
      ...Array(6).fill('BELL'),
      ...Array(4).fill('CHERRY'),
      ...Array(18).fill('BLANK'),
    ] as string[];
    return [strip, [...strip], [...strip]];
  })(),
  paytable: [
    { symbol: '7', count: 3, payout: 2000 },
    { symbol: 'BAR', count: 3, payout: 200 },
    { symbol: 'BELL', count: 3, payout: 50 },
    { symbol: 'CHERRY', count: 3, payout: 25 },
    { symbol: 'CHERRY', count: 2, payout: 8 },
    { symbol: 'CHERRY', count: 1, payout: 2 },
  ],
};

function evaluate(config: SlotConfig, symbols: string[]): { payout: number; ruleIndex: number } {
  for (let i = 0; i < config.paytable.length; i++) {
    const rule = config.paytable[i]!;
    let matched = true;
    for (let r = 0; r < rule.count; r++) {
      if (symbols[r] !== rule.symbol) { matched = false; break; }
    }
    if (matched) return { payout: rule.payout, ruleIndex: i };
  }
  return { payout: 0, ruleIndex: -1 };
}

export function spinSlot(rng: Rng, config: SlotConfig): SlotSpin {
  const symbols = config.reels.map((strip) => strip[rng.int(strip.length)]!);
  const { payout, ruleIndex } = evaluate(config, symbols);
  return { symbols, payout, ruleIndex };
}

/** Net points for a bet on a given spin (converts "for one" payout to net). */
export function resolveSlot(spin: SlotSpin, amount: number): number {
  return spin.payout > 0 ? spin.payout * amount - amount : -amount;
}

/** Exact RTP of a config by full enumeration of the reel cross-product. */
export function slotRtp(config: SlotConfig): number {
  const [r0, r1, r2] = config.reels;
  if (!r0 || !r1 || !r2 || config.reels.length !== 3) {
    throw new Error('slotRtp currently supports exactly 3 reels');
  }
  let totalReturn = 0;
  let count = 0;
  for (const s0 of r0) for (const s1 of r1) for (const s2 of r2) {
    totalReturn += evaluate(config, [s0, s1, s2]).payout;
    count++;
  }
  return totalReturn / count;
}
