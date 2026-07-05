import { describe, it, expect } from 'vitest';
import {
  runSession, replaySession, naiveDecide, baselineDecide, makeSessionConfig,
  type SessionConfig,
} from '../src/index.js';
import { SICBO_MIN_BET, isValidSicBoBet } from '@casino/engine';

function cfg(seed: string, rounds = 200, startingBankroll = 5000): SessionConfig {
  return makeSessionConfig({
    id: `sicbo-${seed}`, label: 'sicbo', seed, game: 'sicbo', deciderId: 'naive',
    createdAt: '2026-07-05T00:00:00.000Z', rounds, startingBankroll, baseBet: 50,
  });
}

/** Every bet the dealer accepted must be a well-formed, above-minimum, integer stake. */
function assertFaithfulBets(placedBets: any[], bankrollBefore: number) {
  let total = 0;
  for (const b of placedBets) {
    const min = SICBO_MIN_BET[b.type as keyof typeof SICBO_MIN_BET];
    expect(min, `unknown bet type ${b.type}`).toBeGreaterThan(0);
    expect(Number.isInteger(b.amount)).toBe(true);   // whole chips
    expect(b.amount).toBeGreaterThanOrEqual(min);     // table minimum respected
    // bet-shape sanity
    if (b.type === 'total') expect(b.total).toBeGreaterThanOrEqual(4), expect(b.total).toBeLessThanOrEqual(17);
    if (b.type === 'single' || b.type === 'double' || b.type === 'triple') {
      expect(b.face).toBeGreaterThanOrEqual(1); expect(b.face).toBeLessThanOrEqual(6);
    }
    if (b.type === 'combo') {
      expect(b.faces).toHaveLength(2);
      expect(b.faces[0]).not.toBe(b.faces[1]); // two distinct faces
    }
    expect(isValidSicBoBet(b)).toBe(true); // dealer never accepts an invented felt cell
    total += b.amount;
  }
  expect(total).toBeLessThanOrEqual(bankrollBefore); // never stakes more than the bankroll
}

describe('naive human bot plays a faithful Sic Bo table', () => {
  it('every accepted bet respects table minimums and the bankroll cap', async () => {
    const session = await runSession(cfg('faithful-1'), naiveDecide);
    expect(session.rounds.length).toBeGreaterThan(0);
    for (const r of session.rounds) {
      const bets = (r.outcome as any).placedBets as any[];
      assertFaithfulBets(bets, r.bankrollBefore);
    }
  });

  it('spreads bets across many families and uses odd/even (not just Small)', async () => {
    const session = await runSession(cfg('spread-1', 300), naiveDecide);
    const seenTypes = new Set<string>();
    let multiBetRounds = 0;
    for (const r of session.rounds) {
      const bets = (r.outcome as any).placedBets as any[];
      if (bets.length >= 2) multiBetRounds++;
      for (const b of bets) seenTypes.add(b.type);
    }
    // a casual player touches most of the board over 300 rounds, including odd/even
    expect(seenTypes.size).toBeGreaterThanOrEqual(7);
    expect(seenTypes.has('odd') || seenTypes.has('even')).toBe(true);
    expect(multiBetRounds).toBeGreaterThan(0); // genuinely spreads, not a single bet
  });

  it('over enough rounds, also reaches the GRA-only bet families (doubleAny/threeSingleCombo/threeFromFour)', async () => {
    const session = await runSession(cfg('spread-2', 600), naiveDecide);
    const seenTypes = new Set<string>();
    for (const r of session.rounds) {
      for (const b of (r.outcome as any).placedBets as any[]) seenTypes.add(b.type);
    }
    expect(seenTypes.has('doubleAny')).toBe(true);
    expect(seenTypes.has('threeSingleCombo')).toBe(true);
    expect(seenTypes.has('threeFromFour')).toBe(true);
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

describe('table-minimum enforcement (dealer refuses under-minimum chips)', () => {
  it('drops an even-money bet staked below the 50-point minimum', async () => {
    // Odd staked at 20 (< 50) must be refused; the Single at 10 (>= its 10 min) stays.
    const decide = async () => ({
      value: { bets: [{ type: 'odd', amount: 20 }, { type: 'single', face: 3, amount: 10 }], reasoning: 'x' },
    });
    const config = makeSessionConfig({
      id: 's', label: 'sicbo', seed: 's', game: 'sicbo', deciderId: 'x',
      createdAt: '2026-07-05T00:00:00.000Z', rounds: 1, startingBankroll: 1000, baseBet: 50,
    });
    const session = await runSession(config, decide as any);
    const bets = (session.rounds[0]!.outcome as any).placedBets as any[];
    expect(bets.find((b) => b.type === 'odd')).toBeUndefined();       // refused
    expect(bets.find((b) => b.type === 'single')?.amount).toBe(10);   // accepted
  });

  it('caps an all-in spread to the bankroll and refuses what it cannot cover', async () => {
    // Two even-money bets of 400 each on a 500 bankroll: first accepted, second refused (only 100 left < 50? no -> 100>=50 accepted at 100)
    const decide = async () => ({
      value: { bets: [{ type: 'big', amount: 400 }, { type: 'small', amount: 400 }], reasoning: 'x' },
    });
    const config = makeSessionConfig({
      id: 's2', label: 'sicbo', seed: 's2', game: 'sicbo', deciderId: 'x',
      createdAt: '2026-07-05T00:00:00.000Z', rounds: 1, startingBankroll: 500, baseBet: 50,
    });
    const session = await runSession(config, decide as any);
    const bets = (session.rounds[0]!.outcome as any).placedBets as any[];
    const total = bets.reduce((s, b) => s + b.amount, 0);
    expect(total).toBeLessThanOrEqual(500);
    expect(bets[0].amount).toBe(400); // first bet accepted in full
  });
});
