# L11 — GUI / HUD の実装

## 概要

Babylon.js 組み込みの GUI ライブラリで「3D 空間に追従する UI」を実装する。  
React オーバーレイとの使い分けと、敵の頭上に体力バーを表示する方法を学ぶ。

**ゲームへの貢献**: 敵の頭上にリアルタイムで動く体力バー。タワー選択用の React 製メニューバー。

---

## 概念解説

### 2 つのアプローチの比較

| | Babylon.js GUI | React オーバーレイ |
|---|---|---|
| 使いどき | 3D オブジェクトに追従する UI | 画面固定の HUD・メニュー |
| API | `AdvancedDynamicTexture` | 普通の React コンポーネント |
| shadcn/ui | 使えない | 使える |
| パフォーマンス | Canvas 内で描画（高速） | DOM で描画 |
| 例 | 体力バー・名前タグ | スコア・設定画面 |

### AdvancedDynamicTexture の 2 モード

```typescript
import { AdvancedDynamicTexture } from '@babylonjs/gui'

// フルスクリーン UI（画面固定の HUD に使う）
const ui = AdvancedDynamicTexture.CreateFullscreenUI('ui', true, scene)

// メッシュ追従 UI（3D オブジェクトに追従させる）
const meshUi = AdvancedDynamicTexture.CreateForMesh(mesh, 256, 64)
```

### フルスクリーン UI の基本コントロール

```typescript
import { TextBlock, Button, Rectangle, StackPanel, Control } from '@babylonjs/gui'

// テキスト
const text = new TextBlock()
text.text = 'Hello'
text.color = 'white'
text.fontSize = 24
text.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
ui.addControl(text)

// ボタン
const btn = Button.CreateSimpleButton('btn', 'CLICK ME')
btn.width = '150px'
btn.height = '40px'
btn.color = 'white'
btn.background = '#3b82f6'
btn.onPointerClickObservable.add(() => { console.log('clicked') })
ui.addControl(btn)

// 長方形（体力バーの背景）
const bar = new Rectangle('bar')
bar.width = '100px'
bar.height = '10px'
bar.color = 'transparent'
bar.background = '#333'
ui.addControl(bar)
```

### 3D オブジェクト追従 UI（Billboard Panel）

```typescript
import { Rectangle, Control, AdvancedDynamicTexture } from '@babylonjs/gui'

// 敵の頭上に体力バーを表示する
function createHealthBar(enemy: Mesh): void {
  // 平面を作ってそこに UI を貼る
  const plane = MeshBuilder.CreatePlane('hpPlane', { width: 2, height: 0.3 }, scene)
  plane.parent = enemy       // 敵の子にすることで追従
  plane.position.y = 0.8    // 敵の頭上に配置
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL // カメラの方を常に向く

  const planeUI = AdvancedDynamicTexture.CreateForMesh(plane, 256, 32)

  // 背景
  const bg = new Rectangle('hpBg')
  bg.width = '100%'
  bg.height = '100%'
  bg.background = '#333'
  bg.thickness = 0
  planeUI.addControl(bg)

  // HP バー（緑）
  const hpFill = new Rectangle('hpFill')
  hpFill.width = '100%'
  hpFill.height = '100%'
  hpFill.background = '#22c55e'
  hpFill.thickness = 0
  hpFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
  bg.addControl(hpFill)

  // HP を更新する関数を返す
  // hpFill.width = `${(currentHp / maxHp) * 100}%`
}
```

### `linkWithMesh` を使う方法（フルスクリーン UI での追従）

```typescript
// フルスクリーン UI のコントロールをメッシュに追従させる
const label = new TextBlock()
label.text = 'ENEMY'
label.color = 'white'
ui.addControl(label)
label.linkWithMesh(enemyMesh)       // メッシュの位置に追従
label.linkOffsetY = -50             // Y 方向オフセット（ピクセル）
```

---

## 実装手順

