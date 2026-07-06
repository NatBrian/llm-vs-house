import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import {
  runSession, replaySession, naiveDecide, makeRuleBot, DEFAULT_RULE_BOT_CONFIG, makeSessionConfig, computeStats,
  type Session, type GameId, type Decide, type RuleBotConfig,
} from '@casino/core';
import type { LlmClientConfig, ProviderId } from './lib/providers';
import { createClientLlmDecide, CancelledError } from './lib/decide-client';

/** localStorage shim that silently drops writes when quota is exceeded. */
const quotaSafeStorage: StateStorage = {
  getItem: (name) => localStorage.getItem(name),
  setItem: (name, value) => {
    try { localStorage.setItem(name, value); }
    catch (e) { if (!(e instanceof DOMException && e.name === 'QuotaExceededError')) throw e; }
  },
  removeItem: (name) => localStorage.removeItem(name),
};

export interface FormState {
  label: string;
  game: GameId;
  seed: string;
  rounds: number;
  startingBankroll: number;
  baseBet: number;
  /** Bankroll target for the Rule bot / Naive bot to stop at (0 = disabled). Above
   *  startingBankroll it's a take-profit; below it's a stop-loss. The LLM decides
   *  when to stop on its own, so this only applies to the deterministic bots. */
  stopTarget: number;
  player: 'baseline' | 'naive' | 'llm';
  llm: LlmClientConfig;
  /** Human-chosen fixed bet + sizing strategy for the "Rule bot" player. */
  ruleBot: RuleBotConfig;
  /** Which real casino table to play: MBS (single-zero) or RWS (double-zero,
   *  adds the 0/00 combo box, Top Line, and wheel-sector Series bets). */
  rouletteVariant: 'european' | 'american';
}

interface RunProgress { done: number; label: string }

interface StoreState {
  sessions: Session[];
  activeId: string | null;
  playhead: number;          // round index currently shown
  autoplay: boolean;
  running: boolean;
  stopping: boolean;
  abortController: AbortController | null;
  progress: RunProgress | null;
  error: string | null;
  form: FormState;

  setForm: (patch: Partial<FormState>) => void;
  setLlm: (patch: Partial<LlmClientConfig>) => void;
  setRuleBot: (patch: Partial<RuleBotConfig>) => void;
  run: () => Promise<void>;
  stop: () => void;
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
  stopTarget: 0,
  player: 'baseline',
  llm: { provider: 'anthropic' as ProviderId, model: 'claude-sonnet-5', apiKey: '', baseURL: '' },
  ruleBot: DEFAULT_RULE_BOT_CONFIG,
  rouletteVariant: 'european',
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeId: null,
      playhead: 0,
      autoplay: false,
      running: false,
      stopping: false,
      abortController: null,
      progress: null,
      error: null,
      form: defaultForm,

      setForm: (patch) => set((s) => ({ form: { ...s.form, ...patch } })),
      setLlm: (patch) => set((s) => ({ form: { ...s.form, llm: { ...s.form.llm, ...patch } } })),
      setRuleBot: (patch) => set((s) => ({ form: { ...s.form, ruleBot: { ...s.form.ruleBot, ...patch } } })),

      stop: () => {
        get().abortController?.abort();
        set({ stopping: true, progress: { done: 0, label: 'Stopping…' } });
      },

      run: async () => {
        const { form } = get();
        const id = crypto.randomUUID();
        const isLlm = form.player === 'llm';
        const ac = new AbortController();
        set({ running: true, stopping: false, abortController: ac, error: null, progress: { done: 0, label: isLlm ? 'Contacting model…' : 'Running…' } });
        try {
          const deciderId = isLlm ? `llm:${form.llm.provider}:${form.llm.model}` : form.player;
          const botLabel = form.player === 'naive' ? 'Naive bot' : 'Baseline';
          const label = form.label.trim()
            || `${isLlm ? form.llm.model : botLabel} · ${form.game}`;

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
            // Only bots get a human-set stop target — the LLM decides for itself (see its
            // own `stop` field in the decision schema instead).
            stopTarget: isLlm ? 0 : form.stopTarget,
            ...(form.game === 'roulette' ? { gameConfig: { variant: form.rouletteVariant } } : {}),
          });

          // Push a live placeholder so the table renders as rounds stream in (esp. for slow LLM runs).
          const live: Session = { config, rounds: [], finalBankroll: config.startingBankroll, bustedOut: false };
          set((s) => ({ sessions: [live, ...s.sessions].slice(0, 10), activeId: id, playhead: 0, autoplay: false }));

          let decide: Decide;
          if (!isLlm) {
            // A fresh makeRuleBot() instance per run: its sizing strategy (martingale/
            // paroli) tracks a streak in closure state, so reusing one across runs
            // would leak a previous session's streak into the next.
            decide = form.player === 'naive' ? naiveDecide : makeRuleBot(form.ruleBot);
          } else {
            decide = createClientLlmDecide(form.llm, () => {
              if (!get().stopping) set({ progress: { done: 0, label: 'Model deciding…' } });
            }, ac.signal);
          }

          const onRound = (round: Session['rounds'][number]) => {
            set((s) => ({
              sessions: s.sessions.map((x) =>
                x.config.id === id ? { ...x, rounds: [...x.rounds, round], finalBankroll: round.bankrollAfter } : x),
              playhead: round.index,
              progress: { done: round.index + 1, label: `Round ${round.index + 1}/${config.rounds}` },
            }));
          };

          const session = await runSession(config, decide, { onRound, signal: ac.signal });

          const keep = session.rounds.length > 0;
          set((s) => ({
            sessions: keep
              ? s.sessions.map((x) => (x.config.id === id ? session : x))
              : s.sessions.filter((x) => x.config.id !== id),
            activeId: keep ? id : (s.sessions.find((x) => x.config.id !== id)?.config.id ?? null),
            running: false,
            stopping: false,
            abortController: null,
            progress: null,
            autoplay: !isLlm && !session.stopped,          // baseline: replay-animate; LLM already streamed live
            playhead: isLlm ? Math.max(0, session.rounds.length - 1) : 0,
            form: { ...s.form, seed: randomSeed(), label: '' },
          }));
        } catch (err) {
          const cancelled = err instanceof CancelledError || (err as any)?.name === 'CancelledError';
          set((s) => ({
            // Keep a partial run if any rounds streamed; drop an empty placeholder.
            sessions: s.sessions.filter((x) => !(x.config.id === id && x.rounds.length === 0)),
            running: false,
            stopping: false,
            abortController: null,
            progress: null,
            error: cancelled ? null : (err instanceof Error ? err.message : String(err)),
          }));
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
      version: 4,
      storage: createJSONStorage(() => quotaSafeStorage),
      migrate: () => ({ sessions: [] as Session[], form: defaultForm }),
      partialize: (s) => ({
        sessions: s.sessions.slice(0, 10) as Session[],
        form: { ...s.form, llm: { ...s.form.llm, apiKey: '' } },
      }),
    },
  ),
);

export function activeSession(s: StoreState): Session | null {
  return s.sessions.find((x) => x.config.id === s.activeId) ?? null;
}

export { computeStats };
