# L05 — ユーザー入力とインタラクション

## 概要

キーボード・マウス入力を受け取り、床クリックでタワーを設置するインタラクションを実装する。  
Ray キャストで「3D 空間のどこをクリックしたか」を検出する方法を学ぶ。

**ゲームへの貢献**: 床をクリックしてタワーを設置するコアメカニクスが動作する。  
Phase 1 の集大成。

---

## 概念解説

### ポインターイベント（クリック・タップ共通）

```typescript
scene.onPointerObservable.add((pointerInfo) => {
  switch (pointerInfo.type) {
    case PointerEventTypes.POINTERDOWN:  // マウスボタン押下 / タッチ開始
    case PointerEventTypes.POINTERUP:    // マウスボタン離す / タッチ終了
    case PointerEventTypes.POINTERMOVE:  // マウス移動 / タッチ移動
    case PointerEventTypes.POINTERPICK:  // クリック（押して離した）
    case PointerEventTypes.POINTERWHEEL: // ホイール操作
  }
})
```

### Ray キャスト（3D 空間の選択）

スクリーン上のクリック位置から 3D 空間に「光線」を飛ばし、  
光線が当たったメッシュとその位置を取得する。

```
スクリーン(2D)
  ┌────────────────┐
  │                │
  │   ●(クリック)  │ ─── Ray（光線）──▶  [メッシュに当たる]
  │                │
  └────────────────┘
```

```typescript
scene.onPointerObservable.add((pointerInfo) => {
  if (pointerInfo.type === PointerEventTypes.POINTERPICK) {
    const pickResult = pointerInfo.pickInfo
    if (pickResult?.hit && pickResult.pickedMesh) {
      const hitPoint = pickResult.pickedPoint  // Vector3: 当たった位置
      const hitMesh = pickResult.pickedMesh    // 当たったメッシュ
    }
  }
})
```

### `scene.pick()` で手動 Ray キャスト

```typescript
const pickResult = scene.pick(scene.pointerX, scene.pointerY)
if (pickResult.hit) {
  console.log(pickResult.pickedPoint)
}
```

### キーボード入力

```typescript
const keysDown = new Set<string>()

scene.actionManager = new ActionManager(scene)

scene.actionManager.registerAction(
  new ExecuteCodeAction(ActionManager.OnKeyDownTrigger, (evt) => {
    keysDown.add(evt.sourceEvent.code) // 'Space', 'KeyW', 'KeyA' etc.
  })
)
scene.actionManager.registerAction(
  new ExecuteCodeAction(ActionManager.OnKeyUpTrigger, (evt) => {
    keysDown.delete(evt.sourceEvent.code)
  })
)
```

### `scene.registerBeforeRender` でフレームごとに処理

```typescript
scene.registerBeforeRender(() => {
  if (keysDown.has('KeyW')) {
    // W キーが押されている間、毎フレーム実行
  }
})
```

### デルタタイム（フレームレート非依存の移動）

```typescript
scene.registerBeforeRender(() => {
  const delta = engine.getDeltaTime() / 1000  // ミリ秒→秒
  mesh.position.x += 5 * delta  // 毎秒 5 ユニット移動（フレームレートに依存しない）
})
```

60fps なら `delta ≒ 0.0167`、30fps なら `delta ≒ 0.0333`。  
どちらも `5 * delta` を足すと 1 秒で 5 ユニット進む。

---

## 実装手順

### Step 1: タワーを動的に設置する関数を作る

```typescript
const towers: Mesh[] = []

function placeTower(position: Vector3): void {
  // 既にタワーがある場所には設置しない
  const gridX = Math.round(position.x)
  const gridZ = Math.round(position.z)
  const occupied = towers.some(
    (t) => Math.round(t.position.x) === gridX && Math.round(t.position.z) === gridZ
  )
  if (occupied) return

  const base = MeshBuilder.CreateBox('towerBase', { width: 1, height: 0.3, depth: 1 }, scene)
  base.position = new Vector3(gridX, 0.15, gridZ)

  const barrel = MeshBuilder.CreateCylinder(
    'towerBarrel',
    { height: 1.5, diameter: 0.3, tessellation: 8 },
    scene
  )
  barrel.parent = base
  barrel.position = new Vector3(0, 0.9, 0)
  barrel.material = barrelMat

  base.material = towerBaseMat
  towers.push(base)
}
```

