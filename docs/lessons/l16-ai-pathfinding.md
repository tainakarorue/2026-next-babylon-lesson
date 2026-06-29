# L16 — AI と経路探索

## 概要

A\* アルゴリズムを TypeScript で実装し、敵が障害物（タワー）を迂回してインテリジェントに移動するようにする。

**ゲームへの貢献**: 敵がタワーを設置するたびにルートを再計算し、新しい迂回路を探す。

---

## 概念解説

### A\* アルゴリズムとは

「スタート」から「ゴール」までの最短経路を効率的に探すアルゴリズム。

```
コスト関数:
  f(n) = g(n) + h(n)
  g(n) = スタートからノード n までの実コスト
  h(n) = ノード n からゴールまでの推定コスト（ヒューリスティック）
```

h(n) にユークリッド距離やマンハッタン距離を使う。

### グリッドマップの表現

タワーディフェンスのマップをグリッドとして表現する。

```
グリッド (20x20, セルサイズ 1.0):
  (0,0)────────────(19,0)
    |   W = 壁       |
    |   . = 通路     |
    |   T = タワー   |
  (0,19)──────────(19,19)

座標変換:
  worldX = gridX - HALF_SIZE  →  gridX = worldX + HALF_SIZE
  worldZ = gridZ - HALF_SIZE  →  gridZ = worldZ + HALF_SIZE
```

### ウェイポイントとの違い

| 方式           | 特徴                                                     |
| -------------- | -------------------------------------------------------- |
| ウェイポイント | 事前に決めた経路点を順に移動。動的な障害物に対応できない |
| A\* グリッド   | 毎回最短経路を計算。タワー設置で再計算できる             |
| NavMesh        | 3D の複雑な地形に対応。`@babylonjs/addons` の RecastJS   |

---

## 実装手順

### Step 1: グリッドマップクラスを作る

