'use client'

import { useState, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'

import { HUD } from '@/components/game/HUD'

const GameCanvas = dynamic(() => import('@/components/game/GameCanvas'), {
  ssr: false,
})

export type GameEventCallback = (event: {
  type: string
  score?: number
  lives?: number
  wave?: number
}) => void

export default function GamePage() {
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(20)
  const [wave, setWave] = useState(1)
  const [gameState, setGameState] = useState<
    'menu' | 'playing' | 'pause' | 'gameover'
  >('menu')

  const gameControlRef = useRef<{
    start: () => void
    restart: () => void
  } | null>(null)

  const handleGameEvent = useCallback(
    (event: {
      type: string
      score?: number
      lives?: number
      wave?: number
    }) => {
      if (event.type === 'SCORE_CHANGED' && event.score !== undefined)
        setScore(event.score)

      if (event.type === 'LIFE_CHANGED' && event.lives !== undefined)
        setLives(event.lives)

      if (event.type === 'WAVE_STARTED' && event.wave !== undefined)
        setWave(event.wave)

      if (event.type === 'GAME_OVER') setGameState('gameover')
    },
    [],
  )

  const handleStart = useCallback(() => {
    setGameState('playing')
    gameControlRef.current?.start()
  }, [])

  const handleRestart = useCallback(() => {
    setScore(0)
    setLives(20)
    setWave(1)
    setGameState('playing')
    gameControlRef.current?.start()
  }, [])

  return (
    <main className="w-full h-screen overflow-hidden bg-black">
      <GameCanvas
        gameState={gameState}
        onGameEvent={handleGameEvent}
        controlRef={gameControlRef}
      />
      <HUD
        score={score}
        lives={lives}
        wave={wave}
        gameState={gameState}
        onStart={handleStart}
        onRestart={handleRestart}
      />
    </main>
  )
}
