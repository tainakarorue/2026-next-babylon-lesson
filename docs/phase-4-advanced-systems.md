# Phase 4 — 高度なシステム

**目標**: AI・レベルデザイン・パフォーマンス最適化・プロシージャル生成・状態管理を習得し、「拡張できるゲームアーキテクチャ」を構築する。  
**ゲームへの貢献**: 複数マップ・賢い敵 AI・60fps 維持・セーブ機能が揃った完成品になる。

---

## L16 — AI と経路探索

### 学ぶこと
- **経路探索の基礎概念**
  - グラフ理論とノード
  - BFS（幅優先探索）、Dijkstra、A*（A スター）の違い
  - A* が ゲーム AI に向いている理由（ヒューリスティック関数）

- **Babylon.js でグリッドベース経路探索**
  - タワーディフェンスのマップをグリッドとして表現
  - ウェイポイント配列で単純な経路を実装（入門）
  - A* アルゴリズムを TypeScript で実装

- **Recast Navigation（高度）**
  - `@babylonjs/addons` の `RecastJSPlugin`
  - NavMesh の生成（複雑な 3D 地形に対応）
  - `navigationPlugin.createCrowd()` で複数エージェントを一括管理
  - 動的障害物（タワー設置後に NavMesh を再計算）

- **ステアリング行動**
  - 追跡（Seek）
  - 障害物回避（Obstacle Avoidance）
  - 群れの行動（Flocking）

### 習得スキル
- ゲーム AI の設計パターン（ステートマシン）
- 経路探索のパフォーマンス最適化（毎フレーム計算しない）

### 成果物
敵がスポーン地点から拠点まで NavMesh を使って賢く移動。  
タワーを設置すると迂回ルートを再計算する。

---

## L17 — レベルデザインとシーン管理

### 学ぶこと
- **シーン管理の設計**
  - `SceneManager` クラスでシーンのライフサイクルを管理
  - `scene.dispose()` の徹底（メモリリーク防止）
  - 非同期シーン遷移（ローディング画面）

- **レベルデータの設計**
  ```ts
  interface LevelConfig {
    id: string;
    mapFile: string;          // GLB ファイル
    spawnPoints: Vector3[];
    basePosition: Vector3;
    waypoints: Vector3[][];
    waves: WaveConfig[];
    ambientColor: Color3;
    skyboxTexture: string;
  }
  ```

- **JSON でレベルを定義する**
  - Next.js の `public/levels/level1.json` から動的ロード
  - レベルセレクト画面と進行管理

- **Babylon.js のルームシステム**
  - `TransformNode` でレベルオブジェクトをグループ化
  - レベル切替時に `rootNode.dispose()` で一括削除

- **アセットの共有と再利用**
  - `AssetContainer` で読み込み済みアセットを保持・再利用

### 習得スキル
- データドリブンなゲームデザイン
- シーンのメモリ管理の徹底

### 成果物
3 つのマップ（難易度: 易・中・難）を切り替えられるレベルセレクト画面

---

## L18 — パフォーマンス最適化

### 学ぶこと
- **パフォーマンス計測ツール**
  - `scene.debugLayer.show()` — Babylon.js Inspector
  - Chrome DevTools の Performance パネル
  - `engine.getFps()` でリアルタイム FPS 表示

- **描画コール削減**
  - **Instancing** — 同じメッシュを大量に配置（タワー・敵）
    ```ts
    const instance = baseMesh.createInstance("enemy_" + i);
    instance.position = new Vector3(x, y, z);
    ```
  - **Merge Meshes** — 静的オブジェクトを結合
    ```ts
    const merged = Mesh.MergeMeshes(staticMeshes, true, true);
    ```
  - **Freeze World Matrix** — 静的メッシュの行列計算をスキップ
    ```ts
    mesh.freezeWorldMatrix();
    ```

- **カリング**
  - Frustum Culling（自動）
  - `mesh.isPickable = false` で無駄なピック計算を削除
  - LOD（Level of Detail）— 距離に応じてメッシュの精度を落とす