```typescript
// lib/babylon/pathfinding.ts
export interface GridNode {
  x: number
  z: number
  walkable: boolean
  g: number
  h: number
  f: number
  parent: GridNode | null
}

export class GridMap {
  private grid: GridNode[][] = []
  readonly size: number
  readonly cellSize: number
  readonly offset: number

  constructor(size = 20, cellSize = 1) {
    this.size = size
    this.cellSize = cellSize
    this.offset = Math.floor(size / 2)

    // グリッドを初期化
    for (let z = 0; z < size; z++) {
      this.grid[z] = []
      for (let x = 0; x < size; x++) {
        this.grid[z][x] = {
          x,
          z,
          walkable: true,
          g: 0,
          h: 0,
          f: 0,
          parent: null,
        }
      }
    }
  }

  worldToGrid(worldX: number, worldZ: number): { x: number; z: number } {
    return {
      x: Math.round(worldX) + this.offset,
      z: Math.round(worldZ) + this.offset,
    }
  }

  gridToWorld(x: number, z: number): { worldX: number; worldZ: number } {
    return {
      worldX: x - this.offset,
      worldZ: z - this.offset,
    }
  }

  setWalkable(worldX: number, worldZ: number, walkable: boolean): void {
    const { x, z } = this.worldToGrid(worldX, worldZ)
    if (x >= 0 && x < this.size && z >= 0 && z < this.size) {
      this.grid[z][x].walkable = walkable
    }
  }

  isWalkable(worldX: number, worldZ: number): boolean {
    const { x, z } = this.worldToGrid(worldX, worldZ)
    if (x < 0 || x >= this.size || z < 0 || z >= this.size) return false
    return this.grid[z][x].walkable
  }

  private getNeighbors(node: GridNode): GridNode[] {
    const neighbors: GridNode[] = []
    const dirs = [
      { dx: 1, dz: 0 },
      { dx: -1, dz: 0 },
      { dx: 0, dz: 1 },
      { dx: 0, dz: -1 },
      // 斜め移動も許可する場合:
      // { dx: 1, dz: 1 }, { dx: -1, dz: 1 },
      // { dx: 1, dz: -1 }, { dx: -1, dz: -1 },
    ]
    for (const { dx, dz } of dirs) {
      const nx = node.x + dx
      const nz = node.z + dz
      if (nx >= 0 && nx < this.size && nz >= 0 && nz < this.size) {
        neighbors.push(this.grid[nz][nx])
      }
    }
    return neighbors
  }

  findPath(
    startWorldX: number,
    startWorldZ: number,
    endWorldX: number,
    endWorldZ: number,
  ): Array<{ worldX: number; worldZ: number }> {
    const startGrid = this.worldToGrid(startWorldX, startWorldZ)
    const endGrid = this.worldToGrid(endWorldX, endWorldZ)

    // グリッドをリセット
    for (let z = 0; z < this.size; z++) {
      for (let x = 0; x < this.size; x++) {
        const node = this.grid[z][x]
        node.g = 0
        node.h = 0
        node.f = 0
        node.parent = null
      }
    }

    const startNode = this.grid[startGrid.z]?.[startGrid.x]
    const endNode = this.grid[endGrid.z]?.[endGrid.x]

    if (!startNode || !endNode) return []

    const openSet: GridNode[] = [startNode]
    const closedSet = new Set<GridNode>()

    while (openSet.length > 0) {
      // f 値が最小のノードを選ぶ
      let currentIdx = 0
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[currentIdx].f) currentIdx = i
      }
      const current = openSet[currentIdx]

      if (current === endNode) {
        // パスを再構築
        const path: Array<{ worldX: number; worldZ: number }> = []
        let node: GridNode | null = current
        while (node) {
          const { worldX, worldZ } = this.gridToWorld(node.x, node.z)
          path.unshift({ worldX, worldZ })
          node = node.parent
        }
        return path
      }

      openSet.splice(currentIdx, 1)
      closedSet.add(current)

      for (const neighbor of this.getNeighbors(current)) {
        if (!neighbor.walkable || closedSet.has(neighbor)) continue

        const tentativeG = current.g + 1

        if (!openSet.includes(neighbor)) {
          openSet.push(neighbor)
        } else if (tentativeG >= neighbor.g) {
          continue
        }

        neighbor.parent = current
        neighbor.g = tentativeG
        // マンハッタン距離をヒューリスティックに使う
        neighbor.h =
          Math.abs(neighbor.x - endNode.x) + Math.abs(neighbor.z - endNode.z)
        neighbor.f = neighbor.g + neighbor.h
      }
    }

    return [] // パスが見つからない
  }
}
```

### Step 2: 敵の AI をウェイポイント追跡に変更する

```typescript
interface EnemyData {
  mesh: Mesh
  speed: number
  time: number
  hp: number
  maxHp: number
  hpBarFill: Rectangle
  path: Array<{ worldX: number; worldZ: number }>  // 追加
  pathIndex: number                                  // 追加
}

function spawnEnemy(waveConfig: ..., gridMap: GridMap): void {
  // ...（省略）
  const spawnPoint = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)]
  const path = gridMap.findPath(
    spawnPoint.x, spawnPoint.z,
    BASE_POSITION.x, BASE_POSITION.z
  )
  enemies.push({ ..., path, pathIndex: 0 })
}
```

### Step 3: タワー設置時に全敵のパスを再計算する

```typescript
function placeTower(position: Vector3, gridMap: GridMap): void {
  // ...タワーを設置する処理...

  // グリッドマップを更新
  gridMap.setWalkable(gridX, gridZ, false)

  // 全敵のパスを再計算
  for (const enemy of enemies) {
    const currentPos = enemy.mesh.position
    const newPath = gridMap.findPath(
      currentPos.x,
      currentPos.z,
      BASE_POSITION.x,
      BASE_POSITION.z,
    )

    enemy.path = newPath
    enemy.pathIndex = 0
  }
}
```

### Step 4: フレームごとのウェイポイント追跡

