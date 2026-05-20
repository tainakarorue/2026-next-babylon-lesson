# Phase 1 — Babylon.js の基礎

**目標**: Babylon.js を Next.js に組み込み、3D シーンの基本要素（エンジン・カメラ・光・メッシュ・マテリアル）を理解する。  
**ゲームへの貢献**: ゲームの「宇宙ステーションの床」とデバッグ用カメラが完成する。

---

## L01 — Babylon.js のセットアップ

### 学ぶこと
- `@babylonjs/core` のインストール
- Next.js の `'use client'` コンポーネントにキャンバスを埋め込む
- `Engine` と `Scene` を初期化する
- `engine.runRenderLoop` でレンダリングループを動かす
- ウィンドウリサイズへの対応
- アンマウント時の `engine.dispose()`

### 習得スキル
- Babylon.js と Next.js SSR の共存パターン
- メモリリークを防ぐクリーンアップ設計

### 成果物
真っ黒なキャンバスが画面に表示される（まだ何もない宇宙空間）

### インストールコマンド（実施時に使用）
```bash
npm install @babylonjs/core @babylonjs/loaders @babylonjs/gui @babylonjs/materials
```

---

## L02 — シーンの基本要素: カメラと光

### 学ぶこと
- **Camera の種類**
  - `FreeCamera` — WASD + マウス操作の一人称カメラ
  - `ArcRotateCamera` — 対象を周回するオービットカメラ（タワーディフェンスに最適）
  - `UniversalCamera` — FreeCamera の上位互換
- **Light の種類**
  - `HemisphericLight` — 全体的な環境光
  - `DirectionalLight` — 太陽光のような平行光
  - `PointLight` — 電球のような点光源
  - `SpotLight` — スポットライト
- カメラのターゲット・位置・FOV の設定

### 習得スキル
- カメラの座標系（Babylon は左手座標系）
- 光の intensity と diffuse カラーの調整

### 成果物
`ArcRotateCamera` でシーンをグルグル回転させて眺められる状態

---

## L03 — メッシュと 3D 空間

### 学ぶこと
- **ビルトインメッシュ** の生成
  - `MeshBuilder.CreateBox`
  - `MeshBuilder.CreateSphere`
  - `MeshBuilder.CreateCylinder`
  - `MeshBuilder.CreateGround`
  - `MeshBuilder.CreateTorus`
- **座標系と Transform**
  - `position` (Vector3)
  - `rotation` (Vector3, ラジアン)
  - `rotationQuaternion`
  - `scaling` (Vector3)
- 親子関係 (`mesh.parent = parentMesh`)
- メッシュの表示/非表示 (`isVisible`)

### 習得スキル
- 3D 空間の X/Y/Z 軸の感覚
- クォータニオンとオイラー角の違い

### 成果物
宇宙ステーションの「床グリッド」（平らなグラウンドメッシュ）と、タワーの仮置き（ボックスのプレースホルダー）

---

## L04 — マテリアルとテクスチャ

### 学ぶこと
- `StandardMaterial` の基本
  - `diffuseColor` — 拡散反射色（物体の基本色）
  - `emissiveColor` — 自発光（照明に関係なく光る）
  - `specularColor` — 鏡面反射
  - `alpha` — 透明度
- `PBRMaterial` の基本（物理ベースレンダリング）
  - `albedoColor` / `albedoTexture`
  - `metallic` / `roughness`
- テクスチャの貼り付け
  - `new Texture("url", scene)`
  - `uScale` / `vScale` でタイリング
- `Color3` と `Color4` の使い方

### 習得スキル
- PBR と Standard Material の使い分け
- テクスチャ座標（UV）の基本概念

### 成果物
宇宙ステーション床に金属テクスチャを適用。タワーに色付きマテリアル。

---

## L05 — ユーザー入力と基本インタラクション

### 学ぶこと
- **キーボード入力**
  - `scene.actionManager`
  - `ExecuteCodeAction` + `OnKeyDownTrigger`
- **マウス入力**
  - `scene.onPointerObservable`
  - `PointerEventTypes.POINTERPICK` でメッシュをクリック
  - `scene.pick()` による Ray キャスト
- **タッチ対応**
  - Babylon.js のタッチはキャンバスで自動処理
- デルタタイムを使ったフレームレート非依存の動き
  - `engine.getDeltaTime()`
  - `scene.registerBeforeRender()`

### 習得スキル
- フレームレート非依存アニメーションの設計
- Ray キャストによるオブジェクト選択（タワー設置の基礎）

### 成果物
床をクリックするとその位置にタワー（ボックス）が設置される  
→ **Phase 1 完成: インタラクティブな 3D シーンの雛形**

---

## Phase 1 チェックリスト

- [ ] Babylon.js が Next.js の Client Component で動作する
- [ ] レンダリングループが動いていてリサイズ対応できている
- [ ] `ArcRotateCamera` でシーンを自由に回転・ズームできる
- [ ] ライトが設定されていてメッシュに陰影がついている
- [ ] 床・タワー仮置きに PBR マテリアル or テクスチャが適用されている
- [ ] 床クリックでタワー（ボックス）が設置できる

---

## 参考リソース

- [Babylon.js 公式ドキュメント](https://doc.babylonjs.com/)
- [Babylon.js Playground](https://playground.babylonjs.com/) — コードをブラウザで即試せる
- [Babylon.js NME (Node Material Editor)](https://nme.babylonjs.com/) — シェーダーのビジュアル編集
