'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'

import { HUD } from '@/components/game/HUD'
import { TowerSelector } from '@/components/game/TowerSelector'
import { LevelSelect } from '@/components/game/LevelSelect'
import type { LevelConfig } from '@/lib/babylon/level-types'
import { LEVELS } from '@/lib/babylon/levels'

const GameCanvas = dynamic(() => import('@/components/game/GameCanvas'), {
  ssr: false,
})

export type GameEventCallback = (event: {
  type: string
  score?: number
  lives?: number
  wave?: number
  gold?: number
}) => void

export default function GamePage() {
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(20)
  const [wave, setWave] = useState(1)
  const [gold, setGold] = useState(200)
  const [selectedTower, setSelectedTower] = useState('basic')
  const [gameState, setGameState] = useState<
    'levelSelect' | 'playing' | 'pause' | 'gameover'
  >('levelSelect')
  const [unlockedLevels, setUnlockedLevels] = useState<string[]>(['level1'])
  const [currentLevel, setCurrentLevel] = useState<LevelConfig>(LEVELS[0])

  const gameControlRef = useRef<{
    start: (level: LevelConfig) => void
    restart: () => void
  } | null>(null)

  const selectedTowerRef = useRef(selectedTower)

  const handleLevelSelect = useCallback((levelId: string) => {
    const level = LEVELS.find((l) => l.id === levelId)
    if (!level) return
    setCurrentLevel(level)
    setScore(0)
    setLives(level.startLives)
    setWave(1)
    setGold(level.startGold)
    setGameState('playing')
    setTimeout(() => gameControlRef.current?.start(level), 100)
  }, [])

  const handleTowerSelect = useCallback((id: string) => {
    setSelectedTower(id)
    selectedTowerRef.current = id
  }, [])

  // レンダーごとに最新を反映
  // const currentLevelRef = useRef<LevelConfig>(LEVELS[0])
  // currentLevelRef.current = currentLevel

  const currentLevelRef = useRef<LevelConfig>(currentLevel)

  // レンダーごとに最新を反映
  useEffect(() => {
    currentLevelRef.current = currentLevel
  }, [currentLevel])

  const handleGameEvent = useCallback(
    (event: {
      type: string
      score?: number
      lives?: number
      wave?: number
      gold?: number
    }) => {
      if (event.type === 'SCORE_CHANGED' && event.score !== undefined)
        setScore(event.score)

      if (event.type === 'LIFE_CHANGED' && event.lives !== undefined)
        setLives(event.lives)

      if (event.type === 'GOLD_CHANGED' && event.gold !== undefined)
        setGold(event.gold)

      if (event.type === 'WAVE_STARTED' && event.wave !== undefined)
        setWave(event.wave)

      if (event.type === 'LEVEL_CLEAR') {
        const nextLevel =
          LEVELS[
            LEVELS.findIndex((l) => l.id === currentLevelRef.current.id) + 1
          ]
        if (nextLevel) {
          setUnlockedLevels((prev) =>
            prev.includes(nextLevel.id) ? prev : [...prev, nextLevel.id],
          )
        }
        setGameState('gameover')
      }

      if (event.type === 'GAME_OVER') setGameState('gameover')
    },
    [],
  )

  const handleRestart = useCallback(() => {
    setScore(0)
    setLives(currentLevel.startLives)
    setWave(1)
    setGold(currentLevel.startGold)
    setGameState('levelSelect')
    gameControlRef.current?.restart()
  }, [currentLevel])

  return (
    <main className="w-full h-screen overflow-hidden bg-black">
      <GameCanvas
        currentLevel={currentLevel}
        gameState={gameState}
        onGameEvent={handleGameEvent}
        controlRef={gameControlRef}
        selectedTowerRef={selectedTowerRef}
      />
      {gameState === 'levelSelect' && (
        <LevelSelect
          onSelect={handleLevelSelect}
          unlockedLevels={unlockedLevels}
        />
      )}
      {(gameState === 'playing' || gameState === 'gameover') && (
        <HUD
          score={score}
          lives={lives}
          wave={wave}
          gold={gold}
          gameState={gameState}
          onStart={() => {}}
          onRestart={handleRestart}
        />
      )}
      {gameState === 'playing' && (
        <TowerSelector
          selectedTower={selectedTower}
          onSelect={handleTowerSelect}
          gold={gold}
        />
      )}
    </main>
  )
}
