'use client'

export interface TowerType {
  id: string
  name: string
  cost: number
  color: string
  description: string
  fireRate: number
  damage: number
  range: number
}

export const TOWER_TYPES: TowerType[] = [
  {
    id: 'basic',
    name: 'Basic',
    cost: 50,
    color: 'bg-blue-600',
    description: '標準タワー',
    fireRate: 2.0,
    damage: 1,
    range: 8,
  },
  {
    id: 'rapid',
    name: 'Rapid',
    cost: 80,
    color: 'bg-green-600',
    description: '高速連射',
    fireRate: 0.8,
    damage: 1,
    range: 5,
  },
  {
    id: 'sniper',
    name: 'Sniper',
    cost: 120,
    color: 'bg-purple-600',
    description: '超遠距離',
    fireRate: 4.0,
    damage: 3,
    range: 15,
  },
]

interface TowerSelectorProps {
  selectedTower: string
  onSelect: (id: string) => void
  gold: number
}

export function TowerSelector({
  selectedTower,
  onSelect,
  gold,
}: TowerSelectorProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
      {TOWER_TYPES.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          disabled={gold < t.cost}
          className={[
            'px-4 py-3 rounded-xl text-white font-bold border-2 transition-all min-w-[90px]',
            t.color,
            selectedTower === t.id
              ? 'border-white scale-110 shadow-lg shadow-white/20'
              : 'border-transparent opacity-80',
            gold < t.cost
              ? 'opacity-40 cursor-not-allowed'
              : 'hover:scale-105 cursor-pointer',
          ].join(' ')}
        >
          <div className="text-sm font-bold">{t.name}</div>
          <div className="text-xs text-gray-300 mt-1">{t.description}</div>
          <div className="text-xs text-yellow-300 mt-1 font-mono">
            {t.cost}G
          </div>
        </button>
      ))}
    </div>
  )
}
