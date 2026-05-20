# L22 — テストと品質管理

## 概要

ゲームロジックのユニットテストを Vitest で書き、TypeScript の型を厳格にする。

**ゲームへの貢献**: バグをコミット前に自動検出できる。

---

## インストール

```bash
npm install -D vitest @vitest/ui jsdom @testing-library/react
```

---

## 概念解説

### 何をテストするか

```
テストすべき（ビジネスロジック）:
  ✅ A* 経路探索アルゴリズム
  ✅ スコア計算・ゴールド計算
  ✅ ウェーブ管理のタイミング
  ✅ PRNG（乱数生成）の再現性
  ✅ セーブデータのシリアライズ

テスト困難（WebGL/ブラウザ依存）:
  ❌ 3D レンダリング結果
  ❌ Babylon.js のメッシュ生成
  ❌ ポストプロセッシングエフェクト
```

### Vitest の設定

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',  // DOM 不要なロジックは node で高速化
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

---

## 実装手順

### Step 1: 経路探索のテスト

```typescript
// lib/babylon/__tests__/pathfinding.test.ts
import { describe, it, expect } from 'vitest'
import { GridMap } from '../pathfinding'

describe('GridMap', () => {
  it('直線経路を正しく見つける', () => {
    const map = new GridMap(10)
    const path = map.findPath(0, 0, 3, 0)
    expect(path.length).toBeGreaterThan(0)
    const last = path[path.length - 1]
    expect(Math.round(last.wx)).toBe(3)
    expect(Math.round(last.wz)).toBe(0)
  })

  it('壁を迂回する', () => {
    const map = new GridMap(10)
    // (1, 0) に壁を設置
    map.setWalkable(1, 0, false)
    const path = map.findPath(0, 0, 2, 0)
    expect(path.length).toBeGreaterThan(0)
    // 経路が壁を通っていないことを確認
    const passesWall = path.some(p => Math.round(p.wx) === 1 && Math.round(p.wz) === 0)
    expect(passesWall).toBe(false)
  })

  it('囲まれた場合は空配列を返す', () => {
    const map = new GridMap(6)
    // スタート地点を囲む
    map.setWalkable(1, 0, false)
    map.setWalkable(-1, 0, false)
    map.setWalkable(0, 1, false)
    map.setWalkable(0, -1, false)
    const path = map.findPath(0, 0, 3, 0)
    expect(path).toHaveLength(0)
  })
})
```

### Step 2: PRNG のテスト

```typescript
// lib/babylon/__tests__/prng.test.ts
import { describe, it, expect } from 'vitest'
import { PRNG } from '../prng'

describe('PRNG', () => {
  it('同じシードは同じシーケンスを生成する', () => {
    const rng1 = new PRNG(42)
    const rng2 = new PRNG(42)
    const seq1 = Array.from({ length: 10 }, () => rng1.next())
    const seq2 = Array.from({ length: 10 }, () => rng2.next())
    expect(seq1).toEqual(seq2)
  })

  it('値は 0 以上 1 未満の範囲に収まる', () => {
    const rng = new PRNG(12345)
    for (let i = 0; i < 100; i++) {
      const v = rng.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('nextInt は指定範囲内の整数を返す', () => {
    const rng = new PRNG(99)
    for (let i = 0; i < 50; i++) {
      const v = rng.nextInt(1, 6)
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(6)
      expect(Number.isInteger(v)).toBe(true)
    }
  })
})
```

### Step 3: マップ生成のテスト

```typescript
// lib/babylon/__tests__/map-generator.test.ts
import { describe, it, expect } from 'vitest'
import { generateMap } from '../map-generator'

describe('generateMap', () => {
  it('同じシードで同じマップが生成される', () => {
    const map1 = generateMap(100, 20, 0.1)
    const map2 = generateMap(100, 20, 0.1)
    expect(map1.obstacles).toEqual(map2.obstacles)
    expect(map1.spawnPoints).toEqual(map2.spawnPoints)
  })

  it('障害物は中心付近に配置されない', () => {
    const map = generateMap(42, 20, 0.3)
    const nearCenter = map.obstacles.filter(
      o => Math.abs(o.x) <= 3 && Math.abs(o.z) <= 3
    )
    expect(nearCenter).toHaveLength(0)
  })

  it('スポーン地点は 4 つある', () => {
    const map = generateMap(1, 20, 0.1)
    expect(map.spawnPoints).toHaveLength(4)
  })
})
```

---

## 全体コード

