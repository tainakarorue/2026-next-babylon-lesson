# L16 — AI と経路探索

## 概要

A* アルゴリズムを TypeScript で実装し、敵が障害物（タワー）を迂回してインテリジェントに移動するようにする。

**ゲームへの貢献**: 敵がタワーを設置するたびにルートを再計算し、新しい迂回路を探す。

---

## 概念解説

### A* アルゴリズムとは

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

| 方式 | 特徴 |
|---|---|
| ウェイポイント | 事前に決めた経路点を順に移動。動的な障害物に対応できない |
| A* グリッド | 毎回最短経路を計算。タワー設置で再計算できる |
| NavMesh | 3D の複雑な地形に対応。`@babylonjs/addons` の RecastJS |

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
          x, z, walkable: true,
          g: 0, h: 0, f: 0, parent: null,
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
      { dx: 1, dz: 0 }, { dx: -1, dz: 0 },
      { dx: 0, dz: 1 }, { dx: 0, dz: -1 },
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
    startWorldX: number, startWorldZ: number,
    endWorldX: number, endWorldZ: number
  ): Array<{ worldX: number; worldZ: number }> {
    const startGrid = this.worldToGrid(startWorldX, startWorldZ)
    const endGrid = this.worldToGrid(endWorldX, endWorldZ)

    // グリッドをリセット
    for (let z = 0; z < this.size; z++) {
      for (let x = 0; x < this.size; x++) {
        const node = this.grid[z][x]
        node.g = 0; node.h = 0; node.f = 0; node.parent = null
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
        neighbor.h = Math.abs(neighbor.x - endNode.x) + Math.abs(neighbor.z - endNode.z)
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
      currentPos.x, currentPos.z,
      BASE_POSITION.x, BASE_POSITION.z
    )
    if (newPath.length > 0) {
      enemy.path = newPath
      enemy.pathIndex = 0
    }
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
    if (dir.length() < 1.0) { enemyReachesBase(i); continue }
    e.mesh.position.addInPlace(dir.normalize().scale(e.speed * delta))
  } else {
    // ウェイポイントに向かって移動
    const target = e.path[e.pathIndex]
    const targetPos = new Vector3(target.worldX, e.mesh.position.y, target.worldZ)
    const dir = targetPos.subtract(e.mesh.position)
    const dist = dir.length()

    if (dist < 0.3) {
      e.pathIndex++
    } else {
      e.mesh.position.addInPlace(dir.normalize().scale(e.speed * delta))
    }

    if (e.pathIndex >= e.path.length) {
      const distToBase = Vector3.Distance(e.mesh.position, BASE_POSITION)
      if (distToBase < 1.0) { enemyReachesBase(i); continue }
    }
  }

  e.mesh.position.y = 0.5 + Math.sin(e.time * 2.5) * 0.15
  const dir2D = new Vector3(
    e.pathIndex < e.path.length ? e.path[e.pathIndex].worldX - e.mesh.position.x : 0,
    0,
    e.pathIndex < e.path.length ? e.path[e.pathIndex].worldZ - e.mesh.position.z : 0,
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
        this.grid[z][x] = { x, z, walkable: true, g: 0, h: 0, f: 0, parent: null }
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

  findPath(swx: number, swz: number, ewx: number, ewz: number): Array<{ wx: number; wz: number }> {
    const sg = this.worldToGrid(swx, swz)
    const eg = this.worldToGrid(ewx, ewz)

    for (let z = 0; z < this.size; z++) {
      for (let x = 0; x < this.size; x++) {
        const n = this.grid[z][x]
        n.g = 0; n.h = 0; n.f = 0; n.parent = null
      }
    }

    const startNode = this.grid[sg.z]?.[sg.x]
    const endNode = this.grid[eg.z]?.[eg.x]
    if (!startNode || !endNode || !endNode.walkable) return []

    const openSet: GridNode[] = [startNode]
    const closedSet = new Set<GridNode>()
    const DIRS = [{ dx: 1, dz: 0 }, { dx: -1, dz: 0 }, { dx: 0, dz: 1 }, { dx: 0, dz: -1 }]

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

## 確認方法

- タワーを設置すると敵がルートを変更して迂回する
- 全方向をタワーで塞ぐと敵がその場で止まる（パスなし）
- 敵が進行方向を向いて移動する（`rotation.y` の更新）
