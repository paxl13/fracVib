export const vertexShaderSource = /* glsl */ `#version 300 es
void main() {
  // Fullscreen triangle via gl_VertexID (no buffers needed)
  float x = float((gl_VertexID & 1) << 2) - 1.0;
  float y = float((gl_VertexID & 2) << 1) - 1.0;
  gl_Position = vec4(x, y, 0.0, 1.0);
}
`;

export const fragmentShaderSource = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_center;
uniform float u_zoom;
uniform int u_maxIter;
uniform int u_fractalType; // 0=mandelbrot, 1=julia, 2=burningship
uniform vec2 u_juliaC;
uniform int u_colorScheme;  // 0=classic,1=inferno,2=ocean,3=electric,4=fire,5=rainbow,6=grayscale

out vec4 fragColor;

vec3 hslToRgb(float h, float s, float l) {
  float c = (1.0 - abs(2.0 * l - 1.0)) * s;
  float x = c * (1.0 - abs(mod(h / 60.0, 2.0) - 1.0));
  float m = l - c / 2.0;
  vec3 rgb;
  if (h < 60.0) rgb = vec3(c, x, 0.0);
  else if (h < 120.0) rgb = vec3(x, c, 0.0);
  else if (h < 180.0) rgb = vec3(0.0, c, x);
  else if (h < 240.0) rgb = vec3(0.0, x, c);
  else if (h < 300.0) rgb = vec3(x, 0.0, c);
  else rgb = vec3(c, 0.0, x);
  return rgb + m;
}

vec3 colorize(float t, int scheme) {
  if (scheme == 1) { // inferno
    float r = min(1.0, 1.5 * t);
    float g = max(0.0, min(1.0, (t - 0.25) * 2.0));
    float b = max(0.0, min(1.0, (0.5 - abs(t - 0.5)) * 3.0));
    return vec3(r, g, b);
  } else if (scheme == 2) { // ocean
    return hslToRgb(200.0 + t * 60.0, 0.8, 0.1 + t * 0.6);
  } else if (scheme == 3) { // electric
    return hslToRgb(260.0 + t * 100.0, 0.9, 0.15 + t * 0.65);
  } else if (scheme == 4) { // fire
    float r = min(1.0, t * 3.0);
    float g = max(0.0, min(1.0, (t - 0.33) * 3.0));
    float b = max(0.0, (t - 0.66) * 3.0);
    return vec3(r, g, b);
  } else if (scheme == 5) { // rainbow
    return hslToRgb(t * 360.0, 0.85, 0.5);
  } else if (scheme == 6) { // grayscale
    return vec3(t);
  }
  // default: classic
  return hslToRgb(220.0 + t * 140.0, 0.75, 0.08 + t * 0.7);
}

void main() {
  float scale = 4.0 / (u_resolution.x * u_zoom);
  float cx = (gl_FragCoord.x - u_resolution.x * 0.5) * scale + u_center.x;
  float cy = (gl_FragCoord.y - u_resolution.y * 0.5) * scale + u_center.y;
  // Flip Y: WebGL has origin at bottom-left, but our coordinate system has Y increasing downward
  cy = -cy + 2.0 * u_center.y;

  float zx, zy, zx2, zy2;
  float pcx, pcy; // point for iteration

  if (u_fractalType == 1) {
    // Julia: z starts at pixel, c is uniform
    zx = cx; zy = cy;
    pcx = u_juliaC.x; pcy = u_juliaC.y;
  } else {
    // Mandelbrot / Burning Ship: z starts at 0, c is pixel
    zx = 0.0; zy = 0.0;
    pcx = cx; pcy = cy;
  }

  zx2 = zx * zx;
  zy2 = zy * zy;

  int iter = 0;
  // GLSL ES 3.0 requires constant loop bounds — use large constant + break
  for (int i = 0; i < 10000; i++) {
    if (i >= u_maxIter) break;
    if (zx2 + zy2 > 4.0) break;

    if (u_fractalType == 2) {
      // Burning Ship: absolute values
      zy = abs(2.0 * zx * zy) + pcy;
    } else {
      zy = 2.0 * zx * zy + pcy;
    }
    zx = zx2 - zy2 + pcx;
    zx2 = zx * zx;
    zy2 = zy * zy;
    iter++;
  }

  if (iter >= u_maxIter) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    // Smooth coloring
    float smoothIter = float(iter) + 1.0 - log2(log2(zx2 + zy2));
    float t = mod(smoothIter, 64.0) / 64.0;
    vec3 color = colorize(t, u_colorScheme);
    fragColor = vec4(color, 1.0);
  }
}
`;
