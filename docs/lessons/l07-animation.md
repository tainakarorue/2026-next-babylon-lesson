# L07 — アニメーション

## 概要

Babylon.js のキーフレームアニメーションを学び、タワーの設置演出・砲台の回転・敵の浮遊を実装する。

**ゲームへの貢献**: タワー設置時のスケールアップ演出、砲台が敵を追いかけて旋回する動き、敵の浮遊 hover アニメーション。

---

## 概念解説

### Babylon.js アニメーションの構造

```
Animation（アニメーションの定義）
  ├── 対象プロパティ（"position.y", "rotation.y", "scaling"...）
  ├── フレームレート（fps）
  ├── データ型（Float, Vector3, Color3...）
  ├── ループモード（Once, Cycle, Relative）
  └── キーフレーム配列（frame番号 → 値）

Animatable（再生コントローラー）
  ← scene.beginAnimation() で返ってくる
  ├── pause() / restart() / stop()
  └── onAnimationEndObservable
```

### Animation クラスの作成

```typescript
import { Animation, EasingFunction, CubicEase } from '@babylonjs/core'

const anim = new Animation(
  'myAnim',                           // アニメーション名
  'scaling',                          // 対象プロパティ（ドット記法可）
  30,                                 // フレームレート（fps）
  Animation.ANIMATIONTYPE_VECTOR3,    // データ型
  Animation.ANIMATIONLOOPMODE_ONCE    // ループモード
)

anim.setKeys([
  { frame: 0,  value: new Vector3(0, 0, 0) },
  { frame: 15, value: new Vector3(1.2, 1.2, 1.2) }, // 少しオーバーシュート
  { frame: 20, value: new Vector3(1, 1, 1) },
])
```

### ANIMATIONTYPE の種類

| 定数 | 型 | 用途 |
|---|---|---|
| `ANIMATIONTYPE_FLOAT` | `number` | position.y, rotation.y, alpha |
| `ANIMATIONTYPE_VECTOR3` | `Vector3` | position, rotation, scaling |
| `ANIMATIONTYPE_COLOR3` | `Color3` | マテリアルの色 |
| `ANIMATIONTYPE_QUATERNION` | `Quaternion` | rotationQuaternion |

### ANIMATIONLOOPMODE の種類

| 定数 | 動作 |
|---|---|
| `ANIMATIONLOOPMODE_ONCE` | 1 回だけ再生して停止 |
| `ANIMATIONLOOPMODE_CYCLE` | 最初から繰り返す（A→B→A→B） |
| `ANIMATIONLOOPMODE_RELATIVE` | 相対的に繰り返す（毎回 +1 など） |
| `ANIMATIONLOOPMODE_YOYO` | 往復繰り返す（A→B→A→B） |

### イージング関数

```typescript
const ease = new CubicEase()
ease.setEasingMode(EasingFunction.EASINGMODE_EASEOUT)
anim.setEasingFunction(ease)
```

| イージング | 効果 |
|---|---|
| `CubicEase` | なめらかな加速・減速 |
| `BackEase` | 少し行き過ぎてから戻る |
| `BounceEase` | バウンス |
| `ElasticEase` | バネのように振動 |

### アニメーションの再生

```typescript
// 単一アニメーションを開始
const animatable = scene.beginAnimation(
  mesh,   // 対象
  0,      // 開始フレーム
  20,     // 終了フレーム
  false,  // ループ
  1.0,    // 再生速度（1.0 = 等倍）
  () => { console.log('アニメーション終了') }  // 完了コールバック
)

animatable.pause()
animatable.restart()
animatable.stop()
```

### AnimationGroup（複数を同期）

```typescript
const group = new AnimationGroup('towerSpawn')
group.addTargetedAnimation(scaleAnim, base)
group.addTargetedAnimation(rotateAnim, barrel)
group.play(false) // false = ループなし
group.onAnimationGroupEndObservable.add(() => {
  console.log('グループ終了')
})
```

### `scene.registerBeforeRender` で毎フレームアニメーション

キーフレームを使わずに毎フレーム値を更新する方法。物理的な動きに向いている。

```typescript
let time = 0
scene.registerBeforeRender(() => {
  const delta = engine.getDeltaTime() / 1000
  time += delta
  mesh.position.y = Math.sin(time * 2) * 0.3 + 0.4 // 上下に浮遊
})
```

