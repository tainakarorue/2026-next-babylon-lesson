# Phase 5 — 実務・本番対応

**目標**: マルチプレイヤー・テスト・ビルド最適化・デプロイ・実務ワークフローを習得し、実際にリリースできる状態に仕上げる。  
**ゲームへの貢献**: Vercel で公開できる協力プレイ対応のタワーディフェンスが完成する。

---

## L21 — マルチプレイヤー基礎（WebSocket）

### 学ぶこと
- **リアルタイム通信の種類**
  | 方式 | 特徴 | 向いているゲーム |
  |---|---|---|
  | WebSocket | 双方向・低レイテンシ | アクション・協力系 |
  | WebRTC | P2P（サーバー不要） | 少人数対戦 |
  | Server-Sent Events | サーバー→クライアント一方向 | リーダーボード更新 |

- **ゲームの同期モデル**
  - **Lockstep**（全員の入力を集めてから 1 フレーム進める）
  - **State Synchronization**（サーバーが状態を配信、クライアントは表示専用）
  - **Client Prediction + Reconciliation**（クライアントが先読み、ずれたらサーバーで修正）

- **Next.js でシンプルな WebSocket サーバーを立てる**
  - `next.config.ts` の `server` オプション（Next.js 16 の新機能）
  - または独立した WebSocket サーバー（`ws` ライブラリ）

- **実装: 協力プレイ**
  ```ts
  // プレイヤーがタワーを設置したらサーバーに送信
  ws.send(JSON.stringify({ type: "PLACE_TOWER", position: { x, y, z }, towerId }));
  // 他プレイヤーのアクションを受信して反映
  ws.onmessage = (event) => {
    const { type, ...data } = JSON.parse(event.data);
    if (type === "PLACE_TOWER") placeTowerFromNetwork(data);
  };
  ```

- ルームとセッション管理
- デバッグ: ネットワーク遅延のシミュレーション

### 習得スキル
- ネットワーク遅延への対処（補間・外挿）
- ゲームサーバーとクライアントの責務分離

### 成果物
2 人が同じブラウザのタブで協力してプレイできる（ローカル WebSocket サーバー）

---

## L22 — テストと品質管理

### 学ぶこと
- **3D ゲームのテスト戦略**
  - 純粋なゲームロジック（経路探索・スコア計算）は**ユニットテスト**
  - Babylon.js レンダリングは**自動テスト困難** → スナップショット or 手動
  - E2E テストは Playwright で UI フローをカバー

- **ユニットテスト (Vitest)**
  ```bash
  npm install -D vitest
  ```
  - `ScoreSystem`, `WaveManager`, `PathFinder` のテスト
  - Babylon.js のインスタンスが必要な部分はモック化

- **型の厳格化**
  - `tsconfig.json` の `"strict": true`
  - ゲームイベントの型定義（discriminated union）
  ```ts
  type GameEvent =
    | { type: "ENEMY_KILLED"; enemyId: string; score: number }
    | { type: "WAVE_STARTED"; waveNumber: number }
    | { type: "GAME_OVER"; finalScore: number };
  ```

- **ESLint カスタムルール**
  - `no-console` を警告に（本番ログを残さない）
  - `@typescript-eslint/no-floating-promises`（非同期エラー防止）

- **パフォーマンスリグレッションテスト**
  - FPS が閾値を下回ったら警告するデバッグモード

### 習得スキル
- テスタブルなゲームコード設計（依存性逆転）
- CI でテストを自動実行する習慣

### 成果物
`npm test` で全ユニットテストが通る。型エラーゼロ。

---

## L23 — ビルドと最適化

### 学ぶこと
- **バンドルサイズの問題**
  - `@babylonjs/core` は大きい（~2MB gzip 前）
  - Tree shaking が効かない箇所の特定

- **next/dynamic で動的インポート**
  ```ts
  const GameCanvas = dynamic(() => import("@/components/game/GameCanvas"), {
    ssr: false,
    loading: () => <GameLoadingScreen />,
  });
  ```

- **Babylon.js のバンドル最適化**
  - 使わないモジュールをインポートしない（サイドエフェクトに注意）
  - `@babylonjs/core/Legacy/legacy` は使わない
  - ES Module 形式でのインポート

- **アセット最適化**
  - GLB のポリゴン削減（Blender Decimate）
  - テクスチャを WebP / AVIF に変換
  - 音声を OGG Opus に圧縮
  - `next/image` は使えない（Canvas 内のため）→ `Texture` の `samplingMode` で最適化

