import { Container, Graphics, Text } from 'pixi.js';
import { SYMBOL_STYLE, type SlotSymbolId } from './reelMath';

// ── colour palette ──────────────────────────────────────────────

const BG_TINT: Record<SlotSymbolId, number> = {
  WILD:    0x1e160a,
  SCATTER: 0x1e0a14,
  DRAGON:  0x1e0606,
  TIGER:   0x1e1204,
  LOTUS:   0x041a0e,
  ACE:     0x08141e,
  KING:    0x0a121c,
  QUEEN:   0x0c101a,
  TEN:     0x0e0e18,
};

const ACCENT: Record<SlotSymbolId, number> = {
  WILD:    0xf5c451,
  SCATTER: 0xe04070,
  DRAGON:  0xd23b3b,
  TIGER:   0xe0a92e,
  LOTUS:   0x2abf7a,
  ACE:     0x5b8dc9,
  KING:    0x8a9bb5,
  QUEEN:   0x9a8ab8,
  TEN:     0x6a7a8a,
};

const SUIT: Record<string, string> = {
  ACE: '♠', KING: '♣', QUEEN: '♥', TEN: '♦',
};

interface IconDrawer {
  (g: Graphics, s: number, cx: number, cy: number): void;
}

// ── bold icon drawers ───────────────────────────────────────────
// Every icon uses solid fills with 0.3-0.7 alpha so it pops against
// the dark background but still feels like a casino slot tile.

const drawStar: IconDrawer = (g, s, cx, cy) => {
  const r1 = s * 0.38;
  const r2 = s * 0.15;
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI * 2) / 10 - Math.PI / 2;
    const r = i % 2 === 0 ? r1 : r2;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.poly(pts).fill({ color: 0xf5c451, alpha: 0.35 });
  g.poly(pts).stroke({ width: 1.5, color: 0xf5c451, alpha: 0.5 });
};

const drawDiamond: IconDrawer = (g, s, cx, cy) => {
  const r = s * 0.35;
  g.moveTo(cx, cy - r);
  g.lineTo(cx + r * 0.65, cy);
  g.lineTo(cx, cy + r);
  g.lineTo(cx - r * 0.65, cy);
  g.closePath();
  g.fill({ color: 0xe04070, alpha: 0.35 });
  g.stroke({ width: 1.5, color: 0xe04070, alpha: 0.5 });
  g.moveTo(cx - 4, cy);
  g.lineTo(cx + 4, cy);
  g.stroke({ width: 1.5, color: 0xff88aa, alpha: 0.3 });
};

const drawDragonHead: IconDrawer = (g, s, cx, cy) => {
  const sc = s * 0.35;
  // head silhouette (side profile facing right)
  g.moveTo(cx - sc * 0.8, cy + sc * 0.3);
  g.bezierCurveTo(cx - sc * 0.5, cy - sc * 0.1, cx - sc * 0.2, cy - sc * 0.5, cx + sc * 0.1, cy - sc * 0.4);
  g.bezierCurveTo(cx + sc * 0.35, cy - sc * 0.35, cx + sc * 0.5, cy - sc * 0.15, cx + sc * 0.45, cy + sc * 0.05);
  g.bezierCurveTo(cx + sc * 0.5, cy + sc * 0.2, cx + sc * 0.3, cy + sc * 0.35, cx, cy + sc * 0.3);
  g.bezierCurveTo(cx - sc * 0.3, cy + sc * 0.35, cx - sc * 0.6, cy + sc * 0.4, cx - sc * 0.8, cy + sc * 0.3);
  g.closePath();
  g.fill({ color: 0xd23b3b, alpha: 0.4 });
  g.stroke({ width: 2, color: 0xd23b3b, alpha: 0.6 });
  // eye
  g.circle(cx + sc * 0.05, cy - sc * 0.15, sc * 0.12);
  g.fill({ color: 0xffcc44, alpha: 0.6 });
  g.circle(cx + sc * 0.05, cy - sc * 0.15, sc * 0.05);
  g.fill({ color: 0x000000, alpha: 0.6 });
  // horn
  g.moveTo(cx - sc * 0.1, cy - sc * 0.35);
  g.bezierCurveTo(cx - sc * 0.15, cy - sc * 0.6, cx - sc * 0.3, cy - sc * 0.7, cx - sc * 0.35, cy - sc * 0.55);
  g.stroke({ width: 3, color: 0xd23b3b, alpha: 0.6 });
  // flame breath
  g.moveTo(cx + sc * 0.45, cy + sc * 0.05);
  g.bezierCurveTo(cx + sc * 0.7, cy + sc * 0.2, cx + sc * 0.75, cy - sc * 0.15, cx + sc * 0.6, cy - sc * 0.05);
  g.stroke({ width: 2, color: 0xf5c451, alpha: 0.3 });
};