---

## 実装手順

### Step 1: タワー設置時のスケールアップ演出

```typescript
function playSpawnAnimation(mesh: Mesh): void {
  const scaleAnim = new Animation(
    'spawnScale',
    'scaling',
    60,
    Animation.ANIMATIONTYPE_VECTOR3,
    Animation.ANIMATIONLOOPMODE_ONCE
  )

  const ease = new BackEase(0.5) // 少しオーバーシュート
  ease.setEasingMode(EasingFunction.EASINGMODE_EASEOUT)
  scaleAnim.setEasingFunction(ease)

  scaleAnim.setKeys([
    { frame: 0,  value: new Vector3(0.01, 0.01, 0.01) },
    { frame: 20, value: new Vector3(1.1, 1.1, 1.1) },
    { frame: 25, value: new Vector3(1, 1, 1) },
  ])

  mesh.animations = [scaleAnim]
  scene.beginAnimation(mesh, 0, 25, false, 1.0)
}
```

### Step 2: 砲台が最寄りの敵を向く（毎フレーム更新）

```typescript
scene.registerBeforeRender(() => {
  for (const tower of towers) {
    const barrel = tower.getChildMeshes()[0]
    if (!barrel || enemies.length === 0) continue

    // 最も近い敵を探す
    let nearest = enemies[0]
    let minDist = Vector3.Distance(tower.position, enemies[0].position)
    for (const e of enemies) {
      const d = Vector3.Distance(tower.position, e.position)
      if (d < minDist) { minDist = d; nearest = e }
    }

    // 敵の方向を向く
    const dir = nearest.position.subtract(tower.position)
    tower.rotation.y = Math.atan2(dir.x, dir.z)
  }
})
```

### Step 3: 敵の浮遊アニメーション（サイン波）

```typescript
const enemyTimes = new Map<Mesh, number>()

scene.registerBeforeRender(() => {
  const delta = engine.getDeltaTime() / 1000
  for (const enemy of enemies) {
    const t = (enemyTimes.get(enemy) ?? 0) + delta
    enemyTimes.set(enemy, t)
    enemy.position.y = 0.4 + Math.sin(t * 2.5) * 0.15
    enemy.rotation.y += 0.3 * delta
  }
})
```

---

## ポイント解説

### キーフレームアニメーション vs 毎フレーム更新
- **キーフレーム**: 設置演出・死亡演出など「始まりと終わりが決まっている動き」に最適
- **毎フレーム**: 砲台追跡・浮遊など「状態に応じて変化し続ける動き」に最適

### `BackEase` のパラメータ
`new BackEase(amplitude)` — `amplitude` が大きいほど行き過ぎる量が増える。  
`0.5` が自然で、`2.0` にすると大げさな動きになる。

---

