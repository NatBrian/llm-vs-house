import { useEffect, useRef, useState, lazy, Suspense } from 'react';
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
  const sessionCount = useStore((s) => s.sessions.length);

  const mainRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(sessionCount);

  // Autoplay: advance the playhead through the logged rounds.
  useEffect(() => {
    if (!autoplay || !session) return;
    if (playhead >= session.rounds.length - 1) { setAutoplay(false); return; }
    const t = setTimeout(() => setPlayhead(playhead + 1), 1100);
    return () => clearTimeout(t);
  }, [autoplay, playhead, session, setPlayhead, setAutoplay]);

  // When a new session is run, jump to the table and (on mobile) scroll it into view.
  useEffect(() => {
    if (sessionCount > prevCount.current) {
      setTab('table');
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setTimeout(() => mainRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
      }
    }
    prevCount.current = sessionCount;
  }, [sessionCount]);

  return (
    <div className="min-h-full flex flex-col">
      <header className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5 border-b border-white/10 glass sticky top-0 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl sm:text-2xl shrink-0">🎰</span>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-gold-400 whitespace-nowrap">LLM vs House</h1>
            <p className="hidden sm:block text-[11px] text-white/40 -mt-0.5">How does an LLM take risk on unbeatable games?</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {(['table', 'compare'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm capitalize transition ${tab === t ? 'bg-gold-500 text-ink-950 font-medium' : 'text-white/60 hover:text-white'}`}
              >
                {t}
              </button>
            ))}
          </div>
          <span className="hidden sm:inline-block text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-chip-red/20 text-chip-red border border-chip-red/30">
            Simulated points only
          </span>
        </div>
      </header>

      {error && (
        <div className="mx-3 sm:mx-5 mt-3 rounded-lg border border-chip-red/40 bg-chip-red/15 px-4 py-2 text-sm text-red-200 flex justify-between gap-3">
          <span className="min-w-0 break-words">{error}</span>
          <button onClick={clearError} className="text-red-300 hover:text-white shrink-0">✕</button>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-3 sm:gap-4 p-3 sm:p-4 lg:min-h-0">
        <aside className="flex flex-col gap-3 sm:gap-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          <NewSessionForm />
          <SessionsList />
        </aside>

        <main ref={mainRef} className="lg:min-h-0 lg:overflow-y-auto scroll-mt-16">
          {tab === 'table' ? (
            <div className="flex flex-col gap-3 sm:gap-4">
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

      <footer className="px-3 sm:px-5 py-2 border-t border-white/10 text-[10px] sm:text-[11px] text-white/30 flex flex-col sm:flex-row items-center justify-between gap-0.5 text-center">
        <span>Research simulation · simulated points only · deterministic given a seed · replayable</span>
        <span className="hidden sm:inline">Roulette · Blackjack · Baccarat · Sic Bo · Slots</span>
      </footer>
    </div>
  );
}
