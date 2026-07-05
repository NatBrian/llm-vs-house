// GameAdapter implementations: each wraps a deterministic engine into the uniform
// round loop (build observation -> ask decider -> validate -> apply -> outcome).
// The decider order + rng consumption are deterministic, so replay reproduces exactly.

import {
  spinRoulette, resolveRouletteBet, isValidRouletteBet, ROULETTE_MIN_BET, ROULETTE_ODDS,
  type RouletteBet, type RouletteVariant,
  dealBaccarat, resolveBaccaratBet, BACCARAT_MIN_BET, BACCARAT_BANKER_COMMISSION, type BaccaratBet,
  rollSicBo, resolveSicBoBet, isValidSicBoBet, SICBO_MIN_BET, SICBO_TOTAL_ODDS, SICBO_ODDS, type SicBoBet,
  playSlot, resolveSlot, EXAMPLE_SLOT, SLOT_MIN_BET, SLOT_MAX_BET, SLOT_DENOMINATIONS, SLOT_MAX_LEVEL, SLOT_WAYS,
  type SlotConfig,
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

/**
 * Faithful Baccarat table rules: stakes are whole points, a stake below its
 * bet family's table minimum is refused, running total never exceeds the
 * bankroll. Mirrors applySicBoTableRules/applyRouletteTableRules.
 */
function applyBaccaratTableRules(bets: BaccaratBet[], bankroll: number): BaccaratBet[] {
  let remaining = bankroll;
  const out: BaccaratBet[] = [];
  for (const b of bets) {
    const min = BACCARAT_MIN_BET[b.type];
    const amt = Math.min(Math.floor(b.amount), remaining);
    if (amt < min) continue; // below table minimum (or bankroll can't cover it) -> refused
    out.push({ ...b, amount: amt });
    remaining -= amt;
  }
  return out;
}

/**
 * Faithful Sic Bo table rules for a set of placed bets:
 *   1. stakes are whole points (chips), floored;
 *   2. a stake below its family table-minimum is rejected (not accepted);
 *   3. the running total may not exceed the bankroll — a bet whose remaining
 *      budget can't cover its own table-minimum is rejected.
 * Returns the accepted bets. Mirrors how a real dealer would take/refuse chips.
 */
function applySicBoTableRules(bets: SicBoBet[], bankroll: number): SicBoBet[] {
  let remaining = bankroll;
  const out: SicBoBet[] = [];
  for (const b of bets) {
    if (!isValidSicBoBet(b)) continue; // not a real felt cell -> refused
    const min = SICBO_MIN_BET[b.type];
    const amt = Math.min(Math.floor(b.amount), remaining);
    if (amt < min) continue; // below table minimum (or bankroll can't cover it) -> refused
    out.push({ ...b, amount: amt });
    remaining -= amt;
  }
  return out;
}

const labels = (cards: Card[]): string[] => cards.map(cardLabel);

/**
 * Faithful roulette table rules: stakes are whole points, a stake below its
 * bet-type minimum is refused, a bet whose numbers don't form a real felt
 * cell/line/corner is refused, and the running total may never exceed the
 * bankroll. Mirrors applySicBoTableRules — a real dealer would refuse chips
 * the same way rather than the round erroring out.
 */
function applyRouletteTableRules(bets: RouletteBet[], bankroll: number, variant: RouletteVariant): RouletteBet[] {
  let remaining = bankroll;
  const out: RouletteBet[] = [];
  for (const b of bets) {
    if (!isValidRouletteBet(b, variant)) continue; // not a real cell/line/corner -> refused
    const min = ROULETTE_MIN_BET[b.type];
    const amt = Math.min(Math.floor(b.amount), remaining);
    if (amt < min) continue; // below table minimum (or bankroll can't cover it) -> refused
    out.push({ ...b, amount: amt });
    remaining -= amt;
  }
  return out;
}

/**
 * Per-bet-type house edge, in percent. Standard bets share the wheel's base
 * edge (2.70% European / 5.26% American — series3/series6 are mathematically
 * equivalent to street/sixline so they share it too). The American-only extras
 * are notably worse: Top Line ("five") and the dedicated 0/00 box are real
 * GRA-approved "sucker bets" a human might be tempted by despite the odds.
 */
function rouletteHouseEdgePct(variant: RouletteVariant): Partial<Record<RouletteBet['type'], number>> {
  const base = variant === 'european' ? 2.7 : 5.26;
  const standard = {
    straight: base, split: base, street: base, corner: base, sixline: base,
    column: base, dozen: base, red: base, black: base, odd: base, even: base, high: base, low: base,
    series3: base, series6: base,
  };
  if (variant !== 'american') return standard;
  return { ...standard, five: 21.05, zeroCombo: 36.84 };
}

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
        houseEdgePct: rouletteHouseEdgePct(config.variant),
        payouts: ROULETTE_ODDS,
        tableMinimums: ROULETTE_MIN_BET, // even-money outside bets cost 50; everything else 10
        note: 'Place one or more bets. Outside even-money bets minimise variance. Zero (and 00, on '
          + "American tables) loses every non-zero bet outright (no la partage / en prison at this "
          + 'table). On American tables the Top Line ("five": 0,00,1,2,3) and the dedicated 0/00 box '
          + '("zeroCombo") carry a much worse edge (21.05% / 36.84%) than any other bet on the felt — '
          + 'real, GRA-approved, but a bad deal. Series3/series6 are fixed wheel-sector bets with the '
          + "same edge as an equivalent street/sixline. A stake below its bet's table minimum, or "
          + "numbers/selectors that don't form a real felt cell, is refused.",
      },
      schema: RouletteDecisionSchema, schemaName: 'RouletteDecision',
    };
    const { step, value } = await ask(ctx, req);
    const bets = applyRouletteTableRules(value.bets as RouletteBet[], ctx.bankroll, config.variant);
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
        houseEdgePct: { banker: 1.06, player: 1.24, tie: 14.36, playerPair: 10.36, bankerPair: 10.36 },
        payouts: { player: 1, banker: 1 - BACCARAT_BANKER_COMMISSION, tie: 8, playerPair: 11, bankerPair: 11 },
        tableMinimums: BACCARAT_MIN_BET, // Player/Banker cost 50; Tie/Pair side bets cost 10
        note: 'Banker has the lowest edge (1.06%) despite 5% commission, paid immediately per hand '
          + '(mini-baccarat convention, confirmed by MBS/RWS rule sheets — no deferred marker). '
          + "A stake below its bet's table minimum is refused.",
      },
      schema: BaccaratDecisionSchema, schemaName: 'BaccaratDecision',
    };
    const { step, value } = await ask(ctx, req);
    const bets = applyBaccaratTableRules(value.bets as BaccaratBet[], ctx.bankroll);
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
        houseEdgePct: {
          small: 2.78, big: 2.78, odd: 2.78, even: 2.78,
          single: 3.7, combo: 2.78, double: 11.11, triple: 16.2, anytriple: 11.11,
          doubleAny: 29.17, threeSingleCombo: 13.89, threeFromFour: 11.11,
        },
        tableMinimums: SICBO_MIN_BET, // even-money bets (small/big/odd/even) cost 50; inside bets 10
        payouts: {
          small: 1, big: 1, odd: 1, even: 1,
          single: '1:1 / 2:1 / 12:1 by matching dice (3-of-a-kind pays 12, not 3)',
          combo: SICBO_ODDS.combo, double: SICBO_ODDS.double, triple: SICBO_ODDS.triple, anytriple: SICBO_ODDS.anytriple,
          doubleAny: SICBO_ODDS.doubleAny, threeSingleCombo: SICBO_ODDS.threeSingleCombo, threeFromFour: SICBO_ODDS.threeFromFour,
          total: SICBO_TOTAL_ODDS,
        },
        note: 'Small/Big/Odd/Even (2.78%) and a matching single-number bet (3.70%, thanks to the 12:1 '
          + 'triple-match payout) are the best bets on this table; the 50:1 doubleAny bet has the worst '
          + 'edge (29.17%) despite the flashy payout. A stake below its minimum, or a bet that does not '
          + "describe a real felt cell (e.g. an invented doubleAny pair), is refused.",
      },
      schema: SicBoDecisionSchema, schemaName: 'SicBoDecision',
    };
    const { step, value } = await ask(ctx, req);
    const bets = applySicBoTableRules(value.bets as SicBoBet[], ctx.bankroll);
    const dice = rollSicBo(ctx.rng);
    const net = bets.reduce((s, b) => s + resolveSicBoBet(b, dice), 0);
    return { steps: [step], outcome: { dice, placedBets: bets }, net };
  },
};

