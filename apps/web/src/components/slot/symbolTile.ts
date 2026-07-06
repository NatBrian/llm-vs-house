import { Container, Graphics, Text } from 'pixi.js';
import { SYMBOL_STYLE, type SlotSymbolId } from './reelMath';

const BG: Record<SlotSymbolId, number> = {
  WILD:    0x2a1f0a,
  SCATTER: 0x2a0a1a,
  DRAGON:  0x1f0808,
  TIGER:   0x1f1506,
  LOTUS:   0x061a12,
  ACE:     0x0a1620,
  KING:    0x0e141e,
  QUEEN:   0x10121c,
  TEN:     0x11111a,
};

const ACCENT: Record<SlotSymbolId, number> = {
  WILD:    0xf5c451,
  SCATTER: 0xe04070,
  DRAGON:  0xd23b3b,
  TIGER:   0xe0a92e,
  LOTUS:   0x23a06b,
  ACE:     0x5b8dc9,
  KING:    0x8a9bb5,
  QUEEN:   0x9a8ab8,
  TEN:     0x6a7a8a,
};

// ── vector illustrators ─────────────────────────────────────────

function drawDragon(g: Graphics, h: number, cx: number, cy: number): void {
  const s = h * 0.38;
  g.moveTo(cx - s, cy + s * 0.6);
  g.bezierCurveTo(cx - s, cy + s * 0.1, cx, cy - s * 0.9, cx + s, cy - s * 0.3);
  g.stroke({ width: 2.5, color: 0xd23b3b, alpha: 0.55 });
  const rh = s * 0.22;
  g.circle(cx + s - rh, cy - s * 0.3 - rh * 0.5, rh);
  g.fill({ color: 0xd23b3b, alpha: 0.35 });
  g.circle(cx + s + rh * 0.4, cy - s * 0.3 - rh * 1.5, rh * 0.6);
  g.fill({ color: 0xd23b3b, alpha: 0.25 });
  for (let i = 0; i < 4; i++) {
    const t = 0.15 + i * 0.22;
    const px = cx - s + t * (2 * s);
    const py = cy - s * 0.7 + t * t * s * 1.6;
    g.circle(px, py, 2);
    g.fill({ color: 0xd23b3b, alpha: 0.35 });
  }
}

function drawTiger(g: Graphics, h: number, cx: number, cy: number): void {
  const r = h * 0.3;
  g.circle(cx, cy, r);
  g.fill({ color: 0xe0a92e, alpha: 0.08 });
  g.circle(cx - r * 0.65, cy - r * 0.5, r * 0.3);
  g.fill({ color: 0xe0a92e, alpha: 0.06 });
  g.circle(cx + r * 0.65, cy - r * 0.5, r * 0.3);
  g.fill({ color: 0xe0a92e, alpha: 0.06 });
  for (let i = -1; i <= 1; i += 1) {
    const x = cx + i * r * 0.35;
    g.moveTo(x - 1.5, cy - r * 0.6);
    g.lineTo(x + 1.5, cy - r * 1.1);
    g.stroke({ width: 2, color: 0xe0a92e, alpha: 0.2 });
    g.moveTo(x - 1.5, cy + r * 0.4);
    g.lineTo(x + 1.5, cy + r * 0.9);
    g.stroke({ width: 2, color: 0xe0a92e, alpha: 0.2 });
  }
}

function drawLotus(g: Graphics, h: number, cx: number, cy: number): void {
  const pw = h * 0.16;
  const ph = h * 0.34;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 3; i++) {
      const angle = (-0.35 + i * 0.12) * side;
      const px = cx + Math.sin(angle) * pw * 0.6;
      g.ellipse(px, cy - ph * 0.15 + Math.abs(i - 1) * ph * 0.08, pw, ph);
      g.fill({ color: 0x23a06b, alpha: 0.04 + 0.03 * (2 - i) });
    }
  }
  g.ellipse(cx, cy - ph * 0.2, pw * 0.4, ph * 0.35);
  g.fill({ color: 0x23a06b, alpha: 0.1 });
}

