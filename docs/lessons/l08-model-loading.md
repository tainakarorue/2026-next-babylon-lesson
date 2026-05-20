# L08 — 3D モデル読み込み（GLTF/GLB）

## 概要

外部の 3D モデル（GLB 形式）を Babylon.js に読み込み、アニメーションを再生する。  
箱・球のプレースホルダーを実際のゲームモデルに置き換える。

**ゲームへの貢献**: 宇宙船の敵モデルとタワーモデルが本物の 3D アセットに変わる。

---

## 概念解説

### なぜ GLB 形式を使うか

| 形式 | 特徴 |
|---|---|
| `GLB` | バイナリ版 GLTF。テクスチャ・アニメーション込みで 1 ファイルに収まる。**推奨** |
| `GLTF` | JSON + 外部ファイル参照。デバッグしやすいが複数ファイルになる |
| `OBJ` | 旧来の形式。アニメーション非対応 |
| `FBX` | Autodesk 形式。GLB に変換して使う |

### SceneLoader でモデルを読み込む

```typescript
import { SceneLoader } from '@babylonjs/core'
import '@babylonjs/loaders/glTF' // GLTF ローダーを登録する副作用 import

const result = await SceneLoader.ImportMeshAsync(
  '',             // メッシュ名のフィルタ（'' = 全部）
  '/models/',     // ベース URL（public フォルダからの相対パス）
  'enemy.glb',    // ファイル名
  scene           // 対象シーン
)

// result のプロパティ
result.meshes          // 読み込んだ全メッシュの配列
result.animationGroups // アニメーショングループの配列
result.skeletons       // スケルトン（ボーン）の配列
result.particleSystems // パーティクルシステムの配列
```

### ルートメッシュと子メッシュ

GLB ファイルを読み込むと自動的に `__root__` という空のルートメッシュが作られる。  
実際のモデルパーツはその子メッシュとして階層化される。

```typescript
const rootMesh = result.meshes[0] // __root__ メッシュ
rootMesh.position = new Vector3(5, 0, 5)
rootMesh.scaling = new Vector3(0.5, 0.5, 0.5)
```

### アニメーションの再生

```typescript
const flyAnim = result.animationGroups.find(g => g.name === 'Fly')
if (flyAnim) {
  flyAnim.start(true) // true = ループ再生
}

// 全アニメーションを止める
result.animationGroups.forEach(g => g.stop())

// 速度を変えて再生
flyAnim.start(true, 2.0) // 2 倍速
```

### メッシュのクローン（同じモデルを複数配置）

```typescript
// 重い: インポートを複数回呼ぶ
// 軽い: クローンを使う
const clone = rootMesh.clone('enemy_clone', null)
clone.position = new Vector3(-3, 0, 4)
```

### instantiateHierarchy（より効率的なクローン）

```typescript
const instance = rootMesh.instantiateHierarchy(null, { doNotInstantiate: false })
if (instance) {
  instance.position = new Vector3(2, 0, 6)
}
```

### AssetManager（複数アセットの事前ロード）

```typescript
import { AssetsManager, MeshAssetTask } from '@babylonjs/core'

const assetsManager = new AssetsManager(scene)

const enemyTask = assetsManager.addMeshTask('enemy', '', '/models/', 'enemy.glb')
const towerTask = assetsManager.addMeshTask('tower', '', '/models/', 'tower.glb')

assetsManager.onProgress = (remaining, total) => {
  console.log(`${total - remaining} / ${total} ロード完了`)
}

assetsManager.onFinish = (tasks) => {
  console.log('全アセットのロード完了')
  // ゲーム開始処理
}

await assetsManager.loadAsync()
```

---

## 練習用モデルの入手方法

このレッスンでは Babylon.js 公式のサンプルモデルを使う。  
`public/models/` フォルダを作り、以下のファイルを配置する。

**推奨サンプル（Babylon.js 公式）**:
- Babylon.js Sandbox (`sandbox.babylonjs.com`) でモデルを確認できる
- Sketchfab (sketchfab.com) で CC0 ライセンスのモデルを探す
- Quaternius (quaternius.com) で無料ゲーム用モデルを入手できる

このレッスンではモデルがない場合でも、コードの骨格を理解することが目標。  
モデルがない場合は箱で代替する `fallback` 実装を用意している。

---

## 実装手順

### Step 1: `@babylonjs/loaders` の GLTF サポートを有効化

```typescript
// import するだけで GLTF ローダーが登録される
import '@babylonjs/loaders/glTF'
```

### Step 2: `public/models/` フォルダを作成してモデルを配置

```
public/
  models/
    enemy.glb
    tower.glb
```

### Step 3: モデルを非同期で読み込む

```typescript
let enemyTemplate: Mesh | null = null

try {
  const result = await SceneLoader.ImportMeshAsync('', '/models/', 'enemy.glb', scene)
  enemyTemplate = result.meshes[0] as Mesh
  enemyTemplate.setEnabled(false) // テンプレートは非表示にする
} catch {
  // モデルがない場合は球で代替
  enemyTemplate = MeshBuilder.CreateSphere('enemyTemplate', { diameter: 0.8, segments: 8 }, scene)
  enemyTemplate.setEnabled(false)
}
```

### Step 4: クローンで敵を生成する

```typescript
function spawnEnemyFromModel(position: Vector3): Mesh | null {
  if (!enemyTemplate) return null
  const clone = enemyTemplate.clone(`enemy_${Date.now()}`, null)
  if (!clone) return null
  clone.setEnabled(true)
  clone.position = position.clone()
  clone.scaling = new Vector3(0.5, 0.5, 0.5)
  return clone
}
```

---

## ポイント解説

