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

| 種類                   | 実行タイミング     | 出力                          | 担当                       |
| ---------------------- | ------------------ | ----------------------------- | -------------------------- |
| 頂点シェーダー         | 頂点ごとに実行     | `gl_Position`（画面上の位置） | 形状・変形                 |
| フラグメントシェーダー | ピクセルごとに実行 | `fragColor`（色）             | 色・テクスチャ・エフェクト |

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

const shaderMat = new ShaderMaterial(
  'myShader',
  scene,
  {
    vertex: 'my',
    fragment: 'my',
  },
  {
    attributes: ['position', 'normal', 'uv'],
    uniforms: ['worldViewProjection', 'world', 'cameraPosition', 'time'],
    needAlphaBlending: true,
  },
)
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
const shieldMesh = MeshBuilder.CreateSphere(
  'shield',
  { diameter: 1.6, segments: 16 },
  scene,
)
shieldMesh.parent = towerBase
shieldMesh.position = new Vector3(0, 0.5, 0)
shieldMesh.isPickable = false

const shieldMat = new ShaderMaterial(
  'shieldMat',
  scene,
  {
    vertex: 'shield',
    fragment: 'shield',
  },
  {
    attributes: ['position', 'normal'],
    uniforms: [
      'worldViewProjection',
      'world',
      'cameraPosition',
      'time',
      'hitIntensity',
    ],
    needAlphaBlending: true,
    needAlphaTesting: false,
  },
)

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

const scanlineMat = new ShaderMaterial(
  'scanlineMat',
  scene,
  {
    vertex: 'scanline',
    fragment: 'scanline',
  },
  {
    attributes: ['position', 'uv'],
    uniforms: ['worldViewProjection', 'time'],
  },
)

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
const ground = MeshBuilder.CreateGround(
  'ground',
  { width: 20, height: 20, subdivisions: 1 },
  scene,
)
const scanlineMat = new ShaderMaterial(
  'scanlineMat',
  scene,
  {
    vertex: 'scanline',
    fragment: 'scanline',
  },
  {
    attributes: ['position', 'uv'],
    uniforms: ['worldViewProjection', 'time'],
  },
)
ground.material = scanlineMat
ground.receiveShadows = true
new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene)

// ── Shield Material ────────────────────────────────────
const shieldMat = new ShaderMaterial(
  'shieldMat',
  scene,
  {
    vertex: 'shield',
    fragment: 'shield',
  },
  {
    attributes: ['position', 'normal'],
    uniforms: [
      'worldViewProjection',
      'world',
      'cameraPosition',
      'time',
      'hitIntensity',
    ],
    needAlphaBlending: true,
  },
)
shieldMat.backFaceCulling = false
shieldMat.setFloat('hitIntensity', 0)

