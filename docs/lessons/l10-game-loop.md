# L10 — ゲームループとスコアシステム

## 概要

ゲームの状態管理（MENU / PLAYING / PAUSED / GAME_OVER）、ウェーブシステム、スコア表示を実装する。  
Babylon.js と React の状態を `Observable` と `useRef` でつなぐパターンを学ぶ。

**ゲームへの貢献**: Phase 2 の集大成。ウェーブ開始→敵スポーン→撃破→スコア加算→次ウェーブ、のループが完成する。

---

## 概念解説

### ゲームの状態管理

```typescript
enum GameState {
  MENU,      // タイトル画面
  PLAYING,   // ゲーム中
  PAUSED,    // 一時停止
  GAME_OVER, // ゲームオーバー
}
```

### Babylon.js から React への通知（Observable）

Babylon.js の `Observable<T>` はイベントバスとして使える。

```typescript
import { Observable } from '@babylonjs/core'

// ゲームイベントの定義
type GameEvent =
  | { type: 'SCORE_CHANGED'; score: number }
  | { type: 'LIFE_CHANGED'; lives: number }
  | { type: 'WAVE_STARTED'; wave: number }
  | { type: 'GAME_OVER'; finalScore: number }

const gameEventBus = new Observable<GameEvent>()

// Babylon 側から送信
gameEventBus.notifyObservers({ type: 'SCORE_CHANGED', score: 100 })

// React 側で受信（useEffect 内）
const observer = gameEventBus.add((event) => {
  if (event.type === 'SCORE_CHANGED') setScore(event.score)
})
// クリーンアップ時に必ず remove
gameEventBus.remove(observer)
```

### React → Babylon への通知（ref 経由）

```typescript
// GameCanvas.tsx
const gameApiRef = useRef<{
  startGame: () => void
  pauseGame: () => void
  resumeGame: () => void
} | null>(null)

// 外部から呼べる API を ref に格納
gameApiRef.current = {
  startGame: () => { gameState = GameState.PLAYING },
  pauseGame: () => { gameState = GameState.PAUSED },
  resumeGame: () => { gameState = GameState.PLAYING },
}

// 親コンポーネントから使う場合
<GameCanvas ref={gameApiRef} />
```

### ウェーブシステムの設計

```typescript
interface WaveConfig {
  enemyCount: number
  spawnInterval: number  // 敵スポーン間隔（秒）
  enemySpeed: number
}

const waves: WaveConfig[] = [
  { enemyCount: 3,  spawnInterval: 2, enemySpeed: 1.0 },
  { enemyCount: 5,  spawnInterval: 1.5, enemySpeed: 1.2 },
  { enemyCount: 8,  spawnInterval: 1.0, enemySpeed: 1.5 },
]
```

### フレーム処理でタイマーを管理する

`setInterval` ではなく `scene.registerBeforeRender` でタイマーを管理する。  
理由: `scene.registerBeforeRender` はゲームが一時停止したときも含めて  
`engine.getDeltaTime()` で正確な経過時間を得られるから。

```typescript
let spawnTimer = 0

scene.registerBeforeRender(() => {
  if (gameState !== GameState.PLAYING) return
  const delta = engine.getDeltaTime() / 1000

  spawnTimer += delta
  if (spawnTimer >= currentWave.spawnInterval) {
    spawnTimer = 0
    spawnNextEnemy()
  }
})
```

---

## 実装手順

### Step 1: HUD 用の React コンポーネントを別ファイルに分離する

`components/game/HUD.tsx` を新規作成し、スコア・ライフ・ウェーブを表示する。

```tsx
// components/game/HUD.tsx
'use client'

interface HUDProps {
  score: number
  lives: number
  wave: number
  gameState: 'menu' | 'playing' | 'paused' | 'gameover'
  onStart: () => void
  onRestart: () => void
}

export function HUD({ score, lives, wave, gameState, onStart, onRestart }: HUDProps) {
  if (gameState === 'menu') {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-5xl font-bold mb-4">NEBULA DEFENSE</h1>
          <button onClick={onStart} className="px-8 py-3 bg-blue-600 rounded-lg text-xl">
            PLAY
          </button>
        </div>
      </div>
    )
  }

  if (gameState === 'gameover') {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-4xl font-bold mb-2">GAME OVER</h1>
          <p className="text-2xl mb-4">Score: {score}</p>
          <button onClick={onRestart} className="px-8 py-3 bg-red-600 rounded-lg text-xl">
            RETRY
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between pointer-events-none">
      <div className="text-white font-bold text-xl">SCORE: {score}</div>
      <div className="text-white font-bold text-xl">WAVE: {wave}</div>
      <div className="text-white font-bold text-xl">{'❤️'.repeat(lives)}</div>
    </div>
  )
}
```

