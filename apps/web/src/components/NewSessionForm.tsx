import { useStore } from '../store';
import { GAME_IDS, type GameId } from '@casino/core';
import { GAME_META } from '../lib/format';
import { PROVIDERS } from '../lib/providers';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wide text-white/40">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls = 'w-full rounded-md bg-ink-850 border border-white/10 px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-gold-500/60';

export function NewSessionForm() {
  const form = useStore((s) => s.form);
  const setForm = useStore((s) => s.setForm);
  const setLlm = useStore((s) => s.setLlm);
  const run = useStore((s) => s.run);
  const running = useStore((s) => s.running);
  const progress = useStore((s) => s.progress);
  const error = useStore((s) => s.error);

  const provider = PROVIDERS.find((p) => p.id === form.llm.provider)!;

  return (
    <div className="glass rounded-xl p-4 flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-white/80">New session</h2>

      <div>
        <span className="text-[11px] uppercase tracking-wide text-white/40">Game</span>
        <div className="mt-1 grid grid-cols-5 gap-1.5">
          {GAME_IDS.map((g: GameId) => (
            <button
              key={g}
              onClick={() => setForm({ game: g })}
              title={GAME_META[g]!.name}
              className={`aspect-square rounded-lg text-xl flex items-center justify-center border transition ${
                form.game === g ? 'bg-gold-500/20 border-gold-500 scale-105' : 'bg-ink-850 border-white/10 hover:border-white/30'
              }`}
            >
              {GAME_META[g]!.icon}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-white/40">{GAME_META[form.game]!.name} · edge {GAME_META[form.game]!.edge}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Rounds">
          <input type="number" min={1} max={500} value={form.rounds}
            onChange={(e) => setForm({ rounds: Math.max(1, Math.min(500, +e.target.value || 1)) })} className={inputCls} />
        </Field>
        <Field label="Seed">
          <input value={form.seed} onChange={(e) => setForm({ seed: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Bankroll">
          <input type="number" min={1} value={form.startingBankroll}
            onChange={(e) => setForm({ startingBankroll: Math.max(1, +e.target.value || 1) })} className={inputCls} />
        </Field>
        <Field label="Base bet">
          <input type="number" min={1} value={form.baseBet}
            onChange={(e) => setForm({ baseBet: Math.max(1, +e.target.value || 1) })} className={inputCls} />
        </Field>
      </div>

      <div>
        <span className="text-[11px] uppercase tracking-wide text-white/40">Player</span>
        <div className="mt-1 flex rounded-lg overflow-hidden border border-white/10">
          {(['baseline', 'llm'] as const).map((p) => (
            <button key={p} onClick={() => setForm({ player: p })}
              className={`flex-1 py-1.5 text-sm capitalize transition ${form.player === p ? 'bg-gold-500 text-ink-950 font-medium' : 'text-white/60 hover:text-white'}`}>
              {p === 'baseline' ? 'Rule bot' : 'LLM'}
            </button>
          ))}
        </div>
      </div>

      {form.player === 'llm' && (
        <div className="flex flex-col gap-2 rounded-lg bg-ink-850/60 p-2.5 border border-white/5">
          <Field label="Provider">
            <select value={form.llm.provider} onChange={(e) => setLlm({ provider: e.target.value as any })} className={inputCls}>
              {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Model">
            <input value={form.llm.model} placeholder={provider.exampleModel} onChange={(e) => setLlm({ model: e.target.value })} className={inputCls} />
          </Field>
          {provider.needsKey && (
            <Field label="API key (kept in memory, sent per request)">
              <input type="password" value={form.llm.apiKey} onChange={(e) => setLlm({ apiKey: e.target.value })} className={inputCls} placeholder="sk-…" />
            </Field>
          )}
          {(provider.needsBaseURL || form.llm.provider === 'ollama') && (
            <Field label="Base URL">
              <input value={form.llm.baseURL} onChange={(e) => setLlm({ baseURL: e.target.value })} className={inputCls} placeholder="https://…/v1" />
            </Field>
          )}
          <p className="text-[10px] text-white/35 leading-snug">
            Keys are sent to the serverless route per request and never stored. Leave blank to use a server-side env key.
          </p>
        </div>
      )}

      <Field label="Label (optional)">
        <input value={form.label} onChange={(e) => setForm({ label: e.target.value })} className={inputCls} placeholder="auto" />
      </Field>

      <button
        onClick={() => void run()}
        disabled={running}
        className="mt-1 rounded-lg bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-ink-950 font-semibold py-2 text-sm transition"
      >
        {running ? (progress?.label ?? 'Running…') : '▶ Run session'}
      </button>

      {error && !running && (
        <p className="text-xs text-red-200 bg-chip-red/15 border border-chip-red/40 rounded-md px-2.5 py-2 leading-snug break-words">
          {error}
        </p>
      )}
    </div>
  );
}
