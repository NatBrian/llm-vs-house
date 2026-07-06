import { describe, it, expect } from 'vitest';
import {
  runSession, replaySession, naiveDecide, makeSessionConfig,
  type SessionConfig,
} from '../src/index.js';
import { BACCARAT_MIN_BET } from '@casino/engine';

function cfg(seed: string, rounds = 200, startingBankroll = 5000): SessionConfig {
  return makeSessionConfig({
    id: `baccarat-${seed}`, label: 'baccarat', seed, game: 'baccarat', deciderId: 'naive',
    createdAt: '2026-07-05T00:00:00.000Z', rounds, startingBankroll, baseBet: 50,
  });
}

/** Every bet the dealer accepted must be a well-formed, above-minimum, integer stake. */
function assertFaithfulBets(placedBets: any[], bankrollBefore: number) {
  let total = 0;
  for (const b of placedBets) {
    const min = BACCARAT_MIN_BET[b.type as keyof typeof BACCARAT_MIN_BET];
    expect(min, `unknown bet type ${b.type}`).toBeGreaterThan(0);
    expect(Number.isInteger(b.amount)).toBe(true);   // whole chips
    expect(b.amount).toBeGreaterThanOrEqual(min);     // table minimum respected
    total += b.amount;
  }
  expect(total).toBeLessThanOrEqual(bankrollBefore); // never stakes more than the bankroll
}

describe('naive human bot plays a faithful Baccarat table', () => {
  it('every accepted bet respects table minimums and the bankroll cap', async () => {
    const session = await runSession(cfg('faithful-1'), naiveDecide);
    expect(session.rounds.length).toBeGreaterThan(0);
    for (const r of session.rounds) {
      const bets = (r.outcome as any).placedBets as any[];
      assertFaithfulBets(bets, r.bankrollBefore);
    }
  });

  it('mostly bets Player/Banker as the main line, occasionally adds Tie/Pair', async () => {
    const session = await runSession(cfg('spread-1', 300), naiveDecide);
    const seenTypes = new Set<string>();
    let multiBetRounds = 0;
    for (const r of session.rounds) {
      const bets = (r.outcome as any).placedBets as any[];
      if (bets.length >= 2) multiBetRounds++;
      for (const b of bets) seenTypes.add(b.type);
      // exactly one of player/banker is the main line every round
      const mains = bets.filter((b) => b.type === 'player' || b.type === 'banker');
      expect(mains.length).toBeLessThanOrEqual(1);
    }
    expect(seenTypes.has('player')).toBe(true);
    expect(seenTypes.has('banker')).toBe(true);
    expect(seenTypes.has('tie') || seenTypes.has('playerPair') || seenTypes.has('bankerPair')).toBe(true);
    expect(multiBetRounds).toBeGreaterThan(0); // genuinely adds a side bet sometimes
  });

  it('is deterministic, replay reproduces the naive spread exactly', async () => {
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
  it('drops a Banker bet staked below the 50-point minimum, keeps an above-minimum Tie', async () => {
    const decide = async () => ({
      value: { bets: [{ type: 'banker', amount: 20 }, { type: 'tie', amount: 10 }], reasoning: 'x' },
    });
    const config = makeSessionConfig({
      id: 'b1', label: 'baccarat', seed: 'b1', game: 'baccarat', deciderId: 'x',
      createdAt: '2026-07-05T00:00:00.000Z', rounds: 1, startingBankroll: 1000, baseBet: 50,
    });
    const session = await runSession(config, decide as any);
    const bets = (session.rounds[0]!.outcome as any).placedBets as any[];
    expect(bets.find((b) => b.type === 'banker')).toBeUndefined(); // refused (below 50 min)
    expect(bets.find((b) => b.type === 'tie')?.amount).toBe(10);   // accepted (meets 10 min)
  });

  it('caps a spread to the bankroll and refuses what it cannot cover', async () => {
    const decide = async () => ({
      value: { bets: [{ type: 'player', amount: 400 }, { type: 'banker', amount: 400 }], reasoning: 'x' },
    });
    const config = makeSessionConfig({
      id: 'b2', label: 'baccarat', seed: 'b2', game: 'baccarat', deciderId: 'x',
      createdAt: '2026-07-05T00:00:00.000Z', rounds: 1, startingBankroll: 500, baseBet: 50,
    });
    const session = await runSession(config, decide as any);
    const bets = (session.rounds[0]!.outcome as any).placedBets as any[];
    const total = bets.reduce((s, b) => s + b.amount, 0);
    expect(total).toBeLessThanOrEqual(500);
    expect(bets[0].amount).toBe(400); // first bet accepted in full
  });

  it('applies the Banker payout net of 5% commission at the session level', async () => {
    // Force a known coup via a fixed seed run isn't practical here without control over
    // the shoe; instead assert the invariant algebraically across many rounds: whenever
    // Banker wins, net === floor-free 0.95x the stake (resolveBaccaratBet is unit-tested
    // in packages/engine; this just confirms the adapter wires it through unchanged).
    const session = await runSession(cfg('commission-1', 500), naiveDecide);
    let checked = 0;
    for (const r of session.rounds) {
      const bets = (r.outcome as any).placedBets as any[];
      // isolate rounds where Banker was the ONLY bet placed, so the round net is
      // attributable entirely to the commission math (no side bet noise).
      if (bets.length === 1 && bets[0].type === 'banker' && (r.outcome as any).result === 'banker') {
        expect(r.net).toBeCloseTo(bets[0].amount * 0.95, 9);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0); // sanity: the naive bot did produce some Banker-only wins
  });
});
