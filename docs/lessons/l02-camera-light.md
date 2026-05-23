# L02 — カメラと光

## 概要

3D シーンに「目」（カメラ）と「太陽」（ライト）を追加する。  
カメラを設定するまでシーンは何も映らない。ライトがないとメッシュは真っ黒になる。

**ゲームへの貢献**: タワーディフェンスに最適な `ArcRotateCamera`（オービットカメラ）と  
宇宙空間らしい環境光 + 太陽光を設定する。

---

## 概念解説

### カメラの種類

| カメラ            | 特徴                                | 向いているゲーム        |
| ----------------- | ----------------------------------- | ----------------------- |
| `ArcRotateCamera` | ターゲットを中心に球面上を移動      | タワーディフェンス・RTS |
| `FreeCamera`      | WASD + マウスで自由移動             | FPS・探索               |
| `UniversalCamera` | FreeCamera の上位互換（タッチ対応） | FPS・モバイル           |
| `FollowCamera`    | 指定メッシュを追いかける            | TPS・レース             |

今回は **`ArcRotateCamera`** を使う。

### ArcRotateCamera のパラメータ

```
ArcRotateCamera(name, alpha, beta, radius, target, scene)
```

| パラメータ | 説明                                                   |
| ---------- | ------------------------------------------------------ |
| `alpha`    | 水平方向の角度（ラジアン）。`-Math.PI / 2` で正面      |
| `beta`     | 垂直方向の角度（ラジアン）。`Math.PI / 3` で斜め上から |
| `radius`   | ターゲットからの距離                                   |
| `target`   | 注目点（`Vector3`）                                    |

```
        beta（↑下を向く / ↓上を向く）
          |
          |   /←── カメラ
          |  / radius
          | /
target ───┘──── alpha（→ 右回転 / ← 左回転）
```

### ライトの種類

| ライト             | 特徴                           | 用途           |
| ------------------ | ------------------------------ | -------------- |
| `HemisphericLight` | 上下から均等に照らす環境光     | 全体的な明るさ |
| `DirectionalLight` | 平行光線（方向のみ、位置なし） | 太陽光         |
| `PointLight`       | 点から全方向に照らす           | 電球・爆発光   |
| `SpotLight`        | コーン状に照らす               | スポット照明   |

### ライトの主要プロパティ

```typescript
light.intensity // 明るさ（0.0〜1.0 が標準、1.0 超も可）
light.diffuse // 物体に当たる光の色（Color3）
light.specular // 反射光の色（Color3）
light.groundColor // HemisphericLight のみ：下からの光の色
```

### Babylon.js の座標系

```
Y（上）
│
│   Z（手前）
│  /
│ /
└──────── X（右）
```

**左手座標系**（DirectX と同じ）。Three.js は右手座標系なので逆。

---

## 実装手順

### Step 1: ArcRotateCamera を作成する

```typescript
const camera = new ArcRotateCamera(
  'camera', // 名前
  -Math.PI / 2, // alpha: 正面を向く
  Math.PI / 3, // beta: 45度斜め上から
  20, // radius: ターゲットから 20 ユニット離れる
  Vector3.Zero(), // target: 原点を見る
  scene,
)
// マウス・タッチでカメラを操作できるようにする
camera.attachControl(canvasRef.current, true)
```

### Step 2: カメラの移動制限を設定する（タワーディフェンス向け）

```typescript
camera.lowerRadiusLimit = 5 // これ以上近づけない
camera.upperRadiusLimit = 40 // これ以上遠ざかれない
camera.lowerBetaLimit = 0.1 // 真上から見るのを防ぐ
camera.upperBetaLimit = Math.PI / 2.2 // 真横を見るのを防ぐ
```

### Step 3: HemisphericLight を作成する

```typescript
const hemisphericLight = new HemisphericLight(
  'hemisphericLight',
  new Vector3(0, 1, 0), // 真上から照らす
  scene,
)
hemisphericLight.intensity = 0.4
hemisphericLight.diffuse = new Color3(0.6, 0.7, 1.0) // 青白い光
hemisphericLight.groundColor = new Color3(0.1, 0.1, 0.2) // 下からは暗い光
```

### Step 4: DirectionalLight（太陽光）を追加する

```typescript
const sunLight = new DirectionalLight(
  'sunLight',
  new Vector3(-1, -2, -1), // 右斜め上から差し込む方向
  scene,
)
sunLight.intensity = 0.8
sunLight.diffuse = new Color3(1.0, 0.95, 0.8) // 温かみのある白
```

---

## ポイント解説

### `camera.attachControl()` を呼ぶ理由

呼ばないとマウスホイール・ドラッグでカメラを動かせない。  
第 2 引数 `true` はマウスイベントのデフォルト動作（スクロールなど）を防ぐ設定。

### `Vector3.Zero()` と `new Vector3(0, 0, 0)` は同じ

どちらも原点を表す。`Vector3.Zero()` は短く書けるユーティリティ。

### `Color3` vs `Color4`

- `Color3(r, g, b)` — 透明度なし（ライト・マテリアルの色に使う）
- `Color4(r, g, b, a)` — 透明度あり（`scene.clearColor` などに使う）

---

## 全体コード

### `app/game/page.tsx`

```tsx
import dynamic from 'next/dynamic'

const GameCanvas = dynamic(() => import('@/components/game/GameCanvas'), {
  ssr: false,
})

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
    // ArcRotateCamera: ターゲット（原点）を中心に球面上を移動するカメラ
    const camera = new ArcRotateCamera(
      'camera',
      -Math.PI / 2, // alpha: 水平角（正面を向く）
      Math.PI / 3, // beta:  垂直角（斜め上から）
      20, // radius: 原点からの距離
      Vector3.Zero(),
      scene,
    )
    camera.attachControl(canvasRef.current, true)

    // カメラの移動範囲を制限（タワーディフェンス向け）
    camera.lowerRadiusLimit = 5
    camera.upperRadiusLimit = 40
    camera.lowerBetaLimit = 0.1
    camera.upperBetaLimit = Math.PI / 2.2

    // ── Lights ───────────────────────────────────────────
    // 環境光（上から青白く、下からは暗く）
    const hemisphericLight = new HemisphericLight(
      'hemisphericLight',
      new Vector3(0, 1, 0),
      scene,
    )
    hemisphericLight.intensity = 0.4
    hemisphericLight.diffuse = new Color3(0.6, 0.7, 1.0)
    hemisphericLight.groundColor = new Color3(0.1, 0.1, 0.2)

    // 太陽光（斜めから差し込む平行光線）
    const sunLight = new DirectionalLight(
      'sunLight',
      new Vector3(-1, -2, -1),
      scene,
    )
    sunLight.intensity = 0.8
    sunLight.diffuse = new Color3(1.0, 0.95, 0.8)

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
まだメッシュが何もないので「暗い宇宙の背景」のまま。  
カメラが動作しているか確認するためには次の L03 でメッシュを追加してから。
