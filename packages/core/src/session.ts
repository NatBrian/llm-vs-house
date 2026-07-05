// Session runner + deterministic replay.
// Replay reuses the SAME runner with a decider that returns the logged decisions in
// order, so a replay is bit-for-bit identical by construction (no separate code path).

import { createRng } from '@casino/engine';
import { ADAPTERS } from './adapters.js';
import type { Decide, Session, SessionConfig, RoundRecord } from './types.js';

export interface RunHooks {
  /** Called after each round completes, so the UI can render live during slow (LLM) runs. */
  onRound?: (round: RoundRecord, index: number, total: number) => void;
  /** Abort to stop the run cleanly; completed rounds are kept, no error is thrown. */
  signal?: AbortSignal;
}

export async function runSession(config: SessionConfig, decide: Decide, hooks: RunHooks = {}): Promise<Session> {
  const adapter = ADAPTERS[config.game];
  if (!adapter) throw new Error(`unknown game '${config.game}'`);
  const rng = createRng(config.seed);
  let bankroll = config.startingBankroll;
  const rounds: RoundRecord[] = [];
  let bustedOut = false;
  let stopped = false;
  let quitVoluntarily = false;
  let quitReason: string | undefined;
  let targetHit = false;

  // A human-set stop-loss/take-profit rail, checked against the LIVE bankroll before
  // each round — not the decider's choice, so it applies the same to bots and LLMs.
  // 0 (the default) disables it entirely.
  const target = config.stopTarget ?? 0;
  const targetReached = (b: number): boolean =>
    target !== 0 && (target >= config.startingBankroll ? b >= target : b <= target);

  for (let i = 0; i < config.rounds; i++) {
    if (hooks.signal?.aborted) { stopped = true; break; }
    if (bankroll < config.baseBet) { bustedOut = true; break; }
    if (targetReached(bankroll)) { targetHit = true; break; }
    const before = bankroll;
    let res;
    try {
      res = await adapter.playRound({
        rng, index: i, bankroll: before, baseBet: config.baseBet, config: config.gameConfig, decide,
        history: rounds.slice(),
      });
    } catch (err) {
      if (hooks.signal?.aborted) { stopped = true; break; } // aborted mid-round: drop it, stop cleanly
      throw err;
    }
    bankroll = before + res.net;
    const round: RoundRecord = {
      index: i, game: config.game, steps: res.steps, outcome: res.outcome,
      net: res.net, bankrollBefore: before, bankrollAfter: bankroll,
    };
    rounds.push(round);
    hooks.onRound?.(round, i, config.rounds);
    // The decider chose to walk away after this round — a real casino is walk-in-
    // walk-out free, so this ends the session cleanly (not a bust, not an abort).
    if (res.stop) {
      quitVoluntarily = true;
      quitReason = round.steps[round.steps.length - 1]?.reasoning;
      break;
    }
  }

  return { config, rounds, finalBankroll: bankroll, bustedOut, stopped, quitVoluntarily, quitReason, targetHit };
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
