import { Container, Graphics, Text } from 'pixi.js';
import type { SlotSymbolId } from './reelMath';

interface TileTheme {
  bg: number;
  accent: number;
  bgAlpha: number;
  emoji: string;
  label?: string;
}

const THEME: Record<SlotSymbolId, TileTheme> = {
  WILD:    { bg: 0x3a2a0a, accent: 0xf5c451, bgAlpha: 0.6, emoji: '⭐', label: 'W' },
  SCATTER: { bg: 0x3a0a20, accent: 0xe04070, bgAlpha: 0.6, emoji: '💎', label: 'S' },
  DRAGON:  { bg: 0x3a0808, accent: 0xef4444, bgAlpha: 0.55, emoji: '🐉', label: 'D' },
  TIGER:   { bg: 0x3a2004, accent: 0xf59e0b, bgAlpha: 0.55, emoji: '🐯', label: 'T' },
  LOTUS:   { bg: 0x043018, accent: 0x22c55e, bgAlpha: 0.55, emoji: '🌸' },
  ACE:     { bg: 0x081e3a, accent: 0x60a5fa, bgAlpha: 0.55, emoji: '🅰️', label: 'A' },
  KING:    { bg: 0x1a1a24, accent: 0x9ca3af, bgAlpha: 0.55, emoji: '👑', label: 'K' },
  QUEEN:   { bg: 0x280e30, accent: 0xc084fc, bgAlpha: 0.55, emoji: '👸', label: 'Q' },
  TEN:     { bg: 0x1a1a22, accent: 0x94a3b8, bgAlpha: 0.55, emoji: '🔟', label: '10' },
};

export function makeSymbolTile(symbolId: SlotSymbolId, size: number): Container {
  const t = THEME[symbolId];
  const container = new Container();
  const radius = size * 0.14;

  // bg fills the whole (0,0)–(size,size) box — no pivot shifts
  const bg = new Graphics()
    .roundRect(0, 0, size, size, radius)
    .fill({ color: t.bg, alpha: t.bgAlpha });
  container.addChild(bg);

  // accent border
  const border = new Graphics()
    .roundRect(1.5, 1.5, size - 3, size - 3, radius)
    .stroke({ width: 2.5, color: t.accent, alpha: 0.7 });
  container.addChild(border);

  // emoji – centred in the tile
  // real emoji ignore `fill` and render in their native colours
  const emoji = new Text({
    text: t.emoji,
    style: {
      fontFamily: 'system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif',
      fontSize: size * 0.52,
      fill: t.accent,
      align: 'center',
    },
  });
  emoji.anchor.set(0.5);
  emoji.x = size / 2;
  emoji.y = size / 2 - (t.label ? size * 0.06 : 0);
  container.addChild(emoji);

  // label letter – bottom-right corner
  if (t.label) {
    const label = new Text({
      text: t.label,
      style: {
        fontFamily: 'Bungee, system-ui, sans-serif',
        fontSize: size * 0.28,
        fill: t.accent,
        align: 'center',
      },
    });
    label.anchor.set(0.5);
    label.x = size * 0.75;
    label.y = size * 0.78;
    label.alpha = 0.5;
    container.addChild(label);
  }

  return container;
}
