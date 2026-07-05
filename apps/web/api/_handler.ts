// Shared LLM decision handler used by both the Vercel and Netlify function wrappers.
// Rebuilds the Zod schema from its name, runs one LLM decision, returns {value,raw,meta}.
// API key comes from the request (BYO-key) or falls back to a server-side env var.

import {
  RouletteDecisionSchema, BaccaratDecisionSchema, SicBoDecisionSchema,
  SlotDecisionSchema, BlackjackBetSchema, BlackjackActionSchema,
  type DecisionRequest,
} from '@casino/core';
import { createLlmDecide, type ProviderId } from '@casino/llm';
import type { ZodTypeAny } from 'zod';

const SCHEMAS: Record<string, ZodTypeAny> = {
  RouletteDecision: RouletteDecisionSchema,
  BaccaratDecision: BaccaratDecisionSchema,
  SicBoDecision: SicBoDecisionSchema,
  SlotDecision: SlotDecisionSchema,
  BlackjackBet: BlackjackBetSchema,
  BlackjackAction: BlackjackActionSchema,
};

const ENV_KEY: Partial<Record<ProviderId, string>> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  kilocode: 'KILOCODE_API_KEY',
};

export interface DecidePayload {
  provider: ProviderId;
  model: string;
  apiKey?: string;
  baseURL?: string;
  game: DecisionRequest['game'];
  kind: DecisionRequest['kind'];
  index: number;
  bankroll: number;
  baseBet: number;
  observation: Record<string, unknown>;
  legalActions?: string[];
  schemaName: string;
}

export async function handleDecide(payload: DecidePayload): Promise<{ status: number; json: unknown }> {
  const schema = SCHEMAS[payload.schemaName];
  if (!schema) return { status: 400, json: { error: `unknown schema '${payload.schemaName}'` } };
  if (!payload.provider || !payload.model) return { status: 400, json: { error: 'provider and model are required' } };

  const envVar = ENV_KEY[payload.provider];
  const apiKey = payload.apiKey || (envVar ? process.env[envVar] : undefined);

  const decide = createLlmDecide({
    provider: payload.provider,
    model: payload.model,
    apiKey,
    baseURL: payload.baseURL,
  });

  const req: DecisionRequest = {
    kind: payload.kind,
    game: payload.game,
    index: payload.index,
    bankroll: payload.bankroll,
    baseBet: payload.baseBet,
    observation: payload.observation,
    ...(payload.legalActions ? { legalActions: payload.legalActions } : {}),
    schema,
    schemaName: payload.schemaName,
  };

  try {
    const result = await decide(req);
    return { status: 200, json: { value: result.value, raw: result.raw, meta: result.meta } };
  } catch (err) {
    return { status: 502, json: { error: err instanceof Error ? err.message : String(err) } };
  }
}
