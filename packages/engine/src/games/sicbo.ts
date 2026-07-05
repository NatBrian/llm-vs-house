// Sic Bo engine. Three dice, 216 equally-likely outcomes.
// Payouts match Singapore's gazetted "SIC BO (MBS) Game Rules Version 7" (GRA, w.e.f.
// 19 Sep 2025), rule 4.1 settlement tables — read directly from the primary source, not
// a secondary paraphrase (docs/PAYOUTS.md). Three exotic side-bet families present on
// the real felt (Three-Single-Dice-Combo, Double+Single-Combo, Four-Number-Combo) are a
// deliberate, documented simplification — out of scope for this engine.

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
  | 'anytriple';        // any three-of-a-kind, 31:1

/** Total-bet "to-one" odds by three-dice sum. GRA rule 4.1.2. */
export const SICBO_TOTAL_ODDS: Record<number, number> = {
  4: 62, 5: 31, 6: 18, 7: 12, 8: 8, 9: 7, 10: 6,
  11: 6, 12: 7, 13: 8, 14: 12, 15: 18, 16: 31, 17: 62,
};

/** Fixed "to-one" odds for the non-total bet families. GRA rule 4.1.1/4.1.6. */
export const SICBO_ODDS = {
  evenMoney: 1, // small / big / odd / even
  combo: 6,
  double: 11,
  triple: 180,
  anytriple: 31,
  // single number pays 1/2/12 to one by the number of dice that match (rule 4.1.6)
} as const;

/**
 * Table minimum stake per bet family, in points. Mirrors a real casino: the
 * even-money "outside" bets (Small/Big/Odd/Even) carry a higher minimum than
 * the higher-paying "inside" bets. Enforced by the adapter — a stake below the
 * family minimum is not accepted.
 */
export const SICBO_MIN_BET: Record<SicBoBetType, number> = {
  small: 50, big: 50, odd: 50, even: 50,
  total: 10, single: 10, combo: 10, double: 10, triple: 10, anytriple: 10,
};

/** The lowest table minimum across all families — the cheapest legal bet. */
export const SICBO_TABLE_MIN = Math.min(...Object.values(SICBO_MIN_BET));

export interface SicBoBet {
  type: SicBoBetType;
  amount: number;
  total?: number;          // for 'total'
  face?: number;           // for 'single' | 'double' | 'triple' (1..6)
  faces?: [number, number]; // for 'combo' (two distinct faces)
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
