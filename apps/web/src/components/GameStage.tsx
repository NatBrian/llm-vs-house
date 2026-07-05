import { lazy, Suspense } from 'react';
import { useStore, activeSession } from '../store';
import { PlayingCard, Chip, Badge } from './primitives';
import { SicBoBoard } from './SicBoBoard';
import { RouletteBoard } from './RouletteBoard';
import { BaccaratBoard } from './BaccaratBoard';
import { fmt, signed, GAME_META } from '../lib/format';

// Pulls in pixi.js + gsap — lazy-loaded so the other 4 games never pay that bundle cost.
const SlotBoard = lazy(() => import('./SlotBoard').then((m) => ({ default: m.SlotBoard })));

export function GameStage() {
  const session = useStore(activeSession);
  const playhead = useStore((s) => s.playhead);

  if (!session) {
    return (
      <div className="felt rounded-2xl h-[360px] flex flex-col items-center justify-center text-white/50">
        <div className="text-5xl mb-3">🎰</div>
        <p className="text-sm">No active session. Run one to watch the agent play.</p>
      </div>
    );
  }

  if (session.rounds.length === 0) {
    return (
      <div className="felt rounded-2xl min-h-[300px] sm:min-h-[360px] flex flex-col items-center justify-center text-white/60 gap-3">
        <div className="text-4xl animate-pulse">{GAME_META[session.config.game]!.icon}</div>
        <p className="text-sm">Waiting for the first round…</p>
        <p className="text-xs text-white/35">{session.config.deciderId.startsWith('llm') ? 'The model is deciding — this can take a few seconds per round.' : 'Dealing…'}</p>
      </div>
    );
  }

  const idx = Math.max(0, Math.min(playhead, session.rounds.length - 1));
  const round = session.rounds[idx]!;
  const game = session.config.game;

  return (
    <div className="felt rounded-2xl p-4 sm:p-6 min-h-[300px] sm:min-h-[360px] flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">{GAME_META[game]!.icon}</span>
          <span className="font-display text-gold-400 tracking-wide truncate">{GAME_META[game]!.name}</span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-white/60">
          <span>{session.config.label}</span>
          <span>·</span>
          <span>seed {session.config.seed}</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        {game === 'roulette' && (
          <RouletteBoard
            pocket={(round.outcome as any).pocket}
            placedBets={(round.outcome as any).placedBets ?? []}
            variant={(session.config.gameConfig as any).variant}
            history={session.rounds.slice(0, idx).map((r) => (r.outcome as any).pocket).reverse()}
            roundKey={idx}
          />
        )}
        {game === 'blackjack' && <BlackjackView outcome={round.outcome} />}
        {game === 'baccarat' && (
          <BaccaratBoard
            outcome={round.outcome}
            placedBets={(round.outcome as any).placedBets ?? []}
            history={session.rounds.slice(0, idx).map((r) => ({
              result: (r.outcome as any).result,
              playerPair: !!(r.outcome as any).playerPair,
              bankerPair: !!(r.outcome as any).bankerPair,
            }))}
            roundKey={idx}
          />
        )}
        {game === 'sicbo' && (
          <SicBoBoard
            dice={(round.outcome as any).dice}
            placedBets={(round.outcome as any).placedBets ?? []}
            history={session.rounds.slice(0, idx).map((r) => (r.outcome as any).dice).reverse()}
            roundKey={idx}
          />
        )}
        {game === 'slot' && (
          <Suspense fallback={<div className="text-white/40 text-sm">Loading slot machine…</div>}>
            <SlotBoard outcome={round.outcome as any} roundKey={idx} />
          </Suspense>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <BetChips outcome={round.outcome} game={game} />
        <Badge tone={round.net > 0 ? 'win' : round.net < 0 ? 'loss' : 'neutral'}>
          {round.net > 0 ? 'WIN ' : round.net < 0 ? 'LOSS ' : 'PUSH '}{signed(round.net)}
        </Badge>
      </div>
    </div>
  );
}

function BetChips({ outcome, game }: { outcome: any; game: string }) {
  const bets: any[] = outcome.placedBets
    ?? (game === 'slot' ? [{ type: outcome.betMax ? 'bet max' : `${outcome.denomination}×${outcome.betLevel}`, amount: outcome.amount }] : []);
  if (!bets.length) return <span className="text-xs text-white/40">—</span>;
  return (
    <div className="flex items-center gap-2">
      {bets.slice(0, 4).map((b, i) => (
        <div key={i} className="flex items-center gap-1">
          <Chip amount={b.amount} size={28} />
          <span className="text-[11px] text-white/60">{b.type}{b.total ? ` ${b.total}` : ''}{b.face ? ` ${b.face}` : ''}</span>
        </div>
      ))}
    </div>
  );
}

function Hand({ cards, label, total, tone }: { cards: string[]; label: string; total: number; tone?: 'win' | 'loss' | 'neutral' }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs text-white/50 uppercase tracking-wide">{label}</span>
      <div className="flex gap-1.5">
        {cards.map((c, i) => <PlayingCard key={i} label={c} delay={i * 0.12} />)}
      </div>
      <Badge tone={tone ?? 'neutral'}>{total}</Badge>
    </div>
  );
}

function BlackjackView({ outcome }: { outcome: any }) {
  const dealerBust = outcome.dealerTotal > 21;
  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <Hand cards={outcome.dealer} label="Dealer" total={outcome.dealerTotal} tone={dealerBust ? 'loss' : 'neutral'} />
      <div className="h-px w-2/3 bg-white/10" />
      <div className="flex gap-8 flex-wrap justify-center">
        {outcome.hands.map((h: any, i: number) => (
          <Hand key={i} cards={h.cards} label={`Hand ${i + 1}${h.doubled ? ' ×2' : ''}`} total={h.total}
            tone={h.busted || h.surrendered ? 'loss' : 'neutral'} />
        ))}
      </div>
    </div>
  );
}

export { fmt };
