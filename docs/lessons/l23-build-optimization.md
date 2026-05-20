# L23 — ビルドと最適化

## 概要

バンドルサイズを分析・削減し、Next.js のビルドを本番向けに最適化する。

**ゲームへの貢献**: 初回ロード時間を短縮し、低速回線でも快適にプレイできるようにする。

---

## 概念解説

### Babylon.js のバンドルサイズ問題

```bash
# 全機能を import すると非常に大きくなる
import * as BABYLON from '@babylonjs/core'  # ❌ ~3MB gzip 前

# 必要なクラスだけ import する（Tree Shaking）
import { Engine, Scene } from '@babylonjs/core'  # ✅ 必要分のみ
```

### Next.js でのバンドル分析

```bash
npm install -D @next/bundle-analyzer
```

```typescript
// next.config.ts
import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

export default withBundleAnalyzer({
  // Next.js の設定
})
```

```bash
ANALYZE=true npm run build
# → ブラウザでバンドルサイズの可視化が開く
```

### `next/dynamic` で 3D エンジンを遅延ロード

```typescript
// page.tsx
const GameCanvas = dynamic(
  () => import('@/components/game/GameCanvas'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="text-center">
          <div className="text-2xl mb-2">NEBULA DEFENSE</div>
          <div className="text-gray-400 text-sm">Loading 3D engine...</div>
        </div>
      </div>
    ),
  }
)
```

### Babylon.js の Side-Effect Import

```typescript
// ❌ 絶対に使わない（全機能が bundle に入る）
import '@babylonjs/core/Legacy/legacy'

// ✅ 必要なローダーだけ副作用インポート
import '@babylonjs/loaders/glTF'     // GLTF/GLB ローダー
// import '@babylonjs/loaders/OBJ'   // OBJ が必要な場合のみ
```

### Webpack の設定（WebAssembly 対応）

Havok 物理エンジンは WebAssembly（.wasm）ファイルを使う。

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    }
    // Havok の WASM を正しく処理
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    })
    return config
  },
}
```

### 画像・アセットの最適化

```
GLB ファイルの軽量化:
  Blender → Export → glTF 2.0
  ✅ Draco Compression を有効にする（3〜10 倍圧縮）
  ✅ 不要な UV チャンネルを削除

テクスチャの最適化:
  PNG/JPG → WebP/AVIF に変換
  ❌ 4096×4096 テクスチャ
  ✅ 1024×1024 または 2048×2048 に縮小

音声の最適化:
  WAV → OGG Opus に変換（ファイルサイズが 1/5〜1/10 になる）
```

---

## 実装手順

### Step 1: バンドルアナライザーを設定する

```typescript
// next.config.ts
import type { NextConfig } from 'next'
import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      }
    }
    return config
  },
  // 画像の最適化
  images: {
    formats: ['image/avif', 'image/webp'],
  },
}

export default withBundleAnalyzer(nextConfig)
```

### Step 2: ローディング画面を作る

```tsx
// components/game/LoadingScreen.tsx
'use client'

import { useEffect, useState } from 'react'

export function LoadingScreen() {
  const [dots, setDots] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.')
    }, 500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center justify-center h-screen bg-black text-white select-none">
      <div className="text-center">
        <div className="text-4xl font-bold tracking-widest mb-4">NEBULA DEFENSE</div>
        <div className="text-gray-400">Loading{dots}</div>
        <div className="mt-6 w-48 h-1 bg-gray-800 rounded-full mx-auto overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '60%' }} />
        </div>
      </div>
    </div>
  )
}
```

### Step 3: パフォーマンス計測スクリプト

```bash
# Lighthouse で Core Web Vitals を測定
npx lighthouse http://localhost:3000/game --output=html --output-path=./lighthouse-report.html
```

---

## 全体コード

### `next.config.ts`

```typescript
import type { NextConfig } from 'next'

let withBundleAnalyzer: (config: NextConfig) => NextConfig
try {
  withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env.ANALYZE === 'true',
  })
} catch {
  withBundleAnalyzer = (config) => config
}

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        buffer: false,
      }
    }
    // .wasm ファイルを asset として扱う
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    })
    return config
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // 実験的な機能（必要に応じて）
  experimental: {
    optimizePackageImports: ['@babylonjs/core', '@babylonjs/gui'],
  },
}

export default withBundleAnalyzer(nextConfig)
```

---

### `components/game/LoadingScreen.tsx`

```tsx
'use client'

import { useEffect, useState } from 'react'

interface LoadingScreenProps {
  message?: string
}

