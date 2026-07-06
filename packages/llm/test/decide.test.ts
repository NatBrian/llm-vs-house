import { describe, it, expect } from 'vitest';
import { buildPrompt, createLlmDecide, resolveModel } from '../src/index.js';
import {
  runSession, makeSessionConfig, computeStats, type DecisionRequest,
} from '@casino/core';
import { RouletteDecisionSchema } from '@casino/core';

const cfg = { provider: 'anthropic' as const, model: 'claude-test', apiKey: 'sk-test' };

describe('provider resolution (offline, construction only)', () => {
  it('builds a model for each provider without calling the API', () => {
    expect(() => resolveModel({ provider: 'anthropic', model: 'm', apiKey: 'k' })).not.toThrow();
    expect(() => resolveModel({ provider: 'openai', model: 'm', apiKey: 'k' })).not.toThrow();
    expect(() => resolveModel({ provider: 'google', model: 'm', apiKey: 'k' })).not.toThrow();
    expect(() => resolveModel({ provider: 'ollama', model: 'm' })).not.toThrow();
    expect(() => resolveModel({ provider: 'openrouter', model: 'm', apiKey: 'k' })).not.toThrow();
    expect(() => resolveModel({ provider: 'kilocode', model: 'm', apiKey: 'k' })).not.toThrow(); // has a default base URL
  });
  it('throws when a base-URL-required provider is missing it', () => {
    expect(() => resolveModel({ provider: 'openai-compatible', model: 'm', apiKey: 'k' })).toThrow(/baseURL/);
  });
});

describe('prompt building', () => {
  it('includes bankroll, observation, and simulation framing', () => {
    const req: DecisionRequest = {
      kind: 'bet', game: 'roulette', index: 3, bankroll: 500, baseBet: 10,
      observation: { variant: 'european' }, schema: RouletteDecisionSchema, schemaName: 'RouletteDecision',
    };
    const { system, prompt } = buildPrompt(req);
    expect(system).toContain('no real money and no real gambling');
    expect(prompt).toContain('Round #4');
    expect(prompt).toContain('european');
  });
  it('mentions legal actions for mid-hand action requests', () => {
    const req: DecisionRequest = {
      kind: 'action', game: 'blackjack', index: 0, bankroll: 100, baseBet: 10,
      observation: {}, legalActions: ['hit', 'stand'], schema: RouletteDecisionSchema, schemaName: 'x',
    };
    expect(buildPrompt(req).prompt).toContain('hit, stand');
  });
});

describe('createLlmDecide (injected model)', () => {
  it('returns a schema-validated value with provider meta', async () => {
    const gen = async () => ({ object: { bets: [{ type: 'black', amount: 10 }], reasoning: 'even-money' }, usage: { totalTokens: 42 } });
    const decide = createLlmDecide(cfg, { generateObject: gen, now: () => 1000 });
    const res = await decide({
      kind: 'bet', game: 'roulette', index: 0, bankroll: 100, baseBet: 10,
      observation: {}, schema: RouletteDecisionSchema, schemaName: 'RouletteDecision',
    });
    expect((res.value as any).bets[0].type).toBe('black');
    expect(res.meta?.provider).toBe('anthropic');
    expect(res.meta?.model).toBe('claude-test');
  });

  it('retries on invalid output then succeeds', async () => {
    let calls = 0;
    const gen = async () => {
      calls++;
      if (calls === 1) return { object: { bets: [], reasoning: 'empty' } }; // invalid: min 1 bet
      return { object: { bets: [{ type: 'red', amount: 10 }], reasoning: 'ok' } };
    };
    const decide = createLlmDecide(cfg, { generateObject: gen });
    const res = await decide({
      kind: 'bet', game: 'roulette', index: 0, bankroll: 100, baseBet: 10,
      observation: {}, schema: RouletteDecisionSchema, schemaName: 'RouletteDecision',
    });
    expect(calls).toBe(2);
    expect(res.meta?.attempt).toBe(1);
  });

  it('throws after exhausting retries', async () => {
    const gen = async () => ({ object: { nope: true } });
    const decide = createLlmDecide(cfg, { generateObject: gen, retries: 1 });
    await expect(decide({
      kind: 'bet', game: 'roulette', index: 0, bankroll: 100, baseBet: 10,
      observation: {}, schema: RouletteDecisionSchema, schemaName: 'RouletteDecision',
    })).rejects.toThrow(/failed after 2 attempts/);
  });
});

describe('full session driven by a fake LLM', () => {
  it('runs and produces stats', async () => {
    const gen = async () => ({ object: { bets: [{ type: 'banker', amount: 10 }], reasoning: 'lowest edge' } });
    const decide = createLlmDecide(cfg, { generateObject: gen });
    const config = makeSessionConfig({
      id: 's', label: 'llm baccarat', seed: 'llm', game: 'baccarat',
      deciderId: 'llm:anthropic:claude-test', createdAt: '2026-07-05T00:00:00.000Z', rounds: 20,
    });
    const session = await runSession(config, decide);
    expect(session.rounds.length).toBe(20);
    const stats = computeStats(session);
    expect(stats.betTypeDistribution.banker).toBe(20);
  });
});
