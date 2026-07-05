import { describe, it, expect } from 'vitest';
import {
  runSession, makeRuleBot, makeSessionConfig, type SessionConfig, type GameId,
} from '../src/index.js';
import { SICBO_MIN_BET } from '@casino/engine';

function cfg(
  seed: string, rounds = 100, startingBankroll = 100000, baseBet = 10, game: GameId = 'roulette',
): SessionConfig {
  return makeSessionConfig({
    id: `rb-${seed}`, label: 'rulebot', seed, game, deciderId: 'baseline',
    createdAt: '2026-07-05T00:00:00.000Z', rounds, startingBankroll, baseBet,
  });
}

describe('makeRuleBot: default config matches the old hardcoded baseline', () => {
  it('roulette defaults to flat Red', async () => {
    const session = await runSession(cfg('r1'), makeRuleBot());
    const types = new Set(session.rounds.map((r) => (r.outcome as any).placedBets[0].type));
    expect(types).toEqual(new Set(['red']));
    const amounts = new Set(session.rounds.map((r) => (r.outcome as any).placedBets[0].amount));
    expect(amounts).toEqual(new Set([10])); // flat sizing never changes
  });
});

describe('makeRuleBot: human-configurable fixed bet', () => {
  it('roulette: bot plays the configured bet type every round (Black)', async () => {
    const session = await runSession(
      cfg('r2', 100, 100000, 10, 'roulette'),
      makeRuleBot({ roulette: { type: 'black' } }),
    );
    for (const r of session.rounds) {
      expect((r.outcome as any).placedBets[0].type).toBe('black');
    }
  });

  it('baccarat: bot plays the configured bet type every round (Tie)', async () => {
    const session = await runSession(
      cfg('r3', 100, 100000, 10, 'baccarat'),
      makeRuleBot({ baccarat: { type: 'tie' } }),
    );
    for (const r of session.rounds) {
      expect((r.outcome as any).placedBets[0].type).toBe('tie');
    }
  });

  it('sicbo: bot plays the configured Total and respects that family\'s table minimum', async () => {
    const session = await runSession(
      cfg('r4', 100, 100000, 1, 'sicbo'), // baseBet below the total's min -> min should win
      makeRuleBot({ sicbo: { type: 'total', total: 9 } }),
    );
    for (const r of session.rounds) {
      const b = (r.outcome as any).placedBets[0];
      expect(b.type).toBe('total');
      expect(b.total).toBe(9);
      expect(b.amount).toBeGreaterThanOrEqual(SICBO_MIN_BET.total);
    }
  });
});

describe('makeRuleBot: sizing strategies', () => {
  it('flat sizing never changes the stake regardless of wins/losses', async () => {
    const session = await runSession(cfg('sz-flat', 150), makeRuleBot({ sizing: 'flat' }));
    const stakes = new Set(session.rounds.map((r) => (r.outcome as any).placedBets[0].amount));
    expect(stakes).toEqual(new Set([10]));
  });

  it('martingale doubles the stake after a loss and resets after a win', async () => {
    const session = await runSession(cfg('sz-mart', 150), makeRuleBot({ sizing: 'martingale' }));
    for (let i = 1; i < session.rounds.length; i++) {
      const prev = session.rounds[i - 1]!;
      const stakePrev = (prev.outcome as any).placedBets[0].amount as number;
      const stakeNow = (session.rounds[i]!.outcome as any).placedBets[0].amount as number;
      if (prev.net < 0) {
        // doubled, unless capped by the bankroll or the safety multiple
        expect(stakeNow).toBeGreaterThanOrEqual(stakePrev);
      } else {
        expect(stakeNow).toBe(10); // reset to base unit after a win or push
      }
    }
  });

  it('paroli doubles the stake after a win and resets after a loss', async () => {
    const session = await runSession(cfg('sz-par', 150), makeRuleBot({ sizing: 'paroli' }));
    for (let i = 1; i < session.rounds.length; i++) {
      const prev = session.rounds[i - 1]!;
      const stakePrev = (prev.outcome as any).placedBets[0].amount as number;
      const stakeNow = (session.rounds[i]!.outcome as any).placedBets[0].amount as number;
      if (prev.net > 0) {
        expect(stakeNow).toBeGreaterThanOrEqual(stakePrev);
      } else {
        expect(stakeNow).toBe(10);
      }
    }
  });

  it('is capped so a long streak cannot grow the stake unboundedly', async () => {
    const session = await runSession(cfg('sz-cap', 300, 1_000_000, 10), makeRuleBot({ sizing: 'martingale' }));
    const maxStake = Math.max(...session.rounds.map((r) => (r.outcome as any).placedBets[0].amount));
    expect(maxStake).toBeLessThanOrEqual(10 * 32); // SIZING_CAP_MULTIPLE
  });
});

describe('makeRuleBot: two independent instances do not share sizing state', () => {
  it('a fresh bot instance always starts flat at the base unit', async () => {
    const a = await runSession(cfg('iso-a', 60), makeRuleBot({ sizing: 'martingale' }));
    const b = await runSession(cfg('iso-b', 5), makeRuleBot({ sizing: 'martingale' })); // fresh instance
    expect((b.rounds[0]!.outcome as any).placedBets[0].amount).toBe(10);
    expect(a.rounds.length).toBeGreaterThan(0); // sanity: a actually ran
  });
});
