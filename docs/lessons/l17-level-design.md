# L17 — レベルデザインとシーン管理

## 概要

JSON でレベルを定義し、複数マップを切り替えるシーン管理システムを実装する。

**ゲームへの貢献**: レベルセレクト画面から難易度の異なる 3 つのマップを選択できる。

---

## 概念解説

### データドリブンなレベル設計

```typescript
interface LevelConfig {
  id: string
  name: string
  description: string
  difficulty: 'easy' | 'normal' | 'hard'
  mapSize: number
  spawnPoints: Array<{ x: number; z: number }>
  basePosition: { x: number; z: number }
  obstacles: Array<{ x: number; z: number; type: 'rock' | 'wall' }>
  waves: WaveConfig[]
  startGold: number
  startLives: number
  skyColor: { r: number; g: number; b: number; a: number }
  ambientIntensity: number
}
```

### SceneManager パターン

```typescript
class SceneManager {
  private scene: Scene | null = null
  private rootNode: TransformNode | null = null

  async loadLevel(config: LevelConfig, engine: Engine): Promise<Scene> {
    // 既存シーンを破棄
    this.rootNode?.dispose()
    this.scene?.dispose()

    // 新しいシーンを作成
    const scene = new Scene(engine)
    this.scene = scene

    // レベルコンフィグに基づいてシーンを構築
    await this.buildScene(scene, config)

    return scene
  }

  private async buildScene(scene: Scene, config: LevelConfig): Promise<void> {
    // TransformNode でレベルオブジェクトをグループ化
    const root = new TransformNode('levelRoot', scene)
    this.rootNode = root

    // マップ構築
    this.buildMap(scene, config, root)
    this.buildObstacles(scene, config, root)
  }

  dispose(): void {
    this.rootNode?.dispose()
    this.scene?.dispose()
    this.rootNode = null
    this.scene = null
  }
}
```

### TransformNode でのグループ化

```typescript
// すべてのレベルオブジェクトを root の子にする
const ground = MeshBuilder.CreateGround('ground', { width: config.mapSize }, scene)
ground.parent = levelRoot  // parent を設定

// レベルクリア時に一括削除
levelRoot.dispose()  // 子も全て dispose される
```

---

## 実装手順

### Step 1: レベル定義ファイルを作る

