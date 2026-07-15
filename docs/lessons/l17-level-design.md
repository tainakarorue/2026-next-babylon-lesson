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
const ground = MeshBuilder.CreateGround(
  'ground',
  { width: config.mapSize },
  scene,
)
ground.parent = levelRoot // parent を設定

// レベルクリア時に一括削除
levelRoot.dispose() // 子も全て dispose される
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
      { x: 9, z: 9 },
      { x: -9, z: 9 },
      { x: 0, z: -9 },
    ],
    basePosition: { x: 0, z: 0 },
    obstacles: [],
    waves: [
      {
        enemyCount: 3,
        spawnInterval: 2.5,
        enemySpeed: 0.8,
        scorePerKill: 10,
        enemyHp: 2,
        goldPerKill: 10,
      },
      {
        enemyCount: 5,
        spawnInterval: 2.0,
        enemySpeed: 1.0,
        scorePerKill: 15,
        enemyHp: 3,
        goldPerKill: 15,
      },
      {
        enemyCount: 8,
        spawnInterval: 1.5,
        enemySpeed: 1.2,
        scorePerKill: 20,
        enemyHp: 4,
        goldPerKill: 20,
      },
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
      { x: 11, z: 11 },
      { x: -11, z: 11 },
      { x: 11, z: -11 },
      { x: -11, z: -11 },
    ],
    basePosition: { x: 0, z: 0 },
    obstacles: [
      { x: 3, z: 3, type: 'rock' },
      { x: -3, z: 3, type: 'rock' },
      { x: 3, z: -3, type: 'rock' },
      { x: -3, z: -3, type: 'rock' },
      { x: 5, z: 0, type: 'wall' },
      { x: -5, z: 0, type: 'wall' },
    ],
    waves: [
      {
        enemyCount: 5,
        spawnInterval: 2.0,
        enemySpeed: 1.0,
        scorePerKill: 15,
        enemyHp: 4,
        goldPerKill: 15,
      },
      {
        enemyCount: 8,
        spawnInterval: 1.5,
        enemySpeed: 1.3,
        scorePerKill: 20,
        enemyHp: 6,
        goldPerKill: 20,
      },
      {
        enemyCount: 12,
        spawnInterval: 1.0,
        enemySpeed: 1.5,
        scorePerKill: 25,
        enemyHp: 8,
        goldPerKill: 25,
      },
      {
        enemyCount: 15,
        spawnInterval: 0.8,
        enemySpeed: 1.8,
        scorePerKill: 30,
        enemyHp: 10,
        goldPerKill: 30,
      },
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
      { x: 13, z: 13 },
      { x: -13, z: 13 },
      { x: 13, z: -13 },
      { x: -13, z: -13 },
      { x: 0, z: 13 },
      { x: 0, z: -13 },
    ],
    basePosition: { x: 0, z: 0 },
    obstacles: [
      { x: 4, z: 0, type: 'wall' },
      { x: -4, z: 0, type: 'wall' },
      { x: 0, z: 4, type: 'wall' },
      { x: 0, z: -4, type: 'wall' },
    ],
    waves: [
      {
        enemyCount: 8,
        spawnInterval: 1.5,
        enemySpeed: 1.2,
        scorePerKill: 20,
        enemyHp: 6,
        goldPerKill: 20,
      },
      {
        enemyCount: 12,
        spawnInterval: 1.0,
        enemySpeed: 1.5,
        scorePerKill: 25,
        enemyHp: 8,
        goldPerKill: 25,
      },
      {
        enemyCount: 16,
        spawnInterval: 0.7,
        enemySpeed: 1.8,
        scorePerKill: 30,
        enemyHp: 12,
        goldPerKill: 30,
      },
      {
        enemyCount: 20,
        spawnInterval: 0.5,
        enemySpeed: 2.2,
        scorePerKill: 40,
        enemyHp: 15,
        goldPerKill: 40,
      },
      {
        enemyCount: 25,
        spawnInterval: 0.4,
        enemySpeed: 2.5,
        scorePerKill: 50,
        enemyHp: 20,
        goldPerKill: 50,
      },
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
                <div className="text-xs text-gray-400 mt-1 mb-3">
                  {level.description}
                </div>
                <div className="text-xs">
                  <span className="text-gray-400">難易度: </span>
                  <span className="font-bold">
                    {level.difficulty.toUpperCase()}
                  </span>
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
      { x: 9, z: 9 },
      { x: -9, z: 9 },
      { x: 0, z: -9 },
    ],
    basePosition: { x: 0, z: 0 },
    obstacles: [],
    waves: [
      {
        enemyCount: 3,
        spawnInterval: 2.5,
        enemySpeed: 0.8,
        scorePerKill: 10,
        enemyHp: 2,
        goldPerKill: 10,
      },
      {
        enemyCount: 5,
        spawnInterval: 2.0,
        enemySpeed: 1.0,
        scorePerKill: 15,
        enemyHp: 3,
        goldPerKill: 15,
      },
      {
        enemyCount: 8,
        spawnInterval: 1.5,
        enemySpeed: 1.2,
        scorePerKill: 20,
        enemyHp: 4,
        goldPerKill: 20,
      },
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
      { x: 11, z: 11 },
      { x: -11, z: 11 },
      { x: 11, z: -11 },
      { x: -11, z: -11 },
    ],
    basePosition: { x: 0, z: 0 },
    obstacles: [
      { x: 3, z: 3, type: 'rock' },
      { x: -3, z: 3, type: 'rock' },
      { x: 3, z: -3, type: 'rock' },
      { x: -3, z: -3, type: 'rock' },
      { x: 5, z: 0, type: 'wall' },
      { x: -5, z: 0, type: 'wall' },
    ],
    waves: [
      {
        enemyCount: 5,
        spawnInterval: 2.0,
        enemySpeed: 1.0,
        scorePerKill: 15,
        enemyHp: 4,
        goldPerKill: 15,
      },
      {
        enemyCount: 8,
        spawnInterval: 1.5,
        enemySpeed: 1.3,
        scorePerKill: 20,
        enemyHp: 6,
        goldPerKill: 20,
      },
      {
        enemyCount: 12,
        spawnInterval: 1.0,
        enemySpeed: 1.5,
        scorePerKill: 25,
        enemyHp: 8,
        goldPerKill: 25,
      },
      {
        enemyCount: 15,
        spawnInterval: 0.8,
        enemySpeed: 1.8,
        scorePerKill: 30,
        enemyHp: 10,
        goldPerKill: 30,
      },
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
      { x: 13, z: 13 },
      { x: -13, z: 13 },
      { x: 13, z: -13 },
      { x: -13, z: -13 },
      { x: 0, z: 13 },
      { x: 0, z: -13 },
    ],
    basePosition: { x: 0, z: 0 },
    obstacles: [
      { x: 4, z: 0, type: 'wall' },
      { x: -4, z: 0, type: 'wall' },
      { x: 0, z: 4, type: 'wall' },
      { x: 0, z: -4, type: 'wall' },
    ],
    waves: [
      {
        enemyCount: 8,
        spawnInterval: 1.5,
        enemySpeed: 1.2,
        scorePerKill: 20,
        enemyHp: 6,
        goldPerKill: 20,
      },
      {
        enemyCount: 12,
        spawnInterval: 1.0,
        enemySpeed: 1.5,
        scorePerKill: 25,
        enemyHp: 8,
        goldPerKill: 25,
      },
      {
        enemyCount: 16,
        spawnInterval: 0.7,
        enemySpeed: 1.8,
        scorePerKill: 30,
        enemyHp: 12,
        goldPerKill: 30,
      },
      {
        enemyCount: 20,
        spawnInterval: 0.5,
        enemySpeed: 2.2,
        scorePerKill: 40,
        enemyHp: 15,
        goldPerKill: 40,
      },
      {
        enemyCount: 25,
        spawnInterval: 0.4,
        enemySpeed: 2.5,
        scorePerKill: 50,
        enemyHp: 20,
        goldPerKill: 50,
      },
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
    easy: 'border-green-500 text-green-300',
    normal: 'border-yellow-500 text-yellow-300',
    hard: 'border-red-500 text-red-300',
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
      <div className="text-center text-white">
        <h1 className="text-5xl font-bold mb-2 tracking-widest">
          NEBULA DEFENSE
        </h1>
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
                  unlocked
                    ? 'hover:bg-white/10 hover:scale-105 cursor-pointer'
                    : 'opacity-40 cursor-not-allowed',
                ].join(' ')}
              >
                <div className="font-bold text-xl mb-1">{level.name}</div>
                <div className="text-xs text-gray-400 mb-3 leading-relaxed">
                  {level.description}
                </div>
                <div className="text-xs space-y-1">
                  <div>
                    <span className="text-gray-400">難易度: </span>
                    <span className="font-bold uppercase">
                      {level.difficulty}
                    </span>
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
                  <div className="text-xs mt-3 text-gray-500">
                    🔒 前のレベルをクリアして解放
                  </div>
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

