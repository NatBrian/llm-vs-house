// Rule-based baseline decider. Plays every game with a simple, defensible strategy
// and emits human-readable reasoning, so the reasoning trace has content even with
// no LLM, and the deployed demo runs with zero API keys. Also the "baseline bot" the
// brief calls for to compare an LLM against.
//
// The rule bot's bet choice and stake-sizing strategy are both human-configurable
// (see RuleBotConfig / makeRuleBot below), a human picks a fixed bet (e.g. always
// Black, always Total 9) and a sizing strategy (flat / martingale / paroli), then
// watches how that specific rule performs over a session.

import {
  SICBO_MIN_BET, ROULETTE_MIN_BET, BACCARAT_MIN_BET, type RouletteBetType, type RouletteVariant,
  type BaccaratBetType, type SicBoBetType,
  SLOT_DENOMINATIONS, SLOT_MAX_LEVEL, SLOT_MIN_BET, SLOT_MAX_BET,
  SICBO_DOUBLE_ANY_PAIRS, SERIES3_GROUPS, SERIES6_GROUPS,
} from '@casino/engine';
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

/** DEPRECATED, Blackjack basic strategy. Excluded from GAME_IDS (index.ts), kept
 *  working/tested but unreachable from the UI. See engine/types.ts for why. */
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
    if (total === 11) return { action: 'double', reasoning: 'Double hard 11, strongest doubling spot.' };
    if (total === 10 && up <= 9) return { action: 'double', reasoning: `Double hard 10 vs dealer ${up}.` };
  }
  if (soft) {
    if (total >= 19) return pick(legal, 'stand', `Stand soft ${total}.`);
    if (total <= 17) return pick(legal, 'hit', `Hit soft ${total}, free to improve.`);
    return pick(legal, 'stand', `Stand soft ${total}.`);
  }
  if (total >= 17) return pick(legal, 'stand', `Stand hard ${total}.`);
  if (total <= 11) return pick(legal, 'hit', `Hit hard ${total}, cannot bust.`);
  if (up >= 7) return pick(legal, 'hit', `Hit ${total} vs strong dealer ${up}.`);
  return pick(legal, 'stand', `Stand ${total} vs weak dealer ${up}; let the dealer risk busting.`);
}

function pick(legal: string[], want: string, reasoning: string): { action: string; reasoning: string } {
  return { action: legal.includes(want) ? want : (legal[0] ?? 'stand'), reasoning };
}

// ---------------------------------------------------------------- configurable rule bot

export type SizingStrategy = 'flat' | 'martingale' | 'paroli';

export interface RuleBotConfig {
  /** Fixed bet the bot flat-stakes every roulette round. */
  roulette: { type: RouletteBetType; numbers?: (number | '00')[]; selector?: 1 | 2 | 3; seriesGroup?: number };
  /** Fixed bet the bot flat-stakes every baccarat round. */
  baccarat: { type: BaccaratBetType };
  /** Fixed bet the bot flat-stakes every Sic Bo round. */
  sicbo: {
    type: SicBoBetType; face?: number; total?: number; faces?: [number, number];
    partner?: number; triple?: [number, number, number]; group?: number;
  };
  /** Fixed machine controls the bot starts from every Slot round (denomination x betLevel = base unit stake). */
  slot: { denomination: number; betLevel: number; useMax?: boolean };
  /** Stake-sizing progression applied on top of the chosen bet (all games). */
  sizing: SizingStrategy;
}

export const DEFAULT_RULE_BOT_CONFIG: RuleBotConfig = {
  roulette: { type: 'red' },
  baccarat: { type: 'banker' },
  sicbo: { type: 'small' },
  slot: { denomination: 1, betLevel: 10 },
  sizing: 'flat',
};

/** Closest achievable (denomination, betLevel) combination to a target stake, used
 *  by both the rule bot (after its sizing strategy scales the base unit) and the
 *  naive bot (after its reactive mood picks a target). Shared so "which physical
 *  control combination best hits this number" isn't implemented twice. */
