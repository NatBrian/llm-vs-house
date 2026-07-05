import { motion } from 'framer-motion';

const SUIT: Record<string, { s: string; red: boolean }> = {
  C: { s: '♣', red: false }, D: { s: '♦', red: true }, H: { s: '♥', red: true }, S: { s: '♠', red: false },
};

export function PlayingCard({ label, hidden, delay = 0 }: { label?: string; hidden?: boolean; delay?: number }) {
  if (hidden || !label) {
    return (
      <motion.div
        initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ delay, duration: 0.3 }}
        className="w-12 h-16 rounded-md border border-gold-600/40"
        style={{ background: 'repeating-linear-gradient(45deg,#7a1420 0 6px,#5c0f18 6px 12px)' }}
      />
    );
  }
  const suit = label.slice(-1);
  const rank = label.slice(0, -1);
  const info = SUIT[suit] ?? { s: '?', red: false };
  return (
    <motion.div
      initial={{ y: -20, opacity: 0, rotateY: 90 }} animate={{ y: 0, opacity: 1, rotateY: 0 }} transition={{ delay, duration: 0.32 }}
      className="w-12 h-16 rounded-md card-face relative flex items-center justify-center"
    >
      <span className={`absolute top-1 left-1 text-xs font-bold leading-none ${info.red ? 'text-chip-red' : 'text-ink-950'}`}>{rank}</span>
      <span className={`text-2xl ${info.red ? 'text-chip-red' : 'text-ink-950'}`}>{info.s}</span>
      <span className={`absolute bottom-1 right-1 text-xs font-bold leading-none rotate-180 ${info.red ? 'text-chip-red' : 'text-ink-950'}`}>{rank}</span>
    </motion.div>
  );
}

const PIP: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
};

export function Die({ value, delay = 0 }: { value: number; delay?: number }) {
  const pips = PIP[value] ?? [];
  return (
    <motion.div
      initial={{ rotate: -25, scale: 0.6, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }}
      transition={{ delay, type: 'spring', stiffness: 240, damping: 14 }}
      className="w-12 h-12 rounded-lg bg-white grid grid-cols-3 grid-rows-3 gap-0.5 p-1.5 shadow-lg"
    >
      {Array.from({ length: 9 }).map((_, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        const on = pips.some(([c, r]) => c === col && r === row);
        return <span key={i} className={`rounded-full ${on ? 'bg-ink-950' : 'bg-transparent'}`} />;
      })}
    </motion.div>
  );
}

export function Chip({ amount, color = '#e0a92e', size = 40 }: { amount?: number | string; color?: string; size?: number }) {
  return (
    <div className="chip-pop relative flex items-center justify-center rounded-full shrink-0"
      style={{ width: size, height: size, background: color, boxShadow: '0 3px 8px rgba(0,0,0,0.5), inset 0 0 0 3px rgba(255,255,255,0.25)' }}>
      <span className="absolute inset-1 rounded-full border-2 border-dashed border-white/50" />
      {amount != null && <span className="text-[10px] font-bold text-white drop-shadow">{amount}</span>}
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'win' | 'loss' | 'neutral' | 'gold' }) {
  const cls = {
    win: 'bg-chip-green/20 text-chip-green border-chip-green/40',
    loss: 'bg-chip-red/20 text-chip-red border-chip-red/40',
    gold: 'bg-gold-500/20 text-gold-400 border-gold-500/40',
    neutral: 'bg-white/10 text-white/70 border-white/15',
  }[tone];
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${cls}`}>{children}</span>;
}
