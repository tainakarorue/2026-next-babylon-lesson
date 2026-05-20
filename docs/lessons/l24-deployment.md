# L24 — デプロイメント

## 概要

Next.js アプリを Vercel にデプロイし、WebSocket サーバーを別サービスでホストする。本番環境に必要な設定を整える。

**ゲームへの貢献**: 世界中のプレイヤーがブラウザだけでゲームをプレイできるようになる。

---

## 概念解説

### デプロイ構成

```
┌─────────────────────────────┐
│  Vercel（Next.js）          │
│  - フロントエンド           │
│  - /app/game/page.tsx       │
│  - 静的アセット（GLB/音声） │
└──────────┬──────────────────┘
           │ WSS://
┌──────────▼──────────────────┐
│  Railway / Render           │
│  - server/ws-server.ts      │
│  - WebSocket on port 8080   │
└─────────────────────────────┘
```

### 環境変数

```bash
# .env.local（ローカル開発）
NEXT_PUBLIC_WS_URL=ws://localhost:8080
ANALYZE=false

# Vercel の環境変数（本番）
NEXT_PUBLIC_WS_URL=wss://your-ws-server.railway.app
```

`NEXT_PUBLIC_` プレフィックスでクライアントサイドから参照可能になる。

### WebGL/WebAudio の HTTPS 要件

```
HTTP  → WebGL は動作する（一部ブラウザで警告）
HTTPS → WebGL + WebAudio + WebXR すべて動作
       → SharedArrayBuffer (Havok WASM) も使用可能

Vercel は自動で HTTPS 対応 ✅
WebSocket も ws:// → wss:// に変更が必要 ✅
```

### Vercel のキャッシュ設定

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/models/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/audio/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/env/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}
```

### Sentry でエラー追跡

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Babylon.js のエラーをキャプチャ：
```typescript
// GameCanvas.tsx
import * as Sentry from '@sentry/nextjs'

try {
  await init()
} catch (err) {
  Sentry.captureException(err)
  console.error('Babylon.js init failed:', err)
}
```

### Railway での WebSocket サーバーデプロイ

```bash
# railway.json を作成
{
  "build": {
    "builder": "nixpacks"
  },
  "deploy": {
    "startCommand": "npx ts-node server/ws-server.ts",
    "restartPolicyType": "on_failure"
  }
}
```

### SharedArrayBuffer（Havok WASM）の有効化

Havok 物理エンジンは SharedArrayBuffer を使うため、COOP/COEP ヘッダーが必要：

```typescript
// next.config.ts
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
      ],
    },
    // ... 静的アセット設定
  ]
}
```

---

## 実装手順

### Step 1: 環境変数を設定する

```bash
# .env.local（Git には含めない）
NEXT_PUBLIC_WS_URL=ws://localhost:8080
```

```typescript
// hooks/use-multiplayer.ts で使用
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8080'
```

### Step 2: next.config.ts を本番向けに仕上げる

```typescript
// next.config.ts
import type { NextConfig } from 'next'