export function LoadingScreen({ message = 'Loading 3D Engine' }: LoadingScreenProps) {
  const [progress, setProgress] = useState(20)
  const [dots, setDots] = useState('')

  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.')
    }, 400)

    const progressInterval = setInterval(() => {
      setProgress(p => {
        if (p >= 90) return p
        return p + Math.random() * 8
      })
    }, 300)

    return () => {
      clearInterval(dotsInterval)
      clearInterval(progressInterval)
    }
  }, [])

  return (
    <div className="flex items-center justify-center h-screen w-full bg-black text-white select-none">
      <div className="text-center space-y-6">
        <div className="text-5xl font-bold tracking-[0.3em] text-white">
          NEBULA
        </div>
        <div className="text-2xl font-light tracking-[0.5em] text-blue-300">
          DEFENSE
        </div>
        <div className="text-gray-400 text-sm">
          {message}{dots}
        </div>
        <div className="w-64 h-1 bg-gray-800 rounded-full mx-auto overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-gray-600 text-xs">{Math.floor(progress)}%</div>
      </div>
    </div>
  )
}
```

---

### `app/game/page.tsx`（ローディング画面統合）

```tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { HUD } from '@/components/game/HUD'
import { TowerSelector } from '@/components/game/TowerSelector'
import { LevelSelect } from '@/components/game/LevelSelect'
import { SettingsPanel } from '@/components/game/SettingsPanel'
import { LoadingScreen } from '@/components/game/LoadingScreen'
import { useGameStore } from '@/lib/store/game-store'
import { LEVELS } from '@/lib/babylon/levels'
import type { LevelConfig } from '@/lib/babylon/level-types'

// Babylon.js を含む重いコンポーネントを遅延ロード
const GameCanvas = dynamic(
  () => import('@/components/game/GameCanvas'),
  {
    ssr: false,
    loading: () => <LoadingScreen message="Loading 3D Engine" />,
  }
)

export type GameEventCallback = (event: {
  type: string
  score?: number
  lives?: number
  wave?: number
  gold?: number
  kills?: number
}) => void

export default function GamePage() {
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(20)
  const [wave, setWave] = useState(1)
  const [gold, setGold] = useState(200)
  const [selectedTower, setSelectedTower] = useState('basic')
  const [gameState, setGameState] = useState<'levelselect' | 'playing' | 'gameover'>('levelselect')
  const [currentLevel, setCurrentLevel] = useState<LevelConfig>(LEVELS[0])
  const [showSettings, setShowSettings] = useState(false)

  const { unlockedLevels, updateHighScore, unlockLevel, addPlayTime, addKills } = useGameStore()

  const gameControlRef = useRef<{ start: (level: LevelConfig) => void; restart: () => void } | null>(null)
  const selectedTowerRef = useRef(selectedTower)
  const playStartTime = useRef<number>(0)

  const handleLevelSelect = useCallback((levelId: string) => {
    const level = LEVELS.find(l => l.id === levelId)
    if (!level) return
    setCurrentLevel(level)
    setScore(0); setLives(level.startLives); setWave(1); setGold(level.startGold)
    setGameState('playing')
    playStartTime.current = Date.now()
    setTimeout(() => gameControlRef.current?.start(level), 100)
  }, [])

  const handleGameEvent = useCallback((event: { type: string; score?: number; lives?: number; wave?: number; gold?: number; kills?: number }) => {
    if (event.type === 'SCORE_CHANGED' && event.score !== undefined) setScore(event.score)
    if (event.type === 'LIFE_CHANGED' && event.lives !== undefined) setLives(event.lives)
    if (event.type === 'WAVE_STARTED' && event.wave !== undefined) setWave(event.wave)
    if (event.type === 'GOLD_CHANGED' && event.gold !== undefined) setGold(event.gold)
    if (event.type === 'ENEMY_KILLED') addKills(1)
    if (event.type === 'LEVEL_CLEAR' && event.score !== undefined) {
      updateHighScore(currentLevel.id, event.score)
      const nextIdx = LEVELS.findIndex(l => l.id === currentLevel.id) + 1
      if (nextIdx < LEVELS.length) unlockLevel(LEVELS[nextIdx].id)
      addPlayTime((Date.now() - playStartTime.current) / 1000)
      setGameState('gameover')
    }
    if (event.type === 'GAME_OVER' && event.score !== undefined) {
      updateHighScore(currentLevel.id, event.score)
      addPlayTime((Date.now() - playStartTime.current) / 1000)
      setGameState('gameover')
    }
  }, [currentLevel, updateHighScore, unlockLevel, addKills, addPlayTime])

  return (
    <main className="relative w-full h-screen overflow-hidden bg-black">
      <GameCanvas
        currentLevel={currentLevel}
        gameState={gameState}
        onGameEvent={handleGameEvent}
        controlRef={gameControlRef}
        selectedTowerRef={selectedTowerRef}
      />
      {gameState === 'levelselect' && (
        <LevelSelect onSelect={handleLevelSelect} unlockedLevels={unlockedLevels} />
      )}
      {(gameState === 'playing' || gameState === 'gameover') && (
        <HUD
          score={score} lives={lives} wave={wave} gold={gold}
          gameState={gameState} onStart={() => {}}
          onRestart={() => setGameState('levelselect')}
        />
      )}
      {gameState === 'playing' && (
        <TowerSelector
          selectedTower={selectedTower}
          onSelect={(id) => { setSelectedTower(id); selectedTowerRef.current = id }}
          gold={gold}
        />
      )}
      <button
        onClick={() => setShowSettings(true)}
        className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white transition-colors z-10"
      >
        ⚙
      </button>
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </main>
  )
}
```

---

## 確認方法

```bash
# ビルドを実行
npm run build

# バンドルを分析（ブラウザが開く）
ANALYZE=true npm run build

# 本番ビルドを起動
npm run start
```

- `npm run build` がエラーなく完了する
- バンドルアナライザーで `@babylonjs/core` のサイズを確認する
- ローディング画面がアニメーションしながら表示される
