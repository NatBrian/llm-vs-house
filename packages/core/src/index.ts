export * from './types.js';
export * from './schemas.js';
export * from './adapters.js';
export * from './bots.js';
export * from './session.js';
export * from './stats.js';

import type { GameId, SessionConfig } from './types.js';
import { ADAPTERS } from './adapters.js';

/**
 * The active, selectable games — every UI game picker and "run for every game"
 * test loop is driven off this list. 'blackjack' is intentionally NOT listed: it
 * is DEPRECATED, not deleted. The engine, adapter, schemas, and rule-bot logic for
 * it still exist and are still tested directly (see engine/test/blackjack.test.ts),
 * but it is excluded here because this project studies LLM behavior on pure-chance,
 * negative-EV games with no skill edge — Blackjack's correct-play skill component
 * (basic strategy) doesn't fit that thesis. Do not add it back to this array.
 */
export const GAME_IDS: GameId[] = ['roulette', 'baccarat', 'sicbo', 'slot'];

/** Build a SessionConfig with sensible defaults for a game. */
export function makeSessionConfig(params: {
  id: string;
  label: string;
  seed: string;
  game: GameId;
  deciderId: string;
  createdAt: string;
  gameConfig?: unknown;
  startingBankroll?: number;
  baseBet?: number;
  rounds?: number;
}): SessionConfig {
  const adapter = ADAPTERS[params.game]!;
  return {
    id: params.id,
    label: params.label,
    seed: params.seed,
    game: params.game,
    gameConfig: params.gameConfig ?? adapter.defaultConfig(),
    deciderId: params.deciderId,
    startingBankroll: params.startingBankroll ?? 1000,
    baseBet: params.baseBet ?? 10,
    rounds: params.rounds ?? 50,
    createdAt: params.createdAt,
  };
}
