'use client'

import { LEVELS } from '@/lib/babylon/levels'

interface LevelSelectProps {
  onSelect: (levelId: string) => void
  unlockedLevels: string[]
}

export function LevelSelect({ onSelect, unlockedLevels }: LevelSelectProps) {
  const difficultyStyle = {
    easy: 'border-green-500 text-green-300',
    normal: 'border-yellow-500 text-yellow-300',
    hard: 'border-red-500 text-red-300',
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
      <div className="text-center text-white">
        <h1 className="text-5xl font-bold mb-2 tracking-widest">
          NEBULA DEFENSE
        </h1>
        <p className="text-gray-400 mb-8">ミッションを選択してください</p>
        <div className="flex gap-6 flex-wrap justify-center">
          {LEVELS.map((level) => {
            const unlocked = unlockedLevels.includes(level.id)

            return (
              <button
                key={level.id}
                onClick={() => unlocked && onSelect(level.id)}
                disabled={!unlocked}
                className={[
                  'w-52 p-5 rounded-xl border-2 bg-black/60 text-left transition-all backdrop-blur-sm',
                  difficultyStyle[level.difficulty],
                  unlocked
                    ? 'hover:bg-white/10 hover:scale-105 cursor-pointer'
                    : 'opacity-40 cursor-not-allowed',
                ].join(' ')}
              >
                <div className="font-bold text-xl mb-1">{level.name}</div>
                <div className="text-xs text-gray-400 mb-3 leading-relaxed">
                  {level.description}
                </div>
                <div className="text-xs space-y-1">
                  <div>
                    <span className="text-gray-400">難易度: </span>
                    <span className="font-bold uppercase">
                      {level.difficulty}
                    </span>
                  </div>
                  <div>
                    <span className="text-yellow-400">開始ゴールド: </span>
                    <span>{level.startGold}G</span>
                  </div>
                  <div>
                    <span className="text-red-400">開始ライフ: </span>
                    <span>{level.startLives}</span>
                  </div>
                  <div>
                    <span className="text-blue-400">ウェーブ数: </span>
                    <span>{level.waves.length}</span>
                  </div>
                </div>
                {!unlocked && (
                  <div className="text-xs mt-3 text-gray-500">
                    🔒 前のレベルをクリアして解放
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