### Step 2: ゲームページで状態を管理する

`app/game/page.tsx` でスコア・ライフ・ウェーブを `useState` で管理し、  
`GameCanvas` と `HUD` をオーバーレイで重ねる。

---

## ポイント解説

### `setInterval` を使わない理由
`setInterval` はブラウザのタイマーで動き、`scene.paused` とは独立して実行される。  
ゲームを一時停止してもタイマーが走り続けてしまう。  
`scene.registerBeforeRender` + `getDeltaTime()` なら一時停止に連動できる。

### Observable の Observer を必ず解除する
`gameEventBus.add()` で登録した Observer は `gameEventBus.remove()` か  
`engine.dispose()` 前に必ず解除する。  
解除しないとコンポーネント再マウント時に Observer が蓄積してメモリリークになる。

---

## 全体コード

### `app/game/page.tsx`

```tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { HUD } from '@/components/game/HUD'

const GameCanvas = dynamic(
  () => import('@/components/game/GameCanvas'),
  { ssr: false }
)

export type GameEventCallback = (event: {
  type: string
  score?: number
  lives?: number
  wave?: number
}) => void

export default function GamePage() {
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(20)
  const [wave, setWave] = useState(1)
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'paused' | 'gameover'>('menu')

  const gameControlRef = useRef<{ start: () => void; restart: () => void } | null>(null)

  const handleGameEvent = useCallback((event: { type: string; score?: number; lives?: number; wave?: number }) => {
    if (event.type === 'SCORE_CHANGED' && event.score !== undefined) setScore(event.score)
    if (event.type === 'LIFE_CHANGED' && event.lives !== undefined) setLives(event.lives)
    if (event.type === 'WAVE_STARTED' && event.wave !== undefined) setWave(event.wave)
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
    setGameState('playing')
    gameControlRef.current?.restart()
  }, [])

  return (
    <main className="relative w-full h-screen overflow-hidden bg-black">
      <GameCanvas
        gameState={gameState}
        onGameEvent={handleGameEvent}
        controlRef={gameControlRef}
      />
      <HUD
        score={score}
        lives={lives}
        wave={wave}
        gameState={gameState}
        onStart={handleStart}
        onRestart={handleRestart}
      />
    </main>
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
  gameState: 'menu' | 'playing' | 'paused' | 'gameover'
  onStart: () => void
  onRestart: () => void
}

export function HUD({ score, lives, wave, gameState, onStart, onRestart }: HUDProps) {
  if (gameState === 'menu') {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
        <div className="text-center text-white">
          <h1 className="text-5xl font-bold mb-2 tracking-widest">NEBULA DEFENSE</h1>
          <p className="text-gray-400 mb-8">床をクリックしてタワーを設置し、敵の侵攻を防げ</p>
          <button
            onClick={onStart}
            className="px-10 py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-xl font-bold transition-colors"
          >
            PLAY
          </button>
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
          <button
            onClick={onRestart}
            className="px-10 py-4 bg-red-600 hover:bg-red-500 rounded-lg text-xl font-bold transition-colors"
          >
            RETRY
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center pointer-events-none select-none">
      <div className="bg-black/50 px-4 py-2 rounded-lg">
        <span className="text-blue-300 font-bold text-lg">SCORE</span>
        <span className="text-white font-bold text-2xl ml-2">{score}</span>
      </div>
      <div className="bg-black/50 px-4 py-2 rounded-lg">
        <span className="text-yellow-300 font-bold text-lg">WAVE</span>
        <span className="text-white font-bold text-2xl ml-2">{wave}</span>
      </div>
      <div className="bg-black/50 px-4 py-2 rounded-lg">
        <span className="text-red-300 font-bold text-lg">LIVES</span>
        <span className="text-white font-bold text-2xl ml-2">{lives}</span>
      </div>
    </div>
  )
}
```

