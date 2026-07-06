// Slot machine engine, 5-reel, 243-ways-to-win video slot (the dominant real-cabinet
// style on Singapore casino floors; "Reel Power"/ways games have no line-selection
// decision, all 243 ways are always active, matching this sim's one-stake-per-round
// architecture exactly, not as a simplification). No single real-world paytable is a
// public standard (manufacturer-proprietary), so this is a defensible worked example,
// verified by enumeration, see docs/PAYOUTS.md §4 for the full derivation.
//
// Mechanics mirror real EGM virtual-reel behavior (SG GRA Technical Standards for
// Electronic Gaming Machines §3.4.6): each reel is a weighted strip of stops; a spin
// picks one stop per reel uniformly, and the 3 visible rows are that stop plus the
// next two stops on the (circular) strip, not 3 independently-sampled symbols. This
// is what makes symbol weighting "bake in" via strip composition, same principle the
// old 3-reel engine used, extended to a 3-row window per reel.

import type { Rng } from '../rng.js';

export const SLOT_REEL_COUNT = 5;
export const SLOT_ROWS = 3;
export const SLOT_WAYS = SLOT_ROWS ** SLOT_REEL_COUNT; // 3^5 = 243

/**
 * Real cabinets separate "how much is each credit worth" (denomination/coin value)
 * from "how many credits per spin" (bet level), the player presses a denomination
 * chip and a bet-level stepper, or slams BET MAX, rather than typing a raw stake.
 * This sim mirrors that: every decider (rule bot / naive bot / LLM) chooses
 * `{ denomination, betLevel, betMax }`, not a bare amount, see SlotDecisionSchema.
 */
export const SLOT_DENOMINATIONS = [1, 2, 5, 10, 25, 50] as const;
export const SLOT_MAX_LEVEL = 10;
export const SLOT_MIN_BET = SLOT_DENOMINATIONS[0] * 1;
export const SLOT_MAX_BET = SLOT_DENOMINATIONS[SLOT_DENOMINATIONS.length - 1]! * SLOT_MAX_LEVEL;

/** Paying symbols only, excludes WILD/SCATTER, which every config must also define. */
export type SlotPayingSymbol = 'DRAGON' | 'TIGER' | 'LOTUS' | 'ACE' | 'KING' | 'QUEEN' | 'TEN';

export interface SlotConfig {
  /** Exactly SLOT_REEL_COUNT weighted strips; composition may differ per reel. */
  reels: string[][];
  /** Substitutes for every paying symbol (not for scatter). */
  wild: string;
  /** Pays anywhere in the grid regardless of reel/row position; triggers free spins. */
  scatter: string;
  /** 3-of/4-of/5-of-a-kind payout, "for-one" multiplier of TOTAL bet (already ways-normalized, see evaluateSlotGrid). */
  paytable: Record<SlotPayingSymbol, [number, number, number]>;
  /** Scatter pay, "for-one" multiplier of TOTAL bet, keyed by scatter count. */
  scatterPay: { 3: number; 4: number; 5: number };
  /** Free spins awarded at trigger, keyed by scatter count. */
  freeSpins: { 3: number; 4: number; 5: number };
}

export interface SlotWin {
  symbol: SlotPayingSymbol;
  count: 3 | 4 | 5;
  ways: number;
  /** "For-one" multiplier of total bet contributed by this symbol. */
  payout: number;
}

export interface SlotSpin {
  /** [reel][row], SLOT_REEL_COUNT x SLOT_ROWS landed symbols. */
  grid: string[][];
  /** Sum of every SlotWin's payout, "for-one" multiplier of total bet from ways wins. */
  waysWin: number;
  wins: SlotWin[];
  scatterCount: number;
  /** "For-one" multiplier of total bet. */
  scatterPayout: number;
  freeSpinsAwarded: number;
}

export interface SlotRoundResult {
  mainSpin: SlotSpin;
  /** Auto-played inside the engine when the main spin triggers free spins, no new decider call. */
  bonusSpins: SlotSpin[];
  /** "For-one" total across the main spin and every bonus spin. */
  totalPayout: number;
}

const PAYING_SYMBOLS: SlotPayingSymbol[] = ['DRAGON', 'TIGER', 'LOTUS', 'ACE', 'KING', 'QUEEN', 'TEN'];

/** The worked example from docs/PAYOUTS.md §4. Reel composition varies per reel,
 *  reel 3 is the "loosest" (an extra wild, one fewer king), real cabinets do this too. */
