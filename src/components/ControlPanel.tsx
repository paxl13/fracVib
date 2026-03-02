"use client";

import type { FractalType, FractalParams } from "@/lib/fractal-worker";

interface Props {
  params: FractalParams;
  onParamsChange: (p: Partial<FractalParams>) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const FRACTAL_TYPES: { value: FractalType; label: string; description: string }[] = [
  { value: "mandelbrot", label: "Mandelbrot", description: "z = z² + c" },
  { value: "julia", label: "Julia", description: "z = z² + c (c fixe)" },
  { value: "burningship", label: "Burning Ship", description: "z = (|Re(z)| + i|Im(z)|)² + c" },
];

const COLOR_SCHEMES = [
  { value: "classic", label: "Classique", colors: ["#141e5c", "#3b5bdb", "#a5d8ff"] },
  { value: "inferno", label: "Inferno", colors: ["#990000", "#ff6600", "#ffcc00"] },
  { value: "ocean", label: "Océan", colors: ["#0c2d48", "#2e86ab", "#a5d8ff"] },
  { value: "electric", label: "Électrique", colors: ["#2d1b69", "#7c3aed", "#c4b5fd"] },
  { value: "fire", label: "Feu", colors: ["#7f1d1d", "#ef4444", "#fbbf24"] },
  { value: "rainbow", label: "Arc-en-ciel", colors: ["#ef4444", "#22c55e", "#6366f1"] },
  { value: "grayscale", label: "Niveaux de gris", colors: ["#333", "#888", "#ddd"] },
];

const PRESETS: { label: string; params: Partial<FractalParams> }[] = [
  { label: "Vue d'ensemble", params: { centerX: -0.5, centerY: 0, zoom: 1, type: "mandelbrot" } },
  { label: "Vallée des hippocampes", params: { centerX: -0.75, centerY: 0.1, zoom: 25, type: "mandelbrot", maxIterations: 500 } },
  { label: "Spirale double", params: { centerX: -0.0452, centerY: 0.9868, zoom: 150, type: "mandelbrot", maxIterations: 800 } },
  { label: "Julia spirale", params: { type: "julia", juliaReal: -0.7269, juliaImag: 0.1889, centerX: 0, centerY: 0, zoom: 1, maxIterations: 400 } },
  { label: "Julia dendrite", params: { type: "julia", juliaReal: 0, juliaImag: 1, centerX: 0, centerY: 0, zoom: 1, maxIterations: 300 } },
  { label: "Burning Ship", params: { type: "burningship", centerX: -1.762, centerY: -0.028, zoom: 30, maxIterations: 500 } },
];

export default function ControlPanel({ params, onParamsChange, isOpen, onToggle }: Props) {
  return (
    <>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="absolute top-4 left-4 z-20 bg-black/70 backdrop-blur-sm border border-white/10 text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
        title={isOpen ? "Fermer le panneau" : "Ouvrir le panneau"}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {isOpen ? (
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

      {/* Panel */}
      <div
        className={`absolute top-0 left-0 z-10 h-full w-80 bg-black/80 backdrop-blur-xl border-r border-white/10
          transform transition-transform duration-300 ease-in-out overflow-y-auto
          ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="pt-16 px-5 pb-6 space-y-6">
          {/* Title */}
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">FracVib</h1>
            <p className="text-xs text-white/50 mt-0.5">Explorateur de fractales</p>
          </div>

          {/* Fractal type */}
          <section>
            <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Type de fractale</h2>
            <div className="space-y-1.5">
              {FRACTAL_TYPES.map((ft) => (
                <button
                  key={ft.value}
                  onClick={() => onParamsChange({ type: ft.value })}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                    params.type === ft.value
                      ? "bg-indigo-500/20 border border-indigo-400/40 text-white"
                      : "bg-white/5 border border-transparent text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="font-medium">{ft.label}</span>
                  <span className="block text-[10px] text-white/40 font-mono mt-0.5">{ft.description}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Julia parameters */}
          {params.type === "julia" && (
            <section className="bg-indigo-500/10 border border-indigo-400/20 rounded-lg p-3">
              <h2 className="text-xs font-semibold text-indigo-300/80 uppercase tracking-wider mb-3">
                Constante Julia (c)
              </h2>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-white/60 mb-1">
                    <span>Partie réelle</span>
                    <span className="font-mono">{params.juliaReal.toFixed(4)}</span>
                  </div>
                  <input
                    type="range"
                    min="-2"
                    max="2"
                    step="0.001"
                    value={params.juliaReal}
                    onChange={(e) => onParamsChange({ juliaReal: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-white/60 mb-1">
                    <span>Partie imaginaire</span>
                    <span className="font-mono">{params.juliaImag.toFixed(4)}</span>
                  </div>
                  <input
                    type="range"
                    min="-2"
                    max="2"
                    step="0.001"
                    value={params.juliaImag}
                    onChange={(e) => onParamsChange({ juliaImag: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </div>
            </section>
          )}

          {/* Max iterations */}
          <section>
            <div className="flex justify-between text-xs text-white/60 mb-2">
              <span className="font-semibold uppercase tracking-wider">Itérations max</span>
              <span className="font-mono">{params.maxIterations}</span>
            </div>
            <input
              type="range"
              min="50"
              max="10000"
              step="50"
              value={params.maxIterations}
              onChange={(e) => onParamsChange({ maxIterations: parseInt(e.target.value) })}
              className="w-full"
            />
          </section>

          {/* Color scheme */}
          <section>
            <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Palette de couleurs</h2>
            <div className="grid grid-cols-2 gap-1.5">
              {COLOR_SCHEMES.map((cs) => (
                <button
                  key={cs.value}
                  onClick={() => onParamsChange({ colorScheme: cs.value })}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all ${
                    params.colorScheme === cs.value
                      ? "bg-white/15 border border-white/20 text-white"
                      : "bg-white/5 border border-transparent text-white/60 hover:bg-white/10"
                  }`}
                >
                  <div className="flex gap-0.5 shrink-0">
                    {cs.colors.map((c, i) => (
                      <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                    ))}
                  </div>
                  <span className="truncate">{cs.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Presets */}
          <section>
            <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Préréglages</h2>
            <div className="space-y-1">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => onParamsChange(preset.params)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm bg-white/5 border border-transparent text-white/70 hover:bg-white/10 hover:text-white transition-all"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </section>

          {/* Navigation */}
          <section>
            <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Navigation</h2>
            <div className="flex gap-1.5">
              <button
                onClick={() => onParamsChange({ zoom: params.zoom * 2 })}
                className="flex-1 px-3 py-2 rounded-lg text-sm bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-all border border-transparent"
              >
                Zoom +
              </button>
              <button
                onClick={() => onParamsChange({ zoom: params.zoom / 2 })}
                className="flex-1 px-3 py-2 rounded-lg text-sm bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-all border border-transparent"
              >
                Zoom −
              </button>
              <button
                onClick={() => onParamsChange({ centerX: -0.5, centerY: 0, zoom: 1 })}
                className="px-3 py-2 rounded-lg text-sm bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-all border border-transparent"
                title="Réinitialiser la vue"
              >
                ↺
              </button>
            </div>
          </section>

          {/* Help */}
          <section className="text-[11px] text-white/30 space-y-1 pt-2 border-t border-white/5">
            <p><strong className="text-white/50">Glisser</strong> pour déplacer</p>
            <p><strong className="text-white/50">Molette</strong> pour zoomer</p>
          </section>
        </div>
      </div>
    </>
  );
}
