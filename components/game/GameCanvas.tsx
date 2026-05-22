'use client'

import { useEffect, useRef } from 'react'
import { Engine, Scene, Color4 } from '@babylonjs/core'

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    // Engine を初期化（第2引数 true = アンチエイリアス有効）
    const engine = new Engine(canvasRef.current, true)

    // Scene を作成（3D 世界の器）
    const scene = new Scene(engine)

    // 背景色を宇宙空間の黒に設定（r, g, b, a）
    scene.clearColor = new Color4(0.02, 0.02, 0.05, 1)

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
