// Authentic Sic Bo table — mirrors the standard Macau / Wizard-of-Odds layout
// (see docs reference image: online-gambling.com sic-bo-game-board). Four bands,
// top → bottom:
//   1. SMALL | doubles + specific-triples + ANY TRIPLE | BIG
//   2. Totals 4..17 (each with its "1 wins N" odds)
//   3. Fifteen two-dice combinations (dominoes), 1 wins 5
//   4. Single numbers ONE..SIX (1:1 / 2:1 / 3:1 by match count)
//
// It is a *replay* board: the bot's placedBets drop chips on the matching cells,
// the three dice tumble inside a glass shaker dome, the dome lifts, then every
// winning cell lights up and a result banner pops. Win predicates here mirror
// packages/engine/src/games/sicbo.ts exactly.

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
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
// pedestal, then the dome lifts and the dice settle with a bounce.
function DiceShaker({ dice, roundKey, onSettle }: { dice: Dice; roundKey: number; onSettle: () => void }) {
  const [shown, setShown] = useState<Dice>(dice);
  const [rolling, setRolling] = useState(true);
  const timer = useRef<number | null>(null);
  const settleCb = useRef(onSettle);
  settleCb.current = onSettle;

  useEffect(() => {
    setRolling(true);
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
        settleCb.current();
      }
    };
    tick();
    return () => { if (timer.current) window.clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundKey]);

  return (
    <div className="relative flex flex-col items-center" style={{ width: 210, height: 132 }}>
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
        {shown.map((v, i) => (
          <motion.div
            key={i}
            animate={rolling
              ? { rotate: [0, -22, 24, -14, 0], y: [0, -12, 0, -7, 0] }
              : { rotate: 0, y: 0, scale: [1.15, 0.92, 1] }}
            transition={rolling
              ? { duration: 0.26, repeat: Infinity, ease: 'easeInOut', delay: i * 0.04 }
              : { duration: 0.45, ease: 'easeOut' }}
          >
            <Pips value={v} size={48} />
          </motion.div>
        ))}
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

function Cell({
  state, win, reveal, children, className = '', title,
}: {
  state?: CellState; win: boolean; reveal: boolean; children: React.ReactNode; className?: string; title?: string;
}) {
  const placed = (state?.placed ?? 0) > 0;
  const lit = win && reveal;
  return (
    <motion.div
      title={title}
      animate={lit ? { scale: [1, 1.045, 1] } : { scale: 1 }}
      transition={{ duration: 0.5 }}
      className={`relative flex flex-col items-center justify-center border border-gold-600/40 transition-colors
        ${lit ? 'bg-gold-400/30 z-10' : 'bg-black/10 hover:bg-black/0'} ${className}`}
    >
      {lit && (
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-[2px]"
          style={{ boxShadow: 'inset 0 0 0 2px var(--color-gold-400), 0 0 18px 2px rgba(245,196,81,0.7)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.1, repeat: Infinity }}
        />
      )}
      {children}
      {placed && (
        <div className="absolute -top-1.5 -right-1.5 z-20">
          <Chip amount={state!.placed} size={22} color={lit ? '#23a06b' : '#e0a92e'} />
        </div>
      )}
    </motion.div>
  );
}

const grpHdr = 'text-[8.5px] leading-tight text-center text-gold-100/90 py-0.5 border-b border-gold-600/40 font-semibold tracking-wide';

// ---------------------------------------------------------------- board
export function SicBoBoard({ dice, placedBets, roundKey }: {
  dice: number[]; placedBets: any[]; roundKey: number;
}) {
  const d = dice as Dice;
  const sum = d[0] + d[1] + d[2];
  const triple = d[0] === d[1] && d[1] === d[2];
  const count = (f: number) => (d[0] === f ? 1 : 0) + (d[1] === f ? 1 : 0) + (d[2] === f ? 1 : 0);

  // win highlights + result banner only appear once the dice have settled
  const [reveal, setReveal] = useState(false);
  useEffect(() => { setReveal(false); }, [roundKey]);

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
    }
    if (id) staked[id] = (staked[id] ?? 0) + (b.amount ?? 0);
  }
  const st = (id: string): CellState => ({ placed: staked[id] ?? 0, win: false });

  // win predicates (mirror the engine)
  const winSmall = !triple && sum >= 4 && sum <= 10;
  const winBig = !triple && sum >= 11 && sum <= 17;
  const winOdd = !triple && sum % 2 === 1;
  const winEven = !triple && sum % 2 === 0;
  const winTotal = (n: number) => sum === n;
  const winSingle = (f: number) => count(f) >= 1;
  const winDouble = (f: number) => count(f) >= 2;
  const winTriple = (f: number) => count(f) === 3;
  const winCombo = (x: number, y: number) => count(x) >= 1 && count(y) >= 1;

  const TOTAL_ODDS: Record<number, number> = {
    4: 60, 5: 30, 6: 17, 7: 12, 8: 8, 9: 6, 10: 6, 11: 6, 12: 6, 13: 8, 14: 12, 15: 17, 16: 30, 17: 60,
  };
  const combos: [number, number][] = [];
  for (let x = 1; x <= 6; x++) for (let y = x + 1; y <= 6; y++) combos.push([x, y]);

  const DoubleCell = (f: number) => (
    <Cell key={`d${f}`} state={st(`double-${f}`)} win={winDouble(f)} reveal={reveal} title={`Double ${f} — 1 wins 10`} className="flex-1 py-1 gap-1">
      <div className="flex gap-0.5"><MiniDie value={f} size={16} /><MiniDie value={f} size={16} /></div>
      <span className="text-[8px] text-gold-100/70">double {['', 'one', 'two', 'three', 'four', 'five', 'six'][f]}</span>
    </Cell>
  );
  const TripleCell = (f: number) => (
    <Cell key={`t${f}`} state={st(`triple-${f}`)} win={winTriple(f)} reveal={reveal} title={`Triple ${f}${f}${f} — 1 wins 180`} className="flex-1 py-1 gap-0.5">
      <div className="flex gap-0.5"><MiniDie value={f} size={13} /><MiniDie value={f} size={13} /><MiniDie value={f} size={13} /></div>
    </Cell>
  );

  const resultLabel = triple ? `TRIPLE ${d[0]}` : sum <= 10 ? 'SMALL' : 'BIG';

  return (
    <div className="w-full overflow-x-auto">
      <div className="mx-auto flex flex-col gap-3" style={{ minWidth: 720 }}>
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* board — bright emerald felt to match the real table */}
        <div className="rounded-lg overflow-hidden border-2 border-gold-500/60 select-none shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
          style={{ background: 'linear-gradient(180deg,#1a7f56,#0f5c3d)' }}>

          {/* band 1 */}
          <div className="grid" style={{ gridTemplateColumns: '2.2fr 3fr 3fr 1.9fr 3fr 3fr 2.2fr', minHeight: 96 }}>
            {/* SMALL over ODD (even-money band, min 50) */}
            <div className="flex flex-col">
              <Cell state={st('small')} win={winSmall} reveal={reveal} className="flex-[2] p-1.5 text-center" title="Small: total 4–10, loses on any triple — 1 wins 1 · min 50">
                <span className="font-display text-gold-400 text-base leading-none">SMALL</span>
                <span className="text-[8px] text-white/80 mt-0.5">Numbers 4 to 10</span>
                <span className="text-[8px] text-gold-100/90">1 wins 1</span>
                <span className="text-[7px] text-white/60">Lose on any triple</span>
                <span className="text-[7px] text-gold-300/90 mt-0.5">min 50</span>
              </Cell>
              <Cell state={st('odd')} win={winOdd} reveal={reveal} className="flex-1 flex-row gap-1 px-1 border-t border-gold-600/40" title="Odd total, loses on any triple — 1 wins 1 · min 50">
                <span className="font-display text-gold-400 text-sm leading-none">ODD</span>
                <span className="text-[7px] text-gold-300/90">min 50</span>
              </Cell>
            </div>
            {/* doubles 1-3 */}
            <div className="flex flex-col border-x border-gold-600/40">
              <div className={grpHdr}>Each double 1 wins 10</div>
              <div className="flex flex-1">{[1, 2, 3].map(DoubleCell)}</div>
            </div>
            {/* triples 1-3 */}
            <div className="flex flex-col">
              <div className={grpHdr}>Each triple 1 wins 180</div>
              <div className="flex flex-1">{[1, 2, 3].map(TripleCell)}</div>
            </div>
            {/* any triple */}
            <div className="flex flex-col border-x border-gold-600/40">
              <div className={grpHdr}>1 wins 30</div>
              <Cell state={st('anytriple')} win={triple} reveal={reveal} className="flex-1 p-1" title="Any triple — 1 wins 30">
                <span className="font-display text-gold-400 text-xs leading-tight text-center">ANY<br />TRIPLE</span>
              </Cell>
            </div>
            {/* triples 4-6 */}
            <div className="flex flex-col">
              <div className={grpHdr}>Each triple 1 wins 180</div>
              <div className="flex flex-1">{[4, 5, 6].map(TripleCell)}</div>
            </div>
            {/* doubles 4-6 */}
            <div className="flex flex-col border-x border-gold-600/40">
              <div className={grpHdr}>Each double 1 wins 10</div>
              <div className="flex flex-1">{[4, 5, 6].map(DoubleCell)}</div>
            </div>
            {/* BIG over EVEN (even-money band, min 50) */}
            <div className="flex flex-col">
              <Cell state={st('big')} win={winBig} reveal={reveal} className="flex-[2] p-1.5 text-center" title="Big: total 11–17, loses on any triple — 1 wins 1 · min 50">
                <span className="font-display text-gold-400 text-base leading-none">BIG</span>
                <span className="text-[8px] text-white/80 mt-0.5">Numbers 11 to 17</span>
                <span className="text-[8px] text-gold-100/90">1 wins 1</span>
                <span className="text-[7px] text-white/60">Lose on any triple</span>
                <span className="text-[7px] text-gold-300/90 mt-0.5">min 50</span>
              </Cell>
              <Cell state={st('even')} win={winEven} reveal={reveal} className="flex-1 flex-row gap-1 px-1 border-t border-gold-600/40" title="Even total, loses on any triple — 1 wins 1 · min 50">
                <span className="font-display text-gold-400 text-sm leading-none">EVEN</span>
                <span className="text-[7px] text-gold-300/90">min 50</span>
              </Cell>
            </div>
          </div>

          {/* band 2 — totals */}
          <div className="grid border-t-2 border-gold-500/60" style={{ gridTemplateColumns: `repeat(14,1fr)`, minHeight: 46 }}>
            {Object.keys(TOTAL_ODDS).map((k) => {
              const n = Number(k);
              return (
                <Cell key={n} state={st(`total-${n}`)} win={winTotal(n)} reveal={reveal} className="py-1 border-l border-gold-600/30" title={`Total ${n} — 1 wins ${TOTAL_ODDS[n]}`}>
                  <span className="font-display text-gold-400 text-sm leading-none">{n}</span>
                  <span className="text-[7.5px] text-white/70">1 wins {TOTAL_ODDS[n]}</span>
                </Cell>
              );
            })}
          </div>

          {/* band 3 — two dice combos */}
          <div className="grid border-t-2 border-gold-500/60" style={{ gridTemplateColumns: `2fr repeat(15,1fr)`, minHeight: 52 }}>
            <div className="flex flex-col items-center justify-center border-r border-gold-600/40 px-1 text-center">
              <span className="font-display text-gold-400 text-xs leading-tight">TWO<br />DICE</span>
              <span className="text-[8px] text-gold-100/90 mt-0.5">1 wins 5</span>
            </div>
            {combos.map(([x, y]) => (
              <Cell key={`${x}-${y}`} state={st(`combo-${x}-${y}`)} win={winCombo(x, y)} reveal={reveal} className="py-1 gap-0.5 border-l border-gold-600/30" title={`${x} & ${y} — 1 wins 5`}>
                <div className="flex gap-0.5"><MiniDie value={x} size={13} /><MiniDie value={y} size={13} /></div>
                <span className="text-[7px] text-white/60">{x} &amp; {y}</span>
              </Cell>
            ))}
          </div>

          {/* band 4 — singles */}
          <div className="grid border-t-2 border-gold-500/60" style={{ gridTemplateColumns: `repeat(6,1fr)`, minHeight: 54 }}>
            {[1, 2, 3, 4, 5, 6].map((f) => (
              <Cell key={f} state={st(`single-${f}`)} win={winSingle(f)} reveal={reveal} className="flex-row gap-2 py-1 border-l border-gold-600/30"
                title={`Single ${f} — pays by match count (1:1 / 2:1 / 3:1)`}>
                <span className="font-display text-gold-400 text-sm">
                  {['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'][f]}
                </span>
                <MiniDie value={f} size={22} />
              </Cell>
            ))}
          </div>
          <div className="grid grid-cols-3 text-center text-[8.5px] text-white/75 bg-black/25 border-t border-gold-600/40 py-0.5">
            <span>1:1 on one die</span><span>2:1 on two dice</span><span>3:1 on three dice</span>
          </div>
          <div className="text-center text-[8px] text-gold-200/70 bg-black/30 py-0.5">
            Table minimums — even-money (Small · Big · Odd · Even) 50 · all inside bets 10
          </div>
        </div>
      </div>
    </div>
  );
}