```typescript
// lib/babylon/levels.ts
import type { LevelConfig } from './level-types'

export const LEVELS: LevelConfig[] = [
  {
    id: 'level1',
    name: 'Station Alpha',
    description: 'はじめての防衛ミッション。3 方向からの侵攻を防げ。',
    difficulty: 'easy',
    mapSize: 20,
    startGold: 300,
    startLives: 30,
    spawnPoints: [
      { x: 9, z: 9 }, { x: -9, z: 9 }, { x: 0, z: -9 },
    ],
    basePosition: { x: 0, z: 0 },
    obstacles: [],
    waves: [
      { enemyCount: 3,  spawnInterval: 2.5, enemySpeed: 0.8, scorePerKill: 10, enemyHp: 2, goldPerKill: 10 },
      { enemyCount: 5,  spawnInterval: 2.0, enemySpeed: 1.0, scorePerKill: 15, enemyHp: 3, goldPerKill: 15 },
      { enemyCount: 8,  spawnInterval: 1.5, enemySpeed: 1.2, scorePerKill: 20, enemyHp: 4, goldPerKill: 20 },
    ],
    skyColor: { r: 0.02, g: 0.02, b: 0.05, a: 1 },
    ambientIntensity: 0.4,
  },
  {
    id: 'level2',
    name: 'Nebula Base',
    description: '4 方向からの総攻撃。岩を利用して防衛ラインを作れ。',
    difficulty: 'normal',
    mapSize: 24,
    startGold: 200,
    startLives: 20,
    spawnPoints: [
      { x: 11, z: 11 }, { x: -11, z: 11 },
      { x: 11, z: -11 }, { x: -11, z: -11 },
    ],
    basePosition: { x: 0, z: 0 },
    obstacles: [
      { x: 3, z: 3, type: 'rock' }, { x: -3, z: 3, type: 'rock' },
      { x: 3, z: -3, type: 'rock' }, { x: -3, z: -3, type: 'rock' },
      { x: 5, z: 0, type: 'wall' }, { x: -5, z: 0, type: 'wall' },
    ],
    waves: [
      { enemyCount: 5,  spawnInterval: 2.0, enemySpeed: 1.0, scorePerKill: 15, enemyHp: 4, goldPerKill: 15 },
      { enemyCount: 8,  spawnInterval: 1.5, enemySpeed: 1.3, scorePerKill: 20, enemyHp: 6, goldPerKill: 20 },
      { enemyCount: 12, spawnInterval: 1.0, enemySpeed: 1.5, scorePerKill: 25, enemyHp: 8, goldPerKill: 25 },
      { enemyCount: 15, spawnInterval: 0.8, enemySpeed: 1.8, scorePerKill: 30, enemyHp: 10, goldPerKill: 30 },
    ],
    skyColor: { r: 0.02, g: 0.01, b: 0.08, a: 1 },
    ambientIntensity: 0.3,
  },
  {
    id: 'level3',
    name: 'Dark Matter Core',
    description: '最終決戦。無数の敵を食い止めろ。',
    difficulty: 'hard',
    mapSize: 28,
    startGold: 150,
    startLives: 15,
    spawnPoints: [
      { x: 13, z: 13 }, { x: -13, z: 13 },
      { x: 13, z: -13 }, { x: -13, z: -13 },
      { x: 0,  z: 13 }, { x: 0, z: -13 },
    ],
    basePosition: { x: 0, z: 0 },
    obstacles: [
      { x: 4, z: 0, type: 'wall' }, { x: -4, z: 0, type: 'wall' },
      { x: 0, z: 4, type: 'wall' }, { x: 0, z: -4, type: 'wall' },
    ],
    waves: [
      { enemyCount: 8,  spawnInterval: 1.5, enemySpeed: 1.2, scorePerKill: 20, enemyHp: 6, goldPerKill: 20 },
      { enemyCount: 12, spawnInterval: 1.0, enemySpeed: 1.5, scorePerKill: 25, enemyHp: 8, goldPerKill: 25 },
      { enemyCount: 16, spawnInterval: 0.7, enemySpeed: 1.8, scorePerKill: 30, enemyHp: 12, goldPerKill: 30 },
      { enemyCount: 20, spawnInterval: 0.5, enemySpeed: 2.2, scorePerKill: 40, enemyHp: 15, goldPerKill: 40 },
      { enemyCount: 25, spawnInterval: 0.4, enemySpeed: 2.5, scorePerKill: 50, enemyHp: 20, goldPerKill: 50 },
    ],
    skyColor: { r: 0.05, g: 0.0, b: 0.02, a: 1 },
    ambientIntensity: 0.2,
  },
]
```

### Step 2: レベル選択画面を作る

