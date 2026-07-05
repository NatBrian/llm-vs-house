// Authentic Roulette table — European (single-zero) or American (double-zero),
// English/American felt layout (no racetrack — matches the Singapore/Malaysia
// casino convention documented in docs/PAYOUTS.md: no la partage/en prison, no
// French call bets). Two parts:
//   1. Wheel + ball: the pocket ring does a short decelerating spin and returns
//      to its origin orientation; the ball rides the rim independently in the
//      opposite direction, decelerating over more revolutions, and settles
//      exactly on the winning pocket — the two motions are pre-computed
//      keyframe arrays (deterministic, no manual RAF polling needed since
//      rotation doesn't need discrete frame values the way SicBoBoard's dice
//      faces do).
//   2. Felt: 0 (/00) + the 3x12 number grid + column/dozen boxes + the outside
//      row, chips placed on every cell a bet actually covers, winning cells
//      glow once the ball settles. Win predicates reuse @casino/engine
//      directly (rouletteWins) rather than re-deriving them in the UI.
import { motion } from 'framer-motion';
import { useState } from 'react';
import { RED_NUMBERS, rouletteWins, type RouletteBetType } from '@casino/engine';
import { Chip } from './primitives';

type Pocket = number | '00';

const EUROPEAN_ORDER: Pocket[] = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const AMERICAN_ORDER: Pocket[] = [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, '00', 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2];

const pocketHex = (p: Pocket) => (p === 0 || p === '00' ? '#1a7f56' : RED_NUMBERS.has(p as number) ? '#b3283a' : '#141a20');
const pocketName = (p: Pocket) => (p === 0 || p === '00' ? 'Green' : RED_NUMBERS.has(p as number) ? 'Red' : 'Black');

/** Non-uniform samples of an ease-out cubic from 0 -> finalDeg, so a long
 *  framer keyframe rotation reads as "fast then decelerating" rather than a
 *  single linear/eased tween (which framer can't do across many revolutions). */
function decelKeyframes(finalDeg: number, steps = 28): number[] {
  const out: number[] = [0];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    out.push(finalDeg * (1 - Math.pow(1 - t, 3)));
  }
  return out;
}
const evenTimes = (steps: number) => Array.from({ length: steps + 1 }, (_, i) => i / steps);

