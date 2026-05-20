# L06 — 物理エンジン（Havok）

## 概要

Babylon.js の Havok 物理プラグインを導入し、剛体シミュレーションを実装する。  
弾丸が物理的に飛んで敵に当たり、衝突を検知する。

**ゲームへの貢献**: タワーが弾を物理的に発射し、敵に当たる衝突判定が完成する。

---

## 概念解説

### Babylon.js の物理プラグイン

| プラグイン | 特徴 |
|---|---|
| `HavokPlugin` | 高性能・精度が高い。Babylon.js 公式推奨。WebAssembly ベース |
| `CannonJSPlugin` | 軽量・シンプル。旧来のプロジェクトで使われる |
| `AmmoJSPlugin` | Bullet 物理エンジンの JS ポート |

このゲームでは **HavokPlugin** を使う。

### 物理の有効化

```typescript
import HavokPhysics from '@babylonjs/havok'
import { HavokPlugin } from '@babylonjs/core'

// Havok WASM を非同期で初期化
const havokInstance = await HavokPhysics()
const havokPlugin = new HavokPlugin(true, havokInstance)

// シーンに物理を設定（重力: Y 方向に -9.81）
scene.enablePhysics(new Vector3(0, -9.81, 0), havokPlugin)
```

### PhysicsAggregate（物理ボディのアタッチ）

`PhysicsAggregate` でメッシュに物理ボディを付与する。

```typescript
import { PhysicsAggregate, PhysicsShapeType } from '@babylonjs/core'

const aggregate = new PhysicsAggregate(
  mesh,                    // 対象メッシュ
  PhysicsShapeType.BOX,    // 当たり判定の形状
  {
    mass: 1,               // 質量（0 = 静的ボディ）
    restitution: 0.3,      // 反発係数（0=跳ねない, 1=完全弾性）
    friction: 0.5,         // 摩擦係数
  },
  scene
)
```

### PhysicsShapeType の種類

| 型 | 用途 |
|---|---|
| `BOX` | 箱形メッシュ |
| `SPHERE` | 球形メッシュ |
| `CAPSULE` | カプセル（キャラクター向け） |
| `CYLINDER` | 円柱 |
| `MESH` | メッシュの形状をそのまま使う（重い・静的推奨） |
| `CONVEX_HULL` | 凸包（複雑形状の動的ボディに） |

### 静的ボディ vs 動的ボディ

| | `mass: 0` | `mass: > 0` |
|---|---|---|
| 動き | 動かない（静的） | 物理に従って動く |
| 用途 | 床・壁・障害物 | 弾丸・落下物・キャラクター |

### 力とインパルスの適用

```typescript
// 継続的な力（エンジンのような継続力）
aggregate.body.applyForce(new Vector3(0, 10, 0), mesh.getAbsolutePosition())

// 瞬発力（爆発・発射など）
aggregate.body.applyImpulse(new Vector3(0, 5, 0), mesh.getAbsolutePosition())

// 速度を直接セット
aggregate.body.setLinearVelocity(new Vector3(0, 0, 10))
```

### 衝突イベント

```typescript
// 衝突トリガーを有効化
aggregate.body.setCollisionCallbackEnabled(true)

scene.onAfterPhysicsObservable.add(() => {
  // 衝突ペアを取得
  const collisions = havokPlugin.getCollisionsForBody(aggregate.body)
  for (const collision of collisions) {
    // collision.collidedAgainst: 衝突相手のボディ
    console.log('衝突！')
  }
})
```

---

## インストール

```bash
npm install @babylonjs/havok
```

---

## 実装手順

### Step 1: 物理を有効化する

`useEffect` の中で `await` を使いたいので、即時実行関数でラップする。

```typescript
useEffect(() => {
  if (!canvasRef.current) return

  let engine: Engine
  let scene: Scene

  const init = async () => {
    engine = new Engine(canvasRef.current!, true)
    scene = new Scene(engine)
    // ...

    // Havok 物理を初期化
    const havokInstance = await HavokPhysics()
    const havokPlugin = new HavokPlugin(true, havokInstance)
    scene.enablePhysics(new Vector3(0, -9.81, 0), havokPlugin)

    // ...
  }

  init()

  return () => {
    engine?.dispose()
  }
}, [])
```

### Step 2: 床と障害物に静的物理ボディを付与する

```typescript
new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene)
```

### Step 3: 弾丸発射システムを作る

