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
  cpuResolution: 0.5,
  renderMode: "auto",
  fixedResolution: false,
  fixedWidth: 131,
  fixedHeight: 64,
  lockIterations: false,
  binaryColor: false,
};

export default function App() {
  const [params, setParams] = useState<FractalParams>(DEFAULT_PARAMS);
  const [panelOpen, setPanelOpen] = useState(true);

  const handleParamsChange = useCallback((update: Partial<FractalParams>) => {
    setParams((prev) => {
      const next = { ...prev, ...update };
      // When enabling fixed resolution, auto-lock iterations
      if (update.fixedResolution === true && !prev.fixedResolution) {
        next.lockIterations = true;
      }
      // Auto-adjust iterations based on zoom (unless user explicitly set them or locked)
      if (update.zoom !== undefined && update.maxIterations === undefined && !next.lockIterations) {
        const autoIter = Math.round(200 + 100 * Math.log2(Math.max(1, next.zoom)));
        next.maxIterations = Math.max(prev.maxIterations, Math.min(autoIter, 10000));
      }
      return next;
    });
  }, []);

  return (
    <main className="w-screen h-screen flex overflow-hidden bg-black">
      {/* Sidebar — desktop: push layout; mobile: overlay */}
      {/* Desktop (sm+): flex child with width transition */}
      <div
        className={`hidden sm:block h-full shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out ${
          panelOpen ? "w-80" : "w-0"
        }`}
      >
        <ControlPanel
          params={params}
          onParamsChange={handleParamsChange}
        />
      </div>
      {/* Mobile (<sm): absolute overlay */}
      <div
        className={`sm:hidden absolute inset-0 z-30 transition-transform duration-300 ease-in-out ${
          panelOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <ControlPanel
          params={params}
          onParamsChange={handleParamsChange}
        />
        {/* Tap outside to close */}
        <div
          className="absolute top-0 left-80 w-screen h-full"
          onClick={() => setPanelOpen(false)}
        />
      </div>

      {/* Canvas area */}
      <div className="flex-1 h-full relative overflow-hidden bg-black">
        <FractalCanvas params={params} onParamsChange={handleParamsChange} />
        {/* Toggle button */}
        <button
          onClick={() => setPanelOpen((v) => !v)}
          className="absolute top-4 left-4 z-40 bg-black/70 backdrop-blur-sm border border-white/10 text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
          title={panelOpen ? "Fermer le panneau" : "Ouvrir le panneau"}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {panelOpen ? (
              <>
                <line x1="4" y1="4" x2="16" y2="16" />
                <line x1="16" y1="4" x2="4" y2="16" />
              </>
            ) : (
              <>
                <line x1="3" y1="5" x2="17" y2="5" />
                <line x1="3" y1="10" x2="17" y2="10" />
                <line x1="3" y1="15" x2="17" y2="15" />
              </>
            )}
          </svg>
        </button>
      </div>
    </main>
  );
}