export function pickBetControls(target: number): { denomination: number; betLevel: number } {
  let best: { denomination: number; betLevel: number } = { denomination: SLOT_DENOMINATIONS[0], betLevel: 1 };
  let bestDiff = Infinity;
  for (const denomination of SLOT_DENOMINATIONS) {
    const betLevel = Math.max(1, Math.min(SLOT_MAX_LEVEL, Math.round(target / denomination)));
    const diff = Math.abs(denomination * betLevel - target);
    if (diff < bestDiff) { bestDiff = diff; best = { denomination, betLevel }; }
  }
  return best;
}

const ROULETTE_LABEL: Record<RouletteBetType, string> = {
  straight: 'Straight', split: 'Split', street: 'Street', corner: 'Corner', sixline: 'Six Line',
  column: 'Column', dozen: 'Dozen', red: 'Red', black: 'Black', odd: 'Odd', even: 'Even',
  high: 'High (19-36)', low: 'Low (1-18)', five: 'Top Line (0/00/1/2/3)',
  zeroCombo: '0/00 Combo', series3: '3 Numbers Series', series6: '6 Numbers Series',
};
const BACCARAT_LABEL: Record<BaccaratBetType, string> = {
  player: 'Player', banker: 'Banker', tie: 'Tie', playerPair: 'Player Pair', bankerPair: 'Banker Pair',
};
const SICBO_LABEL: Record<SicBoBetType, string> = {
  small: 'Small', big: 'Big', odd: 'Odd', even: 'Even', anytriple: 'Any Triple',
  total: 'Total', single: 'Single', double: 'Double', triple: 'Triple', combo: 'Two-Dice Combo',
  doubleAny: 'Double + Single', threeSingleCombo: 'Three Single Dice', threeFromFour: 'Three From Four',
};

/**
 * Stake for this round given a sizing strategy and the bot's own running state.
 * `state.prevBankroll` is the bankroll this closure last saw, since a session
 * calls decide with ctx.bankroll = the bankroll BEFORE the round, the delta
 * between this call's bankroll and the previous call's bankroll is exactly the
 * previous round's net (win/loss/push), with no need to see the outcome directly.
 */
const SIZING_CAP_MULTIPLE = 32; // safety cap so a losing/winning streak can't run away forever

function computeStake(
  sizing: SizingStrategy,
  unit: number,
  bankroll: number,
  state: { prevBankroll: number | null; prevStake: number },
): number {
  let stake: number;
  if (sizing === 'flat' || state.prevBankroll === null) {
    stake = unit;
  } else {
    const prevNet = bankroll - state.prevBankroll; // previous round's net
    if (sizing === 'martingale') {
      stake = prevNet < 0 ? state.prevStake * 2 : unit; // double after a loss, reset after win/push
    } else {
      stake = prevNet > 0 ? state.prevStake * 2 : unit; // paroli: double after a win, reset after loss/push
    }
  }
  stake = Math.min(stake, unit * SIZING_CAP_MULTIPLE);
  return Math.max(1, Math.min(Math.floor(stake), bankroll));
}

function sizingLabel(sizing: SizingStrategy, stake: number, unit: number): string {
  if (sizing === 'flat' || stake === unit) return `Flat ${stake} pts`;
  return sizing === 'martingale' ? `Martingale ${stake} pts (doubled after a loss)` : `Paroli ${stake} pts (doubled after a win)`;
}

/** Build a rule bot from a human-chosen fixed bet + sizing strategy. Stateful
 *  per instance (tracks the sizing streak), create a fresh one per session. */
