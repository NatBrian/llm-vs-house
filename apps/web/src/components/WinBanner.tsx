import { AnimatePresence, motion } from 'framer-motion';
import type { WinTier } from './slot/reelMath';

const TIER_COPY: Record<Exclude<WinTier, 'none'>, { label: string; scale: number; particles: number }> = {
  nice: { label: 'NICE WIN', scale: 1, particles: 0 },
  big: { label: 'BIG WIN', scale: 1.12, particles: 12 },
  mega: { label: 'MEGA WIN', scale: 1.28, particles: 30 },
  jackpot: { label: 'JACKPOT!', scale: 1.5, particles: 60 },
};

function Particles({ count, seed }: { count: number; seed: number }) {
  let a = (seed || 1) >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      {Array.from({ length: count }).map((_, i) => {
        const angle = rnd() * Math.PI * 2;
        const dist = 60 + rnd() * 140;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist - 30;
        const size = 4 + rnd() * 5;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{ width: size, height: size, background: rnd() > 0.5 ? '#f5c451' : '#e0a92e' }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
            animate={{ x: dx, y: dy, opacity: 0, scale: 1 }}
            transition={{ duration: 0.9 + rnd() * 0.5, ease: 'easeOut' }}
          />
        );
      })}
    </div>
  );
}

export function WinBanner({ tier, multiplier, amountWon, roundKey }: {
  tier: WinTier; multiplier: number; amountWon: number; roundKey: number | string;
}) {
  return (
    <AnimatePresence mode="wait">
      {tier !== 'none' && (
        <motion.div
          key={`${roundKey}-${tier}`}
          initial={{ opacity: 0, scale: 0.5, y: 10 }}
          animate={{ opacity: 1, scale: TIER_COPY[tier].scale, y: 0 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16 }}
          className="relative flex flex-col items-center rounded-2xl border-2 border-gold-500/70 px-6 py-3"
          style={{ background: 'linear-gradient(180deg,rgba(245,196,81,0.20),rgba(0,0,0,0.35))' }}
        >
          {TIER_COPY[tier].particles > 0 && <Particles count={TIER_COPY[tier].particles} seed={Number(roundKey) || 1} />}
          <span className="font-display text-gold-300 tracking-widest text-sm">{TIER_COPY[tier].label}</span>
          <span className="font-display text-gold-400 text-3xl leading-tight">{multiplier.toFixed(1)}×</span>
          <span className="text-xs text-white/70">+{Math.round(amountWon)} pts</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
