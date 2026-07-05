import { describe, it, expect } from 'vitest';
import {
  runSession, replaySession, naiveDecide, makeSessionConfig,
  type SessionConfig,
} from '../src/index.js';
import { ROULETTE_MIN_BET, isValidRouletteBet } from '@casino/engine';

function cfg(seed: string, rounds = 200, startingBankroll = 5000): SessionConfig {
  return makeSessionConfig({
    id: `roulette-${seed}`, label: 'roulette', seed, game: 'roulette', deciderId: 'naive',
    createdAt: '2026-07-05T00:00:00.000Z', rounds, startingBankroll, baseBet: 50,
  });
}

/** Every bet the dealer accepted must be a well-formed, above-minimum, real-cell stake. */
function assertFaithfulBets(placedBets: any[], bankrollBefore: number) {
  let total = 0;
  for (const b of placedBets) {
    const min = ROULETTE_MIN_BET[b.type as keyof typeof ROULETTE_MIN_BET];
    expect(min, `unknown bet type ${b.type}`).toBeGreaterThan(0);
    expect(Number.isInteger(b.amount)).toBe(true);
    expect(b.amount).toBeGreaterThanOrEqual(min);
    expect(isValidRouletteBet(b, 'european')).toBe(true); // dealer never accepts an invented cell
    total += b.amount;
  }
  expect(total).toBeLessThanOrEqual(bankrollBefore);
}

describe('naive human bot plays a faithful Roulette table', () => {
  it('every accepted bet respects table minimums, real geometry, and the bankroll cap', async () => {
    const session = await runSession(cfg('faithful-1'), naiveDecide);
    expect(session.rounds.length).toBeGreaterThan(0);
    for (const r of session.rounds) {
      const bets = (r.outcome as any).placedBets as any[];
      assertFaithfulBets(bets, r.bankrollBefore);
    }
  });

  it('spreads bets across many families, not just one fixed outside bet', async () => {
    const session = await runSession(cfg('spread-1', 300), naiveDecide);
    const seenTypes = new Set<string>();
    let multiBetRounds = 0;
    for (const r of session.rounds) {
      const bets = (r.outcome as any).placedBets as any[];
      if (bets.length >= 2) multiBetRounds++;
      for (const b of bets) seenTypes.add(b.type);
    }
    // a casual player touches most of the board over 300 rounds — inside and outside bets
    expect(seenTypes.size).toBeGreaterThanOrEqual(6);
    expect(multiBetRounds).toBeGreaterThan(0); // genuinely spreads, not a single bet
  });

  it('is deterministic — replay reproduces the naive spread exactly', async () => {
    const original = await runSession(cfg('replay-1'), naiveDecide);
    const replay = await replaySession(original);
    expect(replay.finalBankroll).toBe(original.finalBankroll);
    for (let i = 0; i < original.rounds.length; i++) {
      expect(replay.rounds[i]!.outcome).toEqual(original.rounds[i]!.outcome);
      expect(replay.rounds[i]!.net).toBe(original.rounds[i]!.net);
    }
  });
});

describe('table-rule enforcement (dealer refuses under-minimum or invented-geometry chips)', () => {
  it('drops an even-money bet staked below the 50-point minimum but keeps an above-minimum straight', async () => {
    const decide = async () => ({
      value: { bets: [{ type: 'red', amount: 30 }, { type: 'straight', amount: 10, numbers: [17] }], reasoning: 'x' },
    });
    const config = makeSessionConfig({
      id: 'r1', label: 'roulette', seed: 'r1', game: 'roulette', deciderId: 'x',
      createdAt: '2026-07-05T00:00:00.000Z', rounds: 1, startingBankroll: 1000, baseBet: 50,
    });
    const session = await runSession(config, decide as any);
    const bets = (session.rounds[0]!.outcome as any).placedBets as any[];
    expect(bets.find((b) => b.type === 'red')).toBeUndefined();          // refused (below 50 min)
    expect(bets.find((b) => b.type === 'straight')?.amount).toBe(10);    // accepted
  });

  it('refuses a corner bet whose numbers are not a real square on the felt', async () => {
    const decide = async () => ({
      value: {
        bets: [
          { type: 'corner', amount: 10, numbers: [1, 36, 17, 5] }, // invented — not a real corner
          { type: 'straight', amount: 10, numbers: [1] },
        ],
        reasoning: 'x',
      },
    });
    const config = makeSessionConfig({
      id: 'r2', label: 'roulette', seed: 'r2', game: 'roulette', deciderId: 'x',
      createdAt: '2026-07-05T00:00:00.000Z', rounds: 1, startingBankroll: 1000, baseBet: 50,
    });
    const session = await runSession(config, decide as any);
    const bets = (session.rounds[0]!.outcome as any).placedBets as any[];
    expect(bets.find((b) => b.type === 'corner')).toBeUndefined();       // refused (not a real cell)
    expect(bets.find((b) => b.type === 'straight')?.amount).toBe(10);    // accepted
  });

  it('caps an all-in spread to the bankroll and refuses what it cannot cover', async () => {
    const decide = async () => ({
      value: { bets: [{ type: 'red', amount: 400 }, { type: 'black', amount: 400 }], reasoning: 'x' },
    });
    const config = makeSessionConfig({
      id: 'r3', label: 'roulette', seed: 'r3', game: 'roulette', deciderId: 'x',
      createdAt: '2026-07-05T00:00:00.000Z', rounds: 1, startingBankroll: 500, baseBet: 50,
    });
    const session = await runSession(config, decide as any);
    const bets = (session.rounds[0]!.outcome as any).placedBets as any[];
    const total = bets.reduce((s, b) => s + b.amount, 0);
    expect(total).toBeLessThanOrEqual(500);
    expect(bets[0].amount).toBe(400); // first bet accepted in full
  });
});
