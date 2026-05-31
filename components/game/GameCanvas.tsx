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
  ImportMeshAsync,
  ParticleSystem,
  GPUParticleSystem,
  DynamicTexture,
} from '@babylonjs/core'
import { HavokPlugin } from '@babylonjs/core'
import HavokPhysics from '@babylonjs/havok'
import '@babylonjs/loaders/glTF'

export default function GameCanvas() {
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

      // ── Stars Background ───────────────────────────────
      // const stars = new GPUParticleSystem(
      //   'stars',
      //   {
      //     capacity: 2000,
      //   },
      //   scene,
      // )

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

      // ── Explosion Effect ───────────────────────────────

      function createExpolosion(position: Vector3): void {
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
        // const result = await SceneLoader.ImportMeshAsync(
        //   '',
        //   '/model/',
        //   'enemy.glb',
        //   scene,
        // )
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
        // const result = await SceneLoader.ImportMeshAsync(
        //   '',
        //   '/model/',
        //   'tower.glb',
        //   scene,
        // )
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
      const enemies: Mesh[] = []
      const enemyTimes: number[] = []

      function spawnEnemy(position: Vector3): void {
        let mesh: Mesh
        const clone = enemyTemplate.clone(`enemy_${enemies.length}`, null)
        if (clone) {
          mesh = clone
          mesh.setEnabled(true)
        } else {
          mesh = MeshBuilder.CreateSphere(
            `enemy_${enemies.length}`,
            {
              diameter: 0.8,
              segments: 8,
            },
            scene,
          )
          mesh.material = enemyMat
        }

        mesh.position = position.clone()
        mesh.scaling = new Vector3(0.5, 0.5, 0.5)
        enemies.push(mesh)
        enemyTimes.push(Math.random() * Math.PI * 2)
      }

      function killEnemy(index: number): void {
        createExpolosion(enemies[index].position.clone())
        enemies[index].dispose()
        enemies.splice(index, 1)
        enemyTimes.splice(index, 1)
      }

      spawnEnemy(new Vector3(5, 0.5, 5))
      spawnEnemy(new Vector3(-3, 0.5, 4))
      spawnEnemy(new Vector3(2, 0.5, -6))

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

      // ── Tower Placement System ────────────────────────────
      const towers: Mesh[] = []

      function placeTower(position: Vector3): void {
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
        playSpawnAnimation(base)
      }

      // ── Bullet System
      const activeBullets: {
        mesh: Mesh
        agg: PhysicsAggregate
        target: Mesh
        timer: number
      }[] = []

      function fireBullet(from: Vector3, target: Mesh): void {
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

        const dir = target.position.subtract(from).normalize()
        agg.body.setLinearVelocity(dir.scale(15))

        activeBullets.push({ mesh: bullet, agg, target, timer: 0 })
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
        // 敵をクリックすると即撃破（デモ用）
        const clickedEnemyIndex = enemies.findIndex(
          (e) => pick.pickedMesh === e,
        )
        if (clickedEnemyIndex !== -1) {
          killEnemy(clickedEnemyIndex)
        }
      })

      // ── Per-Frame Update ───────────────────────────────

      const TOWER_FIRE_INTERVAL = 2.0
      const towerFireTimers: number[] = []

      scene.registerBeforeRender(() => {
        const delta = engine.getDeltaTime() / 1000

        // 敵の浮遊アニメーション
        for (let i = 0; i < enemies.length; i++) {
          enemyTimes[i] += delta
          enemies[i].position.y = 0.4 + Math.sin(enemyTimes[i] * 2.5) * 0.15
          enemies[i].rotation.y += 0.3 * delta
        }

        // タワーの追跡と発射
        while (towerFireTimers.length < towers.length) towerFireTimers.push(0)

        for (let i = 0; i < towers.length; i++) {
          if (enemies.length === 0) continue
          let nearest = enemies[0]
          let minDist = Vector3.Distance(
            towers[i].position,
            enemies[0].position,
          )

          for (const e of enemies) {
            // const d = Vector3.Distance(towers[i].position, enemies[i].position)
            const d = Vector3.Distance(towers[i].position, e.position)
            if (d < minDist) {
              minDist = d
              nearest = e
            }
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
  }, [])

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
