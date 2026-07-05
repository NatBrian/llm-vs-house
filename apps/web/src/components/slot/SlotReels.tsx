// The one Pixi canvas island in this app. Raw pixi.js (imperative Application +
// manual mount/destroy), not @pixi/react — every other board in this codebase drives
// animation with imperative timing (SicBoBoard's setTimeout shake recursion,
// RouletteBoard's precomputed deceleration keyframes), and @pixi/react's declarative
// reconciler would fight GSAP's imperative per-frame tweening for this one canvas.
//
// The outcome is ALREADY decided (it arrives as a finished `grid` prop) — the reel
// animation always lands on the known final symbols, never mid-flight-random.

import { useEffect, useRef, useState } from 'react';
import { Application, BlurFilter, Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import { makeSymbolTile } from './symbolTile';
import { buildFillerStrip, reelStopDelayMs, REEL_TIMING, type SlotSymbolId } from './reelMath';

export const CELL = 84;
export const GAP = 8;
export const REEL_COUNT = 5;
export const ROWS = 3;
export const CANVAS_WIDTH = REEL_COUNT * CELL + (REEL_COUNT - 1) * GAP;
export const CANVAS_HEIGHT = ROWS * CELL;

export function cellRect(reel: number, row: number): { x: number; y: number; w: number; h: number } {
  return { x: reel * (CELL + GAP), y: row * CELL, w: CELL, h: CELL };
}

interface SlotReelsProps {
  /** [reel][row] final landed symbols for this spin. */
  grid: string[][];
  /** Changes every spin (main, then each bonus spin) to retrigger the animation. */
  spinKey: string | number;
  /** Reel index (if any) from which the remaining reels get an anticipation hold. */
  anticipationFromReel: number | null;
  onSettled?: () => void;
}

const FILLER_COUNT = 40;

export function SlotReels({ grid, spinKey, anticipationFromReel, onSettled }: SlotReelsProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const columnsRef = useRef<Array<{ scroll: Container; blur: BlurFilter; glow: Graphics }>>([]);
  // Flips once Application.init() resolves. The animation-build effect below depends on
  // this (not just spinKey) — without it, the very first spin after mount races the async
  // init: appRef.current is still null when that effect first runs, it bails out silently,
  // and nothing re-triggers it since spinKey hasn't changed yet.
  const [ready, setReady] = useState(false);

  // Mount the Pixi Application once; destroy on unmount.
  useEffect(() => {
    let cancelled = false;
    const app = new Application();
    void app.init({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, background: '#0a0e12', antialias: true }).then(() => {
      if (cancelled || !hostRef.current) return;
      appRef.current = app;
      hostRef.current.appendChild(app.canvas);

      const columns: Array<{ scroll: Container; blur: BlurFilter; glow: Graphics }> = [];
      for (let reel = 0; reel < REEL_COUNT; reel++) {
        const colX = reel * (CELL + GAP);

        const glow = new Graphics().rect(-2, -2, CELL + 4, CANVAS_HEIGHT + 4).fill({ color: 0xf5c451, alpha: 0 });
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

  // (Re)build and animate every column whenever a new spin lands. Depends on `ready` too,
  // so the first spin after mount plays as soon as Pixi finishes initializing, not just
  // on the next spinKey change.
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
      const strip = buildFillerStrip(finalWindow, (typeof spinKey === 'number' ? spinKey : spinKey.length) * 97 + reel * 31, FILLER_COUNT);
      strip.forEach((sym, i) => {
        const tile = makeSymbolTile(sym as SlotSymbolId, CELL - 6);
        tile.x = CELL / 2;
        tile.y = i * CELL + CELL / 2;
        scroll.addChild(tile);
      });

      const targetY = -(FILLER_COUNT * CELL);
      scroll.y = targetY + (FILLER_COUNT - 6) * CELL; // start a few cells "above" landing, mid-spin look

      const isAnticipation = anticipationFromReel !== null && reel >= anticipationFromReel;
      const stopDelay = reelStopDelayMs(reel, anticipationFromReel) / 1000;
      const rampS = REEL_TIMING.rampMs / 1000;
      const landS = REEL_TIMING.landingMs / 1000;
      const settleS = REEL_TIMING.settleMs / 1000;
      const cruiseBlur = isAnticipation ? REEL_TIMING.anticipationBlur : REEL_TIMING.cruiseBlur;

      // Ramp up: accelerate the scroll + blur in.
      timeline.to(blur, { strengthY: cruiseBlur, duration: rampS, ease: 'power1.in' }, 0);
      timeline.to(scroll, {
        y: `-=${CELL * 3}`,
        duration: rampS,
        ease: 'power1.in',
      }, 0);

      // Cruise: keep scrolling at a steady clip until this reel's stop delay.
      const cruiseDuration = Math.max(0, stopDelay - rampS);
      if (cruiseDuration > 0) {
        timeline.to(scroll, {
          y: `-=${Math.min((FILLER_COUNT - 9) * CELL, cruiseDuration * (isAnticipation ? 260 : 480))}`,
          duration: cruiseDuration,
          ease: 'none',
        }, rampS);
      }
      if (isAnticipation) {
        timeline.to(glow, { alpha: 0.22, duration: 0.35, repeat: Math.ceil(cruiseDuration / 0.35), yoyo: true }, rampS);
      }

      // Landing: exact target, blur clears, then a small settle bounce.
      const landStart = stopDelay;
      timeline.to(scroll, { y: targetY, duration: landS, ease: 'power2.out' }, landStart);
      timeline.to(blur, { strengthY: 0, duration: landS, ease: 'power2.out' }, landStart);
      timeline.to(glow, { alpha: 0, duration: landS }, landStart);
      timeline.fromTo(scroll, { y: targetY - 10 }, { y: targetY, duration: settleS, ease: 'back.out(2)' }, landStart + landS);
    });

    return () => {
      timeline.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey, ready]);

  return <div ref={hostRef} style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, borderRadius: 8, overflow: 'hidden' }} />;
}
