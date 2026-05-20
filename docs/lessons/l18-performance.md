# L18 — パフォーマンス最適化

## 概要

Instancing・オブジェクトプール・Freeze Matrix・カリング設定で 60fps を維持する技術を学ぶ。

**ゲームへの貢献**: 100 体の敵が同時に出現しても 60fps を維持できるようになる。

---

## 概念解説

### パフォーマンスのボトルネック

```
1. Draw Call（描画コール）が多い
   → Instancing で削減

2. JavaScript で毎フレーム座標計算している静的オブジェクト
   → freezeWorldMatrix() で削減

3. 画面外のオブジェクトまで描画している
   → Frustum Culling（自動）、isVisible の手動制御

4. 毎フレーム new Object() している
   → Object Pool で削減

5. GC（ガベージコレクション）が頻繁に発生
   → Vector3 の再利用
```

### Instancing（最重要）

```typescript
// 1 つのベースメッシュから大量のコピーを低コストで作る
const baseMesh = MeshBuilder.CreateSphere('enemyBase', { diameter: 0.8, segments: 8 }, scene)
baseMesh.setEnabled(false) // テンプレートは非表示

// インスタンス作成（描画コストはベースメッシュ 1 回分のみ）
const instance = baseMesh.createInstance('enemy_0')
instance.position = new Vector3(5, 0.5, 5)

// 100 体でも描画コールは 1 回
const instances: InstancedMesh[] = []
for (let i = 0; i < 100; i++) {
  const inst = baseMesh.createInstance(`enemy_${i}`)
  inst.position = new Vector3(Math.random() * 20 - 10, 0.5, Math.random() * 20 - 10)
  instances.push(inst)
}
```

### freezeWorldMatrix（静的オブジェクト用）

```typescript
// 動かない床・障害物は毎フレームの行列計算をスキップ
ground.freezeWorldMatrix()

// 動かす必要が出たら解除
ground.unfreezeWorldMatrix()
```

### オブジェクトプール（弾丸用）

```typescript
class BulletPool {
  private pool: InstancedMesh[] = []
  private baseMesh: Mesh

  constructor(scene: Scene, poolSize = 50) {
    this.baseMesh = MeshBuilder.CreateSphere('bulletBase', { diameter: 0.2, segments: 4 }, scene)
    this.baseMesh.setEnabled(false)
    // プールを事前に作成
    for (let i = 0; i < poolSize; i++) {
      const instance = this.baseMesh.createInstance(`bullet_pool_${i}`)
      instance.setEnabled(false)
      this.pool.push(instance)
    }
  }

  acquire(position: Vector3): InstancedMesh | null {
    const bullet = this.pool.find(b => !b.isEnabled())
    if (!bullet) return null // プールが枯渇
    bullet.position = position.clone()
    bullet.setEnabled(true)
    return bullet
  }

  release(bullet: InstancedMesh): void {
    bullet.setEnabled(false)
  }
}
```

### Vector3 の再利用（GC 削減）

```typescript
// 悪い例: 毎フレーム new Vector3
scene.registerBeforeRender(() => {
  const dir = new Vector3(1, 0, 0) // 毎フレーム new → GC の原因
  mesh.position.addInPlace(dir)
})

// 良い例: 再利用可能な一時 Vector3
const _tmpDir = new Vector3()  // スコープ外で一度だけ作る
scene.registerBeforeRender(() => {
  _tmpDir.set(1, 0, 0)         // 再利用
  mesh.position.addInPlace(_tmpDir)
})
```

### Merge Meshes（静的オブジェクトのまとめ描画）

```typescript
import { Mesh } from '@babylonjs/core'

// 複数の静的メッシュを 1 つに結合
const obstacles: Mesh[] = [rock1, rock2, rock3, wall1, wall2]
const merged = Mesh.MergeMeshes(obstacles, true, true, undefined, false, true)
if (merged) {
  merged.name = 'obstaclesMerged'
  merged.freezeWorldMatrix()
}
```

### `isPickable = false` の効果

クリック判定が不要なオブジェクトは `isPickable = false` にする。  
毎フレームの Ray Cast 計算から除外されるため高速になる。

```typescript
particle.isPickable = false
bullet.isPickable = false
starField.isPickable = false
```

### FPS モニタリング

```typescript
// シーンの FPS を取得
const fps = engine.getFps()
console.log(`FPS: ${fps.toFixed(1)}`)

// HUD に FPS を表示（デバッグ時）
scene.registerBeforeRender(() => {
  if (process.env.NODE_ENV === 'development') {
    document.title = `FPS: ${engine.getFps().toFixed(0)}`
  }
})
```

---

## 実装手順

### Step 1: 敵に Instancing を適用する

