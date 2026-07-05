// Rule-based baseline decider. Plays every game with a simple, defensible strategy
// and emits human-readable reasoning — so the reasoning trace has content even with
// no LLM, and the deployed demo runs with zero API keys. Also the "baseline bot" the
// brief calls for to compare an LLM against.

import type { Decide, DecisionRequest } from './types.js';

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
    case 'sicbo':
      return { value: { bets: [{ type: 'small', amount: bet }], reasoning: 'Bet Small: 2.78% edge, the best value on the Sic Bo table.' } };
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
