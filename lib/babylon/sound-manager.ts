import { Sound, Scene, Vector3 } from '@babylonjs/core'

export class SoundManager {
  private sounds = new Map<string, Sound>()
  private ready = false

  async preload(scene: Scene): Promise<void> {
    const defs: Array<{
      name: string
      url: string
      loop?: boolean
      volume?: number
      spatial?: boolean
    }> = [
      { name: 'bgm', url: '/audio/bgm.mp3', loop: true, volume: 0.4 },
      { name: 'laser', url: '/audio/laser.mp3', loop: false, volume: 0.6 },
      {
        name: 'explosion',
        url: '/audio/explosion.mp3',
        loop: false,
        volume: 0.8,
      },
      {
        name: 'place',
        url: '/audio/tower_place.mp3',
        loop: false,
        volume: 0.5,
      },
      {
        name: 'engine',
        url: '/audio/engine.mp3',
        loop: true,
        volume: 0.3,
        spatial: true,
      },
    ]

    await Promise.all(
      defs.map(
        (def) =>
          new Promise<void>((resolve) => {
            try {
              const sound = new Sound(
                def.name,
                def.url,
                scene,
                () => resolve(),
                {
                  loop: def.loop ?? false,
                  autoplay: false,
                  volume: def.volume ?? 0.5,
                  spatialSound: def.spatial ?? false,
                  maxDistance: 20,
                },
              )
              this.sounds.set(def.name, sound)
            } catch {
              // ファイルが存在しない場合はスキップ
              resolve()
            }
          }),
      ),
    )
    this.ready = true
  }

  play(name: string, pitchVariation = 0.15): void {
    if (!this.ready) return
    const sound = this.sounds.get(name)
    if (!sound) return
    sound.setPlaybackRate(
      1.0 - pitchVariation + Math.random() * pitchVariation * 2,
    )
    sound.play()
  }

  playBGM(): void {
    const bgm = this.sounds.get('bgm')
    if (bgm && !bgm.isPlaying) {
      bgm.setVolume(0)
      bgm.play()
      bgm.setVolume(0.4, 2) // 2 秒でフェードイン
    }
  }

  stopBGM(fadeTime = 2): void {
    const bgm = this.sounds.get('bgm')
    if (bgm?.isPlaying) {
      bgm.setVolume(0, fadeTime)
      setTimeout(() => bgm.stop(), fadeTime * 1000)
    }
  }

  attachEngineSound(mesh: {
    getAbsolutePosition: () => {
      x: number
      y: number
      z: number
    }
  }): void {
    const engine = this.sounds.get('engine')
    if (!engine) return
    // mesh の位置を毎フレーム更新する（setPosition を呼ぶ）
    // attachToMesh は Mesh 型が必要なので position を手動で更新する方式を推奨
  }

  updateSpatialPosition(name: string, x: number, y: number, z: number): void {
    const sound = this.sounds.get(name)
    if (sound?.spatialSound) {
      sound.setPosition(new Vector3(x, y, z))
    }
  }

  stopAll(): void {
    this.sounds.forEach((s) => {
      if (s.isPlaying) s.stop()
    })
  }

  dispose(): void {
    this.sounds.forEach((s) => s.dispose())
    this.sounds.clear()
  }
}