```typescript
// テンプレートメッシュ（非表示）
const enemyTemplate = MeshBuilder.CreateSphere(
  'enemyTemplate', { diameter: 0.8, segments: 8 }, scene
)
enemyTemplate.material = enemyMat
enemyTemplate.setEnabled(false)
enemyTemplate.isPickable = false

// スポーン時にインスタンスを作成
function spawnEnemy(waveConfig: WaveConfig, sp: Vector3): void {
  const instance = enemyTemplate.createInstance(`enemy_${Date.now()}`)
  instance.position = sp.clone()
  instance.isPickable = false
  // ...
}

// 撃破時
function killEnemy(index: number): void {
  enemies[index].mesh.dispose() // インスタンスは dispose で解放
  enemies.splice(index, 1)
}
```

### Step 2: 弾丸にオブジェクトプールを使う

```typescript
class BulletPool {
  private pool: InstancedMesh[] = []
  private active = new Set<InstancedMesh>()
  private baseMesh: Mesh

  constructor(scene: Scene, size = 50) {
    const bulletMat = new PBRMaterial('bulletPoolMat', scene)
    bulletMat.albedoColor = new Color3(1, 0.8, 0)
    bulletMat.emissiveColor = new Color3(1, 0.6, 0)
    bulletMat.emissiveIntensity = 3.0
    bulletMat.metallic = 0
    bulletMat.roughness = 0

    this.baseMesh = MeshBuilder.CreateSphere('bulletBase', { diameter: 0.2, segments: 4 }, scene)
    this.baseMesh.material = bulletMat
    this.baseMesh.isPickable = false
    this.baseMesh.setEnabled(false)

    for (let i = 0; i < size; i++) {
      const inst = this.baseMesh.createInstance(`bullet_${i}`)
      inst.isPickable = false
      inst.setEnabled(false)
      this.pool.push(inst)
    }
  }

  acquire(position: Vector3): InstancedMesh | null {
    const available = this.pool.find(b => !this.active.has(b))
    if (!available) return null
    available.position.copyFrom(position)
    available.setEnabled(true)
    this.active.add(available)
    return available
  }

  release(bullet: InstancedMesh): void {
    bullet.setEnabled(false)
    this.active.delete(bullet)
  }

  dispose(): void {
    this.baseMesh.dispose()
  }
}
```

### Step 3: 静的オブジェクトを最適化する

```typescript
// 床は動かないので freezeWorldMatrix
ground.freezeWorldMatrix()
ground.isPickable = true  // クリック判定は必要

// 障害物も静的
obstacles.forEach(mesh => {
  mesh.freezeWorldMatrix()
  mesh.isPickable = false
})

// 星フィールドもクリック不要
stars.isPickable = false
```

### Step 4: FPS に応じて品質を動的に調整する

```typescript
let lowPerfMode = false

scene.registerBeforeRender(() => {
  const fps = engine.getFps()
  if (!lowPerfMode && fps < 30) {
    lowPerfMode = true
    pipeline.bloomEnabled = false
    pipeline.chromaticAberrationEnabled = false
    console.log('Low performance mode enabled')
  } else if (lowPerfMode && fps > 55) {
    lowPerfMode = false
    pipeline.bloomEnabled = true
    pipeline.chromaticAberrationEnabled = true
  }
})
```

---

## ポイント解説

### Instancing と Cloning の違い
- `mesh.clone()`: 独立したコピー（マテリアルを個別に変えられる）。Draw Call が増える
- `mesh.createInstance()`: GPU Instancing（Draw Call は 1 回）。マテリアルは共有

ゲームの敵や弾丸のような「同じ見た目が大量に出る」ものは `createInstance()` 一択。

### オブジェクトプールのサイズ設定
画面に同時に出るオブジェクトの最大数の 1.5〜2 倍を設定する。  
弾丸が最大 30 発ならプールサイズは 50 が目安。

---

## 全体コード

### `lib/babylon/bullet-pool.ts`

