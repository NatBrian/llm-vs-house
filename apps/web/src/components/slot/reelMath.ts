// Pure, Pixi/DOM-free helpers for the slot reel animation — kept separate from
// rendering so the spin/anticipation/win-tier logic is plain, testable data math,
// matching this repo's engine/core convention of separating logic from rendering.

export const SLOT_SYMBOLS = ['WILD', 'SCATTER', 'DRAGON', 'TIGER', 'LOTUS', 'ACE', 'KING', 'QUEEN', 'TEN'] as const;
export type SlotSymbolId = (typeof SLOT_SYMBOLS)[number];

/** Vector glyph + accent color per symbol, drawn by slot/symbolTile.ts — interim art
 *  until a real taxonomy-matched CC0 sprite pack is vendored (see docs/ASSETS.md). */
export const SYMBOL_STYLE: Record<SlotSymbolId, { glyph: string; accent: number }> = {
  WILD: { glyph: 'W', accent: 0xf5c451 },
  SCATTER: { glyph: '$', accent: 0xf5c451 },
  DRAGON: { glyph: '龍', accent: 0xd23b3b },
  TIGER: { glyph: '虎', accent: 0xe0a92e },
  LOTUS: { glyph: '❀', accent: 0x23a06b },
  ACE: { glyph: 'A', accent: 0xe7edf3 },
  KING: { glyph: 'K', accent: 0xe7edf3 },
  QUEEN: { glyph: 'Q', accent: 0xe7edf3 },
  TEN: { glyph: '10', accent: 0xe7edf3 },
};

// ---------------------------------------------------------------- strip layout for downward spin
/** Filler symbols laid out BEFORE the final window (visible during spin, before landing). */
export const FILLER_BEFORE = 60;
/** Filler symbols laid out AFTER the final window (extra room for downward scroll entry). */
export const FILLER_AFTER = 40;
/** Convenience sum. */
export const TOTAL_FILLER = FILLER_BEFORE + FILLER_AFTER;

export function buildSlotStrip(finalWindow: string[], seed: number): string[] {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const fillerCount = FILLER_BEFORE + FILLER_AFTER;
  const allFillers = Array.from({ length: fillerCount }, () => SLOT_SYMBOLS[Math.floor(rnd() * SLOT_SYMBOLS.length)]!);
  return [...allFillers.slice(0, FILLER_BEFORE), ...finalWindow, ...allFillers.slice(FILLER_BEFORE)];
}

// ---------------------------------------------------------------- timing
export const REEL_TIMING = {
  rampMs: 180,
  stopBaseMs: 650,
  stopStaggerMs: 350,
  landingMs: 380,
  settleMs: 140,
  anticipationExtraMs: 900,
  cruiseBlur: 16,
  anticipationBlur: 20,
};

/** Total wall-clock a round's reel animation takes, given whether any reel gets an
 *  anticipation hold — used by the board to time when to reveal the win presentation. */
export function totalSpinDurationMs(reelCount: number, anticipationFromReel: number | null): number {
  const lastStop = REEL_TIMING.stopBaseMs + (reelCount - 1) * REEL_TIMING.stopStaggerMs;
  const extra = anticipationFromReel !== null ? REEL_TIMING.anticipationExtraMs : 0;
  return lastStop + extra + REEL_TIMING.landingMs + REEL_TIMING.settleMs;
}

export function reelStopDelayMs(reelIndex: number, anticipationFromReel: number | null): number {
  const base = REEL_TIMING.stopBaseMs + reelIndex * REEL_TIMING.stopStaggerMs;
  return anticipationFromReel !== null && reelIndex >= anticipationFromReel
    ? base + REEL_TIMING.anticipationExtraMs
    : base;
}

/**
 * Which reel index (if any) should get the "anticipation hold" treatment — computed
 * from the ALREADY-DECIDED grid (this is a replay, never genuine suspense): walking
 * left-to-right, if the running scatter count reaches exactly 2 while reels remain,
 * every remaining reel is flagged as the anticipation zone (real cabinets hold on
 * every reel from the one that could complete the trigger onward, not just the last).
 */
export function anticipationFromReel(grid: string[][], scatterSymbol: string): number | null {
  let running = 0;
  for (let i = 0; i < grid.length; i++) {
    running += grid[i]!.filter((s) => s === scatterSymbol).length;
    if (running === 2 && i + 1 < grid.length) return i + 1;
  }
  return null;
}

/** Deterministic cosmetic filler for the pre-landing scroll — varies by round/reel so
 *  repeated rounds don't look identical mid-spin, but never affects the outcome (the
 *  strip always ends in `finalWindow`, in order — landing is exact, never random). */
export function buildFillerStrip(finalWindow: string[], seed: number, fillerCount = 24): string[] {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const filler = Array.from({ length: fillerCount }, () => SLOT_SYMBOLS[Math.floor(rnd() * SLOT_SYMBOLS.length)]!);
  return [...filler, ...finalWindow];
}

// ---------------------------------------------------------------- win tiers
export type WinTier = 'none' | 'nice' | 'big' | 'mega' | 'jackpot';

const TIER_THRESHOLDS: Array<{ tier: WinTier; min: number; durationMs: number }> = [
  { tier: 'jackpot', min: 100, durationMs: 2600 },
  { tier: 'mega', min: 40, durationMs: 1900 },
  { tier: 'big', min: 15, durationMs: 1400 },
  { tier: 'nice', min: 5, durationMs: 900 },
];

/** `multiplierOfBet` = totalPayout ("for-one"); a payout of 12 means the round paid
 *  12x the stake. Below 5x gets no banner — just the small win Badge already used
 *  elsewhere in this app. */
export function winTier(multiplierOfBet: number): { tier: WinTier; durationMs: number } {
  for (const t of TIER_THRESHOLDS) if (multiplierOfBet >= t.min) return { tier: t.tier, durationMs: t.durationMs };
  return { tier: 'none', durationMs: 0 };
}

export function creditRollupDurationMs(multiplierOfBet: number): number {
  return Math.max(500, Math.min(2400, 500 + Math.log2(multiplierOfBet + 1) * 180));
}
