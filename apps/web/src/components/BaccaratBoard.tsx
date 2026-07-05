// Authentic Mini-Baccarat table — Punto Banco, single seat (this sim has one bettor).
// Layout follows the standard felt convention (baccarat.net / baccarattraining.com table
// diagrams): Player box and Banker box as the two main betting ovals with Tie between
// them, small Player Pair / Banker Pair circles at the outer corners. Commission is
// deducted immediately per hand (confirmed against MBS/RWS GRA rule sheets for
// Singapore mini-baccarat — no deferred lammer/marker, unlike big-table Vegas pits).
// Below the felt: Bead Plate (one cell per hand) + Big Road (streak/"dragon tail"
// tracking) — the pattern-reading scorecards real players lean on, useful here for
// studying whether an LLM chases patterns a truly random shoe can't support.
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { PlayingCard, Chip, Badge } from './primitives';

type Result = 'player' | 'banker' | 'tie';
interface RoadHand { result: Result; playerPair: boolean; bankerPair: boolean }

const PAYOUT_LABEL: Record<'player' | 'banker' | 'tie' | 'playerPair' | 'bankerPair', string> = {
  player: '1:1', banker: '1:1 (5% COM)', tie: '8:1', playerPair: '11:1', bankerPair: '11:1',
};

function Hand({ cards, label, total, tone, delays }: {
  cards: string[]; label: string; total: number; tone?: 'win' | 'loss' | 'neutral'; delays: number[];
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs text-white/50 uppercase tracking-wide">{label}</span>
      <div className="flex gap-1.5">
        {cards.map((c, i) => <PlayingCard key={i} label={c} delay={delays[i] ?? 0} />)}
      </div>
      <Badge tone={tone ?? 'neutral'}>{total}</Badge>
    </div>
  );
}

/**
 * Big Road placement: a streak of the same result stacks downward in one column
 * (max 6 rows); when it would exceed 6 rows, or the natural cell is already taken,
 * it continues rightward instead ("dragon tail") — dragons never overlap, so a
 * tail that runs into another one keeps sliding right until it finds an empty cell.
 * Ties don't get their own column; they tally onto whichever P/B cell preceded them.
 */
function buildBigRoad(hands: RoadHand[]) {
  const grid = new Map<string, { result: 'player' | 'banker'; playerPair: boolean; bankerPair: boolean; ties: number }>();
  const has = (c: number, r: number) => grid.has(`${c},${r}`);
  let col = 0, row = 0, lastKey: string | null = null, prev: 'player' | 'banker' | null = null;
  for (const h of hands) {
    if (h.result === 'tie') {
      if (lastKey) {
        const cell = grid.get(lastKey)!;
        cell.ties++;
        cell.playerPair = cell.playerPair || h.playerPair;
        cell.bankerPair = cell.bankerPair || h.bankerPair;
      }
      continue;
    }
    if (prev === null) {
      // first entry: col/row already 0,0
    } else if (h.result === prev) {
      if (row + 1 < 6 && !has(col, row + 1)) row++;
      else { col++; while (has(col, row)) col++; }
    } else {
      col++; row = 0;
      while (has(col, row)) col++;
    }
    const key = `${col},${row}`;
    grid.set(key, { result: h.result, playerPair: h.playerPair, bankerPair: h.bankerPair, ties: 0 });
    lastKey = key;
    prev = h.result;
  }
  const cols = grid.size ? Math.max(...[...grid.keys()].map((k) => Number(k.split(',')[0]))) + 1 : 0;
  return { grid, cols };
}