### Step 1: `@babylonjs/gui` をインストール確認

```bash
# L01 でインストール済みのはず
npm install @babylonjs/gui
```

### Step 2: 敵に体力バーコンポーネントを作る

```typescript
interface EnemyHealthBar {
  plane: Mesh
  fillRect: Rectangle
  currentHp: number
  maxHp: number
}

function createEnemyHealthBar(enemy: Mesh, maxHp: number): EnemyHealthBar {
  const plane = MeshBuilder.CreatePlane('hpPlane', { width: 1.5, height: 0.2 }, scene)
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
  bg.color = '#333'
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
  // HP が少ないと赤くなる
  if (pct > 0.5) bar.fillRect.background = '#22c55e'
  else if (pct > 0.25) bar.fillRect.background = '#f59e0b'
  else bar.fillRect.background = '#ef4444'
}
```

### Step 3: タワー選択バーを React で作る

```tsx
// components/game/TowerSelector.tsx
'use client'

interface TowerType {
  id: string
  name: string
  cost: number
  color: string
  description: string
}

const TOWER_TYPES: TowerType[] = [
  { id: 'basic',  name: 'Basic',  cost: 50,  color: 'bg-blue-600',   description: '標準タワー' },
  { id: 'rapid',  name: 'Rapid',  cost: 80,  color: 'bg-green-600',  description: '連射タイプ' },
  { id: 'sniper', name: 'Sniper', cost: 120, color: 'bg-purple-600', description: '超遠距離' },
]

interface TowerSelectorProps {
  selectedTower: string
  onSelect: (id: string) => void
  gold: number
}

export function TowerSelector({ selectedTower, onSelect, gold }: TowerSelectorProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
      {TOWER_TYPES.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          disabled={gold < t.cost}
          className={`
            px-4 py-2 rounded-lg text-white font-bold border-2 transition-all
            ${t.color}
            ${selectedTower === t.id ? 'border-white scale-110' : 'border-transparent opacity-80'}
            ${gold < t.cost ? 'opacity-40 cursor-not-allowed' : 'hover:scale-105 cursor-pointer'}
          `}
        >
          <div className="text-sm">{t.name}</div>
          <div className="text-xs text-yellow-300">{t.cost}G</div>
        </button>
      ))}
    </div>
  )
}
```

---

## ポイント解説

### `billboardMode` の種類
```typescript
Mesh.BILLBOARDMODE_NONE  // ビルボードなし
Mesh.BILLBOARDMODE_X     // X 軸周りのみ回転
Mesh.BILLBOARDMODE_Y     // Y 軸周りのみ回転（看板に最適）
Mesh.BILLBOARDMODE_ALL   // 全軸（常にカメラ正面を向く）
```

体力バーのような UI は `BILLBOARDMODE_ALL` で常にカメラを向かせる。

### UI 専用の平面には `isPickable = false`
体力バーの平面は見た目だけなので、クリックに反応しないように設定する。  
設定しないと床のクリックが体力バーにブロックされてタワーを設置できなくなる。

---

## 全体コード

### `components/game/TowerSelector.tsx`

