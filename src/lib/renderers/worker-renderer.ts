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
  canvasEl: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private renderId = 0;
  private pending = 0;
  private busy = false;
  private queuedParams: FractalParams | null = null;
  onComplete: (() => void) | null = null;

  async init(canvas: HTMLCanvasElement): Promise<void> {
    this.canvasEl = canvas;
    this.ctx = canvas.getContext("2d");
    const count = getWorkerCount();
    for (let i = 0; i < count; i++) {
      const worker = new Worker(
        new URL("../fractal-worker.ts", import.meta.url),
        { type: "module" }
      );
      // Set handler once — uses echoed renderId to ignore stale results
      worker.onmessage = (e: MessageEvent<WorkerResult>) => {
        this.handleResult(e.data);
      };
      this.workers.push(worker);
    }
  }

  private handleResult(data: WorkerResult): void {
    const ctx = this.ctx;
    if (!ctx) return;

    // Ignore results from old renders
    if (data.renderId !== this.renderId) return;

    const { imageData, startRow: sr, endRow: er } = data;
    const rows = er - sr;
    const width = this.canvasEl?.width ?? 0;
    if (rows <= 0 || imageData.length !== width * rows * 4) return;

    const imgData = new ImageData(
      new Uint8ClampedArray(imageData),
      width,
      rows
    );
    ctx.putImageData(imgData, 0, sr);

    this.pending--;
    if (this.pending === 0) {
      this.busy = false;
      if (this.onComplete) this.onComplete();

      // If params were queued while busy, render them now
      if (this.queuedParams) {
        const next = this.queuedParams;
        this.queuedParams = null;
        this.startRender(next);
      }
    }
  }

  render(params: FractalParams): void {
    if (this.busy) {
      // Already rendering — queue the latest params
      this.queuedParams = params;
      return;
    }
    this.startRender(params);
  }

  private startRender(params: FractalParams): void {
    const canvas = this.canvasEl;
    const ctx = this.ctx;
    if (!canvas || !ctx) return;
    if (this.workers.length === 0) return;

    const renderId = ++this.renderId;
    const { width, height } = params;

    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    this.busy = true;
    this.pending = 0;

    const rowsPerWorker = Math.ceil(height / this.workers.length);

    this.workers.forEach((worker, i) => {
      const startRow = i * rowsPerWorker;
      const endRow = Math.min(startRow + rowsPerWorker, height);
      if (startRow >= endRow) return;
      this.pending++;

      const msg: WorkerMessage = { params, startRow, endRow, renderId };
      worker.postMessage(msg);
    });
  }

  resize(_width: number, _height: number): void {
    // Canvas size is set in render()
  }

  dispose(): void {
    this.workers.forEach((w) => w.terminate());
    this.workers = [];
    this.canvasEl = null;
    this.ctx = null;
  }
}
