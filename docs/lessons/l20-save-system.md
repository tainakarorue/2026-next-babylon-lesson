# L20 — セーブシステムと状態管理

## 概要

Zustand でゲームのグローバル状態を管理し、LocalStorage への自動セーブを実装する。

**ゲームへの貢献**: スコア・アンロック状況・設定が保存され、次回起動時に引き継がれる。

---

## 概念解説

### Zustand によるグローバル状態管理

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface GameStore {
  // 状態
  highScores: Record<string, number>
  unlockedLevels: string[]
  settings: GameSettings
  // アクション
  updateHighScore: (levelId: string, score: number) => void
  unlockLevel: (levelId: string) => void
  updateSettings: (settings: Partial<GameSettings>) => void
}

const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      highScores: {},
      unlockedLevels: ['level1'],
      settings: { volume: 0.8, quality: 'high', showFps: false },
      updateHighScore: (levelId, score) =>
        set((state) => ({
          highScores: {
            ...state.highScores,
            [levelId]: Math.max(state.highScores[levelId] ?? 0, score),
          },
        })),
      unlockLevel: (levelId) =>
        set((state) => ({
          unlockedLevels: state.unlockedLevels.includes(levelId)
            ? state.unlockedLevels
            : [...state.unlockedLevels, levelId],
        })),
      updateSettings: (newSettings) =>
        set((state) => ({ settings: { ...state.settings, ...newSettings } })),
    }),
    {
      name: 'nebula-defense-save', // LocalStorage のキー
    }
  )
)
```

### `persist` ミドルウェアの動作

```
Zustand Store
    ↓ state 変更時に自動で保存
LocalStorage('nebula-defense-save')
    ↓ 初期化時に自動で読み込み
Zustand Store
```

`persist` を使うだけで自動的に「保存・読み込み」が実現する。

### セーブデータのバージョン管理

```typescript
const useGameStore = create<GameStore>()(
  persist(
    (set) => ({ ... }),
    {
      name: 'nebula-defense-save',
      version: 2,  // バージョン番号
      migrate: (persistedState, version) => {
        if (version === 1) {
          // v1 → v2 のマイグレーション
          return {
            ...persistedState,
            settings: {
              ...persistedState.settings,
              showFps: false,  // v2 で追加したフィールド
            },
          }
        }
        return persistedState
      },
    }
  )
)
```

---

## インストール

```bash
npm install zustand
```

---

## 実装手順

### Step 1: ストアを定義する

```typescript
// lib/store/game-store.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface GameSettings {
  masterVolume: number
  bgmVolume: number
  sfxVolume: number
  quality: 'low' | 'medium' | 'high'
  showFps: boolean
  language: 'ja' | 'en'
}

interface GameStore {
  highScores: Record<string, number>
  unlockedLevels: string[]
  totalPlayTime: number
  totalKills: number
  settings: GameSettings

  updateHighScore: (levelId: string, score: number) => void
  unlockLevel: (levelId: string) => void
  addPlayTime: (seconds: number) => void
  addKills: (count: number) => void
  updateSettings: (partial: Partial<GameSettings>) => void
  resetProgress: () => void
}

const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  bgmVolume: 0.5,
  sfxVolume: 0.8,
  quality: 'high',
  showFps: false,
  language: 'ja',
}

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      highScores: {},
      unlockedLevels: ['level1'],
      totalPlayTime: 0,
      totalKills: 0,
      settings: DEFAULT_SETTINGS,

      updateHighScore: (levelId, score) =>
        set((s) => ({
          highScores: {
            ...s.highScores,
            [levelId]: Math.max(s.highScores[levelId] ?? 0, score),
          },
        })),

      unlockLevel: (levelId) =>
        set((s) => ({
          unlockedLevels: s.unlockedLevels.includes(levelId)
            ? s.unlockedLevels
            : [...s.unlockedLevels, levelId],
        })),

      addPlayTime: (seconds) =>
        set((s) => ({ totalPlayTime: s.totalPlayTime + seconds })),

      addKills: (count) =>
        set((s) => ({ totalKills: s.totalKills + count })),

      updateSettings: (partial) =>
        set((s) => ({ settings: { ...s.settings, ...partial } })),

      resetProgress: () =>
        set({
          highScores: {},
          unlockedLevels: ['level1'],
          totalPlayTime: 0,
          totalKills: 0,
        }),
    }),
    {
      name: 'nebula-defense-save',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
)
```

### Step 2: 設定画面コンポーネント

```tsx
// components/game/SettingsPanel.tsx
'use client'

