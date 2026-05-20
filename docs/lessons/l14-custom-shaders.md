# L14 — カスタムシェーダー（GLSL）

## 概要

GLSL を書いて Babylon.js の `ShaderMaterial` に適用する。  
フレネル効果（リム発光）でタワーのシールドを実装する。

**ゲームへの貢献**: 被弾時に青白いシールドが閃く演出と、スキャンライン床テクスチャ。

---

## 概念解説

### GPU シェーダーとは

CPU で実行される通常の JavaScript コードと違い、  
シェーダーは GPU の何千ものコアで**並列**に実行される。

```
CPU (JavaScript)    GPU (GLSL)
  - 順番に実行        - 全ピクセル/頂点を同時に実行
  - ゲームロジック     - レンダリング計算
  - AI・物理          - 色・位置・変形
```

### シェーダーの 2 種類

| 種類 | 実行タイミング | 出力 | 担当 |
|---|---|---|---|
| 頂点シェーダー | 頂点ごとに実行 | `gl_Position`（画面上の位置） | 形状・変形 |
| フラグメントシェーダー | ピクセルごとに実行 | `fragColor`（色） | 色・テクスチャ・エフェクト |

### GLSL の基本文法

```glsl
// 型
float  f = 0.5;
vec2   v2 = vec2(1.0, 0.0);        // 2D ベクトル
vec3   v3 = vec3(1.0, 0.5, 0.0);   // RGB や 3D ベクトル
vec4   v4 = vec4(1.0, 0.5, 0.0, 1.0); // RGBA
mat4   m4;                          // 4x4 行列

// スウィズル（要素アクセス）
vec3 col = vec3(1.0, 0.5, 0.2);
float r = col.r;     // または col.x
vec2 rg = col.rg;    // または col.xy

// 組み込み関数
float v = sin(time);
float v2 = mix(a, b, t);       // 線形補間
float v3 = clamp(x, 0.0, 1.0);
float v4 = smoothstep(0.0, 1.0, x);
float v5 = dot(vecA, vecB);    // 内積
float v6 = length(vec);        // ベクトルの長さ
vec3 n = normalize(vec);       // 正規化
```

### Babylon.js での ShaderMaterial

```typescript
import { ShaderMaterial, Effect } from '@babylonjs/core'

// GLSL をインラインで登録（Effect.ShadersStore）
Effect.ShadersStore['myVertexShader'] = `
  precision highp float;
  attribute vec3 position;
  attribute vec3 normal;
  attribute vec2 uv;

  uniform mat4 worldViewProjection;
  uniform mat4 world;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUV;

  void main() {
    gl_Position = worldViewProjection * vec4(position, 1.0);
    vNormal = normalize((world * vec4(normal, 0.0)).xyz);
    vPosition = (world * vec4(position, 1.0)).xyz;
    vUV = uv;
  }
`

Effect.ShadersStore['myFragmentShader'] = `
  precision highp float;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUV;

  uniform vec3 cameraPosition;
  uniform float time;

  void main() {
    // フレネル効果（リム発光）
    vec3 viewDir = normalize(cameraPosition - vPosition);
    float fresnel = pow(1.0 - dot(vNormal, viewDir), 3.0);

    vec3 color = mix(vec3(0.0, 0.2, 0.5), vec3(0.0, 0.8, 1.0), fresnel);
    float alpha = 0.3 + fresnel * 0.7;

    gl_FragColor = vec4(color, alpha);
  }
`

const shaderMat = new ShaderMaterial('myShader', scene, {
  vertex: 'my',
  fragment: 'my',
}, {
  attributes: ['position', 'normal', 'uv'],
  uniforms: ['worldViewProjection', 'world', 'cameraPosition', 'time'],
  needAlphaBlending: true,
})
```

### Uniform の更新

```typescript
// 毎フレーム time を更新
let time = 0
scene.registerBeforeRender(() => {
  const delta = engine.getDeltaTime() / 1000
  time += delta
  shaderMat.setFloat('time', time)
  shaderMat.setVector3('cameraPosition', camera.position)
})
```

### よく使うシェーダーパターン

#### フレネル効果（リム発光）
```glsl
float fresnel = pow(1.0 - dot(normalize(vNormal), normalize(viewDir)), 3.0);
vec3 color = mix(innerColor, rimColor, fresnel);
```

#### スキャンライン（SF テクスチャ）
```glsl
float scanline = step(0.5, fract(vUV.y * 20.0 + time * 0.5));
color *= 0.7 + scanline * 0.3;
```

#### ノイズによる揺らぎ
```glsl
float noise = fract(sin(dot(vUV, vec2(127.1, 311.7))) * 43758.5453);
color += noise * 0.05;
```

---

## 実装手順

### Step 1: シールドシェーダーを登録する

```typescript
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

Effect.ShadersStore['shieldFragmentShader'] = `
  precision highp float;
  varying vec3 vNormal;
  varying vec3 vPosition;

  uniform vec3 cameraPosition;
  uniform float time;
  uniform float hitIntensity;  // 被弾時に 1 になる

  void main() {
    vec3 viewDir = normalize(cameraPosition - vPosition);
    float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.0);

    // ベースカラー
    vec3 baseColor = vec3(0.0, 0.5, 1.0);
    // 被弾時フラッシュ
    vec3 hitColor = vec3(1.0, 0.3, 0.0);
    vec3 color = mix(baseColor, hitColor, hitIntensity);

    // パルスアニメーション
    float pulse = 0.5 + 0.5 * sin(time * 4.0);

    float alpha = (fresnel * 0.8 + 0.05) * (0.6 + pulse * 0.4 * hitIntensity + 0.1);

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.9));
  }