```typescript
// per-frame update 内
for (let i = enemies.length - 1; i >= 0; i--) {
  const e = enemies[i]
  e.time += delta

  if (e.path.length === 0 || e.pathIndex >= e.path.length) {
    // パスがない → 直線移動にフォールバック
    const dir = BASE_POSITION.subtract(e.mesh.position)
    if (dir.length() < 1.0) {
      enemyReachesBase(i)
      continue
    }
    e.mesh.position.addInPlace(dir.normalize().scale(e.speed * delta))
  } else {
    // ウェイポイントに向かって移動
    const target = e.path[e.pathIndex]
    const targetPos = new Vector3(
      target.worldX,
      e.mesh.position.y,
      target.worldZ,
    )
    const dir = targetPos.subtract(e.mesh.position)
    const dist = dir.length()

    if (dist < 0.3) {
      e.pathIndex++
    } else {
      e.mesh.position.addInPlace(dir.normalize().scale(e.speed * delta))
    }

    if (e.pathIndex >= e.path.length) {
      const distToBase = Vector3.Distance(e.mesh.position, BASE_POSITION)
      if (distToBase < 1.0) {
        enemyReachesBase(i)
        continue
      }
    }
  }

  e.mesh.position.y = 0.5 + Math.sin(e.time * 2.5) * 0.15
  const dir2D = new Vector3(
    e.pathIndex < e.path.length
      ? e.path[e.pathIndex].worldX - e.mesh.position.x
      : 0,
    0,
    e.pathIndex < e.path.length
      ? e.path[e.pathIndex].worldZ - e.mesh.position.z
      : 0,
  )
  if (dir2D.length() > 0.01) {
    e.mesh.rotation.y = Math.atan2(dir2D.x, dir2D.z)
  }
}
```

---

## 全体コード

### `lib/babylon/pathfinding.ts`

```typescript
export interface GridNode {
  x: number
  z: number
  walkable: boolean
  g: number
  h: number
  f: number
  parent: GridNode | null
}

export class GridMap {
  private grid: GridNode[][] = []
  readonly size: number
  readonly offset: number

  constructor(size = 20) {
    this.size = size
    this.offset = Math.floor(size / 2)
    for (let z = 0; z < size; z++) {
      this.grid[z] = []
      for (let x = 0; x < size; x++) {
        this.grid[z][x] = {
          x,
          z,
          walkable: true,
          g: 0,
          h: 0,
          f: 0,
          parent: null,
        }
      }
    }
  }

  worldToGrid(wx: number, wz: number): { x: number; z: number } {
    return { x: Math.round(wx) + this.offset, z: Math.round(wz) + this.offset }
  }

  gridToWorld(x: number, z: number): { wx: number; wz: number } {
    return { wx: x - this.offset, wz: z - this.offset }
  }

  setWalkable(wx: number, wz: number, walkable: boolean): void {
    const { x, z } = this.worldToGrid(wx, wz)
    if (x >= 0 && x < this.size && z >= 0 && z < this.size) {
      this.grid[z][x].walkable = walkable
    }
  }

  findPath(
    swx: number,
    swz: number,
    ewx: number,
    ewz: number,
  ): Array<{ wx: number; wz: number }> {
    const sg = this.worldToGrid(swx, swz)
    const eg = this.worldToGrid(ewx, ewz)

    for (let z = 0; z < this.size; z++) {
      for (let x = 0; x < this.size; x++) {
        const n = this.grid[z][x]
        n.g = 0
        n.h = 0
        n.f = 0
        n.parent = null
      }
    }

    const startNode = this.grid[sg.z]?.[sg.x]
    const endNode = this.grid[eg.z]?.[eg.x]
    if (!startNode || !endNode || !endNode.walkable) return []

    const openSet: GridNode[] = [startNode]
    const closedSet = new Set<GridNode>()
    const DIRS = [
      { dx: 1, dz: 0 },
      { dx: -1, dz: 0 },
      { dx: 0, dz: 1 },
      { dx: 0, dz: -1 },
    ]

    while (openSet.length > 0) {
      let ci = 0
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[ci].f) ci = i
      }
      const cur = openSet[ci]

      if (cur === endNode) {
        const path: Array<{ wx: number; wz: number }> = []
        let n: GridNode | null = cur
        while (n) {
          path.unshift(this.gridToWorld(n.x, n.z))
          n = n.parent
        }
        return path
      }

      openSet.splice(ci, 1)
      closedSet.add(cur)

      for (const { dx, dz } of DIRS) {
        const nx = cur.x + dx
        const nz = cur.z + dz
        if (nx < 0 || nx >= this.size || nz < 0 || nz >= this.size) continue
        const nb = this.grid[nz][nx]
        if (!nb.walkable || closedSet.has(nb)) continue

        const tg = cur.g + 1
        if (!openSet.includes(nb)) openSet.push(nb)
        else if (tg >= nb.g) continue

        nb.parent = cur
        nb.g = tg
        nb.h = Math.abs(nb.x - endNode.x) + Math.abs(nb.z - endNode.z)
        nb.f = nb.g + nb.h
      }
    }
    return []
  }
}
```

