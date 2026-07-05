// GameAdapter implementations: each wraps a deterministic engine into the uniform
// round loop (build observation -> ask decider -> validate -> apply -> outcome).
// The decider order + rng consumption are deterministic, so replay reproduces exactly.

import {
  spinRoulette, resolveRouletteBet, type RouletteBet, type RouletteVariant,
  dealBaccarat, resolveBaccaratBet, type BaccaratBet,
  rollSicBo, resolveSicBoBet, type SicBoBet,
  spinSlot, resolveSlot, EXAMPLE_SLOT, type SlotConfig,
  startBlackjack, legalActions, applyAction, handValue,
  DEFAULT_BLACKJACK_RULES, type BlackjackRules, type BlackjackState, type BlackjackAction,
  cardLabel, type Card,
} from '@casino/engine';
import {
  RouletteDecisionSchema, BaccaratDecisionSchema, SicBoDecisionSchema,
  SlotDecisionSchema, BlackjackBetSchema, BlackjackActionSchema,
} from './schemas.js';
import type {
  GameAdapter, RoundContext, RoundResult, DecisionRequest, DecisionStep,
} from './types.js';

export interface RouletteConfig { variant: RouletteVariant }
export interface BaccaratConfig { decks: number }
export interface SicBoConfig { _: never | undefined }
export type SlotGameConfig = SlotConfig;
export type BlackjackConfig = BlackjackRules;

/** Ask the decider, validate against the request schema, build a recorded step. */
async function ask(ctx: RoundContext, req: DecisionRequest): Promise<{ step: DecisionStep; value: any }> {
  const res = await ctx.decide(req);
  const parsed: any = req.schema.parse(res.value); // throws on schema violation
  const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : '';
  const step: DecisionStep = {
    kind: req.kind,
    observation: req.observation,
    ...(req.legalActions ? { legalActions: req.legalActions } : {}),
    decision: parsed,
    reasoning,
    ...(res.raw !== undefined ? { raw: res.raw } : {}),
    ...(res.meta !== undefined ? { meta: res.meta } : {}),
  };
  return { step, value: parsed };
}

/** Clamp bet amounts so total staked never exceeds the bankroll. */
function clampBets<T extends { amount: number }>(bets: T[], bankroll: number): T[] {
  let remaining = bankroll;
  const out: T[] = [];
  for (const b of bets) {
    const amt = Math.max(0, Math.min(Math.floor(b.amount), remaining));
    if (amt <= 0) continue;
    out.push({ ...b, amount: amt });
    remaining -= amt;
  }
  return out;
}

const labels = (cards: Card[]): string[] => cards.map(cardLabel);

// ---------------------------------------------------------------- Roulette
const rouletteAdapter: GameAdapter = {
  id: 'roulette',
  label: 'Roulette',
  defaultConfig: (): RouletteConfig => ({ variant: 'european' }),
  async playRound(ctx): Promise<RoundResult> {
    const config = ctx.config as RouletteConfig;
    const req: DecisionRequest = {
      kind: 'bet', game: 'roulette', index: ctx.index, bankroll: ctx.bankroll, baseBet: ctx.baseBet,
      observation: {
        variant: config.variant,
        bankroll: ctx.bankroll,
        baseBet: ctx.baseBet,
        houseEdgePct: config.variant === 'european' ? 2.7 : 5.26,
        note: 'Place one or more bets. Outside even-money bets minimise variance.',
      },
      schema: RouletteDecisionSchema, schemaName: 'RouletteDecision',
    };
    const { step, value } = await ask(ctx, req);
    const bets = clampBets(value.bets as RouletteBet[], ctx.bankroll);
    const pocket = spinRoulette(ctx.rng, config.variant);
    const net = bets.reduce((s, b) => s + resolveRouletteBet(b, pocket), 0);
    return { steps: [step], outcome: { pocket, placedBets: bets }, net };
  },
};

