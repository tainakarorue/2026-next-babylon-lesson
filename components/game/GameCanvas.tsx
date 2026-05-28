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
  ActionManager,
  ExecuteCodeAction,
  PointerEventTypes,
  PhysicsAggregate,
  PhysicsShapeType,
  Animation,
  BackEase,
  EasingFunction,
} from '@babylonjs/core'
import { HavokPlugin } from '@babylonjs/core'
import HavokPhysics from '@babylonjs/havok'

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
      enemyMat.specularColor = new Color3(1, 0.5, 0.5)
      enemyMat.specularPower = 32

      // ── Physics Bodies ─────────────────────────────────
      // 床は静的ボディ（mass: 0）
      new PhysicsAggregate(
        ground,
        PhysicsShapeType.BOX,
        {
          mass: 0,
          // restitution: 0.2,
        },
        scene,
      )

      // ── Enemies ────────────────────────────────────────
      const enemies: Mesh[] = []
      const enemyTimes: number[] = []

      function spawnEnemy(position: Vector3): Mesh {
        const e = MeshBuilder.CreateSphere(
          `enemy_${enemies.length}`,
          {
            diameter: 0.8,
            segments: 8,
          },
          scene,
        )
        e.position = position.clone()
        e.material = enemyMat
        enemies.push(e)
        // ランダムなオフセット
        enemyTimes.push(Math.random() * Math.PI * 2)
        return e
      }

      spawnEnemy(new Vector3(5, 0.4, 5))
      spawnEnemy(new Vector3(-3, 0.4, 4))
      spawnEnemy(new Vector3(2, 0.4, -6))

      // ── Tower Spawn Animation ──────────────────────────

      function playSpawnAnimation(mesh: Mesh): void {
        const scaleAnim = new Animation(
          'spawnScale',
          'scaling',
          60,
          Animation.ANIMATIONTYPE_VECTOR3,
          // Animation.ANIMATIONLOOPMODE_CYCLE,
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

        const base = MeshBuilder.CreateBox(
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

        // new PhysicsAggregate(base, PhysicsShapeType.BOX, { mass: 0 }, scene)

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

        towers.push(base)
        playSpawnAnimation(base)
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
        const delta = engine.getDeltaTime() / 1000

        // 敵の浮遊アニメーション
        for (let i = 0; i < enemies.length; i++) {
          enemyTimes[i] += delta
          enemies[i].position.y = 0.4 + Math.sin(enemyTimes[i] * 2.5) * 0.15
          enemies[i].rotation.y += 0.3 * delta
        }

        // タワーの砲身が最寄りの敵を向く

        for (const tower of towers) {
          if (enemies.length === 0) continue

          let nearest = enemies[0]
          let minDist = Vector3.Distance(tower.position, enemies[0].position)

          for (const e of enemies) {
            const d = Vector3.Distance(tower.position, e.position)
            if (d < minDist) {
              minDist = d
              nearest = e
            }
          }

          const dir = nearest.position.subtract(tower.position)
          tower.rotation.y = Math.atan2(dir.x, dir.z)
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
