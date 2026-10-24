"use client";

import { useEffect, useRef, useState } from "react";
import { Mesh, Program, Renderer, Triangle, Vec2 } from "ogl";
import { fragment, vertex } from "@/components/dark-veil-shader";
import { getTheme, subscribeTheme } from "@/lib/theme";

export type DarkVeilProps = {
  /** Recolour the veil with this #rrggbb (the shop's main colour). Omit for a neutral silver veil. */
  tint?: string;
  hueShift?: number;
  noiseIntensity?: number;
  scanlineIntensity?: number;
  scanlineFrequency?: number;
  warpAmount?: number;
  speed?: number;
  /** Rendered pixels per CSS pixel. The veil is soft, so 0.5 looks the same at a quarter of the GPU work. */
  resolutionScale?: number;
  /** How strong the veil is on the dark / light theme (0–1). */
  intensity?: { dark: number; light: number };
  className?: string;
};

const MAX_FPS = 30;

/**
 * Dark Veil (React Bits — reactbits.dev/backgrounds/dark-veil): an animated WebGL veil.
 *
 * Adapted from the registry version to stay light on a shop's home page:
 * - renders at half resolution, capped at 30fps, and fades in after its first frame
 * - stops completely when scrolled out of view or the tab is hidden; one still frame for reduced motion
 * - follows the site theme (light mode draws "ink on white") and can be tinted with any colour
 * - fixes the original's resolutionScale, which shrank the canvas instead of rendering it at lower resolution
 * Load it with next/dynamic (see HeroVeil) so ogl + the shader never delay the page's first paint.
 */
export default function DarkVeil({
  tint,
  hueShift = 0,
  noiseIntensity = 0,
  scanlineIntensity = 0,
  scanlineFrequency = 0,
  warpAmount = 0,
  speed = 0.5,
  resolutionScale = 0.5,
  intensity = { dark: 0.75, light: 0.55 },
  className = "",
}: DarkVeilProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const { dark: darkIntensity, light: lightIntensity } = intensity;

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    let renderer: Renderer;
    try {
      renderer = new Renderer({ canvas, dpr: 1, alpha: false, antialias: false, powerPreference: "low-power" });
    } catch {
      return; // no WebGL — the section simply has no veil
    }
    const gl = renderer.gl;
    const [tintColor, tintMix] = tint ? [hexToRgb(tint), 1] : [[0.82, 0.84, 0.88], 1];

    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new Vec2() },
        uHueShift: { value: hueShift },
        uNoise: { value: noiseIntensity },
        uScan: { value: scanlineIntensity },
        uScanFreq: { value: scanlineFrequency },
        uWarp: { value: warpAmount },
        uLightMode: { value: 0 },
        uTint: { value: tintColor },
        uTintMix: { value: tintMix },
        uIntensity: { value: darkIntensity },
      },
    });
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let visible = false;
    let last = 0;
    let elapsed = 0; // animation time only advances while visible, so it resumes where it left off
    let drewOnce = false;

    const render = () => {
      program.uniforms.uTime.value = (elapsed / 1000) * speed;
      renderer.render({ scene: mesh });
      if (!drewOnce) {
        drewOnce = true;
        setReady(true);
      }
    };

    const applyTheme = () => {
      const light = getTheme() === "light";
      program.uniforms.uLightMode.value = light ? 1 : 0;
      program.uniforms.uIntensity.value = light ? lightIntensity : darkIntensity;
      if (!frame) render(); // redraw right away even while paused
    };

    const resize = () => {
      const w = Math.max(1, Math.round(parent.clientWidth * resolutionScale));
      const h = Math.max(1, Math.round(parent.clientHeight * resolutionScale));
      renderer.setSize(w, h);
      canvas.style.width = "100%"; // setSize writes a pixel size; stretch the low-res buffer over the box
      canvas.style.height = "100%";
      program.uniforms.uResolution.value.set(gl.canvas.width, gl.canvas.height);
      if (!frame) render();
    };

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (now - last < 1000 / MAX_FPS - 2) return;
      elapsed += last ? Math.min(now - last, 100) : 0;
      last = now;
      render();
    };

    const start = () => {
      if (reducedMotion || frame || !visible || document.hidden) return;
      last = 0;
      frame = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    const onVisibility = () => (document.hidden ? stop() : start());
    const resizeObserver = new ResizeObserver(resize);

    applyTheme();
    resize();
    observer.observe(parent);
    resizeObserver.observe(parent);
    const unsubscribeTheme = subscribeTheme(applyTheme);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      observer.disconnect();
      resizeObserver.disconnect();
      unsubscribeTheme();
      document.removeEventListener("visibilitychange", onVisibility);
      // No loseContext() here: the effect can re-run on the same canvas (Strict Mode, prop changes), and
      // getContext() would hand back the lost context. The browser frees it with the canvas.
    };
  }, [tint, hueShift, noiseIntensity, scanlineIntensity, scanlineFrequency, warpAmount, speed, resolutionScale, darkIntensity, lightIntensity]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`block size-full transition-opacity duration-1000 ${ready ? "opacity-100" : "opacity-0"} ${className}`}
    />
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const rgb: [number, number, number] = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  // Normalise so the brightest channel is 1: a deep brand colour still reads as that colour, just glowing.
  const max = Math.max(...rgb, 0.001);
  return rgb.map((c) => c / max) as [number, number, number];
}
