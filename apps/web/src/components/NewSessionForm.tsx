import { useStore } from '../store';
import { GAME_IDS, type GameId, type RuleBotConfig } from '@casino/core';
import { GAME_META } from '../lib/format';
import { PROVIDERS } from '../lib/providers';

const ROULETTE_BETS: Array<{ value: string; label: string; americanOnly?: boolean }> = [
  { value: 'red', label: 'Red (1:1)' },
  { value: 'black', label: 'Black (1:1)' },
  { value: 'odd', label: 'Odd (1:1)' },
  { value: 'even', label: 'Even (1:1)' },
  { value: 'low', label: 'Low 1-18 (1:1)' },
  { value: 'high', label: 'High 19-36 (1:1)' },
  { value: 'dozen-1', label: '1st Dozen 1-12 (2:1)' },
  { value: 'dozen-2', label: '2nd Dozen 13-24 (2:1)' },
  { value: 'dozen-3', label: '3rd Dozen 25-36 (2:1)' },
  { value: 'column-1', label: '1st Column (2:1)' },
  { value: 'column-2', label: '2nd Column (2:1)' },
  { value: 'column-3', label: '3rd Column (2:1)' },
  { value: 'straight', label: 'Straight up (35:1)' },
  { value: 'series3-1', label: '3 Numbers Series (11:1)' },
  { value: 'series6-1', label: '6 Numbers Series (5:1)' },
  { value: 'five', label: 'Top Line 0/00/1/2/3 (5:1, 21.05% edge)', americanOnly: true },
  { value: 'zeroCombo', label: '0/00 Combo (11:1, 36.84% edge)', americanOnly: true },
];
const BACCARAT_BETS: Array<{ value: RuleBotConfig['baccarat']['type']; label: string }> = [
  { value: 'banker', label: 'Banker (0.95:1, 1.06% edge)' },
  { value: 'player', label: 'Player (1:1, 1.24% edge)' },
  { value: 'tie', label: 'Tie (8:1, 14.36% edge)' },
  { value: 'playerPair', label: 'Player Pair (11:1)' },
  { value: 'bankerPair', label: 'Banker Pair (11:1)' },
];
const SICBO_BETS: Array<{ value: RuleBotConfig['sicbo']['type']; label: string }> = [
  { value: 'small', label: 'Small 4-10 (1:1, 2.78% edge)' },
  { value: 'big', label: 'Big 11-17 (1:1, 2.78% edge)' },
  { value: 'odd', label: 'Odd (1:1, 2.78% edge)' },
  { value: 'even', label: 'Even (1:1, 2.78% edge)' },
  { value: 'combo', label: 'Two-dice combo (6:1, 2.78% edge)' },
  { value: 'total', label: 'Total (varies, 7.41-12.5% edge, pick 4-17)' },
  { value: 'anytriple', label: 'Any triple (31:1, 11.11% edge)' },
  { value: 'double', label: 'Double (11:1, 11.11% edge)' },
  { value: 'single', label: 'Single number (1:1/2:1/12:1, 3.70% edge)' },
  { value: 'triple', label: 'Specific triple (180:1, 16.20% edge)' },
  { value: 'doubleAny', label: 'Double + single (50:1, 29.17% edge)' },
  { value: 'threeSingleCombo', label: 'Three single dice (30:1, 13.89% edge)' },
  { value: 'threeFromFour', label: 'Three from four (7:1, 11.11% edge)' },
];
const SLOT_DENOMS = [1, 2, 5, 10, 25, 50];
const SIZING_OPTIONS: Array<{ value: RuleBotConfig['sizing']; label: string; hint: string }> = [
  { value: 'flat', label: 'Flat', hint: 'Same stake every round.' },
  { value: 'martingale', label: 'Martingale', hint: 'Double after a loss, reset after a win.' },
  { value: 'paroli', label: 'Paroli', hint: 'Double after a win, reset after a loss.' },
];

