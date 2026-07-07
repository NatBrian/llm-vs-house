// Gambler's ruin probability tables for the Compare tab.
//
// The table uses ONE fixed starting bankroll and computes, for each winning
// milestone M > startingBankroll: P(reach M before 0 | start at startingBankroll).
// Only winning milestones are shown — the start is a fixed reference point.
//
// Even-money bets (payout ≈ 1) use the closed-form formula. Uneven bets
// (straight 35:1, tie 8:1, etc.) use Gauss-Seidel iteration.

import {
  ROULETTE_ODDS, allSicBoOutcomes, resolveSicBoBet,
  slotPayoutHistogram, slotRtp,
  type RouletteBetType, type RouletteVariant, type SicBoBetType, type SicBoBet,
  type BaccaratBetType, type SlotConfig, type SlotHistogramEntry,
} from '@casino/engine';

// Cache the expensive histogram + derived CDF arrays (config never changes per session).
// The CDF is built lazily on first need and reused across all simulation calls.
interface CachedSlotData {
  hist: ReturnType<typeof slotPayoutHistogram>;
  sorted: SlotHistogramEntry[];
  cdf: number[];
  bonusEntries: SlotHistogramEntry[];
  bonusCdf: number[];
}
const slotCache = new WeakMap<SlotConfig, CachedSlotData>();
function getCachedSlotData(config: SlotConfig): CachedSlotData {
  let d = slotCache.get(config);
  if (!d) {
    const hist = slotPayoutHistogram(config);
    const { entries, cdf } = buildCdf(hist.entries);
    const bonusEntries = entries.filter((e) => e.freeSpinsAwarded === 0);
    const bonusCdf = buildCdf(bonusEntries).cdf;
    d = { hist, sorted: entries, cdf, bonusEntries, bonusCdf };
    slotCache.set(config, d);
  }
  return d;
}

