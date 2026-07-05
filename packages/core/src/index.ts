export * from './types.js';
export * from './schemas.js';
export * from './adapters.js';
export * from './bots.js';
export * from './session.js';
export * from './stats.js';

import type { GameId, SessionConfig } from './types.js';
import { ADAPTERS } from './adapters.js';

export const GAME_IDS: GameId[] = ['roulette', 'blackjack', 'baccarat', 'sicbo', 'slot'];

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