### Step 2: 床クリックでタワーを設置する

```typescript
scene.onPointerObservable.add((pointerInfo) => {
  if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return
  const pick = pointerInfo.pickInfo
  if (!pick?.hit || !pick.pickedMesh || !pick.pickedPoint) return

  // 床だけに反応する
  if (pick.pickedMesh.name === 'ground') {
    placeTower(pick.pickedPoint)
  }
})
```

### Step 3: キーボードで操作を追加する（Escape でキャンセル等）

```typescript
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
```

---

## ポイント解説

### グリッドスナッピング
`Math.round(position.x)` で設置位置を整数にスナップする。  
タワーディフェンスはグリッドベースが多いのでこのパターンが基本。

### `POINTERPICK` vs `POINTERDOWN`
- `POINTERDOWN`: 押した瞬間（ドラッグ開始にも反応する）
- `POINTERPICK`: 押して離した（ドラッグでは発火しない）← タワー設置に適切

### `camera.attachControl` との競合
`ArcRotateCamera.attachControl` もポインターイベントを消費する。  
`onPointerObservable` は競合なく両方動作するので問題ない。

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
  Mesh,
  PBRMaterial,
  StandardMaterial,
  ActionManager,
  ExecuteCodeAction,
  PointerEventTypes,
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

    // 敵の仮置き
    const enemy = MeshBuilder.CreateSphere('enemy', { diameter: 0.8, segments: 8 }, scene)
    enemy.position = new Vector3(5, 0.4, 5)

    const enemy2 = MeshBuilder.CreateSphere('enemy2', { diameter: 0.8, segments: 8 }, scene)
    enemy2.position = new Vector3(-3, 0.4, 4)

    // ── Materials ────────────────────────────────────────
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
    enemyMat.specularColor = new Color3(1, 0.5, 0.5)
    enemyMat.specularPower = 32
    enemy.material = enemyMat
    enemy2.material = enemyMat

    // ── Tower Placement System ────────────────────────────
    const towers: Mesh[] = []

    function placeTower(position: Vector3): void {
      // グリッドにスナップ（1 マス = 1 ユニット）
      const gridX = Math.round(position.x)
      const gridZ = Math.round(position.z)

      // 同じグリッドに既にタワーがあればスキップ
      const occupied = towers.some(
        (t) =>
          Math.round(t.position.x) === gridX &&
          Math.round(t.position.z) === gridZ
      )
      if (occupied) return

      // 床の範囲外ならスキップ（床は -10〜10 の範囲）
      if (Math.abs(gridX) > 9 || Math.abs(gridZ) > 9) return

      const base = MeshBuilder.CreateBox(
        `towerBase_${towers.length}`,
        { width: 1, height: 0.3, depth: 1 },
        scene
      )
      base.position = new Vector3(gridX, 0.15, gridZ)
      base.material = towerBaseMat

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

    // ── Input: ポインターイベント ─────────────────────────
    scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return
      const pick = pointerInfo.pickInfo
      if (!pick?.hit || !pick.pickedMesh || !pick.pickedPoint) return

      // 床をクリックしたときだけタワーを設置
      if (pick.pickedMesh.name === 'ground') {
        placeTower(pick.pickedPoint)
      }
    })

    // ── Input: キーボードイベント ─────────────────────────
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

    // フレームごとの更新（デルタタイムで速度を均一化）
    scene.registerBeforeRender(() => {
      const delta = engine.getDeltaTime() / 1000

      // Space キーでカメラをリセット（例）
      if (keysDown.has('Space')) {
        camera.alpha = -Math.PI / 2
        camera.beta = Math.PI / 3
        camera.radius = 20
      }

      // 敵をゆっくり回転させる（仮のアニメーション）
      enemy.rotation.y += 0.5 * delta
      enemy2.rotation.y += 0.8 * delta
    })

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

- 床をクリックするとタワーが設置される
- 同じマスに 2 個設置しようとしてもスキップされる
- Space キーでカメラがリセットされる
- 赤い球が自転している

**Phase 1 完了**: インタラクティブな 3D シーンの雛形が完成した。