---

### `components/game/GameCanvas.tsx`

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
  ParticleSystem,
  GPUParticleSystem,
} from '@babylonjs/core'
import { HavokPlugin } from '@babylonjs/core'
import HavokPhysics from '@babylonjs/havok'
import '@babylonjs/loaders/glTF'
import type { GameEventCallback } from '@/app/game/page'

interface GameCanvasProps {
  gameState: 'menu' | 'playing' | 'paused' | 'gameover'
  onGameEvent: GameEventCallback
  controlRef: MutableRefObject<{ start: () => void; restart: () => void } | null>
}

interface WaveConfig {
  enemyCount: number
  spawnInterval: number
  enemySpeed: number
  scorePerKill: number
}

const WAVES: WaveConfig[] = [
  { enemyCount: 3,  spawnInterval: 2.0, enemySpeed: 1.0, scorePerKill: 10 },
  { enemyCount: 5,  spawnInterval: 1.5, enemySpeed: 1.2, scorePerKill: 15 },
  { enemyCount: 8,  spawnInterval: 1.0, enemySpeed: 1.5, scorePerKill: 20 },
  { enemyCount: 12, spawnInterval: 0.8, enemySpeed: 2.0, scorePerKill: 30 },
]

const SPAWN_POINTS = [
  new Vector3(9, 0.5, 9),
  new Vector3(-9, 0.5, 9),
  new Vector3(9, 0.5, -9),
  new Vector3(-9, 0.5, -9),
]

const BASE_POSITION = new Vector3(0, 0.5, 0)

