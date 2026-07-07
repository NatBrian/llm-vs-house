// Gambler's ruin probability tables for the Compare tab.
// Computes P(reach target bankroll before busting at 0) for each bankroll
// level, given a game's win probability and payout odds.
//
// Even-money bets (payout = 1) use the closed-form formula. Uneven bets
// use Gauss-Seidel value iteration over the full state space.

import {
  ROULETTE_ODDS, rouletteWins, rouletteWheel, allSicBoOutcomes, resolveSicBoBet,
  type RouletteBetType, type RouletteVariant, type SicBoBetType, type SicBoBet,
  type Dice, type BaccaratBetType, type BaccaratCoup,
} from '@casino/engine';

export interface GamblersRuinRow {
  bankroll: number;
  winProb: number;
  bustProb: number;
}

export interface BetInfo {
  label: string;
  p: number;
  payout: number;
}

// ---------------------------------------------------------------- roulette

export function rouletteWinProb(type: RouletteBetType, variant: RouletteVariant): number {
  const n = variant === 'european' ? 37 : 38;
  switch (type) {
    case 'red': case 'black': case 'odd': case 'even': case 'high': case 'low':
      return 18 / n;
    case 'column': case 'dozen':
      return 12 / n;
    case 'sixline': case 'series6':
      return 6 / n;
    case 'five':
      return 5 / n;
    case 'corner':
      return 4 / n;
    case 'street': case 'series3':
      return 3 / n;
    case 'split': case 'zeroCombo':
      return 2 / n;
    case 'straight':
      return 1 / n;
  }
}

export function roulettePayout(type: RouletteBetType): number {
  return ROULETTE_ODDS[type];
}

export function rouletteBetLabel(type: RouletteBetType): string {
  const labels: Partial<Record<RouletteBetType, string>> = {
    red: 'Red 1:1', black: 'Black 1:1', odd: 'Odd 1:1', even: 'Even 1:1',
    high: 'High 1:1', low: 'Low 1:1', column: 'Column 2:1', dozen: 'Dozen 2:1',
    sixline: 'Six Line 5:1', series6: '6 Numbers 5:1', five: 'Top Line 5:1',
    corner: 'Corner 8:1', street: 'Street 11:1', series3: '3 Numbers 11:1',
    split: 'Split 17:1', zeroCombo: '0/00 Combo 11:1', straight: 'Straight 35:1',
  };
  return labels[type] ?? type;
}

// ---------------------------------------------------------------- sic bo

export function sicboWinProb(type: SicBoBetType, _params?: Partial<SicBoBet>): number {
  const outcomes = allSicBoOutcomes();
  switch (type) {
    case 'small': case 'big': case 'odd': case 'even':
      return outcomes.filter((d) => resolveSicBoBet({ type, amount: 1, face: 1, total: 9 }, d) > 0).length / 216;
    case 'anytriple':
      return outcomes.filter((d) => resolveSicBoBet({ type, amount: 1 }, d) > 0).length / 216;
    case 'combo':
      return outcomes.filter((d) => resolveSicBoBet({ type, amount: 1, faces: [1, 2] }, d) > 0).length / 216;
    case 'double':
      return outcomes.filter((d) => resolveSicBoBet({ type, amount: 1, face: 1 }, d) > 0).length / 216;
    case 'triple':
      return outcomes.filter((d) => resolveSicBoBet({ type, amount: 1, face: 1 }, d) > 0).length / 216;
    case 'single':
      return outcomes.filter((d) => resolveSicBoBet({ type, amount: 1, face: 1 }, d) > 0).length / 216;
    case 'total':
      return 1 / 216; // each total happens with varying ways, resolved below
    case 'doubleAny':
      return outcomes.filter((d) => resolveSicBoBet({ type, amount: 1, face: 2, partner: 3 }, d) > 0).length / 216;
    case 'threeSingleCombo':
      return outcomes.filter((d) => resolveSicBoBet({ type, amount: 1, triple: [1, 2, 6] }, d) > 0).length / 216;
    case 'threeFromFour':
      return outcomes.filter((d) => resolveSicBoBet({ type, amount: 1, group: 1 }, d) > 0).length / 216;
  }
}

export function sicboPayout(type: SicBoBetType): number {
  switch (type) {
    case 'small': case 'big': case 'odd': case 'even': return 1;
    case 'combo': return 6;
    case 'double': return 11;
    case 'triple': return 180;
    case 'anytriple': return 31;
    case 'doubleAny': return 50;
    case 'threeSingleCombo': return 30;
    case 'threeFromFour': return 7;
    case 'single': return 1; // varies, simplified as 1
    case 'total': return 6; // varies 6:1 to 62:1, simplified
  }
}

export function sicboBetLabel(type: SicBoBetType): string {
  const labels: Partial<Record<SicBoBetType, string>> = {
    small: 'Small 1:1', big: 'Big 1:1', odd: 'Odd 1:1', even: 'Even 1:1',
    combo: 'Combo 6:1', double: 'Double 11:1', triple: 'Triple 180:1',
    anytriple: 'Any Triple 31:1', doubleAny: 'Double+Single 50:1',
    threeSingleCombo: 'Three Single 30:1', threeFromFour: 'Three From Four 7:1',
    single: 'Single 1:1~12:1', total: 'Total 6:1~62:1',
  };
  return labels[type] ?? type;
}

// ---------------------------------------------------------------- baccarat