// タワー設置時にシールドを追加する（placeTower 内）
const shieldMesh = MeshBuilder.CreateSphere(
  `shield_${towers.length}`,
  { diameter: 1.8, segments: 12 },
  scene,
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

## 完全版 `components/game/GameCanvas.tsx`

```tsx
'use client'

import { useEffect, useRef, MutableRefObject } from 'react'
import {
  Engine,
  Scene,
  Color3,
  Color4,
  Vector3,
  ArcRotateCamera,
  HemisphericLight,
  DirectionalLight,
  MeshBuilder,
  Mesh,
  PBRMaterial,
  StandardMaterial,
  ShaderMaterial,
  PointerEventTypes,
  PhysicsAggregate,
  PhysicsShapeType,
  Animation,
  BackEase,
  EasingFunction,
  ImportMeshAsync,
  ParticleSystem,
  GPUParticleSystem,
  DynamicTexture,
  DefaultRenderingPipeline,
  ImageProcessingConfiguration,
  ColorCurves,
  ShadowGenerator,
  CubeTexture,
} from '@babylonjs/core'
import { HavokPlugin } from '@babylonjs/core'
import HavokPhysics from '@babylonjs/havok'
import '@babylonjs/loaders/glTF'
import { AdvancedDynamicTexture, Rectangle, Control } from '@babylonjs/gui'

import { TOWER_TYPES, TowerType } from '@/components/game/TowerSelector'
import type { GameEventCallback } from '@/app/game/page'
import { registerShaders } from '@/lib/babylon/shaders'

interface EnemyHealthBar {
  plane: Mesh
  fillRect: Rectangle
  currentHp: number
  maxHp: number
}

interface GameCanvasProps {
  gameState: 'menu' | 'playing' | 'pause' | 'gameover'
  onGameEvent: GameEventCallback
  controlRef: MutableRefObject<{
    start: () => void
    restart: () => void
  } | null>
  selectedTowerRef: MutableRefObject<string>
}

interface WaveConfig {
  enemyCount: number
  spawnInterval: number
  enemySpeed: number
  scorePerKill: number
  enemyHp: number
  goldPerKill: number
}

const WAVES: WaveConfig[] = [
  {
    enemyCount: 3,
    spawnInterval: 2.0,
    enemySpeed: 1.0,
    scorePerKill: 10,
    enemyHp: 2,
    goldPerKill: 20,
  },
  {
    enemyCount: 5,
    spawnInterval: 1.5,
    enemySpeed: 1.2,
    scorePerKill: 15,
    enemyHp: 3,
    goldPerKill: 25,
  },
  {
    enemyCount: 8,
    spawnInterval: 1.0,
    enemySpeed: 1.5,
    scorePerKill: 20,
    enemyHp: 4,
    goldPerKill: 30,
  },
  {
    enemyCount: 12,
    spawnInterval: 0.8,
    enemySpeed: 2.0,
    scorePerKill: 30,
    enemyHp: 6,
    goldPerKill: 40,
  },
]

const SPAWN_POINTS = [
  new Vector3(9, 0.5, 9),
  new Vector3(-9, 0.5, 9),
  new Vector3(9, 0.5, -9),
  new Vector3(-9, 0.5, -9),
]

const BASE_POSITION = new Vector3(0, 0.5, 0)

export default function GameCanvas({
  gameState: externalGameState,
  onGameEvent,
  controlRef,
  selectedTowerRef,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    let engine: Engine
    let cancelled = false

    const init = async () => {
      // ── Engine & Scene ───────────────────────────────────
      engine = new Engine(canvasRef.current, true)
      const scene = new Scene(engine)
      scene.clearColor = new Color4(0.02, 0.02, 0.05, 1)

      registerShaders()

      function createEnemyHealthBar(
        enemy: Mesh,
        maxHp: number,
      ): EnemyHealthBar {
        const plane = MeshBuilder.CreatePlane(
          'hpPlane',
          { width: 1.5, height: 0.2 },
          scene,
        )
        plane.parent = enemy
        plane.position.y = 0.9
        plane.billboardMode = Mesh.BILLBOARDMODE_ALL
        plane.isPickable = false

        const planeUI = AdvancedDynamicTexture.CreateForMesh(plane, 256, 32)

        const bg = new Rectangle()
        bg.width = '100%'
        bg.height = '100%'
        bg.background = '#1a1a2e'
        bg.thickness = 1
        bg.color = '#444'
        planeUI.addControl(bg)

        const fill = new Rectangle()
        fill.width = '100%'
        fill.height = '80%'
        fill.background = '#22c55e'
        fill.thickness = 0
        fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
        bg.addControl(fill)

        return { plane, fillRect: fill, currentHp: maxHp, maxHp }
      }

      function updateHealthBar(bar: EnemyHealthBar, hp: number): void {
        bar.currentHp = Math.max(0, hp)
        const pct = bar.currentHp / bar.maxHp
        bar.fillRect.width = `${pct * 100}%`
        if (pct > 0.5) bar.fillRect.background = '#22c55e'
        else if (pct > 0.25) bar.fillRect.background = '#f59e0b'
        else bar.fillRect.background = '#ef4444'
      }

      // ── Physics ────────────────────────────────────────
      const havokInstance = await HavokPhysics()
      if (cancelled) return

      const havokPlugin = new HavokPlugin(true, havokInstance)
      scene.enablePhysics(new Vector3(0, -9.81, 0), havokPlugin)

      // ── Camera ───────────────────────────────────────────
      const camera = new ArcRotateCamera(
        'camera',
        -Math.PI / 2,
        Math.PI / 3,
        20,
        Vector3.Zero(),
        scene,
      )
      camera.attachControl(canvasRef.current, true)
      camera.lowerRadiusLimit = 5
      camera.upperRadiusLimit = 40
      camera.lowerBetaLimit = 0.1
      camera.upperBetaLimit = Math.PI / 2.2

      // ── Post-Processing Pipeline ───────────────────────
      const pipeline = new DefaultRenderingPipeline('default', true, scene, [
        camera,
      ])
      pipeline.fxaaEnabled = true
      pipeline.bloomEnabled = true
      pipeline.bloomWeight = 0.4
      pipeline.bloomThreshold = 0.7
      pipeline.bloomScale = 0.5
      pipeline.bloomKernel = 32
      pipeline.imageProcessingEnabled = true
      pipeline.imageProcessing.contrast = 1.1
      pipeline.imageProcessing.exposure = 1.0
      pipeline.imageProcessing.toneMappingEnabled = true
      pipeline.imageProcessing.toneMappingType =
        ImageProcessingConfiguration.TONEMAPPING_ACES
      pipeline.imageProcessing.colorCurvesEnabled = true
      const curves = new ColorCurves()
      curves.globalSaturation = 15
      curves.highlightsHue = 210
      curves.highlightsDensity = 20
      pipeline.imageProcessing.colorCurves = curves
      pipeline.chromaticAberrationEnabled = true
      pipeline.chromaticAberration.aberrationAmount = 20
      pipeline.grainEnabled = true
      pipeline.grain.intensity = 8
      pipeline.grain.animated = true

      // ── Lights ───────────────────────────────────────────
      const hemisphericLight = new HemisphericLight(
        'hemisphericLight',
        new Vector3(0, 1, 0),
        scene,
      )
      hemisphericLight.intensity = 0.4
      hemisphericLight.diffuse = new Color3(0.6, 0.7, 1.0)
      hemisphericLight.groundColor = new Color3(0.1, 0.1, 0.2)

      const sunLight = new DirectionalLight(
        'sunLight',
        new Vector3(-1, -2, -1),
        scene,
      )
      sunLight.intensity = 1.2
      sunLight.diffuse = new Color3(1.0, 0.95, 0.8)
      sunLight.position = new Vector3(10, 20, 10)
      sunLight.shadowMinZ = 0.1
      sunLight.shadowMaxZ = 60

      // ── Environment Texture（IBL）─────────────────────
      try {
        scene.environmentTexture = CubeTexture.CreateFromPrefilteredData(
          '/env/environment.env',
          scene,
        )
        scene.environmentIntensity = 0.5
      } catch (e) {
        console.warn(
          'environment.envが見つかりません。HemisphericLightで代替します。',
          e,
        )
      }

      // ── Shadow Generator ───────────────────────────────
      const shadowGen = new ShadowGenerator(1024, sunLight)
      shadowGen.useExponentialShadowMap = false
      shadowGen.usePoissonSampling = true
      shadowGen.bias = 0.0001

      // ── Meshes ───────────────────────────────────────────
      const ground = MeshBuilder.CreateGround(
        'ground',
        { width: 20, height: 20, subdivisions: 20 },
        scene,
      )

      // ── Materials ────────────────────────────────────────
      // 床（スキャンライン SF シェーダー）
      const scanlineMat = new ShaderMaterial(
        'scanlineMat',
        scene,
        { vertex: 'scanline', fragment: 'scanline' },
        {
          attributes: ['position', 'uv'],
          uniforms: ['worldViewProjection', 'time'],
        },
      )
      ground.material = scanlineMat
      ground.receiveShadows = true

      // ── Physics Bodies ─────────────────────────────────
      new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene)

      // タワー台座（金属グレー）
      const towerBaseMat = new PBRMaterial('towerBaseMat', scene)
      towerBaseMat.albedoColor = new Color3(0.3, 0.35, 0.4)
      towerBaseMat.metallic = 0.9
      towerBaseMat.roughness = 0.2

      // タワー砲身（青く光るエネルギーコア）
      const barrelMat = new PBRMaterial('barrelMat', scene)
      barrelMat.albedoColor = new Color3(0.1, 0.3, 0.8)
      barrelMat.metallic = 0.5
      barrelMat.roughness = 0.1
      barrelMat.emissiveColor = new Color3(0, 0.5, 1.0)
      barrelMat.emissiveIntensity = 1.5

      const barrelMatRapid = barrelMat.clone('barrelMatRapid')
      barrelMatRapid.emissiveColor = new Color3(0, 1, 0.3)
      barrelMatRapid.albedoColor = new Color3(0, 0.5, 0.2)

      const barrelMatSniper = barrelMat.clone('barrelMatSniper')
      barrelMatSniper.emissiveColor = new Color3(0.8, 0, 1)
      barrelMatSniper.albedoColor = new Color3(0.4, 0, 0.6)

      // 敵（赤い宇宙船）
      const enemyMat = new StandardMaterial('enemyMat', scene)
      enemyMat.diffuseColor = new Color3(0.8, 0.1, 0.1)
      enemyMat.emissiveColor = new Color3(0.3, 0, 0)

      const bulletMat = new PBRMaterial('bulletMat', scene)
      bulletMat.albedoColor = new Color3(1.0, 0.8, 0.0)
      bulletMat.emissiveColor = new Color3(1.0, 0.5, 0.0)
      bulletMat.emissiveIntensity = 2.0
      bulletMat.metallic = 0
      bulletMat.roughness = 0

      const baseMat = new PBRMaterial('baseMat', scene)
      baseMat.albedoColor = new Color3(0.2, 0.8, 0.2)
      baseMat.emissiveColor = new Color3(0, 0.3, 0)
      baseMat.metallic = 0.5
      baseMat.roughness = 0.3

      // シールドシェーダーマテリアル（全タワーで共有）
      const shieldMat = new ShaderMaterial(
        'shieldMat',
        scene,
        { vertex: 'shield', fragment: 'shield' },
        {
          attributes: ['position', 'normal'],
          uniforms: [
            'worldViewProjection',
            'world',
            'cameraPosition',
            'time',
            'hitIntensity',
          ],
          needAlphaBlending: true,
        },
      )
      shieldMat.backFaceCulling = false
      shieldMat.setFloat('hitIntensity', 0)

      // ── Base（守るべき拠点）────────────────────────────
      const base = MeshBuilder.CreateCylinder(
        'base',
        { height: 0.3, diameter: 2, tessellation: 16 },
        scene,
      )
      base.position = BASE_POSITION.clone()
      base.position.y = 0.15
      base.material = baseMat
      base.receiveShadows = true
      shadowGen.addShadowCaster(base)
      new PhysicsAggregate(base, PhysicsShapeType.CYLINDER, { mass: 0 }, scene)

      // ── Particle Texture ────────────────────────────────
      const particleTex = new DynamicTexture(
        'particleTex',
        { width: 64, height: 64 },
        scene,
        false,
      )
      const ctx = particleTex.getContext()
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
      grad.addColorStop(0, 'rgba(255,255,255,1)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 64, 64)
      particleTex.update()

      // ── Stars Background ───────────────────────────────
      const stars = GPUParticleSystem.IsSupported
        ? new GPUParticleSystem('stars', { capacity: 2000 }, scene)
        : new ParticleSystem('stars', 2000, scene)

      stars.particleTexture = particleTex
      stars.emitter = new Vector3(0, 0, 0)
      stars.createSphereEmitter(30)
      stars.minLifeTime = 120
      stars.maxLifeTime = 120
      stars.minEmitPower = 0
      stars.maxEmitPower = 0
      stars.gravity = new Vector3(0, 0, 0)
      stars.color1 = new Color4(1, 1, 1, 0.8)
      stars.color2 = new Color4(0.8, 0.9, 1, 0.6)
      stars.colorDead = new Color4(1, 1, 1, 0)
      stars.minSize = 0.02
      stars.maxSize = 0.08
      stars.emitRate = 15
      stars.blendMode = ParticleSystem.BLENDMODE_ONEONE
      stars.start()

      // ── Game State ─────────────────────────────────────
      let playing = false
      let score = 0
      let lives = 20
      let gold = 200
      let currentWaveIndex = 0
      let waveEnemiesRemaining = 0
      let waveEnemiesSpawned = 0
      let spawnTimer = 0
      let betweenWaveTimer = 0
      const BETWEEN_WAVE_DELAY = 5

      // ── Explosion Effect ───────────────────────────────
      function createExplosion(position: Vector3): void {
        const ps = new ParticleSystem('explosion', 150, scene)
        ps.particleTexture = particleTex
        ps.emitter = position.clone()
        ps.minEmitBox = new Vector3(-0.1, -0.1, -0.1)
        ps.maxEmitBox = new Vector3(0.1, 0.1, 0.1)
        ps.minLifeTime = 0.2
        ps.maxLifeTime = 0.8
        ps.minEmitPower = 3
        ps.maxEmitPower = 8
        ps.direction1 = new Vector3(-1, -1, -1)
        ps.direction2 = new Vector3(1, 1, 1)
        ps.gravity = new Vector3(0, -3, 0)
        ps.color1 = new Color4(1, 0.6, 0, 1)
        ps.color2 = new Color4(1, 0.1, 0, 1)
        ps.colorDead = new Color4(0.1, 0.1, 0.1, 0)
        ps.minSize = 0.1
        ps.maxSize = 0.4
        ps.emitRate = 500
        ps.blendMode = ParticleSystem.BLENDMODE_ONEONE
        ps.targetStopDuration = 0.15
        ps.start()

        let elapsed = 0
        const cleanup = () => {
          elapsed += engine.getDeltaTime() / 1000
          if (elapsed >= 2.0) {
            ps.dispose(false)
            scene.unregisterAfterRender(cleanup)
          }
        }
        scene.registerAfterRender(cleanup)
      }

      // ── Asset Loading ──────────────────────────────────
      let enemyTemplate: Mesh

      try {
        const result = await ImportMeshAsync('/model/enemy.glb', scene, {
          meshNames: '',
        })
        enemyTemplate = result.meshes[0] as Mesh
        enemyTemplate.name = 'enemyTemplate'
        enemyTemplate.setEnabled(false)
        result.animationGroups.forEach((g) => {
          console.log('アニメーション', g.name)
          g.stop()
        })
      } catch {
        enemyTemplate = MeshBuilder.CreateSphere(
          'enemyTemplate',
          { diameter: 0.8, segments: 8 },
          scene,
        )
        enemyTemplate.material = enemyMat
        enemyTemplate.setEnabled(false)
      }

      if (cancelled) return

      let towerTemplate: Mesh | null = null

      try {
        const result = await ImportMeshAsync('/model/tower.glb', scene, {
          meshNames: '',
        })
        towerTemplate = result.meshes[0] as Mesh
        towerTemplate.name = 'towerTemplate'
        towerTemplate.setEnabled(false)
      } catch {
        towerTemplate = null
      }

      if (cancelled) return

      // ── Enemies ────────────────────────────────────────
      const enemies: {
        mesh: Mesh
        speed: number
        time: number
        hp: number
        maxHp: number
        healthBar: EnemyHealthBar
      }[] = []

      function spawnEnemy(waveConfig: WaveConfig): void {
        const spawnPoint =
          SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)]
        const mesh = MeshBuilder.CreateSphere(
          `enemy_${Date.now()}`,
          { diameter: 0.8, segments: 8 },
          scene,
        )
        mesh.position = spawnPoint.clone()
        mesh.material = enemyMat
        mesh.receiveShadows = true
        shadowGen.addShadowCaster(mesh)
        const healthBar = createEnemyHealthBar(mesh, waveConfig.enemyHp)
        enemies.push({
          mesh,
          speed: waveConfig.enemySpeed,
          time: Math.random() * Math.PI * 2,
          hp: waveConfig.enemyHp,
          maxHp: waveConfig.enemyHp,
          healthBar,
        })
        waveEnemiesSpawned++
        waveEnemiesRemaining++
      }

      function killEnemy(index: number, fromWave: WaveConfig): void {
        createExplosion(enemies[index].mesh.position.clone())
        enemies[index].healthBar.plane.dispose()
        enemies[index].mesh.dispose()
        enemies.splice(index, 1)
        waveEnemiesRemaining--
        score += fromWave.scorePerKill
        gold += fromWave.goldPerKill
        onGameEvent({ type: 'SCORE_CHANGED', score })
        onGameEvent({ type: 'GOLD_CHANGED', gold })
      }

      function enemyReachsBase(index: number): void {
        createExplosion(enemies[index].mesh.position.clone())
        enemies[index].healthBar.plane.dispose()
        enemies[index].mesh.dispose()
        enemies.splice(index, 1)
        waveEnemiesRemaining--
        lives -= 1
        onGameEvent({ type: 'LIFE_CHANGED', lives })
        if (lives <= 0) {
          playing = false
          onGameEvent({ type: 'GAME_OVER', score })
        }
      }

      // ── Tower Placement System ────────────────────────────
      const towers: Mesh[] = []
      const towerFireTimers: number[] = []
      const towerConfigs: TowerType[] = []
      const towerShields: { mesh: Mesh; hitIntensity: number }[] = []

      function playSpawnAnimation(mesh: Mesh): void {
        const scaleAnim = new Animation(
          'spawnScale',
          'scaling',
          60,
          Animation.ANIMATIONTYPE_VECTOR3,
          Animation.ANIMATIONLOOPMODE_CONSTANT,
        )
        const ease = new BackEase(0.5)
        ease.setEasingMode(EasingFunction.EASINGMODE_EASEOUT)
        scaleAnim.setEasingFunction(ease)
        scaleAnim.setKeys([
          { frame: 0, value: new Vector3(0.01, 0.01, 0.01) },
          { frame: 20, value: new Vector3(1.1, 1.1, 1.1) },
          { frame: 25, value: new Vector3(1, 1, 1) },
        ])
        mesh.animations = [scaleAnim]
        scene.beginAnimation(mesh, 0, 25, false, 1.0)
      }

      function placeTower(position: Vector3): void {
        if (!playing) return

        const gridX = Math.round(position.x)
        const gridZ = Math.round(position.z)

        const occupied = towers.some(
          (t) =>
            Math.round(t.position.x) === gridX &&
            Math.round(t.position.z) === gridZ,
        )
        if (occupied) return

        if (Math.abs(gridX) > 9 || Math.abs(gridZ) > 9) return
        if (Math.abs(gridX) < 1 && Math.abs(gridZ) < 1) return

        const towerType =
          TOWER_TYPES.find((t) => t.id === selectedTowerRef.current) ??
          TOWER_TYPES[0]

        if (gold < towerType.cost) return
        gold -= towerType.cost
        onGameEvent({ type: 'GOLD_CHANGED', gold })

        let towerBase: Mesh
        if (towerTemplate) {
          const clone = towerTemplate.clone(`tower_${towers.length}`, null)
          if (clone) {
            towerBase = clone
            towerBase.setEnabled(true)
            towerBase.position = new Vector3(gridX, 0, gridZ)
            towerBase.scaling = new Vector3(0.5, 0.5, 0.5)
          } else {
            towerBase = MeshBuilder.CreateBox(
              `tower_${towers.length}`,
              { width: 1, height: 0.3, depth: 1 },
              scene,
            )
            towerBase.position = new Vector3(gridX, 0.15, gridZ)
            towerBase.material = towerBaseMat
          }
        } else {
          towerBase = MeshBuilder.CreateBox(
            `towerBase_${towers.length}`,
            { width: 1, height: 0.3, depth: 1 },
            scene,
          )
          towerBase.position = new Vector3(gridX, 0.15, gridZ)
          towerBase.material = towerBaseMat

          const type = selectedTowerRef.current
          let bMat = barrelMat
          if (type === 'rapid') bMat = barrelMatRapid
          if (type === 'sniper') bMat = barrelMatSniper

          const barrel = MeshBuilder.CreateCylinder(
            `towerBarrel_${towers.length}`,
            { height: 1.5, diameter: 0.3, tessellation: 8 },
            scene,
          )
          barrel.parent = towerBase
          barrel.position = new Vector3(0, 0.9, 0)
          barrel.material = bMat
        }

        towerBase.receiveShadows = true
        shadowGen.addShadowCaster(towerBase, true)

        // シールドメッシュをタワーに追加
        const shieldMesh = MeshBuilder.CreateSphere(
          `shield_${towers.length}`,
          { diameter: 1.8, segments: 12 },
          scene,
        )
        shieldMesh.parent = towerBase
        shieldMesh.position = new Vector3(0, 0.5, 0)
        shieldMesh.material = shieldMat
        shieldMesh.isPickable = false
        shieldMesh.setEnabled(false)
        towerShields.push({ mesh: shieldMesh, hitIntensity: 0 })

        towers.push(towerBase)
        towerFireTimers.push(0)
        towerConfigs.push(towerType)
        playSpawnAnimation(towerBase)
      }

      // ── Bullet System ──────────────────────────────────
      const activeBullets: {
        mesh: Mesh
        agg: PhysicsAggregate
        targetIndex: number
        timer: number
        waveConfig: WaveConfig
        damage: number
      }[] = []

      function fireBullet(
        from: Vector3,
        targetIndex: number,
        waveConfig: WaveConfig,
        damage: number,
      ): void {
        if (targetIndex < 0 || targetIndex >= enemies.length) return

        const bullet = MeshBuilder.CreateSphere(
          'bullet',
          { diameter: 0.2, segments: 4 },
          scene,
        )
        bullet.position = from.clone()
        bullet.material = bulletMat

        const agg = new PhysicsAggregate(
          bullet,
          PhysicsShapeType.SPHERE,
          { mass: 0.05 },
          scene,
        )
        const dir = enemies[targetIndex].mesh.position
          .subtract(from)
          .normalize()
        agg.body.setLinearVelocity(dir.scale(15))

        activeBullets.push({
          mesh: bullet,
          agg,
          targetIndex,
          timer: 0,
          waveConfig,
          damage,
        })
      }

      // ── Game Start/Restart ─────────────────────────────
      function startWave(waveIndex: number): void {
        const wave = WAVES[Math.min(waveIndex, WAVES.length - 1)]
        waveEnemiesSpawned = 0
        waveEnemiesRemaining = wave.enemyCount
        spawnTimer = 0
        onGameEvent({ type: 'WAVE_STARTED', wave: waveIndex + 1 })
      }

      function startGame(): void {
        playing = true
        score = 0
        lives = 20
        gold = 200
        currentWaveIndex = 0
        betweenWaveTimer = 0
        for (const e of enemies) {
          e.healthBar.plane.dispose()
          e.mesh.dispose()
        }
        enemies.length = 0
        for (const b of activeBullets) {
          b.agg.dispose()
          b.mesh.dispose()
        }
        activeBullets.length = 0
        onGameEvent({ type: 'SCORE_CHANGED', score })
        onGameEvent({ type: 'LIFE_CHANGED', lives })
        onGameEvent({ type: 'GOLD_CHANGED', gold })
        startWave(0)
      }

      function restartGame(): void {
        for (const t of towers) t.dispose()
        towers.length = 0
        towerFireTimers.length = 0
        towerConfigs.length = 0
        towerShields.length = 0
        startGame()
      }

      controlRef.current = {
        start: startGame,
        restart: restartGame,
      }

      // ── Input: ポインターイベント ─────────────────────────
      scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return
        const pick = pointerInfo.pickInfo
        if (!pick?.hit || !pick.pickedMesh || !pick.pickedPoint) return
        if (pick.pickedMesh.name === 'ground') {
          placeTower(pick.pickedPoint)
        }
      })

      // ── Per-Frame Update ───────────────────────────────
      let shaderTime = 0

      scene.registerBeforeRender(() => {
        const delta = engine.getDeltaTime() / 1000

        // シェーダーの time uniform を毎フレーム更新（playing に関係なく動かす）
        shaderTime += delta
        scanlineMat.setFloat('time', shaderTime)
        shieldMat.setFloat('time', shaderTime)
        shieldMat.setVector3('cameraPosition', camera.position)

        // シールドのヒット強度を減衰
        for (const shield of towerShields) {
          if (shield.hitIntensity > 0) {
            shield.hitIntensity = Math.max(0, shield.hitIntensity - delta * 2)
            shieldMat.setFloat('hitIntensity', shield.hitIntensity)
            if (shield.hitIntensity <= 0) shield.mesh.setEnabled(false)
          }
        }

        if (!playing) return

        const currentWave = WAVES[Math.min(currentWaveIndex, WAVES.length - 1)]

        // 敵のスポーン
        if (waveEnemiesSpawned < currentWave.enemyCount) {
          spawnTimer += delta
          if (spawnTimer >= currentWave.spawnInterval) {
            spawnTimer = 0
            spawnEnemy(currentWave)
          }
        }

        // ウェーブクリア判定
        if (
          waveEnemiesSpawned >= currentWave.enemyCount &&
          enemies.length === 0
        ) {
          betweenWaveTimer += delta
          if (betweenWaveTimer >= BETWEEN_WAVE_DELAY) {
            betweenWaveTimer = 0
            currentWaveIndex++
            if (currentWaveIndex >= WAVES.length) {
              currentWaveIndex = WAVES.length - 1
            }
            startWave(currentWaveIndex)
          }
        }

        // 敵の移動
        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i]
          e.time += delta
          const dir = BASE_POSITION.subtract(e.mesh.position)
          const dist = dir.length()
          if (dist < 1.0) {
            enemyReachsBase(i)
            continue
          }
          e.mesh.position.addInPlace(dir.normalize().scale(e.speed * delta))
          e.mesh.position.y = 0.5 + Math.sin(e.time * 2.5) * 0.15
          e.mesh.rotation.y += 0.3 * delta
        }

        // タワーの発射
        for (let i = 0; i < towers.length; i++) {
          if (enemies.length === 0) continue
          let nearestIdx = 0
          let minDist = Vector3.Distance(
            towers[i].position,
            enemies[0].mesh.position,
          )
          for (let j = 1; j < enemies.length; j++) {
            const d = Vector3.Distance(
              towers[i].position,
              enemies[j].mesh.position,
            )
            if (d < minDist) {
              minDist = d
              nearestIdx = j
            }
          }
          const dir = enemies[nearestIdx].mesh.position.subtract(
            towers[i].position,
          )
          towers[i].rotation.y = Math.atan2(dir.x, dir.z)

          const towerConfig = towerConfigs[i]
          towerFireTimers[i] += delta

          if (
            towerFireTimers[i] >= towerConfig.fireRate &&
            minDist <= towerConfig.range
          ) {
            towerFireTimers[i] = 0
            const muzzlePos = towers[i].position.clone()
            muzzlePos.y += 0.9
            fireBullet(muzzlePos, nearestIdx, currentWave, towerConfig.damage)
          }
        }

        // 弾丸の衝突判定
        for (let bi = activeBullets.length - 1; bi >= 0; bi--) {
          const b = activeBullets[bi]
          b.timer += delta
          if (b.timer > 4) {
            b.agg.dispose()
            b.mesh.dispose()
            activeBullets.splice(bi, 1)
            continue
          }
          for (let ei = enemies.length - 1; ei >= 0; ei--) {
            if (
              Vector3.Distance(b.mesh.position, enemies[ei].mesh.position) < 0.6
            ) {
              enemies[ei].hp -= b.damage
              updateHealthBar(enemies[ei].healthBar, enemies[ei].hp)
              if (enemies[ei].hp <= 0) {
                killEnemy(ei, b.waveConfig)
              }
              b.agg.dispose()
              b.mesh.dispose()
              activeBullets.splice(bi, 1)
              break
            }
          }
        }
      })

      engine.runRenderLoop(() => {
        scene.render()
      })
    }

    init()

    const handleResize = () => {
      engine?.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelled = true
      window.removeEventListener('resize', handleResize)
      engine?.dispose()
    }
  }, [onGameEvent, controlRef])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100vh',
        display: 'block',
      }}
    />
  )
}
```

---

## 確認方法

- 床がグリッド＋スキャンラインのアニメーションする SF テクスチャになっている
- タワーに当たった弾が（ゲームロジックで発火させると）青白いシールドが閃く
- シールドはカメラ角度によってリム（縁）が強く光るフレネル効果がある
