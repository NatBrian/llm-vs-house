// Turns an LlmConfig into a core `Decide`. Uses generateObject so the model returns
// a schema-validated object (never free-form text), with retry-on-invalid. The whole
// thing is injectable (deps.generateObject) so it is unit-testable without any API key.

import { generateObject } from 'ai';
import type { Decide, DecisionRequest } from '@casino/core';
import { resolveModel, type LlmConfig } from './providers.js';

const GAME_TITLES: Record<string, string> = {
  roulette: 'Roulette', blackjack: 'Blackjack', baccarat: 'Baccarat',
  sicbo: 'Sic Bo', slot: 'a Slot Machine',
};

export function buildPrompt(req: DecisionRequest): { system: string; prompt: string } {
  const title = GAME_TITLES[req.game] ?? req.game;
  const system = [
    `You are an autonomous player of ${title} in a RESEARCH SIMULATION.`,
    'All currency is simulated points — there is no real money and no real gambling.',
    'Each round you receive a structured game-state observation and must return a decision',
    'that STRICTLY matches the provided schema. Consider house edge, bankroll, and variance.',
    'Keep "reasoning" concise (1–3 sentences) and specific to this observation.',
    req.kind === 'action'
      ? 'You are mid-hand: choose exactly ONE action from the legal actions listed.'
      : 'Choose your bet(s). Do not stake more than the bankroll.',
  ].join(' ');

  const lines = [
    `Round #${req.index + 1}. Bankroll: ${req.bankroll} points. Base bet: ${req.baseBet}.`,
    `Observation: ${JSON.stringify(req.observation)}`,
  ];
  if (req.legalActions) lines.push(`Legal actions: ${req.legalActions.join(', ')}.`);
  lines.push('Return your decision as structured output matching the schema.');
  return { system, prompt: lines.join('\n') };
}

export interface LlmDecideDeps {
  /** Override for tests; defaults to the AI SDK's generateObject. */
  generateObject?: (args: any) => Promise<{ object: any; usage?: unknown }>;
  retries?: number;
  now?: () => number;
}

export function createLlmDecide(cfg: LlmConfig, deps: LlmDecideDeps = {}): Decide {
  const model = resolveModel(cfg);
  const gen = deps.generateObject ?? ((args: any) => generateObject({ ...args, model }));
  const retries = deps.retries ?? 2;
  const now = deps.now ?? (() => Date.now());

  return async (req) => {
    const { system, prompt } = buildPrompt(req);
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const start = now();
        const result = await gen({ model, schema: req.schema, system, prompt });
        const value = req.schema.parse(result.object); // defense in depth
        return {
          value,
          raw: JSON.stringify(result.object),
          meta: {
            provider: cfg.provider, model: cfg.model, attempt,
            latencyMs: now() - start, usage: result.usage,
          },
        };
      } catch (err) {
        lastErr = err;
      }
    }
    throw new Error(`LLM decision failed after ${retries + 1} attempts: ${String(lastErr)}`);
  };
}
