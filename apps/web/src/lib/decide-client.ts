// Client-side Decide that proxies each decision to the serverless /api/decide route.
// The Zod schema stays on the client (core re-validates the returned value); only the
// schema NAME crosses the wire, and the server rebuilds the matching schema.

import type { Decide } from '@casino/core';
import type { LlmClientConfig } from './providers';

const REQUEST_TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 3;               // total tries per decision on transient failures
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class CancelledError extends Error {
  constructor() { super('cancelled'); this.name = 'CancelledError'; }
}

export function createClientLlmDecide(cfg: LlmClientConfig, onCall?: () => void, external?: AbortSignal): Decide {
  return async (req) => {
    if (external?.aborted) throw new CancelledError();
    const payload = JSON.stringify({
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
    });

    let lastError = '';
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (external?.aborted) throw new CancelledError();
      onCall?.();
      const ctrl = new AbortController();
      const onExternalAbort = () => ctrl.abort();
      external?.addEventListener('abort', onExternalAbort, { once: true });
      const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch('/api/decide', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: ctrl.signal,
          body: payload,
        });
      } catch (err) {
        clearTimeout(timer);
        external?.removeEventListener('abort', onExternalAbort);
        if (external?.aborted) throw new CancelledError(); // user stopped — don't retry or error
        const aborted = err instanceof DOMException && err.name === 'AbortError';
        lastError = aborted
          ? `timed out after ${REQUEST_TIMEOUT_MS / 1000}s`
          : `network error (${err instanceof Error ? err.message : String(err)})`;
        if (attempt < MAX_ATTEMPTS) { await sleep(800 * attempt); continue; }
        throw new Error(`Could not reach /api/decide: ${lastError}. The model may be slow, or the request was dropped — try again or lower the round count.`);
      }
      clearTimeout(timer);
      external?.removeEventListener('abort', onExternalAbort);

      const bodyText = await res.text().catch(() => '');
      if (!res.ok) {
        let msg = bodyText.slice(0, 400);
        try { msg = JSON.parse(bodyText).error ?? msg; } catch { /* keep raw text */ }
        if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_ATTEMPTS) {
          lastError = `HTTP ${res.status}: ${msg}`;
          await sleep(800 * attempt);
          continue;
        }
        throw new Error(`LLM request failed (HTTP ${res.status}): ${msg}`);
      }

      let data: any;
      try { data = JSON.parse(bodyText); }
      catch { throw new Error(`LLM route returned non-JSON (HTTP ${res.status}): ${bodyText.slice(0, 200)}`); }
      if (data?.error) throw new Error(`LLM error: ${data.error}`);
      return { value: data.value, raw: data.raw, meta: data.meta };
    }
    throw new Error(`LLM request failed after ${MAX_ATTEMPTS} attempts: ${lastError}`);
  };
}