```tsx
'use client'

export interface TowerType {
  id: string
  name: string
  cost: number
  color: string
  description: string
  fireRate: number
  damage: number
  range: number
}

export const TOWER_TYPES: TowerType[] = [
  { id: 'basic',  name: 'Basic',  cost: 50,  color: 'bg-blue-600',   description: '標準タワー',  fireRate: 2.0, damage: 1, range: 8 },
  { id: 'rapid',  name: 'Rapid',  cost: 80,  color: 'bg-green-600',  description: '高速連射',    fireRate: 0.8, damage: 1, range: 5 },
  { id: 'sniper', name: 'Sniper', cost: 120, color: 'bg-purple-600', description: '超遠距離',    fireRate: 4.0, damage: 3, range: 15 },
]

interface TowerSelectorProps {
  selectedTower: string
  onSelect: (id: string) => void
  gold: number
}

export function TowerSelector({ selectedTower, onSelect, gold }: TowerSelectorProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
      {TOWER_TYPES.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          disabled={gold < t.cost}
          className={[
            'px-4 py-3 rounded-xl text-white font-bold border-2 transition-all min-w-[90px]',
            t.color,
            selectedTower === t.id ? 'border-white scale-110 shadow-lg shadow-white/20' : 'border-transparent opacity-80',
            gold < t.cost ? 'opacity-40 cursor-not-allowed' : 'hover:scale-105 cursor-pointer',
          ].join(' ')}
        >
          <div className="text-sm font-bold">{t.name}</div>
          <div className="text-xs text-gray-300 mt-1">{t.description}</div>
          <div className="text-xs text-yellow-300 mt-1 font-mono">{t.cost}G</div>
        </button>
      ))}
    </div>
  )
}
```

---

### `components/game/HUD.tsx`

```tsx
'use client'

interface HUDProps {
  score: number
  lives: number
  wave: number
  gold: number
  gameState: 'menu' | 'playing' | 'paused' | 'gameover'
  onStart: () => void
  onRestart: () => void
}

export function HUD({ score, lives, wave, gold, gameState, onStart, onRestart }: HUDProps) {
  if (gameState === 'menu') {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
        <div className="text-center text-white">
          <h1 className="text-5xl font-bold mb-2 tracking-widest">NEBULA DEFENSE</h1>
          <p className="text-gray-400 mb-8">床をクリックしてタワーを設置し、敵の侵攻を防げ</p>
          <button onClick={onStart} className="px-10 py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-xl font-bold transition-colors">PLAY</button>
        </div>
      </div>
    )
  }

  if (gameState === 'gameover') {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/70">
        <div className="text-center text-white">
          <h1 className="text-5xl font-bold mb-2 text-red-400">GAME OVER</h1>
          <p className="text-3xl mb-8">Score: {score}</p>
          <button onClick={onRestart} className="px-10 py-4 bg-red-600 hover:bg-red-500 rounded-lg text-xl font-bold transition-colors">RETRY</button>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center pointer-events-none select-none">
      <div className="bg-black/50 px-4 py-2 rounded-lg backdrop-blur-sm">
        <span className="text-blue-300 text-sm">SCORE</span>
        <div className="text-white font-bold text-xl">{score}</div>
      </div>
      <div className="bg-black/50 px-4 py-2 rounded-lg backdrop-blur-sm">
        <span className="text-yellow-300 text-sm">WAVE</span>
        <div className="text-white font-bold text-xl">{wave}</div>
      </div>
      <div className="bg-black/50 px-4 py-2 rounded-lg backdrop-blur-sm">
        <span className="text-red-300 text-sm">LIVES</span>
        <div className="text-white font-bold text-xl">{lives}</div>
      </div>
      <div className="bg-black/50 px-4 py-2 rounded-lg backdrop-blur-sm">
        <span className="text-yellow-300 text-sm">GOLD</span>
        <div className="text-white font-bold text-xl">{gold}G</div>
      </div>
    </div>
  )
}
```

---

### `app/game/page.tsx`

```tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { HUD } from '@/components/game/HUD'
import { TowerSelector } from '@/components/game/TowerSelector'

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
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'paused' | 'gameover'>('menu')
  const gameControlRef = useRef<{ start: () => void; restart: () => void } | null>(null)
  const selectedTowerRef = useRef(selectedTower)

  const handleTowerSelect = useCallback((id: string) => {
    setSelectedTower(id)
    selectedTowerRef.current = id
  }, [])

  const handleGameEvent = useCallback((event: { type: string; score?: number; lives?: number; wave?: number; gold?: number }) => {
    if (event.type === 'SCORE_CHANGED' && event.score !== undefined) setScore(event.score)
    if (event.type === 'LIFE_CHANGED' && event.lives !== undefined) setLives(event.lives)
    if (event.type === 'WAVE_STARTED' && event.wave !== undefined) setWave(event.wave)
    if (event.type === 'GOLD_CHANGED' && event.gold !== undefined) setGold(event.gold)
    if (event.type === 'GAME_OVER') setGameState('gameover')
  }, [])

  const handleStart = useCallback(() => {
    setGameState('playing')
    gameControlRef.current?.start()
  }, [])

  const handleRestart = useCallback(() => {
    setScore(0)
    setLives(20)
    setWave(1)
    setGold(200)
    setGameState('playing')
    gameControlRef.current?.restart()
  }, [])

  return (
    <main className="relative w-full h-screen overflow-hidden bg-black">
      <GameCanvas
        gameState={gameState}
        onGameEvent={handleGameEvent}
        controlRef={gameControlRef}
        selectedTowerRef={selectedTowerRef}
      />
      <HUD
        score={score}
        lives={lives}
        wave={wave}
        gold={gold}
        gameState={gameState}
        onStart={handleStart}
        onRestart={handleRestart}
      />
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

### `components/game/GameCanvas.tsx`（体力バー追加部分のみ抜粋 → 前回のコードに追記）

```tsx
// import に追加
import { AdvancedDynamicTexture, Rectangle, Control } from '@babylonjs/gui'

// 型定義
interface EnemyHealthBar {
  plane: Mesh
  fillRect: Rectangle
  currentHp: number
  maxHp: number
}

