export const computeShaderSource = /* wgsl */ `
struct Params {
  resolution: vec2f,
  center: vec2f,
  zoom: f32,
  max_iter: i32,
  fractal_type: i32,
  color_scheme: i32,
  julia_c: vec2f,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var output_tex: texture_storage_2d<rgba8unorm, write>;

fn hsl_to_rgb(h: f32, s: f32, l: f32) -> vec3f {
  let c = (1.0 - abs(2.0 * l - 1.0)) * s;
  let x = c * (1.0 - abs(h / 60.0 % 2.0 - 1.0));
  let m = l - c / 2.0;
  var rgb: vec3f;
  if (h < 60.0) { rgb = vec3f(c, x, 0.0); }
  else if (h < 120.0) { rgb = vec3f(x, c, 0.0); }
  else if (h < 180.0) { rgb = vec3f(0.0, c, x); }
  else if (h < 240.0) { rgb = vec3f(0.0, x, c); }
  else if (h < 300.0) { rgb = vec3f(x, 0.0, c); }
  else { rgb = vec3f(c, 0.0, x); }
  return rgb + m;
}

fn colorize(t: f32, scheme: i32) -> vec3f {
  if (scheme == 1) { // inferno
    let r = min(1.0, 1.5 * t);
    let g = max(0.0, min(1.0, (t - 0.25) * 2.0));
    let b = max(0.0, min(1.0, (0.5 - abs(t - 0.5)) * 3.0));
    return vec3f(r, g, b);
  } else if (scheme == 2) { // ocean
    return hsl_to_rgb(200.0 + t * 60.0, 0.8, 0.1 + t * 0.6);
  } else if (scheme == 3) { // electric
    return hsl_to_rgb(260.0 + t * 100.0, 0.9, 0.15 + t * 0.65);
  } else if (scheme == 4) { // fire
    let r = min(1.0, t * 3.0);
    let g = max(0.0, min(1.0, (t - 0.33) * 3.0));
    let b = max(0.0, (t - 0.66) * 3.0);
    return vec3f(r, g, b);
  } else if (scheme == 5) { // rainbow
    return hsl_to_rgb(t * 360.0, 0.85, 0.5);
  } else if (scheme == 6) { // grayscale
    return vec3f(t);
  }
  // default: classic
  return hsl_to_rgb(220.0 + t * 140.0, 0.75, 0.08 + t * 0.7);
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let px = gid.x;
  let py = gid.y;
  let w = u32(params.resolution.x);
  let h = u32(params.resolution.y);

  if (px >= w || py >= h) { return; }

  let scale = 4.0 / (params.resolution.x * params.zoom);
  let cx = (f32(px) - params.resolution.x * 0.5) * scale + params.center.x;
  let cy = (f32(py) - params.resolution.y * 0.5) * scale + params.center.y;

  var zx: f32;
  var zy: f32;
  var pcx: f32;
  var pcy: f32;

  if (params.fractal_type == 1) {
    // Julia
    zx = cx; zy = cy;
    pcx = params.julia_c.x; pcy = params.julia_c.y;
  } else {
    // Mandelbrot / Burning Ship
    zx = 0.0; zy = 0.0;
    pcx = cx; pcy = cy;
  }

  var zx2 = zx * zx;
  var zy2 = zy * zy;
  var iter = 0;

  for (var i = 0; i < 10000; i++) {
    if (i >= params.max_iter) { break; }
    if (zx2 + zy2 > 4.0) { break; }

    if (params.fractal_type == 2) {
      zy = abs(2.0 * zx * zy) + pcy;
    } else {
      zy = 2.0 * zx * zy + pcy;
    }
    zx = zx2 - zy2 + pcx;
    zx2 = zx * zx;
    zy2 = zy * zy;
    iter++;
  }

  var color: vec4f;
  if (iter >= params.max_iter) {
    color = vec4f(0.0, 0.0, 0.0, 1.0);
  } else {
    let smooth_iter = f32(iter) + 1.0 - log2(log2(zx2 + zy2));
    let t = (smooth_iter % 64.0) / 64.0;
    let rgb = colorize(t, params.color_scheme);
    color = vec4f(rgb, 1.0);
  }

  textureStore(output_tex, vec2u(px, py), color);
}
`;

export const blitVertexSource = /* wgsl */ `
@vertex
fn main(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4f {
  // Fullscreen triangle
  let x = f32(i32(vid & 1u) * 4 - 1);
  let y = f32(i32(vid & 2u) * 2 - 1);
  return vec4f(x, y, 0.0, 1.0);
}
`;

export const blitFragmentSource = /* wgsl */ `
@group(0) @binding(0) var tex: texture_2d<f32>;
@group(0) @binding(1) var tex_sampler: sampler;

@fragment
fn main(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let dims = vec2f(textureDimensions(tex));
  let uv = pos.xy / dims;
  return textureSample(tex, tex_sampler, uv);
}
`;
