"use client";

import { useEffect, useRef, useState } from "react";
import type { FractalParams } from "./fractal-worker";
import type { BackendType, FractalRenderer } from "./renderers/types";
import { detectBestBackend } from "./renderers/detect-backend";

async function createRenderer(backend: BackendType): Promise<FractalRenderer> {
  switch (backend) {
    case "webgpu": {
      const { WebGPURenderer } = await import("./renderers/webgpu-renderer");
      return new WebGPURenderer();
    }
    case "webgl": {
      const { WebGLRenderer } = await import("./renderers/webgl-renderer");
      return new WebGLRenderer();
    }
    default: {
      const { WorkerRenderer } = await import("./renderers/worker-renderer");
      return new WorkerRenderer();
    }
  }
}

export function useFractalRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  params: FractalParams
) {
  const rendererRef = useRef<FractalRenderer | null>(null);
  const rafRef = useRef<number>(0);
  const lastRenderedRef = useRef<string>("");
  const [activeBackend, setActiveBackend] = useState<BackendType | null>(null);

  // Initialize renderer: detect best backend + fallback chain
  useEffect(() => {
    let disposed = false;

    async function initRenderer() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const bestBackend = await detectBestBackend();

      // Try backends in order: best → fallback
      const fallbackChain: BackendType[] =
        bestBackend === "webgpu"
          ? ["webgpu", "webgl", "cpu"]
          : bestBackend === "webgl"
            ? ["webgl", "cpu"]
            : ["cpu"];

      for (const backend of fallbackChain) {
        if (disposed) return;
        try {
          const renderer = await createRenderer(backend);
          await renderer.init(canvas);
          if (disposed) {
            renderer.dispose();
            return;
          }
          rendererRef.current = renderer;
          setActiveBackend(renderer.backend);
          // Trigger initial render
          lastRenderedRef.current = "";
          return;
        } catch (err) {
          console.warn(`Backend ${backend} failed, trying next...`, err);
        }
      }
    }

    initRenderer();

    return () => {
      disposed = true;
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, [canvasRef]);

  // Render on param changes
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const renderer = rendererRef.current;
      if (!renderer) return;

      const key = JSON.stringify(params);
      if (key === lastRenderedRef.current) return;
      lastRenderedRef.current = key;

      renderer.render(params);
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [params]);

  return { activeBackend };
}
