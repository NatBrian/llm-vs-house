// Vector-drawn symbol tiles — interim art (see docs/ASSETS.md) until a real
// taxonomy-matched CC0 sprite pack is vendored. Isolated in this one factory module
// so swapping in real textures later is a single-seam change: replace the body of
// `makeSymbolTile` with a `Sprite` lookup against a loaded `Spritesheet`, keep the
// same (symbolId, size) => Container signature.

import { Container, Graphics, Text } from 'pixi.js';
import { SYMBOL_STYLE, type SlotSymbolId } from './reelMath';

const INK_800 = 0x1d2731;
const INK_950 = 0x0a0e12;

/** A single reel-cell tile: rounded ink-gold gradient-ish base + a glyph, matching
 *  the app's existing casino palette (index.css gold/ink color tokens). */
export function makeSymbolTile(symbolId: SlotSymbolId, size: number): Container {
  const style = SYMBOL_STYLE[symbolId];
  const container = new Container();

  const radius = size * 0.14;
  const base = new Graphics()
    .roundRect(0, 0, size, size, radius)
    .fill({ color: INK_950 });
  base.pivot.set(size / 2, size / 2);
  container.addChild(base);

  // Fake a top-lit gradient with a lighter, lower-alpha overlay on the upper half.
  const sheen = new Graphics()
    .roundRect(0, 0, size, size * 0.55, radius)
    .fill({ color: INK_800, alpha: 0.6 });
  sheen.pivot.set(size / 2, size / 2);
  container.addChild(sheen);

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

  // Wild/scatter get an extra glow ring — these are the symbols worth a player's eye.
  if (symbolId === 'WILD' || symbolId === 'SCATTER') {
    const glow = new Graphics().roundRect(-3, -3, size + 6, size + 6, radius + 3).stroke({
      width: 1.5, color: style.accent, alpha: 0.35,
    });
    glow.pivot.set(size / 2, size / 2);
    container.addChildAt(glow, 0);
  }

  return container;
}
