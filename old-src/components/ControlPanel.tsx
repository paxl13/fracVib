"use client";

import type { FractalType, RenderMode, FractalParams } from "@/lib/fractal-worker";

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

          {/* Zoom */}
          <section>
            <div className="flex justify-between text-xs text-white/60 mb-1">
              <span className="font-semibold uppercase tracking-wider">Zoom</span>
              <span className="font-mono">
                {params.zoom < 1000
                  ? params.zoom.toFixed(1)
                  : Math.round(params.zoom).toLocaleString()}x
              </span>
            </div>
          </section>

          {/* Fixed resolution */}
          <section>
            <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Résolution fixe</h2>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={params.fixedResolution}
                onChange={(e) => onParamsChange({ fixedResolution: e.target.checked })}
                className="accent-indigo-500"
              />
              <span className="text-xs text-white/70">Activer</span>
            </label>
            {params.fixedResolution && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-white/50 block mb-0.5">Largeur</label>
                  <input
                    type="number"
                    min="8"
                    max="4096"
                    value={params.fixedWidth}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (!isNaN(v) && v >= 8) onParamsChange({ fixedWidth: v });
                    }}
                    className="w-full bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-right text-white font-mono text-xs focus:outline-none focus:border-indigo-400/60"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-white/50 block mb-0.5">Hauteur</label>
                  <input
                    type="number"
                    min="8"
                    max="4096"
                    value={params.fixedHeight}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (!isNaN(v) && v >= 8) onParamsChange({ fixedHeight: v });
                    }}
                    className="w-full bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-right text-white font-mono text-xs focus:outline-none focus:border-indigo-400/60"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Render mode */}
          <section>
            <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Rendu</h2>
            <div className="flex gap-1.5">
              {([
                { value: "auto", label: "Auto" },
                { value: "gpu", label: "GPU" },
                { value: "cpu", label: "CPU" },
              ] as { value: RenderMode; label: string }[]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onParamsChange({ renderMode: opt.value })}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs transition-all ${
                    params.renderMode === opt.value
                      ? "bg-white/15 border border-white/20 text-white"
                      : "bg-white/5 border border-transparent text-white/60 hover:bg-white/10"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          {/* CPU Resolution */}
          <section>
            <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Résolution CPU</h2>
            <div className="flex gap-1.5">
              {([
                { value: 1, label: "Pleine", desc: "1x" },
                { value: 0.5, label: "Demi", desc: "½x" },
                { value: 0.25, label: "Quart", desc: "¼x" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onParamsChange({ cpuResolution: opt.value })}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs transition-all ${
                    params.cpuResolution === opt.value
                      ? "bg-white/15 border border-white/20 text-white"
                      : "bg-white/5 border border-transparent text-white/60 hover:bg-white/10"
                  }`}
                >
                  <span className="block font-medium">{opt.label}</span>
                  <span className="block text-[10px] text-white/40">{opt.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Max iterations */}
          <section>
            <div className="flex justify-between items-center text-xs text-white/60 mb-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold uppercase tracking-wider">Itérations max</span>
                <label className="flex items-center gap-1 cursor-pointer" title="Verrouiller N (empêche l'auto-ajustement)">
                  <input
                    type="checkbox"
                    checked={params.lockIterations}
                    onChange={(e) => onParamsChange({ lockIterations: e.target.checked })}
                    className="accent-indigo-500"
                  />
                  <span className="text-[10px] text-white/40">Verrouiller</span>
                </label>
              </div>
              <input
                type="number"
                min="1"
                max="100000"
                value={params.maxIterations}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v) && v >= 1) onParamsChange({ maxIterations: v });
                }}
                className="w-20 bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-right text-white font-mono text-xs focus:outline-none focus:border-indigo-400/60"
              />
            </div>
            <input
              type="range"
              min="1"
              max="10000"
              step="1"
              value={Math.min(params.maxIterations, 10000)}
              onChange={(e) => onParamsChange({ maxIterations: parseInt(e.target.value) })}
              className="w-full"
            />
          </section>

          {/* Color scheme */}
          <section>
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Palette de couleurs</h2>
              <label className="flex items-center gap-1 cursor-pointer" title="Mode binaire (noir/blanc)">
                <input
                  type="checkbox"
                  checked={params.binaryColor}
                  onChange={(e) => onParamsChange({ binaryColor: e.target.checked })}
                  className="accent-indigo-500"
                />
                <span className="text-[10px] text-white/40">Binaire</span>
              </label>
            </div>
            <div className={`grid grid-cols-2 gap-1.5 ${params.binaryColor ? "opacity-40 pointer-events-none" : ""}`}>
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
