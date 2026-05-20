# L04 — マテリアルとテクスチャ

## 概要

メッシュに色・質感・テクスチャを与えるマテリアルを学ぶ。  
宇宙ステーションの床に金属テクスチャ、タワーに青いエネルギーマテリアルを適用する。

**ゲームへの貢献**: ゲームが視覚的に「宇宙っぽく」見える第一歩。

---

## 概念解説

### StandardMaterial と PBRMaterial

| | StandardMaterial | PBRMaterial |
|---|---|---|
| 計算モデル | Phong シェーディング（旧来） | 物理ベースレンダリング（現代的） |
| 主要パラメータ | diffuse / specular / emissive | albedo / metallic / roughness |
| パフォーマンス | 軽い | やや重い |
| リアルさ | 普通 | 高い |
| 使いどき | シンプルな物体・デバッグ | メインのゲームオブジェクト |

### StandardMaterial の主要プロパティ

```typescript
const mat = new StandardMaterial('mat', scene)
mat.diffuseColor = new Color3(1, 0, 0)    // 物体の基本色（赤）
mat.emissiveColor = new Color3(0, 0.5, 1) // 自発光（照明に関係なく光る）
mat.specularColor = new Color3(1, 1, 1)   // 反射光の色
mat.specularPower = 64                    // 反射のシャープさ（高いほどシャープ）
mat.alpha = 0.8                           // 透明度（1.0 = 不透明）
mat.wireframe = true                      // ワイヤーフレーム表示
mat.backFaceCulling = false               // 裏面も描画する
```

### PBRMaterial の主要プロパティ

```typescript
const mat = new PBRMaterial('mat', scene)
mat.albedoColor = new Color3(0.8, 0.8, 0.9) // 基本色（アルベド）
mat.metallic = 0.8                           // 金属感（0.0〜1.0）
mat.roughness = 0.3                          // 粗さ（0.0=鏡, 1.0=マット）
mat.emissiveColor = new Color3(0, 0.3, 1)   // 自発光
mat.emissiveIntensity = 2.0                  // 自発光の強さ
```

### テクスチャの貼り付け

```typescript
import { Texture } from '@babylonjs/core'

const mat = new PBRMaterial('mat', scene)

// albedoTexture: 基本色テクスチャ
mat.albedoTexture = new Texture('/textures/metal_color.jpg', scene)

// タイリング（テクスチャを繰り返す）
mat.albedoTexture.uScale = 4  // 横方向に 4 回繰り返す
mat.albedoTexture.vScale = 4  // 縦方向に 4 回繰り返す

// bumpTexture: 凹凸（法線マップ）
mat.bumpTexture = new Texture('/textures/metal_normal.jpg', scene)
mat.invertNormalMapX = true  // DirectX 形式の法線マップの場合
```

### メッシュにマテリアルを適用する

```typescript
mesh.material = mat
```

### テクスチャなしで始める方法

テクスチャファイルが手元にない場合でも `albedoColor` や `diffuseColor` で色だけ設定できる。  
このレッスンではテクスチャは使わず色だけで進める。

---

## 実装手順

### Step 1: 床のマテリアル（金属床）

```typescript
const groundMat = new PBRMaterial('groundMat', scene)
groundMat.albedoColor = new Color3(0.15, 0.15, 0.2)  // 暗い青みがかった色
groundMat.metallic = 0.8
groundMat.roughness = 0.5
ground.material = groundMat
```

### Step 2: タワー台座のマテリアル

```typescript
const towerBaseMat = new PBRMaterial('towerBaseMat', scene)
towerBaseMat.albedoColor = new Color3(0.3, 0.35, 0.4)  // 金属グレー
towerBaseMat.metallic = 0.9
towerBaseMat.roughness = 0.2
towerBase.material = towerBaseMat
```

### Step 3: タワー砲身のマテリアル（エネルギーコア）

```typescript
const barrelMat = new PBRMaterial('barrelMat', scene)
barrelMat.albedoColor = new Color3(0.1, 0.3, 0.8)
barrelMat.metallic = 0.5
barrelMat.roughness = 0.1
barrelMat.emissiveColor = new Color3(0, 0.5, 1.0)   // 青く光る
barrelMat.emissiveIntensity = 1.5
towerBarrel.material = barrelMat
```

### Step 4: 敵のマテリアル（赤い宇宙船）

```typescript
const enemyMat = new StandardMaterial('enemyMat', scene)
enemyMat.diffuseColor = new Color3(0.8, 0.1, 0.1)   // 赤
enemyMat.emissiveColor = new Color3(0.3, 0, 0)       // 薄く自発光
enemyMat.specularColor = new Color3(1, 0.5, 0.5)
enemyMat.specularPower = 32
enemy.material = enemyMat
enemy2.material = enemyMat  // 同じマテリアルを複数に使い回せる
```

---

## ポイント解説

### マテリアルの使い回し
1 つのマテリアルを複数のメッシュに適用できる（参照共有）。  
`enemy.material = enemyMat` と `enemy2.material = enemyMat` は同じオブジェクトを指す。  
一方を変えると両方変わるので注意。

### `emissiveColor` と `emissiveIntensity`
- `emissiveColor` は自発光の色（照明の影響を受けない）
- `emissiveIntensity` (PBR のみ) で光の強さを倍率で指定できる
- Bloom ポストプロセッシング（L12）と組み合わせると輝いて見える

