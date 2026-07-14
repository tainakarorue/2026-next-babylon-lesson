export interface WaveConfig {
  enemyCount: number
  spawnInterval: number
  enemySpeed: number
  scorePerKill: number
  enemyHp: number
  goldPerKill: number
}

export interface ObstacleConfig {
  x: number
  z: number
  type: 'rock' | 'wall'
}

export interface LevelConfig {
  id: string
  name: string
  description: string
  difficulty: 'easy' | 'normal' | 'hard'
  mapSize: number
  startGold: number
  startLives: number
  spawnPoints: Array<{ x: number; z: number }>
  basePosition: { x: number; z: number }
  obstacles: ObstacleConfig[]
  waves: WaveConfig[]
  skyColor: { r: number; g: number; b: number; a: number }
  ambientIntensity: number
}
