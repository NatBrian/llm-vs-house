import { useEffect, useRef, useState } from 'react';
import { Application, BlurFilter, Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import { makeSymbolTile } from './symbolTile';
import { buildSlotStrip, reelStopDelayMs, REEL_TIMING, FILLER_BEFORE, FILLER_AFTER, type SlotSymbolId } from './reelMath';

export const CELL = 84;
export const GAP = 8;
export const REEL_COUNT = 5;
export const ROWS = 3;
export const CANVAS_WIDTH = REEL_COUNT * CELL + (REEL_COUNT - 1) * GAP;
export const CANVAS_HEIGHT = ROWS * CELL;

const SEPARATOR_COLOR = 0x2a3846;
const FRAME_COLOR = 0x3a2818;

export function cellRect(reel: number, row: number): { x: number; y: number; w: number; h: number } {
  return { x: reel * (CELL + GAP), y: row * CELL, w: CELL, h: CELL };
}

interface SlotReelsProps {
  grid: string[][];
  spinKey: string | number;
  anticipationFromReel: number | null;
  onSettled?: () => void;
}

export function SlotReels({ grid, spinKey, anticipationFromReel, onSettled }: SlotReelsProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const columnsRef = useRef<Array<{ scroll: Container; blur: BlurFilter; glow: Graphics }>>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const app = new Application();
    void app.init({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, background: '#0a0e12', antialias: true }).then(() => {
      if (cancelled || !hostRef.current) return;
      appRef.current = app;
      hostRef.current.appendChild(app.canvas);

      // Reel dividers (vertical chrome bars between columns)
      for (let i = 1; i < REEL_COUNT; i++) {
        const x = i * (CELL + GAP) - GAP / 2;
        const div = new Graphics()
          .rect(x - 1, 0, 2, CANVAS_HEIGHT)
          .fill({ color: SEPARATOR_COLOR, alpha: 0.6 })
          .rect(x - 3, 0, 6, CANVAS_HEIGHT)
          .fill({ color: FRAME_COLOR, alpha: 0.15 });
        app.stage.addChild(div);
      }

      // Reel window frame (top/bottom chrome bars + side borders)
      const frameDepth = 6;
      const frame = new Graphics()
        .rect(0, 0, CANVAS_WIDTH, frameDepth).fill({ color: FRAME_COLOR, alpha: 0.7 })
        .rect(0, CANVAS_HEIGHT - frameDepth, CANVAS_WIDTH, frameDepth).fill({ color: FRAME_COLOR, alpha: 0.7 });
      app.stage.addChild(frame);

      const columns: Array<{ scroll: Container; blur: BlurFilter; glow: Graphics }> = [];
      for (let reel = 0; reel < REEL_COUNT; reel++) {
        const colX = reel * (CELL + GAP);

        const glow = new Graphics().rect(-2, 0, CELL + 4, CANVAS_HEIGHT).fill({ color: 0xf5c451, alpha: 0 });
        glow.x = colX;
        app.stage.addChild(glow);

        const maskG = new Graphics().rect(0, 0, CELL, CANVAS_HEIGHT).fill({ color: 0xffffff });
        maskG.x = colX;
        app.stage.addChild(maskG);

        const scroll = new Container();
        scroll.x = colX;
        const blur = new BlurFilter({ strength: 0 });
        blur.strengthX = 0;
        scroll.filters = [blur];
        scroll.mask = maskG;
        app.stage.addChild(scroll);

        columns.push({ scroll, blur, glow });
      }
      columnsRef.current = columns;
      setReady(true);
    });
    return () => {
      cancelled = true;
      appRef.current?.destroy(true, { children: true });
      appRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const app = appRef.current;
    const columns = columnsRef.current;
    if (!app || !ready || columns.length !== REEL_COUNT) return;

    const timeline = gsap.timeline({
      onComplete: () => onSettled?.(),
    });

    columns.forEach(({ scroll, blur, glow }, reel) => {
      scroll.removeChildren();
      const finalWindow = grid[reel] ?? ['TEN', 'TEN', 'TEN'];
      const seed = (typeof spinKey === 'number' ? spinKey : spinKey.length) * 97 + reel * 31;
      const strip = buildSlotStrip(finalWindow, seed);
      strip.forEach((sym, i) => {
        const tile = makeSymbolTile(sym as SlotSymbolId, CELL - 6);
        tile.x = CELL / 2;
        tile.y = i * CELL + CELL / 2;
        scroll.addChild(tile);
      });

      // DOWNWARD SPIN: finalWindow sits at strip index FILLER_BEFORE (targetY).
      // Initial position shows the END of the strip (fillers_after area), then
      // scrolls DOWNWARD (increasing Y) to settle on the result — matching real
      // slot machines where symbols appear to fall from above.
      const targetY = -(FILLER_BEFORE * CELL);
      const initialY = -((FILLER_BEFORE + FILLER_AFTER) * CELL);
      scroll.y = initialY;

      const isAnticipation = anticipationFromReel !== null && reel >= anticipationFromReel;
      const stopDelay = reelStopDelayMs(reel, anticipationFromReel) / 1000;
      const rampS = REEL_TIMING.rampMs / 1000;
      const landS = REEL_TIMING.landingMs / 1000;
      const settleS = REEL_TIMING.settleMs / 1000;
      const cruiseBlur = isAnticipation ? REEL_TIMING.anticipationBlur : REEL_TIMING.cruiseBlur;

      // Ramp up: accelerate the scroll + blur in.
      timeline.to(blur, { strengthY: cruiseBlur, duration: rampS, ease: 'power1.in' }, 0);
      timeline.to(scroll, {
        y: `+=${CELL * 3}`,
        duration: rampS,
        ease: 'power1.in',
      }, 0);

      // Cruise: keep scrolling DOWNWARD at a steady clip.
      const cruiseDuration = Math.max(0, stopDelay - rampS);
      const availableCells = FILLER_AFTER - 3;
      const cruiseMaxPx = Math.max(0, availableCells * CELL);
      if (cruiseDuration > 0 && cruiseMaxPx > 0) {
        timeline.to(scroll, {
          y: `+=${Math.min(cruiseMaxPx, cruiseDuration * (isAnticipation ? 260 : 480))}`,
          duration: cruiseDuration,
          ease: 'none',
        }, rampS);
      }
      if (isAnticipation) {
        timeline.to(glow, { alpha: 0.22, duration: 0.35, repeat: Math.ceil(cruiseDuration / 0.35), yoyo: true }, rampS);
      }

      // Landing: snap to exact final position, blur clears.
      const landStart = stopDelay;
      timeline.to(scroll, { y: targetY, duration: landS, ease: 'power2.out' }, landStart);
      timeline.to(blur, { strengthY: 0, duration: landS, ease: 'power2.out' }, landStart);
      timeline.to(glow, { alpha: 0, duration: landS }, landStart);
      timeline.fromTo(scroll,
        { y: targetY - 10 },
        { y: targetY, duration: settleS, ease: 'back.out(2)' },
        landStart + landS,
      );
    });

    return () => {
      timeline.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey, ready]);

  return <div ref={hostRef} style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, borderRadius: 8, overflow: 'hidden' }} />;
}
