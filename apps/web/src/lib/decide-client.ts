// Client-side Decide that proxies each decision to the serverless /api/decide route.
// The Zod schema stays on the client (core re-validates the returned value); only the
// schema NAME crosses the wire, and the server rebuilds the matching schema.

import type { Decide } from '@casino/core';
import type { LlmClientConfig } from './providers';

export function createClientLlmDecide(cfg: LlmClientConfig, onCall?: () => void): Decide {
  return async (req) => {
    onCall?.();
    const res = await fetch('/api/decide', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: cfg.provider,
        model: cfg.model,
        apiKey: cfg.apiKey || undefined,
        baseURL: cfg.baseURL || undefined,
        game: req.game,
        kind: req.kind,
        index: req.index,
        bankroll: req.bankroll,
        baseBet: req.baseBet,
        observation: req.observation,
        legalActions: req.legalActions,
        schemaName: req.schemaName,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`LLM request failed (${res.status}): ${text.slice(0, 300)}`);
    }
    const data = await res.json();
    return { value: data.value, raw: data.raw, meta: data.meta };
  };
}