```tsx
// components/game/LevelSelect.tsx
'use client'
import { LEVELS } from '@/lib/babylon/levels'

interface LevelSelectProps {
  onSelect: (levelId: string) => void
  unlockedLevels: string[]
}

export function LevelSelect({ onSelect, unlockedLevels }: LevelSelectProps) {
  const difficultyColor = {
    easy: 'border-green-500 text-green-300',
    normal: 'border-yellow-500 text-yellow-300',
    hard: 'border-red-500 text-red-300',
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80">
      <div className="text-center text-white">
        <h2 className="text-3xl font-bold mb-8">SELECT MISSION</h2>
        <div className="flex gap-6">
          {LEVELS.map((level) => {
            const isUnlocked = unlockedLevels.includes(level.id)
            return (
              <button
                key={level.id}
                onClick={() => isUnlocked && onSelect(level.id)}
                disabled={!isUnlocked}
                className={`
                  w-52 p-4 rounded-xl border-2 bg-black/50 text-left transition-all
                  ${difficultyColor[level.difficulty]}
                  ${isUnlocked ? 'hover:bg-white/10 cursor-pointer' : 'opacity-40 cursor-not-allowed'}
                `}
              >
                <div className="font-bold text-lg">{level.name}</div>
                <div className="text-xs text-gray-400 mt-1 mb-3">{level.description}</div>
                <div className="text-xs">
                  <span className="text-gray-400">難易度: </span>
                  <span className="font-bold">{level.difficulty.toUpperCase()}</span>
                </div>
                <div className="text-xs mt-1">
                  <span className="text-yellow-400">開始GOLD: </span>
                  <span>{level.startGold}G</span>
                </div>
                {!isUnlocked && (
                  <div className="text-xs mt-2 text-gray-500">🔒 LOCKED</div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

---

## 全体コード

### `lib/babylon/level-types.ts`

```typescript
export interface WaveConfig {
  enemyCount: number
  spawnInterval: number
  enemySpeed: number
  scorePerKill: number
  enemyHp: number
  goldPerKill: number
}

export interface ObstacleConfig {
  x: number
  z: number
  type: 'rock' | 'wall'
}

export interface LevelConfig {
  id: string
  name: string
  description: string
  difficulty: 'easy' | 'normal' | 'hard'
  mapSize: number
  startGold: number
  startLives: number
  spawnPoints: Array<{ x: number; z: number }>
  basePosition: { x: number; z: number }
  obstacles: ObstacleConfig[]
  waves: WaveConfig[]
  skyColor: { r: number; g: number; b: number; a: number }
  ambientIntensity: number
}
```

---

### `lib/babylon/levels.ts`

```typescript
import type { LevelConfig } from './level-types'