function drawGem(g: Graphics, h: number, cx: number, cy: number): void {
  const s = h * 0.32;
  const c = 0xe04070;
  g.moveTo(cx, cy - s);
  g.lineTo(cx + s * 0.7, cy - s * 0.3);
  g.lineTo(cx + s * 0.5, cy + s * 0.4);
  g.lineTo(cx, cy + s);
  g.lineTo(cx - s * 0.5, cy + s * 0.4);
  g.lineTo(cx - s * 0.7, cy - s * 0.3);
  g.closePath();
  g.fill({ color: c, alpha: 0.07 });
  g.stroke({ width: 1.5, color: c, alpha: 0.35 });
  g.moveTo(cx, cy - s);
  g.lineTo(cx, cy + s);
  g.stroke({ width: 1, color: c, alpha: 0.15 });
  g.moveTo(cx - s * 0.7, cy - s * 0.3);
  g.lineTo(cx + s * 0.7, cy - s * 0.3);
  g.stroke({ width: 1, color: c, alpha: 0.15 });
}

function drawSunburst(g: Graphics, h: number, cx: number, cy: number): void {
  const outer = h * 0.46;
  const inner = h * 0.1;
  for (let a = 0; a < 12; a++) {
    const angle = (a / 12) * Math.PI * 2;
    g.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    g.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    g.stroke({ width: 2, color: 0xf5c451, alpha: 0.15 });
  }
}

function drawSuitBadge(g: Container, sym: string, h: number, cx: number, cy: number): void {
  const t = new Text({
    text: sym,
    style: {
      fontFamily: 'Bungee, system-ui, sans-serif',
      fontSize: h * 0.3,
      fill: 0xe7edf3,
      align: 'center',
    },
  });
  t.anchor.set(0.5);
  t.x = cx;
  t.y = cy + h * 0.18;
  t.alpha = 0.4;
  g.addChild(t);
}

// ── main factory ────────────────────────────────────────────────

export function makeSymbolTile(symbolId: SlotSymbolId, size: number): Container {
  const style = SYMBOL_STYLE[symbolId];
  const container = new Container();
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const radius = s * 0.14;

  const base = new Graphics();
  base.roundRect(0, 0, s, s, radius).fill({ color: BG[symbolId] });
  const sh = s / 3;
  for (let i = 0; i < 3; i += 2) {
    base.rect(0, i * sh, s, sh).fill({ color: 0xffffff, alpha: 0.03 });
  }
  base.pivot.set(cx, cy);
  container.addChild(base);

  const iconLayer = new Graphics();
  switch (symbolId) {
    case 'DRAGON':  drawDragon(iconLayer, s, cx, cy); break;
    case 'TIGER':   drawTiger(iconLayer, s, cx, cy); break;
    case 'LOTUS':   drawLotus(iconLayer, s, cx, cy); break;
    case 'SCATTER': drawGem(iconLayer, s, cx, cy); break;
    case 'WILD':    drawSunburst(iconLayer, s, cx, cy); break;
  }
  iconLayer.pivot.set(cx, cy);
  container.addChild(iconLayer);

  if (style.badge && (symbolId === 'ACE' || symbolId === 'KING' || symbolId === 'QUEEN' || symbolId === 'TEN')) {
    drawSuitBadge(container, style.badge, s, cx, cy);
  }

  if (style.badge && (symbolId === 'DRAGON' || symbolId === 'TIGER')) {
    const bt = new Text({
      text: style.badge,
      style: {
        fontFamily: 'Bungee, system-ui, sans-serif',
        fontSize: s * 0.18,
        fill: ACCENT[symbolId],
        align: 'center',
      },
    });
    bt.anchor.set(0.5);
    bt.x = cx + s * 0.28;
    bt.y = cy + s * 0.3;
    bt.alpha = 0.25;
    container.addChild(bt);
  }

  const glow = new Graphics()
    .roundRect(3, 3, s - 6, s - 6, radius * 0.7)
    .fill({ color: ACCENT[symbolId], alpha: 0.08 });
  glow.pivot.set(cx, cy);
  container.addChild(glow);

  const border = new Graphics()
    .roundRect(1, 1, s - 2, s - 2, radius)
    .stroke({ width: 2, color: style.accent, alpha: 0.85 });
  border.pivot.set(cx, cy);
  container.addChild(border);

  const glyph = new Text({
    text: style.glyph,
    style: {
      fontFamily: 'Bungee, system-ui, sans-serif',
      fontSize: style.glyph.length > 1 ? s * 0.34 : s * 0.5,
      fill: style.accent,
      align: 'center',
    },
  });
  glyph.anchor.set(0.5);
  container.addChild(glyph);

  return container;
}
