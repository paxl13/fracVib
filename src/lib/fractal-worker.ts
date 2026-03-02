export type FractalType = "mandelbrot" | "julia" | "burningship";

export type RenderMode = "auto" | "gpu" | "cpu";

export interface FractalParams {
  type: FractalType;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  zoom: number;
  maxIterations: number;
  juliaReal: number;
  juliaImag: number;
  colorScheme: string;
  cpuResolution: number;
  renderMode: RenderMode;
  fixedResolution: boolean;
  fixedWidth: number;
  fixedHeight: number;
  lockIterations: boolean;
  binaryColor: boolean;
}

export interface WorkerMessage {
  params: FractalParams;
  startRow: number;
  endRow: number;
  renderId: number;
}

export interface WorkerResult {
  imageData: Uint8ClampedArray;
  startRow: number;
  endRow: number;
  renderId: number;
}

function computeMandelbrot(cx: number, cy: number, maxIter: number): number {
  let zx = 0, zy = 0;
  let zx2 = 0, zy2 = 0;
  let i = 0;
  while (i < maxIter && zx2 + zy2 <= 4) {
    zy = 2 * zx * zy + cy;
    zx = zx2 - zy2 + cx;
    zx2 = zx * zx;
    zy2 = zy * zy;
    i++;
  }
  if (i === maxIter) return -1;
  // Smooth coloring
  return i + 1 - Math.log2(Math.log2(zx2 + zy2));
}

function computeJulia(px: number, py: number, cr: number, ci: number, maxIter: number): number {
  let zx = px, zy = py;
  let zx2 = zx * zx, zy2 = zy * zy;
  let i = 0;
  while (i < maxIter && zx2 + zy2 <= 4) {
    zy = 2 * zx * zy + ci;
    zx = zx2 - zy2 + cr;
    zx2 = zx * zx;
    zy2 = zy * zy;
    i++;
  }
  if (i === maxIter) return -1;
  return i + 1 - Math.log2(Math.log2(zx2 + zy2));
}

function computeBurningShip(cx: number, cy: number, maxIter: number): number {
  let zx = 0, zy = 0;
  let zx2 = 0, zy2 = 0;
  let i = 0;
  while (i < maxIter && zx2 + zy2 <= 4) {
    zy = Math.abs(2 * zx * zy) + cy;
    zx = zx2 - zy2 + cx;
    zx2 = zx * zx;
    zy2 = zy * zy;
    i++;
  }
  if (i === maxIter) return -1;
  return i + 1 - Math.log2(Math.log2(zx2 + zy2));
}

type ColorFn = (t: number) => [number, number, number];

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function getColorFunction(scheme: string): ColorFn {
  switch (scheme) {
    case "inferno":
      return (t: number) => {
        const r = Math.floor(255 * Math.min(1, 1.5 * t));
        const g = Math.floor(255 * Math.max(0, Math.min(1, (t - 0.25) * 2)));
        const b = Math.floor(255 * Math.max(0, Math.min(1, (0.5 - Math.abs(t - 0.5)) * 3)));
        return [r, g, b];
      };
    case "ocean":
      return (t: number) => {
        return hslToRgb(200 + t * 60, 0.8, 0.1 + t * 0.6);
      };
    case "electric":
      return (t: number) => {
        return hslToRgb(260 + t * 100, 0.9, 0.15 + t * 0.65);
      };
    case "fire":
      return (t: number) => {
        const r = Math.floor(255 * Math.min(1, t * 3));
        const g = Math.floor(255 * Math.max(0, Math.min(1, (t - 0.33) * 3)));
        const b = Math.floor(255 * Math.max(0, (t - 0.66) * 3));
        return [r, g, b];
      };
    case "rainbow":
      return (t: number) => {
        return hslToRgb(t * 360, 0.85, 0.5);
      };
    case "grayscale":
      return (t: number) => {
        const v = Math.floor(255 * t);
        return [v, v, v];
      };
    default: // "classic"
      return (t: number) => {
        return hslToRgb(220 + t * 140, 0.75, 0.08 + t * 0.7);
      };
  }
}

self.onmessage = function (e: MessageEvent<WorkerMessage>) {
  const { params, startRow, endRow, renderId } = e.data;
  const { type, width, height, centerX, centerY, zoom, maxIterations, juliaReal, juliaImag, colorScheme, binaryColor } = params;

  const rowCount = endRow - startRow;
  const data = new Uint8ClampedArray(width * rowCount * 4);
  const colorFn = binaryColor ? null : getColorFunction(colorScheme);
  const scale = 4 / (width * zoom);

  for (let py = startRow; py < endRow; py++) {
    for (let px = 0; px < width; px++) {
      const x = (px - width / 2) * scale + centerX;
      const y = (py - height / 2) * scale + centerY;

      let smoothIter: number;
      switch (type) {
        case "mandelbrot":
          smoothIter = computeMandelbrot(x, y, maxIterations);
          break;
        case "julia":
          smoothIter = computeJulia(x, y, juliaReal, juliaImag, maxIterations);
          break;
        case "burningship":
          smoothIter = computeBurningShip(x, y, maxIterations);
          break;
      }

      const idx = ((py - startRow) * width + px) * 4;
      if (binaryColor) {
        const v = smoothIter < 0 ? 0 : 255;
        data[idx] = v;
        data[idx + 1] = v;
        data[idx + 2] = v;
        data[idx + 3] = 255;
      } else if (smoothIter < 0) {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 255;
      } else {
        const t = (smoothIter % 64) / 64;
        const [r, g, b] = colorFn!(t);
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
  }

  const result: WorkerResult = { imageData: data, startRow, endRow, renderId };
  (self as unknown as Worker).postMessage(result, [data.buffer]);
};