---

### `components/game/GameCanvas.tsx`（経路探索追加の主要変更点）

```tsx
// import 追加
import { GridMap } from '@/lib/babylon/pathfinding'

// init() 内に追加
const gridMap = new GridMap(20)

// spawnEnemy 内: パスを計算して敵に持たせる
const path = gridMap.findPath(
  sp.x, sp.z,
  BASE_POSITION.x, BASE_POSITION.z
).map(p => ({ worldX: p.wx, worldZ: p.wz }))

enemies.push({ mesh, speed: waveConfig.enemySpeed, time: ..., hp: ..., maxHp: ..., hpBarFill: fill, path, pathIndex: 0 })

// placeTower 内: グリッドを更新して全敵のパスを再計算
gridMap.setWalkable(gridX, gridZ, false)
for (const enemy of enemies) {
  const newPath = gridMap.findPath(
    Math.round(enemy.mesh.position.x),
    Math.round(enemy.mesh.position.z),
    BASE_POSITION.x, BASE_POSITION.z
  )
  if (newPath.length > 0) {
    enemy.path = newPath.map(p => ({ worldX: p.wx, worldZ: p.wz }))
    enemy.pathIndex = 0
  }
}

// registerBeforeRender 内: ウェイポイント追跡
for (let i = enemies.length - 1; i >= 0; i--) {
  const e = enemies[i]
  e.time += delta

  if (e.path.length > 0 && e.pathIndex < e.path.length) {
    const target = e.path[e.pathIndex]
    const targetPos = new Vector3(target.worldX, e.mesh.position.y, target.worldZ)
    const toTarget = targetPos.subtract(e.mesh.position)
    const dist = new Vector3(toTarget.x, 0, toTarget.z).length()

    if (dist < 0.3) {
      e.pathIndex++
    } else {
      const dir = new Vector3(toTarget.x, 0, toTarget.z).normalize()
      e.mesh.position.addInPlace(dir.scale(e.speed * delta))
      e.mesh.rotation.y = Math.atan2(dir.x, dir.z)
    }

    const distToBase = Vector3.Distance(
      new Vector3(e.mesh.position.x, 0, e.mesh.position.z),
      new Vector3(BASE_POSITION.x, 0, BASE_POSITION.z)
    )
    if (distToBase < 1.0) { enemyReachesBase(i); continue }
  } else {
    // フォールバック: 直線移動
    const dir = new Vector3(BASE_POSITION.x - e.mesh.position.x, 0, BASE_POSITION.z - e.mesh.position.z)
    const dist = dir.length()
    if (dist < 1.0) { enemyReachesBase(i); continue }
    e.mesh.position.addInPlace(dir.normalize().scale(e.speed * delta))
  }

  e.mesh.position.y = 0.5 + Math.sin(e.time * 2.5) * 0.15
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

interface EnemyHealthBar {
  plane: Mesh
  fillRect: Rectangle
  currentHp: number
  maxHp: number
}

interface GameCanvasProps {
  gameState: 'menu' | 'playing' | 'pause' | 'gameover'
  onGameEvent: GameEventCallback
  controlRef: MutableRefObject<{
    start: () => void
    restart: () => void
  } | null>
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
  {
    enemyCount: 3,
    spawnInterval: 2.0,
    enemySpeed: 1.0,
    scorePerKill: 10,
    enemyHp: 2,
    goldPerKill: 20,
  },
  {
    enemyCount: 5,
    spawnInterval: 1.5,
    enemySpeed: 1.2,
    scorePerKill: 15,
    enemyHp: 3,
    goldPerKill: 25,
  },
  {
    enemyCount: 8,
    spawnInterval: 1.0,
    enemySpeed: 1.5,
    scorePerKill: 20,
    enemyHp: 4,
    goldPerKill: 30,
  },
  {
    enemyCount: 12,
    spawnInterval: 0.8,
    enemySpeed: 2.0,
    scorePerKill: 30,
    enemyHp: 6,
    goldPerKill: 40,
  },
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
    let soundManager: SoundManager | undefined

    let cancelled = false

    const init = async () => {
      // ── Engine & Scene ───────────────────────────────────
      engine = new Engine(canvasRef.current, true)
      const scene = new Scene(engine)
      scene.clearColor = new Color4(0.02, 0.02, 0.05, 1)

      registerShaders()

      // ── Sound ─────────────────────────────────────────────
      soundManager = new SoundManager()
      soundManager.preload(scene) // await なし バックグラウンドで読み込む

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
          {
            width: 1.5,
            height: 0.2,
          },
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

      hemisphericLight.intensity = 0.4
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

      // ── Meshes ───────────────────────────────────────────
      const ground = MeshBuilder.CreateGround(
        'ground',
        {
          width: 20,
          height: 20,
          subdivisions: 20,
        },
        scene,
      )

      // ── Materials ────────────────────────────────────────
      const scanlineMat = new ShaderMaterial(
        'scanlineMat',
        scene,
        {
          vertex: 'scanline',
          fragment: 'scanline',
        },
        {
          attributes: ['position', 'uv'],
          uniforms: ['worldViewProjection', 'time'],
        },
      )
      ground.material = scanlineMat
      ground.receiveShadows = true

      // ── Physics Bodies ─────────────────────────────────
      new PhysicsAggregate(
        ground,
        PhysicsShapeType.BOX,
        {
          mass: 0,
        },
        scene,
      )

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
        {
          vertex: 'shield',
          fragment: 'shield',
        },
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
      const base = MeshBuilder.CreateCylinder(
        'base',
        {
          height: 0.3,
          diameter: 2,
          tessellation: 16,
        },
        scene,
      )
      base.position = BASE_POSITION.clone()
      base.position.y = 0.15
      base.material = baseMat
      base.receiveShadows = true
      shadowGen.addShadowCaster(base)
      new PhysicsAggregate(base, PhysicsShapeType.CYLINDER, { mass: 0 }, scene)

      // ── Particle Texture ────────────────────────────────
      const particleTex = new DynamicTexture(
        'particleTex',
        {
          width: 64,
          height: 64,
        },
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
        ? new GPUParticleSystem(
            'stars',
            {
              capacity: 2000,
            },
            scene,
          )
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
          {
            diameter: 0.8,
            segments: 8,
          },
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

      let gridMap = new GridMap(20)

      function spawnEnemy(waveConfig: WaveConfig): void {
        const spawnPoint =
          SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)]

        const mesh = MeshBuilder.CreateSphere(
          `enemy_${Date.now()}`,
          {
            diameter: 0.8,
            segments: 8,
          },
          scene,
        )

        mesh.position = spawnPoint.clone()
        mesh.material = enemyMat
        mesh.receiveShadows = true
        shadowGen.addShadowCaster(mesh)

        const healthBar = createEnemyHealthBar(mesh, waveConfig.enemyHp)

        const path = gridMap
          .findPath(
            spawnPoint.x,
            spawnPoint.z,
            BASE_POSITION.x,
            BASE_POSITION.z,
          )
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

      // ── Tower Spawn Animation ──────────────────────────
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

        if (Math.abs(gridX) > 9 || Math.abs(gridZ) > 9) return
        if (Math.abs(gridX) < 1 && Math.abs(gridZ) < 1) return

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
              {
                width: 1,
                height: 0.3,
                depth: 1,
              },
              scene,
            )
            base.position = new Vector3(gridX, 0.15, gridZ)
            base.material = towerBaseMat
          }
        } else {
          base = MeshBuilder.CreateBox(
            `towerBase_${towers.length}`,
            {
              width: 1,
              height: 0.3,
              depth: 1,
            },
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
            {
              height: 1.5,
              diameter: 0.3,
              tessellation: 8,
            },
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

        // グリッドマップを更新して全敵のパスを再計算
        gridMap.setWalkable(gridX, gridZ, false)
        for (const enemy of enemies) {
          const newPath = gridMap
            .findPath(
              Math.round(enemy.mesh.position.x),
              Math.round(enemy.mesh.position.z),
              BASE_POSITION.x,
              BASE_POSITION.z,
            )
            .map((p) => ({ worldX: p.wx, worldZ: p.wz }))
          // if (newPath.length > 0) {
          //   enemy.path = newPath
          //   enemy.pathIndex = 0
          // }
          enemy.path = newPath
          enemy.pathIndex = 0
        }

        playSpawnAnimation(base)
      }

      // ── Bullet System
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
          {
            diameter: 0.2,
            segments: 4,
          },
          scene,
        )

        bullet.position = from.clone()
        bullet.material = bulletMat

        const agg = new PhysicsAggregate(
          bullet,
          PhysicsShapeType.SPHERE,
          {
            mass: 0.05,
          },
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

        onGameEvent({ type: 'SCORE_CHANGED', score })
        onGameEvent({ type: 'LIFE_CHANGED', lives })
        onGameEvent({
          type: 'GOLD_CHANGED',
          gold,
        })

        startWave(0)
      }

      function restartGame(): void {
        for (const t of towers) t.dispose()
        towers.length = 0
        towerFireTimers.length = 0
        towerConfigs.length = 0
        towerShields.length = 0
        // グリッドマップをリセット
        gridMap = new GridMap(20)
        startGame()
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
        if (
          waveEnemiesSpawned >= currentWave.enemyCount &&
          enemies.length === 0
        ) {
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
              e.mesh.position.addInPlace(dir.scale(e.speed * delta))
              e.mesh.rotation.y = Math.atan2(dir.x, dir.z)
            }

            const distToBase = Vector3.Distance(
              new Vector3(e.mesh.position.x, 0, e.mesh.position.z),
              new Vector3(BASE_POSITION.x, 0, BASE_POSITION.z),
            )
            if (distToBase < 1.0) {
              enemyReachsBase(i)
              continue
            }
          } else {
            // パスなし → 直線フォールバック
            // const dir = new Vector3(
            //   BASE_POSITION.x - e.mesh.position.x,
            //   0,
            //   BASE_POSITION.z - e.mesh.position.z,
            // )
            // const dist = dir.length()
            // if (dist < 1.0) {
            //   enemyReachsBase(i)
            //   continue
            // }
            // e.mesh.position.addInPlace(dir.normalize().scale(e.speed * delta))
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

- タワーを設置すると敵がルートを変更して迂回する
- 全方向をタワーで塞ぐと敵がその場で止まる（パスなし）
- 敵が進行方向を向いて移動する（`rotation.y` の更新）
