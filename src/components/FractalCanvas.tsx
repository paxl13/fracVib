"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFractalRenderer } from "@/lib/use-fractal-renderer";
import type { FractalParams } from "@/lib/fractal-worker";

interface Props {
  params: FractalParams;
  onParamsChange: (p: Partial<FractalParams>) => void;
}

export default function FractalCanvas({ params, onParamsChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [autoZoom, setAutoZoom] = useState(false);
  const [zoomRate, setZoomRate] = useState(1.5); // multiplier per second
  const autoZoomRef = useRef(false);
  const zoomRateRef = useRef(1.5);
  const dragStart = useRef({ x: 0, y: 0, cx: 0, cy: 0 });

  // Refs for latest values (avoids stale closures in animation loop)
  const paramsRef = useRef(params);
  const onParamsChangeRef = useRef(onParamsChange);
  useEffect(() => {
    paramsRef.current = params;
    onParamsChangeRef.current = onParamsChange;
    autoZoomRef.current = autoZoom;
    zoomRateRef.current = zoomRate;
  });

  // Smooth zoom state
  const zoomAnimRef = useRef<number>(0);
  const targetZoomRef = useRef(params.zoom);
  const currentZoomRef = useRef(params.zoom);
  const zoomCenterRef = useRef({ mx: 0.5, my: 0.5 });

  const { activeBackend, isRendering } = useFractalRenderer(canvasRef, params);

  // Compute complex plane bounds
  const scale = 4 / (params.width * params.zoom);
  const xMin = params.centerX - (params.width / 2) * scale;
  const xMax = params.centerX + (params.width / 2) * scale;
  const yMin = params.centerY - (params.height / 2) * scale;
  const yMax = params.centerY + (params.height / 2) * scale;

  // Sync zoom refs when zoom changes externally (e.g. from panel buttons)
  useEffect(() => {
    currentZoomRef.current = params.zoom;
    targetZoomRef.current = params.zoom;
  }, [params.zoom]);

  // Resize canvas to fill container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const dpr = window.devicePixelRatio || 1;
      const w = Math.floor(width * dpr);
      const h = Math.floor(height * dpr);
      if (w > 0 && h > 0) {
        onParamsChangeRef.current({ width: w, height: h });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Zoom animation loop (reads from refs, no stale closure issues)
  useEffect(() => {
    function tick() {
      const p = paramsRef.current;
      const current = currentZoomRef.current;
      const target = targetZoomRef.current;
      const ratio = target / current;

      if (Math.abs(ratio - 1) < 0.002) {
        if (current !== target) {
          currentZoomRef.current = target;
          const { mx, my } = zoomCenterRef.current;
          const scale = 4 / (p.width * current);
          const worldX = (mx * p.width - p.width / 2) * scale + p.centerX;
          const worldY = (my * p.height - p.height / 2) * scale + p.centerY;
          const newScale = 4 / (p.width * target);
          onParamsChangeRef.current({
            zoom: target,
            centerX: worldX - (mx * p.width - p.width / 2) * newScale,
            centerY: worldY - (my * p.height - p.height / 2) * newScale,
          });
        }
        zoomAnimRef.current = 0;
        return;
      }

      const lerp = 0.18;
      const newZoom = current * Math.pow(ratio, lerp);
      currentZoomRef.current = newZoom;

      const { mx, my } = zoomCenterRef.current;
      const scale = 4 / (p.width * current);
      const worldX = (mx * p.width - p.width / 2) * scale + p.centerX;
      const worldY = (my * p.height - p.height / 2) * scale + p.centerY;
      const newScale = 4 / (p.width * newZoom);

      onParamsChangeRef.current({
        zoom: newZoom,
        centerX: worldX - (mx * p.width - p.width / 2) * newScale,
        centerY: worldY - (my * p.height - p.height / 2) * newScale,
      });

      zoomAnimRef.current = requestAnimationFrame(tick);
    }

    // Attach wheel listener
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoomCenterRef.current = {
        mx: (e.clientX - rect.left) / rect.width,
        my: (e.clientY - rect.top) / rect.height,
      };
      const factor = Math.pow(1.001, -e.deltaY);
      targetZoomRef.current *= factor;

      if (!zoomAnimRef.current) {
        zoomAnimRef.current = requestAnimationFrame(tick);
      }
    };

    const handleDblClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      zoomCenterRef.current = {
        mx: (e.clientX - rect.left) / rect.width,
        my: (e.clientY - rect.top) / rect.height,
      };
      targetZoomRef.current *= 3;

      if (!zoomAnimRef.current) {
        zoomAnimRef.current = requestAnimationFrame(tick);
      }
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("dblclick", handleDblClick);
    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("dblclick", handleDblClick);
      if (zoomAnimRef.current) {
        cancelAnimationFrame(zoomAnimRef.current);
        zoomAnimRef.current = 0;
      }
    };
  }, []);

  // Continuous auto-zoom loop
  useEffect(() => {
    if (!autoZoom) return;
    let lastTime = performance.now();
    let rafId = 0;

    function autoTick(now: number) {
      if (!autoZoomRef.current) return;
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      const p = paramsRef.current;
      const factor = Math.pow(zoomRateRef.current, dt);
      onParamsChangeRef.current({ zoom: p.zoom * factor });
      rafId = requestAnimationFrame(autoTick);
    }

    rafId = requestAnimationFrame(autoTick);
    return () => cancelAnimationFrame(rafId);
  }, [autoZoom]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        cx: params.centerX,
        cy: params.centerY,
      };
    },
    [params.centerX, params.centerY]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = params.width / rect.width;
      const scaleY = params.height / rect.height;
      const dx = (e.clientX - dragStart.current.x) * scaleX;
      const dy = (e.clientY - dragStart.current.y) * scaleY;

      const pixelScale = 4 / (params.width * params.zoom);
      onParamsChange({
        centerX: dragStart.current.cx - dx * pixelScale,
        centerY: dragStart.current.cy - dy * pixelScale,
      });
    },
    [isDragging, params.width, params.height, params.zoom, onParamsChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch support
  const touchRef = useRef<{ x: number; y: number; cx: number; cy: number; dist: number; zoom: number } | null>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        touchRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          cx: params.centerX,
          cy: params.centerY,
          dist: 0,
          zoom: params.zoom,
        };
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchRef.current = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
          cx: params.centerX,
          cy: params.centerY,
          dist: Math.hypot(dx, dy),
          zoom: params.zoom,
        };
      }
    },
    [params.centerX, params.centerY, params.zoom]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      if (!touchRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (e.touches.length === 1) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = params.width / rect.width;
        const scaleY = params.height / rect.height;
        const dx = (e.touches[0].clientX - touchRef.current.x) * scaleX;
        const dy = (e.touches[0].clientY - touchRef.current.y) * scaleY;
        const pixelScale = 4 / (params.width * params.zoom);
        onParamsChange({
          centerX: touchRef.current.cx - dx * pixelScale,
          centerY: touchRef.current.cy - dy * pixelScale,
        });
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const factor = dist / touchRef.current.dist;
        onParamsChange({ zoom: touchRef.current.zoom * factor });
      }
    },
    [params.width, params.height, params.zoom, onParamsChange]
  );

  const handleTouchEnd = useCallback(() => {
    touchRef.current = null;
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative group"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => { setIsHovering(false); handleMouseUp(); }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ cursor: isDragging ? "grabbing" : "grab", imageRendering: "pixelated" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* Center crosshair — visible on hover */}
      {isHovering && (
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-white/60 ring-1 ring-black/40" />
        </div>
      )}

      {/* Bottom-right: controls + HUD stacked vertically */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col items-end gap-2">
        {/* On-canvas zoom controls */}
        <div className="flex flex-col items-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {autoZoom && (
            <div className="flex flex-col items-center bg-black/50 backdrop-blur-sm rounded-lg px-1.5 py-2 gap-1">
              <input
                type="range"
                min="1.1"
                max="5"
                step="0.1"
                value={zoomRate}
                onChange={(e) => setZoomRate(parseFloat(e.target.value))}
                className="w-20 accent-indigo-400"
                style={{ writingMode: "vertical-lr", direction: "rtl", height: 80 }}
              />
              <span className="text-[10px] text-white/50 font-mono">{zoomRate.toFixed(1)}x/s</span>
            </div>
          )}
          <button
            onClick={() => onParamsChange({ zoom: params.zoom * 2 })}
            className="w-9 h-9 rounded-lg bg-black/50 backdrop-blur-sm text-white/80 hover:bg-white/20 flex items-center justify-center text-lg font-mono select-none"
            title="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => onParamsChange({ zoom: params.zoom / 2 })}
            className="w-9 h-9 rounded-lg bg-black/50 backdrop-blur-sm text-white/80 hover:bg-white/20 flex items-center justify-center text-lg font-mono select-none"
            title="Zoom out"
          >
            &minus;
          </button>
          <button
            onClick={() => setAutoZoom((v) => !v)}
            className={`w-9 h-9 rounded-lg backdrop-blur-sm flex items-center justify-center text-lg select-none ${
              autoZoom
                ? "bg-indigo-500/70 text-white hover:bg-indigo-400/70"
                : "bg-black/50 text-white/80 hover:bg-white/20"
            }`}
            title={autoZoom ? "Stop auto-zoom" : "Start continuous zoom"}
          >
            {autoZoom ? "\u25A0" : "\u25B6"}
          </button>
        </div>

        {/* HUD */}
        <div className="bg-black/60 backdrop-blur-sm text-xs text-white/70 px-2.5 py-1.5 rounded-lg font-mono pointer-events-none select-none leading-relaxed text-right">
          <span className="text-white/50">{activeBackend ? activeBackend.toUpperCase() : "..."}</span>
          {isRendering && (
            <span className="inline-block w-1.5 h-1.5 ml-1 rounded-full bg-amber-400 animate-pulse align-middle" />
          )}
          {" "}&middot;{" "}
          ({params.centerX.toFixed(6)}, {params.centerY.toFixed(6)}) &middot; zoom{" "}
          {params.zoom < 1000
            ? params.zoom.toFixed(1)
            : Math.round(params.zoom).toLocaleString()}x
          <br />
          <span className="text-white/40">
            x:[{xMin.toFixed(4)}, {xMax.toFixed(4)}] y:[{yMin.toFixed(4)}, {yMax.toFixed(4)}]
          </span>
        </div>
      </div>
    </div>
  );
}