export interface GamblersRuinRow {
  bankroll: number;
  /** P(reach this milestone before 0 | start at the fixed startingBankroll). */
  reachProb: number;
  /** 1 - reachProb. */
  bustProb: number;
  /** Expected number of bets until absorption (reach milestone or bust). */
  avgPlays: number;
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

export function sicboWinProb(type: SicBoBetType): number {
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
      return 1 / 216;
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
    case 'single': return 1;
    case 'total': return 6;
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
    case 'banker': case 'player': return 0.095156;
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

/** Probability of reaching `milestoneUnits` before reaching 0, starting from
 *  `startUnits` (< milestoneUnits), for a game with win prob p and payout odds.
 *
 *  Even-money (payout = 1): closed-form gambler's ruin.
 *  Uneven: Gauss-Seidel iteration on [0, milestoneUnits]. */
function reachProb(startUnits: number, milestoneUnits: number, p: number, payout: number): number {
  if (startUnits >= milestoneUnits) return 1;
  if (startUnits <= 0) return 0;
  if (milestoneUnits <= 0) return 0;

  const q = 1 - p;

  if (payout === 1) {
    if (Math.abs(p - q) < 1e-12) return startUnits / milestoneUnits;
    const r = q / p;
    return (1 - r ** startUnits) / (1 - r ** milestoneUnits);
  }

  // Numerical: Gauss-Seidel on [0, milestoneUnits]
  const N = milestoneUnits;
  const P = new Array<number>(N + 1);
  P[0] = 0;
  P[N] = 1;
  for (let i = 1; i < N; i++) P[i] = i / N;

  for (let iter = 0; iter < 5000; iter++) {
    let maxDiff = 0;
    for (let i = N - 1; i >= 1; i--) {
      const winNext = Math.min(i + payout, N);
      const loseNext = i - 1;
      const newVal = p * P[winNext]! + q * P[loseNext]!;
      const diff = Math.abs(newVal - P[i]!);
      if (diff > maxDiff) maxDiff = diff;
      P[i] = newVal;
    }
    if (maxDiff < 1e-12) break;
  }
  return P[startUnits]!;
}

/** Expected number of bets until absorption (reach milestoneUnits or hit 0),
 *  starting from `startUnits` (< milestoneUnits).
 *
 *  Even-money (payout = 1): closed-form.
 *  Uneven: Gauss-Seidel iteration on [0, milestoneUnits]. */
function expectedBets(startUnits: number, milestoneUnits: number, p: number, payout: number): number {
  if (startUnits >= milestoneUnits) return 0;
  if (startUnits <= 0) return 0;
  if (milestoneUnits <= 0) return 0;

  const q = 1 - p;

  if (payout === 1) {
    if (Math.abs(p - q) < 1e-12) return startUnits * (milestoneUnits - startUnits);
    const r = q / p;
    return startUnits / (q - p) - (milestoneUnits / (q - p)) * (1 - r ** startUnits) / (1 - r ** milestoneUnits);
  }

  // Numerical: Gauss-Seidel for expected hitting time
  const N = milestoneUnits;
  const E = new Array<number>(N + 1);
  E[0] = 0;
  E[N] = 0;
  for (let i = 1; i < N; i++) E[i] = 0;

  for (let iter = 0; iter < 5000; iter++) {
    let maxDiff = 0;
    for (let i = N - 1; i >= 1; i--) {
      const winNext = Math.min(i + payout, N);
      const newVal = 1 + p * E[winNext]! + q * E[i - 1]!;
      const diff = Math.abs(newVal - E[i]!);
      if (diff > maxDiff) maxDiff = diff;
      E[i] = newVal;
    }
    if (maxDiff < 1e-12) break;
  }
  return E[startUnits]!;
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
  startingUnits: number;
  targetUnits: number;
  /** The fixed bankroll every row's probability is computed from. */
  fixedStartBankroll: number;
}

/** Build a probability table from a single fixed starting bankroll.
 *
 *  Only returns rows for milestones ABOVE the starting bankroll (winning
 *  amounts). Each row = P(reach this milestone before 0 | start at the fixed
 *  startingBankroll). */
export function computeGamblersRuin(input: GamblersRuinInput): GamblersRuinOutput | null {
  const { game, betType, variant, startingBankroll, baseBet, targetMoney } = input;

  if (baseBet <= 0 || targetMoney <= 0 || startingBankroll <= 0) return null;

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
      betInfo = { label: baccaratBetLabel(t), p: pushP > 0 ? rawP / (1 - pushP) : rawP, payout };
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

  const effectivePayout = Math.max(1, Math.round(betInfo.payout));
  const s = Math.round(startingBankroll / baseBet);
  const t = Math.round(targetMoney / baseBet);

  if (t <= 0 || s <= 0) return null;
  if (t <= s) return null;

  const rows: GamblersRuinRow[] = [];
  // Only generate rows above the starting bankroll
  for (let m = s + 1; m <= t; m++) {
    const bankroll = m * baseBet;
    const r = reachProb(s, m, betInfo.p, effectivePayout);
    const avg = expectedBets(s, m, betInfo.p, effectivePayout);
    rows.push({ bankroll, reachProb: r, bustProb: 1 - r, avgPlays: avg });
  }

  return {
    rows,
    betInfo,
    effectiveP: betInfo.p,
    startingUnits: s,
    targetUnits: t,
    fixedStartBankroll: startingBankroll,
  };
}

// ---------------------------------------------------------------- slot outcome UI

/**
 * Tier thresholds aligned with the actual symbol paytable values.
 * Boundary at each symbol's 3OAK payout at full 243 ways:
 *   TEN/QUEEN 7×, KING/ACE 16×, TIGER 42×, DRAGON 75×, 5OAK combos 100×+ */
export const SLOT_TIERS = [
  { label: 'Miss', minPayout: 0, maxPayout: 1e-9, color: 'bg-white/10', textColor: 'text-white/30' },
  { label: 'Mini win', minPayout: 1e-9, maxPayout: 7, color: 'bg-sky-500/30', textColor: 'text-sky-300' },
  { label: 'Nice win', minPayout: 7, maxPayout: 16, color: 'bg-green-500/30', textColor: 'text-green-300' },
  { label: 'Big win', minPayout: 16, maxPayout: 42, color: 'bg-violet-500/30', textColor: 'text-violet-300' },
  { label: 'Mega win', minPayout: 42, maxPayout: 100, color: 'bg-pink-500/30', textColor: 'text-pink-300' },
  { label: 'Jackpot', minPayout: 100, maxPayout: Infinity, color: 'bg-amber-500/30', textColor: 'text-amber-300' },
] as const;

export interface SlotTierInfo {
  label: string;
  /** Dollar range for this tier at the given bet */
  dollarRange: string;
  probability: number;
  oneIn: number;
  color: string;
  textColor: string;
}

export interface SlotPerSpinBreakdown {
  tiers: SlotTierInfo[];
  triggerProb: number;
  freeSpinsLabel: string;
}

export interface SlotSimulationResult {
  /** For each non-Miss tier + Free spins, P(hit at least once in the session) */
  tierHitRates: Record<string, number>;
  /** How many spins until bust (or max spins) */
  medianSurvival: number;
  p90BustBy: number;
  /** Expected net loss = spins × bet × (1 - rtp) */
  expectedLoss: number;
}

/** Build a CDF array for fast inverse-transform sampling from the histogram. */
function buildCdf(entries: SlotHistogramEntry[]): { entries: SlotHistogramEntry[]; cdf: number[] } {
  const sorted = [...entries].sort((a, b) => a.payout - b.payout);
  const cdf: number[] = [];
  let cum = 0;
  for (const e of sorted) {
    cum += e.probability;
    cdf.push(cum);
  }
  return { entries: sorted, cdf };
}

/** Sample from the CDF using a uniform [0,1) random value. */
function sampleFrom(u: number, entries: SlotHistogramEntry[], cdf: number[]): SlotHistogramEntry {
  let lo = 0, hi = cdf.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (cdf[mid]! <= u) lo = mid + 1;
    else hi = mid;
  }
  return entries[lo]!;
}

/** Simulate N sessions on the slot machine and aggregate results.
 *  Each session: start at bankroll, spin until (bankroll <= 0) or (maxSpins reached).
 *  Uses the exact per-spin histogram + free spins sampling for each round. */
export function simulateSlotSessions(params: {
  config: SlotConfig;
  bet: number;
  startingBankroll: number;
  /** Override from form.rounds */
  maxSpins: number;
  /** Number of Monte Carlo trials, default 1000 */
  trials?: number;
}): SlotSimulationResult {
  const { config, bet, startingBankroll, maxSpins, trials = 1000 } = params;
  const { hist, sorted: entries, cdf, bonusEntries, bonusCdf } = getCachedSlotData(config);

  // Simple seeded PRNG for determinism
  let seed = 42;
  function rand(): number {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  const survival: number[] = [];

  // Per-tier "hit at least once" tracking (excluding Miss)
  const tierHitCounts: Record<string, number> = {};
  for (const t of SLOT_TIERS) {
    if (t.label === 'Miss') continue;
    tierHitCounts[t.label] = 0;
  }
  let fsTriggerCount = 0;

  for (let t = 0; t < trials; t++) {
    let br = startingBankroll;
    let spins = 0;
    const hitTiers = new Set<string>();

    while (br > 0 && spins < maxSpins) {
      const main = sampleFrom(rand(), entries, cdf);
      let roundPayout = main.payout;
      if (main.freeSpinsAwarded > 0) {
        hitTiers.add('Free spins');
        for (let f = 0; f < main.freeSpinsAwarded; f++) {
          const bonus = sampleFrom(rand(), bonusEntries, bonusCdf);
          roundPayout += bonus.payout;
        }
      }
      const net = roundPayout > 0 ? roundPayout * bet - bet : -bet;
      for (const t of SLOT_TIERS) {
        if (t.label === 'Miss') continue;
        if (roundPayout >= t.minPayout && roundPayout < t.maxPayout) {
          hitTiers.add(t.label);
          break;
        }
      }
      br += net;
      spins++;
    }

    survival.push(spins);
    for (const label of hitTiers) {
      if (label === 'Free spins') fsTriggerCount++;
      else tierHitCounts[label]++;
    }
  }

  survival.sort((a, b) => a - b);

  const tierHitRates: Record<string, number> = {};
  for (const [label, count] of Object.entries(tierHitCounts)) {
    tierHitRates[label] = count / trials;
  }
  tierHitRates['Free spins'] = fsTriggerCount / trials;

  const mid = survival.length >> 1;
  const p90 = Math.floor(survival.length * 0.9);

  const totalRtp = slotRtp(config);

  return {
    tierHitRates,
    medianSurvival: survival[mid] ?? maxSpins,
    p90BustBy: survival[p90] ?? maxSpins,
    expectedLoss: maxSpins * bet * (1 - totalRtp),
  };
}

/** Per-spin tier breakdown for Card 2 (what happens on each spin). */
export function computeSlotTierBreakdown(config: SlotConfig): SlotPerSpinBreakdown {
  const { hist } = getCachedSlotData(config);
  const tierProbs = SLOT_TIERS.map((t) => {
    let prob = 0;
    for (const e of hist.entries) {
      if (e.payout >= t.minPayout && e.payout < t.maxPayout) prob += e.probability;
    }
    return { ...t, probability: prob };
  });

  let triggerProb = 0;
  for (const e of hist.entries) {
    if (e.freeSpinsAwarded > 0) triggerProb += e.probability;
  }

  const fd = config.freeSpins;
  const freeSpinsLabel = `Free spins: ${fd[3]}/${fd[4]}/${fd[5]} on 3/4/5 scatters`;

  return {
    tiers: tierProbs.map((t) => ({
      label: t.label,
      dollarRange: '',
      probability: t.probability,
      oneIn: t.probability > 0 ? Math.round(1 / t.probability) : Infinity,
      color: t.color,
      textColor: t.textColor,
    })),
    triggerProb,
    freeSpinsLabel,
  };
}


