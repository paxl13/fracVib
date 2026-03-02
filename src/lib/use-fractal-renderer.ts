"use client";

import { useCallback, useEffect, useRef } from "react";
import type { FractalParams, WorkerMessage, WorkerResult } from "./fractal-worker";

function getWorkerCount() {
  if (typeof navigator !== "undefined" && navigator.hardwareConcurrency) {
    return Math.min(navigator.hardwareConcurrency, 16);
  }
  return 4;
}

export function useFractalRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  params: FractalParams
) {
  const workersRef = useRef<Worker[]>([]);
  const renderIdRef = useRef(0);
  const rafRef = useRef<number>(0);
  const lastRenderedRef = useRef<string>("");

  useEffect(() => {
    const workers: Worker[] = [];
    const count = getWorkerCount();
    for (let i = 0; i < count; i++) {
      const worker = new Worker(
        new URL("./fractal-worker.ts", import.meta.url),
        { type: "module" }
      );
      workers.push(worker);
    }
    workersRef.current = workers;
    return () => {
      workers.forEach((w) => w.terminate());
      workersRef.current = [];
    };
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const workers = workersRef.current;
    if (workers.length === 0) return;

    // Skip duplicate renders
    const key = JSON.stringify(params);
    if (key === lastRenderedRef.current) return;
    lastRenderedRef.current = key;

    const renderId = ++renderIdRef.current;
    const { width, height } = params;

    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const rowsPerWorker = Math.ceil(height / workers.length);

    workers.forEach((worker, i) => {
      const startRow = i * rowsPerWorker;
      const endRow = Math.min(startRow + rowsPerWorker, height);
      if (startRow >= endRow) return;

      worker.onmessage = (e: MessageEvent<WorkerResult>) => {
        if (renderIdRef.current !== renderId) return;

        const { imageData, startRow: sr, endRow: er } = e.data;
        const rows = er - sr;
        if (rows <= 0 || imageData.length !== width * rows * 4) return;
        const imgData = new ImageData(
          new Uint8ClampedArray(imageData),
          width,
          rows
        );
        ctx.putImageData(imgData, 0, sr);
      };

      const msg: WorkerMessage = { params, startRow, endRow };
      worker.postMessage(msg);
    });
  }, [canvasRef, params]);

  // Debounced render via requestAnimationFrame
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      render();
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [render]);

  return { render };
}