```typescript
function fireBullet(from: Vector3, direction: Vector3): void {
  const bullet = MeshBuilder.CreateSphere('bullet', { diameter: 0.2, segments: 4 }, scene)
  bullet.position = from.clone()
  bullet.material = bulletMat

  const agg = new PhysicsAggregate(bullet, PhysicsShapeType.SPHERE, { mass: 0.1 }, scene)

  // 発射方向に速度を設定
  const speed = 15
  agg.body.setLinearVelocity(direction.scale(speed))

  // 3 秒後に自動削除
  setTimeout(() => {
    agg.dispose()
    bullet.dispose()
  }, 3000)
}
```

---

## ポイント解説

### `PhysicsAggregate` と `PhysicsImpostor` の違い
`PhysicsImpostor` は旧 API（非推奨）。  
Havok と新しい物理 API では `PhysicsAggregate` を使う。

### 宇宙ゲームで重力を切る
タワーディフェンスは床の上のゲームなので重力は必要だが、  
宇宙船のような浮遊物は `mass: 0` にして手動で位置を更新する方が制御しやすい。

### ハイブリッドアプローチ
物理エンジンはすべてに使わない。  
- 弾丸の衝突判定 → 物理
- 敵の移動 → 手動（transform を直接更新）
- タワーの回転 → アニメーション

---

## 全体コード

### `package.json` への追加（インストール後）

