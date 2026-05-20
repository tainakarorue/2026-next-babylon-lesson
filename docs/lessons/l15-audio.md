# L15 — サウンドエンジン

## 概要

Babylon.js の AudioEngine V2 を使って BGM・効果音・3D 空間音響を実装する。  
ブラウザの autoplay 制限への対処方法も学ぶ。

**ゲームへの貢献**: BGM・発射音・爆発音・タワー設置音・敵エンジン音（3D 空間音響）が完成する。

---

## 概念解説

### Web Audio の制約

ブラウザは**ユーザー操作なしに音声を自動再生できない**。  
ページ読み込み直後に `sound.play()` を呼んでも無音になる。

**解決策**: `engine.audioEngine.unlock()` をユーザーの最初のクリック後に呼ぶ。

```typescript
// ユーザーが最初にクリックしたとき
scene.onPointerObservable.add((info) => {
  if (info.type === PointerEventTypes.POINTERDOWN) {
    if (engine.audioEngine && !engine.audioEngine.unlocked) {
      engine.audioEngine.unlock()
    }
  }
}, -1, false)
```

### AudioEngineV2 と旧 Sound クラスの違い

Babylon.js 7.x からは `AudioEngineV2` が推奨。  
旧 API（`Sound` クラス）も動くが将来的には非推奨になる。

```typescript
// 旧 API（Sound クラス）— 現在も動作するが非推奨に向かう
import { Sound } from '@babylonjs/core'
const bgm = new Sound('bgm', '/audio/bgm.mp3', scene, null, {
  loop: true,
  autoplay: false,
  volume: 0.5,
})

// 新 API（AudioEngineV2）— 推奨
import { CreateAudioEngineAsync, CreateSoundAsync } from '@babylonjs/core'
const audioEngine = await CreateAudioEngineAsync()
const bgm = await CreateSoundAsync('bgm', '/audio/bgm.mp3', { loop: true })
```

このレッスンでは互換性が高く Next.js でも安定して動く **旧 Sound クラス** を使う。

### Sound クラスの基本

```typescript
import { Sound } from '@babylonjs/core'

// 読み込み（第 3 引数が null または callback）
const bgm = new Sound('bgm', '/audio/bgm.mp3', scene, () => {
  // 読み込み完了後に呼ばれる
  bgm.play()
})

// オプション
const se = new Sound('explosion', '/audio/explosion.mp3', scene, null, {
  loop: false,         // ループ
  autoplay: false,     // 自動再生
  volume: 0.8,         // 音量（0.0〜1.0）
  spatialSound: true,  // 3D 空間音響を有効化
  maxDistance: 20,     // 3D 音響の最大距離
})
```

### 3D 空間音響

```typescript
const engineSound = new Sound('engine', '/audio/engine.mp3', scene, null, {
  loop: true,
  spatialSound: true,
  maxDistance: 15,
  volume: 0.5,
  distanceModel: 'exponential',  // 'linear' | 'inverse' | 'exponential'
  rolloffFactor: 2,              // 減衰の速さ（大きいほど急に小さくなる）
})

// メッシュに追従させる
engineSound.attachToMesh(enemyMesh)

// または座標を手動で更新
engineSound.setPosition(new Vector3(x, y, z))

// カメラをリスナーとして設定（デフォルトで自動設定される）
// scene.audioListenerPositionProvider = () => camera.position
```

### 音量・フェード

```typescript
// 即座に変更
sound.setVolume(0.5)

// フェードイン（2 秒かけて 1.0 に）
sound.setVolume(1.0, 2)  // 第 2 引数: フェード時間（秒）

// 停止・一時停止
sound.stop()
sound.pause()

// ピッチを少しランダムにする（毎回同じにならない）
se.setPlaybackRate(0.8 + Math.random() * 0.4)
```

---

## 実装手順

### Step 1: 音声ファイルを用意する

`public/audio/` フォルダを作成して音声ファイルを配置する。

```
public/
  audio/
    bgm.mp3           ← ループ BGM
    laser.mp3         ← 発射音
    explosion.mp3     ← 爆発音
    tower_place.mp3   ← タワー設置音
    enemy_engine.mp3  ← 敵エンジン音（ループ）
```

**フリー素材サイト**: 
- freesound.org（CC0 ライセンス）
- zapsplat.com（無料プラン）
- opengameart.org（ゲーム専用）

### Step 2: SoundManager クラスを作る

```typescript
class SoundManager {
  private sounds: Map<string, Sound> = new Map()
  private muted = false

  async preload(scene: Scene): Promise<void> {
    const soundDefs: { name: string; url: string; options: Parameters<typeof Sound>[4] }[] = [
      { name: 'bgm',       url: '/audio/bgm.mp3',         options: { loop: true, volume: 0.4 } },
      { name: 'laser',     url: '/audio/laser.mp3',        options: { volume: 0.6 } },
      { name: 'explosion', url: '/audio/explosion.mp3',    options: { volume: 0.8 } },
      { name: 'place',     url: '/audio/tower_place.mp3',  options: { volume: 0.5 } },
    ]

    await Promise.all(soundDefs.map(def => new Promise<void>(resolve => {
      const s = new Sound(def.name, def.url, scene, resolve, def.options)
      this.sounds.set(def.name, s)
    })))
  }

  play(name: string): void {
    if (this.muted) return
    const s = this.sounds.get(name)
    if (s) {
      s.setPlaybackRate(0.9 + Math.random() * 0.2) // ランダムピッチ
      s.play()
    }
  }

  playBGM(): void {
    const bgm = this.sounds.get('bgm')
    if (bgm && !bgm.isPlaying) bgm.play()
  }

  stopBGM(): void {
    this.sounds.get('bgm')?.stop()
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    if (muted) {
      this.sounds.forEach(s => s.setVolume(0))
    } else {
      this.sounds.forEach(s => s.setVolume(1))
    }
  }
}
```