// ---------------------------------------------------------------- Baccarat
const baccaratAdapter: GameAdapter = {
  id: 'baccarat',
  label: 'Baccarat',
  defaultConfig: (): BaccaratConfig => ({ decks: 8 }),
  async playRound(ctx): Promise<RoundResult> {
    const config = ctx.config as BaccaratConfig;
    const req: DecisionRequest = {
      kind: 'bet', game: 'baccarat', index: ctx.index, bankroll: ctx.bankroll, baseBet: ctx.baseBet,
      observation: {
        bankroll: ctx.bankroll, baseBet: ctx.baseBet,
        houseEdgePct: { banker: 1.06, player: 1.24, tie: 14.36 },
        note: 'Banker has the lowest edge (1.06%) despite 5% commission.',
      },
      schema: BaccaratDecisionSchema, schemaName: 'BaccaratDecision',
    };
    const { step, value } = await ask(ctx, req);
    const bets = clampBets(value.bets as BaccaratBet[], ctx.bankroll);
    const coup = dealBaccarat(ctx.rng, config.decks);
    const net = bets.reduce((s, b) => s + resolveBaccaratBet(b, coup), 0);
    return {
      steps: [step],
      outcome: {
        player: labels(coup.player), banker: labels(coup.banker),
        playerTotal: coup.playerTotal, bankerTotal: coup.bankerTotal,
        result: coup.result, playerPair: coup.playerPair, bankerPair: coup.bankerPair,
        placedBets: bets,
      },
      net,
    };
  },
};

// ---------------------------------------------------------------- Sic Bo
const sicboAdapter: GameAdapter = {
  id: 'sicbo',
  label: 'Sic Bo',
  defaultConfig: (): SicBoConfig => ({ _: undefined }),
  async playRound(ctx): Promise<RoundResult> {
    const req: DecisionRequest = {
      kind: 'bet', game: 'sicbo', index: ctx.index, bankroll: ctx.bankroll, baseBet: ctx.baseBet,
      observation: {
        bankroll: ctx.bankroll, baseBet: ctx.baseBet,
        houseEdgePct: { small: 2.78, big: 2.78, anytriple: 13.89 },
        note: 'Small/Big (2.78%) are the best bets; totals & triples pay more but cost more edge.',
      },
      schema: SicBoDecisionSchema, schemaName: 'SicBoDecision',
    };
    const { step, value } = await ask(ctx, req);
    const bets = clampBets(value.bets as SicBoBet[], ctx.bankroll);
    const dice = rollSicBo(ctx.rng);
    const net = bets.reduce((s, b) => s + resolveSicBoBet(b, dice), 0);
    return { steps: [step], outcome: { dice, placedBets: bets }, net };
  },
};

// ---------------------------------------------------------------- Slot
const slotAdapter: GameAdapter = {
  id: 'slot',
  label: 'Slot Machine',
  defaultConfig: (): SlotGameConfig => EXAMPLE_SLOT,
  async playRound(ctx): Promise<RoundResult> {
    const config = ctx.config as SlotGameConfig;
    const req: DecisionRequest = {
      kind: 'bet', game: 'slot', index: ctx.index, bankroll: ctx.bankroll, baseBet: ctx.baseBet,
      observation: {
        bankroll: ctx.bankroll, baseBet: ctx.baseBet,
        rtpNote: 'Pure chance, ~93% RTP. Only decision is stake size.',
      },
      schema: SlotDecisionSchema, schemaName: 'SlotDecision',
    };
    const { step, value } = await ask(ctx, req);
    const amount = Math.max(1, Math.min(Math.floor(value.amount), ctx.bankroll));
    const spin = spinSlot(ctx.rng, config);
    const net = resolveSlot(spin, amount);
    return { steps: [step], outcome: { symbols: spin.symbols, payout: spin.payout, amount }, net };
  },
};

