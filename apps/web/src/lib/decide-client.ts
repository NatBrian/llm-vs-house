// Client-side Decide that proxies each decision to the serverless /api/decide route.
// The Zod schema stays on the client (core re-validates the returned value); only the
// schema NAME crosses the wire, and the server rebuilds the matching schema.

import type { Decide } from '@casino/core';
import type { LlmClientConfig } from './providers';

const REQUEST_TIMEOUT_MS = 90_000;

export function createClientLlmDecide(cfg: LlmClientConfig, onCall?: () => void): Decide {
  return async (req) => {
    onCall?.();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch('/api/decide', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: ctrl.signal,
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
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error(`LLM request timed out after ${REQUEST_TIMEOUT_MS / 1000}s. The model may be slow or the endpoint unreachable.`);
      }
      throw new Error(`Could not reach /api/decide: ${err instanceof Error ? err.message : String(err)}. If running locally, the serverless route only exists on the deployed site.`);
    }
    clearTimeout(timer);

    const bodyText = await res.text().catch(() => '');
    if (!res.ok) {
      let msg = bodyText.slice(0, 400);
      try { msg = JSON.parse(bodyText).error ?? msg; } catch { /* keep raw text */ }
      throw new Error(`LLM request failed (HTTP ${res.status}): ${msg}`);
    }
    let data: any;
    try { data = JSON.parse(bodyText); }
    catch { throw new Error(`LLM route returned non-JSON (HTTP ${res.status}): ${bodyText.slice(0, 200)}`); }
    if (data?.error) throw new Error(`LLM error: ${data.error}`);
    return { value: data.value, raw: data.raw, meta: data.meta };
  };
}
