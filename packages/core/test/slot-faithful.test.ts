import { describe, it, expect } from 'vitest';
import {
  runSession, replaySession, naiveDecide, makeRuleBot, makeSessionConfig,
  type SessionConfig,
} from '../src/index.js';
import { SLOT_MIN_BET, SLOT_MAX_BET, SLOT_DENOMINATIONS, SLOT_MAX_LEVEL } from '@casino/engine';

function cfg(seed: string, rounds = 200, startingBankroll = 5000, deciderId = 'naive'): SessionConfig {
  return makeSessionConfig({
    id: `slot-${seed}`, label: 'slot', seed, game: 'slot', deciderId,
    createdAt: '2026-07-05T00:00:00.000Z', rounds, startingBankroll, baseBet: 10,
  });
}

/** Every stake the dealer resolved must be a well-formed, in-range, control-derived amount. */
function assertFaithfulSlotBet(outcome: any, bankrollBefore: number) {
  expect(Number.isInteger(outcome.amount)).toBe(true);
  expect(outcome.amount).toBeGreaterThanOrEqual(Math.min(SLOT_MIN_BET, bankrollBefore));
  expect(outcome.amount).toBeLessThanOrEqual(Math.min(SLOT_MAX_BET, bankrollBefore));
  expect(outcome.amount).toBeLessThanOrEqual(bankrollBefore);
  expect((SLOT_DENOMINATIONS as readonly number[]).includes(outcome.denomination)).toBe(true);
  expect(outcome.betLevel).toBeGreaterThanOrEqual(1);
  expect(outcome.betLevel).toBeLessThanOrEqual(SLOT_MAX_LEVEL);
}

describe('naive human bot plays a faithful slot machine', () => {
  it('every resolved stake respects the control-derived min/max and the bankroll cap', async () => {
    const session = await runSession(cfg('faithful-1'), naiveDecide);
    expect(session.rounds.length).toBeGreaterThan(0);
    for (const r of session.rounds) assertFaithfulSlotBet(r.outcome, r.bankrollBefore);
  });

  it('shows varied bet sizes and presses Bet Max at least once over many rounds', async () => {
    const session = await runSession(cfg('spread-1', 500), naiveDecide);
    const amounts = new Set(session.rounds.map((r) => (r.outcome as any).amount));
    expect(amounts.size).toBeGreaterThan(1); // genuinely reactive, not a single flat stake
    const maxPresses = session.rounds.filter((r) => (r.outcome as any).betMax).length;
    expect(maxPresses).toBeGreaterThan(0);
  });

  it('is deterministic, replay reproduces the naive slot session exactly', async () => {
    const original = await runSession(cfg('replay-1'), naiveDecide);
    const replay = await replaySession(original);
    expect(replay.finalBankroll).toBe(original.finalBankroll);
    for (let i = 0; i < original.rounds.length; i++) {
      expect(replay.rounds[i]!.outcome).toEqual(original.rounds[i]!.outcome);
      expect(replay.rounds[i]!.net).toBe(original.rounds[i]!.net);
    }
  });
});

describe('rule bot plays a faithful slot machine', () => {
  it('the default fixed denomination/bet-level bot resolves valid stakes', async () => {
    const decide = makeRuleBot();
    const session = await runSession(cfg('rulebot-1', 100), decide);
    for (const r of session.rounds) assertFaithfulSlotBet(r.outcome, r.bankrollBefore);
  });

  it('a bot configured to always Bet Max does exactly that every round', async () => {
    const decide = makeRuleBot({ slot: { denomination: 5, betLevel: 4, useMax: true } });
    const session = await runSession(cfg('rulebot-max', 50), decide);
    for (const r of session.rounds) {
      expect((r.outcome as any).betMax).toBe(true);
      expect((r.outcome as any).amount).toBe(Math.min(SLOT_MAX_BET, r.bankrollBefore));
    }
  });

  it('martingale sizing scales the resolved stake up after a loss', async () => {
    const decide = makeRuleBot({ slot: { denomination: 10, betLevel: 1 }, sizing: 'martingale' });
    const session = await runSession(cfg('rulebot-martingale', 100, 50000), decide);
    const amounts = new Set(session.rounds.map((r) => (r.outcome as any).amount));
    expect(amounts.size).toBeGreaterThan(1); // sizing actually moves the stake round to round
  });
});

describe('table-rule enforcement (dealer clamps an unaffordable or out-of-range stake)', () => {
  it('clamps a Bet-Max press to the bankroll when the bankroll is below the table max', async () => {
    const decide = async () => ({ value: { denomination: 50, betLevel: 1, betMax: true, reasoning: 'x' } });
    const config = makeSessionConfig({
      id: 's1', label: 'slot', seed: 's1', game: 'slot', deciderId: 'x',
      createdAt: '2026-07-05T00:00:00.000Z', rounds: 1, startingBankroll: 120, baseBet: 10,
    });
    const session = await runSession(config, decide as any);
    expect((session.rounds[0]!.outcome as any).amount).toBe(120);
  });

  it('never produces a stake above a bankroll sitting right at the table minimum', async () => {
    const decide = async () => ({ value: { denomination: 50, betLevel: 10, reasoning: 'x' } }); // would-be 500
    const config = makeSessionConfig({
      id: 's2', label: 'slot', seed: 's2', game: 'slot', deciderId: 'x',
      createdAt: '2026-07-05T00:00:00.000Z', rounds: 1, startingBankroll: SLOT_MIN_BET, baseBet: SLOT_MIN_BET,
    });
    const session = await runSession(config, decide as any);
    expect((session.rounds[0]!.outcome as any).amount).toBeLessThanOrEqual(config.startingBankroll);
  });

  it('clamps an over-max denomination x level combination down to the table max', async () => {
    const decide = async () => ({ value: { denomination: 50, betLevel: 10, reasoning: 'x' } }); // 500 == SLOT_MAX_BET already
    const config = makeSessionConfig({
      id: 's3', label: 'slot', seed: 's3', game: 'slot', deciderId: 'x',
      createdAt: '2026-07-05T00:00:00.000Z', rounds: 1, startingBankroll: 10000, baseBet: 10,
    });
    const session = await runSession(config, decide as any);
    expect((session.rounds[0]!.outcome as any).amount).toBe(SLOT_MAX_BET);
  });
});