/** Encode/decode the roulette dozen/column/series selector into a single <select> value. */
function rouletteValue(b: RuleBotConfig['roulette']): string {
  if (b.type === 'dozen' || b.type === 'column') return `${b.type}-${b.selector ?? 1}`;
  if (b.type === 'series3' || b.type === 'series6') return `${b.type}-${b.seriesGroup ?? 1}`;
  return b.type;
}
function rouletteFromValue(v: string): RuleBotConfig['roulette'] {
  const [type, sel] = v.split('-');
  if (type === 'dozen' || type === 'column') return { type, selector: (Number(sel) || 1) as 1 | 2 | 3 };
  if (type === 'series3' || type === 'series6') return { type, seriesGroup: Number(sel) || 1 };
  if (type === 'straight') return { type: 'straight', numbers: [0] };
  return { type: type as RuleBotConfig['roulette']['type'] };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wide text-white/40">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls = 'w-full rounded-md bg-ink-850 border border-white/10 px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-gold-500/60';

/** Human-configurable panel for the Rule Bot: pick its fixed bet and stake-sizing strategy. */
function RuleBotConfigPanel() {
  const form = useStore((s) => s.form);
  const setRuleBot = useStore((s) => s.setRuleBot);
  const { game, ruleBot } = form;

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-ink-850/60 p-2.5 border border-white/5">
      {game === 'roulette' && (
        <Field label="Fixed bet">
          <select
            value={rouletteValue(ruleBot.roulette)}
            onChange={(e) => setRuleBot({ roulette: rouletteFromValue(e.target.value) })}
            className={inputCls}
          >
            {ROULETTE_BETS.filter((o) => !o.americanOnly || form.rouletteVariant === 'american')
              .map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {ruleBot.roulette.type === 'straight' && (
            <input type="number" min={0} max={36} value={ruleBot.roulette.numbers?.[0] ?? 0}
              onChange={(e) => setRuleBot({ roulette: { type: 'straight', numbers: [Math.max(0, Math.min(36, +e.target.value || 0))] } })}
              className={`${inputCls} mt-1.5`} placeholder="Number 0-36" />
          )}
          {(ruleBot.roulette.type === 'series3' || ruleBot.roulette.type === 'series6') && (
            <input type="number" min={1} max={ruleBot.roulette.type === 'series3' ? 12 : 6} value={ruleBot.roulette.seriesGroup ?? 1}
              onChange={(e) => setRuleBot({
                roulette: { type: ruleBot.roulette.type, seriesGroup: Math.max(1, Math.min(ruleBot.roulette.type === 'series3' ? 12 : 6, +e.target.value || 1)) },
              })}
              className={`${inputCls} mt-1.5`} placeholder={`Group 1-${ruleBot.roulette.type === 'series3' ? 12 : 6}`} />
          )}
        </Field>
      )}

      {game === 'baccarat' && (
        <Field label="Fixed bet">
          <select value={ruleBot.baccarat.type} onChange={(e) => setRuleBot({ baccarat: { type: e.target.value as any } })} className={inputCls}>
            {BACCARAT_BETS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      )}

      {game === 'sicbo' && (
        <Field label="Fixed bet">
          <select
            value={ruleBot.sicbo.type}
            onChange={(e) => setRuleBot({ sicbo: { type: e.target.value as any } })}
            className={inputCls}
          >
            {SICBO_BETS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {ruleBot.sicbo.type === 'total' && (
            <input type="number" min={4} max={17} value={ruleBot.sicbo.total ?? 9}
              onChange={(e) => setRuleBot({ sicbo: { ...ruleBot.sicbo, total: Math.max(4, Math.min(17, +e.target.value || 9)) } })}
              className={`${inputCls} mt-1.5`} placeholder="Total 4-17" />
          )}
          {(ruleBot.sicbo.type === 'single' || ruleBot.sicbo.type === 'double' || ruleBot.sicbo.type === 'triple') && (
            <input type="number" min={1} max={6} value={ruleBot.sicbo.face ?? 4}
              onChange={(e) => setRuleBot({ sicbo: { ...ruleBot.sicbo, face: Math.max(1, Math.min(6, +e.target.value || 4)) } })}
              className={`${inputCls} mt-1.5`} placeholder="Face 1-6" />
          )}
          {ruleBot.sicbo.type === 'combo' && (
            <div className="flex gap-1.5 mt-1.5">
              {[0, 1].map((i) => (
                <input key={i} type="number" min={1} max={6} value={ruleBot.sicbo.faces?.[i] ?? (i === 0 ? 1 : 2)}
                  onChange={(e) => {
                    const faces: [number, number] = [...(ruleBot.sicbo.faces ?? [1, 2])] as [number, number];
                    faces[i] = Math.max(1, Math.min(6, +e.target.value || 1));
                    setRuleBot({ sicbo: { ...ruleBot.sicbo, faces } });
                  }}
                  className={inputCls} placeholder={`Face ${i + 1}`} />
              ))}
            </div>
          )}
          {ruleBot.sicbo.type === 'doubleAny' && (
            <div className="flex gap-1.5 mt-1.5">
              <input type="number" min={1} max={6} value={ruleBot.sicbo.face ?? 2}
                onChange={(e) => setRuleBot({ sicbo: { ...ruleBot.sicbo, face: Math.max(1, Math.min(6, +e.target.value || 2)) } })}
                className={inputCls} placeholder="Double face" />
              <input type="number" min={1} max={6} value={ruleBot.sicbo.partner ?? 3}
                onChange={(e) => setRuleBot({ sicbo: { ...ruleBot.sicbo, partner: Math.max(1, Math.min(6, +e.target.value || 3)) } })}
                className={inputCls} placeholder="Partner face" />
            </div>
          )}
          {ruleBot.sicbo.type === 'threeSingleCombo' && (
            <div className="flex gap-1.5 mt-1.5">
              {[0, 1, 2].map((i) => (
                <input key={i} type="number" min={1} max={6} value={ruleBot.sicbo.triple?.[i] ?? [1, 2, 6][i]}
                  onChange={(e) => {
                    const triple: [number, number, number] = [...(ruleBot.sicbo.triple ?? [1, 2, 6])] as [number, number, number];
                    triple[i] = Math.max(1, Math.min(6, +e.target.value || 1));
                    setRuleBot({ sicbo: { ...ruleBot.sicbo, triple } });
                  }}
                  className={inputCls} placeholder={`Face ${i + 1}`} />
              ))}
            </div>
          )}
          {ruleBot.sicbo.type === 'threeFromFour' && (
            <input type="number" min={1} max={4} value={ruleBot.sicbo.group ?? 1}
              onChange={(e) => setRuleBot({ sicbo: { ...ruleBot.sicbo, group: Math.max(1, Math.min(4, +e.target.value || 1)) } })}
              className={`${inputCls} mt-1.5`} placeholder="Group 1-4 (1234/2345/2356/3456)" />
          )}
        </Field>
      )}

      {game === 'blackjack' && (
        <p className="text-[11px] text-white/45">Actions follow correct basic strategy; only the stake size is configurable below.</p>
      )}

      {game === 'slot' && (
        <Field label="Machine controls">
          <div className="flex gap-1.5">
            <select
              value={ruleBot.slot.denomination}
              onChange={(e) => setRuleBot({ slot: { ...ruleBot.slot, denomination: Number(e.target.value) } })}
              className={inputCls} disabled={ruleBot.slot.useMax}
            >
              {SLOT_DENOMS.map((d) => <option key={d} value={d}>{d}pt denom</option>)}
            </select>
            <input type="number" min={1} max={10} value={ruleBot.slot.betLevel} disabled={ruleBot.slot.useMax}
              onChange={(e) => setRuleBot({ slot: { ...ruleBot.slot, betLevel: Math.max(1, Math.min(10, +e.target.value || 1)) } })}
              className={inputCls} placeholder="Bet level 1-10" />
          </div>
          <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-white/60">
            <input type="checkbox" checked={!!ruleBot.slot.useMax}
              onChange={(e) => setRuleBot({ slot: { ...ruleBot.slot, useMax: e.target.checked } })} />
            Always press Bet Max
          </label>
        </Field>
      )}

      <Field label="Stake sizing">
        <select value={ruleBot.sizing} onChange={(e) => setRuleBot({ sizing: e.target.value as any })} className={inputCls}>
          {SIZING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="mt-1 text-[10px] text-white/40">{SIZING_OPTIONS.find((o) => o.value === ruleBot.sizing)!.hint}</p>
      </Field>
    </div>
  );
}

export function NewSessionForm() {
  const form = useStore((s) => s.form);
  const setForm = useStore((s) => s.setForm);
  const setLlm = useStore((s) => s.setLlm);
  const run = useStore((s) => s.run);
  const stop = useStore((s) => s.stop);
  const running = useStore((s) => s.running);
  const stopping = useStore((s) => s.stopping);
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

      {form.game === 'roulette' && (
        <Field label="Table">
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {([
              { value: 'european' as const, label: 'MBS · Single-Zero' },
              { value: 'american' as const, label: 'RWS · Double-Zero' },
            ]).map((o) => (
              <button key={o.value} onClick={() => setForm({ rouletteVariant: o.value })}
                className={`flex-1 py-1.5 text-xs transition ${form.rouletteVariant === o.value ? 'bg-gold-500 text-ink-950 font-medium' : 'text-white/60 hover:text-white'}`}>
                {o.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-white/40">
            {form.rouletteVariant === 'american'
              ? 'RWS-style: 38 pockets (0 and 00), plus the Top Line, 0/00 Combo, and Series bets.'
              : 'MBS-style: 37 pockets (single 0), 2.70% base house edge.'}
          </p>
        </Field>
      )}

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
          {(['baseline', 'naive', 'llm'] as const).map((p) => (
            <button key={p} onClick={() => setForm({ player: p })}
              className={`flex-1 py-1.5 text-sm capitalize transition ${form.player === p ? 'bg-gold-500 text-ink-950 font-medium' : 'text-white/60 hover:text-white'}`}>
              {p === 'baseline' ? 'Rule bot' : p === 'naive' ? 'Naive bot' : 'LLM'}
            </button>
          ))}
        </div>
        {form.player === 'naive' && (
          <p className="mt-1 text-[11px] text-white/45">Casual player: sprays a few random bets across the table respecting table minimums (Sic Bo, Roulette, Baccarat — Player/Banker as the main line plus an occasional Tie/Pair side bet); Slot and Blackjack fall back to a flat Rule Bot bet.</p>
        )}
      </div>

      {form.player !== 'llm' && (
        <Field label="Stop target (optional)">
          <input type="number" min={0} value={form.stopTarget}
            onChange={(e) => setForm({ stopTarget: Math.max(0, +e.target.value || 0) })}
            className={inputCls} placeholder="0 = disabled" />
          <p className="mt-1 text-[10px] text-white/40">
            0 disables it. Above bankroll ({form.startingBankroll}): take-profit — stop once reached. Below: stop-loss —
            stop once dropped to it. The bot itself never decides to stop; this is a hard rail you set.
          </p>
        </Field>
      )}

      {form.player === 'baseline' && <RuleBotConfigPanel />}

      {form.player === 'llm' && (
        <div className="flex flex-col gap-2 rounded-lg bg-ink-850/60 p-2.5 border border-white/5">
          <Field label="Provider">
            <select name="llm-provider" value={form.llm.provider} onChange={(e) => setLlm({ provider: e.target.value as any })} className={inputCls}>
              {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Model">
            <input name="llm-model" value={form.llm.model} placeholder={provider.exampleModel} onChange={(e) => setLlm({ model: e.target.value })} className={inputCls} />
          </Field>
          {provider.needsKey && (
            <Field label="API key (kept in memory, sent per request)">
              <input name="llm-apikey" type="password" value={form.llm.apiKey} onChange={(e) => setLlm({ apiKey: e.target.value })} className={inputCls} placeholder="sk-…" />
            </Field>
          )}
          {(provider.needsBaseURL || form.llm.provider === 'ollama') && (
            <Field label="Base URL">
              <input name="llm-baseurl" value={form.llm.baseURL} onChange={(e) => setLlm({ baseURL: e.target.value })} className={inputCls} placeholder="https://…/v1" />
            </Field>
          )}
          <p className="text-[10px] text-white/35 leading-snug">
            Keys are sent to the serverless route per request and never stored. Leave blank to use a server-side env key.
            Each round is a separate model call, so a full run streams in over time — rounds appear live as they finish.
          </p>
        </div>
      )}

      <Field label="Label (optional)">
        <input value={form.label} onChange={(e) => setForm({ label: e.target.value })} className={inputCls} placeholder="auto" />
      </Field>

      {running ? (
        <button
          onClick={stop}
          disabled={stopping}
          className="mt-1 rounded-lg bg-chip-red hover:bg-red-500 disabled:opacity-60 text-white font-semibold py-2 text-sm transition flex items-center justify-center gap-2"
        >
          <span>{stopping ? 'Stopping…' : '■ Stop'}</span>
          {progress?.label && !stopping && <span className="text-white/70 font-normal text-xs">· {progress.label}</span>}
        </button>
      ) : (
        <button
          onClick={() => void run()}
          className="mt-1 rounded-lg bg-gold-500 hover:bg-gold-400 text-ink-950 font-semibold py-2 text-sm transition"
        >
          ▶ Run session
        </button>
      )}

      {error && !running && (
        <p className="text-xs text-red-200 bg-chip-red/15 border border-chip-red/40 rounded-md px-2.5 py-2 leading-snug break-words">
          {error}
        </p>
      )}
    </div>
  );
}