function RoadDot({ result, playerPair, bankerPair, ties }: {
  result: 'player' | 'banker'; playerPair?: boolean; bankerPair?: boolean; ties?: number;
}) {
  return (
    <div className="relative w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center shrink-0">
      <span className="rounded-full border-2"
        style={{ width: '85%', height: '85%', borderColor: result === 'banker' ? '#e05a5a' : '#4a9eff' }} />
      {!!ties && (
        <span className="absolute inset-0" style={{
          background: 'linear-gradient(135deg, transparent 46%, #23a06b 46%, #23a06b 54%, transparent 54%)',
        }} />
      )}
      {bankerPair && <span className="absolute top-0 left-0 w-1.5 h-1.5 rounded-full bg-chip-red" />}
      {playerPair && <span className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full" style={{ background: '#4a9eff' }} />}
    </div>
  );
}

const ROAD_WINDOW = 40; // scrollable, but bound DOM size like a physical board's visible columns

function BigRoad({ hands }: { hands: RoadHand[] }) {
  const shown = hands.slice(-ROAD_WINDOW);
  const { grid, cols } = buildBigRoad(shown);
  if (!cols) return <p className="text-[10px] text-white/30">No hands yet.</p>;
  return (
    <div className="overflow-x-auto">
      <div className="grid gap-0.5" style={{ gridTemplateRows: 'repeat(6, 1fr)', gridAutoFlow: 'column', gridAutoColumns: 'min-content' }}>
        {Array.from({ length: cols * 6 }, (_, i) => {
          const c = Math.floor(i / 6), r = i % 6;
          const cell = grid.get(`${c},${r}`);
          return <div key={i}>{cell ? <RoadDot {...cell} /> : <div className="w-4 h-4 sm:w-5 sm:h-5" />}</div>;
        })}
      </div>
    </div>
  );
}

function BeadPlate({ hands }: { hands: RoadHand[] }) {
  const shown = hands.slice(-ROAD_WINDOW);
  const cols = Math.ceil(shown.length / 6) || 0;
  if (!cols) return null;
  return (
    <div className="overflow-x-auto">
      <div className="grid gap-0.5" style={{ gridTemplateRows: 'repeat(6, 1fr)', gridAutoFlow: 'column', gridAutoColumns: 'min-content' }}>
        {shown.map((h, i) => (
          <div key={i} className="relative w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center shrink-0">
            <span className="rounded-full"
              style={{
                width: '80%', height: '80%',
                background: h.result === 'tie' ? '#23a06b' : h.result === 'banker' ? '#e05a5a' : '#4a9eff',
              }} />
            {h.bankerPair && <span className="absolute top-0 left-0 w-1 h-1 rounded-full bg-white" />}
            {h.playerPair && <span className="absolute bottom-0 right-0 w-1 h-1 rounded-full bg-white" />}
          </div>
        ))}
      </div>
    </div>
  );
}

interface BetBox { type: 'player' | 'banker' | 'tie' | 'playerPair' | 'bankerPair'; staked: number; win: boolean }

/** shape/order matches GRA MBS Baccarat Game Rules v8, Appendix "D"/"E" (the single-playing-position
 *  felt this sim's one bettor corresponds to): a small P Pair / Tie / B Pair circle row, then a wide
 *  Banker pill, then a wide Player pill beneath it — not a left-to-right single row. Filled with a
 *  radial highlight + inset ring rather than a flat outline so each spot reads as an inlaid felt
 *  betting area (raised, lit) instead of a wireframe box. */
function Box({ box, reveal, className = '', pill }: { box: BetBox; reveal: boolean; className?: string; pill?: boolean }) {
  const lit = box.win && reveal;
  return (
    <motion.div
      animate={lit ? { scale: [1, 1.03, 1] } : { scale: 1 }}
      transition={{ duration: 0.5 }}
      className={`relative flex items-center justify-center rounded-full flex-col gap-0.5 ${className}`}
      style={{
        background: lit
          ? 'radial-gradient(120% 140% at 50% 20%, rgba(245,196,81,0.35), rgba(245,196,81,0.12) 70%)'
          : 'radial-gradient(120% 140% at 50% 20%, rgba(255,255,255,0.07), rgba(0,0,0,0.22) 75%)',
        boxShadow: lit
          ? 'inset 0 0 0 2px var(--color-gold-400), inset 0 2px 6px rgba(0,0,0,0.35), 0 0 18px 3px rgba(245,196,81,0.55)'
          : 'inset 0 0 0 2px rgba(224,169,46,0.55), inset 0 2px 6px rgba(0,0,0,0.35)',
      }}
    >
      {lit && (
        <motion.span className="pointer-events-none absolute inset-0 rounded-full"
          style={{ boxShadow: '0 0 16px 4px rgba(245,196,81,0.7)' }}
          initial={{ opacity: 0 }} animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.1, repeat: Infinity }} />
      )}
      <span className={`font-display uppercase tracking-wide text-white ${pill ? 'text-base sm:text-lg' : 'text-[9px] sm:text-[10px]'}`}>
        {{ player: 'Player', banker: 'Banker', tie: 'Tie', playerPair: 'P Pair', bankerPair: 'B Pair' }[box.type]}
      </span>
      <span className={`text-gold-200/90 ${pill ? 'text-xs' : 'text-[8px]'}`}>{PAYOUT_LABEL[box.type]}</span>
      {box.staked > 0 && (
        <div className="absolute -top-2 -right-2 z-20">
          <Chip amount={box.staked} size={pill ? 28 : 18} color={lit ? '#2f6fed' : '#d23b3b'} />
        </div>
      )}
    </motion.div>
  );
}

