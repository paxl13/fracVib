import type { FractalParams } from "../fractal-worker";
import type { FractalRenderer } from "./types";
import { FRACTAL_TYPE_MAP, COLOR_SCHEME_MAP } from "./types";
import {
  computeShaderSource,
  blitVertexSource,
  blitFragmentSource,
} from "../shaders/fractal.wgsl";

// Uniform buffer layout (std140 aligned):
// offset 0:  resolution  vec2f  (8 bytes)
// offset 8:  center      vec2f  (8 bytes)
// offset 16: zoom        f32    (4 bytes)
// offset 20: max_iter    i32    (4 bytes)
// offset 24: fractal_type i32   (4 bytes)
// offset 28: color_scheme i32   (4 bytes)
// offset 32: julia_c     vec2f  (8 bytes)
// total: 40 bytes → pad to 48 (multiple of 16)
const UNIFORM_SIZE = 48;

export class WebGPURenderer implements FractalRenderer {
  readonly backend = "webgpu" as const;

  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private computePipeline: GPUComputePipeline | null = null;
  private renderPipeline: GPURenderPipeline | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private sampler: GPUSampler | null = null;
  private storageTex: GPUTexture | null = null;
  private computeBindGroup: GPUBindGroup | null = null;
  private blitBindGroup: GPUBindGroup | null = null;
  private texWidth = 0;
  private texHeight = 0;
  private canvasFormat: GPUTextureFormat = "bgra8unorm";

  async init(canvas: HTMLCanvasElement): Promise<void> {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("No WebGPU adapter");
    const device = await adapter.requestDevice();
    this.device = device;

    const context = canvas.getContext("webgpu");
    if (!context) throw new Error("Cannot get WebGPU context");
    this.context = context;

    this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device,
      format: this.canvasFormat,
      alphaMode: "opaque",
    });

    // Compute pipeline
    const computeModule = device.createShaderModule({ code: computeShaderSource });
    this.computePipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module: computeModule, entryPoint: "main" },
    });

    // Render (blit) pipeline
    const vertModule = device.createShaderModule({ code: blitVertexSource });
    const fragModule = device.createShaderModule({ code: blitFragmentSource });
    this.renderPipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: { module: vertModule, entryPoint: "main" },
      fragment: {
        module: fragModule,
        entryPoint: "main",
        targets: [{ format: this.canvasFormat }],
      },
      primitive: { topology: "triangle-list" },
    });

    // Uniform buffer
    this.uniformBuffer = device.createBuffer({
      size: UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Sampler
    this.sampler = device.createSampler({
      magFilter: "nearest",
      minFilter: "nearest",
    });
  }

  render(params: FractalParams): void {
    const device = this.device;
    const context = this.context;
    if (!device || !context || !this.computePipeline || !this.renderPipeline || !this.uniformBuffer) return;

    const { width, height } = params;
    const canvas = context.canvas as HTMLCanvasElement;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      context.configure({
        device,
        format: this.canvasFormat,
        alphaMode: "opaque",
      });
    }

    // Recreate storage texture if size changed
    if (width !== this.texWidth || height !== this.texHeight) {
      this.rebuildTextures(width, height);
    }

    // Write uniforms
    const data = new ArrayBuffer(UNIFORM_SIZE);
    const f32 = new Float32Array(data);
    const i32 = new Int32Array(data);
    f32[0] = width;                                // resolution.x
    f32[1] = height;                               // resolution.y
    f32[2] = params.centerX;                       // center.x
    f32[3] = params.centerY;                       // center.y
    f32[4] = params.zoom;                          // zoom
    i32[5] = params.maxIterations;                 // max_iter
    i32[6] = FRACTAL_TYPE_MAP[params.type] ?? 0;   // fractal_type
    i32[7] = COLOR_SCHEME_MAP[params.colorScheme] ?? 0; // color_scheme
    f32[8] = params.juliaReal;                     // julia_c.x
    f32[9] = params.juliaImag;                     // julia_c.y
    device.queue.writeBuffer(this.uniformBuffer, 0, data);

    const encoder = device.createCommandEncoder();

    // Compute pass
    const computePass = encoder.beginComputePass();
    computePass.setPipeline(this.computePipeline);
    computePass.setBindGroup(0, this.computeBindGroup!);
    computePass.dispatchWorkgroups(
      Math.ceil(width / 16),
      Math.ceil(height / 16)
    );
    computePass.end();

    // Render (blit) pass
    const textureView = context.getCurrentTexture().createView();
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          loadOp: "clear" as GPULoadOp,
          storeOp: "store" as GPUStoreOp,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
        },
      ],
    });
    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, this.blitBindGroup!);
    renderPass.draw(3);
    renderPass.end();

    device.queue.submit([encoder.finish()]);
  }

  resize(width: number, height: number): void {
    if (!this.device || !this.context) return;
    const canvas = this.context.canvas as HTMLCanvasElement;
    canvas.width = width;
    canvas.height = height;
  }

  dispose(): void {
    this.storageTex?.destroy();
    this.uniformBuffer?.destroy();
    this.device?.destroy();
    this.device = null;
    this.context = null;
    this.computePipeline = null;
    this.renderPipeline = null;
    this.uniformBuffer = null;
    this.storageTex = null;
    this.computeBindGroup = null;
    this.blitBindGroup = null;
  }

  private rebuildTextures(width: number, height: number) {
    const device = this.device!;
    this.storageTex?.destroy();

    this.storageTex = device.createTexture({
      size: [width, height],
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.TEXTURE_BINDING,
    });

    this.texWidth = width;
    this.texHeight = height;

    // Rebuild compute bind group
    this.computeBindGroup = device.createBindGroup({
      layout: this.computePipeline!.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer! } },
        { binding: 1, resource: this.storageTex.createView() },
      ],
    });

    // Rebuild blit bind group
    this.blitBindGroup = device.createBindGroup({
      layout: this.renderPipeline!.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.storageTex.createView() },
        { binding: 1, resource: this.sampler! },
      ],
    });
  }
}