let withBundleAnalyzer: (config: NextConfig) => NextConfig
try {
  withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env.ANALYZE === 'true',
  })
} catch {
  withBundleAnalyzer = (config) => config
}

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        buffer: false,
      }
    }
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    })
    return config
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['@babylonjs/core', '@babylonjs/gui'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
      {
        source: '/models/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/audio/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/env/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}

export default withBundleAnalyzer(nextConfig)
```

### Step 3: Vercel にデプロイする

```bash
# Vercel CLI をインストール
npm install -g vercel

# デプロイ
vercel

# 本番デプロイ
vercel --prod
```

Vercel ダッシュボードで環境変数を設定：
- `NEXT_PUBLIC_WS_URL` = `wss://your-server.railway.app`

### Step 4: Railway で WebSocket サーバーをデプロイする

1. `railway.json` を作成（後述の全体コード参照）
2. [railway.app](https://railway.app) でプロジェクト作成
3. GitHub リポジトリを接続
4. `server/` ディレクトリを指定してデプロイ
5. 発行された URL を Vercel の環境変数に設定

---

## 全体コード

### `.env.local`

```bash
NEXT_PUBLIC_WS_URL=ws://localhost:8080
```

### `.env.local.example`（Git に含める）

```bash
NEXT_PUBLIC_WS_URL=ws://localhost:8080
```

### `.gitignore`（追記）

```
.env.local
.env.*.local
```

---

### `next.config.ts`

```typescript
import type { NextConfig } from 'next'

let withBundleAnalyzer: (config: NextConfig) => NextConfig
try {
  withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env.ANALYZE === 'true',
  })
} catch {
  withBundleAnalyzer = (config) => config
}

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        buffer: false,
      }
    }
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    })
    return config
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['@babylonjs/core', '@babylonjs/gui'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
      {
        source: '/models/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/audio/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/env/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}

export default withBundleAnalyzer(nextConfig)
```

---

### `railway.json`

```json
{
  "build": {
    "builder": "nixpacks",
    "buildCommand": "npm install"
  },
  "deploy": {
    "startCommand": "npx ts-node --project tsconfig.server.json server/ws-server.ts",
    "restartPolicyType": "on_failure",
    "restartPolicyMaxRetries": 10
  }
}
```

---

### `tsconfig.server.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node",
    "target": "ES2020",
    "outDir": "dist/server"
  },
  "include": ["server/**/*.ts"]
}
```

---

### `server/ws-server.ts`（本番対応版）

```typescript
import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'

const PORT = parseInt(process.env.PORT ?? '8080', 10)

interface Player {
  id: string
  name: string
  ws: WebSocket
}

interface Room {
  id: string
  players: Player[]
  hostId: string
}

const rooms = new Map<string, Room>()

const wss = new WebSocketServer({ port: PORT })

wss.on('listening', () => {
  console.log(`WebSocket server running on port ${PORT}`)
})

function broadcast(room: Room, message: object, excludeId?: string) {
  const data = JSON.stringify(message)
  for (const player of room.players) {
    if (player.id !== excludeId && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(data)
    }
  }
}

function broadcastAll(room: Room, message: object) {
  const data = JSON.stringify(message)
  for (const player of room.players) {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(data)
    }
  }
}

function getRoomState(room: Room) {
  return {
    type: 'ROOM_STATE',
    roomId: room.id,
    players: room.players.map(p => ({ id: p.id, name: p.name })),
    hostId: room.hostId,
  }
}

wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
  const playerId = Math.random().toString(36).slice(2, 10)
  let currentRoom: Room | null = null

  console.log(`Player connected: ${playerId}`)

  ws.on('message', (data: Buffer) => {
    let msg: { type: string; [key: string]: unknown }
    try {
      msg = JSON.parse(data.toString())
    } catch {
      return
    }

    switch (msg.type) {
      case 'JOIN_ROOM': {
        const roomId = (msg.roomId as string) ?? 'default'
        const playerName = (msg.playerName as string) ?? 'Player'

        if (!rooms.has(roomId)) {
          rooms.set(roomId, { id: roomId, players: [], hostId: playerId })
        }

        const room = rooms.get(roomId)!
        if (room.players.length >= 2) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Room is full' }))
          return
        }

        const player: Player = { id: playerId, name: playerName, ws }
        room.players.push(player)
        currentRoom = room

        ws.send(JSON.stringify({ type: 'JOINED', playerId, roomId }))
        broadcast(room, { type: 'PLAYER_JOINED', playerId, playerName }, playerId)
        broadcastAll(room, getRoomState(room))
        break
      }

      case 'PLACE_TOWER': {
        if (!currentRoom) return
        broadcast(currentRoom, {
          type: 'TOWER_PLACED',
          playerId,
          x: msg.x,
          z: msg.z,
          towerType: msg.towerType,
        }, playerId)
        break
      }

      case 'GAME_EVENT': {
        if (!currentRoom) return
        broadcast(currentRoom, {
          type: 'GAME_EVENT',
          playerId,
          event: msg.event,
        }, playerId)
        break
      }

      case 'PING': {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: msg.timestamp }))
        break
      }
    }
  })

  ws.on('close', () => {
    console.log(`Player disconnected: ${playerId}`)
    if (!currentRoom) return

    currentRoom.players = currentRoom.players.filter(p => p.id !== playerId)
    broadcast(currentRoom, { type: 'PLAYER_LEFT', playerId })

    if (currentRoom.players.length === 0) {
      rooms.delete(currentRoom.id)
      console.log(`Room ${currentRoom.id} deleted`)
    } else if (currentRoom.hostId === playerId) {
      currentRoom.hostId = currentRoom.players[0].id
      broadcastAll(currentRoom, getRoomState(currentRoom))
    }
  })

  ws.on('error', (err) => {
    console.error(`WebSocket error for player ${playerId}:`, err.message)
  })
})

