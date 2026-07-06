import { Container, Graphics, Text } from 'pixi.js';
import { SYMBOL_STYLE, type SlotSymbolId } from './reelMath';

/** Per-symbol background tint applied over the dark base — gives each symbol a
 *  distinct color identity while keeping the dark casino aesthetic. */
const BG_TINT: Record<SlotSymbolId, number> = {
  WILD:    0x2a1f0a,
  SCATTER: 0x2a0a1a,
  DRAGON:  0x2a0a0a,
  TIGER:   0x2a1e08,
  LOTUS:   0x0a2218,
  ACE:     0x0f1a22,
  KING:    0x12181f,
  QUEEN:   0x14161e,
  TEN:     0x16161c,
};

/** Inner glow color that makes the symbol pop against the dark bg. */
const INNER_GLOW: Record<SlotSymbolId, number> = {
  WILD:    0xf5c451,
  SCATTER: 0xe04070,
  DRAGON:  0xd23b3b,
  TIGER:   0xe0a92e,
  LOTUS:   0x23a06b,
  ACE:     0x5b8dc9,
  KING:    0x8a9bb5,
  QUEEN:   0x8a7fa8,
  TEN:     0x6a7a8a,
};

/** Reel-stripe alternating band — a subtle pale highlight across even cells. Real
 *  reel strips use alternating white/colored bands behind the symbols. */
function stripeBase(g: Graphics, size: number, radius: number, symbolId: SlotSymbolId): void {
  g.roundRect(0, 0, size, size, radius)
    .fill({ color: BG_TINT[symbolId] });
  const stripeH = size / 3;
  for (let i = 0; i < 3; i += 2) {
    g.rect(0, i * stripeH, size, stripeH)
      .fill({ color: 0xffffff, alpha: 0.03 });
  }
}

export function makeSymbolTile(symbolId: SlotSymbolId, size: number): Container {
  const style = SYMBOL_STYLE[symbolId];
  const container = new Container();
  const radius = size * 0.14;

  const base = new Graphics();
  stripeBase(base, size, radius, symbolId);
  base.pivot.set(size / 2, size / 2);
  container.addChild(base);

  const innerGlow = new Graphics()
    .roundRect(3, 3, size - 6, size - 6, radius * 0.7)
    .fill({ color: INNER_GLOW[symbolId], alpha: 0.08 });
  innerGlow.pivot.set(size / 2, size / 2);
  container.addChild(innerGlow);

  const border = new Graphics()
    .roundRect(1, 1, size - 2, size - 2, radius)
    .stroke({ width: 2, color: style.accent, alpha: 0.85 });
  border.pivot.set(size / 2, size / 2);
  container.addChild(border);

  const glyph = new Text({
    text: style.glyph,
    style: {
      fontFamily: 'Bungee, system-ui, sans-serif',
      fontSize: style.glyph.length > 1 ? size * 0.34 : size * 0.5,
      fill: style.accent,
      align: 'center',
    },
  });
  glyph.anchor.set(0.5);
  container.addChild(glyph);

  if (symbolId === 'WILD' || symbolId === 'SCATTER') {
    const glow = new Graphics().roundRect(-3, -3, size + 6, size + 6, radius + 3).stroke({
      width: 1.5, color: style.accent, alpha: 0.35,
    });
    glow.pivot.set(size / 2, size / 2);
    container.addChildAt(glow, 0);
  }

  return container;
}
