# L13 — シャドウとアドバンスドライティング

## 概要

リアルタイムシャドウと画像ベースライティング（IBL）を実装する。  
影が付くことで 3D シーンに劇的な奥行き感が生まれる。

**ゲームへの貢献**: 太陽光が宇宙ステーションに影を落とし、宇宙環境のリフレクションが PBR マテリアルに映り込む。

---

## 概念解説

### ShadowGenerator の仕組み

```
DirectionalLight
    |
    | 光線
    |
    ▼ shadow caster（影を落とすオブジェクト）
  [メッシュ] ─→ ShadowMap（深度テクスチャ）
                              |
                              ▼
                  shadow receiver（影が映るオブジェクト）
                  [床・タワー] に影を描画
```

### ShadowGenerator の基本

```typescript
import { ShadowGenerator } from '@babylonjs/core'

// DirectionalLight または SpotLight にアタッチ
const shadowGenerator = new ShadowGenerator(
  1024,        // シャドウマップの解像度（512/1024/2048/4096）
  sunLight     // 光源
)

// 影を落とすオブジェクトを登録
shadowGenerator.addShadowCaster(enemyMesh)
shadowGenerator.addShadowCaster(towerMesh)

// 影を受け取るオブジェクトを設定
ground.receiveShadows = true
```

### シャドウの品質設定

```typescript
// Poisson サンプリング（ソフトシャドウ・軽量）
shadowGenerator.usePoissonSampling = true

// Exponential Shadow Map（ESM）— ぼかしが綺麗
shadowGenerator.useExponentialShadowMap = true

// Blur ESM（最高品質・重い）
shadowGenerator.useBlurExponentialShadowMap = true
shadowGenerator.blurScale = 2

// PCF（Percentage Closer Filtering）— 正確なソフトシャドウ
shadowGenerator.usePercentageCloserFiltering = true
shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_HIGH
```

### シャドウマップの解像度とパフォーマンス

| 解像度 | 品質 | GPU 負荷 |
|---|---|---|
| 512 | 低い（影がドット状） | 非常に軽い |
| 1024 | 標準 | 軽い（推奨） |
| 2048 | 高い | 普通 |
| 4096 | 非常に高い | 重い |

### IBL（Image-Based Lighting）

```typescript
import { CubeTexture } from '@babylonjs/core'

// .env ファイル（Babylon.js 独自フォーマット）
// Babylon.js Playground の IBL Texture Viewer で作成できる
scene.environmentTexture = CubeTexture.CreateFromPrefilteredData('/env/space.env', scene)

// 環境光の強さ
scene.environmentIntensity = 1.0

// スカイボックスとして使う
scene.createDefaultSkybox(scene.environmentTexture, true, 500, 0.3)
//                                                    ↑        ↑
//                              isPBR (PBR用にフィルタリング)  blur（ぼかし）

// テクスチャがない場合のフォールバック
scene.environmentTexture = null
```

### Hemispheric Light で IBL の代替

テクスチャがない場合、`HemisphericLight` が環境光の役割を果たす。  
真の IBL（テクスチャ）があると PBR マテリアルのリフレクションが格段に向上する。

### CascadedShadowGenerator（CSM）— 広大なシーン用

```typescript
import { CascadedShadowGenerator } from '@babylonjs/core'

// 遠くまで高品質な影を出すための複数カスケード
const csmGenerator = new CascadedShadowGenerator(1024, sunLight)
csmGenerator.numCascades = 4
csmGenerator.shadowMaxZ = 100  // 影が出る最大距離
```

---

## 実装手順

### Step 1: DirectionalLight を影生成用に設定する

```typescript
const sunLight = new DirectionalLight('sunLight', new Vector3(-1, -2, -1), scene)
sunLight.intensity = 0.8
sunLight.diffuse = new Color3(1.0, 0.95, 0.8)

// シャドウマップの生成範囲を指定（重要）
sunLight.shadowMinZ = 1
sunLight.shadowMaxZ = 50
```

### Step 2: ShadowGenerator を作成する

