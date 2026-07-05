// Sic Bo engine. Three dice, 216 equally-likely outcomes.
// Payouts and bet families match Singapore's gazetted "SIC BO (MBS) Game Rules Version 7"
// (GRA, w.e.f. 19 Sep 2025), rule 4.1 settlement tables and rule 3.5 bet definitions —
// read directly from the primary source, not a secondary paraphrase (docs/PAYOUTS.md).
// Includes the three exotic side-bet families from the real felt (Three-Single-Dice-Combo,
// Double+Single-Combo, Four-Number-Combo) alongside the ten core bets.

import type { Rng } from '../rng.js';

export type Dice = [number, number, number]; // each 1..6

export type SicBoBetType =
  | 'small' | 'big'      // total 4-10 / 11-17, lose on any triple, 1:1
  | 'odd' | 'even'       // total parity, lose on any triple, 1:1
  | 'total'              // exact three-dice sum 4..17
  | 'single'            // a face on 1/2/3 dice pays 1:1 / 2:1 / 12:1 (GRA rule 4.1.6)
  | 'combo'             // two specific different faces both appear, 6:1
  | 'double'            // a specific face appears >= 2 times, 11:1
  | 'triple'            // a specific face appears 3 times, 180:1
  | 'anytriple'         // any three-of-a-kind, 31:1
  | 'doubleAny'         // exact double D + single partner P (one felt cell each), 50:1 (rule 4.1.5)
  | 'threeSingleCombo'  // exact three distinct faces (one felt cell each), 30:1 (rule 4.1.4)
  | 'threeFromFour';    // 3 distinct dice all within a fixed 4-number set, 7:1 (rule 4.1.7)

/** Total-bet "to-one" odds by three-dice sum. GRA rule 4.1.2. */
export const SICBO_TOTAL_ODDS: Record<number, number> = {
  4: 62, 5: 31, 6: 18, 7: 12, 8: 8, 9: 7, 10: 6,
  11: 6, 12: 7, 13: 8, 14: 12, 15: 18, 16: 31, 17: 62,
};

/** Fixed "to-one" odds for the non-total bet families. GRA rule 4.1.1/4.1.4/4.1.5/4.1.6/4.1.7. */
export const SICBO_ODDS = {
  evenMoney: 1, // small / big / odd / even
  combo: 6,
  double: 11,
  triple: 180,
  anytriple: 31,
  doubleAny: 50,
  threeSingleCombo: 30,
  threeFromFour: 7,
  // single number pays 1/2/12 to one by the number of dice that match (rule 4.1.6)
} as const;

/**
 * Every valid (double face, partner face) pair for the `doubleAny` bet, per GRA
 * Appendix A/B — one felt cell per pair, each an exact "double D + single P"
 * target (NOT a group where any partner wins: verified by house-edge math,
 * treating a group as a single OR-bet gives an impossible +183% player edge).
 * The real felt omits exactly two of the 30 possible pairs — (1,2) and (6,5) —
 * so those two combinations simply aren't offered as a bet.
 */
export const SICBO_DOUBLE_ANY_PAIRS: Array<[number, number]> = (() => {
  const pairs: Array<[number, number]> = [];
  for (let face = 1; face <= 6; face++) {
    for (let partner = 1; partner <= 6; partner++) {
      if (partner === face) continue;
      if (face === 1 && partner === 2) continue; // not on the real felt
      if (face === 6 && partner === 5) continue; // not on the real felt
      pairs.push([face, partner]);
    }
  }
  return pairs;
})();

/**
 * The four felt-colour clusters `threeSingleCombo` cells are grouped into on
 * the real table (purely cosmetic/UI clustering — the bet itself always
 * targets one exact 3-distinct-face triple; these four groups partition all
 * 20 possible distinct-face triples with no overlap).
 */
export const SICBO_THREE_SINGLE_COMBO_GROUPS: Record<number, string[]> = {
  1: ['126', '135', '234', '256', '346'],
  2: ['123', '136', '145', '235', '356'],
  3: ['124', '146', '236', '245', '456'],
  4: ['125', '134', '156', '246', '345'],
};

/** The four "three dice from four possible combinations" number sets (rule 4.1.7). */
export const SICBO_THREE_FROM_FOUR_GROUPS: Record<number, [number, number, number, number]> = {
  1: [1, 2, 3, 4],
  2: [2, 3, 4, 5],
  3: [2, 3, 5, 6],
  4: [3, 4, 5, 6],
};

/**
 * Table minimum stake per bet family, in points. Mirrors a real casino: the
 * even-money "outside" bets (Small/Big/Odd/Even) carry a higher minimum than
 * the higher-paying "inside" bets. Enforced by the adapter — a stake below the
 * family minimum is not accepted.
 */
export const SICBO_MIN_BET: Record<SicBoBetType, number> = {
  small: 50, big: 50, odd: 50, even: 50,
  total: 10, single: 10, combo: 10, double: 10, triple: 10, anytriple: 10,
  doubleAny: 10, threeSingleCombo: 10, threeFromFour: 10,
};

/** The lowest table minimum across all families — the cheapest legal bet. */
export const SICBO_TABLE_MIN = Math.min(...Object.values(SICBO_MIN_BET));

export interface SicBoBet {
  type: SicBoBetType;
  amount: number;
  total?: number;          // for 'total'
  face?: number;           // for 'single' | 'double' | 'triple' | 'doubleAny' (double face, 1..6)
  faces?: [number, number]; // for 'combo' (two distinct faces)
  partner?: number;         // for 'doubleAny' (the single partner face, 1..6)
  triple?: [number, number, number]; // for 'threeSingleCombo' (three distinct faces)
  group?: number;           // for 'threeFromFour' (1..4)
}