import { useGameStore } from '@/lib/store/game-store'

interface SettingsPanelProps {
  onClose: () => void
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, updateSettings, resetProgress } = useGameStore()

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
      <div className="bg-gray-900 rounded-2xl p-8 w-96 text-white">
        <h2 className="text-2xl font-bold mb-6">設定</h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400">マスター音量</label>
            <input
              type="range" min="0" max="1" step="0.1"
              value={settings.masterVolume}
              onChange={(e) => updateSettings({ masterVolume: Number(e.target.value) })}
              className="w-full mt-1"
            />
            <span className="text-sm">{Math.round(settings.masterVolume * 100)}%</span>
          </div>

          <div>
            <label className="text-sm text-gray-400">グラフィック品質</label>
            <div className="flex gap-2 mt-1">
              {(['low', 'medium', 'high'] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => updateSettings({ quality: q })}
                  className={`px-3 py-1 rounded text-sm ${
                    settings.quality === q
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  {q.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.showFps}
              onChange={(e) => updateSettings({ showFps: e.target.checked })}
              id="showFps"
            />
            <label htmlFor="showFps" className="text-sm">FPS 表示</label>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-colors"
          >
            完了
          </button>
          <button
            onClick={() => {
              if (confirm('プログレスをリセットしますか？')) resetProgress()
            }}
            className="px-4 py-2 bg-red-800 hover:bg-red-700 rounded-lg text-sm transition-colors"
          >
            リセット
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## 全体コード

### `lib/store/game-store.ts`

```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface GameSettings {
  masterVolume: number
  bgmVolume: number
  sfxVolume: number
  quality: 'low' | 'medium' | 'high'
  showFps: boolean
  language: 'ja' | 'en'
}

interface GameStore {
  highScores: Record<string, number>
  unlockedLevels: string[]
  totalPlayTime: number
  totalKills: number
  settings: GameSettings
  updateHighScore: (levelId: string, score: number) => void
  unlockLevel: (levelId: string) => void
  addPlayTime: (seconds: number) => void
  addKills: (count: number) => void
  updateSettings: (partial: Partial<GameSettings>) => void
  resetProgress: () => void
}

const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  bgmVolume: 0.5,
  sfxVolume: 0.8,
  quality: 'high',
  showFps: false,
  language: 'ja',
}

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      highScores: {},
      unlockedLevels: ['level1'],
      totalPlayTime: 0,
      totalKills: 0,
      settings: DEFAULT_SETTINGS,
      updateHighScore: (levelId, score) =>
        set((s) => ({
          highScores: { ...s.highScores, [levelId]: Math.max(s.highScores[levelId] ?? 0, score) },
        })),
      unlockLevel: (levelId) =>
        set((s) => ({
          unlockedLevels: s.unlockedLevels.includes(levelId) ? s.unlockedLevels : [...s.unlockedLevels, levelId],
        })),
      addPlayTime: (seconds) => set((s) => ({ totalPlayTime: s.totalPlayTime + seconds })),
      addKills: (count) => set((s) => ({ totalKills: s.totalKills + count })),
      updateSettings: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),
      resetProgress: () => set({ highScores: {}, unlockedLevels: ['level1'], totalPlayTime: 0, totalKills: 0 }),
    }),
    {
      name: 'nebula-defense-save',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
)
```

---

### `components/game/SettingsPanel.tsx`

```tsx
'use client'

import { useGameStore } from '@/lib/store/game-store'