- **テクスチャ最適化**
  - Texture Atlas（複数テクスチャを 1 枚にまとめる）
  - DDS / KTX2 フォーマット（GPU 圧縮テクスチャ）

- **オブジェクトプール（Object Pool）パターン**
  - 弾丸・パーティクルを毎回 new しない
  - 使い終わったオブジェクトを非表示にしてプールに戻す

- **Worker スレッド**
  - 物理・AI 計算を Web Worker に分離（Havok は Worker 対応）

### 習得スキル
- ボトルネックを特定して数値で効果を確認するデバッグ習慣
- モバイル・低スペック PC 向けの品質スケーリング

### 成果物
100 体の敵が同時に画面に出ても 60fps を維持する実装

---

## L19 — プロシージャル生成

### 学ぶこと
- **手続き的コンテンツ生成（PCG）の概念**
  - 決定論的乱数（シード値で再現可能）
  - `Math.random()` の代わりに `PRNG` クラスを実装

- **グリッドマップの生成**
  - ランダムウォーク・セルオートマトン（洞窟生成）
  - Perlin Noise / Simplex Noise で自然な地形

- **Babylon.js での動的メッシュ生成**
  - `MeshBuilder.CreateRibbon` / `CreatePolygon`
  - カスタム頂点データ（`VertexData`）で完全自前メッシュ
    ```ts
    const vertexData = new VertexData();
    vertexData.positions = [...]; // Vector3 の配列をフラット化
    vertexData.indices = [...];
    vertexData.normals = [...];
    vertexData.applyToMesh(mesh);
    ```

- **宇宙背景の手続き生成**
  - 星フィールド（`PointsCloudSystem`）
  - 小惑星帯（Noise でランダム配置）

### 習得スキル
- PCG によってリプレイ性の高いゲームを設計する考え方
- 3D メッシュの内部データ構造（頂点・インデックス・法線）の理解

### 成果物
毎プレイでランダムに生成されるマップ（障害物の配置が異なる宇宙ステーション）

---

## L20 — 保存システムと状態管理

### 学ぶこと
- **ゲームの状態設計**
  ```ts
  interface GameSaveData {
    version: number;
    playerName: string;
    unlockedLevels: string[];
    highScores: Record<string, number>;
    settings: GameSettings;
    currentRun?: RunState;
  }
  ```

- **LocalStorage / IndexedDB**
  - LocalStorage: 小さいデータに適する（設定・スコア）
  - IndexedDB: 大きいデータ（セーブデータ全体、アセットキャッシュ）

- **Next.js + Zustand** でグローバル状態管理
  - Babylon.js ↔ React の状態橋渡しに Zustand Store を使う
  - 永続化ミドルウェア（`zustand/middleware` の `persist`）

- **セーブの設計パターン**
  - 自動セーブ（ウェーブクリア時）
  - 手動セーブ（メニューから）
  - セーブデータのバリデーション（バージョン互換）

- **アンドゥ / リドゥ**（ゲーム内でタワーの設置をやり直せる）
  - Command パターン

### 習得スキル
- React と Babylon.js の状態を単一の Store で管理するアーキテクチャ
- クライアントサイドの永続化設計

### 成果物
- ゲームの進行・スコアが LocalStorage に自動セーブされる
- 次回起動時にセーブデータをロードして再開できる  
→ **Phase 4 完成: 「実務水準のゲームアーキテクチャ」**

---

## Phase 4 チェックリスト

- [ ] A* または RecastJS NavMesh で敵が経路探索している
- [ ] タワー設置時に NavMesh が再計算され敵が迂回する
- [ ] 3 つ以上のレベルが切り替えられる
- [ ] Instancing で大量オブジェクトを 60fps で描画している
- [ ] オブジェクトプールが弾丸に適用されている
- [ ] 手続き生成でマップが毎回異なる
- [ ] セーブ・ロード機能が動作する
- [ ] Zustand で Babylon と React の状態が統合されている