export const EXAMPLE_SLOT: SlotConfig = {
  wild: 'WILD',
  scatter: 'SCATTER',
  reels: (() => {
    const strip = (wild: number, king: number, queen: number): string[] => [
      ...Array(wild).fill('WILD'),
      ...Array(1).fill('SCATTER'),
      ...Array(1).fill('DRAGON'),
      ...Array(1).fill('TIGER'),
      ...Array(2).fill('LOTUS'),
      ...Array(3).fill('ACE'),
      ...Array(king).fill('KING'),
      ...Array(queen).fill('QUEEN'),
      ...Array(10).fill('TEN'),
    ] as string[];
    // reel: [wild, king, queen] stop counts; every strip sums to 32.
    return [
      strip(1, 5, 8), // reel 1: 1+1+1+1+2+3+5+8+10 = 32
      strip(2, 5, 7), // reel 2: 2+1+1+1+2+3+5+7+10 = 32
      strip(2, 4, 8), // reel 3 (loosest): 2+1+1+1+2+3+4+8+10 = 32
      strip(2, 5, 7), // reel 4
      strip(1, 5, 8), // reel 5
    ];
  })(),
  paytable: {
    DRAGON: [75, 210, 750],
    TIGER: [42, 115, 370],
    LOTUS: [26, 74, 210],
    ACE: [16, 42, 148],
    KING: [16, 37, 116],
    QUEEN: [7, 26, 84],
    TEN: [7, 21, 74],
  },
  scatterPay: { 3: 2, 4: 5, 5: 20 },
  freeSpins: { 3: 8, 4: 15, 5: 20 },
};

/** The 3 visible symbols for a reel stopped at `idx`, that stop plus the next two on
 *  the circular strip (real EGM virtual-reel window, not 3 independent samples). */
function reelWindow(strip: string[], idx: number): string[] {
  const n = strip.length;
  return [strip[idx]!, strip[(idx + 1) % n]!, strip[(idx + 2) % n]!];
}

/** Pure evaluator, no RNG, so ways/wild/scatter logic is directly unit-testable on
 *  hand-built grids. `grid[reel]` is that reel's 3 visible symbols (row order irrelevant
 *  to scoring: only counts-per-reel matter for ways, and total counts for scatter). */
export function evaluateSlotGrid(config: SlotConfig, grid: string[][]): Omit<SlotSpin, 'grid'> {
  const wins: SlotWin[] = [];
  let waysWin = 0;

  for (const symbol of PAYING_SYMBOLS) {
    const matchesPerReel: number[] = [];
    for (const reel of grid) {
      const m = reel.filter((s) => s === symbol || s === config.wild).length;
      if (m === 0) break;
      matchesPerReel.push(m);
    }
    const runLen = matchesPerReel.length;
    if (runLen >= 3) {
      const ways = matchesPerReel.reduce((a, b) => a * b, 1);
      const payout = (config.paytable[symbol][runLen - 3]! * ways) / SLOT_WAYS;
      wins.push({ symbol, count: runLen as 3 | 4 | 5, ways, payout });
      waysWin += payout;
    }
  }

  let scatterCount = 0;
  for (const reel of grid) scatterCount += reel.filter((s) => s === config.scatter).length;
  const cappedCount = Math.min(scatterCount, 5) as 3 | 4 | 5;
  const scatterPayout = scatterCount >= 3 ? config.scatterPay[cappedCount] : 0;
  const freeSpinsAwarded = scatterCount >= 3 ? config.freeSpins[cappedCount] : 0;

  return { waysWin, wins, scatterCount, scatterPayout, freeSpinsAwarded };
}

/** One spin: pick a stop per reel, derive its 3-row window, evaluate. */
export function spinSlot(rng: Rng, config: SlotConfig): SlotSpin {
  const grid = config.reels.map((strip) => reelWindow(strip, rng.int(strip.length)));
  return { grid, ...evaluateSlotGrid(config, grid) };
}

/**
 * Full round: one main spin, then, if it triggers, that many free spins played
 * automatically inside the engine (same precedent as Blackjack's post-bet action
 * loop: one decider call, then deterministic auto-play). v1 has no retriggers: a
 * bonus spin's own scatter hits still pay the scatter amount (scatter always pays,
 * that's real), but never extend `bonusSpins`, keeps the RTP a closed form and is a
 * common, defensible real-cabinet simplification (some real machines cap/restrict
 * retriggers too). This is the ONLY rng-consuming call site per round.
 */