## 全体コード

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
  Animation,
  BackEase,
  EasingFunction,
} from '@babylonjs/core'
import { HavokPlugin } from '@babylonjs/core'
import HavokPhysics from '@babylonjs/havok'

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    let engine: Engine

    const init = async () => {
      engine = new Engine(canvasRef.current!, true)
      const scene = new Scene(engine)
      scene.clearColor = new Color4(0.02, 0.02, 0.05, 1)

      // ── Physics ────────────────────────────────────────
      const havokInstance = await HavokPhysics()
      const havokPlugin = new HavokPlugin(true, havokInstance)
      scene.enablePhysics(new Vector3(0, -9.81, 0), havokPlugin)

      // ── Camera ─────────────────────────────────────────
      const camera = new ArcRotateCamera(
        'camera', -Math.PI / 2, Math.PI / 3, 20, Vector3.Zero(), scene
      )
      camera.attachControl(canvasRef.current!, true)
      camera.lowerRadiusLimit = 5
      camera.upperRadiusLimit = 40
      camera.lowerBetaLimit = 0.1
      camera.upperBetaLimit = Math.PI / 2.2

      // ── Lights ─────────────────────────────────────────
      const hemisphericLight = new HemisphericLight('hemisphericLight', new Vector3(0, 1, 0), scene)
      hemisphericLight.intensity = 0.4
      hemisphericLight.diffuse = new Color3(0.6, 0.7, 1.0)
      hemisphericLight.groundColor = new Color3(0.1, 0.1, 0.2)

      const sunLight = new DirectionalLight('sunLight', new Vector3(-1, -2, -1), scene)
      sunLight.intensity = 0.8
      sunLight.diffuse = new Color3(1.0, 0.95, 0.8)

      // ── Meshes ─────────────────────────────────────────
      const ground = MeshBuilder.CreateGround('ground', { width: 20, height: 20, subdivisions: 1 }, scene)

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

      // ── Physics: 床 ────────────────────────────────────
      new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene)

      // ── Enemies ────────────────────────────────────────
      const enemies: Mesh[] = []
      const enemyTimes: number[] = []

      function spawnEnemy(position: Vector3): Mesh {
        const e = MeshBuilder.CreateSphere(`enemy_${enemies.length}`, { diameter: 0.8, segments: 8 }, scene)
        e.position = position.clone()
        e.material = enemyMat
        enemies.push(e)
        enemyTimes.push(Math.random() * Math.PI * 2) // ランダムなオフセット
        return e
      }

      spawnEnemy(new Vector3(5, 0.4, 5))
      spawnEnemy(new Vector3(-3, 0.4, 4))
      spawnEnemy(new Vector3(2, 0.4, -6))

      // ── Tower Spawn Animation ──────────────────────────
      function playSpawnAnimation(mesh: Mesh): void {
        const scaleAnim = new Animation(
          'spawnScale',
          'scaling',
          60,
          Animation.ANIMATIONTYPE_VECTOR3,
          Animation.ANIMATIONLOOPMODE_ONCE
        )
        const ease = new BackEase(0.5)
        ease.setEasingMode(EasingFunction.EASINGMODE_EASEOUT)
        scaleAnim.setEasingFunction(ease)
        scaleAnim.setKeys([
          { frame: 0,  value: new Vector3(0.01, 0.01, 0.01) },
          { frame: 20, value: new Vector3(1.1, 1.1, 1.1) },
          { frame: 25, value: new Vector3(1, 1, 1) },
        ])
        mesh.animations = [scaleAnim]
        scene.beginAnimation(mesh, 0, 25, false, 1.0)
      }

      // ── Tower Placement ────────────────────────────────
      const towers: Mesh[] = []

      function placeTower(position: Vector3): void {
        const gridX = Math.round(position.x)
        const gridZ = Math.round(position.z)
        const occupied = towers.some(
          (t) => Math.round(t.position.x) === gridX && Math.round(t.position.z) === gridZ
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
        playSpawnAnimation(base)
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

      // ── Per-Frame Update ───────────────────────────────
      scene.registerBeforeRender(() => {
        const delta = engine.getDeltaTime() / 1000

        // 敵の浮遊アニメーション
        for (let i = 0; i < enemies.length; i++) {
          enemyTimes[i] += delta
          enemies[i].position.y = 0.4 + Math.sin(enemyTimes[i] * 2.5) * 0.15
          enemies[i].rotation.y += 0.3 * delta
        }

        // タワーの砲身が最寄りの敵を向く
        for (const tower of towers) {
          if (enemies.length === 0) continue
          let nearest = enemies[0]
          let minDist = Vector3.Distance(tower.position, enemies[0].position)
          for (const e of enemies) {
            const d = Vector3.Distance(tower.position, e.position)
            if (d < minDist) { minDist = d; nearest = e }
          }
          const dir = nearest.position.subtract(tower.position)
          tower.rotation.y = Math.atan2(dir.x, dir.z)
        }
      })

      // ── Render Loop ────────────────────────────────────
      engine.runRenderLoop(() => { scene.render() })

      const handleResize = () => { engine.resize() }
      window.addEventListener('resize', handleResize)
    }

    init()

    return () => { engine?.dispose() }
  }, [])

  return (
    <canvas ref={canvasRef} style={{ width: '100%', height: '100vh', display: 'block' }} />
  )
}
```

---

## 確認方法

- 床をクリックするとタワーがポップアップするようにスケールアップする
- タワーの砲身が最も近い敵の方を向いて旋回する
- 敵が上下にふわふわ浮遊しながら自転する
