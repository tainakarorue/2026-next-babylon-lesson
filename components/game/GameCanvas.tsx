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

      // 敵の仮置き（球）
      const enemy = MeshBuilder.CreateSphere(
        'enemy',
        { diameter: 0.8, segments: 8 },
        scene,
      )
      enemy.position = new Vector3(5, 3, 5)

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
      // towerBase.material = towerBaseMat

      // タワー砲身（青く光るエネルギーコア）
      const barrelMat = new PBRMaterial('barrelMat', scene)
      barrelMat.albedoColor = new Color3(0.1, 0.3, 0.8)
      barrelMat.metallic = 0.5
      barrelMat.roughness = 0.1
      barrelMat.emissiveColor = new Color3(0, 0.5, 1.0)
      barrelMat.emissiveIntensity = 1.5
      // towerBarrel.material = barrelMat

      // 敵（赤い宇宙船）
      const enemyMat = new StandardMaterial('enemyMat', scene)
      enemyMat.diffuseColor = new Color3(0.8, 0.1, 0.1)
      enemyMat.emissiveColor = new Color3(0.3, 0, 0)
      enemyMat.specularColor = new Color3(1, 0.5, 0.5)
      enemyMat.specularPower = 32
      enemy.material = enemyMat
      // enemy2.material = enemyMat

      const bulletMat = new PBRMaterial('bulletMat', scene)
      bulletMat.albedoColor = new Color3(1.0, 0.8, 0.0)
      bulletMat.emissiveColor = new Color3(1.0, 0.5, 0.0)
      bulletMat.emissiveIntensity = 2.0
      bulletMat.metallic = 0
      bulletMat.roughness = 0

      // ── Physics Bodies ─────────────────────────────────
      // 床は静的ボディ（mass: 0）
      new PhysicsAggregate(
        ground,
        PhysicsShapeType.BOX,
        {
          mass: 0,
          restitution: 0.2,
        },
        scene,
      )

      // 敵は動的ボディ（mass > 0）
      const enemyAggregate = new PhysicsAggregate(
        enemy,
        PhysicsShapeType.SPHERE,
        {
          mass: 1,
          restitution: 0.5,
          friction: 0.3,
        },
        scene,
      )

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

        new PhysicsAggregate(base, PhysicsShapeType.BOX, { mass: 0 }, scene)

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
      }

      // ── Bullet Firing System ──────────────────────────

      function fireBullet(from: Vector3, target: Vector3): void {
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

        const bulletAgg = new PhysicsAggregate(
          bullet,
          PhysicsShapeType.SPHERE,
          {
            mass: 0.05,
            restitution: 0.1,
          },
          scene,
        )

        const direction = target.subtract(from).normalize()
        bulletAgg.body.setLinearVelocity(direction.scale(15))

        // 3 秒後に自動削除
        setTimeout(() => {
          bulletAgg.dispose()
          bullet.dispose()
        }, 3000)
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

      // ── Input: キーボードイベント ─────────────────────────

      const keysDown = new Set<string>()
      scene.actionManager = new ActionManager(scene)

      scene.actionManager.registerAction(
        new ExecuteCodeAction(ActionManager.OnKeyDownTrigger, (evt) => {
          keysDown.add(evt.sourceEvent.code)
        }),
      )
      scene.actionManager.registerAction(
        new ExecuteCodeAction(ActionManager.OnKeyUpTrigger, (evt) => {
          keysDown.delete(evt.sourceEvent.code)
        }),
      )

      scene.actionManager.registerAction(
        new ExecuteCodeAction(
          {
            trigger: ActionManager.OnKeyUpTrigger,
            parameter: 'f',
          },
          () => {
            fireBullet(new Vector3(0, 1, 0), enemy.position)
          },
        ),
      )

      // ── Render Loop ──────────────────────────────────────
      // レンダリングループを開始（毎フレーム scene.render() が呼ばれる）
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
