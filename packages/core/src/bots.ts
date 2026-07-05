// Rule-based baseline decider. Plays every game with a simple, defensible strategy
// and emits human-readable reasoning — so the reasoning trace has content even with
// no LLM, and the deployed demo runs with zero API keys. Also the "baseline bot" the
// brief calls for to compare an LLM against.

import { SICBO_MIN_BET } from '@casino/engine';
import type { Decide, DecisionRequest } from './types.js';

/** Deterministic PRNG seeded per round, so the naive bot replays bit-for-bit. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function blackjackBasic(req: DecisionRequest): { action: string; reasoning: string } {
  const legal = req.legalActions ?? [];
  const o = req.observation as any;

  if (legal.includes('decline-insurance')) {
    return { action: 'decline-insurance', reasoning: 'Insurance is a negative-EV side bet (~6% edge); decline.' };
  }
  const total: number = o.player.total;
  const soft: boolean = o.player.soft;
  const up: number = o.dealerUpcard.value;

  if (legal.includes('split')) {
    const pv: number = o.player.pairValue;
    if (pv === 1) return { action: 'split', reasoning: 'Always split aces.' };
    if (pv === 8) return { action: 'split', reasoning: 'Always split eights.' };
  }
  if (legal.includes('double') && !soft) {
    if (total === 11) return { action: 'double', reasoning: 'Double hard 11 — strongest doubling spot.' };
    if (total === 10 && up <= 9) return { action: 'double', reasoning: `Double hard 10 vs dealer ${up}.` };
  }
  if (soft) {
    if (total >= 19) return pick(legal, 'stand', `Stand soft ${total}.`);
    if (total <= 17) return pick(legal, 'hit', `Hit soft ${total} — free to improve.`);
    return pick(legal, 'stand', `Stand soft ${total}.`);
  }
  if (total >= 17) return pick(legal, 'stand', `Stand hard ${total}.`);
  if (total <= 11) return pick(legal, 'hit', `Hit hard ${total} — cannot bust.`);
  if (up >= 7) return pick(legal, 'hit', `Hit ${total} vs strong dealer ${up}.`);
  return pick(legal, 'stand', `Stand ${total} vs weak dealer ${up}; let the dealer risk busting.`);
}

function pick(legal: string[], want: string, reasoning: string): { action: string; reasoning: string } {
  return { action: legal.includes(want) ? want : (legal[0] ?? 'stand'), reasoning };
}

export const baselineDecide: Decide = async (req) => {
  const bet = req.baseBet;
  switch (req.game) {
    case 'roulette':
      return { value: { bets: [{ type: 'red', amount: bet }], reasoning: 'Flat even-money bet on red — lowest variance at the table minimum (European edge 2.70%).' } };
    case 'baccarat':
      return { value: { bets: [{ type: 'banker', amount: bet }], reasoning: 'Bet Banker: lowest house edge (1.06%) even after the 5% commission.' } };
    case 'sicbo': {
      // Small is the best bet but carries the 50-point even-money minimum; stake
      // the table minimum (or the base bet if that is somehow higher).
      const stake = Math.max(SICBO_MIN_BET.small, bet);
      return { value: { bets: [{ type: 'small', amount: stake }], reasoning: `Bet Small at the ${SICBO_MIN_BET.small}-point table minimum: 2.78% edge, the best value on the Sic Bo table.` } };
    }
    case 'slot':
      return { value: { amount: bet, reasoning: 'Flat base stake; slots are pure chance (~93% RTP), so bet size is the only lever.' } };
    case 'blackjack':
      if (req.kind === 'bet') {
        return { value: { amount: bet, reasoning: 'Flat base stake; edge comes from correct play, not bet sizing.' } };
      }
      return { value: blackjackBasic(req) };
  }
};

export const BASELINE_DECIDER_ID = 'baseline';

// ---------------------------------------------------------------- naive human
// A casual player: spreads several bets across the Sic Bo board with no regard
// for house edge — an even-money bet, a couple of single numbers, maybe a total
// or a triple "for fun". It always respects the table minimums and never stakes
// more than the bankroll. Deterministic per round (seeded by the round index)
// so sessions still replay exactly. Non–Sic Bo games fall back to the baseline.

/** Build one random, well-formed Sic Bo bet of the given family at `amount`. */
function randomSicBoBet(type: string, amount: number, rnd: () => number): any {
  const face = () => 1 + Math.floor(rnd() * 6);
  switch (type) {
    case 'total': return { type, amount, total: 4 + Math.floor(rnd() * 14) }; // 4..17
    case 'single': return { type, amount, face: face() };
    case 'double': return { type, amount, face: face() };
    case 'triple': return { type, amount, face: face() };
    case 'combo': {
      const a = face();
      let b = face();
      if (b === a) b = (a % 6) + 1; // force two distinct faces
      return { type, amount, faces: [a, b] };
    }
    default: return { type, amount }; // small / big / odd / even / anytriple
  }
}

const NAIVE_SICBO_FAMILIES = ['small', 'big', 'odd', 'even', 'total', 'single', 'combo', 'double', 'triple', 'anytriple'];

function naiveSicBo(req: DecisionRequest): { bets: any[]; reasoning: string } {
  const rnd = mulberry32(req.index * 2654435761 + 1);
  let remaining = req.bankroll;
  const bets: any[] = [];
  const spread = 2 + Math.floor(rnd() * 4); // 2..5 bets, like a human spraying the table

  for (let i = 0; i < spread && bets.length < 8; i++) {
    const type = NAIVE_SICBO_FAMILIES[Math.floor(rnd() * NAIVE_SICBO_FAMILIES.length)]!;
    const min = SICBO_MIN_BET[type as keyof typeof SICBO_MIN_BET];
    if (remaining < min) continue; // can't afford this family's minimum — skip it
    const units = 1 + Math.floor(rnd() * 4); // 1..4 chips above the minimum
    const amount = Math.min(min * units, remaining);
    if (amount < min) continue;
    bets.push(randomSicBoBet(type, amount, rnd));
    remaining -= amount;
  }

  // Guarantee at least one bet: fall back to the cheapest affordable inside bet.
  if (bets.length === 0) {
    const cheapest = Math.min(...Object.values(SICBO_MIN_BET));
    bets.push(randomSicBoBet('single', Math.min(cheapest, req.bankroll || cheapest), rnd));
  }
  const staked = bets.reduce((s, b) => s + b.amount, 0);
  return { bets, reasoning: `Casual spread of ${bets.length} bets (${staked} pts) across the table — no edge discipline, just playing hunches.` };
}

export const naiveDecide: Decide = async (req) => {
  if (req.game === 'sicbo' && req.kind === 'bet') {
    return { value: naiveSicBo(req) };
  }
  return baselineDecide(req); // other games: reuse the disciplined baseline
};

export const NAIVE_DECIDER_ID = 'naive';
