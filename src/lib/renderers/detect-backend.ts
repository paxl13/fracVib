import type { BackendType } from "./types";

export async function detectBestBackend(): Promise<BackendType> {
  // Try WebGPU first
  if (typeof navigator !== "undefined" && "gpu" in navigator) {
    try {
      const adapter = await (navigator as Navigator & { gpu: GPU }).gpu.requestAdapter();
      if (adapter) {
        const device = await adapter.requestDevice();
        device.destroy();
        return "webgpu";
      }
    } catch {
      // WebGPU not available, fall through
    }
  }

  // Try WebGL2
  if (typeof document !== "undefined") {
    const testCanvas = document.createElement("canvas");
    const gl = testCanvas.getContext("webgl2");
    if (gl) {
      const ext = gl.getExtension("WEBGL_lose_context");
      if (ext) ext.loseContext();
      return "webgl";
    }
  }

  // Fallback to CPU workers
  return "cpu";
}