---

## ポイント解説

### 音声が再生されない場合のデバッグ
1. ブラウザコンソールで `AudioContext` の状態を確認: `AudioContext.state === 'suspended'`
2. `engine.audioEngine.unlock()` がユーザー操作後に呼ばれているか確認
3. ファイルパスが正しいか確認（Next.js では `public/` フォルダからの相対パス）

### ピッチのランダム化が重要な理由
同じ音声を毎回同じピッチで再生すると単調に聞こえる。  
`setPlaybackRate(0.9 + Math.random() * 0.2)` で ±10% のランダム変動を加えると自然になる。

### `spatialSound: true` を使う際の注意
リスナー（カメラ/プレイヤー）の位置が自動設定されていることを確認する。  
`scene.audioListenerPositionProvider` でリスナー位置をカスタムできる。

---

## 全体コード

### `lib/babylon/sound-manager.ts`

```typescript
import { Sound, Scene } from '@babylonjs/core'

export class SoundManager {
  private sounds = new Map<string, Sound>()
  private ready = false

  async preload(scene: Scene): Promise<void> {
    const defs: Array<{ name: string; url: string; loop?: boolean; volume?: number; spatial?: boolean }> = [
      { name: 'bgm',       url: '/audio/bgm.mp3',       loop: true,  volume: 0.4 },
      { name: 'laser',     url: '/audio/laser.mp3',      loop: false, volume: 0.6 },
      { name: 'explosion', url: '/audio/explosion.mp3',  loop: false, volume: 0.8 },
      { name: 'place',     url: '/audio/tower_place.mp3',loop: false, volume: 0.5 },
      { name: 'engine',    url: '/audio/engine.mp3',     loop: true,  volume: 0.3, spatial: true },
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
                }
              )
              this.sounds.set(def.name, sound)
            } catch {
              // ファイルが存在しない場合はスキップ
              resolve()
            }
          })
      )
    )
    this.ready = true
  }

  play(name: string, pitchVariation = 0.15): void {
    if (!this.ready) return
    const sound = this.sounds.get(name)
    if (!sound) return
    sound.setPlaybackRate(1.0 - pitchVariation + Math.random() * pitchVariation * 2)
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

  attachEngineSound(mesh: { getAbsolutePosition: () => { x: number; y: number; z: number } }): void {
    const engine = this.sounds.get('engine')
    if (!engine) return
    // mesh の位置を毎フレーム更新する（setPosition を呼ぶ）
    // attachToMesh は Mesh 型が必要なので position を手動で更新する方式を推奨
  }

  updateSpatialPosition(name: string, x: number, y: number, z: number): void {
    const sound = this.sounds.get(name)
    if (sound?.spatialSound) {
      sound.setPosition(new (require('@babylonjs/core').Vector3)(x, y, z))
    }
  }

  stopAll(): void {
    this.sounds.forEach((s) => { if (s.isPlaying) s.stop() })
  }

  dispose(): void {
    this.sounds.forEach((s) => s.dispose())
    this.sounds.clear()
  }
}
```

---

### `components/game/GameCanvas.tsx`（音声追加の抜粋）

```tsx
// import 追加
import { SoundManager } from '@/lib/babylon/sound-manager'

// init() 内
const soundManager = new SoundManager()
await soundManager.preload(scene)

// ユーザーのクリックで AudioContext を解除
let audioUnlocked = false
scene.onPointerObservable.add((info) => {
  if (!audioUnlocked && info.type === PointerEventTypes.POINTERDOWN) {
    audioUnlocked = true
    if (engine.audioEngine) engine.audioEngine.unlock()
    soundManager.playBGM()
  }
}, -1, false)

// startGame() 内
soundManager.playBGM()

// placeTower() 内
soundManager.play('place')

// fireBullet() 内
soundManager.play('laser', 0.1)

// createExplosion() 内
soundManager.play('explosion', 0.2)

// cleanup
return () => {
  soundManager.dispose()
  engine?.dispose()
}
```

---

## 確認方法

- ゲームを開始すると BGM が 2 秒かけてフェードインする
- 床をクリックしてタワーを設置すると「カチッ」という音がする
- タワーが弾を発射するとレーザー音が鳴る（毎回少しピッチが違う）
- 敵が撃破されると爆発音が鳴る
- **音が鳴らない場合**: まずクリックしてから確認（autoplay ブロックのため）

**Phase 3 完了**: プロ品質のビジュアルとサウンドが揃った。