### `PBRMaterial` の `metallic` と `roughness`
- `metallic = 1, roughness = 0` → 鏡のような金属
- `metallic = 0, roughness = 1` → 石や木のようなマット素材
- `metallic = 0.5, roughness = 0.5` → プラスチックに近い質感

---

## 全体コード

### `app/game/page.tsx`

```tsx
import dynamic from 'next/dynamic'

const GameCanvas = dynamic(
  () => import('@/components/game/GameCanvas'),
  { ssr: false }
)

export default function GamePage() {
  return (
    <main className="w-full h-screen overflow-hidden bg-black">
      <GameCanvas />
    </main>
  )
}
```

---

### `components/game/GameCanvas.tsx`

```tsx
'use client'

import { useEffect, useRef } from 'react'
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
  PBRMaterial,
  StandardMaterial,
} from '@babylonjs/core'

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    // ── Engine & Scene ───────────────────────────────────
    const engine = new Engine(canvasRef.current, true)
    const scene = new Scene(engine)
    scene.clearColor = new Color4(0.02, 0.02, 0.05, 1)

    // ── Camera ───────────────────────────────────────────
    const camera = new ArcRotateCamera(
      'camera',
      -Math.PI / 2,
      Math.PI / 3,
      20,
      Vector3.Zero(),
      scene
    )
    camera.attachControl(canvasRef.current, true)
    camera.lowerRadiusLimit = 5
    camera.upperRadiusLimit = 40
    camera.lowerBetaLimit = 0.1
    camera.upperBetaLimit = Math.PI / 2.2

    // ── Lights ───────────────────────────────────────────
    const hemisphericLight = new HemisphericLight(
      'hemisphericLight',
      new Vector3(0, 1, 0),
      scene
    )
    hemisphericLight.intensity = 0.4
    hemisphericLight.diffuse = new Color3(0.6, 0.7, 1.0)
    hemisphericLight.groundColor = new Color3(0.1, 0.1, 0.2)

    const sunLight = new DirectionalLight(
      'sunLight',
      new Vector3(-1, -2, -1),
      scene
    )
    sunLight.intensity = 0.8
    sunLight.diffuse = new Color3(1.0, 0.95, 0.8)

    // ── Meshes ───────────────────────────────────────────
    const ground = MeshBuilder.CreateGround(
      'ground',
      { width: 20, height: 20, subdivisions: 20 },
      scene
    )

    const towerBase = MeshBuilder.CreateBox(
      'towerBase',
      { width: 1, height: 0.3, depth: 1 },
      scene
    )
    towerBase.position = new Vector3(0, 0.15, 0)

    const towerBarrel = MeshBuilder.CreateCylinder(
      'towerBarrel',
      { height: 1.5, diameter: 0.3, tessellation: 8 },
      scene
    )
    towerBarrel.parent = towerBase
    towerBarrel.position = new Vector3(0, 0.9, 0)

    const enemy = MeshBuilder.CreateSphere(
      'enemy',
      { diameter: 0.8, segments: 8 },
      scene
    )
    enemy.position = new Vector3(5, 0.4, 5)

    const enemy2 = MeshBuilder.CreateSphere(
      'enemy2',
      { diameter: 0.8, segments: 8 },
      scene
    )
    enemy2.position = new Vector3(-3, 0.4, 4)

    // ── Materials ────────────────────────────────────────
    // 床（暗い金属）
    const groundMat = new PBRMaterial('groundMat', scene)
    groundMat.albedoColor = new Color3(0.15, 0.15, 0.2)
    groundMat.metallic = 0.8
    groundMat.roughness = 0.5
    ground.material = groundMat

    // タワー台座（金属グレー）
    const towerBaseMat = new PBRMaterial('towerBaseMat', scene)
    towerBaseMat.albedoColor = new Color3(0.3, 0.35, 0.4)
    towerBaseMat.metallic = 0.9
    towerBaseMat.roughness = 0.2
    towerBase.material = towerBaseMat

    // タワー砲身（青く光るエネルギーコア）
    const barrelMat = new PBRMaterial('barrelMat', scene)
    barrelMat.albedoColor = new Color3(0.1, 0.3, 0.8)
    barrelMat.metallic = 0.5
    barrelMat.roughness = 0.1
    barrelMat.emissiveColor = new Color3(0, 0.5, 1.0)
    barrelMat.emissiveIntensity = 1.5
    towerBarrel.material = barrelMat

    // 敵（赤い宇宙船）
    const enemyMat = new StandardMaterial('enemyMat', scene)
    enemyMat.diffuseColor = new Color3(0.8, 0.1, 0.1)
    enemyMat.emissiveColor = new Color3(0.3, 0, 0)
    enemyMat.specularColor = new Color3(1, 0.5, 0.5)
    enemyMat.specularPower = 32
    enemy.material = enemyMat
    enemy2.material = enemyMat

    // ── Render Loop ──────────────────────────────────────
    engine.runRenderLoop(() => {
      scene.render()
    })

    const handleResize = () => {
      engine.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      engine.dispose()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100vh', display: 'block' }}
    />
  )
}
```

---

## 確認方法

`http://localhost:3000/game` を開く。  
- 床が暗い青みがかった金属色になっている
- タワーが金属グレーで砲身が青く光っている
- 敵の球が赤く表示されている

これで 3D シーンが「ゲームらしく」見え始める。
