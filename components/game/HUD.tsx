'use client'

interface HUDProps {
  score: number
  lives: number
  wave: number
  gameState: 'menu' | 'playing' | 'pause' | 'gameover'
  onStart: () => void
  onRestart: () => void
}

export function HUD({
  score,
  lives,
  wave,
  gameState,
  onStart,
  onRestart,
}: HUDProps) {
  if (gameState === 'menu') {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
        <div className="text-center text-white">
          <h1 className="text-5xl font-bold mb-2 tracking-widest">
            NEBULA DEFENSE
          </h1>
          <p className="text-gray-400 mb-8">
            <p className="text-gray-400 mb-8">
              床をクリックしてタワーを設置し、敵の侵攻を防げ
            </p>
          </p>
          <button
            onClick={onStart}
            className="px-10 py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-xl font-bold transition-colors"
          >
            PLAY
          </button>
        </div>
      </div>
    )
  }

  if (gameState === 'gameover') {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/70">
        <div className="text-center text-white">
          <h1 className="text-5xl font-bold mb-2 text-red-400">GAME OVER</h1>
          <p className="text-3xl mb-8">Score: {score}</p>
          <button
            onClick={onRestart}
            className="px-10 py-4 bg-red-600 hover:bg-red-500 rounded-lg text-xl font-bold transition-colors"
          >
            RETRY
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center pointer-events-none select-none">
      <div className="bg-black/50 px-4 py-2 rounded-lg">
        <span className="text-blue-300 font-bold text-lg">SCORE</span>
        <span className="text-white font-bold text-2xl ml-2">{score}</span>
      </div>
      <div className="bg-black/50 px-4 py-2 rounded-lg">
        <span className="text-yellow-300 font-bold text-lg">WAVE</span>
        <span className="text-white font-bold text-2xl ml-2">{wave}</span>
      </div>
      <div className="bg-black/50 px-4 py-2 rounded-lg">
        <span className="text-red-300 font-bold text-lg">LIVES</span>
        <span className="text-white font-bold text-2xl ml-2">{lives}</span>
      </div>
    </div>
  )
}