### `setEnabled(false)` でテンプレートを非表示に
クローン元のテンプレートはシーンに表示されないようにする。  
`isVisible = false` と違い、`setEnabled(false)` は子メッシュも含めて全部非表示になる。

### モデルのスケールと座標系
ツール（Blender など）によってエクスポート時のスケールが異なる。  
読み込んだ後に `scaling` を調整するか、Blender でエクスポート時に統一する。

### `@babylonjs/loaders` の副作用インポート
`import '@babylonjs/loaders/glTF'` は値を使わず、モジュールの副作用（ローダーの登録）だけを利用する。  
これを書き忘れると GLB ファイルが読み込めずにエラーになる。

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
  SceneLoader,
  AssetsManager,
} from '@babylonjs/core'
import { HavokPlugin } from '@babylonjs/core'
import HavokPhysics from '@babylonjs/havok'
import '@babylonjs/loaders/glTF'

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

      // ── Ground ─────────────────────────────────────────
      const ground = MeshBuilder.CreateGround('ground', { width: 20, height: 20, subdivisions: 1 }, scene)
      const groundMat = new PBRMaterial('groundMat', scene)
      groundMat.albedoColor = new Color3(0.15, 0.15, 0.2)
      groundMat.metallic = 0.8
      groundMat.roughness = 0.5
      ground.material = groundMat
      new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene)

      // ── Materials ──────────────────────────────────────
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

      // ── Asset Loading ──────────────────────────────────
      // 敵モデルのテンプレートを作成
      // モデルファイルがあれば GLB を読み込み、なければ球で代替する
      let enemyTemplate: Mesh

      try {
        const result = await SceneLoader.ImportMeshAsync('', '/models/', 'enemy.glb', scene)
        enemyTemplate = result.meshes[0] as Mesh
        enemyTemplate.name = 'enemyTemplate'
        enemyTemplate.setEnabled(false)

        // 付属アニメーションがあれば確認
        result.animationGroups.forEach((g) => {
          console.log('アニメーション:', g.name)
          g.stop()
        })
      } catch {
        // GLB がない場合は球で代替
        enemyTemplate = MeshBuilder.CreateSphere('enemyTemplate', { diameter: 0.8, segments: 8 }, scene)
        enemyTemplate.material = enemyMat
        enemyTemplate.setEnabled(false)
      }

      // タワーモデルのテンプレート
      let towerTemplate: Mesh | null = null

      try {
        const result = await SceneLoader.ImportMeshAsync('', '/models/', 'tower.glb', scene)
        towerTemplate = result.meshes[0] as Mesh
        towerTemplate.name = 'towerTemplate'
        towerTemplate.setEnabled(false)
      } catch {
        // GLB がない場合は null のまま（箱で代替）
        towerTemplate = null
      }

      // ── Enemy Spawn ────────────────────────────────────
      const enemies: Mesh[] = []
      const enemyTimes: number[] = []

      function spawnEnemy(position: Vector3): void {
        let mesh: Mesh
        const clone = enemyTemplate.clone(`enemy_${enemies.length}`, null)
        if (clone) {
          mesh = clone
          mesh.setEnabled(true)
        } else {
          mesh = MeshBuilder.CreateSphere(`enemy_${enemies.length}`, { diameter: 0.8, segments: 8 }, scene)
          mesh.material = enemyMat
        }
        mesh.position = position.clone()
        mesh.scaling = new Vector3(0.5, 0.5, 0.5)
        enemies.push(mesh)
        enemyTimes.push(Math.random() * Math.PI * 2)
      }

      spawnEnemy(new Vector3(5, 0.5, 5))
      spawnEnemy(new Vector3(-3, 0.5, 4))
      spawnEnemy(new Vector3(2, 0.5, -6))

      // ── Tower Spawn Animation ──────────────────────────
      function playSpawnAnimation(mesh: Mesh): void {
        const scaleAnim = new Animation(
          'spawnScale', 'scaling', 60,
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

        let base: Mesh
        if (towerTemplate) {
          const clone = towerTemplate.clone(`tower_${towers.length}`, null)
          if (clone) {
            base = clone
            base.setEnabled(true)
            base.position = new Vector3(gridX, 0, gridZ)
            base.scaling = new Vector3(0.5, 0.5, 0.5)
          } else {
            base = MeshBuilder.CreateBox(`tower_${towers.length}`, { width: 1, height: 0.3, depth: 1 }, scene)
            base.position = new Vector3(gridX, 0.15, gridZ)
            base.material = towerBaseMat
          }
        } else {
          base = MeshBuilder.CreateBox(`towerBase_${towers.length}`, { width: 1, height: 0.3, depth: 1 }, scene)
          base.position = new Vector3(gridX, 0.15, gridZ)
          base.material = towerBaseMat

          const barrel = MeshBuilder.CreateCylinder(
            `towerBarrel_${towers.length}`, { height: 1.5, diameter: 0.3, tessellation: 8 }, scene
          )
          barrel.parent = base
          barrel.position = new Vector3(0, 0.9, 0)
          barrel.material = barrelMat
        }

        new PhysicsAggregate(base, PhysicsShapeType.BOX, { mass: 0 }, scene)
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
        for (let i = 0; i < enemies.length; i++) {
          enemyTimes[i] += delta
          enemies[i].position.y = 0.5 + Math.sin(enemyTimes[i] * 2.5) * 0.15
          enemies[i].rotation.y += 0.3 * delta
        }
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

- `public/models/enemy.glb` を配置すると、球の代わりにモデルが表示される
- モデルがない状態でも球で動作する（フォールバック実装）
- コンソールにアニメーション名が表示される（モデルにアニメーションが含まれている場合）
