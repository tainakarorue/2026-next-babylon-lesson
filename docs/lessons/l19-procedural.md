# L19 — プロシージャル生成

## 概要

ランダムシード値に基づいてマップを手続き的に生成する。毎プレイでマップが変わりリプレイ性が高まる。

**ゲームへの貢献**: 毎回ランダムに障害物が配置される「ランダムマップモード」が追加される。

---

## 概念解説

### 決定論的乱数（PRNG）

```typescript
// Math.random() はシードを指定できない
// → 同じシードで同じマップを再現できない

// Mulberry32 PRNG（シード付き乱数）
function mulberry32(seed: number) {
  return function(): number {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

const rng = mulberry32(12345) // シード 12345
const r1 = rng() // 常に同じ値
const r2 = rng() // 常に同じ値
```

### セルオートマトン（洞窟/迷路生成）

```
初期状態（ランダムに 40% を壁にする）:
  W . . W W . . . W
  . W . . W W . . .
  W . . . . W W . .

ルール（B3/S12: 周囲 3 つが壁なら生まれる、1 か 2 で生き残る）:
  → 数回繰り返すと有機的な洞窟形状になる
```

### Perlin Noise（自然な地形生成）

```typescript
// simplex-noise ライブラリを使う
// npm install simplex-noise

import { createNoise2D } from 'simplex-noise'

const noise2D = createNoise2D(() => 0.5) // 固定シードの場合

const height = noise2D(x * 0.1, z * 0.1) // -1.0〜1.0
// 0 以上 → 通路、0 未満 → 壁
```

### 障害物の配置

```typescript
function generateObstacles(
  mapSize: number,
  density: number,   // 0.0〜1.0
  seed: number
): Array<{ x: number; z: number }> {
  const rng = mulberry32(seed)
  const half = Math.floor(mapSize / 2)
  const obstacles: Array<{ x: number; z: number }> = []

  for (let z = -half + 2; z < half - 2; z++) {
    for (let x = -half + 2; x < half - 2; x++) {
      // 中央（拠点周辺）は除外
      if (Math.abs(x) < 2 && Math.abs(z) < 2) continue
      if (rng() < density) {
        obstacles.push({ x, z })
      }
    }
  }

  return obstacles
}
```

---

## 実装手順

### Step 1: PRNG クラスを作る

```typescript
// lib/babylon/prng.ts
export class PRNG {
  private seed: number

  constructor(seed: number) {
    this.seed = seed | 0
  }

  next(): number {
    this.seed = (this.seed + 0x6D2B79F5) | 0
    let t = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min
  }

  pick<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)]
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }
}
```

### Step 2: マップジェネレーターを作る

```typescript
// lib/babylon/map-generator.ts
import { PRNG } from './prng'

export interface GeneratedMap {
  seed: number
  obstacles: Array<{ x: number; z: number; type: 'rock' | 'wall' }>
  spawnPoints: Array<{ x: number; z: number }>
  safeZone: Array<{ x: number; z: number }> // 障害物を置いてはいけないエリア
}

export function generateMap(seed: number, mapSize: number, density: number): GeneratedMap {
  const rng = new PRNG(seed)
  const half = Math.floor(mapSize / 2)
  const obstacles: GeneratedMap['obstacles'] = []

  // スポーン地点（4 隅付近のランダム位置）
  const spawnPoints = [
    { x: rng.nextInt(half - 3, half - 1), z: rng.nextInt(half - 3, half - 1) },
    { x: rng.nextInt(-half + 1, -half + 3), z: rng.nextInt(half - 3, half - 1) },
    { x: rng.nextInt(half - 3, half - 1), z: rng.nextInt(-half + 1, -half + 3) },
    { x: rng.nextInt(-half + 1, -half + 3), z: rng.nextInt(-half + 1, -half + 3) },
  ]

  // 安全ゾーン（中心 + スポーン周辺）
  const safeZone: Array<{ x: number; z: number }> = []
  for (let z = -2; z <= 2; z++) {
    for (let x = -2; x <= 2; x++) {
      safeZone.push({ x, z })
    }
  }
  for (const sp of spawnPoints) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        safeZone.push({ x: sp.x + dx, z: sp.z + dz })
      }
    }
  }

  // 障害物配置
  for (let z = -half + 1; z < half - 1; z++) {
    for (let x = -half + 1; x < half - 1; x++) {
      const isSafe = safeZone.some(s => s.x === x && s.z === z)
      if (isSafe) continue
      if (rng.next() < density) {
        obstacles.push({
          x, z,
          type: rng.next() < 0.7 ? 'rock' : 'wall',
        })
      }
    }
  }

  return { seed, obstacles, spawnPoints, safeZone }
}
```

### Step 3: ランダムマップモードを追加する

```typescript
// app/game/page.tsx に追加するボタン
<button
  onClick={() => {
    const seed = Math.floor(Math.random() * 99999)
    setSeed(seed)
    handleLevelSelect('random')
  }}
>
  RANDOM MAP (Seed: {seed})
</button>
```

---

## 全体コード

### `lib/babylon/prng.ts`

```typescript
export class PRNG {
  private seed: number

  constructor(seed: number) {
    this.seed = seed | 0
  }

  next(): number {
    this.seed = (this.seed + 0x6D2B79F5) | 0
    let t = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min
  }

  pick<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)]
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }
}
```

---

### `lib/babylon/map-generator.ts`

