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
  const dragStart = useRef({ x: 0, y: 0, cx: 0, cy: 0 });

  // Refs for latest values (avoids stale closures in animation loop)
  const paramsRef = useRef(params);
  const onParamsChangeRef = useRef(onParamsChange);
  useEffect(() => {
    paramsRef.current = params;
    onParamsChangeRef.current = onParamsChange;
  });

  // Smooth zoom state
  const zoomAnimRef = useRef<number>(0);
  const targetZoomRef = useRef(params.zoom);
  const currentZoomRef = useRef(params.zoom);
  const zoomCenterRef = useRef({ mx: 0.5, my: 0.5 });

  useFractalRenderer(canvasRef, params);

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

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      if (zoomAnimRef.current) {
        cancelAnimationFrame(zoomAnimRef.current);
        zoomAnimRef.current = 0;
      }
    };
  }, []);

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
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ cursor: isDragging ? "grabbing" : "grab", imageRendering: "pixelated" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-xs text-white/70 px-2.5 py-1.5 rounded-lg font-mono pointer-events-none select-none">
        ({params.centerX.toFixed(6)}, {params.centerY.toFixed(6)}) &middot; zoom{" "}
        {params.zoom < 1000 ? params.zoom.toFixed(1) : params.zoom.toExponential(2)}x
      </div>
    </div>
  );
}
