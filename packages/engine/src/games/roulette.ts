// Roulette engine. European (single-zero, 37 pockets, MBS-style) and American
// (double-zero, 38 pockets, RWS-style). Bet types/payouts/geometry follow the
// GRA-approved "Roulette (MBS) Game Rules Version 3" and "RWS Roulette Game
// Rules" (w.e.f. 3 Feb 2023) — see docs/PAYOUTS.md for rule-by-rule citations.
//
// Simplification: RWS actually publishes 4 separate pay tables (plain / +0-00
// combo / +series bets / +both), all on a double-zero wheel. Rather than model
// four table sub-types, the American variant here enables every RWS-only bet
// (zeroCombo, series3, series6) at once — a real RWS table may only offer a
// subset, but every bet type modeled here is a real GRA-approved bet.

import type { Rng } from '../rng.js';

export type RouletteVariant = 'european' | 'american';

/** A pocket is 0..36, or the string '00' on the American wheel. */
export type Pocket = number | '00';

export const RED_NUMBERS: ReadonlySet<number> = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export type RouletteBetType =
  | 'straight' | 'split' | 'street' | 'corner' | 'sixline'
  | 'column' | 'dozen' | 'red' | 'black' | 'odd' | 'even' | 'high' | 'low'
  | 'five'       // American-only Top Line: 0,00,1,2,3
  | 'zeroCombo'  // American-only dedicated 0/00 box (worse than a fair split)
  | 'series3'    // fixed 3-number wheel-sector group (RWS "3 Numbers Series Bet")
  | 'series6';   // fixed 6-number wheel-sector group (RWS "6 Numbers Series Bet"), pairs of series3

/** Net "to-one" odds per bet type (profit per unit staked). GRA pay tables 1-4. */
export const ROULETTE_ODDS: Record<RouletteBetType, number> = {
  straight: 35, split: 17, street: 11, corner: 8, sixline: 5,
  column: 2, dozen: 2, red: 1, black: 1, odd: 1, even: 1, high: 1, low: 1,
  five: 5, zeroCombo: 11, series3: 11, series6: 5,
};

/**
 * Table minimum stake per bet family, in points — mirrors SICBO_MIN_BET.
 * Outside even-money bets carry the higher minimum; every other bet (inside
 * numbers, columns, dozens, the American basket/combo/series bets) shares the
 * lower one. Enforced by the adapter, same as Sic Bo's table rules.
 */
export const ROULETTE_MIN_BET: Record<RouletteBetType, number> = {
  red: 50, black: 50, odd: 50, even: 50, high: 50, low: 50,
  straight: 10, split: 10, street: 10, corner: 10, sixline: 10,
  column: 10, dozen: 10, five: 10, zeroCombo: 10, series3: 10, series6: 10,
};

export interface RouletteBet {
  type: RouletteBetType;
  amount: number;
  /** Covered pockets for straight/split/street/corner/sixline. */
  numbers?: Pocket[];
  /** 1|2|3 for column and dozen bets. */
  selector?: 1 | 2 | 3;
  /** 1..12 for series3, 1..6 for series6. */
  seriesGroup?: number;
}

function columnNumbers(sel: number): number[] {
  const out: number[] = [];
  for (let n = sel; n <= 36; n += 3) out.push(n); // sel=1 => 1,4,7,...; sel=2 => 2,5,...
  return out;
}

function dozenNumbers(sel: number): number[] {
  const start = (sel - 1) * 12 + 1;
  const out: number[] = [];
  for (let n = start; n < start + 12; n++) out.push(n);
  return out;
}

/**
 * Standard European single-zero wheel pocket sequence (physical wheel order,
 * not betting-layout order). Used both for the felt's "Series" bet groupings
 * and (informationally) by the UI's wheel animation.
 */
export const EUROPEAN_WHEEL_ORDER: number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

/**
 * The 12 "3 Numbers Series Bet" groups from GRA RWS Appendix G/H/J/K, derived
 * by partitioning EUROPEAN_WHEEL_ORDER (minus the zero) into consecutive
 * groups of 3 in wheel order. Verified against the printed appendix images:
 * reproduces the exact 12 groups (as sets) byte-for-byte.
 */
export const SERIES3_GROUPS: number[][] = (() => {
  const nonZero = EUROPEAN_WHEEL_ORDER.filter((n) => n !== 0);
  const groups: number[][] = [];
  for (let i = 0; i < nonZero.length; i += 3) groups.push(nonZero.slice(i, i + 3));
  return groups;
})();

/** The 6 "6 Numbers Series Bet" groups — adjacent pairs of SERIES3_GROUPS. */
export const SERIES6_GROUPS: number[][] = (() => {
  const groups: number[][] = [];
  for (let i = 0; i < SERIES3_GROUPS.length; i += 2) {
    groups.push([...SERIES3_GROUPS[i]!, ...SERIES3_GROUPS[i + 1]!]);
  }
  return groups;
})();

