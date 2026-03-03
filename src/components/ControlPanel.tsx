import { useState, useEffect, useRef, useCallback } from "react";
import type { FractalType, RenderMode, FractalParams } from "@/lib/fractal-worker";

interface Props {
  params: FractalParams;
  onParamsChange: (p: Partial<FractalParams>) => void;
}

/* ── NumberInput ──────────────────────────────────────────────────── */

interface NumberInputProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

function NumberInput({ value, onChange, min, max, step, className }: NumberInputProps) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync from props when not focused
  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  const commit = useCallback(() => {
    const parsed = step !== undefined && step % 1 !== 0
      ? parseFloat(text)
      : parseInt(text, 10);
    if (isNaN(parsed)) {
      setText(String(value));
      return;
    }
    let clamped = parsed;
    if (min !== undefined) clamped = Math.max(min, clamped);
    if (max !== undefined) clamped = Math.min(max, clamped);
    onChange(clamped);
    setText(String(clamped));
  }, [text, value, onChange, min, max, step]);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); commit(); }}
      onKeyDown={(e) => { if (e.key === "Enter") { commit(); inputRef.current?.blur(); } }}
      className={className}
    />
  );
}

/* ── Constants ────────────────────────────────────────────────────── */

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

const INPUT_CLASS = "w-full bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-right text-white font-mono text-xs focus:outline-none focus:border-indigo-400/60";
const INPUT_SMALL_CLASS = "w-20 bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-right text-white font-mono text-xs focus:outline-none focus:border-indigo-400/60";

/* ── ControlPanel ─────────────────────────────────────────────────── */

