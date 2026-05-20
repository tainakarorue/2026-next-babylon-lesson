# L03 — メッシュと 3D 空間

## 概要

3D オブジェクト（メッシュ）を作成し、位置・回転・スケールを操作する。  
ゲームの「床」と「タワーの仮置き」を箱で表現する。

**ゲームへの貢献**: 宇宙ステーションの床グリッドと、タワーのプレースホルダー（箱）が完成する。

---

## 概念解説

### MeshBuilder でメッシュを作る

Babylon.js では `MeshBuilder` ユーティリティで基本形状を生成する。

```typescript
// 箱
const box = MeshBuilder.CreateBox('名前', { width: 1, height: 1, depth: 1 }, scene)

// 球
const sphere = MeshBuilder.CreateSphere('名前', { diameter: 1, segments: 16 }, scene)

// 平面（床に使う）
const ground = MeshBuilder.CreateGround('名前', { width: 20, height: 20 }, scene)

// 円柱
const cylinder = MeshBuilder.CreateCylinder('名前', { height: 2, diameter: 1 }, scene)

// トーラス（ドーナツ型）
const torus = MeshBuilder.CreateTorus('名前', { diameter: 2, thickness: 0.5 }, scene)
```

### Transform（位置・回転・スケール）

すべての `Mesh` は `position`, `rotation`, `scaling` プロパティを持つ。

```typescript
mesh.position = new Vector3(x, y, z)      // 位置
mesh.position.y = 1                       // Y 軸だけ変更
mesh.rotation = new Vector3(0, Math.PI / 4, 0) // 回転（ラジアン）
mesh.scaling = new Vector3(1, 2, 1)       // スケール（y 方向に 2 倍）
```

### Vector3 の便利な静的メソッド

```typescript
Vector3.Zero()    // (0, 0, 0)
Vector3.One()     // (1, 1, 1)
Vector3.Up()      // (0, 1, 0)
Vector3.Right()   // (1, 0, 0)
Vector3.Forward() // (0, 0, 1)
```

### 親子関係（Parent-Child）

```typescript
child.parent = parent
// child は parent の座標系で動く
// parent を動かすと child も一緒に動く
```

タワーの「砲台」を「台座」の子にしておくと、台座を動かすだけで砲台も追従する。

### ワイヤーフレーム表示（デバッグに便利）

```typescript
mesh.material = new StandardMaterial('mat', scene)
mesh.material.wireframe = true
```

---

## 実装手順

### Step 1: 宇宙ステーションの床を作る

```typescript
const ground = MeshBuilder.CreateGround(
  'ground',
  { width: 20, height: 20, subdivisions: 20 },
  scene
)
ground.position.y = 0
```

`subdivisions` を増やすと、後でマテリアルのタイリングが細かくなる。

### Step 2: タワーのプレースホルダー（箱）を作る

```typescript
// 台座
const towerBase = MeshBuilder.CreateBox(
  'towerBase',
  { width: 1, height: 0.3, depth: 1 },
  scene
)
towerBase.position = new Vector3(0, 0.15, 0)

// 砲身（台座の子にする）
const towerBarrel = MeshBuilder.CreateCylinder(
  'towerBarrel',
  { height: 1.5, diameter: 0.3, tessellation: 8 },
  scene
)
towerBarrel.parent = towerBase
towerBarrel.position = new Vector3(0, 0.9, 0) // 台座の上に乗せる
```

### Step 3: 敵の仮置き（球）を作る

```typescript
const enemy = MeshBuilder.CreateSphere(
  'enemy',
  { diameter: 0.8, segments: 8 },
  scene
)
enemy.position = new Vector3(5, 0.4, 5)
```

### Step 4: デバッグ用の座標軸を表示する（任意）

```typescript
import { AxesViewer } from '@babylonjs/core'

const axes = new AxesViewer(scene, 2) // 長さ 2 の座標軸
```

---

## ポイント解説

### `tessellation` と `segments` の違い
- `tessellation`: 円柱・円錐などの円周分割数（少ないとカクカク、多いと滑らか）
- `segments`: 球の分割数（`segments: 8` で 8 角形に近い球）

パフォーマンスと見た目のバランスで調整する。

### `MeshBuilder.CreateGround` の `subdivisions`
後でテクスチャを貼るときや物理エンジンとの相互作用に影響する。  
平らな床なら `1` でも問題ない。

### Y 座標と「床に置く」計算
`CreateBox({ height: 0.3 })` の箱を床の上に置くには `position.y = 0.3 / 2 = 0.15`。  
箱の中心が基準点なので、高さの半分だけ上げる。

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
    // 宇宙ステーションの床
    const ground = MeshBuilder.CreateGround(
      'ground',
      { width: 20, height: 20, subdivisions: 20 },
      scene
    )
    ground.position.y = 0

    // タワーの台座
    const towerBase = MeshBuilder.CreateBox(
      'towerBase',
      { width: 1, height: 0.3, depth: 1 },
      scene
    )
    towerBase.position = new Vector3(0, 0.15, 0)

    // タワーの砲身（台座の子にする）
    const towerBarrel = MeshBuilder.CreateCylinder(
      'towerBarrel',
      { height: 1.5, diameter: 0.3, tessellation: 8 },
      scene
    )
    towerBarrel.parent = towerBase
    towerBarrel.position = new Vector3(0, 0.9, 0)

    // 敵の仮置き（球）
    const enemy = MeshBuilder.CreateSphere(
      'enemy',
      { diameter: 0.8, segments: 8 },
      scene
    )
    enemy.position = new Vector3(5, 0.4, 5)

    // 別の場所にもう一体配置
    const enemy2 = MeshBuilder.CreateSphere(
      'enemy2',
      { diameter: 0.8, segments: 8 },
      scene
    )
    enemy2.position = new Vector3(-3, 0.4, 4)

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
マウスドラッグでカメラが回転し、グレーの床・タワー・球が見えれば成功。  
まだ色がなく全部グレーだが、次の L04 でマテリアルを適用する。