export function makeRuleBot(config: Partial<RuleBotConfig> = {}): Decide {
  const cfg: RuleBotConfig = {
    roulette: { ...DEFAULT_RULE_BOT_CONFIG.roulette, ...config.roulette },
    baccarat: { ...DEFAULT_RULE_BOT_CONFIG.baccarat, ...config.baccarat },
    sicbo: { ...DEFAULT_RULE_BOT_CONFIG.sicbo, ...config.sicbo },
    slot: { ...DEFAULT_RULE_BOT_CONFIG.slot, ...config.slot },
    sizing: config.sizing ?? DEFAULT_RULE_BOT_CONFIG.sizing,
  };
  const state = { prevBankroll: null as number | null, prevStake: 0 };

  return async (req) => {
    if (req.game === 'blackjack' && req.kind === 'action') {
      return { value: blackjackBasic(req) }; // action strategy is unaffected by bet config
    }

    const recordAndReturn = (value: unknown, stake: number) => {
      state.prevBankroll = req.bankroll;
      state.prevStake = stake;
      return { value };
    };

    switch (req.game) {
      case 'roulette': {
        // The bot's own unit floors to whatever table minimum its chosen bet requires
        // (outside even-money bets cost more than inside ones), same as the Sic Bo branch.
        const min = ROULETTE_MIN_BET[cfg.roulette.type];
        const unit = Math.max(min, req.baseBet);
        const stake = computeStake(cfg.sizing, unit, req.bankroll, state);
        const b = cfg.roulette;
        return recordAndReturn({
          bets: [{
            type: b.type, amount: stake,
            ...(b.numbers ? { numbers: b.numbers } : {}),
            ...(b.selector ? { selector: b.selector } : {}),
            ...(b.seriesGroup ? { seriesGroup: b.seriesGroup } : {}),
          }],
          reasoning: `${sizingLabel(cfg.sizing, stake, unit)} on ${ROULETTE_LABEL[b.type]} (table min ${min}).`,
        }, stake);
      }
      case 'baccarat': {
        // Player/Banker carry a higher table minimum than Tie/Pair, same shape as roulette/sicbo.
        const min = BACCARAT_MIN_BET[cfg.baccarat.type];
        const unit = Math.max(min, req.baseBet);
        const stake = computeStake(cfg.sizing, unit, req.bankroll, state);
        return recordAndReturn({
          bets: [{ type: cfg.baccarat.type, amount: stake }],
          reasoning: `${sizingLabel(cfg.sizing, stake, unit)} on ${BACCARAT_LABEL[cfg.baccarat.type]} (table min ${min}).`,
        }, stake);
      }
      case 'sicbo': {
        // The even-money families carry a higher table minimum; the bot's unit
        // stake floors to whatever minimum its chosen bet requires.
        const min = SICBO_MIN_BET[cfg.sicbo.type];
        const unit = Math.max(min, req.baseBet);
        const stake = computeStake(cfg.sizing, unit, req.bankroll, state);
        const b = cfg.sicbo;
        const bet: Record<string, unknown> = { type: b.type, amount: stake };
        if (b.type === 'total') bet.total = b.total ?? 9;
        if (b.type === 'single' || b.type === 'double' || b.type === 'triple') bet.face = b.face ?? 4;
        if (b.type === 'combo') bet.faces = b.faces ?? [1, 2];
        if (b.type === 'doubleAny') { bet.face = b.face ?? 2; bet.partner = b.partner ?? 3; }
        if (b.type === 'threeSingleCombo') bet.triple = b.triple ?? [1, 2, 6];
        if (b.type === 'threeFromFour') bet.group = b.group ?? 1;
        return recordAndReturn({
          bets: [bet],
          reasoning: `${sizingLabel(cfg.sizing, stake, unit)} on ${SICBO_LABEL[b.type]} (table min ${min}).`,
        }, stake);
      }
      case 'slot': {
        const s = cfg.slot;
        if (s.useMax) {
          return recordAndReturn({
            denomination: s.denomination, betLevel: SLOT_MAX_LEVEL, betMax: true,
            reasoning: `Bet Max every spin (denomination ${s.denomination}).`,
          }, SLOT_MAX_BET);
        }
        const unit = Math.max(SLOT_MIN_BET, s.denomination * s.betLevel);
        const target = computeStake(cfg.sizing, unit, req.bankroll, state);
        const { denomination, betLevel } = pickBetControls(target);
        const amount = denomination * betLevel;
        return recordAndReturn({
          denomination, betLevel,
          reasoning: `${sizingLabel(cfg.sizing, amount, unit)}, denomination ${denomination}, bet level ${betLevel}.`,
        }, amount);
      }
      case 'blackjack': {
        // kind === 'bet' here (action is handled above)
        const stake = computeStake(cfg.sizing, req.baseBet, req.bankroll, state);
        return recordAndReturn({ amount: stake, reasoning: `${sizingLabel(cfg.sizing, stake, req.baseBet)}; edge comes from correct play, not bet sizing.` }, stake);
      }
    }
  };
}

