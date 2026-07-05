import { useState } from 'react';
import { useStore, activeSession } from '../store';
import { fmt, signed } from '../lib/format';

export function ReasoningPanel() {
  const session = useStore(activeSession);
  const playhead = useStore((s) => s.playhead);
  const setPlayhead = useStore((s) => s.setPlayhead);
  const autoplay = useStore((s) => s.autoplay);
  const setAutoplay = useStore((s) => s.setAutoplay);
  const replayActive = useStore((s) => s.replayActive);
  const [verify, setVerify] = useState<{ ok: boolean; message: string } | null>(null);

  if (!session) {
    return <div className="glass rounded-xl p-6 text-center text-white/40 text-sm">Run a session to inspect the agent's reasoning.</div>;
  }

  if (session.rounds.length === 0) {
    return <div className="glass rounded-xl p-6 text-center text-white/40 text-sm">Waiting for the agent's first decision…</div>;
  }

  const total = session.rounds.length;
  const idx = Math.max(0, Math.min(playhead, total - 1));
  const round = session.rounds[idx]!;

  return (
    <div className="glass rounded-xl p-4 flex flex-col gap-3">
      {/* Scrubber */}
      <div className="flex items-center gap-3">
        <button onClick={() => setPlayhead(idx - 1)} disabled={idx <= 0}
          className="w-8 h-8 rounded-lg bg-ink-800 border border-white/10 disabled:opacity-30 hover:border-white/30">◀</button>
        <button onClick={() => setAutoplay(!autoplay)}
          className="w-8 h-8 rounded-lg bg-gold-500 text-ink-950 font-bold hover:bg-gold-400">{autoplay ? '❚❚' : '▶'}</button>
        <button onClick={() => setPlayhead(idx + 1)} disabled={idx >= total - 1}
          className="w-8 h-8 rounded-lg bg-ink-800 border border-white/10 disabled:opacity-30 hover:border-white/30">▶</button>
        <input
          type="range" min={0} max={total - 1} value={idx}
          onChange={(e) => { setAutoplay(false); setPlayhead(+e.target.value); }}
          className="flex-1 accent-gold-500"
        />
        <span className="text-xs text-white/50 tabular-nums w-20 text-right">Round {idx + 1}/{total}</span>
      </div>

      {/* Round summary */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-white/60">Bankroll {fmt(round.bankrollBefore)} → <span className="text-white font-medium">{fmt(round.bankrollAfter)}</span></span>
        <span className={`font-semibold tabular-nums ${round.net > 0 ? 'text-chip-green' : round.net < 0 ? 'text-chip-red' : 'text-white/60'}`}>
          {signed(round.net)} pts
        </span>
      </div>

      {/* Reasoning steps */}
      <div className="flex flex-col gap-2">
        {round.steps.map((step, i) => (
          <div key={i} className="rounded-lg bg-ink-850/70 border border-white/5 p-2.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/10 text-white/60">{step.kind}</span>
              {step.legalActions && <span className="text-[10px] text-white/30">of {step.legalActions.join(' / ')}</span>}
              <span className="ml-auto text-[10px] text-white/30">
                {(step.decision as any).action ?? summarizeBet(step.decision)}
              </span>
            </div>
            <p className="text-sm text-white/80 leading-snug">{step.reasoning || <em className="text-white/30">no reasoning</em>}</p>
            {step.meta?.model != null && (
              <p className="text-[10px] text-white/30 mt-1">{String(step.meta.model)}{step.meta.latencyMs != null ? ` · ${step.meta.latencyMs}ms` : ''}</p>
            )}
          </div>
        ))}
      </div>

      {/* Replay verify */}
      <div className="flex items-center gap-3 pt-1 border-t border-white/5">
        <button
          onClick={async () => setVerify(await replayActive())}
          className="text-xs px-3 py-1.5 rounded-lg bg-ink-800 border border-white/10 hover:border-gold-500/50"
        >
          ⟲ Replay &amp; verify determinism
        </button>
        {verify && (
          <span className={`text-xs ${verify.ok ? 'text-chip-green' : 'text-chip-red'}`}>{verify.message}</span>
        )}
      </div>
    </div>
  );
}

function summarizeBet(decision: any): string {
  if (decision?.bets) return decision.bets.map((b: any) => `${b.type}·${b.amount}`).join(', ');
  if (decision?.amount != null) return `stake ${decision.amount}`;
  return '';
}
