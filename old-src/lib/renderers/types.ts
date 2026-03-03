import type { FractalParams } from "../fractal-worker";

export type BackendType = "webgpu" | "webgl" | "cpu";

export interface FractalRenderer {
  readonly backend: BackendType;
  init(canvas: HTMLCanvasElement): Promise<void>;
  render(params: FractalParams): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

// Maps used by GPU shaders to convert string types to integer uniforms
export const FRACTAL_TYPE_MAP: Record<string, number> = {
  mandelbrot: 0,
  julia: 1,
  burningship: 2,
};

export const COLOR_SCHEME_MAP: Record<string, number> = {
  classic: 0,
  inferno: 1,
  ocean: 2,
  electric: 3,
  fire: 4,
  rainbow: 5,
  grayscale: 6,
};
