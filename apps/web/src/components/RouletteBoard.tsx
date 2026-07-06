// Authentic Roulette table — MBS (single-zero) or RWS (double-zero, adds the
// Top Line, dedicated 0/00 Combo box, and wheel-sector Series bets), English/
// American felt layout (no racetrack — matches the Singapore casino convention
// documented in docs/PAYOUTS.md: no la partage/en prison, no French call bets).
// Two parts:
//   1. Wheel + ball: a real angular-friction simulation on <canvas>, not
//      keyframe tweens — the wheel decelerates to a resting orientation, the
//      ball spins the opposite way on the outer rim, decelerates faster (it
//      "loses the race"), drops onto the pocket ring, wobbles as if bouncing
//      off the frets, and settles exactly on the winning pocket. The physics
//      is cosmetic (the RNG result is fixed before the animation starts) but
//      the deceleration curves and rim->pocket radius drop are real motion,
//      not a canned CSS spin.
//   2. Felt: 0 (/00) + the 3x12 number grid + column/dozen boxes + the outside
//      row + (RWS-only) the Series/0-00-Combo strips, chips placed on every
//      cell a bet actually covers, winning cells glow once the ball settles.
//      Win predicates reuse @casino/engine directly (rouletteWins) rather
//      than re-deriving them in the UI.
import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { RED_NUMBERS, rouletteWins, SERIES3_GROUPS, SERIES6_GROUPS, type RouletteBetType } from '@casino/engine';
import { Chip } from './primitives';

type Pocket = number | '00';

const EUROPEAN_ORDER: Pocket[] = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const AMERICAN_ORDER: Pocket[] = [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, '00', 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2];

const pocketHex = (p: Pocket) => (p === 0 || p === '00' ? '#1a7f56' : RED_NUMBERS.has(p as number) ? '#b3283a' : '#141a20');
const pocketName = (p: Pocket) => (p === 0 || p === '00' ? 'Green' : RED_NUMBERS.has(p as number) ? 'Red' : 'Black');

/** Cubic ease-out: reads as "fast then decelerating", reaching `total` exactly at t=1. */
const decel = (total: number, t: number) => total * (1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3));

/**
 * Canvas-rendered wheel + ball physics. The wheel spins forward to an
 * arbitrary resting orientation (`wheelTotal`); the ball spins the opposite
 * way for several more revolutions than the wheel, decelerating on its own
 * (faster) curve, and its landing angle is solved so it lands exactly on the
 * winning pocket wherever the wheel itself ends up — ballFinal = wheelFinal +
 * pocketLocalAngle(winIndex). A short bounce wobble decaying to zero and a
 * rim->pocket radius drop in the last third of the spin sell the "ball loses
 * momentum and drops into the pocket" moment.
 */
function Wheel({ order, pocket, roundKey, onSettled }: { order: Pocket[]; pocket: Pocket; roundKey: number; onSettled: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const n = order.length;
  const size = 224; // 14rem, matches the w-56 h-56 box below

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const winIndex = Math.max(0, order.indexOf(pocket));
    const cx = size / 2, cy = size / 2;
    const outerR = size / 2 - 4;
    const numberR = outerR * 0.82;
    const hubR = outerR * 0.4;
    const ballOuterR = outerR * 0.92;
    const ballPocketR = outerR * 0.72;

    // -90 so index 0 sits at the top for both the wheel drawing and the ball math.
    const sliceAngle = (i: number) => (i / n) * 360 - 90;

    const WHEEL_REVS = 5, BALL_REVS = 9;
    const wheelTotal = WHEEL_REVS * 360 + ((roundKey * 53) % 360); // arbitrary resting orientation
    const pocketLocal = sliceAngle(winIndex);
    const ballFinal = wheelTotal + pocketLocal; // where the ball must be at t=1
    const ballTotal = ballFinal - BALL_REVS * 360; // large negative sweep, same mod-360 landing

    const WHEEL_MS = 4200, BALL_MS = 4600;
    const start = performance.now();
    let raf = 0;
    let settled = false;

    function draw(now: number) {
      const tWheel = Math.min(1, (now - start) / WHEEL_MS);
      const tBall = Math.min(1, (now - start) / BALL_MS);
      const wheelAngle = decel(wheelTotal, tWheel);
      let ballAngle = decel(ballTotal, tBall);

      // Decaying bounce wobble in the last third — bouncing off the deflector pins.
      if (tBall > 0.62 && tBall < 1) {
        const local = (tBall - 0.62) / 0.38;
        ballAngle += 14 * Math.pow(1 - local, 2) * Math.sin(local * 26);
      }
      // Rim -> pocket radius drop as the ball loses speed.
      const radiusT = Math.min(1, Math.max(0, (tBall - 0.55) / 0.35));
      const ballRadius = ballOuterR - (ballOuterR - ballPocketR) * (radiusT * radiusT);

      ctx.clearRect(0, 0, size, size);

      // static outer bowl rim
      ctx.beginPath();
      ctx.arc(cx, cy, outerR + 3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(185,134,29,0.55)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // rotating pocket ring
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((wheelAngle * Math.PI) / 180);
      for (let i = 0; i < n; i++) {
        const a0 = ((sliceAngle(i)) * Math.PI) / 180;
        const a1 = ((sliceAngle(i + 1)) * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, outerR, a0, a1);
        ctx.closePath();
        ctx.fillStyle = pocketHex(order[i]!);
        ctx.fill();
        ctx.strokeStyle = 'rgba(212,175,55,0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();

        const mid = (a0 + a1) / 2;
        ctx.save();
        ctx.rotate(mid);
        ctx.translate(numberR, 0);
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(order[i]), 0, 0);
        ctx.restore();
      }
      ctx.restore();

      // center hub
      ctx.beginPath();
      ctx.arc(cx, cy, hubR, 0, Math.PI * 2);
      ctx.fillStyle = '#0d1015';
      ctx.fill();
      ctx.strokeStyle = 'rgba(212,175,55,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#e0a92e';
      ctx.font = '16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♦', cx, cy);

      // ball
      const ballRad = ((ballAngle - 90) * Math.PI) / 180;
      const bx = cx + ballRadius * Math.cos(ballRad);
      const by = cy + ballRadius * Math.sin(ballRad);
      ctx.beginPath();
      ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(255,255,255,0.9)';
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;

      if (tWheel < 1 || tBall < 1) {
        raf = requestAnimationFrame(draw);
      } else if (!settled) {
        settled = true;
        onSettled();
      }
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundKey, pocket, n]);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <canvas ref={canvasRef} style={{ width: size, height: size }} />
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

