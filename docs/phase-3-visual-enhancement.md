# Phase 3 — ビジュアル強化

**目標**: GUI、ポストプロセッシング、高品質ライティング、カスタムシェーダー、サウンドを実装し、ゲームを「見栄えがする」状態にする。  
**ゲームへの貢献**: プロ品質のビジュアルと没入感のあるサウンドデザインが完成する。

---

## L11 — GUI / HUD の実装

### 学ぶこと
- **2 つのアプローチの比較**

| アプローチ | メリット | デメリット |
|---|---|---|
| Babylon.js GUI (`@babylonjs/gui`) | 3D シーンと同じ座標系・シームレス | React のエコシステムが使えない |
| React (shadcn) オーバーレイ | shadcn コンポーネントが使える | キャンバスの上に CSS で重ねる必要あり |

- **Babylon.js GUI の使い方**
  - `AdvancedDynamicTexture.CreateFullscreenUI()`
  - `Button`, `TextBlock`, `Rectangle`, `StackPanel`
  - `control.linkWithMesh(mesh)` — 3D オブジェクトに追従する UI
  - 体力バー（`Rectangle` で幅を動的に変更）
- **React オーバーレイ方式**
  - `position: absolute` で Canvas の上に配置
  - `pointer-events: none` でクリックを透過させる
  - Observer 経由でゲーム情報を受け取り `useState` で更新

### 習得スキル
- ゲームの状況に応じた UI 選択基準
- 3D ワールド座標を 2D スクリーン座標に変換（`Vector3.Project`）

### 成果物
- 画面右上に React 製スコア・ライフ表示
- 敵の頭上に Babylon GUI 製体力バー（敵に追従）
- タワー選択メニュー（shadcn BottomBar）

---

## L12 — ポストプロセッシング

### 学ぶこと
- `PostProcessRenderPipeline` の仕組み
- **DefaultRenderingPipeline**（おすすめ：複数エフェクトを一括管理）
  ```ts
  const pipeline = new DefaultRenderingPipeline("default", true, scene, [camera]);
  pipeline.bloomEnabled = true;
  pipeline.bloomWeight = 0.5;
  pipeline.fxaaEnabled = true;
  pipeline.imageProcessingEnabled = true;
  pipeline.imageProcessing.toneMappingEnabled = true;
  ```
- 個別ポストプロセス
  - `BloomMergePostProcess` — 発光エフェクト
  - `DepthOfFieldEffect` — 被写界深度
  - `ChromaticAberrationPostProcess` — 色収差（SF 感演出）
  - `GrainPostProcess` — フィルムグレイン
  - `SharpenPostProcess` — シャープネス
- `MotionBlurPostProcess` — モーションブラー
- パフォーマンスへの影響と設定の最適化

### 習得スキル
- ポストプロセッシングの積み重ねによるスタイル作り
- モバイル向けに効果を無効化するフォールバック設計

### 成果物
Bloom でタワーのエネルギーコアが光り輝く演出。FXAA でジャギーが消える。

---

## L13 — シャドウとアドバンスドライティング

### 学ぶこと
- **Shadow Generator**
  ```ts
  const shadowGenerator = new ShadowGenerator(1024, directionalLight);
  shadowGenerator.addShadowCaster(enemyMesh);
  shadowGenerator.useExponentialShadowMap = true;
  ```
- シャドウマップの解像度とパフォーマンスの関係
- ソフトシャドウの種類
  - `usePoissonSampling`
  - `useExponentialShadowMap`（ESM）
  - `useBlurExponentialShadowMap`
  - `usePercentageCloserFiltering`（PCF）
- **EnvironmentTexture（IBL: 画像ベースライティング）**
  ```ts
  scene.environmentTexture = CubeTexture.CreateFromPrefilteredData("/env/space.env", scene);
  scene.createDefaultSkybox(scene.environmentTexture, true, 1000);
  ```
- `HDRCubeTexture` で HDRI 環境マップを使う
- `SpotLight` と `ShadowGenerator` でダイナミックなスポット照明

### 習得スキル
- リアルタイムシャドウのコストとクオリティのトレードオフ
- IBL による PBR マテリアルの引き立て方

### 成果物
太陽光（DirectionalLight）がステーションに影を落とし、宇宙の HDRI が映り込む

---

## L14 — カスタムシェーダー（GLSL / WGSL）

### 学ぶこと
- **ShaderMaterial** の基本
  ```ts
  const shaderMaterial = new ShaderMaterial("shield", scene, {
    vertex: "shield",   // shield.vertex.glsl
    fragment: "shield", // shield.fragment.glsl
  }, {
    attributes: ["position", "normal", "uv"],
    uniforms: ["worldViewProjection", "time"],
  });
  ```
- GLSL の基本文法
  - `attribute` / `varying` / `uniform`
  - `gl_Position`, `gl_FragColor`
  - 数学関数: `sin`, `cos`, `mix`, `smoothstep`, `fract`
- **よく使うシェーダーパターン**
  - スキャンライン（SF テクスチャ）
  - フレネル効果（シールドのリム発光）
  - 頂点変形（旗のなびき・波）
  - ノイズ関数（Simplex Noise で有機的テクスチャ）
- **Node Material Editor (NME)** でビジュアルにシェーダーを作る
- `Effect.ShadersStore` にインラインで GLSL を登録する方法

### 習得スキル
- GPU の並列処理の概念
- シェーダーのデバッグ方法（色で値を可視化する）

### 成果物
敵の攻撃を受けたタワーにフレネル発光のシールドエフェクト（カスタム GLSL）

---

## L15 — サウンドエンジン

### 学ぶこと
- **Babylon.js AudioEngine**
  - Web Audio API のラッパー
  - `AudioEngineV2`（最新。非推奨の旧 API との違いに注意）
- BGM の再生（ループ・フェードイン・アウト）
  ```ts
  const bgm = await CreateSoundAsync("bgm", "/audio/space_bgm.mp3", { loop: true });
  bgm.play();
  ```
- 効果音の単発再生（爆発・発射音）
- **3D 空間音響（Spatial Audio）**
  - `spatialSound: true` で音源が 3D 空間に配置される
  - 敵が近づくにつれてエンジン音が大きくなる
  - `setPosition()` で音源の位置を更新
- 音量・ピッチのランダム化（毎回同じにならないように）
- ユーザー操作後に初めて再生できる制約（ブラウザポリシー）への対応

### 習得スキル
- ゲーム体験における音の重要性
- Web Audio API の autoplay 制限の回避パターン

### 成果物
BGM が流れ、発射音・爆発音・タワー設置音が 3D 空間で鳴り響く  
→ **Phase 3 完成: 「プロ品質のビジュアルとサウンド」**

---

## Phase 3 チェックリスト

- [ ] Babylon GUI の体力バーが敵の頭上に追従している
- [ ] React 製 HUD がスコア・ライフ・ウェーブを表示している
- [ ] Bloom ポストプロセッシングが有効になっている
- [ ] DirectionalLight のシャドウが描画されている
- [ ] IBL 環境マップが設定されている
- [ ] 少なくとも 1 つカスタム GLSL シェーダーが動作している
- [ ] BGM と主要な SE が再生される
- [ ] 3D 空間音響が機能している（敵エンジン音など）