/** The rule bot with default choices (Red / Banker / Small, flat stakes), used
 *  as the zero-config baseline and by tests. The app builds a fresh, human-
 *  configured instance per run via makeRuleBot(form.ruleBot). */
export const baselineDecide: Decide = makeRuleBot();

export const BASELINE_DECIDER_ID = 'baseline';

// ---------------------------------------------------------------- naive human
// A casual player: spreads several bets across the Sic Bo board with no regard
// for house edge, an even-money bet, a couple of single numbers, maybe a total
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
    case 'doubleAny': {
      const [f, p] = SICBO_DOUBLE_ANY_PAIRS[Math.floor(rnd() * SICBO_DOUBLE_ANY_PAIRS.length)]!;
      return { type, amount, face: f, partner: p };
    }
    case 'threeSingleCombo': {
      const faces = [1, 2, 3, 4, 5, 6];
      const triple: number[] = [];
      while (triple.length < 3) {
        const f = faces[Math.floor(rnd() * faces.length)]!;
        if (!triple.includes(f)) triple.push(f);
      }
      return { type, amount, triple: triple as [number, number, number] };
    }
    case 'threeFromFour':
      return { type, amount, group: 1 + Math.floor(rnd() * 4) };
    default: return { type, amount }; // small / big / odd / even / anytriple
  }
}

const NAIVE_SICBO_FAMILIES = [
  'small', 'big', 'odd', 'even', 'total', 'single', 'combo', 'double', 'triple', 'anytriple',
  'doubleAny', 'threeSingleCombo', 'threeFromFour',
];