export function playSlot(rng: Rng, config: SlotConfig): SlotRoundResult {
  const mainSpin = spinSlot(rng, config);
  const bonusSpins: SlotSpin[] = [];
  for (let i = 0; i < mainSpin.freeSpinsAwarded; i++) bonusSpins.push(spinSlot(rng, config));
  const totalPayout = mainSpin.waysWin + mainSpin.scatterPayout
    + bonusSpins.reduce((s, b) => s + b.waysWin + b.scatterPayout, 0);
  return { mainSpin, bonusSpins, totalPayout };
}

/** Net points for a bet on a full round (converts "for-one" total payout to net). */
export function resolveSlot(round: SlotRoundResult, amount: number): number {
  return round.totalPayout > 0 ? round.totalPayout * amount - amount : -amount;
}

/** Per-reel probability distribution over 3-symbol window *multisets*, the window's
 *  row order never affects scoring (ways only cares about per-reel match counts, scatter
 *  only cares about total counts), so grouping equal-multiset windows is exact, not an
 *  approximation, and collapses a 32-stop reel to ~15-20 distinct signatures. */
function reelSignatures(strip: string[]): Array<{ multiset: string[]; count: number }> {
  const n = strip.length;
  const byKey = new Map<string, { multiset: string[]; count: number }>();
  for (let idx = 0; idx < n; idx++) {
    const win = reelWindow(strip, idx);
    const key = [...win].sort().join(',');
    const existing = byKey.get(key);
    if (existing) existing.count++;
    else byKey.set(key, { multiset: win, count: 1 });
  }
  return [...byKey.values()];
}

export interface SlotRtpBreakdown {
  waysRtp: number;
  scatterRtp: number;
  /** EV of a single spin (main or bonus, they share the same config). */
  baseRtp: number;
  triggerProbability: { 3: number; 4: number; 5: number };
  expectedFreeSpinsPerSpin: number;
  /** Closed-form total RTP: baseRtp * (1 + expectedFreeSpinsPerSpin), exact under the v1 no-retrigger rule. */
  totalRtp: number;
  hitFrequency: number;
  combosEnumerated: number;
}

/** Exact analysis via the signature-dedup enumeration above, analysis/test-only,
 *  never called from the adapter hot path or shipped in the browser bundle (the
 *  adapter states a precomputed static RTP figure, same pattern as before). */
export function slotRtpBreakdown(config: SlotConfig): SlotRtpBreakdown {
  const perReel = config.reels.map(reelSignatures);
  const n = config.reels.map((s) => s.length);
  const totalCombos = n.reduce((a, b) => a * b, 1);

  let waysRtpSum = 0;
  let scatterRtpSum = 0;
  let hitCombos = 0;
  const triggerCombos = { 3: 0, 4: 0, 5: 0 };
  let freeSpinCombosWeighted = 0;
  let combosEnumerated = 0;

  const recurse = (reelIdx: number, grid: string[][], weight: number): void => {
    if (reelIdx === perReel.length) {
      combosEnumerated++;
      const evalResult = evaluateSlotGrid(config, grid);
      waysRtpSum += evalResult.waysWin * weight;
      scatterRtpSum += evalResult.scatterPayout * weight;
      if (evalResult.waysWin > 0 || evalResult.scatterPayout > 0) hitCombos += weight;
      if (evalResult.scatterCount >= 3) {
        const capped = Math.min(evalResult.scatterCount, 5) as 3 | 4 | 5;
        triggerCombos[capped] += weight;
        freeSpinCombosWeighted += config.freeSpins[capped] * weight;
      }
      return;
    }
    for (const sig of perReel[reelIdx]!) {
      grid.push(sig.multiset);
      recurse(reelIdx + 1, grid, weight * sig.count);
      grid.pop();
    }
  };
  recurse(0, [], 1);

  const waysRtp = waysRtpSum / totalCombos;
  const scatterRtp = scatterRtpSum / totalCombos;
  const baseRtp = waysRtp + scatterRtp;
  const expectedFreeSpinsPerSpin = freeSpinCombosWeighted / totalCombos;
  return {
    waysRtp,
    scatterRtp,
    baseRtp,
    triggerProbability: {
      3: triggerCombos[3] / totalCombos,
      4: triggerCombos[4] / totalCombos,
      5: triggerCombos[5] / totalCombos,
    },
    expectedFreeSpinsPerSpin,
    totalRtp: baseRtp * (1 + expectedFreeSpinsPerSpin),
    hitFrequency: hitCombos / totalCombos,
    combosEnumerated,
  };
}

/** Exact total RTP (base + closed-form bonus contribution). */
export function slotRtp(config: SlotConfig): number {
  return slotRtpBreakdown(config).totalRtp;
}