process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...')
  wss.close(() => process.exit(0))
})
```

---

### `hooks/use-multiplayer.ts`（環境変数対応版）

```typescript
'use client'

import { useEffect, useRef, useCallback } from 'react'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8080'

interface MultiplayerOptions {
  roomId: string
  playerName: string
  onPlayerJoined?: (playerId: string, playerName: string) => void
  onPlayerLeft?: (playerId: string) => void
  onTowerPlaced?: (playerId: string, x: number, z: number, towerType: string) => void
  onRoomState?: (players: Array<{ id: string; name: string }>) => void
}

export function useMultiplayer({
  roomId,
  playerName,
  onPlayerJoined,
  onPlayerLeft,
  onTowerPlaced,
  onRoomState,
}: MultiplayerOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomId, playerName }))

      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }))
        }
      }, 30000)
    }

    ws.onmessage = (event: MessageEvent) => {
      let msg: { type: string; [key: string]: unknown }
      try {
        msg = JSON.parse(event.data as string)
      } catch {
        return
      }

      switch (msg.type) {
        case 'PLAYER_JOINED':
          onPlayerJoined?.(msg.playerId as string, msg.playerName as string)
          break
        case 'PLAYER_LEFT':
          onPlayerLeft?.(msg.playerId as string)
          break
        case 'TOWER_PLACED':
          onTowerPlaced?.(
            msg.playerId as string,
            msg.x as number,
            msg.z as number,
            msg.towerType as string
          )
          break
        case 'ROOM_STATE':
          onRoomState?.(msg.players as Array<{ id: string; name: string }>)
          break
      }
    }

    ws.onerror = (err) => {
      console.error('WebSocket error:', err)
    }

    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
      ws.close()
    }
  }, [roomId, playerName, onPlayerJoined, onPlayerLeft, onTowerPlaced, onRoomState])

  const sendTowerPlaced = useCallback((x: number, z: number, towerType: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'PLACE_TOWER', x, z, towerType }))
  }, [])

  return { sendTowerPlaced }
}
```

---

### `vercel.json`

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "rewrites": [],
  "headers": []
}
```

---

### `package.json`（本番向けスクリプト追加）

```json
{
  "name": "next-babylon",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "analyze": "ANALYZE=true npm run build",
    "ws:dev": "ts-node --project tsconfig.server.json server/ws-server.ts",
    "dev:all": "concurrently \"npm run dev\" \"npm run ws:dev\""
  },
  "dependencies": {
    "@babylonjs/core": "^7.0.0",
    "@babylonjs/gui": "^7.0.0",
    "@babylonjs/havok": "^1.3.0",
    "@babylonjs/loaders": "^7.0.0",
    "@babylonjs/materials": "^7.0.0",
    "next": "^16.2.6",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "ws": "^8.18.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@next/bundle-analyzer": "^15.0.0",
    "@testing-library/react": "^16.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/ws": "^8.5.0",
    "@vitest/ui": "^2.0.0",
    "concurrently": "^9.0.0",
    "jsdom": "^25.0.0",
    "ts-node": "^10.9.0",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0"
  }
}
```

---

## 確認方法

```bash
# ローカルでビルド確認
npm run build
npm run start

# バンドル分析
npm run analyze

# 全サービス起動（フロント + WebSocket）
npm run dev:all

# Vercel にデプロイ
vercel --prod
```

デプロイ後のチェックリスト：
- [ ] HTTPS で WebGL が動作する
- [ ] WebAudio が再生される（ユーザー操作後）
- [ ] WebSocket が wss:// で接続できる
- [ ] `/models/`, `/audio/` のキャッシュヘッダーが正しく返る（DevTools > Network で確認）
- [ ] Havok 物理エンジンが初期化される（COOP/COEP ヘッダー確認）
