// 243-ways video slot board, mirrors the SicBoBoard/RouletteBoard/BaccaratBoard
// sibling convention (outcome + roundKey props, reset-on-new-round via useEffect).
// All DOM chrome (cabinet frame, bet-control HUD, win banners, free-spins HUD) lives
// here; the reel grid itself is the one Pixi canvas island (SlotReels).
//
// Bet-control HUD is a REPLAY visualization, not a live-interactive control: every
// board in this app visualizes an already-decided round (placedBets/dice/cards),
// never solicits a new one, there is no live-human-clicking mode anywhere in this
// app. Because the decision schema itself is `{denomination, betLevel, betMax}` (not
// a bare number), the HUD shows exactly which control the rule bot / naive bot / LLM
// actually pressed that round.

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from './primitives';
import { WinBanner } from './WinBanner';
import { SlotReels, CANVAS_WIDTH, CANVAS_HEIGHT, cellRect } from './slot/SlotReels';
import { anticipationFromReel, winTier, creditRollupDurationMs, type SlotSymbolId } from './slot/reelMath';
import { SYMBOL_STYLE } from './slot/reelMath';

const CABINET_WIDTH = CANVAS_WIDTH + 12 + 8 + 4; // reel-window + padding×2 + border×2 = 476

const SCATTER: SlotSymbolId = 'SCATTER';
const WILD: SlotSymbolId = 'WILD';
const SLOT_DENOMS = [1, 2, 5, 10, 25, 50];
const SLOT_MAX_LEVEL = 10;

interface SlotSpinLike {
  grid: string[][];
  waysWin: number;
  wins: Array<{ symbol: string; count: number; ways: number; payout: number }>;
  scatterCount: number;
  scatterPayout: number;
  freeSpinsAwarded: number;
}

interface SlotOutcome {
  mainSpin: SlotSpinLike;
  bonusSpins: SlotSpinLike[];
  totalPayout: number;
  amount: number;
  denomination: number;
  betLevel: number;
  betMax: boolean;
}

function winningCells(spin: SlotSpinLike): Set<string> {
  const set = new Set<string>();
  for (const win of spin.wins) {
    for (let reel = 0; reel < win.count; reel++) {
      for (let row = 0; row < (spin.grid[reel]?.length ?? 0); row++) {
        const sym = spin.grid[reel]![row];
        if (sym === win.symbol || sym === WILD) set.add(`${reel},${row}`);
      }
    }
  }
  return set;
}

