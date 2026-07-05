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