/** Real casino "trend" reading: hot/cold numbers and the current colour streak. */
function TrendPanel({ history }: { history: Pocket[] }) {
  if (history.length < 3) return null;
  const window = history.slice(0, 50);
  const freq = new Map<string, number>();
  for (const p of window) freq.set(String(p), (freq.get(String(p)) ?? 0) + 1);
  const byFreq = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  const hot = byFreq.slice(0, 3);
  const cold = byFreq.slice(-3).reverse();

  let streak = 1;
  const firstColor = pocketName(window[0]!);
  for (let i = 1; i < window.length; i++) {
    if (pocketName(window[i]!) === firstColor && firstColor !== 'Green') streak++;
    else break;
  }

  return (
    <div className="flex flex-col items-center gap-1 text-[10px] text-white/70">
      <div className="flex items-center gap-3">
        <span>🔥 Hot: {hot.map(([p]) => p).join(', ')}</span>
        <span>❄️ Cold: {cold.map(([p]) => p).join(', ')}</span>
      </div>
      {streak >= 2 && firstColor !== 'Green' && (
        <span className="text-gold-300">{streak}x {firstColor} streak</span>
      )}
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
          <Chip amount={state.staked} size={20} color={lit ? '#2f6fed' : '#d23b3b'} />
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
    case 'zeroCombo':
      return ['zerocombo'];
    case 'column': return [`col-${bet.selector ?? 1}`];
    case 'dozen': return [`dozen-${bet.selector ?? 1}`];
    case 'series3': return [`series3-${bet.seriesGroup ?? 1}`];
    case 'series6': return [`series6-${bet.seriesGroup ?? 1}`];
    default: return [`outside-${bet.type}`]; // red/black/odd/even/high/low
  }
}

const ROW_H = 52;