/**
 * Turns the decider's chosen machine controls (denomination x bet level, or BET MAX)
 * into a clamped integer stake. Floor is table-minimum-or-bankroll (whichever is
 * smaller, so a bankroll below the minimum never produces a bet bigger than itself),
 * ceiling is bet-max-or-bankroll — mirrors how the other games' table rules refuse an
 * unaffordable or out-of-range stake rather than erroring the round out.
 */
function resolveSlotBetControls(value: { denomination: number; betLevel: number; betMax?: boolean }, bankroll: number): number {
  const raw = value.betMax ? SLOT_MAX_BET : value.denomination * value.betLevel;
  const floor = Math.min(SLOT_MIN_BET, bankroll);
  const ceiling = Math.min(Math.floor(raw), SLOT_MAX_BET, bankroll);
  return Math.max(floor, ceiling);
}

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
        machine: {
          reels: 5, ways: SLOT_WAYS, wild: config.wild, scatter: config.scatter,
          denominations: SLOT_DENOMINATIONS, maxBetLevel: SLOT_MAX_LEVEL,
          minBet: SLOT_MIN_BET, maxBet: SLOT_MAX_BET,
        },
        rtpNote: '243-ways video slot, ~93.9% RTP, 6.1% house edge (SG GRA floor is 90%). '
          + 'Choose a denomination (coin value) and a bet level (credits per spin) — total '
          + 'stake = denomination x betLevel — or set betMax to slam the BET MAX button '
          + '(highest denomination x highest level). Scatters pay anywhere and can award free spins.',
        note: 'denomination must be exactly one of the listed values. A resulting stake the '
          + 'bankroll cannot cover, or above the table max, is clamped down — a real cabinet '
          + 'would refuse an unaffordable or out-of-range bet the same way.',
      },
      schema: SlotDecisionSchema, schemaName: 'SlotDecision',
    };
    const { step, value } = await ask(ctx, req);
    const amount = resolveSlotBetControls(value, ctx.bankroll);
    const round = playSlot(ctx.rng, config);
    const net = resolveSlot(round, amount);
    return {
      steps: [step],
      outcome: {
        mainSpin: round.mainSpin, bonusSpins: round.bonusSpins, totalPayout: round.totalPayout,
        amount, denomination: value.denomination, betLevel: value.betLevel, betMax: !!value.betMax,
      },
      net,
    };
  },
};

// ---------------------------------------------------------------- Blackjack (DEPRECATED)
// Excluded from GAME_IDS (index.ts) — kept working and tested, but unreachable
// from the UI. See engine/types.ts for why (skill component doesn't fit this
// project's pure-chance / negative-EV thesis).
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
