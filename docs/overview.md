# Babylon.js 学習ロードマップ — NEBULA DEFENSE

## 概要

Next.js + Babylon.js を使って、**3D スペース タワーディフェンスゲーム「NEBULA DEFENSE」** を段階的に完成させる。
初心者から実務レベルまでを 5 フェーズ・25 レッスンで習得する。

タワーディフェンスを題材にした理由：
- シンプルな基礎（床・箱・光）から始められる
- カメラ・入力・物理・AI・シェーダー・マルチプレイヤーまで段階的に拡張できる
- 完成形が実際に遊べるゲームとして見映えがする

---

## 最終的に完成するゲーム

| 要素 | 内容 |
|---|---|
| ジャンル | 3D タワーディフェンス（宇宙ステーション防衛） |
| 視点 | トップダウン＋オービットカメラ |
| プレイヤー操作 | タワー設置・アップグレード、カメラ移動 |
| 敵 | 経路探索 AI で拠点へ向かう宇宙船群 |
| エフェクト | パーティクル爆発・カスタムシェーダー・ポストプロセッシング |
| UI | React (shadcn) + Babylon.js GUI の組み合わせ |
| サウンド | BGM＋SE（Babylon.js AudioEngine） |
| マルチプレイヤー | WebSocket による協力プレイ（フェーズ 5） |

---

## フェーズ一覧

| フェーズ | テーマ | レッスン | 期間目安 |
|---|---|---|---|
| [Phase 1](./phase-1-foundations.md) | Babylon.js の基礎 | L01–L05 | 1〜2 週 |
| [Phase 2](./phase-2-game-mechanics.md) | ゲームメカニクス | L06–L10 | 2〜3 週 |
| [Phase 3](./phase-3-visual-enhancement.md) | ビジュアル強化 | L11–L15 | 2〜3 週 |
| [Phase 4](./phase-4-advanced-systems.md) | 高度なシステム | L16–L20 | 2〜3 週 |
| [Phase 5](./phase-5-production.md) | 実務・本番対応 | L21–L25 | 2〜3 週 |

---

## プロジェクト構成（完成形）

```
next-babylon/
├── app/
│   ├── layout.tsx
│   ├── page.tsx              # ゲームのトップページ（shadcn UI）
│   └── game/
│       └── page.tsx          # ゲームキャンバスページ
├── components/
│   ├── ui/                   # shadcn コンポーネント
│   └── game/
│       ├── GameCanvas.tsx    # Babylon.js をマウントする Client Component
│       ├── HUD.tsx           # React 製 HUD
│       └── GameMenu.tsx      # タイトル・設定メニュー
├── lib/
│   ├── babylon/
│   │   ├── engine.ts         # エンジン初期化
│   │   ├── scene/            # シーン管理
│   │   ├── entities/         # タワー・敵・弾丸クラス
│   │   ├── systems/          # 物理・AI・オーディオ
│   │   └── shaders/          # カスタム GLSL
│   └── utils.ts
├── public/
│   ├── models/               # GLTF/GLB アセット
│   ├── textures/
│   └── audio/
└── docs/                     # このフォルダ
```

---

## 技術スタック

| 分類 | ライブラリ | 役割 |
|---|---|---|
| フレームワーク | Next.js 16 (App Router) | ルーティング・SSR |
| UI | React 19 + shadcn/ui | HUD・メニュー |
| 3D エンジン | Babylon.js 7.x | レンダリング・物理・サウンド |
| 物理 | Babylon Havok Plugin | 剛体シミュレーション |
| 型 | TypeScript 5 | 型安全 |
| スタイル | Tailwind CSS v4 | UI スタイリング |

---

## Babylon.js と Next.js の共存ルール

1. Babylon.js は **ブラウザ専用** → `'use client'` コンポーネントの中でのみ使う
2. エンジン初期化は `useEffect` の中（SSR では実行しない）
3. キャンバスは `ref` で参照し、アンマウント時に `engine.dispose()` を呼ぶ
4. 重い 3D アセットは `next/dynamic` で遅延ロードする

---

## 前提知識

- JavaScript / TypeScript の基礎
- React の基礎（useState, useEffect, useRef）
- Next.js App Router の基礎（`'use client'` の意味）
- HTML Canvas の概念（描画の仕組みがわかればなお良い）

3D グラフィクスや WebGL の事前知識は**不要**。
