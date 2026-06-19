import { Effect } from '@babylonjs/core'

export function registerShaders(): void {
  // ── Shield Shader ───────────────────────────────────
  Effect.ShadersStore['shieldVertexShader'] = `
    precision highp float;
    attribute vec3 position;
    attribute vec3 normal;
    uniform mat4 worldViewProjection;
    uniform mat4 world;
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
      gl_Position = worldViewProjection * vec4(position, 1.0);
      vNormal = normalize((world * vec4(normal, 0.0)).xyz);
      vPosition = (world * vec4(position, 1.0)).xyz;
    }
  `

  // vec3 n = normalize(vNormal);
  // float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 2.0);

  Effect.ShadersStore['shieldFragmentShader'] = `
    precision highp float;
    varying vec3 vNormal;
    varying vec3 vPosition;
    uniform vec3 cameraPosition;
    uniform float time;
    uniform float hitIntensity;
    void main() {
      vec3 viewDir = normalize(cameraPosition - vPosition);
      float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.0);
      vec3 baseColor = vec3(0.0, 0.5, 1.0);
      vec3 hitColor = vec3(1.0, 0.3, 0.0);
      vec3 color = mix(baseColor, hitColor, hitIntensity);
      float pulse = 0.5 + 0.5 * sin(time * 4.0);
      float alpha = (fresnel * 0.8 + 0.05) * (0.6 + pulse * 0.4 * hitIntensity + 0.1);
      gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.9));
    }
  `

  // ── Scanline Floor Shader ────────────────────────────
  Effect.ShadersStore['scanlineVertexShader'] = `
    precision highp float;
    attribute vec3 position;
    attribute vec2 uv;
    uniform mat4 worldViewProjection;
    varying vec2 vUV;
    void main() {
      gl_Position = worldViewProjection * vec4(position, 1.0);
      vUV = uv;
    }
  `

  Effect.ShadersStore['scanlineFragmentShader'] = `
    precision highp float;
    varying vec2 vUV;
    uniform float time;
    void main() {
      float gridX = step(0.95, fract(vUV.x * 20.0));
      float gridZ = step(0.95, fract(vUV.y * 20.0));
      float grid = max(gridX, gridZ);
      float scan = smoothstep(0.0, 0.1, fract(vUV.y - time * 0.1));
      scan = scan * (1.0 - smoothstep(0.9, 1.0, fract(vUV.y - time * 0.1)));
      vec3 baseColor = vec3(0.05, 0.05, 0.1);
      vec3 gridColor = vec3(0.1, 0.3, 0.5);
      vec3 scanColor = vec3(0.0, 0.5, 0.8);
      vec3 color = mix(baseColor, gridColor, grid * 0.7);
      color += scanColor * scan * 0.3;
      gl_FragColor = vec4(color, 1.0);
    }
  `
}
