# LLM vs House

A harness for studying **how large language models take risk when there is no edge to find.**

Most "AI plays casino" projects choose *beatable* games — solved-strategy Poker,
computer-vision ball tracking in Roulette — and measure whether a model can execute a known
positive-expectation strategy. That is a skill benchmark.

This project asks a different, behavioral question. On games that are **pure chance and
negative expectation** — principally **Sic Bo**, with Slots and even-money Roulette as
companions — no strategy can win over time. The house edge is fixed and unavoidable. So the
only thing left to observe is *behavior*:

> Given a bankroll and no way to win in the long run, does an LLM gamble like a reckless human —
> chasing losses, oversizing bets, reaching for high-variance long-shots — or does it manage
> risk more rationally than we do?

The tool puts a model in the seat, one round at a time (observe → reason → bet → outcome),
logs every decision and its stated reasoning, and lets you replay and compare runs across
models, prompts, or against a rule-based baseline.

**This is a research simulation. All currency is simulated points. There is no real money,
no gambling infrastructure, and no payment processing.**

## What it does

- Puts an LLM in one of four games (Sic Bo, Slots, Roulette, Baccarat) and requires a
  **schema-validated** decision every round. Bets are never parsed from free-form text — the model
  returns a typed object or the round is retried.
- Records, per round, the observation shown to the model, its raw response, the parsed decision,
  its reasoning, and the outcome — enough to reconstruct exactly what happened.
- Runs the simulation **deterministically from a seed**: the same seed and the same decisions
  always produce the same outcome, so any session can be replayed without calling the model again.
- Compares multiple sessions — different models, prompts, or an LLM against a rule-based baseline —
  with aggregate statistics (win rate, expected value per round, ROI, bet distribution) and a
  bankroll-over-time chart.
- Ships a polished, animated table for each game and a scrubbable timeline of the agent's
  reasoning, so a human can follow and step through what the model was "thinking" each round.

## Why the negative-EV framing matters

On Sic Bo every bet carries a fixed house edge — 2.78% on Small/Big, up to roughly 19% on the
totals and long-shot triples. No sequence of decisions changes that. The classic *gambler's ruin*
result guarantees that flat, repeated negative-expectation betting trends toward zero. Because the
destination is fixed, the interesting signal is the *path*: how the model sizes bets after wins
versus losses, its appetite for low-probability high-payout wagers, and whether its stated
reasoning matches what it actually does. The harness is built to surface those, not to hunt for an
edge that does not exist.

## Architecture

A TypeScript pnpm monorepo. The simulation core is independent of any model or UI.

| Package | Responsibility |
|---|---|
| `packages/engine` | Deterministic game engines and payout tables. Pure functions of a seeded RNG. No LLM, no UI. |
| `packages/core` | The round loop, Zod decision schemas, a rule-based baseline player, the session log, deterministic replay, and statistics. |
| `packages/llm` | Provider registry and structured-output decision calls (Anthropic, OpenAI, Google, Ollama, OpenRouter, KiloCode, or any OpenAI-compatible endpoint), with validation and retry. |
| `apps/web` | The interface: animated game tables, the reasoning timeline, the comparison dashboard, and a serverless route for model calls. |

Payout tables and house edges are verified against a reputable source (Wizard of Odds) and
checked in code — by full enumeration where the outcome space is small (Roulette, Sic Bo, Slots)
and by fixed-shoe rule tests plus Monte Carlo where it is not (Baccarat). See
[`docs/PAYOUTS.md`](docs/PAYOUTS.md). Incorrect payouts would silently invalidate every run, so
this is treated as the source of truth.

## Running locally

```bash
pnpm install
pnpm --filter @casino/web dev      # http://localhost:5173
```

The rule-based baseline player runs entirely in the browser with no API key. To have a model
play, pick a provider in the UI and supply a key (held in memory, sent per request, never
stored), or configure a server-side key on deploy.

```bash
pnpm test           # engine + core + llm unit tests
pnpm typecheck
pnpm build          # production build
```

## Deploying

The app is a static single-page app plus one serverless function for model calls. The baseline
demo is fully client-side and needs no server or key; the function is used only in LLM mode.
Configuration for Vercel and Netlify (free tier) is included — see [`DEPLOY.md`](DEPLOY.md).

## Status

The harness is complete and tested: four deterministic engines, the full logging / replay /
compare pipeline, six model providers, and the interface. Unit tests and a browser end-to-end run
pass across all games. What it does *not* yet include is a battery of published behavioral results
— that is the study the harness exists to run.

## Scope

This is an instrument for observing model behavior under fixed, unfavorable odds. It is not a
gambling product, not gambling advice, and not usable with real money.
