# L09 — パーティクルシステム

## 概要

Babylon.js のパーティクルシステムで爆発・推進炎・星屑を実装する。  
敵を撃破すると爆発エフェクトが発生するようにする。

**ゲームへの貢献**: 敵撃破時の爆発・タワーの発射炎・宇宙空間の星屑が完成する。

---

## 概念解説

### ParticleSystem の基本構造

```typescript
import { ParticleSystem, Texture } from '@babylonjs/core'

const ps = new ParticleSystem('explosion', 100, scene) // 最大パーティクル数
ps.emitter = emitterMesh                               // 発生源のメッシュ
// または座標で指定:
// ps.emitter = new Vector3(0, 0, 0)

// テクスチャ（省略するとデフォルトの白い点）
ps.particleTexture = new Texture('/textures/flare.png', scene)

ps.start()  // 開始
ps.stop()   // 停止（既存パーティクルは残る）
ps.reset()  // 全リセット
```

### 主要プロパティ一覧

```typescript
// 発生範囲
ps.minEmitBox = new Vector3(-0.1, 0, -0.1)
ps.maxEmitBox = new Vector3(0.1, 0, 0.1)

// 生存時間（秒）
ps.minLifeTime = 0.3
ps.maxLifeTime = 1.0

// 速度
ps.minEmitPower = 1
ps.maxEmitPower = 3

// 方向
ps.direction1 = new Vector3(-1, 1, -1)
ps.direction2 = new Vector3(1, 2, 1)

// 重力
ps.gravity = new Vector3(0, -2, 0)

// 色（生成時 → 中間 → 消滅時）
ps.color1 = new Color4(1, 0.5, 0, 1)    // オレンジ
ps.color2 = new Color4(1, 0.2, 0, 1)    // 赤
ps.colorDead = new Color4(0, 0, 0, 0)   // 透明

// サイズ
ps.minSize = 0.1
ps.maxSize = 0.5
ps.minScaleX = 1
ps.maxScaleX = 1

// 回転
ps.minAngularSpeed = 0
ps.maxAngularSpeed = Math.PI * 2

// 発生率（1秒あたりのパーティクル数）
ps.emitRate = 100

// ブレンドモード
ps.blendMode = ParticleSystem.BLENDMODE_ONEONE  // 加算合成（炎・光に最適）
// または
ps.blendMode = ParticleSystem.BLENDMODE_STANDARD // 通常合成（煙に最適）
```

### 使い捨て爆発（burst）

```typescript
// 一瞬だけ大量放出して自動停止する爆発
ps.targetStopDuration = 0.5 // 0.5 秒後に自動停止
ps.disposeOnStop = true      // 停止後に自動破棄

ps.start()
```

### GPUParticleSystem（高性能版）

```typescript
import { GPUParticleSystem } from '@babylonjs/core'

// WebGL2 が必要
const ps = new GPUParticleSystem('stars', { capacity: 10000 }, scene)
// API は ParticleSystem とほぼ同じ
// 数万単位のパーティクルでも 60fps 維持できる
```

### パーティクルの形状

```typescript
// 球形に放出
ps.createSphereEmitter(1.0) // radius

// コーン形に放出
ps.createConeEmitter(0.5, Math.PI / 4) // radius, angle

// ボックス形に放出（デフォルト、minEmitBox/maxEmitBox で制御）
ps.createBoxEmitter(...)
```

---

## 実装手順

### Step 1: 爆発エフェクト関数を作る

```typescript
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

  ps.targetStopDuration = 0.15 // 0.15 秒間だけ大量放出
  ps.disposeOnStop = true       // 停止後に自動破棄

  ps.start()
}
```

### Step 2: 星屑の背景を作る（GPU パーティクル）

```typescript
function createStarField(): void {
  const stars = new GPUParticleSystem('stars', { capacity: 2000 }, scene)
  stars.emitter = new Vector3(0, 0, 0)

  stars.createSphereEmitter(30)
  stars.minLifeTime = 60
  stars.maxLifeTime = 60
  stars.minEmitPower = 0
  stars.maxEmitPower = 0
  stars.gravity = new Vector3(0, 0, 0)

  stars.color1 = new Color4(1, 1, 1, 0.8)
  stars.color2 = new Color4(0.8, 0.9, 1, 0.6)
  stars.colorDead = new Color4(1, 1, 1, 0)

  stars.minSize = 0.02
  stars.maxSize = 0.08
  stars.emitRate = 30
  stars.blendMode = ParticleSystem.BLENDMODE_ONEONE

  stars.start()
}
```