- **Code Splitting**
  - フェーズごとのレベルを別チャンクに分割
  - `React.lazy` + Suspense

- **Web Workers**
  - `next.config.ts` で Worker のサポートを確認
  - 物理・AI を Worker に分離

### 習得スキル
- バンドルアナライザーを使った問題特定（`@next/bundle-analyzer`）
- Core Web Vitals（LCP・CLS・INP）のゲームサイトへの適用

### 成果物
初回ロードが 3 秒以内（低速 3G 基準）。`next build` でエラーなし。

---

## L24 — デプロイメント（Vercel）

### 学ぶこと
- **Vercel への Next.js デプロイ**
  - `git push` で自動デプロイ（Preview URL 付き）
  - 環境変数の設定（WebSocket サーバー URL など）

- **WebSocket サーバーのホスティング**
  - Vercel Functions はステートレス → WebSocket 不可
  - 選択肢: Railway / Render / Fly.io / Cloudflare Durable Objects
  - Cloudflare Workers の Durable Objects（WebSocket + 永続状態）

- **CDN とキャッシュ戦略**
  - 3D アセット（GLB・テクスチャ）は `Cache-Control: public, max-age=31536000, immutable`
  - ファイル名にハッシュを含める（Next.js は自動）

- **モニタリング**
  - Vercel Analytics で Core Web Vitals を監視
  - Sentry でエラーをキャッチ（ゲームクラッシュのスタックトレース）

- **ドメインと HTTPS**
  - HTTPS 必須（Web Audio API / WebGL はセキュアコンテキスト要件）

### 習得スキル
- JAMstack でゲームをホストする構成
- CI/CD パイプライン（GitHub Actions + Vercel）

### 成果物
`https://nebula-defense.vercel.app` でゲームが公開される

---

## L25 — 実務ワークフローと次のステップ

### 学ぶこと
- **実務のゲーム開発プロセス**
  - GDD（ゲームデザインドキュメント）の書き方
  - スプリント計画とマイルストーン
  - プレイヤーフィードバックの収集と反映

- **Babylon.js エコシステムの深化**
  - **Babylon.js Inspector** を使った高度なデバッグ
  - **Spector.js** — WebGL の描画コールをフレーム単位で解析
  - **Babylon.js GUI Editor** — GUI のビジュアル編集ツール
  - **Babylon.js Sandbox** — GLB/GLTF ファイルのプレビューサイト

- **次に挑戦できるトピック**
  | トピック | 学べること |
  |---|---|
  | WebGPU (WebGPU Engine) | 次世代グラフィクス API |
  | Babylon.js GUI Editor | ノーコード UI 構築 |
  | XR / WebXR | VR・AR ゲーム |
  | Babylon.js Native | iOS / Android へのネイティブ出力 |
  | Three.js との比較 | 他エンジンの視野を広げる |
  | Blender → Babylon ワークフロー | 3D アーティストとの協業 |

- **ポートフォリオとしての整備**
  - README にゲームの説明・スクリーンショット・デモリンク
  - `ARCHITECTURE.md` に設計判断を記録
  - Babylon.js フォーラムへの投稿（コミュニティへの参加）

### 成果物
- 公開済みゲームの URL
- GitHub に整備されたポートフォリオリポジトリ
- 次のプロジェクト計画ドラフト  
→ **Phase 5 完成: 「実務水準の 3D ゲームエンジニア」**

---

## Phase 5 チェックリスト

- [ ] WebSocket を使った 2 人協力プレイが動作する
- [ ] ゲームロジックのユニットテストが存在し CI で実行される
- [ ] `next build` がエラーなく完了する
- [ ] バンドルサイズが許容範囲内（目安: JS 初回ロード 500KB 以下）
- [ ] Vercel にデプロイされパブリック URL で動作確認済み
- [ ] Sentry でエラーが収集されている
- [ ] README と ARCHITECTURE.md が整備されている

---

## 全フェーズ完了後のロードマップ

```
初心者
  │
  ├── Phase 1: Babylon.js をブラウザで動かせる
  ├── Phase 2: ゲームのループを設計・実装できる
  ├── Phase 3: プロ品質のビジュアルとサウンドを作れる
  ├── Phase 4: スケールするゲームアーキテクチャを設計できる
  └── Phase 5: 本番で動くゲームをリリースできる
              │
              ▼
          実務レベル
```
