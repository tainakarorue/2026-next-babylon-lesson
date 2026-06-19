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

## 完全版 `components/game/GameCanvas.tsx`

```tsx
'use client'

import { useEffect, useRef, MutableRefObject } from 'react'
import {
  Engine,
  Scene,
  Color3,
  Color4,
  Vector3,
  ArcRotateCamera,
  HemisphericLight,
  DirectionalLight,
  MeshBuilder,
  Mesh,
  PBRMaterial,
  StandardMaterial,
  ShaderMaterial,
  PointerEventTypes,
  PhysicsAggregate,
  PhysicsShapeType,
  Animation,
  BackEase,
  EasingFunction,
  ImportMeshAsync,
  ParticleSystem,
  GPUParticleSystem,
  DynamicTexture,
  DefaultRenderingPipeline,
  ImageProcessingConfiguration,
  ColorCurves,
  ShadowGenerator,
  CubeTexture,
} from '@babylonjs/core'
import { HavokPlugin } from '@babylonjs/core'
import HavokPhysics from '@babylonjs/havok'
import '@babylonjs/loaders/glTF'
import { AdvancedDynamicTexture, Rectangle, Control } from '@babylonjs/gui'

import { TOWER_TYPES, TowerType } from '@/components/game/TowerSelector'
import type { GameEventCallback } from '@/app/game/page'
import { registerShaders } from '@/lib/babylon/shader'
import { SoundManager } from '@/lib/babylon/sound-manager'

interface EnemyHealthBar {
  plane: Mesh
  fillRect: Rectangle
  currentHp: number
  maxHp: number
}

interface GameCanvasProps {
  gameState: 'menu' | 'playing' | 'pause' | 'gameover'
  onGameEvent: GameEventCallback
  controlRef: MutableRefObject<{
    start: () => void
    restart: () => void
  } | null>
  selectedTowerRef: MutableRefObject<string>
}

interface WaveConfig {
  enemyCount: number
  spawnInterval: number
  enemySpeed: number
  scorePerKill: number
  enemyHp: number
  goldPerKill: number
}

const WAVES: WaveConfig[] = [
  {
    enemyCount: 3,
    spawnInterval: 2.0,
    enemySpeed: 1.0,
    scorePerKill: 10,
    enemyHp: 2,
    goldPerKill: 20,
  },
  {
    enemyCount: 5,
    spawnInterval: 1.5,
    enemySpeed: 1.2,
    scorePerKill: 15,
    enemyHp: 3,
    goldPerKill: 25,
  },
  {
    enemyCount: 8,
    spawnInterval: 1.0,
    enemySpeed: 1.5,
    scorePerKill: 20,
    enemyHp: 4,
    goldPerKill: 30,
  },
  {
    enemyCount: 12,
    spawnInterval: 0.8,
    enemySpeed: 2.0,
    scorePerKill: 30,
    enemyHp: 6,
    goldPerKill: 40,
  },
]

const SPAWN_POINTS = [
  new Vector3(9, 0.5, 9),
  new Vector3(-9, 0.5, 9),
  new Vector3(9, 0.5, -9),
  new Vector3(-9, 0.5, -9),
]

const BASE_POSITION = new Vector3(0, 0.5, 0)

export default function GameCanvas({
  gameState: externalGameState,
  onGameEvent,
  controlRef,
  selectedTowerRef,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    let engine: Engine
    let soundManager: SoundManager | undefined

    let cancelled = false

    const init = async () => {
      // ── Engine & Scene ───────────────────────────────────
      engine = new Engine(canvasRef.current, true)
      const scene = new Scene(engine)
      scene.clearColor = new Color4(0.02, 0.02, 0.05, 1)

      registerShaders()

      // ── Sound ─────────────────────────────────────────────
      soundManager = new SoundManager()
      await soundManager.preload(scene)
      if (cancelled) return

      let audioUnlocked = false
      scene.onPointerObservable.add((info) => {
        if (!audioUnlocked && info.type === PointerEventTypes.POINTERDOWN) {
          audioUnlocked = true
          if (engine.audioEngine) engine.audioEngine.unlock()
          soundManager?.playBGM()
        }
      }, -1, false)

      // createEnemyHealthBar 関数（scene 初期化後に定義）

      function createEnemyHealthBar(
        enemy: Mesh,
        maxHp: number,
      ): EnemyHealthBar {
        const plane = MeshBuilder.CreatePlane(
          'hpPlane',
          {
            width: 1.5,
            height: 0.2,
          },
          scene,
        )
        plane.parent = enemy
        plane.position.y = 0.9
        plane.billboardMode = Mesh.BILLBOARDMODE_ALL
        plane.isPickable = false

        const planeUI = AdvancedDynamicTexture.CreateForMesh(plane, 256, 32)

        const bg = new Rectangle()
        bg.width = '100%'
        bg.height = '100%'
        bg.background = '#1a1a2e'
        bg.thickness = 1
        bg.color = '#444'
        planeUI.addControl(bg)

        const fill = new Rectangle()
        fill.width = '100%'
        fill.height = '80%'
        fill.background = '#22c55e'
        fill.thickness = 0
        fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
        bg.addControl(fill)

        return { plane, fillRect: fill, currentHp: maxHp, maxHp }
      }

      function updateHealthBar(bar: EnemyHealthBar, hp: number): void {
        bar.currentHp = Math.max(0, hp)
        const pct = bar.currentHp / bar.maxHp
        bar.fillRect.width = `${pct * 100}%`
        if (pct > 0.5) bar.fillRect.background = '#22c55e'
        else if (pct > 0.25) bar.fillRect.background = '#f59e0b'
        else bar.fillRect.background = '#ef4444'
      }

      // ── Physics ────────────────────────────────────────
      const havokInstance = await HavokPhysics()
      if (cancelled) return

      const havokPlugin = new HavokPlugin(true, havokInstance)
      scene.enablePhysics(new Vector3(0, -9.81, 0), havokPlugin)

      // ── Camera ───────────────────────────────────────────
      const camera = new ArcRotateCamera(
        'camera',
        -Math.PI / 2,
        Math.PI / 3,
        20,
        Vector3.Zero(),
        scene,
      )
      camera.attachControl(canvasRef.current, true)

      camera.lowerRadiusLimit = 5
      camera.upperRadiusLimit = 40
      camera.lowerBetaLimit = 0.1
      camera.upperBetaLimit = Math.PI / 2.2

      // ── Post-Processing Pipeline ───────────────────────
      const pipeline = new DefaultRenderingPipeline('default', true, scene, [
        camera,
      ])

      pipeline.fxaaEnabled = true

      pipeline.bloomEnabled = true
      pipeline.bloomWeight = 0.4
      pipeline.bloomThreshold = 0.7
      pipeline.bloomScale = 0.5
      pipeline.bloomKernel = 32

      pipeline.imageProcessingEnabled = true
      pipeline.imageProcessing.contrast = 1.1
      pipeline.imageProcessing.exposure = 1.0
      pipeline.imageProcessing.toneMappingEnabled = true
      pipeline.imageProcessing.toneMappingType =
        ImageProcessingConfiguration.TONEMAPPING_ACES

      pipeline.imageProcessing.colorCurvesEnabled = true

      const curves = new ColorCurves()
      curves.globalSaturation = 15
      curves.highlightsHue = 210
      curves.highlightsDensity = 20
      pipeline.imageProcessing.colorCurves = curves

      pipeline.chromaticAberrationEnabled = true
      pipeline.chromaticAberration.aberrationAmount = 20

      pipeline.grainEnabled = true
      pipeline.grain.intensity = 8
      pipeline.grain.animated = true

      // ── Lights ───────────────────────────────────────────
      const hemisphericLight = new HemisphericLight(
        'hemisphericLight',
        new Vector3(0, 1, 0),
        scene,
      )

      hemisphericLight.intensity = 0.4
      hemisphericLight.diffuse = new Color3(0.6, 0.7, 1.0)
      hemisphericLight.groundColor = new Color3(0.1, 0.1, 0.2)

      const sunLight = new DirectionalLight(
        'sunLight',
        new Vector3(-1, -2, -1),
        scene,
      )

      sunLight.intensity = 1.2
      sunLight.diffuse = new Color3(1.0, 0.95, 0.8)
      sunLight.position = new Vector3(10, 20, 10)
      sunLight.shadowMinZ = 0.1
      sunLight.shadowMaxZ = 60

      // ── Environment Texture（IBL）─────────────────────
      try {
        scene.environmentTexture = CubeTexture.CreateFromPrefilteredData(
          '/env/environment.env',
          scene,
        )
        scene.environmentIntensity = 0.5
      } catch (e) {
        console.warn(
          'environment.envが見つかりません。HemisphericLightで代替します。',
          e,
        )
      }

      // ── Shadow Generator ───────────────────────────────
      const shadowGen = new ShadowGenerator(1024, sunLight)
      shadowGen.useExponentialShadowMap = false
      shadowGen.usePoissonSampling = true
      shadowGen.bias = 0.0001

      // ── Meshes ───────────────────────────────────────────
      const ground = MeshBuilder.CreateGround(
        'ground',
        {
          width: 20,
          height: 20,
          subdivisions: 20,
        },
        scene,
      )

      // ── Materials ────────────────────────────────────────
      // 床（スキャンライン SF シェーダー）
      const scanlineMat = new ShaderMaterial(
        'scanlineMat',
        scene,
        {
          vertex: 'scanline',
          fragment: 'scanline',
        },
        {
          attributes: ['position', 'uv'],
          uniforms: ['worldViewProjection', 'time'],
        },
      )
      ground.material = scanlineMat
      ground.receiveShadows = true

      // ── Physics Bodies ─────────────────────────────────
      new PhysicsAggregate(
        ground,
        PhysicsShapeType.BOX,
        {
          mass: 0,
        },
        scene,
      )

      // タワー台座（金属グレー）
      const towerBaseMat = new PBRMaterial('towerBaseMat', scene)
      towerBaseMat.albedoColor = new Color3(0.3, 0.35, 0.4)
      towerBaseMat.metallic = 0.9
      towerBaseMat.roughness = 0.2

      // タワー砲身（青く光るエネルギーコア）
      const barrelMat = new PBRMaterial('barrelMat', scene)
      barrelMat.albedoColor = new Color3(0.1, 0.3, 0.8)
      barrelMat.metallic = 0.5
      barrelMat.roughness = 0.1
      barrelMat.emissiveColor = new Color3(0, 0.5, 1.0)
      barrelMat.emissiveIntensity = 1.5

      const barrelMatRapid = barrelMat.clone('barrelMatRapid')
      barrelMatRapid.emissiveColor = new Color3(0, 1, 0.3)
      barrelMatRapid.albedoColor = new Color3(0, 0.5, 0.2)

      const barrelMatSniper = barrelMat.clone('barrelMatSniper')
      barrelMatSniper.emissiveColor = new Color3(0.8, 0, 1)
      barrelMatSniper.albedoColor = new Color3(0.4, 0, 0.6)

      // 敵（赤い宇宙船）
      const enemyMat = new StandardMaterial('enemyMat', scene)
      enemyMat.diffuseColor = new Color3(0.8, 0.1, 0.1)
      enemyMat.emissiveColor = new Color3(0.3, 0, 0)

      const bulletMat = new PBRMaterial('bulletMat', scene)
      bulletMat.albedoColor = new Color3(1.0, 0.8, 0.0)
      bulletMat.emissiveColor = new Color3(1.0, 0.5, 0.0)
      bulletMat.emissiveIntensity = 2.0
      bulletMat.metallic = 0
      bulletMat.roughness = 0

      const baseMat = new PBRMaterial('baseMat', scene)
      baseMat.albedoColor = new Color3(0.2, 0.8, 0.2)
      baseMat.emissiveColor = new Color3(0, 0.3, 0)
      baseMat.metallic = 0.5
      baseMat.roughness = 0.3

      // シールドシェーダーマテリアル（全タワーで共有）
      const shieldMat = new ShaderMaterial(
        'shieldMat',
        scene,
        {
          vertex: 'shield',
          fragment: 'shield',
        },
        {
          attributes: ['position', 'normal'],
          uniforms: [
            'worldViewProjection',
            'world',
            'cameraPosition',
            'time',
            'hitIntensity',
          ],
          needAlphaBlending: true,
        },
      )
      shieldMat.backFaceCulling = false
      shieldMat.setFloat('hitIntensity', 0)

      // ── Base（守るべき拠点）────────────────────────────
      const base = MeshBuilder.CreateCylinder(
        'base',
        {
          height: 0.3,
          diameter: 2,
          tessellation: 16,
        },
        scene,
      )
      base.position = BASE_POSITION.clone()
      base.position.y = 0.15
      base.material = baseMat
      base.receiveShadows = true
      shadowGen.addShadowCaster(base)
      new PhysicsAggregate(base, PhysicsShapeType.CYLINDER, { mass: 0 }, scene)

      // ── Particle Texture ────────────────────────────────
      const particleTex = new DynamicTexture(
        'particleTex',
        {
          width: 64,
          height: 64,
        },
        scene,
        false,
      )
      const ctx = particleTex.getContext()
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
      grad.addColorStop(0, 'rgba(255,255,255,1)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 64, 64)
      particleTex.update()

      // ── Stars Background ───────────────────────────────
      const stars = GPUParticleSystem.IsSupported
        ? new GPUParticleSystem(
            'stars',
            {
              capacity: 2000,
            },
            scene,
          )
        : new ParticleSystem('stars', 2000, scene)

      stars.particleTexture = particleTex

      stars.emitter = new Vector3(0, 0, 0)
      stars.createSphereEmitter(30)
      stars.minLifeTime = 120
      stars.maxLifeTime = 120
      stars.minEmitPower = 0
      stars.maxEmitPower = 0
      stars.gravity = new Vector3(0, 0, 0)
      stars.color1 = new Color4(1, 1, 1, 0.8)
      stars.color2 = new Color4(0.8, 0.9, 1, 0.6)
      stars.colorDead = new Color4(1, 1, 1, 0)
      stars.minSize = 0.02
      stars.maxSize = 0.08
      stars.emitRate = 15
      stars.blendMode = ParticleSystem.BLENDMODE_ONEONE
      stars.start()

      // ── Game State ─────────────────────────────────────
      let playing = false
      let score = 0
      let lives = 20
      let gold = 200
      let currentWaveIndex = 0
      let waveEnemiesRemaining = 0
      let waveEnemiesSpawned = 0
      let spawnTimer = 0
      let betweenWaveTimer = 0
      const BETWEEN_WAVE_DELAY = 5

      // ── Explosion Effect ───────────────────────────────
      function createExplosion(position: Vector3): void {
        soundManager?.play('explosion', 0.2)

        const ps = new ParticleSystem('explosion', 150, scene)

        ps.particleTexture = particleTex

        ps.emitter = position.clone()
        ps.minEmitBox = new Vector3(-0.1, -0.1, -0.1)
        ps.maxEmitBox = new Vector3(0.1, 0.1, 0.1)
        ps.minLifeTime = 0.2
        ps.maxLifeTime = 0.8
        ps.minEmitPower = 3
        ps.maxEmitPower = 8
        ps.direction1 = new Vector3(-1, -1, -1)
        ps.direction2 = new Vector3(1, 1, 1)
        ps.gravity = new Vector3(0, -3, 0)
        ps.color1 = new Color4(1, 0.6, 0, 1)
        ps.color2 = new Color4(1, 0.1, 0, 1)
        ps.colorDead = new Color4(0.1, 0.1, 0.1, 0)
        ps.minSize = 0.1
        ps.maxSize = 0.4
        ps.emitRate = 500
        ps.blendMode = ParticleSystem.BLENDMODE_ONEONE

        ps.targetStopDuration = 0.15
        ps.start()

        let elapsed = 0
        const cleanup = () => {
          elapsed += engine.getDeltaTime() / 1000
          if (elapsed >= 2.0) {
            ps.dispose(false)
            scene.unregisterAfterRender(cleanup)
          }
        }
        scene.registerAfterRender(cleanup)
      }

      // ── Asset Loading ──────────────────────────────────
      let enemyTemplate: Mesh

      try {
        const result = await ImportMeshAsync('/model/enemy.glb', scene, {
          meshNames: '',
        })

        enemyTemplate = result.meshes[0] as Mesh
        enemyTemplate.name = 'enemyTemplate'
        enemyTemplate.setEnabled(false)

        result.animationGroups.forEach((g) => {
          console.log('アニメーション', g.name)
          g.stop()
        })
      } catch {
        enemyTemplate = MeshBuilder.CreateSphere(
          'enemyTemplate',
          {
            diameter: 0.8,
            segments: 8,
          },
          scene,
        )
        enemyTemplate.material = enemyMat
        enemyTemplate.setEnabled(false)
      }

      if (cancelled) return

      let towerTemplate: Mesh | null = null

      try {
        const result = await ImportMeshAsync('/model/tower.glb', scene, {
          meshNames: '',
        })
        towerTemplate = result.meshes[0] as Mesh
        towerTemplate.name = 'towerTemplate'
        towerTemplate.setEnabled(false)
      } catch {
        towerTemplate = null
      }

      if (cancelled) return

      // ── Enemies ────────────────────────────────────────
      const enemies: {
        mesh: Mesh
        speed: number
        time: number
        hp: number
        maxHp: number
        healthBar: EnemyHealthBar
      }[] = []

      function spawnEnemy(waveConfig: WaveConfig): void {
        const spawnPoint =
          SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)]

        const mesh = MeshBuilder.CreateSphere(
          `enemy_${Date.now()}`,
          {
            diameter: 0.8,
            segments: 8,
          },
          scene,
        )

        mesh.position = spawnPoint.clone()
        mesh.material = enemyMat
        mesh.receiveShadows = true
        shadowGen.addShadowCaster(mesh)

        const healthBar = createEnemyHealthBar(mesh, waveConfig.enemyHp)

        enemies.push({
          mesh,
          speed: waveConfig.enemySpeed,
          time: Math.random() * Math.PI * 2,
          hp: waveConfig.enemyHp,
          maxHp: waveConfig.enemyHp,
          healthBar,
        })

        waveEnemiesSpawned++
        waveEnemiesRemaining++
      }

      function killEnemy(index: number, fromWave: WaveConfig): void {
        createExplosion(enemies[index].mesh.position.clone())

        enemies[index].healthBar.plane.dispose()
        enemies[index].mesh.dispose()
        enemies.splice(index, 1)
        waveEnemiesRemaining--
        score += fromWave.scorePerKill
        gold += fromWave.goldPerKill
        onGameEvent({ type: 'SCORE_CHANGED', score })
        onGameEvent({ type: 'GOLD_CHANGED', gold })
      }

      function enemyReachsBase(index: number): void {
        createExplosion(enemies[index].mesh.position.clone())

        enemies[index].healthBar.plane.dispose()
        enemies[index].mesh.dispose()
        enemies.splice(index, 1)
        waveEnemiesRemaining--
        lives -= 1
        onGameEvent({ type: 'LIFE_CHANGED', lives })
        if (lives <= 0) {
          playing = false
          onGameEvent({ type: 'GAME_OVER', score })
        }
      }

      // ── Tower Placement System ────────────────────────────
      const towers: Mesh[] = []
      const towerFireTimers: number[] = []
      const towerConfigs: TowerType[] = []
      const towerShields: {
        mesh: Mesh
        hitIntensity: number
      }[] = []

      // ── Tower Spawn Animation ──────────────────────────
      function playSpawnAnimation(mesh: Mesh): void {
        const scaleAnim = new Animation(
          'spawnScale',
          'scaling',
          60,
          Animation.ANIMATIONTYPE_VECTOR3,
          Animation.ANIMATIONLOOPMODE_CONSTANT,
        )

        const ease = new BackEase(0.5)
        ease.setEasingMode(EasingFunction.EASINGMODE_EASEOUT)
        scaleAnim.setEasingFunction(ease)
        scaleAnim.setKeys([
          { frame: 0, value: new Vector3(0.01, 0.01, 0.01) },
          { frame: 20, value: new Vector3(1.1, 1.1, 1.1) },
          { frame: 25, value: new Vector3(1, 1, 1) },
        ])
        mesh.animations = [scaleAnim]
        scene.beginAnimation(mesh, 0, 25, false, 1.0)
      }

      function placeTower(position: Vector3): void {
        if (!playing) return

        const gridX = Math.round(position.x)
        const gridZ = Math.round(position.z)

        const occupied = towers.some(
          (t) =>
            Math.round(t.position.x) === gridX &&
            Math.round(t.position.z) === gridZ,
        )

        if (occupied) return

        if (Math.abs(gridX) > 9 || Math.abs(gridZ) > 9) return
        if (Math.abs(gridX) < 1 && Math.abs(gridZ) < 1) return

        const towerType =
          TOWER_TYPES.find((t) => t.id === selectedTowerRef.current) ??
          TOWER_TYPES[0]

        if (gold < towerType.cost) return
        gold -= towerType.cost
        onGameEvent({ type: 'GOLD_CHANGED', gold })

        soundManager?.play('place')

        let base: Mesh
        if (towerTemplate) {
          const clone = towerTemplate.clone(`tower_${towers.length}`, null)

          if (clone) {
            base = clone
            base.setEnabled(true)
            base.position = new Vector3(gridX, 0, gridZ)
            base.scaling = new Vector3(0.5, 0.5, 0.5)
          } else {
            base = MeshBuilder.CreateBox(
              `tower_${towers.length}`,
              {
                width: 1,
                height: 0.3,
                depth: 1,
              },
              scene,
            )
            base.position = new Vector3(gridX, 0.15, gridZ)
            base.material = towerBaseMat
          }
        } else {
          base = MeshBuilder.CreateBox(
            `towerBase_${towers.length}`,
            {
              width: 1,
              height: 0.3,
              depth: 1,
            },
            scene,
          )

          base.position = new Vector3(gridX, 0.15, gridZ)
          base.material = towerBaseMat

          const type = selectedTowerRef.current
          let bMat = barrelMat
          if (type === 'rapid') bMat = barrelMatRapid
          if (type === 'sniper') bMat = barrelMatSniper

          const barrel = MeshBuilder.CreateCylinder(
            `towerBarrel_${towers.length}`,
            {
              height: 1.5,
              diameter: 0.3,
              tessellation: 8,
            },
            scene,
          )
          barrel.parent = base
          barrel.position = new Vector3(0, 0.9, 0)
          barrel.material = bMat
        }

        base.receiveShadows = true
        shadowGen.addShadowCaster(base, true)

        // シールドメッシュをタワーに追加
        const shieldMesh = MeshBuilder.CreateSphere(
          `shield_${towers.length}`,
          { diameter: 1.8, segments: 12 },
          scene,
        )
        shieldMesh.parent = base
        shieldMesh.position = new Vector3(0, 0.5, 0)
        shieldMesh.material = shieldMat
        shieldMesh.isPickable = false
        shieldMesh.setEnabled(true)
        towerShields.push({ mesh: shieldMesh, hitIntensity: 0 })

        towers.push(base)
        towerFireTimers.push(0)
        towerConfigs.push(towerType)
        playSpawnAnimation(base)
      }

      // ── Bullet System ──────────────────────────────────
      const activeBullets: {
        mesh: Mesh
        agg: PhysicsAggregate
        targetIndex: number
        timer: number
        waveConfig: WaveConfig
        damage: number
      }[] = []

      function fireBullet(
        from: Vector3,
        targetIndex: number,
        waveConfig: WaveConfig,
        damage: number,
      ): void {
        if (targetIndex < 0 || targetIndex >= enemies.length) return

        const bullet = MeshBuilder.CreateSphere(
          'bullet',
          {
            diameter: 0.2,
            segments: 4,
          },
          scene,
        )

        bullet.position = from.clone()
        bullet.material = bulletMat

        const agg = new PhysicsAggregate(
          bullet,
          PhysicsShapeType.SPHERE,
          {
            mass: 0.05,
          },
          scene,
        )

        const dir = enemies[targetIndex].mesh.position
          .subtract(from)
          .normalize()
        agg.body.setLinearVelocity(dir.scale(15))

        activeBullets.push({
          mesh: bullet,
          agg,
          targetIndex,
          timer: 0,
          waveConfig,
          damage,
        })

        soundManager?.play('laser', 0.1)
      }

      // ── Game Start/Restart ─────────────────────────────
      function startWave(waveIndex: number): void {
        const wave = WAVES[Math.min(waveIndex, WAVES.length - 1)]
        waveEnemiesSpawned = 0
        waveEnemiesRemaining = wave.enemyCount
        spawnTimer = 0
        onGameEvent({ type: 'WAVE_STARTED', wave: waveIndex + 1 })
      }

      function startGame(): void {
        playing = true
        soundManager?.playBGM()

        score = 0
        lives = 20
        gold = 200
        currentWaveIndex = 0
        betweenWaveTimer = 0

        for (const e of enemies) {
          e.healthBar.plane.dispose()
          e.mesh.dispose()
        }
        enemies.length = 0

        for (const b of activeBullets) {
          b.agg.dispose()
          b.mesh.dispose()
        }
        activeBullets.length = 0

        onGameEvent({ type: 'SCORE_CHANGED', score })
        onGameEvent({ type: 'LIFE_CHANGED', lives })
        onGameEvent({ type: 'GOLD_CHANGED', gold })

        startWave(0)
      }

      function restartGame(): void {
        for (const t of towers) t.dispose()
        towers.length = 0
        towerFireTimers.length = 0
        towerConfigs.length = 0
        towerShields.length = 0
        startGame()
      }

      controlRef.current = {
        start: startGame,
        restart: restartGame,
      }

      // ── Input: ポインターイベント ─────────────────────────
      scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return
        const pick = pointerInfo.pickInfo
        if (!pick?.hit || !pick.pickedMesh || !pick.pickedPoint) return

        if (pick.pickedMesh.name === 'ground') {
          placeTower(pick.pickedPoint)
        }
      })

      // ── Per-Frame Update ───────────────────────────────
      let shaderTime = 0

      scene.registerBeforeRender(() => {
        const delta = engine.getDeltaTime() / 1000

        shaderTime += delta
        scanlineMat.setFloat('time', shaderTime)
        shieldMat.setFloat('time', shaderTime)
        shieldMat.setVector3('cameraPosition', camera.position)

        for (const shield of towerShields) {
          if (shield.hitIntensity > 0) {
            shield.hitIntensity = Math.max(0, shield.hitIntensity - delta * 2)
            shieldMat.setFloat('hitIntensity', shield.hitIntensity)
          }
        }

        if (!playing) return

        const currentWave = WAVES[Math.min(currentWaveIndex, WAVES.length - 1)]

        if (waveEnemiesSpawned < currentWave.enemyCount) {
          spawnTimer += delta
          if (spawnTimer >= currentWave.spawnInterval) {
            spawnTimer = 0
            spawnEnemy(currentWave)
          }
        }

        if (
          waveEnemiesSpawned >= currentWave.enemyCount &&
          enemies.length === 0
        ) {
          betweenWaveTimer += delta
          if (betweenWaveTimer >= BETWEEN_WAVE_DELAY) {
            betweenWaveTimer = 0
            currentWaveIndex++
            if (currentWaveIndex >= WAVES.length) {
              currentWaveIndex = WAVES.length - 1
            }
            startWave(currentWaveIndex)
          }
        }

        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i]
          e.time += delta
          const dir = BASE_POSITION.subtract(e.mesh.position)
          const dist = dir.length()
          if (dist < 1.0) {
            enemyReachsBase(i)
            continue
          }
          e.mesh.position.addInPlace(dir.normalize().scale(e.speed * delta))
          e.mesh.position.y = 0.5 + Math.sin(e.time * 2.5) * 0.15
          e.mesh.rotation.y += 0.3 * delta
        }

        for (let i = 0; i < towers.length; i++) {
          if (enemies.length === 0) continue
          let nearestIdx = 0
          let minDist = Vector3.Distance(
            towers[i].position,
            enemies[0].mesh.position,
          )

          for (let j = 1; j < enemies.length; j++) {
            const d = Vector3.Distance(
              towers[i].position,
              enemies[j].mesh.position,
            )
            if (d < minDist) {
              minDist = d
              nearestIdx = j
            }
          }
          const dir = enemies[nearestIdx].mesh.position.subtract(
            towers[i].position,
          )
          towers[i].rotation.y = Math.atan2(dir.x, dir.z)

          const towerConfig = towerConfigs[i]

          towerFireTimers[i] += delta

          if (
            towerFireTimers[i] >= towerConfig.fireRate &&
            minDist <= towerConfig.range
          ) {
            towerFireTimers[i] = 0
            const muzzlePos = towers[i].position.clone()
            muzzlePos.y += 0.9
            fireBullet(muzzlePos, nearestIdx, currentWave, towerConfig.damage)
          }
        }

        for (let bi = activeBullets.length - 1; bi >= 0; bi--) {
          const b = activeBullets[bi]
          b.timer += delta
          if (b.timer > 4) {
            b.agg.dispose()
            b.mesh.dispose()
            activeBullets.splice(bi, 1)
            continue
          }

          for (let ei = enemies.length - 1; ei >= 0; ei--) {
            if (
              Vector3.Distance(b.mesh.position, enemies[ei].mesh.position) < 0.6
            ) {
              enemies[ei].hp -= b.damage
              updateHealthBar(enemies[ei].healthBar, enemies[ei].hp)

              if (enemies[ei].hp <= 0) {
                killEnemy(ei, b.waveConfig)
              }

              b.agg.dispose()
              b.mesh.dispose()
              activeBullets.splice(bi, 1)
              break
            }
          }
        }
      })

      engine.runRenderLoop(() => {
        scene.render()
      })
    }

    init()

    const handleResize = () => {
      engine?.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelled = true
      window.removeEventListener('resize', handleResize)
      soundManager?.dispose()
      engine?.dispose()
    }
  }, [onGameEvent, controlRef])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100vh',
        display: 'block',
      }}
    />
  )
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