function CreditRollup({ from, to }: { from: number; to: number }) {
  const [val, setVal] = useState(from);
  useEffect(() => {
    if (from === to) { setVal(to); return; }
    const duration = creditRollupDurationMs(Math.abs(to - from) / Math.max(1, from));
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setVal(Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to]);
  return <span>{val.toLocaleString()}</span>;
}

/** Read-only replay HUD: which denomination/bet-level/Bet-Max control the decider pressed. */
function BetControlHud({ denomination, betLevel, betMax, amount }: {
  denomination: number; betLevel: number; betMax: boolean; amount: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-ink-850/70 border border-white/10 px-3 py-2 text-xs">
      <div className="flex flex-col gap-1">
        <span className="text-[9px] uppercase tracking-wide text-white/40">Denomination</span>
        <div className="flex gap-1">
          {SLOT_DENOMS.map((d) => (
            <span key={d}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border ${
                d === denomination ? 'bg-gold-500 text-ink-950 border-gold-400' : 'bg-ink-800 text-white/40 border-white/10'
              }`}>
              {d}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1 flex-1">
        <span className="text-[9px] uppercase tracking-wide text-white/40">Bet level</span>
        <div className="flex gap-0.5">
          {Array.from({ length: SLOT_MAX_LEVEL }, (_, i) => i + 1).map((lvl) => (
            <span key={lvl} className={`flex-1 h-2 rounded-sm ${lvl <= betLevel ? 'bg-gold-400' : 'bg-white/10'}`} />
          ))}
        </div>
      </div>
      <div className={`px-2 py-1 rounded-md font-bold text-[10px] border ${
        betMax ? 'bg-chip-red text-white border-chip-red' : 'bg-ink-800 text-white/30 border-white/10'
      }`}>
        BET MAX
      </div>
      <div className="flex flex-col items-end">
        <span className="text-[9px] uppercase tracking-wide text-white/40">Total bet</span>
        <span className="font-display text-gold-400 text-sm">{amount}</span>
      </div>
    </div>
  );
}

export function SlotBoard({ outcome, roundKey, onSettled: onSettledProp }: { outcome: SlotOutcome; roundKey: number; onSettled?: () => void }) {
  const [spinIndex, setSpinIndex] = useState(-1); // -1 = main spin, 0..N-1 = bonus spin
  const [revealed, setRevealed] = useState(false);
  const [bonusStage, setBonusStage] = useState<'none' | 'transition' | 'playing' | 'summary'>('none');
  const [bonusWinTotal, setBonusWinTotal] = useState(0);
  const timers = useRef<number[]>([]);
  const onSettledPropRef = useRef(onSettledProp);
  onSettledPropRef.current = onSettledProp;
  const scaleRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [cabinetScale, setCabinetScale] = useState(1);
  const [contentH, setContentH] = useState(0);

  useEffect(() => {
    const el = scaleRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setCabinetScale(Math.min(1, entry.contentRect.width / CABINET_WIDTH));
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

  const clearTimers = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };
  const after = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); };

  useEffect(() => {
    clearTimers();
    setSpinIndex(-1);
    setRevealed(false);
    setBonusStage('none');
    setBonusWinTotal(0);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundKey]);

  const hasBonus = outcome.mainSpin.freeSpinsAwarded > 0 && outcome.bonusSpins.length > 0;
  const currentSpin: SlotSpinLike = spinIndex === -1 ? outcome.mainSpin : (outcome.bonusSpins[spinIndex] ?? outcome.mainSpin);
  const spinKey = `${roundKey}-${spinIndex}`;
  const anticipation = revealed ? null : anticipationFromReel(currentSpin.grid, SCATTER);

  const onSettled = () => {
    setRevealed(true);
    const spinTotal = currentSpin.waysWin + currentSpin.scatterPayout;

    if (spinIndex === -1 && hasBonus) {
      after(1100, () => {
        setBonusStage('transition');
        after(1400, () => {
          setBonusStage('playing');
          setRevealed(false);
          setSpinIndex(0);
        });
      });
      return;
    }

    if (bonusStage === 'playing') {
      setBonusWinTotal((prev) => prev + spinTotal);
      after(900, () => {
        if (spinIndex + 1 < outcome.bonusSpins.length) {
          setRevealed(false);
          setSpinIndex((i) => i + 1);
        } else {
          setBonusStage('summary');
          after(1200, () => onSettledPropRef.current?.());
        }
      });
      return;
    }

    // No bonus: show result, signal completion after hold
    after(1200, () => onSettledPropRef.current?.());
  };

  const cells = revealed ? winningCells(currentSpin) : new Set<string>();
  const spinMultiplier = currentSpin.waysWin + currentSpin.scatterPayout;
  const tier = revealed && bonusStage !== 'playing' ? winTier(spinIndex === -1 && !hasBonus ? outcome.totalPayout : spinMultiplier) : { tier: 'none' as const, durationMs: 0 };
  const netWin = outcome.totalPayout > 0 ? outcome.totalPayout * outcome.amount - outcome.amount : -outcome.amount;

  return (
    <div className="w-full flex flex-col items-center gap-3">
      {/* responsive wrapper, scales cabinet to fit viewport */}
      <div ref={scaleRef} className="w-full flex justify-center">
        <div ref={contentRef} style={{ transform: `scale(${cabinetScale})`, transformOrigin: 'top center', marginBottom: contentH * (cabinetScale - 1) }}>
          {/* cabinet frame, chrome-wrapped slot machine cabinet */}
          <div className="relative rounded-2xl shadow-[0_10px_50px_rgba(0,0,0,0.6)] overflow-hidden"
            style={{
              background: 'linear-gradient(180deg,#2a1f10 0%,#1a1410 3%,#0a0e12 40%,#0a0e12 60%,#1a1410 97%,#2a1f10 100%)',
              border: '2px solid rgba(218,180,90,0.25)',
              padding: 4,
            }}>
            {/* inner gold shadow border */}
            <div className="rounded-xl overflow-hidden"
              style={{ boxShadow: 'inset 0 0 20px rgba(218,180,90,0.08), 0 0 8px rgba(218,180,90,0.06)' }}>
              {/* reel window area */}
              <div className="relative rounded-lg overflow-hidden border-2"
                style={{
                  width: CANVAS_WIDTH + 12,
                  height: CANVAS_HEIGHT + 12,
                  borderColor: 'rgba(218,180,90,0.35)',
                  boxShadow: 'inset 0 0 15px rgba(0,0,0,0.5), 0 0 2px rgba(218,180,90,0.2)',
                  background: 'transparent',
                  margin: -6,
                }}
              >
                {/* corner bolts */}
                {[[6, 6], [CANVAS_WIDTH + 6, 6], [6, CANVAS_HEIGHT + 6], [CANVAS_WIDTH + 6, CANVAS_HEIGHT + 6]].map(([left, top], i) => (
                  <span key={i}
                    className="absolute w-2.5 h-2.5 rounded-full pointer-events-none z-10"
                    style={{ left, top, background: 'radial-gradient(circle,#5a4a30 0%,#2a1f10 70%)', border: '1px solid rgba(218,180,90,0.2)' }}
                  />
                ))}
                {/* reel glass overlay, subtle reflection gradient */}
                <span className="absolute inset-0 pointer-events-none z-10 rounded-sm"
                  style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 20%, transparent 80%, rgba(255,255,255,0.015) 100%)',
                  }}
                />
                <SlotReels grid={currentSpin.grid} spinKey={spinKey} anticipationFromReel={anticipation} onSettled={onSettled} />
              {/* winning-cell highlight overlay (DOM, positioned at known grid coordinates) */}
              {[...cells].map((key) => {
                const [reel, row] = key.split(',').map(Number);
                const r = cellRect(reel!, row!);
                return (
                  <motion.span key={key}
                    className="absolute pointer-events-none rounded-md"
                    style={{
                      left: r.x, top: r.y, width: r.w, height: r.h,
                      boxShadow: 'inset 0 0 0 2px var(--color-gold-400), 0 0 18px 2px rgba(245,196,81,0.7)',
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.1, repeat: Infinity }}
                  />
                );
              })}
            </div>

            {/* free-spins HUD */}
            <AnimatePresence>
              {(bonusStage === 'playing' || bonusStage === 'summary') && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-ink-950 border border-gold-500/60 px-3 py-1 text-[10px] flex items-center gap-2">
                  <span className="text-gold-300 font-semibold">FREE SPINS {Math.min(spinIndex + 1, outcome.bonusSpins.length)}/{outcome.bonusSpins.length}</span>
                  <span className="text-white/60">Bonus win <CreditRollup from={0} to={bonusWinTotal} /></span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      </div>

    {/* transition / summary banners */}
      <AnimatePresence>
        {bonusStage === 'transition' && (
          <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="font-display text-gold-400 text-2xl tracking-widest">
            FREE SPINS AWARDED, {outcome.mainSpin.freeSpinsAwarded}!
          </motion.div>
        )}
        {bonusStage === 'summary' && (
          <motion.div key="summary" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center rounded-xl border-2 border-gold-500/70 px-5 py-2"
            style={{ background: 'linear-gradient(180deg,rgba(245,196,81,0.2),rgba(0,0,0,0.35))' }}>
            <span className="text-gold-300 text-xs tracking-widest">TOTAL BONUS WIN</span>
            <span className="font-display text-gold-400 text-2xl"><CreditRollup from={0} to={bonusWinTotal} /></span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* main win presentation (no bonus, or after bonus completes) */}
      {bonusStage !== 'playing' && bonusStage !== 'transition' && (
        <div className="flex flex-col items-center gap-1.5">
          <WinBanner tier={tier.tier} multiplier={outcome.totalPayout} amountWon={Math.max(0, netWin)} roundKey={roundKey} />
          {revealed && outcome.mainSpin.wins.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1">
              {outcome.mainSpin.wins.map((w, i) => (
                <Badge key={i} tone="win">{SYMBOL_STYLE[w.symbol as SlotSymbolId]?.glyph ?? w.symbol} ×{w.count}, pays {w.payout.toFixed(1)}×</Badge>
              ))}
            </div>
          )}
          {revealed && tier.tier === 'none' && outcome.totalPayout === 0 && <Badge tone="neutral">No win</Badge>}
        </div>
      )}

      <BetControlHud denomination={outcome.denomination} betLevel={outcome.betLevel} betMax={outcome.betMax} amount={outcome.amount} />
    </div>
  );
}
