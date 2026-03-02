"use client";

import { useCallback, useState } from "react";
import FractalCanvas from "@/components/FractalCanvas";
import ControlPanel from "@/components/ControlPanel";
import type { FractalParams } from "@/lib/fractal-worker";

const DEFAULT_PARAMS: FractalParams = {
  type: "mandelbrot",
  width: 800,
  height: 600,
  centerX: -0.5,
  centerY: 0,
  zoom: 1,
  maxIterations: 200,
  juliaReal: -0.7269,
  juliaImag: 0.1889,
  colorScheme: "classic",
};

export default function Home() {
  const [params, setParams] = useState<FractalParams>(DEFAULT_PARAMS);
  const [panelOpen, setPanelOpen] = useState(true);

  const handleParamsChange = useCallback((update: Partial<FractalParams>) => {
    setParams((prev) => {
      const next = { ...prev, ...update };
      // Auto-adjust iterations based on zoom (unless user explicitly set them)
      if (update.zoom !== undefined && update.maxIterations === undefined) {
        const autoIter = Math.round(200 + 100 * Math.log2(Math.max(1, next.zoom)));
        next.maxIterations = Math.max(prev.maxIterations, Math.min(autoIter, 10000));
      }
      return next;
    });
  }, []);

  return (
    <main className="w-screen h-screen relative overflow-hidden bg-black">
      <FractalCanvas params={params} onParamsChange={handleParamsChange} />
      <ControlPanel
        params={params}
        onParamsChange={handleParamsChange}
        isOpen={panelOpen}
        onToggle={() => setPanelOpen((v) => !v)}
      />
    </main>
  );
}
