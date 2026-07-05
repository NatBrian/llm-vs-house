// Blackjack engine — the only game with intra-hand decisions. Modelled as a step
// machine: startBlackjack() deals, applyAction() advances one decision, until phase
// 'settled'. The LLM (or a strategy fn) supplies one legal action at a time.
// Rules + payouts verified against docs/PAYOUTS.md.

import type { Rng } from '../rng.js';
import { type Card, Shoe } from './cards.js';

export interface BlackjackRules {
  decks: number;
  dealerHitsSoft17: boolean; // false = S17 (baseline)
  blackjackPayout: number;   // 1.5 = 3:2
  doubleAfterSplit: boolean;
  maxSplitHands: number;     // e.g. 4
  surrender: 'none' | 'late';
}

export const DEFAULT_BLACKJACK_RULES: BlackjackRules = {
  decks: 6,
  dealerHitsSoft17: false,
  blackjackPayout: 1.5,
  doubleAfterSplit: true,
  maxSplitHands: 4,
  surrender: 'none',
};

export type BlackjackAction =
  | 'hit' | 'stand' | 'double' | 'split' | 'surrender'
  | 'insurance' | 'decline-insurance';

export type BlackjackPhase = 'insurance' | 'player' | 'settled';

export interface BlackjackHand {
  cards: Card[];
  bet: number;        // doubles when doubled
  doubled: boolean;
  stood: boolean;
  surrendered: boolean;
  fromSplit: boolean;
  splitAce: boolean;  // split aces receive exactly one card each
  busted: boolean;
}

export interface BlackjackSettlement {
  handNets: number[];
  insuranceNet: number;
  total: number;
}

export interface BlackjackState {
  rules: BlackjackRules;
  shoe: Shoe;
  baseBet: number;
  dealer: Card[];      // dealer[0] = upcard, dealer[1] = hole
  hands: BlackjackHand[];
  active: number;
  phase: BlackjackPhase;
  insuranceBet: number;
  settlement?: BlackjackSettlement;
}

function bjCardValue(c: Card): number {
  return c.rank >= 10 ? 10 : c.rank; // ace = 1 here, upgraded in handValue
}

/** Best total <= 21 counting aces flexibly; `soft` = an ace is currently worth 11. */
export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += bjCardValue(c);
    if (c.rank === 1) aces++;
  }
  let soft = false;
  if (aces > 0 && total + 10 <= 21) { total += 10; soft = true; }
  return { total, soft };
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

function newHand(cards: Card[], bet: number, fromSplit = false, splitAce = false): BlackjackHand {
  return { cards, bet, doubled: false, stood: false, surrendered: false, fromSplit, splitAce, busted: false };
}

function handDone(h: BlackjackHand): boolean {
  return h.stood || h.busted || h.surrendered;
}

export function startBlackjack(rng: Rng, rules: BlackjackRules, bet: number): BlackjackState {
  return startBlackjackFromShoe(Shoe.shuffled(rules.decks, rng), rules, bet);
}

/** Same as startBlackjack but with a caller-supplied shoe (deterministic scenario tests). */
export function startBlackjackFromShoe(shoe: Shoe, rules: BlackjackRules, bet: number): BlackjackState {
  const p1 = shoe.draw();
  const d1 = shoe.draw();
  const p2 = shoe.draw();
  const d2 = shoe.draw();
  const state: BlackjackState = {
    rules, shoe, baseBet: bet,
    dealer: [d1, d2],
    hands: [newHand([p1, p2], bet)],
    active: 0,
    phase: 'player',
    insuranceBet: 0,
  };
  if (d1.rank === 1) {
    state.phase = 'insurance'; // upcard Ace => insurance offered before peek
    return state;
  }
  resolveNaturals(state);
  return state;
}

/** After the deal / insurance decision: peek for dealer BJ and player naturals. */
function resolveNaturals(state: BlackjackState): void {
  const up = state.dealer[0]!;
  const dealerCanBJ = up.rank === 1 || bjCardValue(up) === 10;
  const dealerBJ = dealerCanBJ && isBlackjack(state.dealer);
  const playerBJ = isBlackjack(state.hands[0]!.cards);
  if (dealerBJ || playerBJ) {
    settle(state);
    return;
  }
  state.phase = 'player';
}

export function legalActions(state: BlackjackState): BlackjackAction[] {
  if (state.phase === 'insurance') return ['insurance', 'decline-insurance'];
  if (state.phase !== 'player') return [];
  const h = state.hands[state.active];
  if (!h || handDone(h)) return [];
  const actions: BlackjackAction[] = ['hit', 'stand'];
  const twoCards = h.cards.length === 2;
  if (twoCards && (!h.fromSplit || state.rules.doubleAfterSplit)) actions.push('double');
  const canSplit =
    twoCards && !h.splitAce &&
    bjCardValue(h.cards[0]!) === bjCardValue(h.cards[1]!) &&
    state.hands.length < state.rules.maxSplitHands;
  if (canSplit) actions.push('split');
  if (state.rules.surrender === 'late' && twoCards && !h.fromSplit && state.hands.length === 1) {
    actions.push('surrender');
  }
  return actions;
}

