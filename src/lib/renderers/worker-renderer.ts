import type { FractalParams, WorkerMessage, WorkerResult } from "../fractal-worker";
import type { FractalRenderer } from "./types";

function getWorkerCount() {
  if (typeof navigator !== "undefined" && navigator.hardwareConcurrency) {
    return Math.min(navigator.hardwareConcurrency, 16);
  }
  return 4;
}

export class WorkerRenderer implements FractalRenderer {
  readonly backend = "cpu" as const;

  private workers: Worker[] = [];
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private renderId = 0;

  async init(canvas: HTMLCanvasElement): Promise<void> {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    const count = getWorkerCount();
    for (let i = 0; i < count; i++) {
      const worker = new Worker(
        new URL("../fractal-worker.ts", import.meta.url),
        { type: "module" }
      );
      this.workers.push(worker);
    }
  }

  render(params: FractalParams): void {
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!canvas || !ctx) return;
    if (this.workers.length === 0) return;

    const renderId = ++this.renderId;
    const { width, height } = params;

    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const rowsPerWorker = Math.ceil(height / this.workers.length);

    this.workers.forEach((worker, i) => {
      const startRow = i * rowsPerWorker;
      const endRow = Math.min(startRow + rowsPerWorker, height);
      if (startRow >= endRow) return;

      worker.onmessage = (e: MessageEvent<WorkerResult>) => {
        if (this.renderId !== renderId) return;
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
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  resize(width: number, height: number): void {
    // Canvas size is set in render()
  }

  dispose(): void {
    this.workers.forEach((w) => w.terminate());
    this.workers = [];
    this.canvas = null;
    this.ctx = null;
  }
}
