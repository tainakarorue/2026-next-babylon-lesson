import {
  Scene,
  CreateAudioEngineAsync,
  CreateSoundAsync,
} from '@babylonjs/core'
import type { AudioEngineV2, StaticSound } from '@babylonjs/core'

export class SoundManager {
  private audioEngine: AudioEngineV2 | null = null
  private sounds = new Map<string, StaticSound>()
  private ready = false
  private bgmFadeTimer: ReturnType<typeof setInterval> | null = null

  async preload(_scene: Scene): Promise<void> {
    try {
      this.audioEngine = await CreateAudioEngineAsync()
    } catch {
      return
    }

    const defs: Array<{
      name: string
      url: string
      loop?: boolean
      volume?: number
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
    ]

    await Promise.all(
      defs.map(async (def) => {
        try {
          const sound = await Promise.race([
            CreateSoundAsync(
              def.name,
              def.url,
              { loop: def.loop ?? false, volume: def.volume ?? 0.5 },
              this.audioEngine!,
            ),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), 5000),
            ),
          ])
          this.sounds.set(def.name, sound as StaticSound)
        } catch {
          // ファイル未存在またはタイムアウト
        }
      }),
    )
    this.ready = true
  }

  async unlockAsync(): Promise<void> {
    if (this.audioEngine) {
      await this.audioEngine.unlockAsync()
    }
  }

  play(name: string, pitchVariation = 0.15): void {
    if (!this.ready) return
    const sound = this.sounds.get(name)
    if (!sound) return
    sound.playbackRate =
      1.0 - pitchVariation + Math.random() * pitchVariation * 2
    sound.play()
  }

  playBGM(): void {
    const bgm = this.sounds.get('bgm')
    if (!bgm) return
    if (this.bgmFadeTimer) clearInterval(this.bgmFadeTimer)
    bgm.volume = 0
    bgm.play()
    // 2 秒でフェードイン
    let elapsed = 0
    const target = 0.4
    const step = 50
    this.bgmFadeTimer = setInterval(() => {
      elapsed += step
      bgm.volume = Math.min(target, (elapsed / 2000) * target)
      if (elapsed >= 2000 && this.bgmFadeTimer) clearInterval(this.bgmFadeTimer)
    }, step)
  }

  stopBGM(fadeTime = 2): void {
    const bgm = this.sounds.get('bgm')
    if (!bgm) return
    const start = bgm.volume
    const duration = fadeTime * 1000
    let elapsed = 0
    const timer = setInterval(() => {
      elapsed += 50
      bgm.volume = Math.max(0, start * (1 - elapsed / duration))
      if (elapsed >= duration) {
        clearInterval(timer)
        bgm.stop()
      }
    }, 50)
  }

  stopAll(): void {
    this.sounds.forEach((s) => {
      try {
        s.stop()
      } catch {}
    })
  }

  dispose(): void {
    this.sounds.forEach((s) => {
      try {
        s.dispose()
      } catch {}
    })
    this.sounds.clear()
    try {
      this.audioEngine?.dispose()
    } catch {}
    this.audioEngine = null
  }
}
