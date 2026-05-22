# L01 — Babylon.js のセットアップ

## 概要

Babylon.js を Next.js App Router に組み込む最小構成を作る。  
「背景色だけが表示された Canvas」が動けば成功。

**ゲームへの貢献**: すべてのレッスンの土台。ここが動けばあとは機能を積み上げるだけ。

---

## インストール

```bash
npm install @babylonjs/core @babylonjs/loaders @babylonjs/gui @babylonjs/materials
```

---

## 概念解説

### Engine・Scene の関係

```
Canvas（HTML要素）
  └── Engine   ← WebGL コンテキストを管理。レンダリングループを回す
        └── Scene  ← 3D 世界そのもの。カメラ・光・メッシュが住む空間
```

- **Engine**: `canvas` を受け取り、WebGL の初期化・フレーム管理を担う
- **Scene**: ゲームの「ステージ」。すべての 3D オブジェクトはシーンに属する
- `engine.runRenderLoop(fn)`: 毎フレーム（通常 60fps）呼ばれるループ

### Next.js SSR との共存

Babylon.js は `window` や `document` など**ブラウザ専用 API** を使うため、  
サーバーサイドレンダリング（SSR）環境では動かない。

**解決策（3 点セット）**:

| 対処                                                      | 理由                                        |
| --------------------------------------------------------- | ------------------------------------------- |
| コンポーネントに `'use client'` をつける                  | React が SSR でレンダリングしないようにする |
| `useEffect` の中でのみ Babylon.js を初期化                | `useEffect` はブラウザでしか実行されない    |
| ページから `next/dynamic` + `{ ssr: false }` でインポート | サーバーで import 自体を実行しない          |

```
page.tsx（Server Component）
  └── dynamic(() => import('./GameCanvas'), { ssr: false })
        └── GameCanvas.tsx（'use client'）
              └── useEffect 内 ← Babylon.js をここで初期化
```

### クリーンアップが必要な理由

React の開発モードでは `useEffect` が 2 回実行される（StrictMode）。  
`engine.dispose()` を呼ばないと WebGL コンテキストが残り続け、  
ブラウザのコンテキスト数上限に達してクラッシュする。

---

## 実装手順

### Step 1: フォルダ構成を作る

```
components/
  game/
    GameCanvas.tsx   ← 新規作成
app/
  game/
    page.tsx         ← 新規作成
```

### Step 2: GameCanvas.tsx を作る

1. `'use client'` を先頭に書く
2. `useRef<HTMLCanvasElement>` で canvas 要素への参照を用意する
3. `useEffect` の中で `new Engine(canvas, true)` を呼ぶ
4. `new Scene(engine)` でシーンを作る
5. `scene.clearColor = new Color4(...)` で背景色を指定する
6. `engine.runRenderLoop(() => { scene.render() })` でループ開始
7. `window.addEventListener('resize', () => engine.resize())` でリサイズ対応
8. return 関数で `window.removeEventListener` と `engine.dispose()` を呼ぶ
9. JSX で `<canvas ref={canvasRef} />` を返す

### Step 3: app/game/page.tsx を作る

1. `next/dynamic` で GameCanvas を `ssr: false` でインポートする
2. `<main>` の中に `<GameCanvas />` を配置する

---

## ポイント解説

### `Color4` の引数

`new Color4(r, g, b, a)` — 各値は **0.0〜1.0**。  
宇宙の黒: `new Color4(0.02, 0.02, 0.05, 1)`

### `new Engine(canvas, true)` の第 2 引数

`true` でアンチエイリアス（ジャギー低減）が有効になる。  
パフォーマンスを優先したい場合は `false` にする。

### `engine.runRenderLoop` vs `requestAnimationFrame`

Babylon.js が内部で `requestAnimationFrame` を管理してくれる。  
`engine.stopRenderLoop()` で停止できる。

---

## 全体コード

### `app/game/page.tsx`

```tsx
'use client'

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
import { Engine, Scene, Color4 } from '@babylonjs/core'

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    // Engine を初期化（第2引数 true = アンチエイリアス有効）
    const engine = new Engine(canvasRef.current, true)

    // Scene を作成（3D 世界の器）
    const scene = new Scene(engine)

    // 背景色を宇宙空間の黒に設定（r, g, b, a）
    scene.clearColor = new Color4(0.02, 0.02, 0.05, 1)

    // レンダリングループを開始（毎フレーム scene.render() が呼ばれる）
    engine.runRenderLoop(() => {
      scene.render()
    })

    // ウィンドウリサイズ時に Canvas サイズを更新する
    const handleResize = () => {
      engine.resize()
    }
    window.addEventListener('resize', handleResize)

    // クリーンアップ（コンポーネントのアンマウント時に実行）
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

```bash
npm run dev
```

`http://localhost:3000/game` を開いて、暗い紺色の画面が表示されれば成功。  
（カメラも光もまだないので「何もない宇宙空間」）
