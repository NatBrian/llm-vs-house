// GameAdapter implementations: each wraps a deterministic engine into the uniform
// round loop (build observation -> ask decider -> validate -> apply -> outcome).
// The decider order + rng consumption are deterministic, so replay reproduces exactly.

import {
  spinRoulette, resolveRouletteBet, isValidRouletteBet, ROULETTE_MIN_BET, ROULETTE_ODDS,
  allSplits, allStreets, ALL_CORNERS, ALL_SIXLINES, columnNumbers, dozenNumbers,
  SERIES3_GROUPS, SERIES6_GROUPS, summarizeSpinHistory,
  type RouletteBet, type RouletteVariant, type Pocket,
  dealBaccarat, resolveBaccaratBet, BACCARAT_MIN_BET, BACCARAT_BANKER_COMMISSION,
  summarizeBaccaratHistory, type BaccaratBet, type BaccaratResult,
  rollSicBo, resolveSicBoBet, isValidSicBoBet, SICBO_MIN_BET, SICBO_TOTAL_ODDS, SICBO_ODDS,
  summarizeSicBoHistory, SICBO_THREE_FROM_FOUR_GROUPS, SICBO_DOUBLE_ANY_PAIRS,
  type SicBoBet, type Dice,
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
 * The LLM's own session ledger — total starting money, current profit/deficit,
 * and a trail of its own past rounds (what it decided and why, what actually got
 * placed after table rules, whether it won/lost, running bankroll) — fed to every
 * game so the decider can reason like a human tracking their own session, not just
 * the house's spin/roll history. `startingBankroll` is derived from the first
 * recorded round's `bankrollBefore` rather than threaded as a separate field,
 * since RoundRecord already carries it. `decisions` replays each step's exact
 * validated payload (bets/controls + its own `reasoning`) verbatim — a human
 * remembers not just "I won $50" but "I bet X because I thought Y", and it can
 * differ from `outcome` when a proposed bet got refused/clamped by table rules.
 */
function ownSessionSummary(ctx: RoundContext, window = 10): Record<string, unknown> {
  const startingBankroll = ctx.history.length ? ctx.history[0]!.bankrollBefore : ctx.bankroll;
  const recentRounds = ctx.history.slice(-window).map((r) => ({
    round: r.index + 1,
    decisions: r.steps.map((s) => s.decision), // what YOU decided + why, verbatim
    outcome: r.outcome, // what the table actually accepted/resolved
    net: r.net,
    bankrollAfter: r.bankrollAfter,
  }));
  return {
    startingBankroll,
    currentBankroll: ctx.bankroll,
    profit: ctx.bankroll - startingBankroll, // negative = deficit
    roundsPlayed: ctx.history.length,
    recentRounds, // your own decisions+reasoning, what was placed, win/lose, bankroll trail — most-recent-last
  };
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

// ---------------------------------------------------------------- Roulette
const rouletteAdapter: GameAdapter = {
  id: 'roulette',
  label: 'Roulette',
  defaultConfig: (): RouletteConfig => ({ variant: 'european' }),
  async playRound(ctx): Promise<RoundResult> {
    const config = ctx.config as RouletteConfig;
    const variant = config.variant;
    const americanOnly: RouletteBet['type'][] = ['five', 'zeroCombo'];
    const legalBetTypes = (Object.keys(ROULETTE_ODDS) as RouletteBet['type'][])
      .filter((t) => variant === 'american' || !americanOnly.includes(t));
    const priorPockets = ctx.history
      .filter((r) => r.game === 'roulette')
      .map((r) => (r.outcome as { pocket: Pocket }).pocket);
    const req: DecisionRequest = {
      kind: 'bet', game: 'roulette', index: ctx.index, bankroll: ctx.bankroll, baseBet: ctx.baseBet,
      observation: {
        variant,
        bankroll: ctx.bankroll,
        baseBet: ctx.baseBet,
        payouts: ROULETTE_ODDS,
        tableMinimums: ROULETTE_MIN_BET, // even-money outside bets cost 50; everything else 10
        legalBetTypes, // only bet types this specific table (variant) offers
        boardLayout: {
          splits: allSplits(variant),
          streets: allStreets(variant),
          corners: ALL_CORNERS,
          sixlines: ALL_SIXLINES,
          columns: { 1: columnNumbers(1), 2: columnNumbers(2), 3: columnNumbers(3) },
          dozens: { 1: dozenNumbers(1), 2: dozenNumbers(2), 3: dozenNumbers(3) },
          series3Groups: SERIES3_GROUPS, // index+1 == seriesGroup
          series6Groups: SERIES6_GROUPS, // index+1 == seriesGroup
        },
        history: summarizeSpinHistory(priorPockets, variant),
        ownSession: ownSessionSummary(ctx),
        note: 'ownSession is YOUR OWN session ledger — starting money, running profit/deficit, and '
          + 'your own past rounds (each with your exact decision + reasoning, what the table actually '
          + "accepted, win/lose, bankroll after) — separate from history's "
          + "wheel results, this is your personal track record so far. This table is " + variant + " — legalBetTypes lists exactly what's on THIS felt; a bet "
          + "type from the other table (e.g. American-only five/zeroCombo at a European table) is "
          + 'refused, same as every other illegal-cell bet. boardLayout enumerates every real split/'
          + 'street/corner/sixline/column/dozen/series group on this table — you may freely choose ANY '
          + 'entry, any bet type, any number of simultaneous bets (up to 10), any stake per bet up to '
          + "the bankroll, exactly like a human standing at the table. history gives the actual spin "
          + 'record so far (recent results, hot/cold pocket counts, current color/parity/hi-lo streak) '
          + '— you may play hunches, chase or fade streaks, or ignore it entirely; nothing here is '
          + 'predictive (each spin is independent), it is only what a real player would see on the '
          + 'roadmap board. Zero (and 00, on American tables) loses every non-zero bet outright (no '
          + 'la partage / en prison at this table). Series3/series6 are fixed wheel-sector bets '
          + 'covering the numbers listed in series3Groups/series6Groups. A stake below its bet\'s table minimum, or '
          + "numbers/selectors that don't form a real felt cell, is refused.",
      },
      schema: RouletteDecisionSchema, schemaName: 'RouletteDecision',
    };
    const { step, value } = await ask(ctx, req);
    const bets = applyRouletteTableRules(value.bets as RouletteBet[], ctx.bankroll, variant);
    const pocket = spinRoulette(ctx.rng, variant);
    const net = bets.reduce((s, b) => s + resolveRouletteBet(b, pocket), 0);
    return { steps: [step], outcome: { pocket, placedBets: bets }, net, stop: !!value.stop };
  },
};

// ---------------------------------------------------------------- Baccarat
const baccaratAdapter: GameAdapter = {
  id: 'baccarat',
  label: 'Baccarat',
  defaultConfig: (): BaccaratConfig => ({ decks: 8 }),
  async playRound(ctx): Promise<RoundResult> {
    const config = ctx.config as BaccaratConfig;
    const priorCoups = ctx.history
      .filter((r) => r.game === 'baccarat')
      .map((r) => r.outcome as { result: BaccaratResult; playerPair: boolean; bankerPair: boolean });
    const req: DecisionRequest = {
      kind: 'bet', game: 'baccarat', index: ctx.index, bankroll: ctx.bankroll, baseBet: ctx.baseBet,
      observation: {
        bankroll: ctx.bankroll, baseBet: ctx.baseBet,
        payouts: { player: 1, banker: 1 - BACCARAT_BANKER_COMMISSION, tie: 8, playerPair: 11, bankerPair: 11 },
        tableMinimums: BACCARAT_MIN_BET, // Player/Banker cost 50; Tie/Pair side bets cost 10
        roadHistory: summarizeBaccaratHistory(priorCoups),
        ownSession: ownSessionSummary(ctx),
        note: 'roadHistory is the real Big Road / Bead Plate board: recent results (newest first), '
          + '% player/banker/tie and % player-pair/banker-pair over every hand so far, and the current '
          + 'streak (ties never break or extend a streak, same as a real road) — purely descriptive '
          + '(each coup is independent, nothing here predicts the next one), play hunches (e.g. ride or '
          + 'fade a banker streak) or ignore it, your call. ownSession is your own ledger — starting '
          + 'money, running profit/deficit, your own past hands (your exact decision + reasoning, what '
          + 'was actually accepted, win/lose). Banker commission is '
          + 'paid immediately per hand (mini-baccarat convention, confirmed by MBS/RWS rule sheets — '
          + "no deferred marker). A stake below its bet's table minimum is refused.",
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
      stop: !!value.stop,
    };
  },
};

// ---------------------------------------------------------------- Sic Bo
const sicboAdapter: GameAdapter = {
  id: 'sicbo',
  label: 'Sic Bo',
  defaultConfig: (): SicBoConfig => ({ _: undefined }),
  async playRound(ctx): Promise<RoundResult> {
    const priorDice = ctx.history
      .filter((r) => r.game === 'sicbo')
      .map((r) => (r.outcome as { dice: Dice }).dice);
    const req: DecisionRequest = {
      kind: 'bet', game: 'sicbo', index: ctx.index, bankroll: ctx.bankroll, baseBet: ctx.baseBet,
      observation: {
        bankroll: ctx.bankroll, baseBet: ctx.baseBet,
        tableMinimums: SICBO_MIN_BET, // even-money bets (small/big/odd/even) cost 50; inside bets 10
        payouts: {
          small: 1, big: 1, odd: 1, even: 1,
          single: '1:1 / 2:1 / 12:1 by matching dice (3-of-a-kind pays 12, not 3)',
          combo: SICBO_ODDS.combo, double: SICBO_ODDS.double, triple: SICBO_ODDS.triple, anytriple: SICBO_ODDS.anytriple,
          doubleAny: SICBO_ODDS.doubleAny, threeSingleCombo: SICBO_ODDS.threeSingleCombo, threeFromFour: SICBO_ODDS.threeFromFour,
          total: SICBO_TOTAL_ODDS,
        },
        boardLayout: {
          // threeFromFour's `group` (1-4) and doubleAny's (face,partner) pair are felt
          // cells picked by index/pair, not free-form numbers — expose the actual
          // mapping so a choice is grounded, not a blind index guess (mirrors the
          // roulette series3/series6 fix: same class of bug, same fix).
          threeFromFourGroups: SICBO_THREE_FROM_FOUR_GROUPS, // group -> the 4 numbers it covers
          validDoubleAnyPairs: SICBO_DOUBLE_ANY_PAIRS, // every legal [face, partner] cell (28 of 30 possible pairs — (1,2)/(6,5) aren't on the felt)
        },
        diceHistory: summarizeSicBoHistory(priorDice),
        ownSession: ownSessionSummary(ctx),
        note: 'boardLayout.threeFromFourGroups tells you exactly which 4 numbers each threeFromFour '
          + 'group covers; boardLayout.validDoubleAnyPairs lists every real doubleAny felt cell — a '
          + '(face,partner) pair not in that list is refused. diceHistory is the real roadmap board: '
          + 'recent rolls (newest first), % small/big/odd/even and % any-triple over every roll so far, '
          + 'and hot/cold counts per face and per three-dice total — purely descriptive (each roll is '
          + 'independent, nothing here predicts the next one), play hunches or ignore it, your call. '
          + 'ownSession is your own ledger — starting money, running profit/deficit, your own past bets '
          + '(your exact decision + reasoning, what was actually accepted, win/lose). A stake below its '
          + 'minimum, or a bet that does not describe a real felt cell (e.g. an invented doubleAny pair), '
          + 'is refused.',
      },
      schema: SicBoDecisionSchema, schemaName: 'SicBoDecision',
    };
    const { step, value } = await ask(ctx, req);
    const bets = applySicBoTableRules(value.bets as SicBoBet[], ctx.bankroll);
    const dice = rollSicBo(ctx.rng);
    const net = bets.reduce((s, b) => s + resolveSicBoBet(b, dice), 0);
    return { steps: [step], outcome: { dice, placedBets: bets }, net, stop: !!value.stop };
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
        // The pay-glass every cabinet displays: symbol -> [3-of-a-kind, 4-of-a-kind,
        // 5-of-a-kind] multiplier of total bet, plus scatter pay and free-spins award
        // by scatter count. Without this the model can't know DRAGON x5 pays 750x
        // versus TEN x3 paying 7x — exactly the number a human reads off the glass
        // before deciding whether the top symbols are worth chasing.
        paytable: config.paytable,
        scatterPay: config.scatterPay,
        freeSpins: config.freeSpins,
        machineNote: '243-ways video slot. Choose a denomination (coin value) and a bet level '
          + '(credits per spin) — total stake = denomination x betLevel — or set betMax to slam '
          + 'the BET MAX button (highest denomination x highest level). paytable lists, per symbol, '
          + 'the "for-one" multiplier of your total bet for landing 3/4/5-of-a-kind anywhere on the '
          + 'grid (ways pay, not fixed lines) — wild substitutes for every paying symbol. scatterPay is '
          + 'the multiplier for 3/4/5 scatters landing anywhere regardless of ways; freeSpins is how '
          + 'many free spins that same scatter count also awards.',
        ownSession: ownSessionSummary(ctx),
        note: 'ownSession is your own session ledger — starting money, running profit/deficit, your '
          + 'own past spins (your exact decision + reasoning, stake actually spun, payout, bankroll '
          + 'after). denomination must be exactly one of the listed values. A resulting stake the '
          + 'bankroll cannot cover, or above the table max, is clamped down — a real cabinet would '
          + 'refuse an unaffordable or out-of-range bet the same way.',
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
      stop: !!value.stop,
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
        ownSession: ownSessionSummary(ctx),
        note: 'ownSession is your own session ledger — starting money, running profit/deficit, your '
          + 'own past hands. Choose a stake; you then play the hand action by action.',
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
