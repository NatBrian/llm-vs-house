// Provider registry. Native SDKs for Anthropic / OpenAI / Google; everything else
// (Ollama, OpenRouter, KiloCode, any custom gateway) via the OpenAI-compatible
// adapter. Which provider+model is used is pure config, never hardcoded.

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';

export type ProviderId =
  | 'anthropic' | 'openai' | 'google'
  | 'ollama' | 'openrouter' | 'kilocode' | 'openai-compatible';

export interface LlmConfig {
  provider: ProviderId;
  model: string;
  apiKey?: string;
  /** Base URL for OpenAI-compatible providers (required for kilocode/openai-compatible). */
  baseURL?: string;
}

const OLLAMA_DEFAULT_BASE = 'http://localhost:11434/v1';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const KILOCODE_BASE = 'https://api.kilo.ai/api/gateway';

export const PROVIDER_PRESETS: Record<ProviderId, { label: string; needsKey: boolean; needsBaseURL: boolean; exampleModel: string }> = {
  anthropic: { label: 'Anthropic (Claude)', needsKey: true, needsBaseURL: false, exampleModel: 'claude-sonnet-5' },
  openai: { label: 'OpenAI', needsKey: true, needsBaseURL: false, exampleModel: 'gpt-5' },
  google: { label: 'Google Gemini', needsKey: true, needsBaseURL: false, exampleModel: 'gemini-2.5-pro' },
  ollama: { label: 'Ollama (local)', needsKey: false, needsBaseURL: false, exampleModel: 'gemma3:12b' },
  openrouter: { label: 'OpenRouter', needsKey: true, needsBaseURL: false, exampleModel: 'anthropic/claude-sonnet-5' },
  kilocode: { label: 'KiloCode', needsKey: true, needsBaseURL: false, exampleModel: 'kilo-auto/free' },
  'openai-compatible': { label: 'Custom (OpenAI-compatible)', needsKey: false, needsBaseURL: true, exampleModel: '' },
};

/** Providers whose structured output goes through a generic gateway; prefer JSON mode. */
export const GATEWAY_PROVIDERS: ReadonlySet<ProviderId> = new Set(['ollama', 'openrouter', 'kilocode', 'openai-compatible']);

function requireBaseURL(cfg: LlmConfig): string {
  if (!cfg.baseURL) throw new Error(`provider '${cfg.provider}' requires a baseURL`);
  return cfg.baseURL;
}

export function resolveModel(cfg: LlmConfig): LanguageModel {
  switch (cfg.provider) {
    case 'anthropic':
      return createAnthropic({ apiKey: cfg.apiKey })(cfg.model);
    case 'openai':
      return createOpenAI({ apiKey: cfg.apiKey })(cfg.model);
    case 'google':
      return createGoogleGenerativeAI({ apiKey: cfg.apiKey })(cfg.model);
    case 'ollama':
      return createOpenAICompatible({ name: 'ollama', baseURL: cfg.baseURL ?? OLLAMA_DEFAULT_BASE, apiKey: cfg.apiKey ?? 'ollama' })(cfg.model);
    case 'openrouter':
      return createOpenAICompatible({ name: 'openrouter', baseURL: cfg.baseURL ?? OPENROUTER_BASE, apiKey: cfg.apiKey ?? '' })(cfg.model);
    case 'kilocode':
      return createOpenAICompatible({ name: 'kilocode', baseURL: cfg.baseURL ?? KILOCODE_BASE, apiKey: cfg.apiKey ?? '' })(cfg.model);
    case 'openai-compatible':
      return createOpenAICompatible({ name: 'custom', baseURL: requireBaseURL(cfg), apiKey: cfg.apiKey ?? '' })(cfg.model);
  }
}
