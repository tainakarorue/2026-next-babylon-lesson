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

## 確認方法

- 各敵の頭上に体力バーが表示され、カメラの方向を常に向く
- 画面上部に SCORE / WAVE / LIVES / GOLD が表示される
- 画面下部にタワー選択ボタンが表示される
- GOLD が足りないタワーはグレーアウトされる
