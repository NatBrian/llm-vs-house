// Roulette engine. European (single-zero, 37 pockets) and American (double-zero, 38).
// Payouts identical on both wheels; only the extra '00' changes the edge.
// Source of truth: docs/PAYOUTS.md (Wizard of Odds verified).

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
  | 'five'; // American-only 0,00,1,2,3

/** Net "to-one" odds per bet type (profit per unit staked). */
export const ROULETTE_ODDS: Record<RouletteBetType, number> = {
  straight: 35, split: 17, street: 11, corner: 8, sixline: 5,
  column: 2, dozen: 2, red: 1, black: 1, odd: 1, even: 1, high: 1, low: 1,
  five: 6,
};

/**
 * Table minimum stake per bet family, in points — mirrors SICBO_MIN_BET.
 * Outside even-money bets carry the higher minimum; every other bet (inside
 * numbers, columns, dozens, the American five-number basket) shares the
 * lower one. Enforced by the adapter, same as Sic Bo's table rules.
 */
export const ROULETTE_MIN_BET: Record<RouletteBetType, number> = {
  red: 50, black: 50, odd: 50, even: 50, high: 50, low: 50,
  straight: 10, split: 10, street: 10, corner: 10, sixline: 10,
  column: 10, dozen: 10, five: 10,
};

export interface RouletteBet {
  type: RouletteBetType;
  amount: number;
  /** Covered pockets for straight/split/street/corner/sixline. */
  numbers?: Pocket[];
  /** 1|2|3 for column and dozen bets. */
  selector?: 1 | 2 | 3;
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

export function rouletteWins(bet: RouletteBet, result: Pocket): boolean {
  const num = typeof result === 'number' ? result : -1; // '00' => -1, never matches numeric predicates
  switch (bet.type) {
    case 'straight': case 'split': case 'street': case 'corner': case 'sixline':
      return (bet.numbers ?? []).some((p) => p === result);
    case 'five':
      return result === '00' || result === 0 || result === 1 || result === 2 || result === 3;
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
/** European-only "trio" streets that include zero. */
const ZERO_TRIOS: Pocket[][] = [[0, 1, 2], [0, 2, 3]];

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
      if (variant === 'european' && ZERO_TRIOS.some((z) => sameSet(z, nums))) return true;
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
      return variant === 'american';
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