```typescript
import { PRNG } from './prng'

export interface ObstacleData {
  x: number
  z: number
  type: 'rock' | 'wall'
  height: number
}

export interface GeneratedMap {
  seed: number
  mapSize: number
  obstacles: ObstacleData[]
  spawnPoints: Array<{ x: number; z: number }>
}

export function generateMap(seed: number, mapSize = 20, density = 0.12): GeneratedMap {
  const rng = new PRNG(seed)
  const half = Math.floor(mapSize / 2)
  const obstacles: ObstacleData[] = []

  // スポーン地点（4 隅のランダム位置）
  const spawnPoints = [
    { x: rng.nextInt(half - 3, half - 1), z: rng.nextInt(half - 3, half - 1) },
    { x: rng.nextInt(-half + 1, -(half - 3)), z: rng.nextInt(half - 3, half - 1) },
    { x: rng.nextInt(half - 3, half - 1), z: rng.nextInt(-half + 1, -(half - 3)) },
    { x: rng.nextInt(-half + 1, -(half - 3)), z: rng.nextInt(-half + 1, -(half - 3)) },
  ]

  // 保護ゾーン（中心 + スポーン周辺）
  const protected = new Set<string>()
  const addProtected = (x: number, z: number, radius: number) => {
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        protected.add(`${x + dx},${z + dz}`)
      }
    }
  }
  addProtected(0, 0, 3) // 拠点周辺
  for (const sp of spawnPoints) addProtected(sp.x, sp.z, 2)

  // 障害物配置（セルオートマトン風：クラスター状に配置）
  for (let z = -half + 1; z < half - 1; z++) {
    for (let x = -half + 1; x < half - 1; x++) {
      if (protected.has(`${x},${z}`)) continue
      if (rng.next() < density) {
        const type: 'rock' | 'wall' = rng.next() < 0.6 ? 'rock' : 'wall'
        const height = type === 'rock'
          ? rng.nextFloat(0.5, 1.5)
          : rng.nextFloat(1.0, 2.0)
        obstacles.push({ x, z, type, height })
      }
    }
  }

  return { seed, mapSize, obstacles, spawnPoints }
}

export function seedFromString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}
```

---

### `components/game/GameCanvas.tsx`（プロシージャル障害物生成の追加）

```tsx
// import 追加
import { generateMap } from '@/lib/babylon/map-generator'
import type { LevelConfig } from '@/lib/babylon/level-types'

// buildLevel 関数内: 障害物の生成
function buildProceduralMap(config: LevelConfig, seed: number): void {
  const generatedMap = generateMap(seed, config.mapSize, 0.12)

  const rockMat = new PBRMaterial('rockMat', scene)
  rockMat.albedoColor = new Color3(0.3, 0.28, 0.25)
  rockMat.metallic = 0.1
  rockMat.roughness = 0.9

  const wallMat = new PBRMaterial('wallMat', scene)
  wallMat.albedoColor = new Color3(0.25, 0.3, 0.35)
  wallMat.metallic = 0.7
  wallMat.roughness = 0.3

  const obstacleMeshes: Mesh[] = []

  for (const obs of generatedMap.obstacles) {
    let mesh: Mesh
    if (obs.type === 'rock') {
      mesh = MeshBuilder.CreateSphere(
        `rock_${obs.x}_${obs.z}`,
        { diameter: obs.height * 0.8 + 0.3, segments: 5 },
        scene
      )
      mesh.scaling.y = 0.7
      mesh.material = rockMat
    } else {
      mesh = MeshBuilder.CreateBox(
        `wall_${obs.x}_${obs.z}`,
        { width: 0.9, height: obs.height, depth: 0.9 },
        scene
      )
      mesh.material = wallMat
    }
    mesh.position = new Vector3(obs.x, obs.height / 2, obs.z)
    mesh.freezeWorldMatrix()
    mesh.isPickable = false
    mesh.receiveShadows = true
    shadowGen.addShadowCaster(mesh)
    new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 0 }, scene)
    obstacleMeshes.push(mesh)
    gridMap.setWalkable(obs.x, obs.z, false)
  }

  // 障害物をマージして描画コールを削減
  if (obstacleMeshes.length > 0) {
    Mesh.MergeMeshes(obstacleMeshes, true, true, undefined, false, true)
  }
}
```

---

### `components/game/RandomMapButton.tsx`

```tsx
'use client'

import { useState } from 'react'

interface RandomMapButtonProps {
  onGenerate: (seed: number) => void
}

export function RandomMapButton({ onGenerate }: RandomMapButtonProps) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 99999))

  const handleGenerate = () => {
    onGenerate(seed)
  }

  const handleNewSeed = () => {
    const newSeed = Math.floor(Math.random() * 99999)
    setSeed(newSeed)
    onGenerate(newSeed)
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-2 items-center">
        <span className="text-gray-400 text-sm">SEED:</span>
        <input
          type="number"
          value={seed}
          onChange={(e) => setSeed(Number(e.target.value))}
          className="bg-black/50 border border-gray-600 text-white px-2 py-1 rounded text-sm w-24"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleGenerate}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded text-white text-sm font-bold transition-colors"
        >
          このシードで生成
        </button>
        <button
          onClick={handleNewSeed}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-white text-sm font-bold transition-colors"
        >
          ランダム
        </button>
      </div>
    </div>
  )
}
```

---

## 確認方法

- 「ランダム」ボタンを押すたびに異なるマップが生成される
- シード値を入力して「このシードで生成」を押すと同じマップが再現される
- 障害物が中心（拠点）とスポーン地点の周辺には配置されない
- 障害物は物理コリジョンがあり敵が通れない（A* で迂回する）
