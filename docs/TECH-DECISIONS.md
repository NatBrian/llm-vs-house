# Tech Stack Research & Decisions (2026-era)

Six parallel research passes. Recommendations below; open questions still pending user confirmation.

## 1. Browser game rendering
Two visually distinct classes → potentially different answers, but one base covers most.
- **Base 2D for everything (slots, cards, chips, felt, sprite roulette wheel): PixiJS v8 + GSAP.**
  Both MIT/free, actively maintained (Pixi v8.x active 2026; GSAP now 100% free after Webflow acquisition),
  excellent TypeScript. PixiJS ~3× smaller / ~2× faster than Phaser for pure rendering. Use `@pixi/react`.
- **Card/table UI that benefits from real DOM** (bet controls, HUD, card faces): React DOM/SVG + Motion or GSAP.
- **Sic Bo dice, ONLY if true 3D physics tumbling wanted: react-three-fiber (R3F v9, React 19) + Rapier**
  (Apache-2.0, deterministic → seed-reproducible rolls), mounted in isolation. Otherwise a Pixi canned-roll
  landing on the RNG value does the whole product with a smaller bundle.
- **Avoid:** cannon-es (discontinued 2026), Phaser as app-wide engine (fights React, heavier), raw Canvas 2D.
- Note: a roulette wheel is a rotation tween, not physics — Pixi/SVG + GSAP with an eased landing you control
  to match the RNG outcome. 3D only if a realistic bouncing ball is a product requirement.

## 2. LLM orchestration (multi-provider + structured output)
- **Vercel AI SDK (TypeScript) + Zod, called from a thin backend route (never client-side).**
  - `generateObject({ model, schema, prompt })` uses each provider's native structured mode + validates;
    throws `AI_NoObjectGeneratedError` on invalid → catch + retry (optionally feed error back for self-correct).
    Directly satisfies "schema-validated decision, free-form parsing forbidden."
  - Config-driven provider switching via `createProviderRegistry` + string IDs
    (`"anthropic:…"`, `"openai:…"`, `"google:…"`, Ollama via community provider / OpenAI-compat base URL).
    Switching provider = a config value, not a code fork.
  - TS end-to-end → one repo, shared Zod schema between server route and client types.
- **Architecture rule (unanimous 2026 guidance): thin backend, never client-only.** Browser must not hold
  provider API keys (trivially extractable). Browser POSTs the observation → server holds keys, calls model,
  validates schema, returns typed decision. Also centralizes rate-limit, retry, logging, provider config.
  Local Ollama is the only direct-call-safe case, but route it through the same backend for uniform code.
- **Python-backend alternative:** Pydantic AI (built-in self-correcting retries, Ollama supported) or Instructor.
  LiteLLM only as an optional provider-proxy layer underneath, not the app framework.

## 3. Dashboard + charts + state
- **Component kit: shadcn/ui** (own the code, dark-first, casino-styleable) + **Tremor blocks** (Vercel-owned,
  free, interoperates — KPI/stat tiles) + **TanStack Table** for the session-log grid.
- **Charts: Apache ECharts** (Apache-2.0) as primary — best for multi-session bankroll overlays + `markLine`/
  `markArea` for EV/threshold lines + `dataZoom` doubling as a replay scrubber + Canvas stays smooth on long
  logs. **Recharts** only for simple inline cards (single sparkline / bet-distribution bar).
- **State: Zustand** (append-only event log → replay = re-derive state at index i) **+ TanStack Query**
  (async LLM calls, retries, in-flight status).
- **XState v5 for the per-round machine** (observe→reason→bet→outcome). Casino rounds branch hard
  (hit/stand/double/split/insurance, dealer resolution) → statechart-as-documentation + built-in
  event-sourcing/persistence dovetails with replay. **Scope it to the round only**; app/session state stays Zustand.

## 4. Reasoning-trace visualization
- **Do NOT use a node-graph (React Flow).** Reasoning is linear per round; history is a flat sequence.
  A node-graph adds pan/zoom/layout machinery that buys nothing and hurts scrubbing.
- **Use vertical timeline/stepper for the single round + horizontal round scrubber across history** —
  the pattern every 2026 agent-observability tool (LangSmith, Langfuse, Arize Phoenix, Azure "Trace Replay")
  converged on: ordered step tree/timeline + details pane, plus time-travel/replay.
- **Fastest path: AgentPrism** (Evil Martians, open source, shadcn-style copy-paste, OTel-shaped data) —
  ships TreeView/Timeline/SpanCard/DetailsPanel. Or build a plain shadcn/Radix stepper + custom scrubber.
- Blueprint: round scrubber strip (chips 1…N, color by win/loss + bankroll delta, play/pause + ←/→ + playhead);
  center vertical stepper with 4 fixed stops Observation→Reasoning→Decision→Outcome; right detail panel
  (raw model I/O, tokens, bet, EV, bankroll). Center view = pure function of `rounds[activeRound]`.
- Reserve React Flow only if reasoning later genuinely branches AND the branch topology is what the human reads.

## 5. OSS reference repos (verified last-push dates + licenses)
Safe to borrow (MIT/permissive + fresh):
- Slots: **johakr/html5-slot-machine** (616★, 2026-02, MIT) — complete, polished reels, safe to borrow.
- Sic Bo: **wy/PySicBo** (MIT, Python) — verify payout table only; no good UI ref exists.

Study-only for logic (copyleft / non-standard license — reimplement, don't copy):
- **jconradi/baccarat-engine** (non-standard license) — best ref for fiddly third-card rules.

Visual/UX inspiration (no/unclear license — look, don't vendor):
- **GizzZmo/Cassanova** (Next.js 15, 2026-06) — polished casino dashboard/lobby.
- **oanapopescu93/casino** (2025-06) — all 5 target games in one app.
- **bocaletto-luca/Roulette** (2025-06, GPL) — wheel animation with realistic deceleration.

Weak spots: Roulette + Sic Bo have no fresh+permissive+polished repo — build those UIs ourselves,
verify payouts against PAYOUTS.md not repos.