interface SettingsPanelProps {
  onClose: () => void
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, updateSettings, highScores, totalKills, totalPlayTime, resetProgress } = useGameStore()
  const totalMinutes = Math.floor(totalPlayTime / 60)

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
      <div className="bg-gray-900 rounded-2xl p-8 w-96 text-white border border-gray-700">
        <h2 className="text-2xl font-bold mb-6 text-center">SETTINGS</h2>

        <div className="space-y-5">
          <div>
            <label className="block text-sm text-gray-400 mb-1">マスター音量</label>
            <div className="flex items-center gap-3">
              <input
                type="range" min="0" max="1" step="0.05"
                value={settings.masterVolume}
                onChange={(e) => updateSettings({ masterVolume: Number(e.target.value) })}
                className="flex-1"
              />
              <span className="text-sm w-10 text-right">{Math.round(settings.masterVolume * 100)}%</span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">グラフィック品質</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => updateSettings({ quality: q })}
                  className={`flex-1 py-1.5 rounded text-sm font-bold transition-colors ${
                    settings.quality === q ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  {q === 'low' ? '低' : q === 'medium' ? '中' : '高'}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showFps}
              onChange={(e) => updateSettings({ showFps: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm">FPS を表示する</span>
          </label>
        </div>

        <div className="mt-6 p-4 bg-black/40 rounded-xl text-sm space-y-1">
          <div className="text-gray-400 font-bold mb-2">STATS</div>
          <div className="flex justify-between">
            <span className="text-gray-400">総プレイ時間</span>
            <span>{totalMinutes} 分</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">総撃破数</span>
            <span>{totalKills} 体</span>
          </div>
          {Object.entries(highScores).map(([id, score]) => (
            <div key={id} className="flex justify-between">
              <span className="text-gray-400">{id} ハイスコア</span>
              <span className="text-yellow-300">{score.toLocaleString()}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-colors"
          >
            完了
          </button>
          <button
            onClick={() => {
              if (confirm('全プログレスをリセットしますか？\nこの操作は取り消せません。')) {
                resetProgress()
              }
            }}
            className="px-4 py-2.5 bg-red-900 hover:bg-red-800 rounded-lg text-sm transition-colors"
          >
            リセット
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

### `app/game/page.tsx`（Zustand Store 統合）

```tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { HUD } from '@/components/game/HUD'
import { TowerSelector } from '@/components/game/TowerSelector'
import { LevelSelect } from '@/components/game/LevelSelect'
import { SettingsPanel } from '@/components/game/SettingsPanel'
import { useGameStore } from '@/lib/store/game-store'
import { LEVELS } from '@/lib/babylon/levels'
import type { LevelConfig } from '@/lib/babylon/level-types'

const GameCanvas = dynamic(() => import('@/components/game/GameCanvas'), { ssr: false })

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
    if (event.type === 'ENEMY_KILLED' && event.kills !== undefined) addKills(event.kills)
    if (event.type === 'LEVEL_CLEAR' && event.score !== undefined) {
      updateHighScore(currentLevel.id, event.score)
      const nextIdx = LEVELS.findIndex(l => l.id === currentLevel.id) + 1
      if (nextIdx < LEVELS.length) unlockLevel(LEVELS[nextIdx].id)
      const elapsed = (Date.now() - playStartTime.current) / 1000
      addPlayTime(elapsed)
      setGameState('gameover')
    }
    if (event.type === 'GAME_OVER' && event.score !== undefined) {
      updateHighScore(currentLevel.id, event.score)
      const elapsed = (Date.now() - playStartTime.current) / 1000
      addPlayTime(elapsed)
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
        <TowerSelector selectedTower={selectedTower} onSelect={(id) => { setSelectedTower(id); selectedTowerRef.current = id }} gold={gold} />
      )}
      <button
        onClick={() => setShowSettings(true)}
        className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
      >
        ⚙️
      </button>
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </main>
  )
}
```

---

## 確認方法

- ゲームをプレイしてブラウザを閉じ、再度開くとスコア・アンロック状況が保持されている
- 設定パネルの音量・品質がリロード後も保持されている
- 設定 → リセット → 確認 でデータが初期化される
- F12 → Application → LocalStorage で `nebula-defense-save` キーを確認できる

**Phase 4 完了**: 実務水準のゲームアーキテクチャが完成した。