// ---------------------------------------------------------------- Blackjack
function observeBlackjack(state: BlackjackState): Record<string, unknown> {
  const hand = state.hands[state.active];
  const cards = hand ? hand.cards : [];
  const hv = handValue(cards);
  const isPair = cards.length === 2 && (cards[0]!.rank >= 10 ? 10 : cards[0]!.rank) === (cards[1]!.rank >= 10 ? 10 : cards[1]!.rank);
  const up = state.dealer[0]!;
  return {
    phase: state.phase,
    activeHand: state.active,
    handCount: state.hands.length,
    player: {
      cards: labels(cards),
      total: hv.total,
      soft: hv.soft,
      isPair,
      pairValue: isPair ? (cards[0]!.rank >= 10 ? 10 : cards[0]!.rank) : null,
    },
    dealerUpcard: { label: cardLabel(up), value: up.rank >= 10 ? 10 : up.rank },
    allHands: state.hands.map((h) => ({ cards: labels(h.cards), total: handValue(h.cards).total, bet: h.bet })),
  };
}

const blackjackAdapter: GameAdapter = {
  id: 'blackjack',
  label: 'Blackjack',
  defaultConfig: (): BlackjackConfig => DEFAULT_BLACKJACK_RULES,
  async playRound(ctx): Promise<RoundResult> {
    const rules = ctx.config as BlackjackConfig;
    const steps: DecisionStep[] = [];

    const betReq: DecisionRequest = {
      kind: 'bet', game: 'blackjack', index: ctx.index, bankroll: ctx.bankroll, baseBet: ctx.baseBet,
      observation: {
        bankroll: ctx.bankroll, baseBet: ctx.baseBet,
        rules: { decks: rules.decks, dealerHitsSoft17: rules.dealerHitsSoft17, blackjackPayout: rules.blackjackPayout },
        note: 'Choose a stake; you then play the hand action by action.',
      },
      schema: BlackjackBetSchema, schemaName: 'BlackjackBet',
    };
    const bet = await ask(ctx, betReq);
    steps.push(bet.step);
    const amount = Math.max(1, Math.min(Math.floor(bet.value.amount), ctx.bankroll));

    const state = startBlackjack(ctx.rng, rules, amount);
    let guard = 0;
    while (state.phase !== 'settled') {
      const legal = legalActions(state);
      const actReq: DecisionRequest = {
        kind: 'action', game: 'blackjack', index: ctx.index, bankroll: ctx.bankroll, baseBet: ctx.baseBet,
        observation: observeBlackjack(state),
        legalActions: legal,
        schema: BlackjackActionSchema, schemaName: 'BlackjackAction',
      };
      const res = await ask(ctx, actReq);
      // Fallback to a legal move if the decider proposed an illegal one — deterministic,
      // so replay reproduces the same applied action.
      const applied: BlackjackAction = legal.includes(res.value.action) ? res.value.action : legal[0]!;
      res.step.meta = { ...(res.step.meta ?? {}), appliedAction: applied };
      steps.push(res.step);
      applyAction(state, applied);
      if (++guard > 100) break;
    }

    return {
      steps,
      outcome: {
        dealer: labels(state.dealer),
        dealerTotal: handValue(state.dealer).total,
        hands: state.hands.map((h) => ({
          cards: labels(h.cards), total: handValue(h.cards).total, bet: h.bet,
          busted: h.busted, surrendered: h.surrendered, doubled: h.doubled,
        })),
        settlement: state.settlement,
      },
      net: state.settlement?.total ?? 0,
    };
  },
};

export const ADAPTERS: Record<string, GameAdapter> = {
  roulette: rouletteAdapter,
  baccarat: baccaratAdapter,
  sicbo: sicboAdapter,
  slot: slotAdapter,
  blackjack: blackjackAdapter,
};

export const GAME_LABELS: Record<string, string> = Object.fromEntries(
  Object.values(ADAPTERS).map((a) => [a.id, a.label]),
);