export default function ControlPanel({ params, onParamsChange }: Props) {
  // Derive boundaries from params
  const scale = 4 / (params.width * params.zoom);
  const derivedXMin = params.centerX - (params.width / 2) * scale;
  const derivedXMax = params.centerX + (params.width / 2) * scale;
  const derivedYMin = params.centerY - (params.height / 2) * scale;
  const derivedYMax = params.centerY + (params.height / 2) * scale;

  // Local boundary editing state — only pushed on "Appliquer"
  const [editBounds, setEditBounds] = useState({ xMin: "", xMax: "", yMin: "", yMax: "" });
  const [boundsEdited, setBoundsEdited] = useState(false);
  const prevDerivedRef = useRef({ xMin: 0, xMax: 0, yMin: 0, yMax: 0 });

  // Sync from derived values when not actively editing
  const derived = {
    xMin: parseFloat(derivedXMin.toFixed(10)),
    xMax: parseFloat(derivedXMax.toFixed(10)),
    yMin: parseFloat(derivedYMin.toFixed(10)),
    yMax: parseFloat(derivedYMax.toFixed(10)),
  };
  if (
    !boundsEdited && (
      derived.xMin !== prevDerivedRef.current.xMin ||
      derived.xMax !== prevDerivedRef.current.xMax ||
      derived.yMin !== prevDerivedRef.current.yMin ||
      derived.yMax !== prevDerivedRef.current.yMax
    )
  ) {
    prevDerivedRef.current = derived;
    setEditBounds({
      xMin: String(derived.xMin),
      xMax: String(derived.xMax),
      yMin: String(derived.yMin),
      yMax: String(derived.yMax),
    });
  }

  const updateBound = useCallback((key: keyof typeof editBounds, value: string) => {
    setEditBounds((prev) => ({ ...prev, [key]: value }));
    setBoundsEdited(true);
  }, []);

  const applyBounds = useCallback(() => {
    const xMin = parseFloat(editBounds.xMin);
    const xMax = parseFloat(editBounds.xMax);
    const yMin = parseFloat(editBounds.yMin);
    const yMax = parseFloat(editBounds.yMax);
    if (isNaN(xMin) || isNaN(xMax) || isNaN(yMin) || isNaN(yMax)) return;
    if (xMax <= xMin || yMax <= yMin) return;
    const centerX = (xMin + xMax) / 2;
    const centerY = (yMin + yMax) / 2;
    const zoom = 4 / (xMax - xMin);
    onParamsChange({ centerX, centerY, zoom });
    setBoundsEdited(false);
  }, [editBounds, onParamsChange]);

  const resetBounds = useCallback(() => {
    setBoundsEdited(false);
    setEditBounds({
      xMin: String(derived.xMin),
      xMax: String(derived.xMax),
      yMin: String(derived.yMin),
      yMax: String(derived.yMax),
    });
  }, [derived]);

  return (
    <div className="h-full w-80 bg-black/80 backdrop-blur-xl border-r border-white/10 overflow-y-auto">
      <div className="px-5 py-6 space-y-6">
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

          {/* Boundaries */}
          <section>
            <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Limites</h2>
            <div className="grid grid-cols-2 gap-2">
              {(["xMin", "xMax", "yMin", "yMax"] as const).map((key) => (
                <div key={key}>
                  <label className="text-[10px] text-white/50 block mb-0.5">{key}</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editBounds[key]}
                    onChange={(e) => updateBound(key, e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") applyBounds(); }}
                    className={INPUT_CLASS}
                  />
                </div>
              ))}
            </div>
            {boundsEdited && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={applyBounds}
                  className="flex-1 px-2 py-1 rounded-lg text-xs bg-indigo-500/30 border border-indigo-400/40 text-white hover:bg-indigo-500/50 transition-all"
                >
                  Appliquer
                </button>
                <button
                  onClick={resetBounds}
                  className="px-2 py-1 rounded-lg text-xs bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 transition-all"
                >
                  Annuler
                </button>
              </div>
            )}
            <p className="text-[10px] text-white/30 mt-1">Le zoom est dérivé de l'axe X. L'axe Y s'ajuste au ratio.</p>
          </section>

          {/* Fixed resolution + Binary toggle */}
          <section>
            <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Résolution fixe</h2>
            <div className="flex items-center gap-4 mb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={params.fixedResolution}
                  onChange={(e) => onParamsChange({ fixedResolution: e.target.checked })}
                  className="accent-indigo-500"
                />
                <span className="text-xs text-white/70">Activer</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer" title="Mode binaire (noir/blanc)">
                <input
                  type="checkbox"
                  checked={params.binaryColor}
                  onChange={(e) => onParamsChange({ binaryColor: e.target.checked })}
                  className="accent-indigo-500"
                />
                <span className="text-xs text-white/70">Binaire</span>
              </label>
            </div>
            {params.fixedResolution && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-white/50 block mb-0.5">Largeur</label>
                  <NumberInput
                    value={params.fixedWidth}
                    onChange={(v) => onParamsChange({ fixedWidth: v })}
                    min={8}
                    max={4096}
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-white/50 block mb-0.5">Hauteur</label>
                  <NumberInput
                    value={params.fixedHeight}
                    onChange={(v) => onParamsChange({ fixedHeight: v })}
                    min={8}
                    max={4096}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
            )}
          </section>

          {/* Render mode */}
          <section className={params.fixedResolution ? "opacity-40 pointer-events-none" : ""}>
            <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
              Rendu
              {params.fixedResolution && <span className="text-[10px] normal-case tracking-normal font-normal ml-1">(fixe = CPU)</span>}
            </h2>
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
                    (params.fixedResolution ? opt.value === "cpu" : params.renderMode === opt.value)
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
          <section className={params.fixedResolution ? "opacity-40 pointer-events-none" : ""}>
            <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
              Résolution CPU
              {params.fixedResolution && <span className="text-[10px] normal-case tracking-normal font-normal ml-1">(fixe = pleine)</span>}
            </h2>
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
                    (params.fixedResolution ? opt.value === 1 : params.cpuResolution === opt.value)
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
              <NumberInput
                value={params.maxIterations}
                onChange={(v) => onParamsChange({ maxIterations: v })}
                min={1}
                max={100000}
                className={INPUT_SMALL_CLASS}
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
            <div className="flex gap-1 mt-1.5">
              {[-5, -1, 1, 5].map((delta) => (
                <button
                  key={delta}
                  onClick={() => onParamsChange({ maxIterations: Math.max(1, params.maxIterations + delta) })}
                  className="flex-1 px-1 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10 text-white/60 hover:bg-white/15 hover:text-white transition-all"
                >
                  {delta > 0 ? `+${delta}` : delta}
                </button>
              ))}
            </div>
          </section>

          {/* Color scheme */}
          <section>
            <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Palette de couleurs</h2>
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
  );
}
