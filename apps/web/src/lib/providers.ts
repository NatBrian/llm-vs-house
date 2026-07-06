// Client-side mirror of the provider presets (the server holds the real registry).
export type ProviderId =
  | 'anthropic' | 'openai' | 'google'
  | 'ollama' | 'openrouter' | 'kilocode' | 'openai-compatible';

export interface ProviderPreset {
  id: ProviderId;
  label: string;
  needsKey: boolean;
  needsBaseURL: boolean;
  exampleModel: string;
}

export const PROVIDERS: ProviderPreset[] = [
  { id: 'anthropic', label: 'Anthropic (Claude)', needsKey: true, needsBaseURL: false, exampleModel: 'claude-sonnet-5' },
  { id: 'openai', label: 'OpenAI', needsKey: true, needsBaseURL: false, exampleModel: 'gpt-5' },
  { id: 'google', label: 'Google Gemini', needsKey: true, needsBaseURL: false, exampleModel: 'gemini-2.5-pro' },
  { id: 'ollama', label: 'Ollama (local)', needsKey: false, needsBaseURL: false, exampleModel: 'gemma3:12b' },
  { id: 'openrouter', label: 'OpenRouter', needsKey: true, needsBaseURL: false, exampleModel: 'anthropic/claude-sonnet-5' },
  { id: 'kilocode', label: 'KiloCode', needsKey: true, needsBaseURL: false, exampleModel: 'kilo-auto/free' },
  { id: 'openai-compatible', label: 'Custom (OpenAI-compatible)', needsKey: true, needsBaseURL: true, exampleModel: '' },
];

export interface LlmClientConfig {
  provider: ProviderId;
  model: string;
  apiKey: string;
  baseURL: string;
}