export const LEVELS: LevelConfig[] = [
  {
    id: 'level1',
    name: 'Station Alpha',
    description: 'はじめての防衛ミッション。3 方向からの侵攻を防げ。',
    difficulty: 'easy',
    mapSize: 20,
    startGold: 300,
    startLives: 30,
    spawnPoints: [
      { x: 9, z: 9 }, { x: -9, z: 9 }, { x: 0, z: -9 },
    ],
    basePosition: { x: 0, z: 0 },
    obstacles: [],
    waves: [
      { enemyCount: 3,  spawnInterval: 2.5, enemySpeed: 0.8, scorePerKill: 10, enemyHp: 2, goldPerKill: 10 },
      { enemyCount: 5,  spawnInterval: 2.0, enemySpeed: 1.0, scorePerKill: 15, enemyHp: 3, goldPerKill: 15 },
      { enemyCount: 8,  spawnInterval: 1.5, enemySpeed: 1.2, scorePerKill: 20, enemyHp: 4, goldPerKill: 20 },
    ],
    skyColor: { r: 0.02, g: 0.02, b: 0.05, a: 1 },
    ambientIntensity: 0.4,
  },
  {
    id: 'level2',
    name: 'Nebula Base',
    description: '4 方向からの総攻撃。岩を利用して防衛ラインを作れ。',
    difficulty: 'normal',
    mapSize: 24,
    startGold: 200,
    startLives: 20,
    spawnPoints: [
      { x: 11, z: 11 }, { x: -11, z: 11 },
      { x: 11, z: -11 }, { x: -11, z: -11 },
    ],
    basePosition: { x: 0, z: 0 },
    obstacles: [
      { x: 3, z: 3, type: 'rock' }, { x: -3, z: 3, type: 'rock' },
      { x: 3, z: -3, type: 'rock' }, { x: -3, z: -3, type: 'rock' },
      { x: 5, z: 0, type: 'wall' }, { x: -5, z: 0, type: 'wall' },
    ],
    waves: [
      { enemyCount: 5,  spawnInterval: 2.0, enemySpeed: 1.0, scorePerKill: 15, enemyHp: 4, goldPerKill: 15 },
      { enemyCount: 8,  spawnInterval: 1.5, enemySpeed: 1.3, scorePerKill: 20, enemyHp: 6, goldPerKill: 20 },
      { enemyCount: 12, spawnInterval: 1.0, enemySpeed: 1.5, scorePerKill: 25, enemyHp: 8, goldPerKill: 25 },
      { enemyCount: 15, spawnInterval: 0.8, enemySpeed: 1.8, scorePerKill: 30, enemyHp: 10, goldPerKill: 30 },
    ],
    skyColor: { r: 0.02, g: 0.01, b: 0.08, a: 1 },
    ambientIntensity: 0.3,
  },
  {
    id: 'level3',
    name: 'Dark Matter Core',
    description: '最終決戦。無数の敵を食い止めろ。',
    difficulty: 'hard',
    mapSize: 28,
    startGold: 150,
    startLives: 15,
    spawnPoints: [
      { x: 13, z: 13 }, { x: -13, z: 13 },
      { x: 13, z: -13 }, { x: -13, z: -13 },
      { x: 0,  z: 13 }, { x: 0, z: -13 },
    ],
    basePosition: { x: 0, z: 0 },
    obstacles: [
      { x: 4, z: 0, type: 'wall' }, { x: -4, z: 0, type: 'wall' },
      { x: 0, z: 4, type: 'wall' }, { x: 0, z: -4, type: 'wall' },
    ],
    waves: [
      { enemyCount: 8,  spawnInterval: 1.5, enemySpeed: 1.2, scorePerKill: 20, enemyHp: 6, goldPerKill: 20 },
      { enemyCount: 12, spawnInterval: 1.0, enemySpeed: 1.5, scorePerKill: 25, enemyHp: 8, goldPerKill: 25 },
      { enemyCount: 16, spawnInterval: 0.7, enemySpeed: 1.8, scorePerKill: 30, enemyHp: 12, goldPerKill: 30 },
      { enemyCount: 20, spawnInterval: 0.5, enemySpeed: 2.2, scorePerKill: 40, enemyHp: 15, goldPerKill: 40 },
      { enemyCount: 25, spawnInterval: 0.4, enemySpeed: 2.5, scorePerKill: 50, enemyHp: 20, goldPerKill: 50 },
    ],
    skyColor: { r: 0.05, g: 0.0, b: 0.02, a: 1 },
    ambientIntensity: 0.2,
  },
]
```

---

### `components/game/LevelSelect.tsx`

```tsx
'use client'

import { LEVELS } from '@/lib/babylon/levels'

interface LevelSelectProps {
  onSelect: (levelId: string) => void
  unlockedLevels: string[]
}

