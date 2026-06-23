// import { Sound, Scene, Vector3 } from '@babylonjs/core'

// export class SoundManager {
//   private sounds = new Map<string, Sound>()
//   private ready = false
//   private bgmStopTimer: ReturnType<typeof setTimeout> | null = null

//   async preload(scene: Scene): Promise<void> {
//     const defs: Array<{
//       name: string
//       url: string
//       loop?: boolean
//       volume?: number
//       spatial?: boolean
//     }> = [
//       { name: 'bgm', url: '/audio/bgm.mp3', loop: true, volume: 0.4 },
//       { name: 'laser', url: '/audio/laser.mp3', loop: false, volume: 0.6 },
//       {
//         name: 'explosion',
//         url: '/audio/explosion.mp3',
//         loop: false,
//         volume: 0.8,
//       },
//       {
//         name: 'place',
//         url: '/audio/tower_place.mp3',
//         loop: false,
//         volume: 0.5,
//       },
//       {
//         name: 'engine',
//         url: '/audio/engine.mp3',
//         loop: true,
//         volume: 0.3,
//         spatial: true,
//       },
//     ]

//     await Promise.all(
//       defs.map(
//         (def) =>
//           new Promise<void>((resolve) => {
//             const timer = setTimeout(resolve, 3000) // 3秒でタイムアウト
//             try {
//               const sound = new Sound(
//                 def.name,
//                 def.url,
//                 scene,
//                 () => {
//                   clearTimeout(timer)
//                   resolve()
//                 },
//                 {
//                   loop: def.loop ?? false,
//                   autoplay: false,
//                   volume: def.volume ?? 0.5,
//                   spatialSound: def.spatial ?? false,
//                   maxDistance: 20,
//                 },
//               )
//               this.sounds.set(def.name, sound)
//             } catch {
//               // ファイルが存在しない場合はスキップ
//               clearTimeout(timer)
//               resolve()
//             }
//           }),
//       ),
//     )
//     this.ready = true
//   }

//   play(name: string, pitchVariation = 0.15): void {
//     if (!this.ready) return
//     const sound = this.sounds.get(name)
//     if (!sound) return
//     sound.setPlaybackRate(
//       1.0 - pitchVariation + Math.random() * pitchVariation * 2,
//     )
//     sound.play()
//   }

//   playBGM(): void {
//     const bgm = this.sounds.get('bgm')
//     if (bgm && !bgm.isPlaying) {
//       if (this.bgmStopTimer) {
//         clearTimeout(this.bgmStopTimer)
//         this.bgmStopTimer = null
//       }

//       bgm.setVolume(0)
//       bgm.play()
//       bgm.setVolume(0.4, 2) // 2 秒でフェードイン
//     }
//   }

//   stopBGM(fadeTime = 2): void {
//     const bgm = this.sounds.get('bgm')
//     if (bgm?.isPlaying) {
//       if (this.bgmStopTimer) clearTimeout(this.bgmStopTimer)

//       bgm.setVolume(0, fadeTime)
//       this.bgmStopTimer = setTimeout(() => {
//         bgm.stop()
//         this.bgmStopTimer = null
//       }, fadeTime * 1000)
//     }
//   }

//   attachEngineSound(mesh: {
//     getAbsolutePosition: () => {
//       x: number
//       y: number
//       z: number
//     }
//   }): void {
//     const engine = this.sounds.get('engine')
//     if (!engine) return
//     // mesh の位置を毎フレーム更新する（setPosition を呼ぶ）
//     // attachToMesh は Mesh 型が必要なので position を手動で更新する方式を推奨
//   }

//   updateSpatialPosition(name: string, x: number, y: number, z: number): void {
//     const sound = this.sounds.get(name)
//     if (sound?.spatialSound) {
//       sound.setPosition(new Vector3(x, y, z))
//     }
//   }

//   stopAll(): void {
//     this.sounds.forEach((s) => {
//       if (s.isPlaying) s.stop()
//     })
//   }

//   // dispose(): void {
//   //   if (this.bgmStopTimer) {
//   //     clearTimeout(this.bgmStopTimer)
//   //     this.bgmStopTimer = null
//   //   }

//   //   this.sounds.forEach((s) => s.dispose())
//   //   this.sounds.clear()
//   // }

//   // 修正後
//   dispose(): void {
//     if (this.bgmStopTimer) {
//       clearTimeout(this.bgmStopTimer)
//       this.bgmStopTimer = null
//     }

//     this.sounds.forEach((s) => {
//       try {
//         s.dispose()
//       } catch {
//         // 音声ファイル未存在 or エンジン破棄済みの場合は無視
//       }
//     })
//     this.sounds.clear()
//   }
// }

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
    bgm.volume = 0
    bgm.play()
    // 2 秒でフェードイン
    let elapsed = 0
    const target = 0.4
    const step = 50
    const timer = setInterval(() => {
      elapsed += step
      bgm.volume = Math.min(target, (elapsed / 2000) * target)
      if (elapsed >= 2000) clearInterval(timer)
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
  }
}