export function applyAction(state: BlackjackState, action: BlackjackAction): BlackjackState {
  if (!legalActions(state).includes(action)) {
    throw new Error(`illegal action '${action}' in phase '${state.phase}'`);
  }
  if (state.phase === 'insurance') {
    state.insuranceBet = action === 'insurance' ? state.baseBet / 2 : 0;
    resolveNaturals(state);
    return state;
  }

  const h = state.hands[state.active]!;
  switch (action) {
    case 'hit': {
      h.cards.push(state.shoe.draw());
      if (handValue(h.cards).total > 21) h.busted = true;
      else if (handValue(h.cards).total === 21) h.stood = true;
      break;
    }
    case 'stand':
      h.stood = true;
      break;
    case 'double': {
      h.bet *= 2;
      h.doubled = true;
      h.cards.push(state.shoe.draw());
      if (handValue(h.cards).total > 21) h.busted = true;
      else h.stood = true;
      break;
    }
    case 'surrender':
      h.surrendered = true;
      break;
    case 'split': {
      const isAce = h.cards[0]!.rank === 1;
      const c0 = h.cards[0]!;
      const c1 = h.cards[1]!;
      const first = newHand([c0, state.shoe.draw()], state.baseBet, true, isAce);
      const second = newHand([c1, state.shoe.draw()], state.baseBet, true, isAce);
      if (isAce) { first.stood = true; second.stood = true; } // split aces: one card each
      else {
        if (handValue(first.cards).total === 21) first.stood = true;
        if (handValue(second.cards).total === 21) second.stood = true;
      }
      state.hands.splice(state.active, 1, first, second);
      break;
    }
  }
  advanceActive(state);
  return state;
}

function advanceActive(state: BlackjackState): void {
  let i = state.active;
  while (i < state.hands.length && handDone(state.hands[i]!)) i++;
  if (i >= state.hands.length) {
    dealerPlayAndSettle(state);
  } else {
    state.active = i;
  }
}

function dealerPlayAndSettle(state: BlackjackState): void {
  const anyLive = state.hands.some((h) => !h.busted && !h.surrendered);
  if (anyLive) {
    // Dealer draws to 17; hits soft 17 only if configured.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { total, soft } = handValue(state.dealer);
      if (total < 17) { state.dealer.push(state.shoe.draw()); continue; }
      if (total === 17 && soft && state.rules.dealerHitsSoft17) { state.dealer.push(state.shoe.draw()); continue; }
      break;
    }
  }
  settle(state);
}

function settle(state: BlackjackState): void {
  const dealerBJ = isBlackjack(state.dealer);
  const dealerTotal = handValue(state.dealer).total;
  const dealerBust = dealerTotal > 21;

  const handNets = state.hands.map((h) => {
    if (h.surrendered) return -h.bet / 2;
    if (h.busted) return -h.bet;
    const playerBJ = isBlackjack(h.cards) && !h.fromSplit;
    if (playerBJ) {
      if (dealerBJ) return 0;                       // both natural => push
      return h.bet * state.rules.blackjackPayout;    // 3:2
    }
    if (dealerBJ) return -h.bet;                     // dealer natural beats a non-natural
    if (dealerBust) return h.bet;
    const total = handValue(h.cards).total;
    if (total > dealerTotal) return h.bet;
    if (total < dealerTotal) return -h.bet;
    return 0; // push
  });

  const insuranceNet = state.insuranceBet > 0
    ? (dealerBJ ? state.insuranceBet * 2 : -state.insuranceBet)
    : 0;

  const total = handNets.reduce((a, b) => a + b, 0) + insuranceNet;
  state.settlement = { handNets, insuranceNet, total };
  state.phase = 'settled';
}

/** Convenience: play a whole hand with a strategy fn (used by tests + LLM-loop reference). */
export function playBlackjack(
  rng: Rng,
  rules: BlackjackRules,
  bet: number,
  strategy: (state: BlackjackState, legal: BlackjackAction[]) => BlackjackAction,
): { state: BlackjackState; net: number } {
  const state = startBlackjack(rng, rules, bet);
  let guard = 0;
  while (state.phase !== 'settled') {
    const legal = legalActions(state);
    if (legal.length === 0) throw new Error(`no legal actions in phase ${state.phase}`);
    state.active = state.hands.findIndex((h) => !handDone(h)) === -1 ? state.active : state.active;
    applyAction(state, strategy(state, legal));
    if (++guard > 500) throw new Error('blackjack loop guard tripped');
  }
  return { state, net: state.settlement!.total };
}