export function isTriple(d: Dice): boolean {
  return d[0] === d[1] && d[1] === d[2];
}

export function diceSum(d: Dice): number {
  return d[0] + d[1] + d[2];
}

function countFace(d: Dice, face: number): number {
  return (d[0] === face ? 1 : 0) + (d[1] === face ? 1 : 0) + (d[2] === face ? 1 : 0);
}

function sortedTriple(d: readonly number[]): string {
  return [...d].sort().join('');
}

/** Is this (face, partner) pair an actual cell on the felt? */
export function isValidDoubleAnyPair(face: number, partner: number): boolean {
  return SICBO_DOUBLE_ANY_PAIRS.some(([f, p]) => f === face && p === partner);
}

const isFace = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 6;

/**
 * Does this bet describe an actual, well-formed felt cell? Prevents a decider
 * from inventing e.g. a non-existent doubleAny pair or a degenerate
 * threeSingleCombo triple to collect its payout.
 */
export function isValidSicBoBet(bet: SicBoBet): boolean {
  switch (bet.type) {
    case 'small': case 'big': case 'odd': case 'even': case 'anytriple':
      return true;
    case 'total':
      return bet.total !== undefined && Number.isInteger(bet.total) && bet.total >= 4 && bet.total <= 17;
    case 'single': case 'double': case 'triple':
      return isFace(bet.face);
    case 'combo':
      return !!bet.faces && isFace(bet.faces[0]) && isFace(bet.faces[1]) && bet.faces[0] !== bet.faces[1];
    case 'doubleAny':
      return bet.face !== undefined && bet.partner !== undefined && isValidDoubleAnyPair(bet.face, bet.partner);
    case 'threeSingleCombo':
      return !!bet.triple && bet.triple.every(isFace) && new Set(bet.triple).size === 3;
    case 'threeFromFour':
      return bet.group !== undefined && bet.group >= 1 && bet.group <= 4;
  }
}

/** Net points for a single bet given the dice. */
export function resolveSicBoBet(bet: SicBoBet, d: Dice): number {
  const { amount } = bet;
  switch (bet.type) {
    case 'small':
      return !isTriple(d) && diceSum(d) >= 4 && diceSum(d) <= 10 ? amount * SICBO_ODDS.evenMoney : -amount;
    case 'big':
      return !isTriple(d) && diceSum(d) >= 11 && diceSum(d) <= 17 ? amount * SICBO_ODDS.evenMoney : -amount;
    case 'odd':
      return !isTriple(d) && diceSum(d) % 2 === 1 ? amount * SICBO_ODDS.evenMoney : -amount;
    case 'even':
      return !isTriple(d) && diceSum(d) % 2 === 0 ? amount * SICBO_ODDS.evenMoney : -amount;
    case 'total': {
      if (bet.total === undefined) return -amount;
      return diceSum(d) === bet.total ? amount * (SICBO_TOTAL_ODDS[bet.total] ?? 0) : -amount;
    }
    case 'single': {
      if (bet.face === undefined) return -amount;
      const n = countFace(d, bet.face);
      if (n === 0) return -amount;
      if (n === 3) return amount * 12; // rule 4.1.6: three-of-a-kind on a single-number bet pays 12:1
      return amount * n; // 1:1 / 2:1
    }
    case 'combo': {
      if (!bet.faces) return -amount;
      const [a, b] = bet.faces;
      return countFace(d, a) >= 1 && countFace(d, b) >= 1 ? amount * SICBO_ODDS.combo : -amount;
    }
    case 'double': {
      if (bet.face === undefined) return -amount;
      return countFace(d, bet.face) >= 2 ? amount * SICBO_ODDS.double : -amount;
    }
    case 'triple': {
      if (bet.face === undefined) return -amount;
      return countFace(d, bet.face) === 3 ? amount * SICBO_ODDS.triple : -amount;
    }
    case 'anytriple':
      return isTriple(d) ? amount * SICBO_ODDS.anytriple : -amount;
    case 'doubleAny': {
      if (bet.face === undefined || bet.partner === undefined) return -amount;
      const target = sortedTriple([bet.face, bet.face, bet.partner]);
      return sortedTriple(d) === target ? amount * SICBO_ODDS.doubleAny : -amount;
    }
    case 'threeSingleCombo': {
      if (!bet.triple) return -amount;
      return sortedTriple(d) === sortedTriple(bet.triple) ? amount * SICBO_ODDS.threeSingleCombo : -amount;
    }
    case 'threeFromFour': {
      if (bet.group === undefined) return -amount;
      const set = SICBO_THREE_FROM_FOUR_GROUPS[bet.group];
      if (!set) return -amount;
      const distinct = new Set(d);
      if (distinct.size !== 3) return -amount; // requires three distinct faces
      const allInSet = [...distinct].every((f) => (set as number[]).includes(f));
      return allInSet ? amount * SICBO_ODDS.threeFromFour : -amount;
    }
  }
}

export function rollSicBo(rng: Rng): Dice {
  return [rng.intInclusive(1, 6), rng.intInclusive(1, 6), rng.intInclusive(1, 6)];
}

/** All 216 equally-likely outcomes, for enumeration/house-edge computation. */
export function allSicBoOutcomes(): Dice[] {
  const out: Dice[] = [];
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) out.push([a, b, c]);
  return out;
}
