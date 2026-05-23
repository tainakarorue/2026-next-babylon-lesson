'use client'

import dynamic from 'next/dynamic'

const GameCanvas = dynamic(() => import('@/components/game/GameCanvas'), {
  ssr: false,
})

export default function GamePage() {
  return (
    <main className="w-full h-screen overflow-hidden bg-black">
      <GameCanvas />
    </main>
  )
}
