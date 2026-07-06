// Authentic Sic Bo table — mirrors the real Singapore/Macau felt (GRA-approved
// "SIC BO (MBS) Game Rules Version 7", w.e.f. 19 Sep 2025, Appendix A/B — verified
// against the rendered appendix image), not the generic international layout:
//   - Left column: Double+Single combos (50:1, 28 exact cells) stacked above
//     Three-Single-Dice combos (30:1, 20 exact cells) — both blocks target one
//     EXACT dice outcome each, not a group of alternatives.
//   - Main block, top row: EVEN paired with BIG on the left, ODD paired with
//     SMALL on the right (the real felt's corner pairing — NOT Small/Odd and
//     Big/Even, which is backwards), flanking the doubles/specific-triples/
//     ANY TRIPLE fan in the centre.
//   - Totals 4..17, the fifteen two-dice combos, the four Three-From-Four
//     cells, then the six single-number cells (1:1 / 2:1 / 12:1 — not 3:1).
// All payouts verified directly against GRA rule 4.1 (docs/PAYOUTS.md §3) —
// several differ from the generic "Wizard of Odds standard" most secondary
// sources quote.
//
// It is a *replay* board: the bot's placedBets drop chips on the matching
// cells, the three dice tumble inside a glass shaker dome (each die on its own
// randomized tumble arc), the dome lifts, a settle-flash marks the moment they
// land, then winning cells light up in a stagger keyed to payout size (biggest
// hits light last, with an extra flash burst) and a result banner pops. Below
// the felt, a hot/cold trend panel (recent-rolls strip + Small/Big/Triple and
// Odd/Even frequency bars + a 1-6 hot/cold tracker) mirrors the
// RouletteBoard/BaccaratBoard history-panel pattern. Win predicates here
// mirror packages/engine/src/games/sicbo.ts exactly.

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import {
  SICBO_TOTAL_ODDS, SICBO_ODDS, SICBO_DOUBLE_ANY_PAIRS, SICBO_THREE_SINGLE_COMBO_GROUPS, SICBO_THREE_FROM_FOUR_GROUPS,
} from '@casino/engine';
import { Chip } from './primitives';

type Dice = [number, number, number];

// ---------------------------------------------------------------- die pips
const PIP: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
};

function Pips({ value, size }: { value: number; size: number }) {
  const pips = PIP[value] ?? [];
  return (
    <div
      className="rounded-[3px] bg-gradient-to-br from-white to-[#e9edf2] grid grid-cols-3 grid-rows-3 shadow-[0_1px_2px_rgba(0,0,0,0.5),inset_0_0_0_1px_rgba(0,0,0,0.08)]"
      style={{ width: size, height: size, padding: size * 0.13, gap: size * 0.04 }}
    >
      {Array.from({ length: 9 }).map((_, i) => {
        const on = pips.some(([c, r]) => c === i % 3 && r === Math.floor(i / 3));
        return (
          <span key={i} className="rounded-full" style={on
            ? { background: 'radial-gradient(circle at 35% 30%, #4a4a4a, #0a0e12)' }
            : undefined} />
        );
      })}
    </div>
  );
}

const MiniDie = ({ value, size = 22 }: { value: number; size?: number }) => <Pips value={value} size={size} />;

