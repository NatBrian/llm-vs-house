// Session runner + deterministic replay.
// Replay reuses the SAME runner with a decider that returns the logged decisions in
// order, so a replay is bit-for-bit identical by construction (no separate code path).

import { createRng } from '@casino/engine';
import { ADAPTERS } from './adapters.js';
import type { Decide, Session, SessionConfig, RoundRecord } from './types.js';

export async function runSession(config: SessionConfig, decide: Decide): Promise<Session> {
  const adapter = ADAPTERS[config.game];
  if (!adapter) throw new Error(`unknown game '${config.game}'`);
  const rng = createRng(config.seed);
  let bankroll = config.startingBankroll;
  const rounds: RoundRecord[] = [];
  let bustedOut = false;

  for (let i = 0; i < config.rounds; i++) {
    if (bankroll < config.baseBet) { bustedOut = true; break; }
    const before = bankroll;
    const res = await adapter.playRound({
      rng, index: i, bankroll: before, baseBet: config.baseBet, config: config.gameConfig, decide,
    });
    bankroll = before + res.net;
    rounds.push({
      index: i, game: config.game, steps: res.steps, outcome: res.outcome,
      net: res.net, bankrollBefore: before, bankrollAfter: bankroll,
    });
  }

  return { config, rounds, finalBankroll: bankroll, bustedOut };
}

/** A decider that replays a session's logged decisions in order (no LLM/bot call). */
export function replayDecider(session: Session): Decide {
  const queue: Array<{ value: unknown; raw?: string; meta?: Record<string, unknown> }> = [];
  for (const round of session.rounds) {
    for (const step of round.steps) {
      queue.push({
        value: step.decision,
        ...(step.raw !== undefined ? { raw: step.raw } : {}),
        ...(step.meta !== undefined ? { meta: step.meta } : {}),
      });
    }
  }
  let i = 0;
  return async () => {
    const next = queue[i++];
    if (!next) throw new Error('replay decider exhausted — decision stream diverged');
    return next;
  };
}

/** Re-run a session from its seed + logged decisions. Must equal the original. */
export async function replaySession(session: Session): Promise<Session> {
  return runSession(session.config, replayDecider(session));
}