export function RouletteBoard({ pocket, placedBets, variant, history, roundKey }: {
  pocket: Pocket; placedBets: any[]; variant: 'european' | 'american'; history: Pocket[]; roundKey: number;
}) {
  const order = variant === 'american' ? AMERICAN_ORDER : EUROPEAN_ORDER;
  const [reveal, setReveal] = useState(false);
  const scaleRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = scaleRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / 760));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const staked: Record<string, number> = {};
  for (const b of placedBets ?? []) {
    for (const id of betCellIds(b, variant)) staked[id] = (staked[id] ?? 0) + (b.amount ?? 0);
  }
  const win = (id: string): boolean => id === reveal_id(pocket) || outsideWins(id, pocket);
  // number-cell wins are a direct pocket match; outside/column/dozen/series reuse the engine's own predicate
  function reveal_id(p: Pocket) { return `n-${p}`; }
  function outsideWins(id: string, p: Pocket): boolean {
    if (id.startsWith('n-')) return false;
    if (id === 'zerocombo') return rouletteWins({ type: 'zeroCombo', amount: 0 }, p);
    const m = id.match(/^col-(\d)$/); if (m) return rouletteWins({ type: 'column', amount: 0, selector: Number(m[1]) as 1 | 2 | 3 }, p);
    const d = id.match(/^dozen-(\d)$/); if (d) return rouletteWins({ type: 'dozen', amount: 0, selector: Number(d[1]) as 1 | 2 | 3 }, p);
    const s3 = id.match(/^series3-(\d+)$/); if (s3) return rouletteWins({ type: 'series3', amount: 0, seriesGroup: Number(s3[1]) }, p);
    const s6 = id.match(/^series6-(\d+)$/); if (s6) return rouletteWins({ type: 'series6', amount: 0, seriesGroup: Number(s6[1]) }, p);
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
  const american = variant === 'american';

  return (
    <div ref={scaleRef} className="w-full flex justify-center">
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
      <div className="mx-auto flex flex-col gap-3" style={{ minWidth: 760 }}>
        {/* wheel + winning number + history/trend */}
        <div className="flex items-center justify-center gap-6 pb-1">
          <Wheel order={order} pocket={pocket} roundKey={roundKey} onSettled={() => setReveal(true)} />
          <div className="flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-xl flex items-center justify-center text-3xl font-bold text-white shadow-xl"
              style={{ background: pocketHex(pocket) }}>
              {String(pocket)}
            </div>
            <p className="text-xs text-white/60">{pocketName(pocket)}</p>
            <HistoryRack history={history} />
            <TrendPanel history={history} />
          </div>
        </div>

        {/* felt */}
        <div className="rounded-lg overflow-hidden border-2 border-gold-500/60 select-none shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
          style={{ background: 'linear-gradient(180deg,#1a7f56,#0f5c3d)' }}>
          <div className="flex" style={{ height: ROW_H * 3 }}>
            <div className="flex" style={{ width: american ? 90 : 60 }}>
              {american ? (
                <>
                  <Cell state={st('n-0')} reveal={reveal} className="flex-1" title="Straight 0 — 35:1" bg={pocketHex(0)}><span className="text-white font-bold">0</span></Cell>
                  <Cell state={st('n-00')} reveal={reveal} className="flex-1" title="Straight 00 — 35:1" bg={pocketHex('00')}><span className="text-white font-bold">00</span></Cell>
                  <Cell state={st('zerocombo')} reveal={reveal} className="flex-1" title="0/00 Combo — 11:1 (36.84% edge)" bg="#0f5c3d">
                    <span className="text-[9px] text-gold-200 text-center leading-tight">0<br />00</span>
                  </Cell>
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
            <div style={{ width: american ? 90 : 60 }} />
            {[1, 2, 3].map((d) => (
              <Cell key={d} state={st(`dozen-${d}`)} reveal={reveal} className="flex-[4] py-1.5" title={`Dozen ${d} — 2:1`}>
                <span className="text-xs text-white">{d === 1 ? '1st 12' : d === 2 ? '2nd 12' : '3rd 12'}</span>
              </Cell>
            ))}
            <div style={{ width: 60 }} />
          </div>
          {american && (
            <div className="flex border-t-2 border-gold-500/60">
              <div style={{ width: 90 }} />
              {SERIES3_GROUPS.map((_, i) => (
                <Cell key={i} state={st(`series3-${i + 1}`)} reveal={reveal} className="flex-1 py-1" title={`3 Numbers Series ${i + 1} — 11:1`}>
                  <span className="text-[8px] text-gold-200">{SERIES3_GROUPS[i]!.join('·')}</span>
                </Cell>
              ))}
              <div style={{ width: 60 }} />
            </div>
          )}
          <div className="flex border-t-2 border-gold-500/60">
            <div style={{ width: american ? 90 : 60 }} />
            <Cell state={st('outside-low')} reveal={reveal} className="flex-[2] py-1.5" title="1–18 — 1:1"><span className="text-xs text-white">1–18</span></Cell>
            <Cell state={st('outside-even')} reveal={reveal} className="flex-[2] py-1.5" title="Even — 1:1"><span className="text-xs text-white">EVEN</span></Cell>
            <Cell state={st('outside-red')} reveal={reveal} className="flex-[2] py-1.5" title="Red — 1:1"><span className="text-xs" style={{ color: '#e05a5a' }}>RED</span></Cell>
            <Cell state={st('outside-black')} reveal={reveal} className="flex-[2] py-1.5" title="Black — 1:1"><span className="text-xs text-white">BLACK</span></Cell>
            <Cell state={st('outside-odd')} reveal={reveal} className="flex-[2] py-1.5" title="Odd — 1:1"><span className="text-xs text-white">ODD</span></Cell>
            <Cell state={st('outside-high')} reveal={reveal} className="flex-[2] py-1.5" title="19–36 — 1:1"><span className="text-xs text-white">19–36</span></Cell>
            <div style={{ width: 60 }} />
          </div>
          {american && (
            <div className="flex border-t-2 border-gold-500/60">
              <div style={{ width: 90 }} />
              {SERIES6_GROUPS.map((_, i) => (
                <Cell key={i} state={st(`series6-${i + 1}`)} reveal={reveal} className="flex-1 py-1" title={`6 Numbers Series ${i + 1} — 5:1`}>
                  <span className="text-[7px] text-gold-200">{SERIES6_GROUPS[i]!.join('·')}</span>
                </Cell>
              ))}
              <div style={{ width: 60 }} />
            </div>
          )}
          <div className="text-center text-[8px] text-gold-200/70 bg-black/30 py-0.5">
            Table minimums — outside even-money (Red/Black/Odd/Even/1-18/19-36) 50 · everything else 10
            {american && ' · Top Line/0-00 Combo carry a much worse edge (21.05%/36.84%) — real bets, bad deal'}
          </div>
        </div>
      </div>
        </div>
    </div>
  );
}
