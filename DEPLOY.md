# Deploying LLM vs House (free tier)

The app is a static Vite SPA plus one serverless function (`/api/decide`) for LLM mode.
**The baseline (rule-bot) demo is 100% client-side and needs no server, no keys** — it
works even on pure static hosting. The serverless function is only used when a session's
player is set to "LLM".

## Vercel (recommended — full LLM support on free tier)

1. Push the repo to GitHub.
2. In Vercel: **New Project → import the repo**.
3. Set **Root Directory = `apps/web`**. Vercel reads `apps/web/vercel.json`:
   - Build: builds the three workspace packages to `dist`, then `vite build`.
   - Output: `apps/web/dist`.
   - The `apps/web/api/decide.ts` function is deployed automatically at `/api/decide`.
4. (Optional) Add provider keys as **Environment Variables** so users don't have to paste
   their own: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`,
   `OPENROUTER_API_KEY`, `KILOCODE_API_KEY`. If unset, users supply a key in the UI
   (sent per request, never stored) — or just use the keyless rule-bot.
5. Deploy.

## Netlify

`netlify.toml` (repo root) is preconfigured: builds packages + app, publishes
`apps/web/dist`, deploys `apps/web/netlify/functions/decide.mts`, and redirects
`/api/*` → the function. Same optional env keys as above.

1. New site from Git → pick the repo. Netlify reads `netlify.toml`.
2. Deploy.

## Static-only (GitHub Pages, Cloudflare Pages, S3, …)

Run `pnpm build` and publish `apps/web/dist`. The rule-bot, all five games, replay, and
the compare dashboard work fully. LLM mode will error (no `/api/decide`) — expected.

## Local

```bash
pnpm install
pnpm --filter @casino/web dev      # http://localhost:5173  (rule-bot works offline)
pnpm build                         # production build of packages + app
pnpm --filter @casino/web preview  # serve the production build
```

## Notes

- **Keys**: the browser never bundles a provider key. In LLM mode the key is sent to the
  serverless route per request and used transiently; with env keys set, the browser sends
  no key at all and it stays fully server-side.
- **Bundle**: ECharts is code-split into an on-demand chunk (loads only on the Compare tab);
  initial JS is ~126 KB gzip.
- **Determinism**: a session is fully reproducible from its seed + logged decisions — the
  "Replay & verify" button re-runs it and confirms an identical result.
