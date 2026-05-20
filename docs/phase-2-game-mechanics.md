# Phase 2 — ゲームメカニクス

**目標**: 物理・アニメーション・モデル読み込み・パーティクル・ゲームループを習得し、ゲームとして「動く」状態にする。  
**ゲームへの貢献**: 敵が経路を移動し、タワーが弾を撃ち、爆発エフェクトが発生する基礎ループが完成する。

---

## L06 — 物理エンジン（Havok Plugin）

### 学ぶこと
- Babylon.js の物理プラグイン体系
  - `HavokPlugin`（推奨・高性能）
  - `CannonJSPlugin`（軽量・旧来）
- 物理の有効化
  ```ts
  const havokInstance = await HavokPhysics();
  const havokPlugin = new HavokPlugin(true, havokInstance);
  scene.enablePhysics(new Vector3(0, -9.81, 0), havokPlugin);
  ```
- **PhysicsAggregate** の使い方
  - `PhysicsShapeType.BOX` / `SPHERE` / `CAPSULE` / `MESH`
  - `mass`, `restitution`, `friction` の設定
- 衝突イベント (`onCollisionObservable`)
- 静的ボディ（床・壁）vs 動的ボディ（敵・弾）

### 習得スキル
- 物理シミュレーションとゲームロジックの分離
- Havok WASM のロード方法（Next.js での注意点）

### 成果物
箱を放り投げると床に物理的に落下・バウンドする

---

## L07 — アニメーション

### 学ぶこと
- **Babylon.js アニメーションの種類**
  - `Animation` クラス（プロパティを直接アニメート）
  - `AnimationGroup`（複数アニメの同期）
  - `Animatable`（再生コントロール）
- キーフレームアニメーション
  ```ts
  const anim = new Animation("rotate", "rotation.y", 30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE);
  anim.setKeys([{ frame: 0, value: 0 }, { frame: 30, value: Math.PI * 2 }]);
  ```
- イージング関数 (`CubicEase`, `BackEase` など)
- `scene.beginAnimation()` と `scene.stopAnimation()`
- GLTF モデルに付属するアニメーションの再生

### 習得スキル
- ゲームの状態変化（設置・死亡・攻撃）をアニメーションで表現する

### 成果物
タワー設置時にスケールアップアニメーション。敵機が上下に浮遊する hover アニメーション。

---

## L08 — 3D モデル読み込み（GLTF/GLB）

### 学ぶこと
- `SceneLoader.ImportMeshAsync` の使い方
  ```ts
  const result = await SceneLoader.ImportMeshAsync("", "/models/", "enemy.glb", scene);
  ```
- `@babylonjs/loaders` の必要性
- ロード済みメッシュの構造理解（ルートメッシュ・子メッシュ）
- メッシュのクローン（`mesh.clone()`）と `instantiateHierarchy()`
- `AssetManager` で複数アセットをまとめて事前ロード
- `ProgressEvent` でローディング画面を表示

### 習得スキル
- 外部制作 3D モデル（Sketchfab・Blender 出力）の取り込み方
- モデルのスケール・回転の調整（ツールごとに座標系が違う）

### 成果物
GLB 形式の敵宇宙船モデルがシーンに表示され、アニメーションが再生される  
（練習用モデルは Babylon.js 公式サンプルを流用）

---

## L09 — パーティクルシステム

### 学ぶこと
- `ParticleSystem` の基本設定
  - `emitter`（発生源のメッシュまたは座標）
  - `minEmitBox` / `maxEmitBox`
  - `color1`, `color2`, `colorDead`
  - `minSize` / `maxSize`
  - `minLifeTime` / `maxLifeTime`
  - `emitRate`（1秒あたりのパーティクル数）
- テクスチャ付きパーティクル（`particleTexture`）
- **GPUParticleSystem**（数万パーティクルに対応）
- `ParticleSystem.Stop()` + `onDisposeObservable` で使い捨て爆発
- `SolidParticleSystem`（メッシュをパーティクルとして扱う）

### 習得スキル
- 爆発・炎・煙・星屑エフェクトの作り方
- パーティクルのライフサイクル管理（Pool パターン）

### 成果物
敵が撃破されると爆発パーティクルが発生する

---

## L10 — ゲームループとスコアシステム

### 学ぶこと
- **ゲームの状態管理**
  - `enum GameState { MENU, PLAYING, PAUSED, GAME_OVER }`
  - シーン内の状態と React の状態をどう橋渡しするか
- **Observer パターン**
  - `Observable<T>` と `observe()` / `notifyObservers()`
  - ゲームイベントバス（敵死亡・波開始・タワー建設）
- **ウェーブシステム**
  - タイマー管理（`setInterval` ではなく `scene.registerBeforeRender`）
  - 敵のスポーンキュー
- React との双方向通信
  - Babylon → React: Observer → `useState`/`useReducer`
  - React → Babylon: ref 経由で関数を呼び出す

### 習得スキル
- ゲームロジックを 3D エンジンから切り離す設計
- フレーム処理とタイマー処理の使い分け

### 成果物
ウェーブ開始→敵スポーン→撃破→スコア加算→次のウェーブ、のループが動作する  
スコアが React の HUD に反映される  
→ **Phase 2 完成: 「ゲームになっている」状態**

---

## Phase 2 チェックリスト

- [ ] Havok 物理が動作し弾丸が敵に当たって跳ね返る
- [ ] 少なくとも 1 種類のアニメーション（設置・浮遊など）が動いている
- [ ] GLB モデルが読み込まれてシーンに表示されている
- [ ] 爆発パーティクルが敵撃破時に発生する
- [ ] ウェーブシステムが動作しスコアが React UI に表示される
- [ ] ゲームオーバー状態への遷移がある