// ---------------------------------------------------------------- shaker dome
// The signature Sic Bo look: three dice vibrate under a glass dome on a lit
// pedestal, each on its own randomized tumble arc (not a uniform shake); the
// dome lifts, the dice settle with a bounce, a brief glow-flash pulse marks
// the landing, then a short held beat before the result banner pops —
// mirrors a live shaker's "check the dice are flat" pause before the call.
function DiceShaker({ dice, roundKey, onSettle }: { dice: Dice; roundKey: number; onSettle: () => void }) {
  const [shown, setShown] = useState<Dice>(dice);
  const [rolling, setRolling] = useState(true);
  const [flash, setFlash] = useState(false);
  const timer = useRef<number | null>(null);
  const settleCb = useRef(onSettle);
  settleCb.current = onSettle;

  useEffect(() => {
    setRolling(true);
    setFlash(false);
    const start = performance.now();
    const DUR = 1100;
    const tick = () => {
      const t = performance.now() - start;
      if (t < DUR) {
        setShown([
          1 + Math.floor(Math.random() * 6),
          1 + Math.floor(Math.random() * 6),
          1 + Math.floor(Math.random() * 6),
        ]);
        // ease the shake: fast at first, slower as it settles
        const gap = 55 + (t / DUR) * 95;
        timer.current = window.setTimeout(tick, gap);
      } else {
        setShown(dice);
        setRolling(false);
        setFlash(true);
        // brief held beat after the dice land, before winning cells/banner reveal
        timer.current = window.setTimeout(() => settleCb.current(), 260);
      }
    };
    tick();
    return () => { if (timer.current) window.clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundKey]);

  // Per-die randomized tumble arcs (seeded once per round) so the three dice
  // don't all rattle in lockstep — each has its own amplitude/phase/rate.
  const arcsRef = useRef<Array<{ rot: number[]; y: number[]; dur: number }>>([]);
  if (arcsRef.current.length === 0 || (arcsRef as any)._round !== roundKey) {
    arcsRef.current = [0, 1, 2].map(() => {
      const amp = 16 + Math.random() * 14;
      const lift = 8 + Math.random() * 8;
      return {
        rot: [0, -amp, amp * 0.8, -amp * 0.5, 0],
        y: [0, -lift, 0, -lift * 0.6, 0],
        dur: 0.22 + Math.random() * 0.1,
      };
    });
    (arcsRef as any)._round = roundKey;
  }

  return (
    <div className="relative flex flex-col items-center" style={{ width: 210, height: 132 }}>
      {/* settle flash — a quick radial pulse behind the dice the instant they land */}
      <AnimatePresence>
        {flash && (
          <motion.div
            className="absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
            style={{ top: 30, width: 160, height: 90, background: 'radial-gradient(ellipse at center, rgba(245,196,81,0.55), transparent 70%)' }}
            initial={{ opacity: 0.9, scale: 0.7 }}
            animate={{ opacity: 0, scale: 1.3 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      {/* glass dome — always translucent, lifts away on settle */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2"
        style={{ top: 0, width: 190, height: 108 }}
        animate={rolling ? { y: [0, -1.5, 1.5, -1, 0], opacity: 0.9 } : { y: -70, opacity: 0 }}
        transition={rolling
          ? { duration: 0.12, repeat: Infinity, ease: 'linear' }
          : { duration: 0.5, ease: 'easeOut' }}
      >
        <div className="w-full h-full rounded-t-full border border-white/25"
          style={{
            background: 'radial-gradient(120% 100% at 35% 20%, rgba(255,255,255,0.28), rgba(255,255,255,0.05) 45%, rgba(255,255,255,0.02) 70%)',
            boxShadow: 'inset 0 0 24px rgba(255,255,255,0.18), inset 8px 0 18px rgba(255,255,255,0.12)',
          }} />
      </motion.div>

      {/* dice */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-end gap-3" style={{ top: 40 }}>
        {shown.map((v, i) => {
          const arc = arcsRef.current[i]!;
          return (
            <motion.div
              key={i}
              animate={rolling ? { rotate: arc.rot, y: arc.y } : { rotate: 0, y: 0, scale: [1.15, 0.92, 1] }}
              transition={rolling
                ? { duration: arc.dur, repeat: Infinity, ease: 'easeInOut', delay: i * 0.05 }
                : { duration: 0.45, ease: 'easeOut' }}
            >
              <Pips value={v} size={48} />
            </motion.div>
          );
        })}
      </div>

      {/* pedestal / lit base */}
      <div className="absolute left-1/2 -translate-x-1/2 rounded-[50%]"
        style={{
          bottom: 6, width: 168, height: 30,
          background: 'radial-gradient(ellipse at center, rgba(245,196,81,0.35), rgba(245,196,81,0.05) 65%, transparent 72%)',
        }} />
      <div className="absolute left-1/2 -translate-x-1/2 rounded-[50%] border-t border-gold-500/40"
        style={{ bottom: 12, width: 130, height: 14, background: 'linear-gradient(180deg,#123c2c,#06231a)' }} />
    </div>
  );
}

// ---------------------------------------------------------------- cell
interface CellState { placed: number; win: boolean }

/**
 * Winning-cell reveal delay, keyed to the bet's payout multiple — cheap
 * even-money hits (Small/Big/Combo, 1-6:1) light almost instantly, a specific
 * Triple (180:1) lights last. Gives the celebration a natural "biggest win
 * lands last" build instead of every cell flashing at once. `big` (payout
 * >= 30:1) gets an extra flash burst.
 */
function celebration(oddsMultiple: number): { delay: number; big: boolean } {
  return { delay: Math.min(0.45, oddsMultiple / 400), big: oddsMultiple >= 30 };
}

function Cell({
  state, win, reveal, children, className = '', title, odds = 1,
}: {
  state?: CellState; win: boolean; reveal: boolean; children: React.ReactNode; className?: string; title?: string; odds?: number;
}) {
  const placed = (state?.placed ?? 0) > 0;
  const lit = win && reveal;
  const { delay, big } = celebration(odds);
  return (
    <motion.div
      title={title}
      animate={lit ? { scale: big ? [1, 1.14, 0.96, 1.05, 1] : [1, 1.045, 1] } : { scale: 1 }}
      transition={{ duration: big ? 0.9 : 0.5, delay: lit ? delay : 0 }}
      className={`relative flex flex-col items-center justify-center border border-gold-600/40 transition-colors
        ${lit ? 'bg-gold-400/30 z-10' : 'bg-black/10 hover:bg-black/0'} ${className}`}
    >
      {lit && (
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-[2px]"
          style={{
            boxShadow: big
              ? 'inset 0 0 0 2px var(--color-gold-400), 0 0 28px 6px rgba(245,196,81,0.9)'
              : 'inset 0 0 0 2px var(--color-gold-400), 0 0 18px 2px rgba(245,196,81,0.7)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: big ? 0.8 : 1.1, repeat: Infinity, delay }}
        />
      )}
      {children}
      {placed && (
        <div className="absolute -top-1.5 -right-1.5 z-20">
          <Chip amount={state!.placed} size={22} color={lit ? '#2f6fed' : '#d23b3b'} />
        </div>
      )}
    </motion.div>
  );
}

const grpHdr = 'text-[8.5px] leading-tight text-center text-gold-100/90 py-0.5 border-b border-gold-600/40 font-semibold tracking-wide';
const FACE_WORD = ['', 'one', 'two', 'three', 'four', 'five', 'six'];

// ---------------------------------------------------------------- hot/cold trend panel
type Result = 'small' | 'big' | 'triple';

function classify(d: Dice): { result: Result; sum: number } {
  const sum = d[0] + d[1] + d[2];
  const isTriple = d[0] === d[1] && d[1] === d[2];
  return { result: isTriple ? 'triple' : sum <= 10 ? 'small' : 'big', sum };
}

const RESULT_HEX: Record<Result, string> = { small: '#4a9eff', big: '#e05a5a', triple: '#e0a92e' };

const HISTORY_WINDOW = 40;

function RecentRolls({ history }: { history: Dice[] }) {
  if (!history.length) return <p className="text-[10px] text-white/30">No rolls yet.</p>;
  return (
    <div className="flex items-center gap-1 flex-wrap max-w-xs">
      {history.slice(0, 15).map((d, i) => {
        const { result, sum } = classify(d);
        return (
          <div key={i} className="flex flex-col items-center gap-0.5 rounded-md px-1 py-0.5"
            style={{ background: `${RESULT_HEX[result]}22`, opacity: 1 - i * 0.055 }}>
            <div className="flex gap-0.5">{d.map((v, j) => <MiniDie key={j} value={v} size={9} />)}</div>
            <span className="text-[8px] font-bold" style={{ color: RESULT_HEX[result] }}>{sum}</span>
          </div>
        );
      })}
    </div>
  );
}

function FreqBar({ label, segments }: { label: string; segments: Array<{ n: number; color: string; name: string }> }) {
  const total = segments.reduce((s, x) => s + x.n, 0) || 1;
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wide text-white/40 mb-1">{label}</p>
      <div className="flex h-3 w-40 rounded-full overflow-hidden bg-black/30">
        {segments.map((s, i) => (
          <div key={i} style={{ width: `${(s.n / total) * 100}%`, background: s.color }} title={`${s.name}: ${s.n}`} />
        ))}
      </div>
      <div className="flex gap-2 mt-1 flex-wrap">
        {segments.map((s, i) => (
          <span key={i} className="text-[8px] text-white/60">{s.name} {Math.round((s.n / total) * 100)}%</span>
        ))}
      </div>
    </div>
  );
}

function HotCold({ history }: { history: Dice[] }) {
  const counts = [0, 0, 0, 0, 0, 0, 0]; // 1-indexed
  for (const d of history) for (const v of d) counts[v]!++;
  const faces = [1, 2, 3, 4, 5, 6];
  const max = Math.max(...faces.map((f) => counts[f]!));
  const min = Math.min(...faces.map((f) => counts[f]!));
  const hasSpread = history.length > 0 && max > min;
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wide text-white/40 mb-1">Hot / Cold Numbers</p>
      <div className="flex gap-1">
        {faces.map((f) => {
          const n = counts[f]!;
          const isHot = hasSpread && n === max;
          const isCold = hasSpread && n === min;
          return (
            <div key={f} className="relative flex flex-col items-center gap-0.5 rounded-md px-1 py-1"
              style={{
                background: isHot ? 'rgba(245,196,81,0.18)' : isCold ? 'rgba(74,158,255,0.14)' : 'rgba(0,0,0,0.2)',
                boxShadow: isHot ? 'inset 0 0 0 1px rgba(245,196,81,0.6)' : isCold ? 'inset 0 0 0 1px rgba(74,158,255,0.5)' : undefined,
              }}>
              <MiniDie value={f} size={16} />
              <span className="text-[8px] text-white/70">{n}</span>
              {isHot && <span className="absolute -top-1.5 text-[7px] text-gold-400 font-bold">HOT</span>}
              {isCold && <span className="absolute -top-1.5 text-[7px] text-blue-300 font-bold">COLD</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SicBoTrendPanel({ history }: { history: Dice[] }) {
  const shown = history.slice(0, HISTORY_WINDOW);
  const classified = shown.map(classify);
  const smallBigSegs = [
    { n: classified.filter((c) => c.result === 'small').length, color: RESULT_HEX.small, name: 'Small' },
    { n: classified.filter((c) => c.result === 'big').length, color: RESULT_HEX.big, name: 'Big' },
    { n: classified.filter((c) => c.result === 'triple').length, color: RESULT_HEX.triple, name: 'Triple' },
  ];
  const oddEvenSegs = [
    { n: shown.filter((d) => (d[0] + d[1] + d[2]) % 2 === 1).length, color: '#7ad0a0', name: 'Odd' },
    { n: shown.filter((d) => (d[0] + d[1] + d[2]) % 2 === 0).length, color: '#c98be0', name: 'Even' },
  ];
  return (
    <div className="w-full max-w-2xl rounded-lg border border-gold-600/30 bg-black/20 p-3 flex flex-col sm:flex-row gap-4 overflow-x-auto">
      <div>
        <p className="text-[9px] uppercase tracking-wide text-white/40 mb-1">Recent Rolls</p>
        <RecentRolls history={shown} />
      </div>
      <div className="h-px sm:h-auto sm:w-px bg-white/10" />
      <div className="flex flex-col gap-2.5">
        <FreqBar label="Small / Big / Triple" segments={smallBigSegs} />
        <FreqBar label="Odd / Even" segments={oddEvenSegs} />
      </div>
      <div className="h-px sm:h-auto sm:w-px bg-white/10" />
      <HotCold history={shown} />
    </div>
  );
}

// ---------------------------------------------------------------- board
export function SicBoBoard({ dice, placedBets, history = [], roundKey, onSettled }: {
  dice: number[]; placedBets: any[]; roundKey: number; history?: number[][]; onSettled?: () => void;
}) {
  const d = dice as Dice;
  const sum = d[0] + d[1] + d[2];
  const triple = d[0] === d[1] && d[1] === d[2];
  const count = (f: number) => (d[0] === f ? 1 : 0) + (d[1] === f ? 1 : 0) + (d[2] === f ? 1 : 0);
  const sortedDice = [...d].sort().join('');

  // win highlights + result banner only appear once the dice have settled
  const [reveal, setReveal] = useState(false);
  useEffect(() => { setReveal(false); }, [roundKey]);

  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  useEffect(() => {
    if (!reveal) return;
    const t = window.setTimeout(() => onSettledRef.current?.(), 800);
    return () => window.clearTimeout(t);
  }, [reveal]);

  // aggregate bot chips by cell id
  const staked: Record<string, number> = {};
  for (const b of placedBets ?? []) {
    let id = '';
    if (b.type === 'small' || b.type === 'big' || b.type === 'odd' || b.type === 'even' || b.type === 'anytriple') id = b.type;
    else if (b.type === 'total') id = `total-${b.total}`;
    else if (b.type === 'single') id = `single-${b.face}`;
    else if (b.type === 'double') id = `double-${b.face}`;
    else if (b.type === 'triple') id = `triple-${b.face}`;
    else if (b.type === 'combo' && b.faces) {
      const [x, y] = [...b.faces].sort((p: number, q: number) => p - q);
      id = `combo-${x}-${y}`;
    } else if (b.type === 'doubleAny') id = `da-${b.face}-${b.partner}`;
    else if (b.type === 'threeSingleCombo' && b.triple) id = `tsc-${[...b.triple].sort().join('')}`;
    else if (b.type === 'threeFromFour') id = `fromfour-${b.group}`;
    if (id) staked[id] = (staked[id] ?? 0) + (b.amount ?? 0);
  }
  const st = (id: string): CellState => ({ placed: staked[id] ?? 0, win: false });

  // win predicates (mirror the engine exactly)
  const winSmall = !triple && sum >= 4 && sum <= 10;
  const winBig = !triple && sum >= 11 && sum <= 17;
  const winOdd = !triple && sum % 2 === 1;
  const winEven = !triple && sum % 2 === 0;
  const winTotal = (n: number) => sum === n;
  const winSingle = (f: number) => count(f) >= 1;
  const winDouble = (f: number) => count(f) >= 2;
  const winTriple = (f: number) => count(f) === 3;
  const winCombo = (x: number, y: number) => count(x) >= 1 && count(y) >= 1;
  const winDoubleAny = (face: number, partner: number) => sortedDice === [face, face, partner].sort().join('');
  const winThreeSingle = (t: number[]) => sortedDice === [...t].sort().join('');
  const winFromFour = (group: number) => {
    const set = SICBO_THREE_FROM_FOUR_GROUPS[group]!;
    const distinct = new Set(d);
    return distinct.size === 3 && [...distinct].every((f) => (set as number[]).includes(f));
  };

  const combos: [number, number][] = [];
  for (let x = 1; x <= 6; x++) for (let y = x + 1; y <= 6; y++) combos.push([x, y]);

  const DoubleCell = (f: number) => (
    <Cell key={`d${f}`} state={st(`double-${f}`)} win={winDouble(f)} reveal={reveal} odds={SICBO_ODDS.double} title={`Double ${f} — 1 wins ${SICBO_ODDS.double}`} className="flex-1 py-1 gap-1">
      <div className="flex gap-0.5"><MiniDie value={f} size={16} /><MiniDie value={f} size={16} /></div>
      <span className="text-[8px] text-gold-100/70">double {FACE_WORD[f]}</span>
    </Cell>
  );
  const TripleCell = (f: number) => (
    <Cell key={`t${f}`} state={st(`triple-${f}`)} win={winTriple(f)} reveal={reveal} odds={SICBO_ODDS.triple} title={`Triple ${f}${f}${f} — 1 wins ${SICBO_ODDS.triple}`} className="flex-1 py-1 gap-0.5">
      <div className="flex gap-0.5"><MiniDie value={f} size={13} /><MiniDie value={f} size={13} /><MiniDie value={f} size={13} /></div>
    </Cell>
  );

  const resultLabel = triple ? `TRIPLE ${d[0]}` : sum <= 10 ? 'SMALL' : 'BIG';
  const pastRolls = (history as Dice[]) ?? [];
  const winCount = placedBets?.filter((b) => {
    if (b.type === 'small') return winSmall; if (b.type === 'big') return winBig;
    if (b.type === 'odd') return winOdd; if (b.type === 'even') return winEven;
    if (b.type === 'anytriple') return triple;
    if (b.type === 'total') return winTotal(b.total);
    if (b.type === 'single') return winSingle(b.face);
    if (b.type === 'double') return winDouble(b.face);
    if (b.type === 'triple') return winTriple(b.face);
    if (b.type === 'combo' && b.faces) return winCombo(b.faces[0], b.faces[1]);
    if (b.type === 'doubleAny') return winDoubleAny(b.face, b.partner);
    if (b.type === 'threeSingleCombo' && b.triple) return winThreeSingle(b.triple);
    if (b.type === 'threeFromFour') return winFromFour(b.group);
    return false;
  }).length ?? 0;

  const scaleRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [contentH, setContentH] = useState(0);
  useEffect(() => {
    const el = scaleRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / 900));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContentH(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="w-full flex flex-col items-center gap-3">
      <div ref={scaleRef} className="w-full flex justify-center">
        <div ref={contentRef} style={{ transform: `scale(${scale})`, transformOrigin: 'top center', marginBottom: contentH * (scale - 1) }}>
      <div className="mx-auto flex flex-col gap-3" style={{ minWidth: 900 }}>
          {/* shaker + result banner */}
          <div className="flex items-center justify-center gap-6 pb-1 min-h-[132px]">
            <DiceShaker dice={d} roundKey={roundKey} onSettle={() => setReveal(true)} />
            <AnimatePresence>
              {reveal && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.6, x: -8 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                  className="flex flex-col items-center rounded-xl border-2 border-gold-500/60 px-4 py-2"
                  style={{ background: 'linear-gradient(180deg,rgba(245,196,81,0.14),rgba(0,0,0,0.25))' }}
                >
                  <span className="text-[10px] uppercase tracking-widest text-gold-100/70">Total</span>
                  <span className="font-display text-gold-400 text-4xl leading-none">{sum}</span>
                  <span className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-white">{resultLabel}</span>
                  {winCount > 0 && <span className="mt-0.5 text-[10px] text-chip-green">{winCount} bet{winCount === 1 ? '' : 's'} won</span>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* board — bright emerald felt with radial depth + casino signage banner */}
          <div className="relative rounded-lg overflow-hidden border-2 border-gold-500/60 select-none shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex"
            style={{ background: 'radial-gradient(140% 70% at 50% 0%, #1e8a5c 0%, #145f3f 55%, #0b3d29 100%)' }}>
            <span className="pointer-events-none absolute -bottom-8 -right-8 text-[140px] leading-none text-black/10 select-none">⚅</span>

            {/* left column: Double+Single (50:1) over Three-Single-Dice (30:1) — exact combos, real felt groups */}
            <div className="relative flex flex-col border-r-2 border-gold-500/60 z-10" style={{ width: 210 }}>
              <div className={grpHdr}>Double + Single — 1 wins {SICBO_ODDS.doubleAny}</div>
              <div className="grid grid-cols-5 flex-1">
                {SICBO_DOUBLE_ANY_PAIRS.map(([face, partner]) => (
                  <Cell key={`da-${face}-${partner}`} state={st(`da-${face}-${partner}`)} win={winDoubleAny(face, partner)} reveal={reveal} odds={SICBO_ODDS.doubleAny}
                    className="py-0.5 gap-0.5 border-t border-l border-gold-600/25" title={`Double ${face} + ${partner} — 1 wins ${SICBO_ODDS.doubleAny}`}>
                    <div className="flex gap-0.5"><MiniDie value={face} size={10} /><MiniDie value={face} size={10} /><MiniDie value={partner} size={10} /></div>
                  </Cell>
                ))}
              </div>
              <div className={`${grpHdr} border-t-2`}>Three Single Dice — 1 wins {SICBO_ODDS.threeSingleCombo}</div>
              <div className="grid grid-cols-5 flex-1">
                {Object.values(SICBO_THREE_SINGLE_COMBO_GROUPS).flat().map((code) => {
                  const t = code.split('').map(Number);
                  return (
                    <Cell key={`tsc-${code}`} state={st(`tsc-${code}`)} win={winThreeSingle(t)} reveal={reveal} odds={SICBO_ODDS.threeSingleCombo}
                      className="py-0.5 gap-0.5 border-t border-l border-gold-600/25" title={`${code} — 1 wins ${SICBO_ODDS.threeSingleCombo}`}>
                      <div className="flex gap-0.5">{t.map((f, i) => <MiniDie key={i} value={f} size={11} />)}</div>
                    </Cell>
                  );
                })}
              </div>
            </div>

            <div className="relative flex-1 flex flex-col z-10">
              <div className="text-center py-1.5 border-b-2 border-gold-500/60 bg-black/15">
                <p className="font-display text-gold-400 text-sm sm:text-base tracking-[0.25em]">SIC BO</p>
                <p className="text-[8px] sm:text-[9px] text-gold-200/75 uppercase tracking-[0.15em] -mt-0.5">
                  Small · Big · Odd · Even · Combo pay 2.78% edge — best on the table
                </p>
              </div>

              {/* band 1: EVEN/BIG (left) — doubles/triples/ANY TRIPLE fan (centre) — ODD/SMALL (right) */}
              <div className="grid" style={{ gridTemplateColumns: '2.2fr 3fr 3fr 1.9fr 3fr 3fr 2.2fr', minHeight: 96 }}>
                {/* EVEN over BIG — the real felt's left-corner pairing */}
                <div className="flex flex-col">
                  <Cell state={st('even')} win={winEven} reveal={reveal} className="flex-1 flex-row gap-1 px-1" title="Even total, loses on any triple — 1 wins 1 · min 50">
                    <span className="font-display text-gold-400 text-sm leading-none">EVEN</span>
                    <span className="text-[7px] text-gold-300/90">min 50</span>
                  </Cell>
                  <Cell state={st('big')} win={winBig} reveal={reveal} className="flex-[2] p-1.5 text-center border-t border-gold-600/40" title="Big: total 11–17, loses on any triple — 1 wins 1 · min 50">
                    <span className="font-display text-gold-400 text-base leading-none">BIG</span>
                    <span className="text-[8px] text-white/80 mt-0.5">Numbers 11 to 17</span>
                    <span className="text-[8px] text-gold-100/90">1 wins 1</span>
                    <span className="text-[7px] text-white/60">Lose on any triple</span>
                    <span className="text-[7px] text-gold-300/90 mt-0.5">min 50</span>
                  </Cell>
                </div>
                {/* doubles 1-3 */}
                <div className="flex flex-col border-x border-gold-600/40">
                  <div className={grpHdr}>Each double 1 wins {SICBO_ODDS.double}</div>
                  <div className="flex flex-1">{[1, 2, 3].map(DoubleCell)}</div>
                </div>
                {/* triples 1-3 */}
                <div className="flex flex-col">
                  <div className={grpHdr}>Each triple 1 wins {SICBO_ODDS.triple}</div>
                  <div className="flex flex-1">{[1, 2, 3].map(TripleCell)}</div>
                </div>
                {/* any triple */}
                <div className="flex flex-col border-x border-gold-600/40">
                  <div className={grpHdr}>1 wins {SICBO_ODDS.anytriple}</div>
                  <Cell state={st('anytriple')} win={triple} reveal={reveal} odds={SICBO_ODDS.anytriple} className="flex-1 p-1" title={`Any triple — 1 wins ${SICBO_ODDS.anytriple}`}>
                    <span className="font-display text-gold-400 text-xs leading-tight text-center">ANY<br />TRIPLE</span>
                  </Cell>
                </div>
                {/* triples 4-6 */}
                <div className="flex flex-col">
                  <div className={grpHdr}>Each triple 1 wins {SICBO_ODDS.triple}</div>
                  <div className="flex flex-1">{[4, 5, 6].map(TripleCell)}</div>
                </div>
                {/* doubles 4-6 */}
                <div className="flex flex-col border-x border-gold-600/40">
                  <div className={grpHdr}>Each double 1 wins {SICBO_ODDS.double}</div>
                  <div className="flex flex-1">{[4, 5, 6].map(DoubleCell)}</div>
                </div>
                {/* ODD over SMALL — the real felt's right-corner pairing */}
                <div className="flex flex-col">
                  <Cell state={st('odd')} win={winOdd} reveal={reveal} className="flex-1 flex-row gap-1 px-1" title="Odd total, loses on any triple — 1 wins 1 · min 50">
                    <span className="font-display text-gold-400 text-sm leading-none">ODD</span>
                    <span className="text-[7px] text-gold-300/90">min 50</span>
                  </Cell>
                  <Cell state={st('small')} win={winSmall} reveal={reveal} className="flex-[2] p-1.5 text-center border-t border-gold-600/40" title="Small: total 4–10, loses on any triple — 1 wins 1 · min 50">
                    <span className="font-display text-gold-400 text-base leading-none">SMALL</span>
                    <span className="text-[8px] text-white/80 mt-0.5">Numbers 4 to 10</span>
                    <span className="text-[8px] text-gold-100/90">1 wins 1</span>
                    <span className="text-[7px] text-white/60">Lose on any triple</span>
                    <span className="text-[7px] text-gold-300/90 mt-0.5">min 50</span>
                  </Cell>
                </div>
              </div>

              {/* band 2 — totals */}
              <div className="grid border-t-2 border-gold-500/60" style={{ gridTemplateColumns: `repeat(14,1fr)`, minHeight: 46 }}>
                {Object.keys(SICBO_TOTAL_ODDS).map((k) => {
                  const n = Number(k);
                  return (
                    <Cell key={n} state={st(`total-${n}`)} win={winTotal(n)} reveal={reveal} odds={SICBO_TOTAL_ODDS[n]} className="py-1 border-l border-gold-600/30" title={`Total ${n} — 1 wins ${SICBO_TOTAL_ODDS[n]}`}>
                      <span className="font-display text-gold-400 text-sm leading-none">{n}</span>
                      <span className="text-[7.5px] text-white/70">1 wins {SICBO_TOTAL_ODDS[n]}</span>
                    </Cell>
                  );
                })}
              </div>

              {/* band 3 — two dice combos */}
              <div className="grid border-t-2 border-gold-500/60" style={{ gridTemplateColumns: `2fr repeat(15,1fr)`, minHeight: 52 }}>
                <div className="flex flex-col items-center justify-center border-r border-gold-600/40 px-1 text-center">
                  <span className="font-display text-gold-400 text-xs leading-tight">TWO<br />DICE</span>
                  <span className="text-[8px] text-gold-100/90 mt-0.5">1 wins {SICBO_ODDS.combo}</span>
                </div>
                {combos.map(([x, y]) => (
                  <Cell key={`${x}-${y}`} state={st(`combo-${x}-${y}`)} win={winCombo(x, y)} reveal={reveal} odds={SICBO_ODDS.combo} className="py-1 gap-0.5 border-l border-gold-600/30" title={`${x} & ${y} — 1 wins ${SICBO_ODDS.combo}`}>
                    <div className="flex gap-0.5"><MiniDie value={x} size={13} /><MiniDie value={y} size={13} /></div>
                    <span className="text-[7px] text-white/60">{x} &amp; {y}</span>
                  </Cell>
                ))}
              </div>

              {/* band 3b — three dice from four possible combinations */}
              <div className="grid border-t-2 border-gold-500/60" style={{ gridTemplateColumns: `2fr repeat(4,1fr)`, minHeight: 44 }}>
                <div className="flex flex-col items-center justify-center border-r border-gold-600/40 px-1 text-center">
                  <span className="font-display text-gold-400 text-[10px] leading-tight">3 FROM<br />4</span>
                  <span className="text-[8px] text-gold-100/90 mt-0.5">1 wins {SICBO_ODDS.threeFromFour}</span>
                </div>
                {Object.entries(SICBO_THREE_FROM_FOUR_GROUPS).map(([g, set]) => (
                  <Cell key={g} state={st(`fromfour-${g}`)} win={winFromFour(Number(g))} reveal={reveal} odds={SICBO_ODDS.threeFromFour} className="py-1 gap-0.5 border-l border-gold-600/30" title={`${set.join('-')} — 1 wins ${SICBO_ODDS.threeFromFour}`}>
                    <span className="text-[11px] text-white/85 font-semibold">{set.join('-')}</span>
                  </Cell>
                ))}
              </div>

              {/* band 4 — singles */}
              <div className="grid border-t-2 border-gold-500/60" style={{ gridTemplateColumns: `repeat(6,1fr)`, minHeight: 54 }}>
                {[1, 2, 3, 4, 5, 6].map((f) => (
                  <Cell key={f} state={st(`single-${f}`)} win={winSingle(f)} reveal={reveal} odds={count(f) === 3 ? 12 : 1} className="flex-row gap-2 py-1 border-l border-gold-600/30"
                    title={`Single ${f} — pays by match count (1:1 / 2:1 / 12:1)`}>
                    <span className="font-display text-gold-400 text-sm">
                      {['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'][f]}
                    </span>
                    <MiniDie value={f} size={22} />
                  </Cell>
                ))}
              </div>
              <div className="grid grid-cols-3 text-center text-[8.5px] text-white/75 bg-black/25 border-t border-gold-600/40 py-0.5">
                <span>1:1 on one die</span><span>2:1 on two dice</span><span>12:1 on three dice</span>
              </div>
              <div className="text-center text-[8px] text-gold-200/70 bg-black/30 py-0.5">
                Table minimums — even-money (Small · Big · Odd · Even) 50 · all inside bets 10
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>

      <SicBoTrendPanel history={pastRolls} />
    </div>
  );
}