`
```

### Step 2: ShaderMaterial を作成して球に適用する

```typescript
const shieldMesh = MeshBuilder.CreateSphere('shield', { diameter: 1.6, segments: 16 }, scene)
shieldMesh.parent = towerBase
shieldMesh.position = new Vector3(0, 0.5, 0)
shieldMesh.isPickable = false

const shieldMat = new ShaderMaterial('shieldMat', scene, {
  vertex: 'shield',
  fragment: 'shield',
}, {
  attributes: ['position', 'normal'],
  uniforms: ['worldViewProjection', 'world', 'cameraPosition', 'time', 'hitIntensity'],
  needAlphaBlending: true,
  needAlphaTesting: false,
})

shieldMat.backFaceCulling = false
shieldMesh.material = shieldMat
shieldMesh.setEnabled(false) // 普段は非表示
```

### Step 3: 被弾時にシールドを点滅させる

```typescript
let shieldHitIntensity = 0

function triggerShieldHit(shield: Mesh): void {
  shield.setEnabled(true)
  shieldHitIntensity = 1.0
}

// フレームごとに強度を減衰
scene.registerBeforeRender(() => {
  const delta = engine.getDeltaTime() / 1000
  if (shieldHitIntensity > 0) {
    shieldHitIntensity = Math.max(0, shieldHitIntensity - delta * 2)
    shieldMat.setFloat('hitIntensity', shieldHitIntensity)
    if (shieldHitIntensity <= 0) shield.setEnabled(false)
  }
})
```

### Step 4: 床のスキャンラインシェーダー

```typescript
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
    // グリッドライン
    float gridX = step(0.95, fract(vUV.x * 20.0));
    float gridZ = step(0.95, fract(vUV.y * 20.0));
    float grid = max(gridX, gridZ);

    // スキャンライン（上から下へ流れる光の線）
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

const scanlineMat = new ShaderMaterial('scanlineMat', scene, {
  vertex: 'scanline',
  fragment: 'scanline',
}, {
  attributes: ['position', 'uv'],
  uniforms: ['worldViewProjection', 'time'],
})

ground.material = scanlineMat

// time uniform を毎フレーム更新
let shaderTime = 0
scene.registerBeforeRender(() => {
  shaderTime += engine.getDeltaTime() / 1000
  scanlineMat.setFloat('time', shaderTime)
  shieldMat.setFloat('time', shaderTime)
  shieldMat.setVector3('cameraPosition', camera.position)
})
```

---

## ポイント解説

### `precision highp float;` は必須
精度宣言がないとモバイルで動作しない場合がある。常に先頭に書く。

### `needAlphaBlending: true` でシールドを半透明に
設定しないと `gl_FragColor` のアルファ値が無視されて不透明になる。

### `backFaceCulling = false` で内側からも見える
デフォルトでは裏面（法線が向いていない面）は描画されない。  
シールドのような球形は内側から見える必要があるので `false` にする。

---

## 全体コード

### `lib/babylon/shaders.ts`（シェーダー定義を別ファイルに分離）

```typescript
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
```

---

### `components/game/GameCanvas.tsx` への追加（抜粋）

```tsx
// import 追加
import { ShaderMaterial, Effect } from '@babylonjs/core'
import { registerShaders } from '@/lib/babylon/shaders'

// init() の最初に呼ぶ
registerShaders()

// ── Scanline Floor ─────────────────────────────────────
const ground = MeshBuilder.CreateGround('ground', { width: 20, height: 20, subdivisions: 1 }, scene)
const scanlineMat = new ShaderMaterial('scanlineMat', scene, {
  vertex: 'scanline',
  fragment: 'scanline',
}, {
  attributes: ['position', 'uv'],
  uniforms: ['worldViewProjection', 'time'],
})
ground.material = scanlineMat
ground.receiveShadows = true
new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene)

// ── Shield Material ────────────────────────────────────
const shieldMat = new ShaderMaterial('shieldMat', scene, {
  vertex: 'shield',
  fragment: 'shield',
}, {
  attributes: ['position', 'normal'],
  uniforms: ['worldViewProjection', 'world', 'cameraPosition', 'time', 'hitIntensity'],
  needAlphaBlending: true,
})
shieldMat.backFaceCulling = false
shieldMat.setFloat('hitIntensity', 0)

// タワー設置時にシールドを追加する（placeTower 内）
const shieldMesh = MeshBuilder.CreateSphere(
  `shield_${towers.length}`, { diameter: 1.8, segments: 12 }, scene
)
shieldMesh.parent = towerBase
shieldMesh.position = new Vector3(0, 0.5, 0)
shieldMesh.material = shieldMat
shieldMesh.isPickable = false
shieldMesh.setEnabled(false)

// シェーダーの time uniform を毎フレーム更新
let shaderTime = 0
scene.registerBeforeRender(() => {
  const delta = engine.getDeltaTime() / 1000
  shaderTime += delta
  scanlineMat.setFloat('time', shaderTime)
  shieldMat.setFloat('time', shaderTime)
  shieldMat.setVector3('cameraPosition', camera.position)
})
```

---

## 確認方法

- 床がグリッド＋スキャンラインのアニメーションする SF テクスチャになっている
- タワーに当たった弾が（ゲームロジックで発火させると）青白いシールドが閃く
- シールドはカメラ角度によってリム（縁）が強く光るフレネル効果がある
