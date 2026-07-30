"use client";

import React, { useRef, useEffect } from "react";

interface NoiseProps {
  /**
   * Redraw the grain every Nth animation frame. Higher is cheaper. At 4 the
   * texture still reads as alive without repainting on every frame.
   */
  patternRefreshInterval?: number;
  /** Alpha of each grain pixel, 0-255. */
  patternAlpha?: number;
}

/**
 * Animated film grain, mounted once per page surface.
 *
 * The defaults are the tuned site-wide values, so call sites should render a
 * bare `<Noise />` rather than restating them — that keeps the texture
 * identical on the landing, the auth screens, the dashboard and the public form
 * instead of drifting per page.
 *
 * Two guards matter because this now runs on every route rather than just the
 * marketing page:
 *
 *  - `prefers-reduced-motion` draws a single static frame and never loops. A
 *    full-viewport repaint several times a second is exactly the kind of
 *    ambient movement that setting exists to suppress.
 *  - A hidden tab stops the loop. Without this the canvas keeps repainting
 *    behind other windows, which is pure battery cost for something nobody can
 *    see. The listener restarts it on return.
 */
const Noise: React.FC<NoiseProps> = ({ patternRefreshInterval = 4, patternAlpha = 16 }) => {
  const grainRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = grainRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // The canvas is a fixed 1024px buffer stretched over the viewport by CSS.
    // Grain has no "correct" scale, so upscaling a fixed buffer is cheaper than
    // reallocating an image the size of the window on every resize.
    const canvasSize = 1024;
    let frame = 0;
    let animationId: number | null = null;

    const resize = () => {
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      canvas.style.width = "100vw";
      canvas.style.height = "100vh";
    };

    const drawGrain = () => {
      const imageData = ctx.createImageData(canvasSize, canvasSize);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const value = Math.random() * 255;
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
        data[i + 3] = patternAlpha;
      }
      ctx.putImageData(imageData, 0, 0);
    };

    const loop = () => {
      if (frame % patternRefreshInterval === 0) drawGrain();
      frame++;
      animationId = window.requestAnimationFrame(loop);
    };

    const stop = () => {
      if (animationId !== null) {
        window.cancelAnimationFrame(animationId);
        animationId = null;
      }
    };

    const start = () => {
      if (animationId === null) loop();
    };

    resize();

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    const apply = () => {
      stop();
      if (reduceMotion.matches) {
        // One frame, held. Still textured, never moving.
        drawGrain();
      } else if (document.visibilityState === "visible") {
        start();
      }
    };

    apply();

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    reduceMotion.addEventListener("change", apply);

    return () => {
      stop();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      reduceMotion.removeEventListener("change", apply);
    };
  }, [patternRefreshInterval, patternAlpha]);

  return (
    <canvas
      aria-hidden
      className="pointer-events-none fixed inset-0 z-9999 h-full w-full"
      ref={grainRef}
      style={{ imageRendering: "pixelated" }}
    />
  );
};

export default Noise;