// createEnemyHealthBar 関数（scene 初期化後に定義）
function createEnemyHealthBar(enemy: Mesh, maxHp: number): EnemyHealthBar {
  const plane = MeshBuilder.CreatePlane('hpPlane', { width: 1.5, height: 0.2 }, scene)
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
```

---

### `components/game/GameCanvas.tsx`（完全版）

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
} from '@babylonjs/core'
import { HavokPlugin } from '@babylonjs/core'
import HavokPhysics from '@babylonjs/havok'
import '@babylonjs/loaders/glTF'
import { AdvancedDynamicTexture, Rectangle, Control } from '@babylonjs/gui'
import { TOWER_TYPES, TowerType } from '@/components/game/TowerSelector'
import type { GameEventCallback } from '@/app/game/page'

interface EnemyHealthBar {
  plane: Mesh
  fillRect: Rectangle
  currentHp: number
  maxHp: number
}

interface GameCanvasProps {
  gameState: 'menu' | 'playing' | 'pause' | 'gameover'
  onGameEvent: GameEventCallback
  controlRef: MutableRefObject<{ start: () => void; restart: () => void } | null>
  selectedTowerRef: MutableRefObject<string>
}

interface WaveConfig {
  enemyCount: number
  spawnInterval: number
  enemySpeed: number
  scorePerKill: number
  enemyHp: number
  goldPerKill: number
}

const WAVES: WaveConfig[] = [
  { enemyCount: 3,  spawnInterval: 2.0, enemySpeed: 1.0, scorePerKill: 10, enemyHp: 2, goldPerKill: 20 },
  { enemyCount: 5,  spawnInterval: 1.5, enemySpeed: 1.2, scorePerKill: 15, enemyHp: 3, goldPerKill: 25 },
  { enemyCount: 8,  spawnInterval: 1.0, enemySpeed: 1.5, scorePerKill: 20, enemyHp: 4, goldPerKill: 30 },
  { enemyCount: 12, spawnInterval: 0.8, enemySpeed: 2.0, scorePerKill: 30, enemyHp: 6, goldPerKill: 40 },
]

const SPAWN_POINTS = [
  new Vector3(9, 0.5, 9),
  new Vector3(-9, 0.5, 9),
  new Vector3(9, 0.5, -9),
  new Vector3(-9, 0.5, -9),
]

const BASE_POSITION = new Vector3(0, 0.5, 0)

export default function GameCanvas({
  gameState: externalGameState,
  onGameEvent,
  controlRef,
  selectedTowerRef,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    let engine: Engine
    let cancelled = false

    const init = async () => {
      engine = new Engine(canvasRef.current, true)
      const scene = new Scene(engine)
      scene.clearColor = new Color4(0.02, 0.02, 0.05, 1)

      function createEnemyHealthBar(enemy: Mesh, maxHp: number): EnemyHealthBar {
        const plane = MeshBuilder.CreatePlane('hpPlane', { width: 1.5, height: 0.2 }, scene)
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

      // ── Camera ─────────────────────────────────────────
      const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 3, 20, Vector3.Zero(), scene)
      camera.attachControl(canvasRef.current, true)
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
      const ground = MeshBuilder.CreateGround('ground', { width: 20, height: 20, subdivisions: 20 }, scene)
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

      // ── Base（守るべき拠点）────────────────────────────
      const base = MeshBuilder.CreateCylinder('base', { height: 0.3, diameter: 2, tessellation: 16 }, scene)
      base.position = BASE_POSITION.clone()
      base.position.y = 0.15
      base.material = baseMat
      new PhysicsAggregate(base, PhysicsShapeType.CYLINDER, { mass: 0 }, scene)

      // ── Particle Texture ────────────────────────────────
      const particleTex = new DynamicTexture('particleTex', { width: 64, height: 64 }, scene, false)
      const ctx = particleTex.getContext()
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
      grad.addColorStop(0, 'rgba(255,255,255,1)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 64, 64)
      particleTex.update()

      // ── Stars ──────────────────────────────────────────
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

      // ── Game State ─────────────────────────────────────
      let playing = false
      let score = 0
      let lives = 20
      let gold = 200
      let currentWaveIndex = 0
      let waveEnemiesRemaining = 0
      let waveEnemiesSpawned = 0
      let spawnTimer = 0
      let betweenWaveTimer = 0
      const BETWEEN_WAVE_DELAY = 5

      // ── Explosion ──────────────────────────────────────
      function createExplosion(position: Vector3): void {
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
            ps.dispose(false) // disposeTexture=false で共有テクスチャを守る
            scene.unregisterAfterRender(cleanup)
          }
        }
        scene.registerAfterRender(cleanup)
      }

      // ── Asset Loading ──────────────────────────────────
      let enemyTemplate: Mesh
      try {
        const result = await ImportMeshAsync('/model/enemy.glb', scene, { meshNames: '' })
        enemyTemplate = result.meshes[0] as Mesh
        enemyTemplate.name = 'enemyTemplate'
        enemyTemplate.setEnabled(false)
        result.animationGroups.forEach((g) => { g.stop() })
      } catch {
        enemyTemplate = MeshBuilder.CreateSphere('enemyTemplate', { diameter: 0.8, segments: 8 }, scene)
        enemyTemplate.material = enemyMat
        enemyTemplate.setEnabled(false)
      }
      if (cancelled) return

      let towerTemplate: Mesh | null = null
      try {
        const result = await ImportMeshAsync('/model/tower.glb', scene, { meshNames: '' })
        towerTemplate = result.meshes[0] as Mesh
        towerTemplate.name = 'towerTemplate'
        towerTemplate.setEnabled(false)
      } catch {
        towerTemplate = null
      }
      if (cancelled) return

      // ── Enemy System ───────────────────────────────────
      const enemies: {
        mesh: Mesh
        speed: number
        time: number
        hp: number
        maxHp: number
        healthBar: EnemyHealthBar
      }[] = []

      function spawnEnemy(waveConfig: WaveConfig): void {
        const spawnPoint = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)]
        const mesh = MeshBuilder.CreateSphere(`enemy_${Date.now()}`, { diameter: 0.8, segments: 8 }, scene)
        mesh.position = spawnPoint.clone()
        mesh.material = enemyMat
        const healthBar = createEnemyHealthBar(mesh, waveConfig.enemyHp)
        enemies.push({
          mesh,
          speed: waveConfig.enemySpeed,
          time: Math.random() * Math.PI * 2,
          hp: waveConfig.enemyHp,
          maxHp: waveConfig.enemyHp,
          healthBar,
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

      function enemyReachesBase(index: number): void {
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

      // ── Tower System ───────────────────────────────────
      const towers: Mesh[] = []
      const towerFireTimers: number[] = []
      const towerConfigs: TowerType[] = []

      function playSpawnAnimation(mesh: Mesh): void {
        const scaleAnim = new Animation(
          'spawnScale', 'scaling', 60,
          Animation.ANIMATIONTYPE_VECTOR3,
          Animation.ANIMATIONLOOPMODE_CONSTANT,
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

      function placeTower(position: Vector3): void {
        if (!playing) return
        const gridX = Math.round(position.x)
        const gridZ = Math.round(position.z)
        const occupied = towers.some(
          (t) => Math.round(t.position.x) === gridX && Math.round(t.position.z) === gridZ,
        )
        if (occupied) return
        if (Math.abs(gridX) > 9 || Math.abs(gridZ) > 9) return
        if (Math.abs(gridX) < 1 && Math.abs(gridZ) < 1) return

        const towerType = TOWER_TYPES.find((t) => t.id === selectedTowerRef.current) ?? TOWER_TYPES[0]
        if (gold < towerType.cost) return
        gold -= towerType.cost
        onGameEvent({ type: 'GOLD_CHANGED', gold })

        let towerBase: Mesh
        if (towerTemplate) {
          const clone = towerTemplate.clone(`tower_${towers.length}`, null)
          if (clone) {
            towerBase = clone
            towerBase.setEnabled(true)
            towerBase.position = new Vector3(gridX, 0, gridZ)
            towerBase.scaling = new Vector3(0.5, 0.5, 0.5)
          } else {
            towerBase = MeshBuilder.CreateBox(`towerBase_${towers.length}`, { width: 1, height: 0.3, depth: 1 }, scene)
            towerBase.position = new Vector3(gridX, 0.15, gridZ)
            towerBase.material = towerBaseMat
          }
        } else {
          towerBase = MeshBuilder.CreateBox(`towerBase_${towers.length}`, { width: 1, height: 0.3, depth: 1 }, scene)
          towerBase.position = new Vector3(gridX, 0.15, gridZ)
          towerBase.material = towerBaseMat
          const barrel = MeshBuilder.CreateCylinder(
            `towerBarrel_${towers.length}`,
            { height: 1.5, diameter: 0.3, tessellation: 8 },
            scene,
          )
          barrel.parent = towerBase
          barrel.position = new Vector3(0, 0.9, 0)
          barrel.material = barrelMat
        }

        towers.push(towerBase)
        towerFireTimers.push(0)
        towerConfigs.push(towerType)
        playSpawnAnimation(towerBase)
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

      function fireBullet(from: Vector3, targetIndex: number, waveConfig: WaveConfig, damage: number): void {
        if (targetIndex < 0 || targetIndex >= enemies.length) return
        const bullet = MeshBuilder.CreateSphere('bullet', { diameter: 0.2, segments: 4 }, scene)
        bullet.position = from.clone()
        bullet.material = bulletMat
        const agg = new PhysicsAggregate(bullet, PhysicsShapeType.SPHERE, { mass: 0.05 }, scene)
        const dir = enemies[targetIndex].mesh.position.subtract(from).normalize()
        agg.body.setLinearVelocity(dir.scale(15))
        activeBullets.push({ mesh: bullet, agg, targetIndex, timer: 0, waveConfig, damage })
      }

      // ── Game Start/Restart ─────────────────────────────
      function startWave(waveIndex: number): void {
        const wave = WAVES[Math.min(waveIndex, WAVES.length - 1)]
        waveEnemiesSpawned = 0
        waveEnemiesRemaining = wave.enemyCount
        spawnTimer = 0
        onGameEvent({ type: 'WAVE_STARTED', wave: waveIndex + 1 })
      }

      function startGame(): void {
        playing = true
        score = 0
        lives = 20
        gold = 200
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
        onGameEvent({ type: 'GOLD_CHANGED', gold })
        startWave(0)
      }

      function restartGame(): void {
        for (const t of towers) t.dispose()
        towers.length = 0
        towerFireTimers.length = 0
        towerConfigs.length = 0
        startGame()
      }

      controlRef.current = { start: startGame, restart: restartGame }

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
        if (!playing) return
        const delta = engine.getDeltaTime() / 1000
        const currentWave = WAVES[Math.min(currentWaveIndex, WAVES.length - 1)]

        // 敵スポーン
        if (waveEnemiesSpawned < currentWave.enemyCount) {
          spawnTimer += delta
          if (spawnTimer >= currentWave.spawnInterval) {
            spawnTimer = 0
            spawnEnemy(currentWave)
          }
        }

        // ウェーブクリア判定
        if (waveEnemiesSpawned >= currentWave.enemyCount && enemies.length === 0) {
          betweenWaveTimer += delta
          if (betweenWaveTimer >= BETWEEN_WAVE_DELAY) {
            betweenWaveTimer = 0
            currentWaveIndex++
            if (currentWaveIndex >= WAVES.length) {
              currentWaveIndex = WAVES.length - 1
            }
            startWave(currentWaveIndex)
          }
        }

        // 敵の移動
        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i]
          e.time += delta
          const dir = BASE_POSITION.subtract(e.mesh.position)
          const dist = dir.length()
          if (dist < 1.0) {
            enemyReachesBase(i)
            continue
          }
          e.mesh.position.addInPlace(dir.normalize().scale(e.speed * delta))
          e.mesh.position.y = 0.5 + Math.sin(e.time * 2.5) * 0.15
          e.mesh.rotation.y += 0.3 * delta
        }

        // タワーの発射
        for (let i = 0; i < towers.length; i++) {
          if (enemies.length === 0) continue
          let nearestIdx = 0
          let minDist = Vector3.Distance(towers[i].position, enemies[0].mesh.position)
          for (let j = 1; j < enemies.length; j++) {
            const d = Vector3.Distance(towers[i].position, enemies[j].mesh.position)
            if (d < minDist) { minDist = d; nearestIdx = j }
          }
          const dir = enemies[nearestIdx].mesh.position.subtract(towers[i].position)
          towers[i].rotation.y = Math.atan2(dir.x, dir.z)

          const towerConfig = towerConfigs[i]
          towerFireTimers[i] += delta
          if (towerFireTimers[i] >= towerConfig.fireRate && minDist <= towerConfig.range) {
            towerFireTimers[i] = 0
            const muzzlePos = towers[i].position.clone()
            muzzlePos.y += 0.9
            fireBullet(muzzlePos, nearestIdx, currentWave, towerConfig.damage)
          }
        }

        // 弾丸の衝突判定・ダメージ処理
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
            if (Vector3.Distance(b.mesh.position, enemies[ei].mesh.position) < 0.6) {
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

      engine.runRenderLoop(() => { scene.render() })
    }

    init()

    const handleResize = () => { engine?.resize() }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelled = true
      window.removeEventListener('resize', handleResize)
      engine?.dispose()
    }
  }, [onGameEvent, controlRef])

  return (
    <canvas ref={canvasRef} style={{ width: '100%', height: '100vh', display: 'block' }} />
  )
}
```

---

## 確認方法

- 各敵の頭上に体力バーが表示され、カメラの方向を常に向く
- 画面上部に SCORE / WAVE / LIVES / GOLD が表示される
- 画面下部にタワー選択ボタンが表示される
- GOLD が足りないタワーはグレーアウトされる