### Step 3: 敵撃破時に爆発を呼ぶ

```typescript
function killEnemy(enemy: Mesh, index: number): void {
  createExplosion(enemy.position.clone())
  enemy.dispose()
  enemies.splice(index, 1)
  enemyTimes.splice(index, 1)
}
```

---

## ポイント解説

### `BLENDMODE_ONEONE` vs `BLENDMODE_STANDARD`
- `ONEONE`（加算合成）: パーティクルが重なるほど明るくなる。炎・光・エネルギーに最適
- `STANDARD`（通常合成）: アルファブレンド。煙・埃・水に適する

### `disposeOnStop = true` が重要な理由
これを設定しないと停止したパーティクルシステムがメモリに残り続ける。  
爆発のような使い捨てエフェクトには必ず設定する。

### テクスチャのオプション
テクスチャなしでも動作するが、`public/textures/flare.png` のような  
ぼかしたドット画像（フレアテクスチャ）を使うと見栄えが大きく向上する。  
Babylon.js の Playground で使われているテクスチャが参考になる。

---

## 全体コード

### `components/game/GameCanvas.tsx`

```tsx
'use client'

import { useEffect, useRef } from 'react'
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
  SceneLoader,
  ParticleSystem,
  GPUParticleSystem,
} from '@babylonjs/core'
import { HavokPlugin } from '@babylonjs/core'
import HavokPhysics from '@babylonjs/havok'
import '@babylonjs/loaders/glTF'

export default function GameCanvas() {
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
      const hemisphericLight = new HemisphericLight('hemisphericLight', new Vector3(0, 1, 0), scene)
      hemisphericLight.intensity = 0.4
      hemisphericLight.diffuse = new Color3(0.6, 0.7, 1.0)
      hemisphericLight.groundColor = new Color3(0.1, 0.1, 0.2)

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

      // ── Stars Background ───────────────────────────────
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

      // ── Explosion Effect ───────────────────────────────
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
      const enemies: Mesh[] = []
      const enemyTimes: number[] = []

      function spawnEnemy(position: Vector3): void {
        const mesh = MeshBuilder.CreateSphere(`enemy_${enemies.length}`, { diameter: 0.8, segments: 8 }, scene)
        mesh.position = position.clone()
        mesh.material = enemyMat
        enemies.push(mesh)
        enemyTimes.push(Math.random() * Math.PI * 2)
      }

      function killEnemy(index: number): void {
        createExplosion(enemies[index].position.clone())
        enemies[index].dispose()
        enemies.splice(index, 1)
        enemyTimes.splice(index, 1)
      }

      spawnEnemy(new Vector3(5, 0.5, 5))
      spawnEnemy(new Vector3(-3, 0.5, 4))
      spawnEnemy(new Vector3(2, 0.5, -6))

      // ── Tower System ───────────────────────────────────
      const towers: Mesh[] = []

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
        const gridX = Math.round(position.x)
        const gridZ = Math.round(position.z)
        const occupied = towers.some(
          (t) => Math.round(t.position.x) === gridX && Math.round(t.position.z) === gridZ
        )
        if (occupied) return
        if (Math.abs(gridX) > 9 || Math.abs(gridZ) > 9) return

        const base = MeshBuilder.CreateBox(
          `towerBase_${towers.length}`, { width: 1, height: 0.3, depth: 1 }, scene
        )
        base.position = new Vector3(gridX, 0.15, gridZ)
        base.material = towerBaseMat
        new PhysicsAggregate(base, PhysicsShapeType.BOX, { mass: 0 }, scene)

        const barrel = MeshBuilder.CreateCylinder(
          `towerBarrel_${towers.length}`, { height: 1.5, diameter: 0.3, tessellation: 8 }, scene
        )
        barrel.parent = base
        barrel.position = new Vector3(0, 0.9, 0)
        barrel.material = barrelMat

        towers.push(base)
        playSpawnAnimation(base)
      }

      // ── Bullet System ──────────────────────────────────
      const activeBullets: { mesh: Mesh; agg: PhysicsAggregate; target: Mesh; timer: number }[] = []

      function fireBullet(from: Vector3, target: Mesh): void {
        const bullet = MeshBuilder.CreateSphere('bullet', { diameter: 0.2, segments: 4 }, scene)
        bullet.position = from.clone()
        bullet.material = bulletMat

        const agg = new PhysicsAggregate(bullet, PhysicsShapeType.SPHERE, { mass: 0.05 }, scene)
        const dir = target.position.subtract(from).normalize()
        agg.body.setLinearVelocity(dir.scale(15))

        activeBullets.push({ mesh: bullet, agg, target, timer: 0 })
      }

      // ── Input ──────────────────────────────────────────
      scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return
        const pick = pointerInfo.pickInfo
        if (!pick?.hit || !pick.pickedMesh || !pick.pickedPoint) return
        if (pick.pickedMesh.name === 'ground') {
          placeTower(pick.pickedPoint)
        }
        // 敵をクリックすると即撃破（デモ用）
        const clickedEnemyIndex = enemies.findIndex(e => pick.pickedMesh === e)
        if (clickedEnemyIndex !== -1) {
          killEnemy(clickedEnemyIndex)
        }
      })

      // ── Per-Frame Update ───────────────────────────────
      const TOWER_FIRE_INTERVAL = 2.0 // 秒
      const towerFireTimers: number[] = []

      scene.registerBeforeRender(() => {
        const delta = engine.getDeltaTime() / 1000

        // 敵の浮遊
        for (let i = 0; i < enemies.length; i++) {
          enemyTimes[i] += delta
          enemies[i].position.y = 0.5 + Math.sin(enemyTimes[i] * 2.5) * 0.15
          enemies[i].rotation.y += 0.3 * delta
        }

        // タワーの追跡と発射
        while (towerFireTimers.length < towers.length) towerFireTimers.push(0)
        for (let i = 0; i < towers.length; i++) {
          if (enemies.length === 0) continue
          let nearest = enemies[0]
          let minDist = Vector3.Distance(towers[i].position, enemies[0].position)
          for (const e of enemies) {
            const d = Vector3.Distance(towers[i].position, e.position)
            if (d < minDist) { minDist = d; nearest = e }
          }
          const dir = nearest.position.subtract(towers[i].position)
          towers[i].rotation.y = Math.atan2(dir.x, dir.z)

          towerFireTimers[i] += delta
          if (towerFireTimers[i] >= TOWER_FIRE_INTERVAL) {
            towerFireTimers[i] = 0
            const muzzlePos = towers[i].position.clone()
            muzzlePos.y += 0.9
            fireBullet(muzzlePos, nearest)
          }
        }

        // 弾丸の衝突チェック
        for (let bi = activeBullets.length - 1; bi >= 0; bi--) {
          const b = activeBullets[bi]
          b.timer += delta

          const dist = Vector3.Distance(b.mesh.position, b.target.position)
          if (dist < 0.8 || b.timer > 4) {
            if (dist < 0.8) {
              const ei = enemies.indexOf(b.target)
              if (ei !== -1) killEnemy(ei)
            }
            b.agg.dispose()
            b.mesh.dispose()
            activeBullets.splice(bi, 1)
          }
        }
      })

      engine.runRenderLoop(() => { scene.render() })
      const handleResize = () => { engine.resize() }
      window.addEventListener('resize', handleResize)
    }

    init()
    return () => { engine?.dispose() }
  }, [])

  return (
    <canvas ref={canvasRef} style={{ width: '100%', height: '100vh', display: 'block' }} />
  )
}
```

---

## 確認方法

- 宇宙空間に星が浮かんでいる
- タワーが 2 秒ごとに弾を発射する
- 弾が敵に当たると爆発エフェクトが出て敵が消える
- 敵をクリックしても爆発する（デモ用ショートカット）