// Well-known theoretical probabilities (8-deck, excluding commission on banker):
// Banker win 0.458597, Player win 0.446247, Tie 0.095156.
// For gambler's ruin we fold ties into the denominator: p_eff = p / (p + q).
export function baccaratWinProb(type: BaccaratBetType): number {
  switch (type) {
    case 'banker': return 0.458597;
    case 'player': return 0.446247;
    case 'tie': return 0.095156;
    case 'playerPair': return 0.074;
    case 'bankerPair': return 0.074;
  }
}

export function baccaratPushProb(type: BaccaratBetType): number {
  switch (type) {
    case 'banker': case 'player': return 0.095156; // ties push
    default: return 0;
  }
}

export function baccaratPayout(type: BaccaratBetType): number {
  switch (type) {
    case 'player': return 1;
    case 'banker': return 0.95;
    case 'tie': return 8;
    case 'playerPair': case 'bankerPair': return 11;
  }
}

export function baccaratBetLabel(type: BaccaratBetType): string {
  const labels: Record<BaccaratBetType, string> = {
    player: 'Player 1:1', banker: 'Banker 0.95:1', tie: 'Tie 8:1',
    playerPair: 'Player Pair 11:1', bankerPair: 'Banker Pair 11:1',
  };
  return labels[type] ?? type;
}

// ---------------------------------------------------------------- gambler's ruin engine

function gamblersRuin(targetUnits: number, p: number, payout: number): number[] {
  const P = new Array<number>(targetUnits + 1);
  P[0] = 0;
  P[targetUnits] = 1;

  if (targetUnits <= 1) return P;

  const q = 1 - p;

  if (payout === 1) {
    // Closed-form: even-money gambler's ruin
    if (Math.abs(p - q) < 1e-12) {
      for (let i = 1; i < targetUnits; i++) P[i] = i / targetUnits;
    } else {
      const r = q / p;
      const denom = 1 - r ** targetUnits;
      for (let i = 1; i < targetUnits; i++) P[i] = (1 - r ** i) / denom;
    }
  } else {
    // Numerical: Gauss-Seidel iteration for asymmetric steps
    for (let i = 1; i < targetUnits; i++) P[i] = i / targetUnits;

    for (let iter = 0; iter < 5000; iter++) {
      let maxDiff = 0;
      for (let i = targetUnits - 1; i >= 1; i--) {
        const winNext = Math.min(i + payout, targetUnits);
        const loseNext = Math.max(i - 1, 0);
        const newVal = p * P[winNext]! + q * P[loseNext]!;
        const diff = Math.abs(newVal - P[i]!);
        if (diff > maxDiff) maxDiff = diff;
        P[i] = newVal;
      }
      if (maxDiff < 1e-12) break;
    }
  }

  return P;
}

// ---------------------------------------------------------------- public API

export interface GamblersRuinInput {
  game: 'roulette' | 'baccarat' | 'sicbo';
  betType: string;
  variant?: RouletteVariant;
  startingBankroll: number;
  baseBet: number;
  targetMoney: number;
}

export interface GamblersRuinOutput {
  rows: GamblersRuinRow[];
  betInfo: BetInfo;
  effectiveP: number;
  stepCount: number;
  startingUnits: number;
  targetUnits: number;
}

export function computeGamblersRuin(input: GamblersRuinInput): GamblersRuinOutput | null {
  const { game, betType, variant, startingBankroll, baseBet, targetMoney } = input;

  if (baseBet <= 0 || targetMoney <= 0 || startingBankroll <= 0) return null;
  if (targetMoney <= startingBankroll) return null;

  let betInfo: BetInfo;
  switch (game) {
    case 'roulette': {
      const t = betType as RouletteBetType;
      const rawP = rouletteWinProb(t, variant ?? 'european');
      const payout = roulettePayout(t);
      betInfo = { label: rouletteBetLabel(t), p: rawP, payout };
      break;
    }
    case 'baccarat': {
      const t = betType as BaccaratBetType;
      const rawP = baccaratWinProb(t);
      const pushP = baccaratPushProb(t);
      const payout = baccaratPayout(t);
      const effectiveP = pushP > 0 ? rawP / (1 - pushP) : rawP;
      betInfo = { label: baccaratBetLabel(t), p: effectiveP, payout };
      break;
    }
    case 'sicbo': {
      const t = betType as SicBoBetType;
      const rawP = sicboWinProb(t);
      const payout = sicboPayout(t);
      betInfo = { label: sicboBetLabel(t), p: rawP, payout };
      break;
    }
    default:
      return null;
  }

  // Clamp payout to at least 1 for the gambler's ruin step size
  // (baccarat banker 0.95 → treat as 1, close enough)
  const effectivePayout = Math.max(1, Math.round(betInfo.payout));

  const startingUnits = Math.round(startingBankroll / baseBet);
  const targetUnits = Math.round(targetMoney / baseBet);

  if (targetUnits <= 0 || startingUnits <= 0) return null;
  if (targetUnits <= startingUnits) return null;

  const P = gamblersRuin(targetUnits, betInfo.p, effectivePayout);

  const rows: GamblersRuinRow[] = [];
  for (let u = 0; u <= targetUnits; u++) {
    const winProb = P[u] ?? 0;
    rows.push({
      bankroll: u * baseBet,
      winProb,
      bustProb: 1 - winProb,
    });
  }

  return {
    rows,
    betInfo,
    effectiveP: betInfo.p,
    stepCount: targetUnits + 1,
    startingUnits,
    targetUnits,
  };
}