export default function GameCanvas({ gameState: externalGameState, onGameEvent, controlRef }: GameCanvasProps) {
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
      const hLight = new HemisphericLight('hLight', new Vector3(0, 1, 0), scene)
      hLight.intensity = 0.4
      hLight.diffuse = new Color3(0.6, 0.7, 1.0)
      hLight.groundColor = new Color3(0.1, 0.1, 0.2)

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

      // ── Stars ──────────────────────────────────────────
      const stars = new GPUParticleSystem('stars', { capacity: 2000 }, scene)
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
      let currentWaveIndex = 0
      let waveEnemiesRemaining = 0
      let waveEnemiesSpawned = 0
      let spawnTimer = 0
      let betweenWaveTimer = 0
      const BETWEEN_WAVE_DELAY = 5 // 秒

      // ── Explosion ──────────────────────────────────────
      function createExplosion(position: Vector3): void {
        const ps = new ParticleSystem('explosion', 150, scene)
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
        ps.disposeOnStop = true
        ps.start()
      }

      // ── Enemy System ───────────────────────────────────
      const enemies: { mesh: Mesh; speed: number; time: number }[] = []

      function spawnEnemy(waveConfig: WaveConfig): void {
        const spawnPoint = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)]
        const mesh = MeshBuilder.CreateSphere(`enemy_${Date.now()}`, { diameter: 0.8, segments: 8 }, scene)
        mesh.position = spawnPoint.clone()
        mesh.material = enemyMat
        enemies.push({ mesh, speed: waveConfig.enemySpeed, time: Math.random() * Math.PI * 2 })
        waveEnemiesSpawned++
        waveEnemiesRemaining++
      }

      function killEnemy(index: number, fromWave: WaveConfig): void {
        createExplosion(enemies[index].mesh.position.clone())
        enemies[index].mesh.dispose()
        enemies.splice(index, 1)
        waveEnemiesRemaining--
        score += fromWave.scorePerKill
        onGameEvent({ type: 'SCORE_CHANGED', score })
      }

      function enemyReachesBase(index: number): void {
        createExplosion(enemies[index].mesh.position.clone())
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

      function placeTower(position: Vector3): void {
        if (!playing) return
        const gridX = Math.round(position.x)
        const gridZ = Math.round(position.z)
        const occupied = towers.some(
          (t) => Math.round(t.position.x) === gridX && Math.round(t.position.z) === gridZ
        )
        if (occupied) return
        if (Math.abs(gridX) > 9 || Math.abs(gridZ) > 9) return
        if (Math.abs(gridX) < 1 && Math.abs(gridZ) < 1) return // 拠点の上に設置しない

        const towerBase = MeshBuilder.CreateBox(
          `towerBase_${towers.length}`, { width: 1, height: 0.3, depth: 1 }, scene
        )
        towerBase.position = new Vector3(gridX, 0.15, gridZ)
        towerBase.material = towerBaseMat
        new PhysicsAggregate(towerBase, PhysicsShapeType.BOX, { mass: 0 }, scene)

        const barrel = MeshBuilder.CreateCylinder(
          `towerBarrel_${towers.length}`, { height: 1.5, diameter: 0.3, tessellation: 8 }, scene
        )
        barrel.parent = towerBase
        barrel.position = new Vector3(0, 0.9, 0)
        barrel.material = barrelMat

        towers.push(towerBase)
        towerFireTimers.push(0)
        playSpawnAnimation(towerBase)
      }

      // ── Bullet System ──────────────────────────────────
      const activeBullets: { mesh: Mesh; agg: PhysicsAggregate; targetIndex: number; timer: number; waveConfig: WaveConfig }[] = []

      function fireBullet(from: Vector3, targetIndex: number, waveConfig: WaveConfig): void {
        if (targetIndex < 0 || targetIndex >= enemies.length) return
        const bullet = MeshBuilder.CreateSphere('bullet', { diameter: 0.2, segments: 4 }, scene)
        bullet.position = from.clone()
        bullet.material = bulletMat
        const agg = new PhysicsAggregate(bullet, PhysicsShapeType.SPHERE, { mass: 0.05 }, scene)
        const dir = enemies[targetIndex].mesh.position.subtract(from).normalize()
        agg.body.setLinearVelocity(dir.scale(15))
        activeBullets.push({ mesh: bullet, agg, targetIndex, timer: 0, waveConfig })
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
        currentWaveIndex = 0
        betweenWaveTimer = 0
        // 既存の敵を全削除
        for (const e of enemies) e.mesh.dispose()
        enemies.length = 0
        startWave(0)
      }

      function restartGame(): void {
        // タワーを全削除
        for (const t of towers) t.dispose()
        towers.length = 0
        towerFireTimers.length = 0
        startGame()
      }

      // controlRef に外部 API を登録
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

        // 敵のスポーン
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
              // 最終ウェーブクリア → ループ（難易度上昇付き）
              currentWaveIndex = WAVES.length - 1
            }
            startWave(currentWaveIndex)
          }
        }

        // 敵の移動（拠点に向かって移動）
        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i]
          e.time += delta
          // 拠点方向に移動
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

          towerFireTimers[i] += delta
          if (towerFireTimers[i] >= 2.0) {
            towerFireTimers[i] = 0
            const muzzlePos = towers[i].position.clone()
            muzzlePos.y += 0.9
            fireBullet(muzzlePos, nearestIdx, currentWave)
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
          const targetIdx = enemies.findIndex((e, idx) => idx === b.targetIndex || false)
          // 全敵との距離チェック（ターゲットが消えた場合を考慮）
          for (let ei = enemies.length - 1; ei >= 0; ei--) {
            if (Vector3.Distance(b.mesh.position, enemies[ei].mesh.position) < 0.6) {
              killEnemy(ei, b.waveConfig)
              b.agg.dispose()
              b.mesh.dispose()
              activeBullets.splice(bi, 1)
              break
            }
          }
        }
      })

      engine.runRenderLoop(() => { scene.render() })
      const handleResize = () => { engine.resize() }
      window.addEventListener('resize', handleResize)
    }

    init()
    return () => { engine?.dispose() }
  }, [onGameEvent, controlRef])

  return (
    <canvas ref={canvasRef} style={{ width: '100%', height: '100vh', display: 'block' }} />
  )
}
```

---

## 確認方法

`http://localhost:3000/game` を開く。

1. タイトル画面が表示される
2. PLAY をクリックするとゲーム開始
3. 床をクリックしてタワーを設置する
4. 敵が 4 隅からスポーンし、中央の拠点（緑の円）に向かって進む
5. タワーが 2 秒ごとに弾を発射し、当たると爆発して敵が消える
6. 敵が拠点に到達するとライフが減る
7. ライフが 0 になるとゲームオーバー画面に遷移する
8. RETRY でリスタート

**Phase 2 完了**: ゲームとして成立するループが完成した。