function naiveSicBo(req: DecisionRequest): { bets: any[]; reasoning: string } {
  const rnd = mulberry32(req.index * 2654435761 + 1);
  let remaining = req.bankroll;
  const bets: any[] = [];
  const spread = 2 + Math.floor(rnd() * 4); // 2..5 bets, like a human spraying the table

  for (let i = 0; i < spread && bets.length < 8; i++) {
    const type = NAIVE_SICBO_FAMILIES[Math.floor(rnd() * NAIVE_SICBO_FAMILIES.length)]!;
    const min = SICBO_MIN_BET[type as keyof typeof SICBO_MIN_BET];
    if (remaining < min) continue; // can't afford this family's minimum, skip it
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
  return { bets, reasoning: `Casual spread of ${bets.length} bets (${staked} pts) across the table, no edge discipline, just playing hunches.` };
}

// ---------------------------------------------------------------- naive human (roulette)
// A casual player spreading chips across the felt with no edge discipline: a mix of
// outside even-money, dozens/columns, and inside numbers/lines, each bet's geometry
// generated so it's always a real split/street/corner/sixline cell (mirrors the row/col
// formulas in isValidRouletteBet), never an invented combination.

function randomRouletteBet(type: RouletteBetType, amount: number, rnd: () => number): any {
  switch (type) {
    case 'straight':
      return { type, amount, numbers: [1 + Math.floor(rnd() * 36)] };
    case 'split': {
      if (rnd() < 0.5) { // horizontal: same row, adjacent columns
        const r = Math.floor(rnd() * 12), c = 1 + Math.floor(rnd() * 2);
        const n = 3 * r + c;
        return { type, amount, numbers: [n, n + 1] };
      }
      const c = 1 + Math.floor(rnd() * 3), r = Math.floor(rnd() * 11); // vertical: same column, adjacent rows
      const n = 3 * r + c;
      return { type, amount, numbers: [n, n + 3] };
    }
    case 'street': {
      const k = Math.floor(rnd() * 12);
      return { type, amount, numbers: [3 * k + 1, 3 * k + 2, 3 * k + 3] };
    }
    case 'corner': {
      const r = Math.floor(rnd() * 11), c = 1 + Math.floor(rnd() * 2);
      const n = 3 * r + c;
      return { type, amount, numbers: [n, n + 1, n + 3, n + 4] };
    }
    case 'sixline': {
      const k = Math.floor(rnd() * 11);
      return { type, amount, numbers: [3 * k + 1, 3 * k + 2, 3 * k + 3, 3 * k + 4, 3 * k + 5, 3 * k + 6] };
    }
    case 'column': case 'dozen':
      return { type, amount, selector: (1 + Math.floor(rnd() * 3)) as 1 | 2 | 3 };
    case 'series3':
      return { type, amount, seriesGroup: 1 + Math.floor(rnd() * SERIES3_GROUPS.length) };
    case 'series6':
      return { type, amount, seriesGroup: 1 + Math.floor(rnd() * SERIES6_GROUPS.length) };
    default: // red / black / odd / even / high / low / five / zeroCombo
      return { type, amount };
  }
}

function naiveRoulette(req: DecisionRequest): { bets: any[]; reasoning: string } {
  const variant = ((req.observation as any).variant as RouletteVariant) ?? 'european';
  const families: RouletteBetType[] = [
    'red', 'black', 'odd', 'even', 'high', 'low', 'dozen', 'column',
    'straight', 'split', 'street', 'corner', 'sixline',
    ...(variant === 'american' ? (['five', 'zeroCombo', 'series3', 'series6'] as RouletteBetType[]) : []),
  ];
  const rnd = mulberry32(req.index * 2654435761 + 7);
  let remaining = req.bankroll;
  const bets: any[] = [];
  const spread = 1 + Math.floor(rnd() * 4); // 1..4 bets, like a human spraying the table

  for (let i = 0; i < spread && bets.length < 6; i++) {
    const type = families[Math.floor(rnd() * families.length)]!;
    const min = ROULETTE_MIN_BET[type];
    if (remaining < min) continue;
    const units = 1 + Math.floor(rnd() * 3); // 1..3 chips above the minimum
    const amount = Math.min(min * units, remaining);
    if (amount < min) continue;
    bets.push(randomRouletteBet(type, amount, rnd));
    remaining -= amount;
  }

  if (bets.length === 0) {
    const cheapest = Math.min(...Object.values(ROULETTE_MIN_BET));
    bets.push(randomRouletteBet('straight', Math.min(cheapest, req.bankroll || cheapest), rnd));
  }
  const staked = bets.reduce((s, b) => s + b.amount, 0);
  return { bets, reasoning: `Casual spread of ${bets.length} bets (${staked} pts) across the table, no edge discipline, just playing hunches.` };
}

// ---------------------------------------------------------------- naive human (baccarat)
// A casual bettor: picks Player or Banker as the main bet (the two a real mini-baccarat
// player actually chooses between), then sometimes throws a Tie and/or a Pair on top
// "for fun", the classic pattern of chasing a big proposition payout alongside the
// main line, same spirit as naiveSicBo/naiveRoulette spraying side bets.

function naiveBaccarat(req: DecisionRequest): { bets: any[]; reasoning: string } {
  const rnd = mulberry32(req.index * 2654435761 + 13);
  let remaining = req.bankroll;
  const bets: any[] = [];

  const main = rnd() < 0.55 ? 'banker' : 'player'; // Banker is the popular/favored side at real tables
  const mainMin = BACCARAT_MIN_BET[main];
  if (remaining >= mainMin) {
    const units = 1 + Math.floor(rnd() * 3); // 1..3 chips above the minimum
    const amount = Math.min(mainMin * units, remaining);
    bets.push({ type: main, amount });
    remaining -= amount;
  }

  if (rnd() < 0.3 && remaining >= BACCARAT_MIN_BET.tie) {
    const amount = Math.min(BACCARAT_MIN_BET.tie * (1 + Math.floor(rnd() * 2)), remaining);
    bets.push({ type: 'tie', amount });
    remaining -= amount;
  }
  if (rnd() < 0.25) {
    const pairType = rnd() < 0.5 ? 'playerPair' : 'bankerPair';
    if (remaining >= BACCARAT_MIN_BET[pairType]) {
      const amount = Math.min(BACCARAT_MIN_BET[pairType] * (1 + Math.floor(rnd() * 2)), remaining);
      bets.push({ type: pairType, amount });
      remaining -= amount;
    }
  }

  if (bets.length === 0) {
    bets.push({ type: main, amount: Math.min(mainMin, req.bankroll || mainMin) });
  }
  const staked = bets.reduce((s, b) => s + b.amount, 0);
  return { bets, reasoning: `Casual spread of ${bets.length} bet(s) (${staked} pts), ${BACCARAT_LABEL[main as BaccaratBetType]} as the main line, no edge discipline.` };
}

// ---------------------------------------------------------------- naive human (slot)
// A casual slot player: mostly sits near the minimum, but reacts to what just
// happened, "letting it ride" (bumping denomination/bet level) after a win, chasing
// the loss back after one, and occasionally slamming BET MAX chasing the jackpot
// regardless of history. Stateful (tracks the actual previous stake/bankroll) so the
// reactivity is genuine, not just a memoryless mood roll, reset at req.index === 0
// since naiveDecide is a process-wide singleton reused across sessions run one at a
// time (see makeRuleBot's identical computeStake state-tracking trick).
let slotNaiveState = { prevBankroll: null as number | null, prevStake: 0 };

function naiveSlot(req: DecisionRequest): { denomination: number; betLevel: number; betMax?: boolean; reasoning: string } {
  if (req.index === 0) slotNaiveState = { prevBankroll: null, prevStake: 0 };
  const rnd = mulberry32(req.index * 2654435761 + 19); // salt distinct from sicbo(1)/roulette(7)/baccarat(13)
  const unit = Math.max(SLOT_MIN_BET, req.baseBet);
  const prevNet = slotNaiveState.prevBankroll === null ? 0 : req.bankroll - slotNaiveState.prevBankroll;

  let target: number;
  let mood: string;
  if (rnd() < 0.06) {
    target = SLOT_MAX_BET;
    mood = 'chasing the jackpot, slammed Bet Max';
  } else {
    const roll = rnd();
    if (prevNet > 0 && roll < 0.5) {
      target = Math.max(unit, slotNaiveState.prevStake * (1.5 + rnd()));
      mood = 'letting it ride after that win';
    } else if (prevNet < 0 && roll < 0.45) {
      target = Math.max(unit, slotNaiveState.prevStake * (1.2 + rnd()));
      mood = 'chasing the loss back';
    } else {
      target = unit;
      mood = 'casual spin near the minimum';
    }
  }

  const clampedTarget = Math.max(Math.min(SLOT_MIN_BET, req.bankroll), Math.min(target, SLOT_MAX_BET, req.bankroll));
  const { denomination, betLevel } = pickBetControls(clampedTarget);
  const amount = Math.min(denomination * betLevel, req.bankroll);
  slotNaiveState = { prevBankroll: req.bankroll, prevStake: amount };
  return {
    denomination, betLevel, betMax: amount >= SLOT_MAX_BET && target >= SLOT_MAX_BET,
    reasoning: `${mood}, denomination ${denomination}, bet level ${betLevel}.`,
  };
}

export const naiveDecide: Decide = async (req) => {
  if (req.game === 'sicbo' && req.kind === 'bet') {
    return { value: naiveSicBo(req) };
  }
  if (req.game === 'roulette' && req.kind === 'bet') {
    return { value: naiveRoulette(req) };
  }
  if (req.game === 'baccarat' && req.kind === 'bet') {
    return { value: naiveBaccarat(req) };
  }
  if (req.game === 'slot' && req.kind === 'bet') {
    return { value: naiveSlot(req) };
  }
  return baselineDecide(req); // other games: reuse the disciplined baseline
};

export const NAIVE_DECIDER_ID = 'naive';
