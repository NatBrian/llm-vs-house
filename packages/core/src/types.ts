// Core round-loop types shared by adapters, session runner, bots, and LLM decider.

import type { ZodTypeAny } from 'zod';
import type { Rng } from '@casino/engine';
import type { GameId } from '@casino/engine';

export type { GameId };

/** A request the game makes to whoever is deciding (bot or LLM). */
export interface DecisionRequest {
  kind: 'bet' | 'action';
  game: GameId;
  /** Round index (0-based). */
  index: number;
  bankroll: number;
  baseBet: number;
  /** Plain, serializable game-state the decider reasons over. */
  observation: Record<string, unknown>;
  /** For 'action' requests (Blackjack): the legal moves. */
  legalActions?: string[];
  /** Zod schema the returned value must satisfy. */
  schema: ZodTypeAny;
  /** Human name of the schema, for logs/UI. */
  schemaName: string;
}

/** What a decider returns. `value` must satisfy request.schema. */
export interface DecideResult {
  value: unknown;
  /** Raw model text, when the decider is an LLM. */
  raw?: string;
  /** model id, tokens, latency, retries, etc. */
  meta?: Record<string, unknown>;
}

export type Decide = (req: DecisionRequest) => Promise<DecideResult>;

/** One recorded decision inside a round (a round may have several — Blackjack). */
export interface DecisionStep {
  kind: 'bet' | 'action';
  observation: Record<string, unknown>;
  legalActions?: string[];
  decision: unknown;     // validated payload (includes reasoning)
  reasoning: string;
  raw?: string;
  meta?: Record<string, unknown>;
}

/** Everything needed to reconstruct exactly what happened in a round. */
export interface RoundRecord {
  index: number;
  game: GameId;
  steps: DecisionStep[];
  /** Engine result: pocket / dice / coup / spin / blackjack settlement. */
  outcome: unknown;
  net: number;
  bankrollBefore: number;
  bankrollAfter: number;
}

export interface SessionConfig {
  id: string;
  label: string;
  seed: string;
  game: GameId;
  gameConfig: unknown;
  /** Identifier of who is playing: 'baseline' or e.g. 'llm:anthropic:claude-...'. */
  deciderId: string;
  startingBankroll: number;
  baseBet: number;
  rounds: number;
  createdAt: string;
}

export interface Session {
  config: SessionConfig;
  rounds: RoundRecord[];
  finalBankroll: number;
  /** True if the session stopped early because the bankroll could not cover a bet. */
  bustedOut: boolean;
  /** True if the run was stopped by the user before completing all rounds. */
  stopped?: boolean;
}

export interface RoundContext {
  rng: Rng;
  index: number;
  bankroll: number;
  baseBet: number;
  config: unknown;
  decide: Decide;
}

export interface RoundResult {
  steps: DecisionStep[];
  outcome: unknown;
  net: number;
}

export interface GameAdapter {
  id: GameId;
  label: string;
  defaultConfig(): unknown;
  playRound(ctx: RoundContext): Promise<RoundResult>;
}