export function LevelSelect({ onSelect, unlockedLevels }: LevelSelectProps) {
  const difficultyStyle: Record<string, string> = {
    easy:   'border-green-500 text-green-300',
    normal: 'border-yellow-500 text-yellow-300',
    hard:   'border-red-500 text-red-300',
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
      <div className="text-center text-white">
        <h1 className="text-5xl font-bold mb-2 tracking-widest">NEBULA DEFENSE</h1>
        <p className="text-gray-400 mb-8">ミッションを選択してください</p>
        <div className="flex gap-6 flex-wrap justify-center">
          {LEVELS.map((level) => {
            const unlocked = unlockedLevels.includes(level.id)
            return (
              <button
                key={level.id}
                onClick={() => unlocked && onSelect(level.id)}
                disabled={!unlocked}
                className={[
                  'w-52 p-5 rounded-xl border-2 bg-black/60 text-left transition-all backdrop-blur-sm',
                  difficultyStyle[level.difficulty],
                  unlocked ? 'hover:bg-white/10 hover:scale-105 cursor-pointer' : 'opacity-40 cursor-not-allowed',
                ].join(' ')}
              >
                <div className="font-bold text-xl mb-1">{level.name}</div>
                <div className="text-xs text-gray-400 mb-3 leading-relaxed">{level.description}</div>
                <div className="text-xs space-y-1">
                  <div>
                    <span className="text-gray-400">難易度: </span>
                    <span className="font-bold uppercase">{level.difficulty}</span>
                  </div>
                  <div>
                    <span className="text-yellow-400">開始ゴールド: </span>
                    <span>{level.startGold}G</span>
                  </div>
                  <div>
                    <span className="text-red-400">開始ライフ: </span>
                    <span>{level.startLives}</span>
                  </div>
                  <div>
                    <span className="text-blue-400">ウェーブ数: </span>
                    <span>{level.waves.length}</span>
                  </div>
                </div>
                {!unlocked && (
                  <div className="text-xs mt-3 text-gray-500">🔒 前のレベルをクリアして解放</div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

---

### `app/game/page.tsx`（レベルセレクト統合）

```tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { HUD } from '@/components/game/HUD'
import { TowerSelector } from '@/components/game/TowerSelector'
import { LevelSelect } from '@/components/game/LevelSelect'
import type { LevelConfig } from '@/lib/babylon/level-types'
import { LEVELS } from '@/lib/babylon/levels'

const GameCanvas = dynamic(
  () => import('@/components/game/GameCanvas'),
  { ssr: false }
)

export type GameEventCallback = (event: {
  type: string
  score?: number
  lives?: number
  wave?: number
  gold?: number
}) => void

export default function GamePage() {
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(20)
  const [wave, setWave] = useState(1)
  const [gold, setGold] = useState(200)
  const [selectedTower, setSelectedTower] = useState('basic')
  const [gameState, setGameState] = useState<'levelselect' | 'playing' | 'paused' | 'gameover'>('levelselect')
  const [unlockedLevels, setUnlockedLevels] = useState<string[]>(['level1'])
  const [currentLevel, setCurrentLevel] = useState<LevelConfig>(LEVELS[0])

  const gameControlRef = useRef<{ start: (level: LevelConfig) => void; restart: () => void } | null>(null)
  const selectedTowerRef = useRef(selectedTower)

  const handleLevelSelect = useCallback((levelId: string) => {
    const level = LEVELS.find(l => l.id === levelId)
    if (!level) return
    setCurrentLevel(level)
    setScore(0)
    setLives(level.startLives)
    setWave(1)
    setGold(level.startGold)
    setGameState('playing')
    setTimeout(() => gameControlRef.current?.start(level), 100)
  }, [])

  const handleGameEvent = useCallback((event: { type: string; score?: number; lives?: number; wave?: number; gold?: number }) => {
    if (event.type === 'SCORE_CHANGED' && event.score !== undefined) setScore(event.score)
    if (event.type === 'LIFE_CHANGED' && event.lives !== undefined) setLives(event.lives)
    if (event.type === 'WAVE_STARTED' && event.wave !== undefined) setWave(event.wave)
    if (event.type === 'GOLD_CHANGED' && event.gold !== undefined) setGold(event.gold)
    if (event.type === 'LEVEL_CLEAR') {
      const nextLevel = LEVELS[LEVELS.findIndex(l => l.id === currentLevel.id) + 1]
      if (nextLevel) {
        setUnlockedLevels(prev => prev.includes(nextLevel.id) ? prev : [...prev, nextLevel.id])
      }
      setGameState('gameover')
    }
    if (event.type === 'GAME_OVER') setGameState('gameover')
  }, [currentLevel])

  const handleTowerSelect = useCallback((id: string) => {
    setSelectedTower(id)
    selectedTowerRef.current = id
  }, [])

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
          score={score}
          lives={lives}
          wave={wave}
          gold={gold}
          gameState={gameState}
          onStart={() => {}}
          onRestart={() => { setGameState('levelselect') }}
        />
      )}
      {gameState === 'playing' && (
        <TowerSelector
          selectedTower={selectedTower}
          onSelect={handleTowerSelect}
          gold={gold}
        />
      )}
    </main>
  )
}
```

---

## 確認方法

- タイトル画面でレベルが 3 つ表示される（level1 のみ解放済み）
- level1 をクリアすると level2 が解放される
- 各レベルでマップサイズ・敵の強さ・スポーン位置が異なる
