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

    // requestAnimationFrame エラー
    // webGLPipelineContext is null
    // await をまたいで engine が破棄済みになった後も処理が続いてしまうのが原因。
    let cancelled = false

    const init = async () => {
      // ── Engine & Scene ───────────────────────────────────
      // Engine を初期化（第2引数 true = アンチエイリアス有効）
      engine = new Engine(canvasRef.current, true)
      // Scene を作成（3D 世界の器）
      const scene = new Scene(engine)
      // 背景色を宇宙空間の黒に設定（r, g, b, a）
      scene.clearColor = new Color4(0.02, 0.02, 0.05, 1)

      // createEnemyHealthBar 関数（scene 初期化後に定義）

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
      // クリーンアップ済みなら中断
      if (cancelled) return

      const havokPlugin = new HavokPlugin(true, havokInstance)
      scene.enablePhysics(new Vector3(0, -9.81, 0), havokPlugin)

      // ── Camera ───────────────────────────────────────────
      // ArcRotateCamera: ターゲット（原点）を中心に球面上を移動するカメラ

      const camera = new ArcRotateCamera(
        'camera',
        -Math.PI / 2, // alpha: 水平角（正面を向く）
        Math.PI / 3, // beta:  垂直角（斜め上から）
        20, // radius: 原点からの距離
        Vector3.Zero(),
        scene,
      )
      camera.attachControl(canvasRef.current, true)

      // カメラの移動範囲を制限（タワーディフェンス向け）
      camera.lowerRadiusLimit = 5
      camera.upperRadiusLimit = 40
      camera.lowerBetaLimit = 0.1
      camera.upperBetaLimit = Math.PI / 2.2

      // ── Lights ───────────────────────────────────────────
      // 環境光（上から青白く、下からは暗く）
      const hemisphericLight = new HemisphericLight(
        'hemisphericLight',
        new Vector3(0, 1, 0),
        scene,
      )

      hemisphericLight.intensity = 0.4
      hemisphericLight.diffuse = new Color3(0.6, 0.7, 1.0)
      hemisphericLight.groundColor = new Color3(0.1, 0.1, 0.2)

      // 太陽光（斜めから差し込む平行光線）

      const sunLight = new DirectionalLight(
        'sunLight',
        new Vector3(-1, -2, -1),
        scene,
      )

      sunLight.intensity = 0.8
      sunLight.diffuse = new Color3(1.0, 0.95, 0.8)

      // ── Meshes ───────────────────────────────────────────
      // 宇宙ステーションの床
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
      // 床（暗い金属）
      const groundMat = new PBRMaterial('groundMat', scene)
      groundMat.albedoColor = new Color3(0.15, 0.15, 0.2)
      groundMat.metallic = 0.8
      groundMat.roughness = 0.5
      ground.material = groundMat

      // ── Physics Bodies ─────────────────────────────────
      // 床は静的ボディ（mass: 0）

      new PhysicsAggregate(
        ground,
        PhysicsShapeType.BOX,
        {
          mass: 0,
        },
        scene,
      )

      // タワー台座（金属グレー）
      const towerBaseMat = new PBRMaterial('towerBaseMat', scene)
      towerBaseMat.albedoColor = new Color3(0.3, 0.35, 0.4)
      towerBaseMat.metallic = 0.9
      towerBaseMat.roughness = 0.2

      // タワー砲身（青く光るエネルギーコア）
      const barrelMat = new PBRMaterial('barrelMat', scene)
      barrelMat.albedoColor = new Color3(0.1, 0.3, 0.8)
      barrelMat.metallic = 0.5
      barrelMat.roughness = 0.1
      barrelMat.emissiveColor = new Color3(0, 0.5, 1.0)
      barrelMat.emissiveIntensity = 1.5

      // 敵（赤い宇宙船）
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
      // stars.emitRate = 500
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
      const BETWEEN_WAVE_DELAY = 5 // 秒

      // ── Explosion Effect ───────────────────────────────

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
        // disposeOnStop は使わない（disposeTexture=trueがデフォルトで共有テクスチャを破棄するため）
        // ps.disposeOnStop = true
        ps.start()

        // パーティクルが消えてから手動で後始末（テクスチャは破棄しない）
        // targetStopDuration(0.15) + maxLifeTime(0.8) = 0.95s → 余裕を持って 2s
        let elapsed = 0
        const cleanup = () => {
          elapsed += engine.getDeltaTime() / 1000
          if (elapsed >= 2.0) {
            ps.dispose(false) // false =
            // テクスチャは破棄しない
            scene.unregisterAfterRender(cleanup)
          }
        }
        scene.registerAfterRender(cleanup)
      }

      // ── Asset Loading ──────────────────────────────────
      // 敵モデルのテンプレートを作成
      // モデルファイルがあれば GLB を読み込み、なければ球で代替する

      let enemyTemplate: Mesh

      try {
        const result = await ImportMeshAsync('/model/enemy.glb', scene, {
          meshNames: '',
        })

        enemyTemplate = result.meshes[0] as Mesh
        enemyTemplate.name = 'enemyTemplate'
        enemyTemplate.setEnabled(false)

        // 付属アニメーションがあれば確認
        result.animationGroups.forEach((g) => {
          console.log('アニメーション', g.name)
          g.stop()
        })
      } catch {
        // GLB がない場合は球で代替
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

      // クリーンアップ済みなら中断
      if (cancelled) return

      // タワーモデルのテンプレート
      let towerTemplate: Mesh | null = null

      try {
        const result = await ImportMeshAsync('/model/tower.glb', scene, {
          meshNames: '',
        })
        towerTemplate = result.meshes[0] as Mesh
        towerTemplate.name = 'towerTemplate'
        towerTemplate.setEnabled(false)
      } catch {
        // GLB がない場合は null のまま（箱で代替）
        towerTemplate = null
      }

      // クリーンアップ済みなら中断
      if (cancelled) return

      // ── Enemies ────────────────────────────────────────

      const enemies: {
        mesh: Mesh
        speed: number
        time: number
        hp: number
        maxHp: number
        healthBar: EnemyHealthBar
      }[] = []

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

        // グリッドにスナップ（1 マス = 1 ユニット）
        const gridX = Math.round(position.x)
        const gridZ = Math.round(position.z)

        // 同じグリッドに既にタワーがあればスキップ
        const occupied = towers.some(
          (t) =>
            Math.round(t.position.x) === gridX &&
            Math.round(t.position.z) === gridZ,
        )

        if (occupied) return

        // 床の範囲外ならスキップ（床は -10〜10 の範囲）
        if (Math.abs(gridX) > 9 || Math.abs(gridZ) > 9) return
        if (Math.abs(gridX) < 1 && Math.abs(gridZ) < 1) return

        const towerType =
          TOWER_TYPES.find((t) => t.id === selectedTowerRef.current) ??
          TOWER_TYPES[0]

        if (gold < towerType.cost) return
        gold -= towerType.cost
        onGameEvent({ type: 'GOLD_CHANGED', gold })

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
          barrel.material = barrelMat
        }

        // new PhysicsAggregate(
        //   base,
        //   PhysicsShapeType.BOX,
        //   {
        //     mass: 0,
        //   },
        //   scene,
        // )

        towers.push(base)
        towerFireTimers.push(0)
        towerConfigs.push(towerType)
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
        // 既存の敵を全削除
        for (const e of enemies) {
          e.healthBar.plane.dispose()
          e.mesh.dispose()
        }
        enemies.length = 0

        // 飛行中の弾丸を全削除
        for (const b of activeBullets) {
          b.agg.dispose()
          b.mesh.dispose()
        }
        activeBullets.length = 0
        onGameEvent({
          type: 'GOLD_CHANGED',
          gold,
        })

        startWave(0)
      }

      function restartGame(): void {
        // タワーを全削除
        for (const t of towers) t.dispose()
        towers.length = 0
        towerFireTimers.length = 0
        towerConfigs.length = 0
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

        // 床をクリックしたときだけタワーを設置
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
        if (
          waveEnemiesSpawned >= currentWave.enemyCount &&
          enemies.length === 0
        ) {
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
            enemyReachsBase(i)
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

          // 全敵との距離チェック（ターゲットが消えた場合を考慮）
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

    // ウィンドウリサイズ時に Canvas サイズを更新する
    const handleResize = () => {
      engine?.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelled = true
      window.removeEventListener('resize', handleResize)
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