function Wheel({ order, pocket, roundKey, onSettled }: { order: Pocket[]; pocket: Pocket; roundKey: number; onSettled: () => void }) {
  const n = order.length;
  const winIndex = Math.max(0, order.indexOf(pocket));
  const targetAngle = (winIndex / n) * 360;
  const WHEEL_STEPS = 20, BALL_STEPS = 28;
  const wheelFrames = decelKeyframes(4 * 360, WHEEL_STEPS); // spins forward, returns to origin
  const ballFrames = decelKeyframes(-(6 * 360) + targetAngle, BALL_STEPS); // opposite direction, lands on the pocket

  return (
    <div className="relative w-48 h-48 sm:w-56 sm:h-56 shrink-0">
      <motion.div
        key={`wheel-${roundKey}`}
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from 0deg, ${order.map((p, i) => {
            const c = pocketHex(p);
            return `${c} ${(i / n) * 360}deg ${((i + 1) / n) * 360}deg`;
          }).join(',')})`,
          boxShadow: 'inset 0 0 0 8px #b9861d, 0 10px 40px rgba(0,0,0,0.6)',
        }}
        initial={{ rotate: 0 }}
        animate={{ rotate: wheelFrames }}
        transition={{ duration: 2.6, times: evenTimes(WHEEL_STEPS), ease: 'linear' }}
      />
      {/* ball — independent ring, rides the rim, settles on the winning pocket */}
      <motion.div
        key={`ball-${roundKey}`}
        className="absolute inset-0"
        initial={{ rotate: 0 }}
        animate={{ rotate: ballFrames }}
        transition={{ duration: 2.6, times: evenTimes(BALL_STEPS), ease: 'linear' }}
        onAnimationComplete={onSettled}
      >
        <div className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white"
          style={{ top: 6, boxShadow: '0 0 8px rgba(255,255,255,0.9)' }} />
      </motion.div>
      <div className="absolute inset-[36%] rounded-full bg-ink-900 border-2 border-gold-600/50 flex items-center justify-center shadow-inner">
        <span className="text-gold-500 text-lg">♦</span>
      </div>
    </div>
  );
}

function HistoryRack({ history }: { history: Pocket[] }) {
  if (!history.length) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap justify-center max-w-xs">
      <span className="text-[9px] uppercase tracking-wide text-white/40 mr-1">Recent</span>
      {history.slice(0, 15).map((p, i) => (
        <span key={i} className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white/90"
          style={{ background: pocketHex(p), opacity: 1 - i * 0.05 }}>
          {String(p)}
        </span>
      ))}
    </div>
  );
}

interface CellState { staked: number; win: boolean }

function Cell({ state, reveal, children, className = '', title, bg }: {
  state: CellState; reveal: boolean; children: React.ReactNode; className?: string; title?: string; bg?: string;
}) {
  const lit = state.win && reveal;
  return (
    <motion.div
      title={title}
      animate={lit ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={{ duration: 0.5 }}
      style={{ background: lit ? undefined : bg }}
      className={`relative flex flex-col items-center justify-center border border-gold-600/40 ${lit ? 'bg-gold-400/30 z-10' : bg ? '' : 'bg-black/10'} ${className}`}
    >
      {lit && (
        <motion.span className="pointer-events-none absolute inset-0"
          style={{ boxShadow: 'inset 0 0 0 2px var(--color-gold-400), 0 0 14px 2px rgba(245,196,81,0.7)' }}
          initial={{ opacity: 0 }} animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.1, repeat: Infinity }} />
      )}
      {children}
      {state.staked > 0 && (
        <div className="absolute -top-1.5 -right-1.5 z-20">
          <Chip amount={state.staked} size={20} color={lit ? '#23a06b' : '#e0a92e'} />
        </div>
      )}
    </motion.div>
  );
}

/** Every board cell id a bet places a chip marker on (a multi-number bet gets
 *  a small chip on each number it covers — simpler and just as legible as
 *  trying to render it on the exact shared edge/corner). */
function betCellIds(bet: any, variant: string): string[] {
  switch (bet.type as RouletteBetType) {
    case 'straight': case 'split': case 'street': case 'corner': case 'sixline':
      return (bet.numbers ?? []).map((n: Pocket) => `n-${n}`);
    case 'five':
      return ['n-0', ...(variant === 'american' ? ['n-00'] : []), 'n-1', 'n-2', 'n-3'];
    case 'column': return [`col-${bet.selector ?? 1}`];
    case 'dozen': return [`dozen-${bet.selector ?? 1}`];
    default: return [`outside-${bet.type}`]; // red/black/odd/even/high/low
  }
}

const ROW_H = 52;

export function RouletteBoard({ pocket, placedBets, variant, history, roundKey }: {
  pocket: Pocket; placedBets: any[]; variant: 'european' | 'american'; history: Pocket[]; roundKey: number;
}) {
  const order = variant === 'american' ? AMERICAN_ORDER : EUROPEAN_ORDER;
  const [reveal, setReveal] = useState(false);

  const staked: Record<string, number> = {};
  for (const b of placedBets ?? []) {
    for (const id of betCellIds(b, variant)) staked[id] = (staked[id] ?? 0) + (b.amount ?? 0);
  }
  const win = (id: string): boolean => id === reveal_id(pocket) || outsideWins(id, pocket);
  // number-cell wins are a direct pocket match; outside/column/dozen reuse the engine's own predicate
  function reveal_id(p: Pocket) { return `n-${p}`; }
  function outsideWins(id: string, p: Pocket): boolean {
    if (id.startsWith('n-')) return false;
    const m = id.match(/^col-(\d)$/); if (m) return rouletteWins({ type: 'column', amount: 0, selector: Number(m[1]) as 1 | 2 | 3 }, p);
    const d = id.match(/^dozen-(\d)$/); if (d) return rouletteWins({ type: 'dozen', amount: 0, selector: Number(d[1]) as 1 | 2 | 3 }, p);
    const o = id.match(/^outside-(.+)$/); if (o) return rouletteWins({ type: o[1] as RouletteBetType, amount: 0 }, p);
    return false;
  }
  const st = (id: string): CellState => ({ staked: staked[id] ?? 0, win: win(id) });

  const NumberCell = ({ n }: { n: Pocket }) => (
    <Cell state={st(`n-${n}`)} reveal={reveal} className="flex-1" title={`Straight ${n} — 35:1`} bg={pocketHex(n)}>
      <span className="font-display text-sm sm:text-base font-bold text-white">{String(n)}</span>
    </Cell>
  );

  const rows: Array<1 | 2 | 3> = [3, 2, 1]; // top->bottom visual rows, by column-selector

  return (
    <div className="w-full overflow-x-auto">
      <div className="mx-auto flex flex-col gap-3" style={{ minWidth: 760 }}>
        {/* wheel + winning number + history */}
        <div className="flex items-center justify-center gap-6 pb-1">
          <Wheel order={order} pocket={pocket} roundKey={roundKey} onSettled={() => setReveal(true)} />
          <div className="flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-xl flex items-center justify-center text-3xl font-bold text-white shadow-xl"
              style={{ background: pocketHex(pocket) }}>
              {String(pocket)}
            </div>
            <p className="text-xs text-white/60">{pocketName(pocket)}</p>
            <HistoryRack history={history} />
          </div>
        </div>

        {/* felt */}
        <div className="rounded-lg overflow-hidden border-2 border-gold-500/60 select-none shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
          style={{ background: 'linear-gradient(180deg,#1a7f56,#0f5c3d)' }}>
          <div className="flex" style={{ height: ROW_H * 3 }}>
            <div className="flex" style={{ width: 60 }}>
              {variant === 'american' ? (
                <>
                  <Cell state={st('n-0')} reveal={reveal} className="flex-1" title="Straight 0 — 35:1" bg={pocketHex(0)}><span className="text-white font-bold">0</span></Cell>
                  <Cell state={st('n-00')} reveal={reveal} className="flex-1" title="Straight 00 — 35:1" bg={pocketHex('00')}><span className="text-white font-bold">00</span></Cell>
                </>
              ) : (
                <Cell state={st('n-0')} reveal={reveal} className="flex-1" title="Straight 0 — 35:1" bg={pocketHex(0)}><span className="text-white font-bold">0</span></Cell>
              )}
            </div>
            <div className="flex-1 flex flex-col">
              {rows.map((sel) => (
                <div key={sel} className="flex flex-1">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((k) => <NumberCell key={k} n={3 * (k - 1) + sel} />)}
                </div>
              ))}
            </div>
            <div className="flex flex-col" style={{ width: 60 }}>
              {rows.map((sel) => (
                <Cell key={sel} state={st(`col-${sel}`)} reveal={reveal} className="flex-1" title={`Column ${sel} — 2:1`}>
                  <span className="text-[10px] text-gold-200">2:1</span>
                </Cell>
              ))}
            </div>
          </div>
          <div className="flex border-t-2 border-gold-500/60">
            <div style={{ width: 60 }} />
            {[1, 2, 3].map((d) => (
              <Cell key={d} state={st(`dozen-${d}`)} reveal={reveal} className="flex-[4] py-1.5" title={`Dozen ${d} — 2:1`}>
                <span className="text-xs text-white">{d === 1 ? '1st 12' : d === 2 ? '2nd 12' : '3rd 12'}</span>
              </Cell>
            ))}
            <div style={{ width: 60 }} />
          </div>
          <div className="flex border-t-2 border-gold-500/60">
            <div style={{ width: 60 }} />
            <Cell state={st('outside-low')} reveal={reveal} className="flex-[2] py-1.5" title="1–18 — 1:1"><span className="text-xs text-white">1–18</span></Cell>
            <Cell state={st('outside-even')} reveal={reveal} className="flex-[2] py-1.5" title="Even — 1:1"><span className="text-xs text-white">EVEN</span></Cell>
            <Cell state={st('outside-red')} reveal={reveal} className="flex-[2] py-1.5" title="Red — 1:1"><span className="text-xs" style={{ color: '#e05a5a' }}>RED</span></Cell>
            <Cell state={st('outside-black')} reveal={reveal} className="flex-[2] py-1.5" title="Black — 1:1"><span className="text-xs text-white">BLACK</span></Cell>
            <Cell state={st('outside-odd')} reveal={reveal} className="flex-[2] py-1.5" title="Odd — 1:1"><span className="text-xs text-white">ODD</span></Cell>
            <Cell state={st('outside-high')} reveal={reveal} className="flex-[2] py-1.5" title="19–36 — 1:1"><span className="text-xs text-white">19–36</span></Cell>
            <div style={{ width: 60 }} />
          </div>
          <div className="text-center text-[8px] text-gold-200/70 bg-black/30 py-0.5">
            Table minimums — outside even-money (Red/Black/Odd/Even/1-18/19-36) 50 · everything else 10
          </div>
        </div>
      </div>
    </div>
  );
}