const drawTigerFace: IconDrawer = (g, s, cx, cy) => {
  const sc = s * 0.32;
  // face circle
  g.circle(cx, cy + sc * 0.05, sc);
  g.fill({ color: 0xe0a92e, alpha: 0.15 });
  g.stroke({ width: 2, color: 0xe0a92e, alpha: 0.35 });
  // ears
  g.moveTo(cx - sc * 0.65, cy - sc * 0.55);
  g.lineTo(cx - sc * 0.8, cy - sc * 0.95);
  g.lineTo(cx - sc * 0.4, cy - sc * 0.7);
  g.closePath().fill({ color: 0xe0a92e, alpha: 0.2 });
  g.moveTo(cx + sc * 0.65, cy - sc * 0.55);
  g.lineTo(cx + sc * 0.8, cy - sc * 0.95);
  g.lineTo(cx + sc * 0.4, cy - sc * 0.7);
  g.closePath().fill({ color: 0xe0a92e, alpha: 0.2 });
  // eyes
  g.circle(cx - sc * 0.25, cy - sc * 0.05, sc * 0.12);
  g.fill({ color: 0xffffff, alpha: 0.5 });
  g.circle(cx + sc * 0.25, cy - sc * 0.05, sc * 0.12);
  g.fill({ color: 0xffffff, alpha: 0.5 });
  g.circle(cx - sc * 0.25, cy - sc * 0.05, sc * 0.06);
  g.fill({ color: 0x000000, alpha: 0.5 });
  g.circle(cx + sc * 0.25, cy - sc * 0.05, sc * 0.06);
  g.fill({ color: 0x000000, alpha: 0.5 });
  // nose
  g.moveTo(cx, cy + sc * 0.15);
  g.lineTo(cx - sc * 0.1, cy + sc * 0.08);
  g.lineTo(cx + sc * 0.1, cy + sc * 0.08);
  g.closePath().fill({ color: 0xcc8844, alpha: 0.5 });
  // mouth
  g.moveTo(cx - sc * 0.15, cy + sc * 0.18);
  g.bezierCurveTo(cx, cy + sc * 0.28, cx, cy + sc * 0.28, cx + sc * 0.15, cy + sc * 0.18);
  g.stroke({ width: 1.5, color: 0xe0a92e, alpha: 0.3 });
  // forehead stripes
  for (let i = -1; i <= 1; i++) {
    const x = cx + i * sc * 0.22;
    g.moveTo(x - 1.5, cy - sc * 0.5);
    g.lineTo(x, cy - sc * 0.2);
    g.lineTo(x + 1.5, cy - sc * 0.5);
    g.stroke({ width: 2.5, color: 0xe0a92e, alpha: 0.25 });
  }
};

const drawLotusFlower: IconDrawer = (g, s, cx, cy) => {
  const petals = 5;
  const pl = s * 0.3;
  const pw = s * 0.1;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 - Math.PI / 2;
    const px = cx + Math.cos(a) * pl * 0.5;
    const py = cy + Math.sin(a) * pl * 0.5;
    g.ellipse(px, py, pw, pl * 0.55);
    g.fill({ color: 0x23a06b, alpha: 0.2 + 0.04 * i });
    g.stroke({ width: 1, color: 0x23a06b, alpha: 0.25 });
  }
  g.circle(cx, cy, s * 0.08);
  g.fill({ color: 0xf5c451, alpha: 0.25 });
};

function drawSuitPip(g: Container, suit: string, s: number, cx: number, cy: number): void {
  const t = new Text({
    text: suit,
    style: {
      fontFamily: 'Bungee, system-ui, sans-serif',
      fontSize: s * 0.55,
      fill: 0xe7edf3,
      align: 'center',
    },
  });
  t.anchor.set(0.5);
  t.x = cx;
  t.y = cy + s * 0.04;
  t.alpha = 0.18;
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

  // --- dark tinted background ---
  const base = new Graphics();
  base.roundRect(0, 0, s, s, radius).fill({ color: BG_TINT[symbolId] });
  const sh = s / 3;
  for (let i = 0; i < 3; i += 2) {
    base.rect(0, i * sh, s, sh).fill({ color: 0xffffff, alpha: 0.025 });
  }
  base.pivot.set(cx, cy);
  container.addChild(base);

  // --- bold icon ---
  const icon = new Graphics();
  switch (symbolId) {
    case 'WILD':    drawStar(icon, s, cx, cy); break;
    case 'SCATTER': drawDiamond(icon, s, cx, cy); break;
    case 'DRAGON':  drawDragonHead(icon, s, cx, cy); break;
    case 'TIGER':   drawTigerFace(icon, s, cx, cy); break;
    case 'LOTUS':   drawLotusFlower(icon, s, cx, cy); break;
  }

  // card suit pip (large background symbol for card ranks)
  const suit = SUIT[symbolId];
  if (suit) {
    drawSuitPip(container, suit, s, cx, cy);
  }

  icon.pivot.set(cx, cy);
  container.addChild(icon);

  // --- inner glow ---
  const glow = new Graphics()
    .roundRect(3, 3, s - 6, s - 6, radius * 0.7)
    .fill({ color: ACCENT[symbolId], alpha: 0.07 });
  glow.pivot.set(cx, cy);
  container.addChild(glow);

  // --- accent border ---
  const border = new Graphics()
    .roundRect(1, 1, s - 2, s - 2, radius)
    .stroke({ width: 1.5, color: style.accent, alpha: 0.7 });
  border.pivot.set(cx, cy);
  container.addChild(border);

  // --- main glyph (large readable letter) ---
  const glyph = new Text({
    text: style.glyph,
    style: {
      fontFamily: 'Bungee, system-ui, sans-serif',
      fontSize: style.glyph.length > 1 ? s * 0.32 : s * 0.48,
      fill: style.accent,
      align: 'center',
    },
  });
  glyph.anchor.set(0.5);
  container.addChild(glyph);

  return container;
}
