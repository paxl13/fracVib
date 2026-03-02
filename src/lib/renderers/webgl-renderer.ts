import type { FractalParams } from "../fractal-worker";
import type { FractalRenderer } from "./types";
import { FRACTAL_TYPE_MAP, COLOR_SCHEME_MAP } from "./types";
import { vertexShaderSource, fragmentShaderSource } from "../shaders/fractal.glsl";

export class WebGLRenderer implements FractalRenderer {
  readonly backend = "webgl" as const;

  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private uniforms: Record<string, WebGLUniformLocation> = {};

  async init(canvas: HTMLCanvasElement): Promise<void> {
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error("WebGL2 not available");

    this.gl = gl;

    const vs = this.compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error("Shader link error: " + log);
    }

    gl.deleteShader(vs);
    gl.deleteShader(fs);

    this.program = program;
    gl.useProgram(program);

    // Cache uniform locations
    const names = [
      "u_resolution",
      "u_center",
      "u_zoom",
      "u_maxIter",
      "u_fractalType",
      "u_juliaC",
      "u_colorScheme",
    ];
    for (const name of names) {
      const loc = gl.getUniformLocation(program, name);
      if (loc) this.uniforms[name] = loc;
    }
  }

  render(params: FractalParams): void {
    const gl = this.gl;
    if (!gl || !this.program) return;

    const { width, height } = params;
    const canvas = gl.canvas as HTMLCanvasElement;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    gl.viewport(0, 0, width, height);
    gl.useProgram(this.program);

    gl.uniform2f(this.uniforms.u_resolution, width, height);
    gl.uniform2f(this.uniforms.u_center, params.centerX, params.centerY);
    gl.uniform1f(this.uniforms.u_zoom, params.zoom);
    gl.uniform1i(this.uniforms.u_maxIter, params.maxIterations);
    gl.uniform1i(
      this.uniforms.u_fractalType,
      FRACTAL_TYPE_MAP[params.type] ?? 0
    );
    gl.uniform2f(this.uniforms.u_juliaC, params.juliaReal, params.juliaImag);
    gl.uniform1i(
      this.uniforms.u_colorScheme,
      COLOR_SCHEME_MAP[params.colorScheme] ?? 0
    );

    // Draw fullscreen triangle (3 vertices, no buffer)
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  resize(width: number, height: number): void {
    if (!this.gl) return;
    const canvas = this.gl.canvas as HTMLCanvasElement;
    canvas.width = width;
    canvas.height = height;
  }

  dispose(): void {
    if (this.gl && this.program) {
      this.gl.deleteProgram(this.program);
    }
    this.program = null;
    this.gl = null;
    this.uniforms = {};
  }

  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl!;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error("Shader compile error: " + log);
    }
    return shader;
  }
}
