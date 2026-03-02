"use client";

import { useEffect, useRef, useState } from "react";
import type { FractalParams } from "./fractal-worker";
import type { BackendType, FractalRenderer } from "./renderers/types";
import { detectBestBackend } from "./renderers/detect-backend";
import type { WorkerRenderer } from "./renderers/worker-renderer";

// float32 mantissa limit — beyond this zoom, GPU produces block artifacts
const GPU_ZOOM_LIMIT = 10_000;

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
  const gpuRef = useRef<FractalRenderer | null>(null);
  const cpuRef = useRef<WorkerRenderer | null>(null);
  const cpuCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const lastRenderedRef = useRef<string>("");
  const [activeBackend, setActiveBackend] = useState<BackendType | null>(null);
  const readyRef = useRef(false);

  // Initialize both GPU and CPU renderers
  useEffect(() => {
    let disposed = false;

    async function init() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // 1. Init GPU renderer
      const bestBackend = await detectBestBackend();
      if (bestBackend !== "cpu") {
        const chain: BackendType[] =
          bestBackend === "webgpu" ? ["webgpu", "webgl"] : ["webgl"];
        for (const backend of chain) {
          if (disposed) return;
          try {
            const r = await createRenderer(backend);
            await r.init(canvas);
            if (disposed) { r.dispose(); return; }
            gpuRef.current = r;
            break;
          } catch (err) {
            console.warn(`GPU backend ${backend} failed`, err);
          }
        }
      }

      // 2. Init CPU renderer with its own offscreen canvas
      if (!disposed) {
        try {
          const offscreen = document.createElement("canvas");
          cpuCanvasRef.current = offscreen;
          const r = await createRenderer("cpu");
          await r.init(offscreen);
          if (disposed) { r.dispose(); return; }
          cpuRef.current = r as WorkerRenderer;
        } catch (err) {
          console.warn("CPU backend failed", err);
        }
      }

      if (disposed) return;
      readyRef.current = true;
      setActiveBackend(gpuRef.current ? gpuRef.current.backend : "cpu");
      lastRenderedRef.current = "";
    }

    init();

    return () => {
      disposed = true;
      gpuRef.current?.dispose();
      gpuRef.current = null;
      cpuRef.current?.dispose();
      cpuRef.current = null;
      // Remove CPU canvas from DOM if present
      cpuCanvasRef.current?.remove();
      cpuCanvasRef.current = null;
      readyRef.current = false;
    };
  }, [canvasRef]);

  // Render: pick GPU or CPU based on zoom
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!readyRef.current) return;

      const mainCanvas = canvasRef.current;
      if (!mainCanvas) return;

      const useGpu = gpuRef.current && params.zoom <= GPU_ZOOM_LIMIT;
      const renderer = useGpu ? gpuRef.current! : cpuRef.current;
      if (!renderer) return;

      const backend = renderer.backend;
      if (backend !== activeBackend) {
        setActiveBackend(backend);
        lastRenderedRef.current = ""; // force re-render on switch
      }

      const key = JSON.stringify(params);
      if (key === lastRenderedRef.current) return;
      lastRenderedRef.current = key;

      if (backend === "cpu") {
        // CPU: render to offscreen canvas, overlay it
        const offscreen = cpuCanvasRef.current;
        if (!offscreen) return;

        // Insert offscreen canvas into DOM if needed
        const container = mainCanvas.parentElement;
        if (container && offscreen.parentElement !== container) {
          offscreen.className = mainCanvas.className;
          offscreen.style.position = "absolute";
          offscreen.style.inset = "0";
          offscreen.style.imageRendering = "pixelated";
          offscreen.style.pointerEvents = "none";
          offscreen.style.zIndex = "1";
          container.appendChild(offscreen);
        }
        offscreen.style.display = "";
        mainCanvas.style.display = "none";

        renderer.render(params);
      } else {
        // GPU: hide CPU canvas, show main
        mainCanvas.style.display = "";
        const offscreen = cpuCanvasRef.current;
        if (offscreen) offscreen.style.display = "none";

        renderer.render(params);
      }
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [params, activeBackend, canvasRef]);

  return { activeBackend };
}
