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
  PBRMaterial,
  StandardMaterial,
} from '@babylonjs/core'

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    // ── Engine & Scene ───────────────────────────────────
    // Engine を初期化（第2引数 true = アンチエイリアス有効）
    const engine = new Engine(canvasRef.current, true)

    // Scene を作成（3D 世界の器）
    const scene = new Scene(engine)

    // 背景色を宇宙空間の黒に設定（r, g, b, a）
    scene.clearColor = new Color4(0.02, 0.02, 0.05, 1)

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
    ground.position.y = 0

    // タワーの台座
    const towerBase = MeshBuilder.CreateBox(
      'towerBase',
      {
        width: 1,
        height: 0.3,
        depth: 1,
      },
      scene,
    )
    towerBase.position = new Vector3(0, 0.15, 0)

    // タワーの砲身（台座の子にする）
    const towerBarrel = MeshBuilder.CreateCylinder(
      'towerBarrel',
      {
        height: 1.5,
        diameter: 0.3,
        tessellation: 8,
      },
      scene,
    )
    towerBarrel.parent = towerBase
    towerBarrel.position = new Vector3(0, 0.9, 0)

    // 敵の仮置き（球）
    const enemy = MeshBuilder.CreateSphere(
      'enemy',
      { diameter: 0.8, segments: 8 },
      scene,
    )
    enemy.position = new Vector3(5, 0.4, 5)

    const enemy2 = MeshBuilder.CreateSphere('enemy2', {
      diameter: 0.8,
      segments: 8,
    })
    enemy2.position = new Vector3(-3, 0.4, 4)

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
    towerBase.material = towerBaseMat

    // タワー砲身（青く光るエネルギーコア）
    const barrelMat = new PBRMaterial('barrelMat', scene)
    barrelMat.albedoColor = new Color3(0.1, 0.3, 0.8)
    barrelMat.metallic = 0.5
    barrelMat.roughness = 0.1
    barrelMat.emissiveColor = new Color3(0, 0.5, 1.0)
    barrelMat.emissiveIntensity = 1.5
    towerBarrel.material = barrelMat

    // 敵（赤い宇宙船）
    const enemyMat = new StandardMaterial('enemyMat', scene)
    enemyMat.diffuseColor = new Color3(0.8, 0.1, 0.1)
    enemyMat.emissiveColor = new Color3(0.3, 0, 0)
    enemyMat.specularColor = new Color3(1, 0.5, 0.5)
    enemyMat.specularPower = 32
    enemy.material = enemyMat
    enemy2.material = enemyMat

    // ── Render Loop ──────────────────────────────────────
    // レンダリングループを開始（毎フレーム scene.render() が呼ばれる）
    engine.runRenderLoop(() => {
      scene.render()
    })

    // ウィンドウリサイズ時に Canvas サイズを更新する
    const handleResize = () => {
      engine.resize()
    }
    window.addEventListener('resize', handleResize)

    // クリーンアップ（コンポーネントのアンマウント時に実行）

    return () => {
      window.removeEventListener('resize', handleResize)
      engine.dispose()
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
