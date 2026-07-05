import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  runSession, replaySession, baselineDecide, makeSessionConfig, computeStats,
  type Session, type GameId, type Decide,
} from '@casino/core';
import type { LlmClientConfig, ProviderId } from './lib/providers';
import { createClientLlmDecide } from './lib/decide-client';

export interface FormState {
  label: string;
  game: GameId;
  seed: string;
  rounds: number;
  startingBankroll: number;
  baseBet: number;
  player: 'baseline' | 'llm';
  llm: LlmClientConfig;
}

interface RunProgress { done: number; label: string }

interface StoreState {
  sessions: Session[];
  activeId: string | null;
  playhead: number;          // round index currently shown
  autoplay: boolean;
  running: boolean;
  progress: RunProgress | null;
  error: string | null;
  form: FormState;

  setForm: (patch: Partial<FormState>) => void;
  setLlm: (patch: Partial<LlmClientConfig>) => void;
  run: () => Promise<void>;
  selectSession: (id: string) => void;
  removeSession: (id: string) => void;
  setPlayhead: (i: number) => void;
  setAutoplay: (v: boolean) => void;
  replayActive: () => Promise<{ ok: boolean; message: string } | null>;
  clearError: () => void;
}

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

const defaultForm: FormState = {
  label: '',
  game: 'roulette',
  seed: randomSeed(),
  rounds: 40,
  startingBankroll: 1000,
  baseBet: 10,
  player: 'baseline',
  llm: { provider: 'anthropic' as ProviderId, model: 'claude-sonnet-5', apiKey: '', baseURL: '' },
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeId: null,
      playhead: 0,
      autoplay: false,
      running: false,
      progress: null,
      error: null,
      form: defaultForm,

      setForm: (patch) => set((s) => ({ form: { ...s.form, ...patch } })),
      setLlm: (patch) => set((s) => ({ form: { ...s.form, llm: { ...s.form.llm, ...patch } } })),

      run: async () => {
        const { form } = get();
        set({ running: true, error: null, progress: { done: 0, label: 'Starting…' } });
        try {
          const id = crypto.randomUUID();
          const deciderId = form.player === 'baseline'
            ? 'baseline'
            : `llm:${form.llm.provider}:${form.llm.model}`;
          const label = form.label.trim()
            || `${form.player === 'baseline' ? 'Baseline' : form.llm.model} · ${form.game}`;

          const config = makeSessionConfig({
            id,
            label,
            seed: form.seed || randomSeed(),
            game: form.game,
            deciderId,
            createdAt: new Date().toISOString(),
            startingBankroll: form.startingBankroll,
            baseBet: form.baseBet,
            rounds: form.rounds,
          });

          let decide: Decide;
          if (form.player === 'baseline') {
            decide = baselineDecide;
          } else {
            let calls = 0;
            decide = createClientLlmDecide(form.llm, () => {
              calls++;
              set({ progress: { done: calls, label: `LLM deciding… (${calls} calls)` } });
            });
          }

          const session = await runSession(config, decide);
          set((s) => ({
            sessions: [session, ...s.sessions].slice(0, 40),
            activeId: id,
            playhead: 0,
            autoplay: true,
            running: false,
            progress: null,
            form: { ...s.form, seed: randomSeed(), label: '' },
          }));
        } catch (err) {
          set({ running: false, progress: null, error: err instanceof Error ? err.message : String(err) });
        }
      },

      selectSession: (id) => set({ activeId: id, playhead: 0, autoplay: false }),
      removeSession: (id) => set((s) => {
        const sessions = s.sessions.filter((x) => x.config.id !== id);
        const activeId = s.activeId === id ? (sessions[0]?.config.id ?? null) : s.activeId;
        return { sessions, activeId, playhead: 0 };
      }),
      setPlayhead: (i) => set({ playhead: Math.max(0, i) }),
      setAutoplay: (v) => set({ autoplay: v }),

      replayActive: async () => {
        const { sessions, activeId } = get();
        const session = sessions.find((s) => s.config.id === activeId);
        if (!session) return null;
        const replay = await replaySession(session);
        const same = replay.finalBankroll === session.finalBankroll
          && replay.rounds.length === session.rounds.length
          && replay.rounds.every((r, i) => r.net === session.rounds[i]!.net);
        return {
          ok: same,
          message: same
            ? `Replay verified identical: ${replay.rounds.length} rounds, final ${replay.finalBankroll} pts.`
            : 'Replay diverged — determinism violation!',
        };
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'llm-vs-house',
      partialize: (s) => ({ sessions: s.sessions, form: { ...s.form, llm: { ...s.form.llm, apiKey: '' } } }),
    },
  ),
);

export function activeSession(s: StoreState): Session | null {
  return s.sessions.find((x) => x.config.id === s.activeId) ?? null;
}

export { computeStats };