```typescript
import { Scene, MeshBuilder, InstancedMesh, Mesh, PBRMaterial, Color3, Vector3 } from '@babylonjs/core'

export class BulletPool {
  private pool: InstancedMesh[] = []
  private active = new Set<InstancedMesh>()
  readonly baseMesh: Mesh

  constructor(scene: Scene, size = 60) {
    const mat = new PBRMaterial('bulletPoolMat', scene)
    mat.albedoColor = new Color3(1, 0.8, 0)
    mat.emissiveColor = new Color3(1, 0.6, 0)
    mat.emissiveIntensity = 3.0
    mat.metallic = 0
    mat.roughness = 0

    this.baseMesh = MeshBuilder.CreateSphere('bulletBase', { diameter: 0.2, segments: 4 }, scene)
    this.baseMesh.material = mat
    this.baseMesh.isPickable = false
    this.baseMesh.setEnabled(false)
    this.baseMesh.freezeWorldMatrix()

    for (let i = 0; i < size; i++) {
      const inst = this.baseMesh.createInstance(`bullet_${i}`)
      inst.isPickable = false
      inst.setEnabled(false)
      this.pool.push(inst)
    }
  }

  acquire(position: Vector3): InstancedMesh | null {
    for (const b of this.pool) {
      if (!this.active.has(b)) {
        b.position.copyFrom(position)
        b.setEnabled(true)
        this.active.add(b)
        return b
      }
    }
    return null // プール枯渇
  }

  release(bullet: InstancedMesh): void {
    bullet.setEnabled(false)
    this.active.delete(bullet)
  }

  activeCount(): number {
    return this.active.size
  }

  dispose(): void {
    this.baseMesh.dispose()
    this.pool.length = 0
    this.active.clear()
  }
}
```

---

### `lib/babylon/enemy-pool.ts`

```typescript
import { Scene, MeshBuilder, InstancedMesh, Mesh, StandardMaterial, Color3 } from '@babylonjs/core'

export class EnemyPool {
  private pool: InstancedMesh[] = []
  private active = new Set<InstancedMesh>()
  readonly baseMesh: Mesh

  constructor(scene: Scene, size = 30) {
    const mat = new StandardMaterial('enemyPoolMat', scene)
    mat.diffuseColor = new Color3(0.8, 0.1, 0.1)
    mat.emissiveColor = new Color3(0.4, 0, 0)

    this.baseMesh = MeshBuilder.CreateSphere('enemyBase', { diameter: 0.8, segments: 8 }, scene)
    this.baseMesh.material = mat
    this.baseMesh.isPickable = false
    this.baseMesh.setEnabled(false)

    for (let i = 0; i < size; i++) {
      const inst = this.baseMesh.createInstance(`enemyInst_${i}`)
      inst.isPickable = false
      inst.setEnabled(false)
      this.pool.push(inst)
    }
  }

  acquire(): InstancedMesh | null {
    for (const e of this.pool) {
      if (!this.active.has(e)) {
        e.setEnabled(true)
        this.active.add(e)
        return e
      }
    }
    return null
  }

  release(enemy: InstancedMesh): void {
    enemy.setEnabled(false)
    this.active.delete(enemy)
  }

  dispose(): void {
    this.baseMesh.dispose()
    this.pool.length = 0
    this.active.clear()
  }
}
```

---

### `components/game/GameCanvas.tsx`（パフォーマンス最適化の主要変更点）

```tsx
// import 追加
import { BulletPool } from '@/lib/babylon/bullet-pool'
import { EnemyPool } from '@/lib/babylon/enemy-pool'

// init() 内
const bulletPool = new BulletPool(scene, 60)
const enemyPool = new EnemyPool(scene, 30)

// 静的オブジェクトの最適化
ground.freezeWorldMatrix()
base.freezeWorldMatrix()

// FPS モニタリングと自動品質調整
let lowPerfMode = false
scene.registerBeforeRender(() => {
  const fps = engine.getFps()
  if (!lowPerfMode && fps < 35) {
    lowPerfMode = true
    pipeline.bloomEnabled = false
    pipeline.chromaticAberrationEnabled = false
    pipeline.grainEnabled = false
  } else if (lowPerfMode && fps > 55) {
    lowPerfMode = false
    pipeline.bloomEnabled = true
    pipeline.chromaticAberrationEnabled = true
    pipeline.grainEnabled = true
  }
})

// spawnEnemy: enemyPool.acquire() を使う
function spawnEnemy(waveConfig: WaveConfig): void {
  const mesh = enemyPool.acquire()
  if (!mesh) return
  const sp = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)]
  mesh.position.copyFrom(sp)
  // ...
}

// killEnemy: enemyPool.release() を使う
function killEnemy(index: number): void {
  createExplosion(enemies[index].mesh.position.clone())
  enemyPool.release(enemies[index].mesh as InstancedMesh)
  enemies.splice(index, 1)
}

// fireBullet: bulletPool.acquire() を使う
function fireBullet(from: Vector3, direction: Vector3): void {
  const bullet = bulletPool.acquire(from)
  if (!bullet) return
  activeBullets.push({ mesh: bullet, velocity: direction.scale(15), timer: 0 })
}

// cleanup
return () => {
  bulletPool.dispose()
  enemyPool.dispose()
  engine?.dispose()
}
```

---

## 確認方法

- 開発者ツールのタイトルバーに FPS が表示される
- 30 体の敵が同時に出現しても 60fps を維持する
- 弾丸が大量に出ても FPS が下がらない（プール再利用）
- FPS が 35 以下になると Bloom が自動的に無効化される
