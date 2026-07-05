// Sic Bo engine. Three dice, 216 equally-likely outcomes.
// Payouts vary by casino; this is the common Wizard of Odds "standard" set (docs/PAYOUTS.md).
// Payouts are configurable via SICBO_PAYOUTS so alternate house tables can be swapped in.

import type { Rng } from '../rng.js';

export type Dice = [number, number, number]; // each 1..6

export type SicBoBetType =
  | 'small' | 'big'      // total 4-10 / 11-17, lose on any triple, 1:1
  | 'total'              // exact three-dice sum 4..17
  | 'single'            // a face on 1/2/3 dice pays 1:1 / 2:1 / 3:1
  | 'combo'             // two specific different faces both appear, 5:1
  | 'double'            // a specific face appears >= 2 times, 10:1
  | 'triple'            // a specific face appears 3 times, 180:1
  | 'anytriple';        // any three-of-a-kind, 30:1

/** Total-bet "to-one" odds by three-dice sum (standard table). */
export const SICBO_TOTAL_ODDS: Record<number, number> = {
  4: 60, 5: 30, 6: 17, 7: 12, 8: 8, 9: 6, 10: 6,
  11: 6, 12: 6, 13: 8, 14: 12, 15: 17, 16: 30, 17: 60,
};

/** Fixed "to-one" odds for the non-total bet families (standard table). */
export const SICBO_ODDS = {
  smallBig: 1,
  combo: 5,
  double: 10,
  triple: 180,
  anytriple: 30,
  // single number pays 1/2/3 to one by the number of dice that match
} as const;

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
      return !isTriple(d) && diceSum(d) >= 4 && diceSum(d) <= 10 ? amount * SICBO_ODDS.smallBig : -amount;
    case 'big':
      return !isTriple(d) && diceSum(d) >= 11 && diceSum(d) <= 17 ? amount * SICBO_ODDS.smallBig : -amount;
    case 'total': {
      if (bet.total === undefined) return -amount;
      return diceSum(d) === bet.total ? amount * (SICBO_TOTAL_ODDS[bet.total] ?? 0) : -amount;
    }
    case 'single': {
      if (bet.face === undefined) return -amount;
      const n = countFace(d, bet.face);
      return n > 0 ? amount * n : -amount; // 1:1 / 2:1 / 3:1
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
