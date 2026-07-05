export const fmt = (n: number): string =>
  (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });

export const signed = (n: number): string => (n > 0 ? `+${fmt(n)}` : fmt(n));

export const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;

export const GAME_META: Record<string, { name: string; icon: string; edge: string }> = {
  roulette: { name: 'Roulette', icon: '🎡', edge: 'EU 2.70%' },
  blackjack: { name: 'Blackjack', icon: '🃏', edge: '~0.5%' },
  baccarat: { name: 'Baccarat', icon: '🎴', edge: 'Banker 1.06%' },
  sicbo: { name: 'Sic Bo', icon: '🎲', edge: 'Small 2.78%' },
  slot: { name: 'Slot Machine', icon: '🎰', edge: 'RTP ~93%' },
};

// Deterministic color per session id (for chart series + list dots).
const PALETTE = ['#f5c451', '#2f6fed', '#23a06b', '#d23b3b', '#a05cf0', '#f0913c', '#3cc9d6', '#e85c9a'];
export function sessionColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}
