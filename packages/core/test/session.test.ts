import { describe, it, expect } from 'vitest';
import {
  runSession, replaySession, baselineDecide, makeSessionConfig, computeStats,
  GAME_IDS, type GameId, type SessionConfig,
} from '../src/index.js';

function cfg(game: GameId, seed = 'test-seed', rounds = 40): SessionConfig {
  return makeSessionConfig({
    id: `s-${game}`, label: game, seed, game, deciderId: 'baseline',
    createdAt: '2026-07-05T00:00:00.000Z', rounds, startingBankroll: 1000, baseBet: 10,
  });
}

describe('baseline sessions run for every game', () => {
  for (const game of GAME_IDS) {
    it(`${game}: produces rounds and a valid bankroll path`, async () => {
      const session = await runSession(cfg(game), baselineDecide);
      expect(session.rounds.length).toBeGreaterThan(0);
      // Bankroll path is internally consistent.
      for (const r of session.rounds) {
        expect(r.bankrollAfter).toBeCloseTo(r.bankrollBefore + r.net, 9);
        expect(r.steps.length).toBeGreaterThan(0);
        expect(r.steps[0]!.reasoning.length).toBeGreaterThan(0);
      }
      const last = session.rounds[session.rounds.length - 1]!;
      expect(session.finalBankroll).toBe(last.bankrollAfter);
    });
  }
});

describe('deterministic replay is bit-identical', () => {
  for (const game of GAME_IDS) {
    it(`${game}: replay reproduces identical outcomes and nets`, async () => {
      const original = await runSession(cfg(game, `seed-${game}`), baselineDecide);
      const replay = await replaySession(original);
      expect(replay.rounds.length).toBe(original.rounds.length);
      expect(replay.finalBankroll).toBe(original.finalBankroll);
      for (let i = 0; i < original.rounds.length; i++) {
        expect(replay.rounds[i]!.net).toBe(original.rounds[i]!.net);
        expect(replay.rounds[i]!.outcome).toEqual(original.rounds[i]!.outcome);
      }
    });
  }
});

describe('same seed => identical session', () => {
  it('blackjack full-play run reproduces exactly', async () => {
    const a = await runSession(cfg('blackjack', 'same'), baselineDecide);
    const b = await runSession(cfg('blackjack', 'same'), baselineDecide);
    expect(a.finalBankroll).toBe(b.finalBankroll);
    expect(a.rounds.map((r) => r.net)).toEqual(b.rounds.map((r) => r.net));
  });
  it('different seeds => different bankroll paths', async () => {
    const a = await runSession(cfg('roulette', 'seed-x', 60), baselineDecide);
    const b = await runSession(cfg('roulette', 'seed-y', 60), baselineDecide);
    expect(a.finalBankroll).not.toBe(b.finalBankroll);
  });
});

describe('stats', () => {
  it('bankroll series matches rounds and win/loss/push partition', async () => {
    const session = await runSession(cfg('baccarat', 'stats'), baselineDecide);
    const stats = computeStats(session);
    expect(stats.bankrollSeries.length).toBe(session.rounds.length + 1);
    expect(stats.wins + stats.losses + stats.pushes).toBe(session.rounds.length);
    expect(stats.finalBankroll).toBe(session.finalBankroll);
    expect(stats.betTypeDistribution.banker).toBeGreaterThan(0);
    expect(stats.totalStaked).toBeGreaterThan(0);
  });

  it('blackjack multi-step rounds record more than one step sometimes', async () => {
    const session = await runSession(cfg('blackjack', 'multi', 60), baselineDecide);
    const maxSteps = Math.max(...session.rounds.map((r) => r.steps.length));
    expect(maxSteps).toBeGreaterThan(1); // at least one hand had a play action beyond the bet
  });
});

describe('schema validation rejects malformed decisions', () => {
  it('throws when the decider returns an invalid bet shape', async () => {
    const badDecide = async () => ({ value: { bets: [{ type: 'red' }], reasoning: 'x' } }); // missing amount
    await expect(runSession(cfg('roulette'), badDecide as any)).rejects.toThrow();
  });
});
