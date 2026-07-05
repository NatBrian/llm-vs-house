import { useEffect, useState, lazy, Suspense } from 'react';
import { useStore, activeSession } from './store';
import { NewSessionForm } from './components/NewSessionForm';
import { SessionsList } from './components/SessionsList';
import { GameStage } from './components/GameStage';
import { ReasoningPanel } from './components/ReasoningPanel';

// ECharts is heavy and only needed on the Compare tab — load it on demand.
const Dashboard = lazy(() => import('./components/Dashboard').then((m) => ({ default: m.Dashboard })));

export function App() {
  const [tab, setTab] = useState<'table' | 'compare'>('table');
  const session = useStore(activeSession);
  const autoplay = useStore((s) => s.autoplay);
  const playhead = useStore((s) => s.playhead);
  const setPlayhead = useStore((s) => s.setPlayhead);
  const setAutoplay = useStore((s) => s.setAutoplay);
  const error = useStore((s) => s.error);
  const clearError = useStore((s) => s.clearError);

  // Autoplay: advance the playhead through the logged rounds.
  useEffect(() => {
    if (!autoplay || !session) return;
    if (playhead >= session.rounds.length - 1) { setAutoplay(false); return; }
    const t = setTimeout(() => setPlayhead(playhead + 1), 1100);
    return () => clearTimeout(t);
  }, [autoplay, playhead, session, setPlayhead, setAutoplay]);

  return (
    <div className="min-h-full flex flex-col">
      <header className="flex items-center justify-between px-5 py-3 border-b border-white/10 glass sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎰</span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-gold-400">LLM vs House</h1>
            <p className="text-[11px] text-white/40 -mt-0.5">How does an LLM take risk on unbeatable games?</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {(['table', 'compare'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 text-sm capitalize transition ${tab === t ? 'bg-gold-500 text-ink-950 font-medium' : 'text-white/60 hover:text-white'}`}
              >
                {t}
              </button>
            ))}
          </div>
          <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-chip-red/20 text-chip-red border border-chip-red/30">
            Simulated points only
          </span>
        </div>
      </header>

      {error && (
        <div className="mx-5 mt-3 rounded-lg border border-chip-red/40 bg-chip-red/15 px-4 py-2 text-sm text-red-200 flex justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="text-red-300 hover:text-white">✕</button>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 p-4 min-h-0">
        <aside className="flex flex-col gap-4 min-h-0 overflow-y-auto pr-1">
          <NewSessionForm />
          <SessionsList />
        </aside>

        <main className="min-h-0 overflow-y-auto">
          {tab === 'table' ? (
            <div className="flex flex-col gap-4">
              <GameStage />
              <ReasoningPanel />
            </div>
          ) : (
            <Suspense fallback={<div className="glass rounded-xl p-10 text-center text-white/40">Loading charts…</div>}>
              <Dashboard />
            </Suspense>
          )}
        </main>
      </div>

      <footer className="px-5 py-2 border-t border-white/10 text-[11px] text-white/30 flex items-center justify-between">
        <span>Research simulation · simulated points only · deterministic given a seed · replayable</span>
        <span>Roulette · Blackjack · Baccarat · Sic Bo · Slots</span>
      </footer>
    </div>
  );
}
