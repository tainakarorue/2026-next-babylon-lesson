# NEBULA DEFENSE — 拡張・アップデートロードマップ

このドキュメントは L01〜L25 のコースを完了した後、NEBULA DEFENSE をさらに発展させるためのロードマップです。
各テーマは独立しており、興味のある順に取り組めます。

---

## 目次

1. [ゲームプレイの拡張](#1-ゲームプレイの拡張)
2. [敵システムの強化](#2-敵システムの強化)
3. [タワーシステムの拡張](#3-タワーシステムの拡張)
4. [ビジュアル・演出の強化](#4-ビジュアル演出の強化)
5. [マップ・ステージの拡張](#5-マップステージの拡張)
6. [UI/UX の改善](#6-uiux-の改善)
7. [マルチプレイヤーの強化](#7-マルチプレイヤーの強化)
8. [データ・分析基盤](#8-データ分析基盤)
9. [モバイル対応](#9-モバイル対応)
10. [次世代技術への移行](#10-次世代技術への移行)

---

## 1. ゲームプレイの拡張

### 1-A. スキルツリー / アップグレードシステム

プレイヤーがゴールドを使ってタワーを強化できる仕組み。

```
基本タワー (Lv.1)
  ├─ 射程強化 → 射程 +30% (Lv.2)
  │    └─ 範囲攻撃 → 爆発弾 (Lv.3)
  └─ 速射強化 → 発射速度 +50% (Lv.2)
       └─ 連射砲 → 3連射 (Lv.3)
```

**実装ポイント**:
- タワーをクリックすると upgrade UI が出る
- `TowerData` に `level: 1 | 2 | 3` と `upgradeCount` を追加
- 各レベルの stat は `TOWER_UPGRADES[type][level]` テーブルで管理
- Zustand の `upgradeTower(id, path)` アクションで状態管理

**関連ファイル**: `components/game/TowerUpgradePanel.tsx`, `lib/babylon/tower-types.ts`

---

### 1-B. 英雄ユニット（ヒーロー）

プレイヤーが操作できる特殊ユニット。タワーを設置するだけでなく直接戦闘に参加できる。

```typescript
interface HeroConfig {
  name: 'COMMANDER' | 'ENGINEER' | 'SNIPER'
  moveSpeed: number
  attackDamage: number
  attackRange: number
  skill: {
    name: string
    cooldown: number     // 秒
    effect: SkillEffect
  }
}
```

**実装ポイント**:
- WASD でヒーローを移動（`scene.actionManager` + deltaTime)
- クリックで攻撃対象を指定（`scene.onPointerObservable` + raycast）
- スキルはスペースキーで発動、`SkillCooldownBar` コンポーネントで表示

---

### 1-C. ウェーブエディター

プレイヤー自身がウェーブをカスタマイズして友人と共有できる機能。

```typescript
interface CustomWaveConfig {
  waves: Array<{
    enemies: Array<{ type: EnemyType; count: number; spawnInterval: number }>
    delay: number  // 前のウェーブからの待機時間
  }>
  shareCode: string  // Base64 エンコードされた設定
}
```

**実装ポイント**:
- `btoa(JSON.stringify(config))` でシェアコードを生成
- URL パラメータ `?wave=<code>` でロード
- `components/game/WaveEditor.tsx` でドラッグ&ドロップ UI

---

### 1-D. サバイバルモード / エンドレスモード

クリア条件のない無限ウェーブ。スコアを競うリーダーボード用途。

```typescript
// ウェーブが進むにつれて自動スケール
function getWaveConfig(wave: number): WaveConfig {
  const scale = 1 + (wave - 1) * 0.15
  return {
    enemyCount: Math.floor(5 * scale),
    enemyHp: Math.floor(30 * scale),
    enemySpeed: Math.min(4 + wave * 0.1, 8),
    spawnInterval: Math.max(2.0 - wave * 0.05, 0.5),
    scorePerKill: 10 + wave * 2,
  }
}
```

---

## 2. 敵システムの強化

### 2-A. 新しい敵タイプ

| 敵タイプ | 特徴 | 対策 |
|----------|------|------|
| `ARMORED` | 物理ダメージ 50% 軽減 | エネルギータワーが有効 |
| `FAST` | 移動速度 3×、HP 低め | 連射タワーが必要 |
| `HEALER` | 周囲の敵を毎秒 5HP 回復 | 優先ターゲット指定 |
| `SPLITTER` | 死亡時に小型 2 体に分裂 | 範囲攻撃で対処 |
| `FLYING` | 地上の障害物を無視、A* 不使用 | 対空タワーのみ有効 |
| `BOSS` | HP 1000+、特殊攻撃、フェーズ変化 | タワーの総力戦 |
| `STEALTH` | タワーのロックオン不可、一定距離に近づくと可視化 | 索敵タワーが必要 |
| `SHIELD` | バリアを纏う、特定の攻撃でのみ破壊可能 | シールドブレイカータワー |

**実装ポイント**:
- `EnemyType` union 型に追加
- `EnemyBehavior` インターフェースで特殊ロジックを分離
- `FLYING` タイプは GridMap を使わず直線移動 + 高度 `y = 2.0`

---

### 2-B. ボス戦フェーズシステム

```typescript
interface BossPhase {
  hpThreshold: number    // 最大 HP の何 % を切ったら移行
  speedMultiplier: number
  newAbilities: BossAbility[]
  visualChange: {
    emissiveColor: Color3
    scaleMultiplier: number
  }
}

const BOSS_PHASES: BossPhase[] = [
  { hpThreshold: 1.0, speedMultiplier: 1.0, newAbilities: ['CHARGE'], visualChange: { emissiveColor: Color3.Red(), scaleMultiplier: 1.0 } },
  { hpThreshold: 0.5, speedMultiplier: 1.3, newAbilities: ['CHARGE', 'SPAWN_MINIONS'], visualChange: { emissiveColor: new Color3(1, 0.5, 0), scaleMultiplier: 1.2 } },
  { hpThreshold: 0.2, speedMultiplier: 1.8, newAbilities: ['CHARGE', 'SPAWN_MINIONS', 'SHIELD'], visualChange: { emissiveColor: new Color3(0.5, 0, 1), scaleMultiplier: 1.5 } },
]
```

---

### 2-C. 敵の編隊 AI（フォーメーション）

複数の敵が隊列を組んで移動する。

```typescript
interface FormationConfig {
  type: 'LINE' | 'V_SHAPE' | 'CIRCLE' | 'RANDOM_CLUSTER'
  spacing: number
  leaderIndex: number
}
```

**実装ポイント**:
- リーダーが A* で経路を計算
- フォロワーは `leaderPosition + offset` を目標に移動
- フォーメーション破壊時（リーダー死亡）は各自が A* に移行

---

## 3. タワーシステムの拡張

### 3-A. 新しいタワータイプ

| タワー | 特性 | 対象 |
|--------|------|------|
| `FREEZE` | 敵の速度を 50% 低下（既存） | 地上 |
| `LASER` | 連続ダメージ、貫通 | 地上・飛行 |
| `MORTAR` | 遅延着弾、範囲ダメージ | 地上 |
| `EMP` | 一定範囲の敵を 3 秒スタン | 地上・飛行 |
| `RADAR` | ステルス敵を可視化（攻撃なし） | - |
| `RELAY` | 隣接タワーの射程 +20% | - |
| `TESLA` | 敵にチェーンする電撃 | 地上 |
| `BLACK_HOLE` | 敵を中心に引き寄せ、圧縮ダメージ | 地上・飛行 |

**実装ポイント**:
- `LASER`: `RayHelper` + per-frame のレイキャストでダメージ計算
- `MORTAR`: `setTimeout` で着弾遅延、`MeshBuilder.CreateSphere` で着弾エフェクト
- `RELAY`: 配置時に隣接タワーを検索し `range *= 1.2` を適用

---

### 3-B. タワーの配置制限とシナジー

```typescript
// タワーの組み合わせボーナス
const SYNERGIES = [
  {
    towers: ['freeze', 'sniper'],
    bonus: 'FROZEN_AMPLIFY',  // 凍結した敵へのダメージ 2×
    description: '凍結した敵に狙撃でクリティカル',
  },
  {
    towers: ['relay', 'mortar'],
    bonus: 'EXTENDED_RANGE',  // 迫撃砲の射程が大幅拡張
    description: '中継タワーで迫撃砲の射程を最大化',
  },
]
```

---

### 3-C. タワーのターゲット優先度設定

```typescript
type TargetPriority =
  | 'FIRST'    // 最も拠点に近い敵
  | 'LAST'     // 最も遠い敵
  | 'STRONGEST' // HP が最も高い敵
  | 'WEAKEST'  // HP が最も低い敵（確実に倒す）
  | 'FASTEST'  // 最も速い敵
```

UI: タワーをクリック → ターゲット優先度ドロップダウン

---

## 4. ビジュアル・演出の強化

### 4-A. カメラ演出

```typescript
// ダメージを受けたときのカメラシェイク
function cameraShake(camera: ArcRotateCamera, intensity: number, duration: number): void {
  const originalTarget = camera.target.clone()
  let elapsed = 0
  const observer = scene.onBeforeRenderObservable.add(() => {
    elapsed += scene.getEngine().getDeltaTime() / 1000
    if (elapsed > duration) {
      camera.target = originalTarget
      scene.onBeforeRenderObservable.remove(observer)
      return
    }
    const decay = 1 - elapsed / duration
    camera.target.x = originalTarget.x + (Math.random() - 0.5) * intensity * decay
    camera.target.y = originalTarget.y + (Math.random() - 0.5) * intensity * decay
  })
}

// ボス登場時のドラマティックズームイン
async function bossCutscene(boss: Mesh): Promise<void> {
  const originalAlpha = camera.alpha
  const originalBeta = camera.beta
  const originalRadius = camera.radius

  await new Promise<void>(resolve => {
    const anim = new Animation('bossZoom', 'radius', 60, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_ONCE)
    anim.setKeys([
      { frame: 0, value: camera.radius },
      { frame: 60, value: 8 },
      { frame: 90, value: 20 },
    ])
    scene.beginAnimation(camera, 0, 90, false, 1, resolve)
    camera.animations = [anim]
  })
}
```

---

### 4-B. 環境エフェクト

**ネビュラ背景（星雲）**:
```typescript
// 複数レイヤーの GPU パーティクルで奥行きのある星空
function createNebula(scene: Scene): void {
  const colors = [
    new Color4(0.2, 0.3, 0.8, 0.3),  // 青い星雲
    new Color4(0.5, 0.1, 0.6, 0.2),  // 紫の星雲
    new Color4(0.8, 0.4, 0.1, 0.15), // オレンジの星雲
  ]

  colors.forEach((color, i) => {
    const ps = new GPUParticleSystem(`nebula_${i}`, { capacity: 2000 }, scene)
    ps.emitter = new Vector3(0, 0, 0)
    ps.createSphereEmitter(50 + i * 10)
    ps.color1 = color
    ps.minSize = 0.3
    ps.maxSize = 1.5 + i
    ps.minLifeTime = 999
    ps.maxLifeTime = 999
    ps.emitRate = 0  // 一度だけ emit
    ps.start()
    ps.manualEmitCount = 2000
  })
}
```

**隕石シャワー（危険ゾーンイベント）**:
```typescript
// ランダムな位置に隕石が落下し、着弾範囲内の敵にダメージ
function meteorShower(scene: Scene, count: number): void {
  for (let i = 0; i < count; i++) {
    setTimeout(() => spawnMeteor(scene), i * 300)
  }
}
```

---

### 4-C. LOD（Level of Detail）

遠くの敵は低ポリゴンメッシュに切り替えてパフォーマンスを維持：

```typescript
import { LOD } from '@babylonjs/core'

const enemyHigh = await SceneLoader.ImportMeshAsync('', '/models/', 'enemy.glb', scene)
const enemyLow = MeshBuilder.CreateSphere('enemyLow', { diameter: 1, segments: 4 }, scene)

enemyHigh.meshes[0].addLODLevel(15, enemyLow.meshes[0])  // 距離 15 以上で低ポリゴン
enemyHigh.meshes[0].addLODLevel(30, null)                  // 距離 30 以上で非表示
```

---

### 4-D. デストラクティブ環境

敵の攻撃や爆発でマップが変形する演出：

```typescript
// 爆発でグラウンドにクレーター（ディスプレイスメント）
function createCrater(position: Vector3, scene: Scene): void {
  const crater = MeshBuilder.CreateDisc('crater', { radius: 1.5, tessellation: 16 }, scene)
  crater.rotation.x = Math.PI / 2
  crater.position = new Vector3(position.x, 0.01, position.z)

  const mat = new PBRMaterial('craterMat', scene)
  mat.albedoColor = new Color3(0.1, 0.08, 0.07)
  mat.roughness = 1.0
  crater.material = mat

  // フェードイン
  crater.visibility = 0
  const anim = new Animation('fade', 'visibility', 60, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_ONCE)
  anim.setKeys([{ frame: 0, value: 0 }, { frame: 15, value: 0.8 }])
  crater.animations = [anim]
  scene.beginAnimation(crater, 0, 15, false)
}
```

---

## 5. マップ・ステージの拡張

### 5-A. 新ステージアイデア

| ステージ名 | コンセプト | 特殊ルール |
|-----------|-----------|-----------|
| `ASTEROID_FIELD` | 浮遊する隕石の間を敵が飛行 | 重力 0、敵はすべて `FLYING` タイプ |
| `WORMHOLE` | ワームホール入口から出口へテレポート | A* がワームホールを経由点として扱う |
| `VOLCANIC` | 溶岩がタイマーで噴出し、通路が変化 | 定期的に `setWalkable()` が更新される |
| `ICE_PLANET` | 敵が滑る（慣性あり移動） | `velocity` ベクターで物理的移動 |
| `MIRROR` | マップが 2 軸対称、1 人が左半分を担当 | マルチプレイヤー専用 |

---

### 5-B. 動的マップイベント

```typescript
type MapEvent =
  | { type: 'BRIDGE_COLLAPSE'; position: Vector3 }  // 橋が崩れ通路が塞がる
  | { type: 'SUPPLY_DROP'; gold: number }            // 補給物資が落下
  | { type: 'SOLAR_FLARE'; disabledSeconds: number } // 全タワーが一時停止
  | { type: 'REINFORCEMENTS'; count: number }        // 援軍ユニットが降下

// ウェーブ間にランダムイベントを発生させる
function triggerRandomEvent(scene: Scene, onEvent: (e: MapEvent) => void): void {
  const events: MapEvent[] = [
    { type: 'SUPPLY_DROP', gold: 50 },
    { type: 'SOLAR_FLARE', disabledSeconds: 5 },
    { type: 'REINFORCEMENTS', count: 2 },
  ]
  const event = events[Math.floor(Math.random() * events.length)]
  onEvent(event)
}
```

---

### 5-C. マップエディター

プレイヤーが自分でマップを作成し、シェアコードで配布できる機能。

```typescript
interface CustomMapData {
  name: string
  author: string
  size: number
  tiles: Array<{
    x: number
    z: number
    type: 'WALL' | 'TOWER_ZONE' | 'PATH'
  }>
  spawnPoints: Array<{ x: number; z: number }>
  basePosition: { x: number; z: number }
  version: 1
}
```

**実装ポイント**:
- グリッドをクリックしてタイル種別を切り替える編集 UI
- `JSON.stringify` → `btoa` でシェアコード生成
- A* で経路が存在するかバリデーション（クリア不可能なマップを防ぐ）

---

## 6. UI/UX の改善

### 6-A. チュートリアルシステム

```typescript
interface TutorialStep {
  id: string
  message: string
  highlightElement?: string   // CSS セレクタ or Babylon.js mesh 名
  trigger: 'AUTO' | 'ACTION'  // 自動進行 or プレイヤーの行動で進む
  action?: {
    type: 'PLACE_TOWER' | 'START_WAVE' | 'CLICK_MESH'
    target?: string
  }
}

const TUTORIAL_STEPS: TutorialStep[] = [
  { id: 'welcome',      message: 'NEBULA DEFENSE へようこそ！拠点を守りましょう。', trigger: 'AUTO' },
  { id: 'place_tower',  message: 'グリッド上をクリックしてタワーを設置してください。', trigger: 'ACTION', action: { type: 'PLACE_TOWER' } },
  { id: 'start_wave',   message: '準備ができたらウェーブを開始しましょう！', trigger: 'ACTION', action: { type: 'START_WAVE' } },
]
```

---

### 6-B. ミニマップ

```typescript
// Canvas 2D でミニマップを描画
function renderMinimap(
  ctx: CanvasRenderingContext2D,
  enemies: EnemyData[],
  towers: TowerData[],
  mapSize: number
): void {
  const scale = ctx.canvas.width / mapSize

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.fillStyle = 'rgba(0,0,20,0.8)'
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  // タワー（青点）
  for (const tower of towers) {
    ctx.fillStyle = '#4488ff'
    ctx.fillRect(
      (tower.position.x + mapSize / 2) * scale - 2,
      (tower.position.z + mapSize / 2) * scale - 2,
      4, 4
    )
  }

  // 敵（赤点）
  for (const enemy of enemies) {
    ctx.fillStyle = '#ff4444'
    ctx.beginPath()
    ctx.arc(
      (enemy.mesh.position.x + mapSize / 2) * scale,
      (enemy.mesh.position.z + mapSize / 2) * scale,
      3, 0, Math.PI * 2
    )
    ctx.fill()
  }

  // 拠点（白四角）
  ctx.strokeStyle = '#ffffff'
  ctx.strokeRect(
    (mapSize / 2 - 0.5) * scale,
    (mapSize / 2 - 0.5) * scale,
    scale, scale
  )
}
```

**実装**: `<canvas>` 要素を overlay として配置、`useRef` でアクセスし毎フレーム描画

---

### 6-C. ゲームスピードコントロール

```typescript
// Babylon.js のシミュレーション速度を変更
function setGameSpeed(scene: Scene, multiplier: 1 | 2 | 4): void {
  scene.getEngine().timeScale = multiplier
  // または
  scene.animationTimeScale = multiplier
}
```

ウェーブ中に 1×/2×/4× ボタンで切り替え

---

### 6-D. タワー配置のプレビュー

タワーを選択中、マウスホバー位置に半透明のプレビューを表示：

```typescript
// マウス移動でプレビュー位置を更新
scene.onPointerObservable.add((info) => {
  if (info.type !== PointerEventTypes.POINTERMOVE) return
  if (!selectedTower) { previewMesh.setEnabled(false); return }

  const ray = scene.createPickingRay(scene.pointerX, scene.pointerY, Matrix.Identity(), camera)
  const hit = scene.pickWithRay(ray, m => m === ground)
  if (!hit?.pickedPoint) return

  const x = Math.round(hit.pickedPoint.x)
  const z = Math.round(hit.pickedPoint.z)
  previewMesh.position.set(x, 0.5, z)
  previewMesh.setEnabled(true)

  // 配置可能か判定（色で表示）
  const canPlace = !towers.some(t => t.position.x === x && t.position.z === z)
  previewMat.albedoColor = canPlace ? new Color3(0, 1, 0.5) : new Color3(1, 0.2, 0.2)
  previewMat.alpha = 0.5
})
```

---

## 7. マルチプレイヤーの強化

### 7-A. 非同期協力（非リアルタイム）

同期の難しさを回避しつつ協力プレイを実現：

```
プレイヤー A が「ランダムマップ」をシェアコードで共有
→ プレイヤー B が同じシード値でローカルでプレイ
→ クリアタイムやスコアを比較して競う（非同期ランキング）
```

---

### 7-B. スペクテーター機能

観戦者が他プレイヤーのゲームをリアルタイムで見る機能：

```typescript
// サーバー側：全ゲーム状態をスペクテーターに送信
case 'SPECTATE_ROOM': {
  const room = rooms.get(msg.roomId as string)
  if (!room) { ws.send(JSON.stringify({ type: 'ERROR', message: 'Room not found' })); return }
  spectators.set(playerId, { ws, roomId: msg.roomId as string })
  ws.send(JSON.stringify({ type: 'SPECTATING', roomId: msg.roomId, state: getRoomState(room) }))
  break
}
```

---

### 7-C. ランキングシステム（バックエンド）

```typescript
// Vercel KV（Redis）でリーダーボード管理
import { kv } from '@vercel/kv'

// スコア登録
await kv.zadd('leaderboard:nebula-alpha', { score, member: playerName })

// Top 10 取得
const top10 = await kv.zrange('leaderboard:nebula-alpha', 0, 9, { rev: true, withScores: true })
```

**実装ポイント**:
- `app/api/score/route.ts` で POST エンドポイントを作成
- `app/api/leaderboard/route.ts` で GET エンドポイントを作成
- `components/game/Leaderboard.tsx` で表示

---

## 8. データ・分析基盤

### 8-A. プレイログの収集

```typescript
interface PlayEvent {
  sessionId: string
  timestamp: number
  type:
    | 'GAME_START'
    | 'WAVE_START'
    | 'TOWER_PLACED'
    | 'ENEMY_KILLED'
    | 'LIFE_LOST'
    | 'GAME_OVER'
    | 'LEVEL_CLEAR'
  payload: Record<string, unknown>
}
```

**送信先の選択肢**:
- Vercel Analytics（PV/UU のみ、無料）
- PostHog（詳細イベント、OSS / セルフホスト可）
- Amplitude（ゲーム分析に強い）

---

### 8-B. A/B テスト

```typescript
// 初期ゴールドを 150 vs 200 でテスト
const variant = Math.random() < 0.5 ? 'A' : 'B'
const startGold = variant === 'A' ? 150 : 200

// 結果を記録
logEvent({ type: 'GAME_START', payload: { variant, startGold } })
```

---

### 8-C. リプレイシステム

ゲームの全操作を記録して再生する機能（シード + 操作ログで完全再現）：

```typescript
interface ReplayData {
  seed: number
  levelId: string
  version: string  // ゲームバージョン（互換性チェック）
  events: Array<{
    tick: number           // フレーム番号（deltaTime 積算値）
    type: 'PLACE_TOWER' | 'START_WAVE' | 'UPGRADE_TOWER'
    payload: Record<string, unknown>
  }>
}
```

**実装ポイント**:
- PRNG が決定論的なため、同じシードで同じ敵の動きが再現される
- プレイヤーの操作 (`type: 'PLACE_TOWER'` 等) だけを記録
- リプレイ時は `tick` に合わせてイベントをリプレイ

---

## 9. モバイル対応

### 9-A. タッチ操作

```typescript
// ピンチでズーム
let initialPinchDistance = 0

canvas.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    initialPinchDistance = Math.sqrt(dx * dx + dy * dy)
  }
})

canvas.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    const dist = Math.sqrt(dx * dx + dy * dy)
    camera.radius *= initialPinchDistance / dist
    initialPinchDistance = dist
  }
})
```

---

### 9-B. モバイル向けパフォーマンス設定

```typescript
const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent)

const qualityPresets = {
  mobile: {
    shadowMapSize: 512,
    bloomEnabled: false,
    maxParticles: 500,
    shadowsEnabled: false,
  },
  desktop: {
    shadowMapSize: 1024,
    bloomEnabled: true,
    maxParticles: 2000,
    shadowsEnabled: true,
  },
}

const preset = isMobile ? qualityPresets.mobile : qualityPresets.desktop
```

---

### 9-C. PWA（Progressive Web App）対応

```json
// public/manifest.json
{
  "name": "NEBULA DEFENSE",
  "short_name": "NEBULA",
  "start_url": "/game",
  "display": "fullscreen",
  "orientation": "landscape",
  "background_color": "#000000",
  "theme_color": "#000011",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

```typescript
// next.config.ts で PWA を有効化
// npm install next-pwa
const withPWA = require('next-pwa')({ dest: 'public' })
export default withPWA(nextConfig)
```

---

## 10. 次世代技術への移行

### 10-A. WebGPU への移行

```typescript
// WebGPU が使えるか確認してから Engine を選択
async function createEngine(canvas: HTMLCanvasElement) {
  if (await WebGPUEngine.IsSupportedAsync) {
    const engine = new WebGPUEngine(canvas)
    await engine.initAsync()
    return engine
  }
  return new Engine(canvas, true)
}
```

**WebGPU で追加できる機能**:
- Compute Shader で GPU 上の物理演算（数千体の敵）
- Ray Tracing（将来の仕様）

---

### 10-B. WebXR（VR モード）

```typescript
// VR モードのトグルボタン
async function toggleVR(scene: Scene): Promise<void> {
  const xr = await scene.createDefaultXRExperienceAsync({
    floorMeshes: [ground],
    optionalFeatures: true,
  })

  if (xr.baseExperience.state !== WebXRState.IN_XR) {
    await xr.baseExperience.enterXRAsync('immersive-vr', 'local-floor')
  } else {
    await xr.baseExperience.exitXRAsync()
  }
}
```

---

### 10-C. Babylon Native / React Native

```
Web版の Babylon.js コードを
ほぼそのままモバイルアプリに転用できる

npm install @babylonjs/react-native

→ iOS App Store / Google Play で配信可能
```

---

## 優先度別ロードマップ

開発リソースが限られている場合の推奨実装順：

### Short Term（〜1 ヶ月）
1. **タワーアップグレードシステム** (1-A) — ゲームの深みが一番増す
2. **ターゲット優先度設定** (3-C) — 戦略性が向上
3. **タワー配置プレビュー** (6-D) — UX が大幅改善
4. **ミニマップ** (6-B) — 視認性が向上

### Mid Term（1〜3 ヶ月）
5. **新しい敵タイプ** (2-A) — FLYING, ARMORED, BOSS
6. **ボス戦フェーズ** (2-B) — ゲームのクライマックス
7. **新タワータイプ** (3-A) — LASER, MORTAR
8. **サバイバルモード** (1-D) — リプレイ性が向上

### Long Term（3 ヶ月〜）
9. **リーダーボード** (7-C) — コミュニティ形成
10. **マップエディター** (5-C) — UGC エコシステム
11. **PWA 対応** (9-C) — インストール不要なモバイル体験
12. **WebXR** (10-B) — 差別化要素

---

## 技術的な負債を防ぐために

拡張を進める前に以下を確認する：

```bash
# 型チェック（毎機能追加後）
npx tsc --noEmit

# テストカバレッジ（新ロジックにはテストを書く）
npm run test:coverage

# バンドルサイズ監視（100KB 追加ごとに確認）
npm run analyze

# パフォーマンス（60FPS 維持を常に確認）
# Chrome DevTools > Performance > Record
```

**コードの原則**:
- 新しいゲームロジックは `lib/babylon/` に追加（React に混ぜない）
- 新しい敵・タワーは設定オブジェクト（`ENEMY_CONFIGS`, `TOWER_CONFIGS`）で定義し、コードの分岐を減らす
- 機能フラグ（`FEATURES.bossEnabled = true`）で段階的に有効化する