```typescript
const shadowGen = new ShadowGenerator(1024, sunLight)
shadowGen.useExponentialShadowMap = true

// 影を落とすオブジェクトを登録
for (const tower of towers) {
  shadowGen.addShadowCaster(tower, true) // true = 子も含めて登録
}
```

### Step 3: 影を受け取るオブジェクトに `receiveShadows = true`

```typescript
ground.receiveShadows = true
```

### Step 4: 環境テクスチャを設定する（任意）

```typescript
// .env ファイルがある場合
try {
  scene.environmentTexture = CubeTexture.CreateFromPrefilteredData('/env/environment.env', scene)
  scene.environmentIntensity = 0.5
} catch {
  // ファイルがなければ HemisphericLight だけで対応
}
```

---

## ポイント解説

### `addShadowCaster(mesh, true)` の第 2 引数
`true` にすると子メッシュ（砲身など）も含めて影を落とすようになる。  
`false`（デフォルト）は指定したメッシュのみ。

### 影のちらつき（Shadow Acne）対策
影が縞模様になるアーティファクト。`shadowGenerator.bias` で調整する。

```typescript
shadowGenerator.bias = 0.00001
// または
shadowGenerator.normalBias = 0.02
```

### 動的オブジェクトへの対応
敵のように毎フレーム位置が変わるオブジェクトも `addShadowCaster` できる。  
ただし影の再計算コストが高いので、数が多い場合は `shadowGenerator.getShadowMap().refreshRate` を調整する。

---

## 全体コード

### `components/game/GameCanvas.tsx`（シャドウと IBL 追加）

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
  DefaultRenderingPipeline,
  ImageProcessingConfiguration,
  ColorCurves,
  ShadowGenerator,
  CubeTexture,
} from '@babylonjs/core'
import { AdvancedDynamicTexture, Rectangle, Control } from '@babylonjs/gui'
import { HavokPlugin } from '@babylonjs/core'
import HavokPhysics from '@babylonjs/havok'
import '@babylonjs/loaders/glTF'
import type { GameEventCallback } from '@/app/game/page'

interface GameCanvasProps {
  gameState: 'menu' | 'playing' | 'paused' | 'gameover'
  onGameEvent: GameEventCallback
  controlRef: MutableRefObject<{ start: () => void; restart: () => void } | null>
  selectedTowerRef: MutableRefObject<string>
}

const WAVES = [
  { enemyCount: 3,  spawnInterval: 2.0, enemySpeed: 1.0, scorePerKill: 10, enemyHp: 3 },
  { enemyCount: 5,  spawnInterval: 1.5, enemySpeed: 1.2, scorePerKill: 15, enemyHp: 5 },
  { enemyCount: 8,  spawnInterval: 1.0, enemySpeed: 1.5, scorePerKill: 20, enemyHp: 7 },
  { enemyCount: 12, spawnInterval: 0.8, enemySpeed: 2.0, scorePerKill: 30, enemyHp: 10 },
]

const SPAWN_POINTS = [
  new Vector3(9, 0.5, 9),
  new Vector3(-9, 0.5, 9),
  new Vector3(9, 0.5, -9),
  new Vector3(-9, 0.5, -9),
]

const BASE_POSITION = new Vector3(0, 0.5, 0)

interface EnemyData {
  mesh: Mesh
  speed: number
  time: number
  hp: number
  maxHp: number
  hpBarFill: Rectangle
}