### `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['lib/**/*.ts'],
      exclude: ['lib/**/__tests__/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

---

### `package.json` への追加

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

### `lib/babylon/__tests__/pathfinding.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { GridMap } from '../pathfinding'

describe('GridMap', () => {
  let map: GridMap

  beforeEach(() => {
    map = new GridMap(20)
  })

  it('インスタンスが作成できる', () => {
    expect(map).toBeDefined()
    expect(map.size).toBe(20)
    expect(map.offset).toBe(10)
  })

  it('世界座標をグリッド座標に変換できる', () => {
    const { x, z } = map.worldToGrid(0, 0)
    expect(x).toBe(10)
    expect(z).toBe(10)
  })

  it('グリッド座標を世界座標に変換できる', () => {
    const { wx, wz } = map.gridToWorld(10, 10)
    expect(wx).toBe(0)
    expect(wz).toBe(0)
  })

  it('直線経路を正しく見つける', () => {
    const path = map.findPath(0, 0, 5, 0)
    expect(path.length).toBeGreaterThan(0)
    const last = path[path.length - 1]
    expect(Math.round(last.wx)).toBe(5)
    expect(Math.round(last.wz)).toBe(0)
  })

  it('壁を迂回する', () => {
    map.setWalkable(1, 0, false)
    map.setWalkable(1, 1, false)
    map.setWalkable(1, -1, false)
    const path = map.findPath(0, 0, 3, 0)
    expect(path.length).toBeGreaterThan(0)
    const passesThrough1_0 = path.some(p => Math.round(p.wx) === 1 && Math.round(p.wz) === 0)
    expect(passesThrough1_0).toBe(false)
  })

  it('囲まれた場合は空配列を返す', () => {
    map.setWalkable(1, 0, false)
    map.setWalkable(-1, 0, false)
    map.setWalkable(0, 1, false)
    map.setWalkable(0, -1, false)
    const path = map.findPath(0, 0, 5, 5)
    expect(path).toHaveLength(0)
  })

  it('同じ地点への経路は長さ 1 以上', () => {
    const path = map.findPath(3, 3, 3, 3)
    expect(path.length).toBeGreaterThanOrEqual(1)
  })
})
```

---

### `lib/babylon/__tests__/prng.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { PRNG } from '../prng'

describe('PRNG', () => {
  it('同じシードは同じシーケンスを生成する', () => {
    const seq1 = Array.from({ length: 20 }, () => new PRNG(42).next())
    const seq2 = Array.from({ length: 20 }, () => new PRNG(42).next())
    expect(seq1).toEqual(seq2)
  })

  it('連続した値は 0 以上 1 未満の範囲に収まる', () => {
    const rng = new PRNG(12345)
    for (let i = 0; i < 1000; i++) {
      const v = rng.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('nextInt は指定範囲内の整数を返す', () => {
    const rng = new PRNG(999)
    for (let i = 0; i < 100; i++) {
      const v = rng.nextInt(1, 10)
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(10)
      expect(Number.isInteger(v)).toBe(true)
    }
  })

  it('nextFloat は指定範囲内の数を返す', () => {
    const rng = new PRNG(777)
    for (let i = 0; i < 100; i++) {
      const v = rng.nextFloat(5, 10)
      expect(v).toBeGreaterThanOrEqual(5)
      expect(v).toBeLessThanOrEqual(10)
    }
  })

  it('pick は配列の要素を返す', () => {
    const rng = new PRNG(1)
    const arr = ['a', 'b', 'c', 'd']
    for (let i = 0; i < 50; i++) {
      expect(arr).toContain(rng.pick(arr))
    }
  })

  it('shuffle は全要素を保持する', () => {
    const rng = new PRNG(2)
    const arr = [1, 2, 3, 4, 5]
    const shuffled = rng.shuffle(arr)
    expect(shuffled.sort()).toEqual(arr.sort())
  })
})
```

---

### `lib/babylon/__tests__/map-generator.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { generateMap } from '../map-generator'

describe('generateMap', () => {
  it('同じシードで同じマップが生成される', () => {
    const m1 = generateMap(100, 20, 0.1)
    const m2 = generateMap(100, 20, 0.1)
    expect(JSON.stringify(m1.obstacles)).toBe(JSON.stringify(m2.obstacles))
    expect(JSON.stringify(m1.spawnPoints)).toBe(JSON.stringify(m2.spawnPoints))
  })

  it('障害物は中心付近（radius 3 以内）に配置されない', () => {
    const map = generateMap(42, 20, 0.4)
    const nearCenter = map.obstacles.filter(o => Math.abs(o.x) <= 3 && Math.abs(o.z) <= 3)
    expect(nearCenter).toHaveLength(0)
  })

  it('スポーン地点は 4 つある', () => {
    const map = generateMap(1, 20, 0.1)
    expect(map.spawnPoints).toHaveLength(4)
  })

  it('障害物の type は rock か wall のいずれか', () => {
    const map = generateMap(55, 20, 0.2)
    for (const obs of map.obstacles) {
      expect(['rock', 'wall']).toContain(obs.type)
      expect(obs.height).toBeGreaterThan(0)
    }
  })

  it('density=0 のとき障害物は生成されない', () => {
    const map = generateMap(9, 20, 0)
    expect(map.obstacles).toHaveLength(0)
  })
})
```

---

## 確認方法

```bash
npm test
# または
npm run test:watch  # ファイル変更を監視して自動実行
# または  
npm run test:ui     # ブラウザで見やすいテスト画面を表示
```

全テストが PASS すればOK。
