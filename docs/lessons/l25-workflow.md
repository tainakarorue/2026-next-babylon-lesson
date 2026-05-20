# L25 — プロフェッショナルワークフロー

## 概要

Babylon.js エコシステムのツール群を使いこなし、実務レベルの開発ワークフローを確立する。ポートフォリオ向けの仕上げも行う。

**ゲームへの貢献**: デバッグ効率を上げ、品質の高いコードを維持しながら継続的に開発できる体制を整える。

---

## 概念解説

### Babylon.js 公式ツール群

#### 1. Babylon.js Inspector（インスペクター）

```typescript
// 開発時のみ有効化
if (process.env.NODE_ENV === 'development') {
  import('@babylonjs/inspector').then(({ Inspector }) => {
    scene.debugLayer.show({
      embedMode: true,
      overlay: false,
    })
  })
}
```

機能：
- シーン内の全メッシュ・マテリアル・テクスチャを一覧表示
- リアルタイムでプロパティを変更してプレビュー
- パフォーマンスカウンター（FPS, draw calls, triangles）
- カメラ・ライトの可視化

#### 2. Spector.js（WebGL デバッガー）

Chrome 拡張機能として[spector.babylonjs.com](https://spector.babylonjs.com)からインストール。

- 1フレームの WebGL コールをすべてキャプチャ
- シェーダーのソースコードを表示
- テクスチャのプレビュー
- draw call の最適化分析

#### 3. Babylon.js Sandbox

[sandbox.babylonjs.com](https://sandbox.babylonjs.com) に GLB ファイルをドラッグ&ドロップ：
- モデルのプレビュー
- アニメーションの確認
- マテリアルの検証

#### 4. Node Material Editor（NME）

[nme.babylonjs.com](https://nme.babylonjs.com) でノードベースのシェーダーを作成：
- コードなしでシェーダーを作成
- JSON としてエクスポート → `NodeMaterial.ParseFromSnippetAsync()` で読み込み

```typescript
const mat = await NodeMaterial.ParseFromSnippetAsync('#ABC123', scene)
mesh.material = mat
```

#### 5. Babylon.js Playground

[playground.babylonjs.com](https://playground.babylonjs.com) で動作確認：
- 単体機能を素早くプロトタイプ
- 公式ドキュメントのすべてのサンプルが動作する
- URL 共有でチームメンバーとコード共有

---

### Git ブランチ戦略

```
main ──────────────────────────────── 本番リリース
  └─ develop ────────────────────────── 開発統合ブランチ
       ├─ feature/wave-system ─────────── 機能ブランチ
       ├─ feature/new-tower-types ──────── 機能ブランチ
       └─ fix/pathfinding-edge-case ────── バグ修正ブランチ
```

```bash
# 機能開発の流れ
git checkout develop
git checkout -b feature/enemy-boss

# 実装...
git add -p  # 変更を確認しながら段階的にステージング
git commit -m "feat: add boss enemy with charge attack"

# develop にマージ（プルリクエスト経由）
git checkout develop
git merge --no-ff feature/enemy-boss
git branch -d feature/enemy-boss
```

---

### コミットメッセージ規約（Conventional Commits）

```
feat:     新機能
fix:      バグ修正
refactor: リファクタリング（機能変更なし）
perf:     パフォーマンス改善
test:     テスト追加・修正
docs:     ドキュメント更新
chore:    ビルド設定、依存関係の更新

例:
feat: add sniper tower with piercing bullets
fix: pathfinding fails when all 4 spawn points are surrounded
perf: use GPU instancing for enemy meshes to reduce draw calls
```

---

### TypeScript の型を活用する

```typescript
// 良い例：型で仕様を表現する
type TowerType = 'basic' | 'rapid' | 'sniper' | 'freeze'
type EnemyState = 'spawning' | 'walking' | 'attacking' | 'dying'
type Difficulty = 'easy' | 'normal' | 'hard' | 'nightmare'

interface TowerStats {
  readonly damage: number
  readonly range: number
  readonly fireRate: number  // shots per second
  readonly cost: number
  readonly description: string
}

const TOWER_STATS: Record<TowerType, TowerStats> = {
  basic:  { damage: 10, range: 6,  fireRate: 1.0, cost: 50,  description: 'バランス型タワー' },
  rapid:  { damage: 4,  range: 5,  fireRate: 3.0, cost: 80,  description: '連射特化タワー' },
  sniper: { damage: 40, range: 12, fireRate: 0.5, cost: 120, description: '長射程・高火力' },
  freeze: { damage: 2,  range: 5,  fireRate: 1.5, cost: 100, description: '敵を減速させる' },
}
```

---

### パフォーマンスプロファイリングの流れ

```
問題発見: FPS が 35 を下回る
    ↓
Chrome DevTools > Performance タブで録画
    ↓
Spector.js で draw call 数を確認（目標: < 100）
    ↓
Babylon.js Inspector でシーン統計を確認
    ↓
ボトルネック特定
    ↓
対策選択:
  - draw call 多い  → Mesh.MergeMeshes() / createInstance()
  - シェーダー重い  → simplify material / LOD
  - JS が重い      → pool pattern / reduce per-frame allocation
  - テクスチャ多い  → texture atlas / compress to KTX2
```

---

### ARCHITECTURE.md の書き方

プロジェクトに参加する人が最初に読む文書。以下を含める：

```markdown
# NEBULA DEFENSE — Architecture

## ディレクトリ構成
app/game/page.tsx         ← React 側のエントリーポイント（状態管理）
components/game/          ← React コンポーネント（UI のみ）
lib/babylon/              ← Babylon.js ロジック（DOM 非依存）
server/                   ← WebSocket サーバー

## データフロー
Babylon.js → onGameEvent callback → React state → HUD 再描画

## 重要な設計決定
- Babylon.js は useEffect 内でのみ初期化（SSR 対策）
- ゲームロジックは lib/babylon/ に集中（テスト可能にするため）
- React は表示専用（Babylon.js のレンダリングに干渉しない）

## パフォーマンス上の制約
- 敵は最大 20 体まで（Havok 物理の負荷）
- Shadow map は 1024×1024（モバイル対策）
- Bloom は FPS < 35 で自動オフ
```

---

## 次のステップ

NEBULA DEFENSE を完成させた後の発展トピック：

### WebGPU（次世代 WebGL）

```typescript
// Babylon.js 7 から WebGPU をサポート
import { WebGPUEngine } from '@babylonjs/core'

const engine = await WebGPUEngine.CreateAsync(canvas)
// 以降は Engine と同じ API
```

WebGPU の利点：
- Compute Shader が使える（GPU 上で物理演算）
- Draw Indirect でドローコールを GPU 側に委譲
- 将来的に WebGL より 2〜5 倍高速になる見込み

### WebXR（VR/AR）

```typescript
import { WebXRDefaultExperience } from '@babylonjs/core'

const xr = await scene.createDefaultXRExperienceAsync({
  floorMeshes: [ground],
})
// VR ヘッドセット対応完了
```

### Babylon Native（モバイル・デスクトップ）

Babylon.js のコードをそのままモバイルアプリとして配布：
- iOS / Android / Windows / macOS 対応
- React Native との統合が可能
- npm パッケージ: `@babylonjs/react-native`

### Blender → Babylon.js パイプライン

```
Blender でモデル作成
  ↓
File > Export > glTF 2.0
  ✅ Draco compression
  ✅ Apply modifiers
  ✅ Include: Selected Objects
  ↓
/public/models/ に配置
  ↓
SceneLoader.ImportMeshAsync() で読み込み
```

---

## 全体コード

### `ARCHITECTURE.md`

```markdown
# NEBULA DEFENSE — Architecture

## Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Framework   | Next.js 16 (App Router)           |
| 3D Engine   | Babylon.js 7 (@babylonjs/core)    |
| Physics     | Havok (@babylonjs/havok)          |
| State       | Zustand + persist (LocalStorage)  |
| Realtime    | WebSocket (ws library)            |
| Testing     | Vitest                            |
| Deploy      | Vercel (frontend) + Railway (WS)  |

## Directory Structure

\`\`\`
next-babylon/
├── app/
│   ├── game/
│   │   └── page.tsx          # ゲームページ（React 状態管理）
│   ├── layout.tsx
│   └── globals.css
├── components/
│   └── game/
│       ├── GameCanvas.tsx    # Babylon.js 初期化・メインループ
│       ├── HUD.tsx           # スコア・ライフ表示
│       ├── TowerSelector.tsx # タワー選択 UI
│       ├── LevelSelect.tsx   # レベル選択画面
│       ├── LoadingScreen.tsx # ローディング表示
│       ├── SettingsPanel.tsx # 設定画面
│       └── RandomMapButton.tsx
├── lib/
│   └── babylon/
│       ├── pathfinding.ts    # A* 経路探索
│       ├── prng.ts           # 決定論的乱数
│       ├── map-generator.ts  # プロシージャル生成
│       ├── bullet-pool.ts    # オブジェクトプール
│       ├── enemy-pool.ts     # オブジェクトプール
│       ├── sound-manager.ts  # サウンド管理
│       ├── shaders.ts        # カスタム GLSL シェーダー
│       ├── level-types.ts    # LevelConfig 型定義
│       ├── levels.ts         # レベルデータ
│       └── __tests__/        # Vitest テスト
├── lib/
│   └── store/
│       └── game-store.ts     # Zustand ストア
├── hooks/
│   └── use-multiplayer.ts    # WebSocket フック
├── server/
│   └── ws-server.ts          # WebSocket サーバー
└── public/
    ├── models/               # GLB ファイル
    ├── audio/                # OGG/MP3 ファイル
    └── env/                  # .env 環境マップ
\`\`\`

## Data Flow

\`\`\`
User Input (mouse click)
    ↓
Babylon.js onPointerObservable
    ↓
Game Logic (tower placement, pathfinding update)
    ↓
onGameEvent callback (type: 'GOLD_CHANGED', gold: 150)
    ↓
React setState → HUD re-render
\`\`\`

## Key Design Decisions

### Babylon.js は useEffect 内でのみ初期化する
**理由**: Babylon.js は window/document に依存するため、SSR で実行するとクラッシュする。
`'use client'` + `useEffect` + `dynamic({ ssr: false })` の組み合わせで対処。

### ゲームロジックは lib/babylon/ に分離する
**理由**: React コンポーネントに混在させると Vitest でテストできない。
Babylon.js に依存しない純粋な TypeScript として実装することでテスト可能にする。

### React は表示専用にする
**理由**: React の再レンダリングが Babylon.js のレンダリングループに干渉すると FPS が下がる。
ゲーム内の数値（スコア、HP 等）は Babylon.js が計算し、`onGameEvent` 経由で React に通知する。

### createInstance() でオブジェクトプール
**理由**: 敵や弾丸を毎回 `new Mesh()` するとメモリアロケーションが起き GC が走る。
プールを使うことでフレーム中の GC ポーズをなくす。

## Performance Constraints

- 敵の最大同時出現数: 20体（Havok 物理の負荷制限）
- Shadow map 解像度: 1024×1024（モバイル VRAM 対策）
- Bloom: FPS < 35 で自動無効化
- パーティクル: GPU Particle System を優先使用

## WebSocket Protocol

### Client → Server
| type          | payload                              |
|---------------|--------------------------------------|
| JOIN_ROOM     | roomId, playerName                   |
| PLACE_TOWER   | x, z, towerType                      |
| GAME_EVENT    | event                                |
| PING          | timestamp                            |

### Server → Client
| type          | payload                              |
|---------------|--------------------------------------|
| JOINED        | playerId, roomId                      |
| ROOM_STATE    | players[], hostId                    |
| PLAYER_JOINED | playerId, playerName                 |
| PLAYER_LEFT   | playerId                             |
| TOWER_PLACED  | playerId, x, z, towerType            |
| PONG          | timestamp                            |
```

---

### `.vscode/settings.json`

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "files.associations": {
    "*.glsl": "glsl"
  }
}
```

---

### `.vscode/extensions.json`（推奨拡張）

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "vitest.explorer",
    "GeForceLegend.glsl-lsp"
  ]
}
```

---

### `lib/babylon/debug.ts`（開発用デバッグユーティリティ）

```typescript
import type { Scene } from '@babylonjs/core'

export class BabylonDebug {
  private static enabled = process.env.NODE_ENV === 'development'
  private static inspectorLoaded = false

  static async showInspector(scene: Scene): Promise<void> {
    if (!this.enabled) return
    if (!this.inspectorLoaded) {
      await import('@babylonjs/inspector')
      this.inspectorLoaded = true
    }
    await scene.debugLayer.show({
      embedMode: true,
      overlay: false,
    })
  }

  static hideInspector(scene: Scene): void {
    if (!this.enabled) return
    scene.debugLayer.hide()
  }

  static logSceneStats(scene: Scene): void {
    if (!this.enabled) return
    const engine = scene.getEngine()
    console.table({
      'FPS': engine.getFps().toFixed(1),
      'Draw Calls': engine._drawCalls.current,
      'Active Meshes': scene.getActiveMeshes().length,
      'Total Meshes': scene.meshes.length,
      'Active Particles': scene.particleSystemsByName?.size ?? 0,
    })
  }
}
```

---

### `components/game/DebugPanel.tsx`

```tsx
'use client'

import { useEffect, useState } from 'react'

interface DebugInfo {
  fps: number
  drawCalls: number
  activeMeshes: number
  memoryMB: number
}

interface DebugPanelProps {
  getDebugInfo: () => DebugInfo
}

export function DebugPanel({ getDebugInfo }: DebugPanelProps) {
  const [info, setInfo] = useState<DebugInfo>({ fps: 0, drawCalls: 0, activeMeshes: 0, memoryMB: 0 })

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    const id = setInterval(() => {
      setInfo(getDebugInfo())
    }, 500)
    return () => clearInterval(id)
  }, [getDebugInfo])

  if (process.env.NODE_ENV !== 'development') return null

  return (
    <div className="absolute bottom-4 left-4 bg-black/70 text-green-400 text-xs font-mono p-2 rounded border border-green-900 z-50">
      <div>FPS: {info.fps.toFixed(1)}</div>
      <div>Draw calls: {info.drawCalls}</div>
      <div>Active meshes: {info.activeMeshes}</div>
      <div>Memory: {info.memoryMB.toFixed(1)} MB</div>
    </div>
  )
}
```

---

### `lib/babylon/performance-monitor.ts`

```typescript
import type { Engine, Scene } from '@babylonjs/core'

export class PerformanceMonitor {
  private sampleCount = 0
  private totalFps = 0
  private minFps = Infinity
  private maxFps = 0

  sample(engine: Engine): void {
    const fps = engine.getFps()
    this.totalFps += fps
    this.sampleCount++
    if (fps < this.minFps) this.minFps = fps
    if (fps > this.maxFps) this.maxFps = fps
  }

  report(): { avg: number; min: number; max: number } {
    return {
      avg: this.sampleCount > 0 ? this.totalFps / this.sampleCount : 0,
      min: this.minFps === Infinity ? 0 : this.minFps,
      max: this.maxFps,
    }
  }

  reset(): void {
    this.sampleCount = 0
    this.totalFps = 0
    this.minFps = Infinity
    this.maxFps = 0
  }

  getDebugInfo(engine: Engine, scene: Scene) {
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
    return {
      fps: engine.getFps(),
      drawCalls: (engine as Engine & { _drawCalls?: { current: number } })._drawCalls?.current ?? 0,
      activeMeshes: scene.getActiveMeshes().length,
      memoryMB: memory ? memory.usedJSHeapSize / 1024 / 1024 : 0,
    }
  }
}
```

---

### `lib/babylon/asset-manager.ts`（アセット一元管理）

```typescript
import {
  AssetsManager,
  MeshAssetTask,
  TextureAssetTask,
  BinaryFileAssetTask,
  type Scene,
} from '@babylonjs/core'
import '@babylonjs/loaders/glTF'

export interface GameAssets {
  enemyTemplate: NonNullable<MeshAssetTask['loadedMeshes']>[0] | null
  groundTexture: TextureAssetTask['texture'] | null
}

export async function loadGameAssets(scene: Scene): Promise<GameAssets> {
  const manager = new AssetsManager(scene)
  manager.useDefaultLoadingScreen = false

  const assets: GameAssets = { enemyTemplate: null, groundTexture: null }

  const enemyTask = manager.addMeshTask('enemy', '', '/models/', 'enemy.glb')
  enemyTask.onSuccess = (task) => {
    const root = task.loadedMeshes[0]
    if (root) {
      root.setEnabled(false)
      assets.enemyTemplate = root
    }
  }

  return new Promise((resolve) => {
    manager.onFinish = () => resolve(assets)
    manager.onTaskErrorObservable.add((task) => {
      console.warn(`Asset load failed: ${task.name}`)
    })
    manager.load()
  })
}
```

---

### `docs/CHECKLIST.md`（リリース前チェックリスト）

```markdown
# リリース前チェックリスト

## 機能
- [ ] 3 ステージすべてクリア可能
- [ ] ランダムマップが生成できる
- [ ] セーブデータが正しく保存・ロードされる
- [ ] 設定（音量・品質）が反映される

## パフォーマンス
- [ ] 60FPS を維持（Chrome DevTools でプロファイル）
- [ ] メモリリークなし（5分プレイ後のメモリ使用量が安定）
- [ ] バンドルサイズを確認（ANALYZE=true npm run build）

## テスト
- [ ] npm test が全部 PASS

## ビルド
- [ ] npm run build がエラーなし
- [ ] TypeScript のエラーなし（npm run build でチェック）

## デプロイ
- [ ] .env.local が .gitignore に含まれている
- [ ] 環境変数が Vercel に設定されている
- [ ] HTTPS で動作確認済み
- [ ] WebSocket が wss:// で接続できる
```

---

## 確認方法

```bash
# TypeScript の型チェック
npx tsc --noEmit

# 全テスト実行
npm test

# バンドル分析
npm run analyze

# 本番ビルド確認
npm run build && npm run start

# Babylon.js Inspector を開く（開発時）
# GameCanvas.tsx で BabylonDebug.showInspector(scene) を呼ぶ

# Lighthouse でパフォーマンス計測
npx lighthouse http://localhost:3000/game --output=html --output-path=./lighthouse-report.html
```

---

## コースのまとめ

**L01〜L05**: Babylon.js の基礎（Engine, Camera, Mesh, Material, Input）
**L06〜L10**: ゲームの仕組み（Physics, Animation, Models, Particles, Game Loop）
**L11〜L15**: ビジュアル強化（GUI, Post-processing, Shadows, Shaders, Audio）
**L16〜L20**: 高度なシステム（AI, Level Design, Performance, Procedural, Save）
**L21〜L25**: 実務対応（Multiplayer, Testing, Build, Deploy, Workflow）

このコースで作った NEBULA DEFENSE には以下が含まれる：

| 機能 | 技術 |
|------|------|
| 3D レンダリング | Babylon.js 7 + PBR |
| 物理演算 | Havok WebAssembly |
| AI 経路探索 | A* アルゴリズム |
| プロシージャル生成 | Mulberry32 PRNG |
| ポストプロセッシング | DefaultRenderingPipeline |
| カスタムシェーダー | GLSL (Fresnel, Scanline) |
| 空間オーディオ | Babylon.js Sound |
| リアルタイム通信 | WebSocket |
| 状態永続化 | Zustand + LocalStorage |
| 自動テスト | Vitest |
| バンドル最適化 | @next/bundle-analyzer |
| 本番デプロイ | Vercel + Railway |

次は WebGPU、WebXR、または Babylon Native に挑戦してみよう。