export default function GameCanvas({ onGameEvent, controlRef, selectedTowerRef }: GameCanvasProps) {
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
      scene.enablePhysics(new Vector3(0, -9.81, 0), new HavokPlugin(true, havokInstance))

      // ── Camera ─────────────────────────────────────────
      const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 3, 20, Vector3.Zero(), scene)
      camera.attachControl(canvasRef.current!, true)
      camera.lowerRadiusLimit = 5
      camera.upperRadiusLimit = 40
      camera.lowerBetaLimit = 0.1
      camera.upperBetaLimit = Math.PI / 2.2

      // ── Post-Processing ────────────────────────────────
      const pipeline = new DefaultRenderingPipeline('default', true, scene, [camera])
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
      pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES
      pipeline.imageProcessing.colorCurvesEnabled = true
      const curves = new ColorCurves()
      curves.globalSaturation = 15
      curves.highlightsHue = 210
      curves.highlightsDensity = 20
      pipeline.imageProcessing.colorCurves = curves
      pipeline.chromaticAberrationEnabled = true
      pipeline.chromaticAberration.aberrationAmount = 20

      // ── Lights ─────────────────────────────────────────
      const hLight = new HemisphericLight('hLight', new Vector3(0, 1, 0), scene)
      hLight.intensity = 0.3
      hLight.diffuse = new Color3(0.6, 0.7, 1.0)
      hLight.groundColor = new Color3(0.05, 0.05, 0.1)

      const sunLight = new DirectionalLight('sunLight', new Vector3(-1, -2, -1), scene)
      sunLight.intensity = 1.0
      sunLight.diffuse = new Color3(1.0, 0.95, 0.8)
      sunLight.position = new Vector3(10, 20, 10) // シャドウ計算のための位置
      sunLight.shadowMinZ = 0.1
      sunLight.shadowMaxZ = 60

      // ── Environment Texture（IBL）─────────────────────
      try {
        scene.environmentTexture = CubeTexture.CreateFromPrefilteredData(
          '/env/environment.env', scene
        )
        scene.environmentIntensity = 0.5
        // スカイボックスは使わない（宇宙は漆黒なので clearColor で代替）
      } catch {
        // .env ファイルがない場合は何もしない（HemisphericLight が代替する）
      }

      // ── Shadow Generator ───────────────────────────────
      const shadowGen = new ShadowGenerator(1024, sunLight)
      shadowGen.useExponentialShadowMap = true
      shadowGen.bias = 0.0001

      // ── Ground ─────────────────────────────────────────
      const ground = MeshBuilder.CreateGround('ground', { width: 20, height: 20, subdivisions: 1 }, scene)
      const groundMat = new PBRMaterial('groundMat', scene)
      groundMat.albedoColor = new Color3(0.15, 0.15, 0.2)
      groundMat.metallic = 0.8
      groundMat.roughness = 0.4
      ground.material = groundMat
      ground.receiveShadows = true
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
      barrelMat.emissiveIntensity = 2.5

      const enemyMat = new StandardMaterial('enemyMat', scene)
      enemyMat.diffuseColor = new Color3(0.8, 0.1, 0.1)
      enemyMat.emissiveColor = new Color3(0.4, 0, 0)

      const bulletMat = new PBRMaterial('bulletMat', scene)
      bulletMat.albedoColor = new Color3(1.0, 0.8, 0.0)
      bulletMat.emissiveColor = new Color3(1.0, 0.6, 0.0)
      bulletMat.emissiveIntensity = 3.0
      bulletMat.metallic = 0
      bulletMat.roughness = 0

      const baseMat = new PBRMaterial('baseMat', scene)
      baseMat.albedoColor = new Color3(0.2, 0.8, 0.2)
      baseMat.emissiveColor = new Color3(0, 1.0, 0)
      baseMat.emissiveIntensity = 1.5
      baseMat.metallic = 0.5
      baseMat.roughness = 0.3

      // ── Base ───────────────────────────────────────────
      const base = MeshBuilder.CreateCylinder('base', { height: 0.3, diameter: 2, tessellation: 16 }, scene)
      base.position.y = 0.15
      base.material = baseMat
      base.receiveShadows = true
      shadowGen.addShadowCaster(base)
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
      stars.color1 = new Color4(1, 1, 1, 1)
      stars.color2 = new Color4(0.8, 0.9, 1, 0.8)
      stars.colorDead = new Color4(1, 1, 1, 0)
      stars.minSize = 0.02
      stars.maxSize = 0.1
      stars.emitRate = 15
      stars.blendMode = ParticleSystem.BLENDMODE_ONEONE
      stars.start()

      // ── Explosion ──────────────────────────────────────
      function createExplosion(position: Vector3): void {
        const ps = new ParticleSystem('explosion', 200, scene)
        ps.emitter = position.clone()
        ps.minEmitBox = new Vector3(-0.2, -0.2, -0.2)
        ps.maxEmitBox = new Vector3(0.2, 0.2, 0.2)
        ps.minLifeTime = 0.2
        ps.maxLifeTime = 1.0
        ps.minEmitPower = 3
        ps.maxEmitPower = 10
        ps.direction1 = new Vector3(-1, -1, -1)
        ps.direction2 = new Vector3(1, 1, 1)
        ps.gravity = new Vector3(0, -2, 0)
        ps.color1 = new Color4(1, 0.8, 0, 1)
        ps.color2 = new Color4(1, 0.2, 0, 1)
        ps.colorDead = new Color4(0.1, 0.1, 0.1, 0)
        ps.minSize = 0.1
        ps.maxSize = 0.6
        ps.emitRate = 500
        ps.blendMode = ParticleSystem.BLENDMODE_ONEONE
        ps.targetStopDuration = 0.15
        ps.disposeOnStop = true
        ps.start()
      }

      // ── Health Bar ─────────────────────────────────────
      function createHealthBar(enemy: Mesh): Rectangle {
        const plane = MeshBuilder.CreatePlane('hpPlane', { width: 1.5, height: 0.2 }, scene)
        plane.parent = enemy
        plane.position.y = 0.9
        plane.billboardMode = Mesh.BILLBOARDMODE_ALL
        plane.isPickable = false
        const ui = AdvancedDynamicTexture.CreateForMesh(plane, 256, 32)
        const bg = new Rectangle()
        bg.width = '100%'; bg.height = '100%'; bg.background = '#1a1a2e'; bg.thickness = 1; bg.color = '#444'
        ui.addControl(bg)
        const fill = new Rectangle()
        fill.width = '100%'; fill.height = '80%'; fill.background = '#22c55e'; fill.thickness = 0
        fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
        bg.addControl(fill)
        return fill
      }

      function updateHealthBar(fill: Rectangle, hp: number, maxHp: number): void {
        const pct = Math.max(0, hp) / maxHp
        fill.width = `${pct * 100}%`
        if (pct > 0.5) fill.background = '#22c55e'
        else if (pct > 0.25) fill.background = '#f59e0b'
        else fill.background = '#ef4444'
      }

      // ── Game State ─────────────────────────────────────
      const enemies: EnemyData[] = []
      let playing = false
      let score = 0
      let lives = 20
      let gold = 200
      let currentWaveIndex = 0
      let waveEnemiesSpawned = 0
      let spawnTimer = 0
      let betweenWaveTimer = 0
      const BETWEEN_WAVE_DELAY = 5

      function spawnEnemy(waveConfig: typeof WAVES[0]): void {
        const sp = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)]
        const mesh = MeshBuilder.CreateSphere(`enemy_${Date.now()}`, { diameter: 0.8, segments: 8 }, scene)
        mesh.position = sp.clone()
        mesh.material = enemyMat
        mesh.receiveShadows = true
        shadowGen.addShadowCaster(mesh)
        const fill = createHealthBar(mesh)
        enemies.push({ mesh, speed: waveConfig.enemySpeed, time: Math.random() * Math.PI * 2, hp: waveConfig.enemyHp, maxHp: waveConfig.enemyHp, hpBarFill: fill })
        waveEnemiesSpawned++
      }

      function killEnemy(index: number, waveConfig: typeof WAVES[0]): void {
        createExplosion(enemies[index].mesh.position.clone())
        enemies[index].mesh.dispose()
        enemies.splice(index, 1)
        score += waveConfig.scorePerKill
        gold += waveConfig.scorePerKill
        onGameEvent({ type: 'SCORE_CHANGED', score })
        onGameEvent({ type: 'GOLD_CHANGED', gold })
      }

      function enemyReachesBase(index: number): void {
        createExplosion(enemies[index].mesh.position.clone())
        enemies[index].mesh.dispose()
        enemies.splice(index, 1)
        lives -= 1
        onGameEvent({ type: 'LIFE_CHANGED', lives })
        if (lives <= 0) { playing = false; onGameEvent({ type: 'GAME_OVER', score }) }
      }

      const towers: Mesh[] = []
      const towerFireTimers: number[] = []

      function playSpawnAnimation(mesh: Mesh): void {
        const anim = new Animation('spawnScale', 'scaling', 60, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_ONCE)
        const ease = new BackEase(0.5)
        ease.setEasingMode(EasingFunction.EASINGMODE_EASEOUT)
        anim.setEasingFunction(ease)
        anim.setKeys([
          { frame: 0,  value: new Vector3(0.01, 0.01, 0.01) },
          { frame: 20, value: new Vector3(1.1, 1.1, 1.1) },
          { frame: 25, value: new Vector3(1, 1, 1) },
        ])
        mesh.animations = [anim]
        scene.beginAnimation(mesh, 0, 25, false, 1.0)
      }

      function placeTower(position: Vector3): void {
        if (!playing) return
        const TOWER_COSTS: Record<string, number> = { basic: 50, rapid: 80, sniper: 120 }
        const type = selectedTowerRef.current
        const cost = TOWER_COSTS[type] ?? 50
        if (gold < cost) return
        const gridX = Math.round(position.x)
        const gridZ = Math.round(position.z)
        if (towers.some((t) => Math.round(t.position.x) === gridX && Math.round(t.position.z) === gridZ)) return
        if (Math.abs(gridX) > 9 || Math.abs(gridZ) > 9) return
        if (Math.abs(gridX) < 1 && Math.abs(gridZ) < 1) return

        gold -= cost
        onGameEvent({ type: 'GOLD_CHANGED', gold })

        const towerBase = MeshBuilder.CreateBox(`towerBase_${towers.length}`, { width: 1, height: 0.3, depth: 1 }, scene)
        towerBase.position = new Vector3(gridX, 0.15, gridZ)
        towerBase.material = towerBaseMat
        towerBase.receiveShadows = true
        shadowGen.addShadowCaster(towerBase, true)
        new PhysicsAggregate(towerBase, PhysicsShapeType.BOX, { mass: 0 }, scene)

        const bMat = barrelMat.clone(`barrelMat_${type}`)
        if (type === 'rapid')  { bMat.emissiveColor = new Color3(0, 1, 0.3); bMat.albedoColor = new Color3(0, 0.5, 0.2) }
        if (type === 'sniper') { bMat.emissiveColor = new Color3(0.8, 0, 1); bMat.albedoColor = new Color3(0.4, 0, 0.6) }

        const barrel = MeshBuilder.CreateCylinder(`towerBarrel_${towers.length}`, { height: 1.5, diameter: 0.3, tessellation: 8 }, scene)
        barrel.parent = towerBase
        barrel.position = new Vector3(0, 0.9, 0)
        barrel.material = bMat

        towers.push(towerBase)
        towerFireTimers.push(0)
        playSpawnAnimation(towerBase)
      }

      const activeBullets: { mesh: Mesh; agg: PhysicsAggregate; timer: number; waveIdx: number }[] = []

      function fireBullet(from: Vector3, nearestIdx: number, waveIdx: number): void {
        if (nearestIdx < 0 || nearestIdx >= enemies.length) return
        const bullet = MeshBuilder.CreateSphere('bullet', { diameter: 0.2, segments: 4 }, scene)
        bullet.position = from.clone()
        bullet.material = bulletMat
        const agg = new PhysicsAggregate(bullet, PhysicsShapeType.SPHERE, { mass: 0.05 }, scene)
        const dir = enemies[nearestIdx].mesh.position.subtract(from).normalize()
        agg.body.setLinearVelocity(dir.scale(15))
        activeBullets.push({ mesh: bullet, agg, timer: 0, waveIdx })
      }

      function startWave(idx: number): void {
        waveEnemiesSpawned = 0; spawnTimer = 0
        onGameEvent({ type: 'WAVE_STARTED', wave: idx + 1 })
      }

      function startGame(): void {
        playing = true; score = 0; lives = 20; gold = 200
        currentWaveIndex = 0; betweenWaveTimer = 0
        for (const e of enemies) e.mesh.dispose()
        enemies.length = 0
        onGameEvent({ type: 'SCORE_CHANGED', score })
        onGameEvent({ type: 'LIFE_CHANGED', lives })
        onGameEvent({ type: 'GOLD_CHANGED', gold })
        startWave(0)
      }

      function restartGame(): void {
        for (const t of towers) t.dispose()
        towers.length = 0; towerFireTimers.length = 0
        startGame()
      }

      controlRef.current = { start: startGame, restart: restartGame }

      scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return
        const pick = pointerInfo.pickInfo
        if (!pick?.hit || !pick.pickedMesh || !pick.pickedPoint) return
        if (pick.pickedMesh.name === 'ground') placeTower(pick.pickedPoint)
      })

      const FIRE_RATES: Record<string, number> = { basic: 2.0, rapid: 0.8, sniper: 4.0 }

      scene.registerBeforeRender(() => {
        if (!playing) return
        const delta = engine.getDeltaTime() / 1000
        const currentWave = WAVES[Math.min(currentWaveIndex, WAVES.length - 1)]

        if (waveEnemiesSpawned < currentWave.enemyCount) {
          spawnTimer += delta
          if (spawnTimer >= currentWave.spawnInterval) { spawnTimer = 0; spawnEnemy(currentWave) }
        }

        if (waveEnemiesSpawned >= currentWave.enemyCount && enemies.length === 0) {
          betweenWaveTimer += delta
          if (betweenWaveTimer >= BETWEEN_WAVE_DELAY) {
            betweenWaveTimer = 0
            currentWaveIndex = Math.min(currentWaveIndex + 1, WAVES.length - 1)
            startWave(currentWaveIndex)
          }
        }

        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i]
          e.time += delta
          const dir = BASE_POSITION.subtract(e.mesh.position)
          if (dir.length() < 1.0) { enemyReachesBase(i); continue }
          e.mesh.position.addInPlace(dir.normalize().scale(e.speed * delta))
          e.mesh.position.y = 0.5 + Math.sin(e.time * 2.5) * 0.15
          e.mesh.rotation.y += 0.3 * delta
        }

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
          const fireRate = FIRE_RATES['basic'] ?? 2.0
          towerFireTimers[i] += delta
          if (towerFireTimers[i] >= fireRate) {
            towerFireTimers[i] = 0
            const muzzle = towers[i].position.clone(); muzzle.y += 0.9
            fireBullet(muzzle, nearestIdx, currentWaveIndex)
          }
        }

        for (let bi = activeBullets.length - 1; bi >= 0; bi--) {
          const b = activeBullets[bi]
          b.timer += delta
          if (b.timer > 5) { b.agg.dispose(); b.mesh.dispose(); activeBullets.splice(bi, 1); continue }
          const waveConfig = WAVES[Math.min(b.waveIdx, WAVES.length - 1)]
          for (let ei = enemies.length - 1; ei >= 0; ei--) {
            if (Vector3.Distance(b.mesh.position, enemies[ei].mesh.position) < 0.7) {
              enemies[ei].hp -= 1
              updateHealthBar(enemies[ei].hpBarFill, enemies[ei].hp, enemies[ei].maxHp)
              if (enemies[ei].hp <= 0) killEnemy(ei, waveConfig)
              b.agg.dispose(); b.mesh.dispose(); activeBullets.splice(bi, 1)
              break
            }
          }
        }
      })

      engine.runRenderLoop(() => { scene.render() })
      window.addEventListener('resize', () => { engine.resize() })
    }

    init()
    return () => { engine?.dispose() }
  }, [onGameEvent, controlRef, selectedTowerRef])

  return (
    <canvas ref={canvasRef} style={{ width: '100%', height: '100vh', display: 'block' }} />
  )
}
```

---

## 確認方法

- タワーと敵が床に影を落としている
- 影のエッジがソフトでリアルに見える（ESM）
- PBR マテリアルが環境光を受けて滑らかに光っている（IBL がある場合）
- 影が動く敵に追従している