export function BaccaratBoard({ outcome, placedBets, history, roundKey }: {
  outcome: any; placedBets: any[]; history: RoadHand[]; roundKey: number;
}) {
  const [reveal, setReveal] = useState(false);
  const r: Result = outcome.result;

  // Reconstruct authentic P,B,P,B,[P3],[B3] deal order for the card-flip animation.
  const dealOrder: Array<{ hand: 'player' | 'banker'; idx: number }> = [
    { hand: 'player', idx: 0 }, { hand: 'banker', idx: 0 },
    { hand: 'player', idx: 1 }, { hand: 'banker', idx: 1 },
  ];
  if (outcome.player.length > 2) dealOrder.push({ hand: 'player', idx: 2 });
  if (outcome.banker.length > 2) dealOrder.push({ hand: 'banker', idx: 2 });
  const delayOf = (hand: 'player' | 'banker', idx: number) => {
    const i = dealOrder.findIndex((d) => d.hand === hand && d.idx === idx);
    return (i < 0 ? 0 : i) * 0.16;
  };

  useEffect(() => {
    setReveal(false);
    const t = setTimeout(() => setReveal(true), dealOrder.length * 160 + 420);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundKey]);

  const staked: Record<string, number> = {};
  for (const b of placedBets ?? []) staked[b.type] = (staked[b.type] ?? 0) + (b.amount ?? 0);
  const wins: Record<string, boolean> = {
    player: r === 'player', banker: r === 'banker', tie: r === 'tie',
    playerPair: !!outcome.playerPair, bankerPair: !!outcome.bankerPair,
  };
  const box = (type: BetBox['type']): BetBox => ({ type, staked: staked[type] ?? 0, win: wins[type] });

  const roadHands: RoadHand[] = [...history, { result: r, playerPair: !!outcome.playerPair, bankerPair: !!outcome.bankerPair }];

  return (
    <div className="w-full flex flex-col items-center gap-3">
      {/* card reveal */}
      <div className="flex items-center justify-center gap-4 sm:gap-10 pb-1">
        <Hand cards={outcome.player} label="Player" total={outcome.playerTotal}
          tone={r === 'player' ? 'win' : 'neutral'} delays={outcome.player.map((_: string, i: number) => delayOf('player', i))} />
        <div className="text-center">
          <Badge tone={r === 'tie' ? 'gold' : 'neutral'}>{r === 'tie' ? 'TIE' : r === 'player' ? 'PLAYER WINS' : 'BANKER WINS'}</Badge>
          {(outcome.playerPair || outcome.bankerPair) && <p className="text-[10px] text-gold-400 mt-1">pair!</p>}
        </div>
        <Hand cards={outcome.banker} label="Banker" total={outcome.bankerTotal}
          tone={r === 'banker' ? 'win' : 'neutral'} delays={outcome.banker.map((_: string, i: number) => delayOf('banker', i))} />
      </div>

      {/* felt: GRA Appendix D/E single-position layout — decorative banner (Appendix E's
          "BACCARAT / TIE BETS PAY 8 TO 1" signage), then a P Pair/Tie/B Pair circle row,
          then a wide Banker pill, then a wide Player pill beneath it. Sized to its content
          (not stretched to the stage width) so it reads as a table, not a dead green field. */}
      <div className="relative rounded-2xl overflow-hidden border-2 border-gold-500/60 select-none shadow-[0_10px_40px_rgba(0,0,0,0.5)] px-5 sm:px-7 pt-4 pb-5 w-full max-w-[420px]"
        style={{ background: 'radial-gradient(140% 90% at 50% 0%, #1e8a5c 0%, #145f3f 55%, #0b3d29 100%)' }}>
        <span className="pointer-events-none absolute -bottom-6 -right-6 text-[120px] leading-none text-black/10 select-none">♦</span>

        <div className="text-center mb-3">
          <p className="font-display text-gold-400 text-xl tracking-[0.15em]">BACCARAT</p>
          <p className="text-[9px] text-gold-200/75 uppercase tracking-[0.2em] -mt-0.5">Tie Bets Pay 8 to 1</p>
        </div>

        <div className="flex items-center justify-center gap-4 sm:gap-5 mb-3 relative">
          <Box box={box('playerPair')} reveal={reveal} className="w-14 h-14 sm:w-16 sm:h-16" />
          <Box box={box('tie')} reveal={reveal} className="w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem]" />
          <Box box={box('bankerPair')} reveal={reveal} className="w-14 h-14 sm:w-16 sm:h-16" />
        </div>
        <div className="flex flex-col gap-2.5 relative">
          <Box box={box('banker')} reveal={reveal} pill className="w-full h-14 sm:h-16" />
          <Box box={box('player')} reveal={reveal} pill className="w-full h-14 sm:h-16" />
        </div>

        <div className="text-center text-[8px] text-gold-200/70 mt-3 relative">
          Table minimums — Player/Banker 50 · Tie/Pair 10 · commission deducted immediately (mini-baccarat convention)
        </div>
      </div>

      {/* scorecards */}
      <div className="w-full max-w-xl rounded-lg border border-gold-600/30 bg-black/20 p-3 flex flex-col sm:flex-row gap-4 overflow-x-auto">
        <div>
          <p className="text-[9px] uppercase tracking-wide text-white/40 mb-1">Bead Plate</p>
          <BeadPlate hands={roadHands} />
        </div>
        <div className="h-px sm:h-auto sm:w-px bg-white/10" />
        <div>
          <p className="text-[9px] uppercase tracking-wide text-white/40 mb-1">Big Road</p>
          <BigRoad hands={roadHands} />
        </div>
      </div>
    </div>
  );
}
