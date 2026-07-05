import { motion } from 'framer-motion';
import { useStore, activeSession } from '../store';
import { PlayingCard, Chip, Badge } from './primitives';
import { SicBoBoard } from './SicBoBoard';
import { fmt, signed, GAME_META } from '../lib/format';

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const EUROPEAN_ORDER: (number | '00')[] = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const AMERICAN_ORDER: (number | '00')[] = [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, '00', 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2];

const SLOT_SYMBOL: Record<string, string> = { '7': '7️⃣', BAR: '🅱️', BELL: '🔔', CHERRY: '🍒', BLANK: '⬛' };

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

      <div key={idx} className="flex-1 flex items-center justify-center">
        {game === 'roulette' && <RouletteView outcome={round.outcome} variant={(session.config.gameConfig as any).variant} />}
        {game === 'blackjack' && <BlackjackView outcome={round.outcome} />}
        {game === 'baccarat' && <BaccaratView outcome={round.outcome} />}
        {game === 'sicbo' && <SicBoBoard dice={(round.outcome as any).dice} placedBets={(round.outcome as any).placedBets ?? []} roundKey={idx} />}
        {game === 'slot' && <SlotView outcome={round.outcome} />}
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
  const bets: any[] = outcome.placedBets ?? (game === 'slot' ? [{ type: 'spin', amount: outcome.amount }] : []);
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

function RouletteView({ outcome, variant }: { outcome: any; variant: string }) {
  const order = variant === 'american' ? AMERICAN_ORDER : EUROPEAN_ORDER;
  const n = order.length;
  const winIdx = Math.max(0, order.indexOf(outcome.pocket));
  const angle = (winIdx / n) * 360;
  const pocket = outcome.pocket;
  const color = pocket === 0 || pocket === '00' ? '#23a06b' : RED.has(pocket) ? '#d23b3b' : '#1d2731';

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
      <div className="relative w-48 h-48 sm:w-56 sm:h-56">
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from 0deg, ${order.map((p, i) => {
              const c = p === 0 || p === '00' ? '#23a06b' : RED.has(p as number) ? '#b3283a' : '#141a20';
              return `${c} ${(i / n) * 360}deg ${((i + 1) / n) * 360}deg`;
            }).join(',')})`,
            boxShadow: 'inset 0 0 0 8px #b9861d, 0 10px 40px rgba(0,0,0,0.6)',
          }}
          initial={{ rotate: 0 }}
          animate={{ rotate: 360 * 4 - angle }}
          transition={{ duration: 2.2, ease: [0.15, 0.6, 0.2, 1] }}
        />
        <div className="absolute inset-[36%] rounded-full bg-ink-900 border-2 border-gold-600/50 flex items-center justify-center shadow-inner">
          <span className="text-gold-500 text-lg">♦</span>
        </div>
        {/* ball / pointer */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-1 w-3 h-3 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
      </div>
      <div className="text-center">
        <div className="w-24 h-24 rounded-xl flex items-center justify-center text-4xl font-bold text-white shadow-xl" style={{ background: color }}>
          {String(pocket)}
        </div>
        <p className="mt-2 text-sm text-white/60">{pocket === 0 || pocket === '00' ? 'Zero' : RED.has(pocket) ? 'Red' : 'Black'}</p>
      </div>
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

function BaccaratView({ outcome }: { outcome: any }) {
  const r = outcome.result;
  return (
    <div className="flex items-center gap-4 sm:gap-10">
      <Hand cards={outcome.player} label="Player" total={outcome.playerTotal} tone={r === 'player' ? 'win' : 'neutral'} />
      <div className="text-center">
        <Badge tone={r === 'tie' ? 'gold' : 'neutral'}>{r === 'tie' ? 'TIE' : r === 'player' ? 'PLAYER' : 'BANKER'}</Badge>
        {(outcome.playerPair || outcome.bankerPair) && <p className="text-[10px] text-gold-400 mt-1">pair!</p>}
      </div>
      <Hand cards={outcome.banker} label="Banker" total={outcome.bankerTotal} tone={r === 'banker' ? 'win' : 'neutral'} />
    </div>
  );
}

function SlotView({ outcome }: { outcome: any }) {
  const symbols: string[] = outcome.symbols;
  const win = outcome.payout > 0;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-2 p-3 rounded-xl bg-ink-950 border-2 border-gold-600/50">
        {symbols.map((s, i) => (
          <motion.div key={i}
            initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.15, type: 'spring', stiffness: 200 }}
            className="w-16 h-20 rounded-lg bg-white/95 flex items-center justify-center text-4xl">
            {SLOT_SYMBOL[s] ?? s}
          </motion.div>
        ))}
      </div>
      <Badge tone={win ? 'win' : 'neutral'}>{win ? `Pays ${outcome.payout}×` : 'No win'}</Badge>
    </div>
  );
}

export { fmt };