```json
{
  "dependencies": {
    "@babylonjs/havok": "^1.3.0"
  }
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
  Mesh,
  PBRMaterial,
  StandardMaterial,
  ActionManager,
  ExecuteCodeAction,
  PointerEventTypes,
  PhysicsAggregate,
  PhysicsShapeType,
} from '@babylonjs/core'
import { HavokPlugin } from '@babylonjs/core'
import HavokPhysics from '@babylonjs/havok'

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    let engine: Engine

    const init = async () => {
      // ── Engine & Scene ─────────────────────────────────
      engine = new Engine(canvasRef.current!, true)
      const scene = new Scene(engine)
      scene.clearColor = new Color4(0.02, 0.02, 0.05, 1)

      // ── Physics ────────────────────────────────────────
      const havokInstance = await HavokPhysics()
      const havokPlugin = new HavokPlugin(true, havokInstance)
      scene.enablePhysics(new Vector3(0, -9.81, 0), havokPlugin)

      // ── Camera ─────────────────────────────────────────
      const camera = new ArcRotateCamera(
        'camera',
        -Math.PI / 2,
        Math.PI / 3,
        20,
        Vector3.Zero(),
        scene
      )
      camera.attachControl(canvasRef.current!, true)
      camera.lowerRadiusLimit = 5
      camera.upperRadiusLimit = 40
      camera.lowerBetaLimit = 0.1
      camera.upperBetaLimit = Math.PI / 2.2

      // ── Lights ─────────────────────────────────────────
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

      // ── Meshes ─────────────────────────────────────────
      const ground = MeshBuilder.CreateGround(
        'ground',
        { width: 20, height: 20, subdivisions: 1 },
        scene
      )

      const enemy = MeshBuilder.CreateSphere('enemy', { diameter: 0.8, segments: 8 }, scene)
      enemy.position = new Vector3(5, 3, 5)  // 少し高い位置から落とす

      // ── Materials ──────────────────────────────────────
      const groundMat = new PBRMaterial('groundMat', scene)
      groundMat.albedoColor = new Color3(0.15, 0.15, 0.2)
      groundMat.metallic = 0.8
      groundMat.roughness = 0.5
      ground.material = groundMat

      const towerBaseMat = new PBRMaterial('towerBaseMat', scene)
      towerBaseMat.albedoColor = new Color3(0.3, 0.35, 0.4)
      towerBaseMat.metallic = 0.9
      towerBaseMat.roughness = 0.2

      const barrelMat = new PBRMaterial('barrelMat', scene)
      barrelMat.albedoColor = new Color3(0.1, 0.3, 0.8)
      barrelMat.metallic = 0.5
      barrelMat.roughness = 0.1
      barrelMat.emissiveColor = new Color3(0, 0.5, 1.0)
      barrelMat.emissiveIntensity = 1.5

      const enemyMat = new StandardMaterial('enemyMat', scene)
      enemyMat.diffuseColor = new Color3(0.8, 0.1, 0.1)
      enemyMat.emissiveColor = new Color3(0.3, 0, 0)
      enemy.material = enemyMat

      const bulletMat = new PBRMaterial('bulletMat', scene)
      bulletMat.albedoColor = new Color3(1.0, 0.8, 0.0)
      bulletMat.emissiveColor = new Color3(1.0, 0.5, 0.0)
      bulletMat.emissiveIntensity = 2.0
      bulletMat.metallic = 0
      bulletMat.roughness = 0

      // ── Physics Bodies ─────────────────────────────────
      // 床は静的ボディ（mass: 0）
      new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0, restitution: 0.2 }, scene)

      // 敵は動的ボディ（mass > 0）
      const enemyAggregate = new PhysicsAggregate(
        enemy,
        PhysicsShapeType.SPHERE,
        { mass: 1, restitution: 0.5, friction: 0.3 },
        scene
      )

      // ── Tower Placement ────────────────────────────────
      const towers: Mesh[] = []

      function placeTower(position: Vector3): void {
        const gridX = Math.round(position.x)
        const gridZ = Math.round(position.z)

        const occupied = towers.some(
          (t) =>
            Math.round(t.position.x) === gridX &&
            Math.round(t.position.z) === gridZ
        )
        if (occupied) return
        if (Math.abs(gridX) > 9 || Math.abs(gridZ) > 9) return

        const base = MeshBuilder.CreateBox(
          `towerBase_${towers.length}`,
          { width: 1, height: 0.3, depth: 1 },
          scene
        )
        base.position = new Vector3(gridX, 0.15, gridZ)
        base.material = towerBaseMat

        new PhysicsAggregate(base, PhysicsShapeType.BOX, { mass: 0 }, scene)

        const barrel = MeshBuilder.CreateCylinder(
          `towerBarrel_${towers.length}`,
          { height: 1.5, diameter: 0.3, tessellation: 8 },
          scene
        )
        barrel.parent = base
        barrel.position = new Vector3(0, 0.9, 0)
        barrel.material = barrelMat

        towers.push(base)
      }

      // ── Bullet Firing System ──────────────────────────
      function fireBullet(from: Vector3, target: Vector3): void {
        const bullet = MeshBuilder.CreateSphere(
          'bullet',
          { diameter: 0.2, segments: 4 },
          scene
        )
        bullet.position = from.clone()
        bullet.material = bulletMat

        const bulletAgg = new PhysicsAggregate(
          bullet,
          PhysicsShapeType.SPHERE,
          { mass: 0.05, restitution: 0.1 },
          scene
        )

        const direction = target.subtract(from).normalize()
        bulletAgg.body.setLinearVelocity(direction.scale(15))

        // 3 秒後に自動削除
        setTimeout(() => {
          bulletAgg.dispose()
          bullet.dispose()
        }, 3000)
      }

      // ── Input ──────────────────────────────────────────
      scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return
        const pick = pointerInfo.pickInfo
        if (!pick?.hit || !pick.pickedMesh || !pick.pickedPoint) return

        if (pick.pickedMesh.name === 'ground') {
          placeTower(pick.pickedPoint)
        }
      })

      const keysDown = new Set<string>()
      scene.actionManager = new ActionManager(scene)
      scene.actionManager.registerAction(
        new ExecuteCodeAction(ActionManager.OnKeyDownTrigger, (evt) => {
          keysDown.add(evt.sourceEvent.code)
        })
      )
      scene.actionManager.registerAction(
        new ExecuteCodeAction(ActionManager.OnKeyUpTrigger, (evt) => {
          keysDown.delete(evt.sourceEvent.code)
        })
      )

      // F キーで弾を発射（デモ）
      scene.actionManager.registerAction(
        new ExecuteCodeAction(
          { trigger: ActionManager.OnKeyUpTrigger, parameter: 'f' },
          () => {
            fireBullet(new Vector3(0, 1, 0), enemy.position)
          }
        )
      )

      // ── Render Loop ────────────────────────────────────
      engine.runRenderLoop(() => {
        scene.render()
      })

      const handleResize = () => {
        engine.resize()
      }
      window.addEventListener('resize', handleResize)
    }

    init()

    return () => {
      engine?.dispose()
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

- 赤い球が高い位置から落下して床で跳ねる
- 床をクリックしてタワーを設置すると、そこに物理ボディが付与される
- `f` キーを押すと弾が敵に向かって発射される