const GameCanvas = dynamic(() => import('@/components/game/GameCanvas'), {
  ssr: false,
})

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
  const [gameState, setGameState] = useState<
    'levelselect' | 'playing' | 'paused' | 'gameover'
  >('levelselect')
  const [unlockedLevels, setUnlockedLevels] = useState<string[]>(['level1'])
  const [currentLevel, setCurrentLevel] = useState<LevelConfig>(LEVELS[0])

  const gameControlRef = useRef<{
    start: (level: LevelConfig) => void
    restart: () => void
  } | null>(null)

  const selectedTowerRef = useRef(selectedTower)

  const handleLevelSelect = useCallback((levelId: string) => {
    const level = LEVELS.find((l) => l.id === levelId)
    if (!level) return
    setCurrentLevel(level)
    setScore(0)
    setLives(level.startLives)
    setWave(1)
    setGold(level.startGold)
    setGameState('playing')
    setTimeout(() => gameControlRef.current?.start(level), 100)
  }, [])

  const handleGameEvent = useCallback(
    (event: {
      type: string
      score?: number
      lives?: number
      wave?: number
      gold?: number
    }) => {
      if (event.type === 'SCORE_CHANGED' && event.score !== undefined)
        setScore(event.score)
      if (event.type === 'LIFE_CHANGED' && event.lives !== undefined)
        setLives(event.lives)
      if (event.type === 'WAVE_STARTED' && event.wave !== undefined)
        setWave(event.wave)
      if (event.type === 'GOLD_CHANGED' && event.gold !== undefined)
        setGold(event.gold)
      if (event.type === 'LEVEL_CLEAR') {
        const nextLevel =
          LEVELS[LEVELS.findIndex((l) => l.id === currentLevel.id) + 1]
        if (nextLevel) {
          setUnlockedLevels((prev) =>
            prev.includes(nextLevel.id) ? prev : [...prev, nextLevel.id],
          )
        }
        setGameState('gameover')
      }
      if (event.type === 'GAME_OVER') setGameState('gameover')
    },
    [currentLevel],
  )

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
        <LevelSelect
          onSelect={handleLevelSelect}
          unlockedLevels={unlockedLevels}
        />
      )}
      {(gameState === 'playing' || gameState === 'gameover') && (
        <HUD
          score={score}
          lives={lives}
          wave={wave}
          gold={gold}
          gameState={gameState}
          onStart={() => {}}
          onRestart={() => {
            setGameState('levelselect')
          }}
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

## 完全版 `components/game/GameCanvas.tsx`

```tsx
'use client'

import { useEffect, useRef, MutableRefObject } from 'react'
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
  ShaderMaterial,
  PointerEventTypes,
  PhysicsAggregate,
  PhysicsShapeType,
  Animation,
  BackEase,
  EasingFunction,
  ImportMeshAsync,
  ParticleSystem,
  GPUParticleSystem,
  DynamicTexture,
  DefaultRenderingPipeline,
  ImageProcessingConfiguration,
  ColorCurves,
  ShadowGenerator,
  CubeTexture,
} from '@babylonjs/core'
import { HavokPlugin } from '@babylonjs/core'
import HavokPhysics from '@babylonjs/havok'
import '@babylonjs/loaders/glTF'
import { AdvancedDynamicTexture, Rectangle, Control } from '@babylonjs/gui'

import { TOWER_TYPES, TowerType } from '@/components/game/TowerSelector'
import type { GameEventCallback } from '@/app/game/page'
import { registerShaders } from '@/lib/babylon/shader'
import { SoundManager } from '@/lib/babylon/sound-manager'
import { GridMap } from '@/lib/babylon/pathfinding'
import type { LevelConfig, WaveConfig } from '@/lib/babylon/level-types'

interface EnemyHealthBar {
  plane: Mesh
  fillRect: Rectangle
  currentHp: number
  maxHp: number
}

interface GameCanvasProps {
  currentLevel: LevelConfig
  gameState: 'levelselect' | 'playing' | 'paused' | 'gameover'
  onGameEvent: GameEventCallback
  controlRef: MutableRefObject<{
    start: (level: LevelConfig) => void
    restart: () => void
  } | null>
  selectedTowerRef: MutableRefObject<string>
}

export default function GameCanvas({
  currentLevel,
  gameState: externalGameState,
  onGameEvent,
  controlRef,
  selectedTowerRef,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    let engine: Engine
    let soundManager: SoundManager | undefined
    let cancelled = false

    const init = async () => {
      // ── Engine & Scene ───────────────────────────────────
      engine = new Engine(canvasRef.current, true)
      const scene = new Scene(engine)
      scene.clearColor = new Color4(
        currentLevel.skyColor.r,
        currentLevel.skyColor.g,
        currentLevel.skyColor.b,
        currentLevel.skyColor.a,
      )

      registerShaders()

      // ── Sound ─────────────────────────────────────────────
      soundManager = new SoundManager()
      soundManager.preload(scene)

      if (cancelled) return

      // オーディオアンロックオブザーバー
      let audioUnlocked = false
      scene.onPointerObservable.add(
        (info) => {
          if (!audioUnlocked && info.type === PointerEventTypes.POINTERDOWN) {
            audioUnlocked = true
            soundManager?.unlockAsync().then(() => {
              if (playing) soundManager?.playBGM()
            })
          }
        },
        -1,
        false,
      )

      function createEnemyHealthBar(
        enemy: Mesh,
        maxHp: number,
      ): EnemyHealthBar {
        const plane = MeshBuilder.CreatePlane(
          'hpPlane',
          { width: 1.5, height: 0.2 },
          scene,
        )
        plane.parent = enemy
        plane.position.y = 0.9
        plane.billboardMode = Mesh.BILLBOARDMODE_ALL
        plane.isPickable = false

        const planeUI = AdvancedDynamicTexture.CreateForMesh(plane, 256, 32)

        const bg = new Rectangle()
        bg.width = '100%'
        bg.height = '100%'
        bg.background = '#1a1a2e'
        bg.thickness = 1
        bg.color = '#444'
        planeUI.addControl(bg)

        const fill = new Rectangle()
        fill.width = '100%'
        fill.height = '80%'
        fill.background = '#22c55e'
        fill.thickness = 0
        fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
        bg.addControl(fill)

        return { plane, fillRect: fill, currentHp: maxHp, maxHp }
      }

      function updateHealthBar(bar: EnemyHealthBar, hp: number): void {
        bar.currentHp = Math.max(0, hp)
        const pct = bar.currentHp / bar.maxHp
        bar.fillRect.width = `${pct * 100}%`
        if (pct > 0.5) bar.fillRect.background = '#22c55e'
        else if (pct > 0.25) bar.fillRect.background = '#f59e0b'
        else bar.fillRect.background = '#ef4444'
      }

      // ── Physics ────────────────────────────────────────
      const havokInstance = await HavokPhysics()
      if (cancelled) return

      const havokPlugin = new HavokPlugin(true, havokInstance)
      scene.enablePhysics(new Vector3(0, -9.81, 0), havokPlugin)

      // ── Camera ───────────────────────────────────────────
      const camera = new ArcRotateCamera(
        'camera',
        -Math.PI / 2,
        Math.PI / 3,
        20,
        Vector3.Zero(),
        scene,
      )
      camera.attachControl(canvasRef.current, true)

      camera.lowerRadiusLimit = 5
      camera.upperRadiusLimit = 40
      camera.lowerBetaLimit = 0.1
      camera.upperBetaLimit = Math.PI / 2.2

      // ── Post-Processing Pipeline ───────────────────────
      const pipeline = new DefaultRenderingPipeline('default', true, scene, [
        camera,
      ])

      pipeline.fxaaEnabled = true

      pipeline.bloomEnabled = true
      pipeline.bloomWeight = 0.4
      pipeline.bloomThreshold = 0.7
      pipeline.bloomScale = 0.5
      pipeline.bloomKernel = 32

      pipeline.imageProcessingEnabled = true
      pipeline.imageProcessing.contrast = 1.1
      pipeline.imageProcessing.exposure = 1.0
      pipeline.imageProcessing.toneMappingEnabled = true
      pipeline.imageProcessing.toneMappingType =
        ImageProcessingConfiguration.TONEMAPPING_ACES

      pipeline.imageProcessing.colorCurvesEnabled = true

      const curves = new ColorCurves()
      curves.globalSaturation = 15
      curves.highlightsHue = 210
      curves.highlightsDensity = 20
      pipeline.imageProcessing.colorCurves = curves

      pipeline.chromaticAberrationEnabled = true
      pipeline.chromaticAberration.aberrationAmount = 20

      pipeline.grainEnabled = true
      pipeline.grain.intensity = 8
      pipeline.grain.animated = true

      // ── Lights ───────────────────────────────────────────
      const hemisphericLight = new HemisphericLight(
        'hemisphericLight',
        new Vector3(0, 1, 0),
        scene,
      )

      hemisphericLight.intensity = currentLevel.ambientIntensity
      hemisphericLight.diffuse = new Color3(0.6, 0.7, 1.0)
      hemisphericLight.groundColor = new Color3(0.1, 0.1, 0.2)

      const sunLight = new DirectionalLight(
        'sunLight',
        new Vector3(-1, -2, -1),
        scene,
      )

      sunLight.intensity = 1.2
      sunLight.diffuse = new Color3(1.0, 0.95, 0.8)
      sunLight.position = new Vector3(10, 20, 10)
      sunLight.shadowMinZ = 0.1
      sunLight.shadowMaxZ = 60

      // ── Environment Texture（IBL）─────────────────────
      try {
        scene.environmentTexture = CubeTexture.CreateFromPrefilteredData(
          '/env/environment.env',
          scene,
        )
        scene.environmentIntensity = 0.5
      } catch (e) {
        console.warn(
          'environment.envが見つかりません。HemisphericLightで代替します。',
          e,
        )
      }

      // ── Shadow Generator ───────────────────────────────
      const shadowGen = new ShadowGenerator(1024, sunLight)
      shadowGen.useExponentialShadowMap = false
      shadowGen.usePoissonSampling = true
      shadowGen.bias = 0.0001

      // ── Ground（全レベル共通の最大サイズ 30 に固定）──────
      const ground = MeshBuilder.CreateGround(
        'ground',
        { width: 30, height: 30, subdivisions: 20 },
        scene,
      )

      // ── Materials ────────────────────────────────────────
      const scanlineMat = new ShaderMaterial(
        'scanlineMat',
        scene,
        { vertex: 'scanline', fragment: 'scanline' },
        {
          attributes: ['position', 'uv'],
          uniforms: ['worldViewProjection', 'time'],
        },
      )
      ground.material = scanlineMat
      ground.receiveShadows = true

      new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene)

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

      const barrelMatRapid = barrelMat.clone('barrelMatRapid')
      barrelMatRapid.emissiveColor = new Color3(0, 1, 0.3)
      barrelMatRapid.albedoColor = new Color3(0, 0.5, 0.2)

      const barrelMatSniper = barrelMat.clone('barrelMatSniper')
      barrelMatSniper.emissiveColor = new Color3(0.8, 0, 1)
      barrelMatSniper.albedoColor = new Color3(0.4, 0, 0.6)

      const enemyMat = new StandardMaterial('enemyMat', scene)
      enemyMat.diffuseColor = new Color3(0.8, 0.1, 0.1)
      enemyMat.emissiveColor = new Color3(0.3, 0, 0)

      const bulletMat = new PBRMaterial('bulletMat', scene)
      bulletMat.albedoColor = new Color3(1.0, 0.8, 0.0)
      bulletMat.emissiveColor = new Color3(1.0, 0.5, 0.0)
      bulletMat.emissiveIntensity = 2.0
      bulletMat.metallic = 0
      bulletMat.roughness = 0

      const baseMat = new PBRMaterial('baseMat', scene)
      baseMat.albedoColor = new Color3(0.2, 0.8, 0.2)
      baseMat.emissiveColor = new Color3(0, 0.3, 0)
      baseMat.metallic = 0.5
      baseMat.roughness = 0.3

      const shieldMat = new ShaderMaterial(
        'shieldMat',
        scene,
        { vertex: 'shield', fragment: 'shield' },
        {
          attributes: ['position', 'normal'],
          uniforms: [
            'worldViewProjection',
            'world',
            'cameraPosition',
            'time',
            'hitIntensity',
          ],
          needAlphaBlending: true,
        },
      )
      shieldMat.backFaceCulling = false
      shieldMat.setFloat('hitIntensity', 0)

      // ── Base（守るべき拠点）────────────────────────────
      const baseMesh = MeshBuilder.CreateCylinder(
        'base',
        { height: 0.3, diameter: 2, tessellation: 16 },
        scene,
      )
      baseMesh.position.x = currentLevel.basePosition.x
      baseMesh.position.y = 0.15
      baseMesh.position.z = currentLevel.basePosition.z
      baseMesh.material = baseMat
      baseMesh.receiveShadows = true
      shadowGen.addShadowCaster(baseMesh)
      new PhysicsAggregate(
        baseMesh,
        PhysicsShapeType.CYLINDER,
        { mass: 0 },
        scene,
      )

      // ── Particle Texture ────────────────────────────────
      const particleTex = new DynamicTexture(
        'particleTex',
        { width: 64, height: 64 },
        scene,
        false,
      )
      const ctx = particleTex.getContext()
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
      grad.addColorStop(0, 'rgba(255,255,255,1)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 64, 64)
      particleTex.update()

      // ── Stars Background ───────────────────────────────
      const stars = GPUParticleSystem.IsSupported
        ? new GPUParticleSystem('stars', { capacity: 2000 }, scene)
        : new ParticleSystem('stars', 2000, scene)

      stars.particleTexture = particleTex
      stars.emitter = new Vector3(0, 0, 0)
      stars.createSphereEmitter(30)
      stars.minLifeTime = 120
      stars.maxLifeTime = 120
      stars.minEmitPower = 0
      stars.maxEmitPower = 0
      stars.gravity = new Vector3(0, 0, 0)
      stars.color1 = new Color4(1, 1, 1, 0.8)
      stars.color2 = new Color4(0.8, 0.9, 1, 0.6)
      stars.colorDead = new Color4(1, 1, 1, 0)
      stars.minSize = 0.02
      stars.maxSize = 0.08
      stars.emitRate = 15
      stars.blendMode = ParticleSystem.BLENDMODE_ONEONE
      stars.start()

      // ── Level state（startGame で更新される）────────────
      let levelConfig: LevelConfig = currentLevel
      let currentWaves: WaveConfig[] = currentLevel.waves
      let spawnPoints: Vector3[] = currentLevel.spawnPoints.map(
        (p) => new Vector3(p.x, 0.5, p.z),
      )
      let basePosition: Vector3 = new Vector3(
        currentLevel.basePosition.x,
        0.5,
        currentLevel.basePosition.z,
      )
      let obstaclesMeshes: Mesh[] = []

      // ── Game State ─────────────────────────────────────
      let playing = false
      let score = 0
      let lives = currentLevel.startLives
      let gold = currentLevel.startGold
      let currentWaveIndex = 0
      let waveEnemiesRemaining = 0
      let waveEnemiesSpawned = 0
      let spawnTimer = 0
      let betweenWaveTimer = 0
      const BETWEEN_WAVE_DELAY = 5

      // ── Obstacle Mesh Builder ──────────────────────────
      function createObstacleMeshes(level: LevelConfig): Mesh[] {
        const meshes: Mesh[] = []
        for (const obs of level.obstacles) {
          const m =
            obs.type === 'rock'
              ? MeshBuilder.CreateSphere(
                  `obs_${obs.x}_${obs.z}`,
                  { diameter: 0.9 },
                  scene,
                )
              : MeshBuilder.CreateBox(
                  `obs_${obs.x}_${obs.z}`,
                  { width: 1, height: 1, depth: 1 },
                  scene,
                )
          m.position = new Vector3(obs.x, 0.5, obs.z)
          m.material = towerBaseMat
          m.receiveShadows = true
          m.isPickable = false
          shadowGen.addShadowCaster(m)
          meshes.push(m)
        }
        return meshes
      }

      // ── Explosion Effect ───────────────────────────────
      function createExplosion(position: Vector3): void {
        soundManager?.play('explosion', 0.2)
        const ps = new ParticleSystem('explosion', 150, scene)

        ps.particleTexture = particleTex
        ps.emitter = position.clone()
        ps.minEmitBox = new Vector3(-0.1, -0.1, -0.1)
        ps.maxEmitBox = new Vector3(0.1, 0.1, 0.1)
        ps.minLifeTime = 0.2
        ps.maxLifeTime = 0.8
        ps.minEmitPower = 3
        ps.maxEmitPower = 8
        ps.direction1 = new Vector3(-1, -1, -1)
        ps.direction2 = new Vector3(1, 1, 1)
        ps.gravity = new Vector3(0, -3, 0)
        ps.color1 = new Color4(1, 0.6, 0, 1)
        ps.color2 = new Color4(1, 0.1, 0, 1)
        ps.colorDead = new Color4(0.1, 0.1, 0.1, 0)
        ps.minSize = 0.1
        ps.maxSize = 0.4
        ps.emitRate = 500
        ps.blendMode = ParticleSystem.BLENDMODE_ONEONE
        ps.targetStopDuration = 0.15
        ps.start()

        let elapsed = 0
        const cleanup = () => {
          elapsed += engine.getDeltaTime() / 1000
          if (elapsed >= 2.0) {
            ps.dispose(false)
            scene.unregisterAfterRender(cleanup)
          }
        }
        scene.registerAfterRender(cleanup)
      }

      // ── Asset Loading ──────────────────────────────────
      let enemyTemplate: Mesh

      try {
        const result = await ImportMeshAsync('/model/enemy.glb', scene, {
          meshNames: '',
        })
        enemyTemplate = result.meshes[0] as Mesh
        enemyTemplate.name = 'enemyTemplate'
        enemyTemplate.setEnabled(false)
        result.animationGroups.forEach((g) => {
          console.log('アニメーション', g.name)
          g.stop()
        })
      } catch {
        enemyTemplate = MeshBuilder.CreateSphere(
          'enemyTemplate',
          { diameter: 0.8, segments: 8 },
          scene,
        )
        enemyTemplate.material = enemyMat
        enemyTemplate.setEnabled(false)
      }

      if (cancelled) return

      let towerTemplate: Mesh | null = null

      try {
        const result = await ImportMeshAsync('/model/tower.glb', scene, {
          meshNames: '',
        })
        towerTemplate = result.meshes[0] as Mesh
        towerTemplate.name = 'towerTemplate'
        towerTemplate.setEnabled(false)
      } catch {
        towerTemplate = null
      }

      if (cancelled) return

      // ── Enemies ────────────────────────────────────────
      const enemies: {
        mesh: Mesh
        speed: number
        time: number
        hp: number
        maxHp: number
        healthBar: EnemyHealthBar
        path: Array<{ worldX: number; worldZ: number }>
        pathIndex: number
      }[] = []

      let gridMap = new GridMap(currentLevel.mapSize)
      for (const obs of currentLevel.obstacles) {
        gridMap.setWalkable(obs.x, obs.z, false)
      }

      function spawnEnemy(waveConfig: WaveConfig): void {
        const spawnPoint =
          spawnPoints[Math.floor(Math.random() * spawnPoints.length)]

        const mesh = MeshBuilder.CreateSphere(
          `enemy_${Date.now()}`,
          { diameter: 0.8, segments: 8 },
          scene,
        )

        mesh.position = spawnPoint.clone()
        mesh.material = enemyMat
        mesh.receiveShadows = true
        shadowGen.addShadowCaster(mesh)

        const healthBar = createEnemyHealthBar(mesh, waveConfig.enemyHp)

        const path = gridMap
          .findPath(spawnPoint.x, spawnPoint.z, basePosition.x, basePosition.z)
          .map((p) => ({ worldX: p.wx, worldZ: p.wz }))

        enemies.push({
          mesh,
          speed: waveConfig.enemySpeed,
          time: Math.random() * Math.PI * 2,
          hp: waveConfig.enemyHp,
          maxHp: waveConfig.enemyHp,
          healthBar,
          path,
          pathIndex: 0,
        })

        waveEnemiesSpawned++
        waveEnemiesRemaining++
      }

      function killEnemy(index: number, fromWave: WaveConfig): void {
        createExplosion(enemies[index].mesh.position.clone())
        enemies[index].healthBar.plane.dispose()
        enemies[index].mesh.dispose()
        enemies.splice(index, 1)
        waveEnemiesRemaining--
        score += fromWave.scorePerKill
        gold += fromWave.goldPerKill
        onGameEvent({ type: 'SCORE_CHANGED', score })
        onGameEvent({ type: 'GOLD_CHANGED', gold })
      }

      function enemyReachsBase(index: number): void {
        createExplosion(enemies[index].mesh.position.clone())
        enemies[index].healthBar.plane.dispose()
        enemies[index].mesh.dispose()
        enemies.splice(index, 1)
        waveEnemiesRemaining--
        lives -= 1
        onGameEvent({ type: 'LIFE_CHANGED', lives })
        if (lives <= 0) {
          playing = false
          onGameEvent({ type: 'GAME_OVER', score })
        }
      }

      // ── Tower Placement System ────────────────────────────
      const towers: Mesh[] = []
      const towerFireTimers: number[] = []
      const towerConfigs: TowerType[] = []
      const towerShields: {
        mesh: Mesh
        hitIntensity: number
        material: ShaderMaterial
      }[] = []

      function playSpawnAnimation(mesh: Mesh): void {
        const scaleAnim = new Animation(
          'spawnScale',
          'scaling',
          60,
          Animation.ANIMATIONTYPE_VECTOR3,
          Animation.ANIMATIONLOOPMODE_CONSTANT,
        )

        const ease = new BackEase(0.5)
        ease.setEasingMode(EasingFunction.EASINGMODE_EASEOUT)
        scaleAnim.setEasingFunction(ease)
        scaleAnim.setKeys([
          { frame: 0, value: new Vector3(0.01, 0.01, 0.01) },
          { frame: 20, value: new Vector3(1.1, 1.1, 1.1) },
          { frame: 25, value: new Vector3(1, 1, 1) },
        ])
        mesh.animations = [scaleAnim]
        scene.beginAnimation(mesh, 0, 25, false, 1.0)
      }

      function placeTower(position: Vector3): void {
        if (!playing) return

        const gridX = Math.round(position.x)
        const gridZ = Math.round(position.z)

        const occupied = towers.some(
          (t) =>
            Math.round(t.position.x) === gridX &&
            Math.round(t.position.z) === gridZ,
        )
        if (occupied) return

        // レベルの mapSize に基づく配置可能範囲
        const halfSize = Math.floor(levelConfig.mapSize / 2) - 1
        if (Math.abs(gridX) > halfSize || Math.abs(gridZ) > halfSize) return

        // 拠点の近くには置けない
        const bx = Math.round(basePosition.x)
        const bz = Math.round(basePosition.z)
        if (Math.abs(gridX - bx) <= 1 && Math.abs(gridZ - bz) <= 1) return

        // 障害物の上には置けない
        const blockedByObs = levelConfig.obstacles.some(
          (o) => Math.round(o.x) === gridX && Math.round(o.z) === gridZ,
        )
        if (blockedByObs) return

        const towerType =
          TOWER_TYPES.find((t) => t.id === selectedTowerRef.current) ??
          TOWER_TYPES[0]

        if (gold < towerType.cost) return
        gold -= towerType.cost
        onGameEvent({ type: 'GOLD_CHANGED', gold })

        soundManager?.play('place')

        let base: Mesh
        if (towerTemplate) {
          const clone = towerTemplate.clone(`tower_${towers.length}`, null)
          if (clone) {
            base = clone
            base.setEnabled(true)
            base.position = new Vector3(gridX, 0, gridZ)
            base.scaling = new Vector3(0.5, 0.5, 0.5)
          } else {
            base = MeshBuilder.CreateBox(
              `tower_${towers.length}`,
              { width: 1, height: 0.3, depth: 1 },
              scene,
            )
            base.position = new Vector3(gridX, 0.15, gridZ)
            base.material = towerBaseMat
          }
        } else {
          base = MeshBuilder.CreateBox(
            `towerBase_${towers.length}`,
            { width: 1, height: 0.3, depth: 1 },
            scene,
          )
          base.position = new Vector3(gridX, 0.15, gridZ)
          base.material = towerBaseMat

          const type = selectedTowerRef.current
          let bMat = barrelMat
          if (type === 'rapid') bMat = barrelMatRapid
          if (type === 'sniper') bMat = barrelMatSniper

          const barrel = MeshBuilder.CreateCylinder(
            `towerBarrel_${towers.length}`,
            { height: 1.5, diameter: 0.3, tessellation: 8 },
            scene,
          )
          barrel.parent = base
          barrel.position = new Vector3(0, 0.9, 0)
          barrel.material = bMat
        }

        base.receiveShadows = true
        shadowGen.addShadowCaster(base, true)

        const shieldMesh = MeshBuilder.CreateSphere(
          `shield_${towers.length}`,
          { diameter: 1.8, segments: 12 },
          scene,
        )
        shieldMesh.parent = base
        shieldMesh.position = new Vector3(0, 0.5, 0)
        const clonedShieldMat = shieldMat.clone(`shieldMat_${towers.length}`)
        shieldMesh.material = clonedShieldMat
        shieldMesh.onDisposeObservable.add(() => {
          clonedShieldMat.dispose()
        })
        shieldMesh.isPickable = false
        shieldMesh.setEnabled(true)
        towerShields.push({
          mesh: shieldMesh,
          hitIntensity: 0,
          material: clonedShieldMat,
        })

        towers.push(base)
        towerFireTimers.push(0)
        towerConfigs.push(towerType)

        gridMap.setWalkable(gridX, gridZ, false)
        for (const enemy of enemies) {
          const newPath = gridMap
            .findPath(
              Math.round(enemy.mesh.position.x),
              Math.round(enemy.mesh.position.z),
              basePosition.x,
              basePosition.z,
            )
            .map((p) => ({ worldX: p.wx, worldZ: p.wz }))
          enemy.path = newPath
          enemy.pathIndex = 0
        }

        playSpawnAnimation(base)
      }

      // ── Bullet System ──────────────────────────────────
      const activeBullets: {
        mesh: Mesh
        agg: PhysicsAggregate
        targetIndex: number
        timer: number
        waveConfig: WaveConfig
        damage: number
      }[] = []

      function fireBullet(
        from: Vector3,
        targetIndex: number,
        waveConfig: WaveConfig,
        damage: number,
      ): void {
        if (targetIndex < 0 || targetIndex >= enemies.length) return

        const bullet = MeshBuilder.CreateSphere(
          'bullet',
          { diameter: 0.2, segments: 4 },
          scene,
        )

        bullet.position = from.clone()
        bullet.material = bulletMat

        const agg = new PhysicsAggregate(
          bullet,
          PhysicsShapeType.SPHERE,
          { mass: 0.05 },
          scene,
        )

        const dir = enemies[targetIndex].mesh.position
          .subtract(from)
          .normalize()
        agg.body.setLinearVelocity(dir.scale(15))

        activeBullets.push({
          mesh: bullet,
          agg,
          targetIndex,
          timer: 0,
          waveConfig,
          damage,
        })

        soundManager?.play('laser', 0.1)
      }

      // ── Game Start/Restart ─────────────────────────────
      function startWave(waveIndex: number): void {
        const wave = currentWaves[Math.min(waveIndex, currentWaves.length - 1)]
        waveEnemiesSpawned = 0
        waveEnemiesRemaining = wave.enemyCount
        spawnTimer = 0
        onGameEvent({ type: 'WAVE_STARTED', wave: waveIndex + 1 })
      }

      function startGame(level: LevelConfig): void {
        playing = true

        // レベル設定を更新
        levelConfig = level
        currentWaves = level.waves
        spawnPoints = level.spawnPoints.map((p) => new Vector3(p.x, 0.5, p.z))
        basePosition = new Vector3(
          level.basePosition.x,
          0.5,
          level.basePosition.z,
        )

        // シーンのビジュアルを更新
        scene.clearColor = new Color4(
          level.skyColor.r,
          level.skyColor.g,
          level.skyColor.b,
          level.skyColor.a,
        )
        hemisphericLight.intensity = level.ambientIntensity

        // 拠点メッシュの位置を更新
        baseMesh.position.x = level.basePosition.x
        baseMesh.position.z = level.basePosition.z

        // 障害物を再配置
        for (const m of obstaclesMeshes) m.dispose()
        obstaclesMeshes = createObstacleMeshes(level)

        // グリッドマップをリセットして障害物を反映
        gridMap = new GridMap(level.mapSize)
        for (const obs of level.obstacles) {
          gridMap.setWalkable(obs.x, obs.z, false)
        }

        // スコア・ライフ・ゴールドをレベル設定で初期化
        score = 0
        lives = level.startLives
        gold = level.startGold
        currentWaveIndex = 0
        betweenWaveTimer = 0

        for (const e of enemies) {
          e.healthBar.plane.dispose()
          e.mesh.dispose()
        }
        enemies.length = 0

        for (const b of activeBullets) {
          b.agg.dispose()
          b.mesh.dispose()
        }
        activeBullets.length = 0

        onGameEvent({ type: 'SCORE_CHANGED', score })
        onGameEvent({ type: 'LIFE_CHANGED', lives })
        onGameEvent({ type: 'GOLD_CHANGED', gold })

        startWave(0)
      }

      function restartGame(): void {
        for (const t of towers) t.dispose()
        towers.length = 0
        towerFireTimers.length = 0
        towerConfigs.length = 0
        towerShields.length = 0
        startGame(levelConfig)
      }

      // controlRef に外部 API を登録
      controlRef.current = {
        start: startGame,
        restart: restartGame,
      }

      // ── Input: ポインターイベント ─────────────────────────
      scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return
        const pick = pointerInfo.pickInfo
        if (!pick?.hit || !pick.pickedMesh || !pick.pickedPoint) return

        if (pick.pickedMesh.name === 'ground') {
          placeTower(pick.pickedPoint)
        }
      })

      // ── Per-Frame Update ───────────────────────────────
      let shaderTime = 0

      scene.registerBeforeRender(() => {
        const delta = engine.getDeltaTime() / 1000

        shaderTime += delta
        scanlineMat.setFloat('time', shaderTime)
        shieldMat.setFloat('time', shaderTime)
        shieldMat.setVector3('cameraPosition', camera.position)

        for (const shield of towerShields) {
          if (shield.hitIntensity > 0) {
            shield.hitIntensity = Math.max(0, shield.hitIntensity - delta * 2)
            shield.material.setFloat('hitIntensity', shield.hitIntensity)
          }
          shield.material.setFloat('time', shaderTime)
          shield.material.setVector3('cameraPosition', camera.position)
        }

        if (!playing) return

        const currentWave =
          currentWaves[Math.min(currentWaveIndex, currentWaves.length - 1)]

        // 敵のスポーン
        if (waveEnemiesSpawned < currentWave.enemyCount) {
          spawnTimer += delta
          if (spawnTimer >= currentWave.spawnInterval) {
            spawnTimer = 0
            spawnEnemy(currentWave)
          }
        }

        // ウェーブクリア判定
        if (
          waveEnemiesSpawned >= currentWave.enemyCount &&
          enemies.length === 0
        ) {
          betweenWaveTimer += delta
          if (betweenWaveTimer >= BETWEEN_WAVE_DELAY) {
            betweenWaveTimer = 0
            currentWaveIndex++
            if (currentWaveIndex >= currentWaves.length) {
              // 全ウェーブクリア → レベルクリア
              playing = false
              onGameEvent({ type: 'LEVEL_CLEAR' })
            } else {
              startWave(currentWaveIndex)
            }
          }
        }

        // 敵の移動（A* ウェイポイント追跡）
        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i]
          e.time += delta

          if (e.path.length > 0 && e.pathIndex < e.path.length) {
            const target = e.path[e.pathIndex]
            const targetPos = new Vector3(
              target.worldX,
              e.mesh.position.y,
              target.worldZ,
            )
            const toTarget = targetPos.subtract(e.mesh.position)
            const dist = new Vector3(toTarget.x, 0, toTarget.z).length()

            if (dist < 0.3) {
              e.pathIndex++
            } else {
              const dir = new Vector3(toTarget.x, 0, toTarget.z).normalize()
              e.mesh.position.addInPlace(
                dir.scale(Math.min(e.speed * delta, dist)),
              )
              e.mesh.rotation.y = Math.atan2(dir.x, dir.z)
            }

            const distToBase = Vector3.Distance(
              new Vector3(e.mesh.position.x, 0, e.mesh.position.z),
              new Vector3(basePosition.x, 0, basePosition.z),
            )
            if (distToBase < 1.0) {
              enemyReachsBase(i)
              continue
            }
          } else {
            continue
          }

          e.mesh.position.y = 0.5 + Math.sin(e.time * 2.5) * 0.15
        }

        // タワーの発射
        for (let i = 0; i < towers.length; i++) {
          if (enemies.length === 0) continue
          let nearestIdx = 0
          let minDist = Vector3.Distance(
            towers[i].position,
            enemies[0].mesh.position,
          )

          for (let j = 1; j < enemies.length; j++) {
            const d = Vector3.Distance(
              towers[i].position,
              enemies[j].mesh.position,
            )
            if (d < minDist) {
              minDist = d
              nearestIdx = j
            }
          }
          const dir = enemies[nearestIdx].mesh.position.subtract(
            towers[i].position,
          )
          towers[i].rotation.y = Math.atan2(dir.x, dir.z)

          const towerConfig = towerConfigs[i]
          towerFireTimers[i] += delta

          if (
            towerFireTimers[i] >= towerConfig.fireRate &&
            minDist <= towerConfig.range
          ) {
            towerFireTimers[i] = 0
            const muzzlePos = towers[i].position.clone()
            muzzlePos.y += 0.9
            fireBullet(muzzlePos, nearestIdx, currentWave, towerConfig.damage)
          }
        }

        // 弾丸の衝突判定
        for (let bi = activeBullets.length - 1; bi >= 0; bi--) {
          const b = activeBullets[bi]
          b.timer += delta
          if (b.timer > 4) {
            b.agg.dispose()
            b.mesh.dispose()
            activeBullets.splice(bi, 1)
            continue
          }

          for (let ei = enemies.length - 1; ei >= 0; ei--) {
            if (
              Vector3.Distance(b.mesh.position, enemies[ei].mesh.position) < 0.6
            ) {
              enemies[ei].hp -= b.damage
              updateHealthBar(enemies[ei].healthBar, enemies[ei].hp)

              if (enemies[ei].hp <= 0) {
                killEnemy(ei, b.waveConfig)
              }

              b.agg.dispose()
              b.mesh.dispose()
              activeBullets.splice(bi, 1)
              break
            }
          }
        }
      })

      engine.runRenderLoop(() => {
        scene.render()
      })
    }

    init()

    const handleResize = () => {
      engine?.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelled = true
      window.removeEventListener('resize', handleResize)
      soundManager?.dispose()
      engine?.dispose()
    }
  }, [onGameEvent, controlRef])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100vh',
        display: 'block',
      }}
    />
  )
}
```

---

## 確認方法

- タイトル画面でレベルが 3 つ表示される（level1 のみ解放済み）
- level1 をクリアすると level2 が解放される
- 各レベルでマップサイズ・敵の強さ・スポーン位置が異なる