export function rouletteWins(bet: RouletteBet, result: Pocket): boolean {
  const num = typeof result === 'number' ? result : -1; // '00' => -1, never matches numeric predicates
  switch (bet.type) {
    case 'straight': case 'split': case 'street': case 'corner': case 'sixline':
      return (bet.numbers ?? []).some((p) => p === result);
    case 'five':
      return result === '00' || result === 0 || result === 1 || result === 2 || result === 3;
    case 'zeroCombo':
      return result === 0 || result === '00';
    case 'series3': {
      const group = bet.seriesGroup !== undefined ? SERIES3_GROUPS[bet.seriesGroup - 1] : undefined;
      return num > 0 && (group ?? []).includes(num);
    }
    case 'series6': {
      const group = bet.seriesGroup !== undefined ? SERIES6_GROUPS[bet.seriesGroup - 1] : undefined;
      return num > 0 && (group ?? []).includes(num);
    }
    case 'red': return num > 0 && RED_NUMBERS.has(num);
    case 'black': return num > 0 && !RED_NUMBERS.has(num);
    case 'odd': return num > 0 && num % 2 === 1;
    case 'even': return num > 0 && num % 2 === 0;
    case 'low': return num >= 1 && num <= 18;
    case 'high': return num >= 19 && num <= 36;
    case 'column': return num > 0 && columnNumbers(bet.selector ?? 1).includes(num);
    case 'dozen': return num > 0 && dozenNumbers(bet.selector ?? 1).includes(num);
  }
}

const col = (n: number): number => ((n - 1) % 3) + 1;
const row = (n: number): number => Math.ceil(n / 3);

/** Zero-adjacent splits that exist on the physical felt (0/00 sit atop the grid). */
const ZERO_SPLITS: Pocket[][] = [[0, 1], [0, 2], [0, 3], ['00', 2], ['00', 3], [0, '00']];
/** Zero-adjacent "trio" streets that exist on the physical felt (GRA Appendix C/F/I/L). */
const ZERO_TRIOS_EUROPEAN: Pocket[][] = [[0, 1, 2]];
const ZERO_TRIOS_AMERICAN: Pocket[][] = [[0, 1, 2], ['00', 2, 3], [0, '00', 2], [0, '00', 3]];

const sameSet = (a: Pocket[], b: Pocket[]): boolean => {
  if (a.length !== b.length) return false;
  const as = [...a].sort().join(',');
  const bs = [...b].sort().join(',');
  return as === bs;
};

/**
 * Does `bet.numbers` describe an actual cell/line/corner on the felt? Prevents
 * a decider from inventing e.g. a "corner" out of four unrelated numbers to
 * collect its payout — a real dealer would refuse the bet outright.
 */
export function isValidRouletteBet(bet: RouletteBet, variant: RouletteVariant): boolean {
  const nums = bet.numbers ?? [];
  switch (bet.type) {
    case 'straight':
      return nums.length === 1;
    case 'split': {
      if (nums.length !== 2) return false;
      if (ZERO_SPLITS.some((z) => sameSet(z, nums))) return variant === 'american' || !nums.includes('00');
      const [a, b] = nums;
      if (typeof a !== 'number' || typeof b !== 'number') return false;
      if (row(a) === row(b) && Math.abs(col(a) - col(b)) === 1) return true;
      return col(a) === col(b) && Math.abs(row(a) - row(b)) === 1;
    }
    case 'street': {
      if (nums.length !== 3) return false;
      const zeroTrios = variant === 'american' ? ZERO_TRIOS_AMERICAN : ZERO_TRIOS_EUROPEAN;
      if (zeroTrios.some((z) => sameSet(z, nums))) return true;
      const ns = [...nums].map(Number).sort((x, y) => x - y);
      return ns[0]! % 3 === 1 && ns[1] === ns[0]! + 1 && ns[2] === ns[0]! + 2;
    }
    case 'corner': {
      if (nums.length !== 4) return false;
      const ns = [...nums].map(Number).sort((x, y) => x - y);
      const n = ns[0]!;
      return n % 3 !== 0 && sameSet(ns, [n, n + 1, n + 3, n + 4]);
    }
    case 'sixline': {
      if (nums.length !== 6) return false;
      const ns = [...nums].map(Number).sort((x, y) => x - y);
      const n = ns[0]!;
      return n % 3 === 1 && sameSet(ns, [n, n + 1, n + 2, n + 3, n + 4, n + 5]);
    }
    case 'five':
    case 'zeroCombo':
      return variant === 'american';
    case 'series3':
      return variant === 'american' && bet.seriesGroup !== undefined && bet.seriesGroup >= 1 && bet.seriesGroup <= SERIES3_GROUPS.length;
    case 'series6':
      return variant === 'american' && bet.seriesGroup !== undefined && bet.seriesGroup >= 1 && bet.seriesGroup <= SERIES6_GROUPS.length;
    case 'column': case 'dozen': case 'red': case 'black':
    case 'odd': case 'even': case 'high': case 'low':
      return true;
  }
}

/** Net points for a single bet given the winning pocket. */
export function resolveRouletteBet(bet: RouletteBet, result: Pocket): number {
  return rouletteWins(bet, result) ? bet.amount * ROULETTE_ODDS[bet.type] : -bet.amount;
}

/** The full set of equally-likely pockets for a wheel (order irrelevant to probability). */
export function rouletteWheel(variant: RouletteVariant): Pocket[] {
  const base: Pocket[] = [];
  for (let n = 0; n <= 36; n++) base.push(n);
  if (variant === 'american') base.push('00');
  return base;
}

export function spinRoulette(rng: Rng, variant: RouletteVariant): Pocket {
  return rng.pick(rouletteWheel(variant));
}
