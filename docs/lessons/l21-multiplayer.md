# L21 — マルチプレイヤー基礎（WebSocket）

## 概要

WebSocket を使った 2 人協力プレイを実装する。タワー設置アクションをリアルタイムで同期する。

**ゲームへの貢献**: 2 ブラウザタブ（または別の PC）で協力してタワーを設置し、一緒にゲームをプレイできる。

---

## 概念解説

### ゲームの同期戦略

| 戦略 | 特徴 | 遅延耐性 |
|---|---|---|
| **State Sync** | サーバーが状態を全員に配信 | 高い（簡単） |
| **Input Relay** | 入力だけ共有、計算は各クライアント | 普通 |
| **Lockstep** | 全員の入力を集めてから 1 フレーム進む | 低い（複雑） |

タワーディフェンスの「タワー設置」は頻度が低いため **State Sync** が適切。

### WebSocket サーバーの実装方法

Next.js 16 の Route Handler は WebSocket をサポートしない（Serverless 制約）。  
以下の選択肢がある：

1. **Next.js Custom Server** — `server.ts` で Node.js サーバーを直接動かす（開発時）
2. **独立した WebSocket サーバー** — 別ポートで ws ライブラリを使う
3. **Cloudflare Durable Objects** — 本番向け、WebSocket に特化
4. **Partykit** — ゲーム向けのリアルタイムサービス

このレッスンでは**開発時のローカル WebSocket サーバー**を実装する。

### WebSocket プロトコル設計

```typescript
// クライアント → サーバー
type ClientMessage =
  | { type: 'JOIN_ROOM'; roomId: string; playerName: string }
  | { type: 'PLACE_TOWER'; x: number; z: number; towerType: string }
  | { type: 'PING' }

// サーバー → クライアント
type ServerMessage =
  | { type: 'ROOM_STATE'; players: Player[]; towers: TowerState[]; wave: number }
  | { type: 'PLAYER_JOINED'; player: Player }
  | { type: 'PLAYER_LEFT'; playerId: string }
  | { type: 'TOWER_PLACED'; x: number; z: number; towerType: string; placedBy: string }
  | { type: 'WAVE_STARTED'; wave: number }
  | { type: 'PONG' }
```

---

## インストール

```bash
npm install ws
npm install -D @types/ws
```

---

## 実装手順

### Step 1: WebSocket サーバーを作る

```typescript
// server/ws-server.ts
import { WebSocketServer, WebSocket } from 'ws'

interface Player {
  id: string
  name: string
  ws: WebSocket
  roomId: string
}

interface TowerState {
  x: number
  z: number
  towerType: string
  placedBy: string
}

interface Room {
  id: string
  players: Map<string, Player>
  towers: TowerState[]
  wave: number
}

const wss = new WebSocketServer({ port: 8080 })
const rooms = new Map<string, Room>()

function getOrCreateRoom(roomId: string): Room {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { id: roomId, players: new Map(), towers: [], wave: 1 })
  }
  return rooms.get(roomId)!
}

function broadcast(room: Room, message: object, excludeId?: string): void {
  const json = JSON.stringify(message)
  for (const [id, player] of room.players) {
    if (id !== excludeId && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(json)
    }
  }
}

wss.on('connection', (ws) => {
  let currentPlayer: Player | null = null

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString())

    if (msg.type === 'JOIN_ROOM') {
      const room = getOrCreateRoom(msg.roomId)
      currentPlayer = {
        id: `${Date.now()}_${Math.random()}`,
        name: msg.playerName,
        ws,
        roomId: msg.roomId,
      }
      room.players.set(currentPlayer.id, currentPlayer)

      // 現在の状態を送信
      ws.send(JSON.stringify({
        type: 'ROOM_STATE',
        playerId: currentPlayer.id,
        players: [...room.players.values()].map(p => ({ id: p.id, name: p.name })),
        towers: room.towers,
        wave: room.wave,
      }))

      // 他のプレイヤーに通知
      broadcast(room, { type: 'PLAYER_JOINED', player: { id: currentPlayer.id, name: currentPlayer.name } }, currentPlayer.id)
    }

    if (msg.type === 'PLACE_TOWER' && currentPlayer) {
      const room = rooms.get(currentPlayer.roomId)
      if (!room) return
      const tower: TowerState = { x: msg.x, z: msg.z, towerType: msg.towerType, placedBy: currentPlayer.id }
      room.towers.push(tower)
      broadcast(room, { type: 'TOWER_PLACED', ...tower }, currentPlayer.id)
    }

    if (msg.type === 'PING') {
      ws.send(JSON.stringify({ type: 'PONG' }))
    }
  })

  ws.on('close', () => {
    if (!currentPlayer) return
    const room = rooms.get(currentPlayer.roomId)
    if (!room) return
    room.players.delete(currentPlayer.id)
    broadcast(room, { type: 'PLAYER_LEFT', playerId: currentPlayer.id })
    if (room.players.size === 0) rooms.delete(currentPlayer.roomId)
  })
})

console.log('WebSocket server running on ws://localhost:8080')
```

### Step 2: サーバーを起動する script を追加する

```json
// package.json
{
  "scripts": {
    "ws-server": "ts-node server/ws-server.ts",
    "dev": "next dev",
    "dev:all": "concurrently \"npm run ws-server\" \"npm run dev\""
  }
}
```

```bash
npm install -D ts-node concurrently
```

### Step 3: クライアント側の WebSocket Hook を作る

```typescript
// hooks/use-multiplayer.ts
'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

interface MultiplayerPlayer {
  id: string
  name: string
}

interface TowerPlacedEvent {
  x: number
  z: number
  towerType: string
  placedBy: string
}

interface UseMultiplayerOptions {
  roomId: string
  playerName: string
  onTowerPlaced: (event: TowerPlacedEvent) => void
  onPlayerJoined: (player: MultiplayerPlayer) => void
  onPlayerLeft: (playerId: string) => void
}

export function useMultiplayer({
  roomId,
  playerName,
  onTowerPlaced,
  onPlayerJoined,
  onPlayerLeft,
}: UseMultiplayerOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [players, setPlayers] = useState<MultiplayerPlayer[]>([])
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null)

  useEffect(() => {
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8080'
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomId, playerName }))
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)

      if (msg.type === 'ROOM_STATE') {
        setMyPlayerId(msg.playerId)
        setPlayers(msg.players)
      }
      if (msg.type === 'PLAYER_JOINED') {
        setPlayers(prev => [...prev, msg.player])
        onPlayerJoined(msg.player)
      }
      if (msg.type === 'PLAYER_LEFT') {
        setPlayers(prev => prev.filter(p => p.id !== msg.playerId))
        onPlayerLeft(msg.playerId)
      }
      if (msg.type === 'TOWER_PLACED') {
        onTowerPlaced(msg)
      }
    }

    ws.onclose = () => {
      setConnected(false)
    }

    return () => {
      ws.close()
    }
  }, [roomId, playerName])

  const sendTowerPlaced = useCallback((x: number, z: number, towerType: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'PLACE_TOWER', x, z, towerType }))
    }
  }, [])

  return { connected, players, myPlayerId, sendTowerPlaced }
}
```

---

## ポイント解説

### タワー設置の同期方法
自分がタワーを設置したら：
1. ローカルに即座に反映（レスポンシブな操作感）
2. サーバーに送信
3. サーバーが他のプレイヤーに転送
4. 他のプレイヤーのゲームでタワーを設置

### ネットワーク切断への対処
`ws.onclose` イベントで再接続を試みる。  
接続が切れたときにプレイヤーを「接続中...」表示にする。

---

## 全体コード

### `server/ws-server.ts`

```typescript
import { WebSocketServer, WebSocket } from 'ws'

interface Player {
  id: string
  name: string
  ws: WebSocket
  roomId: string
  color: string
}

interface TowerState {
  x: number
  z: number
  towerType: string
  placedBy: string
}

interface Room {
  id: string
  players: Map<string, Player>
  towers: TowerState[]
  wave: number
}

const PLAYER_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444']
const wss = new WebSocketServer({ port: 8080 })
const rooms = new Map<string, Room>()

function getOrCreateRoom(roomId: string): Room {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { id: roomId, players: new Map(), towers: [], wave: 1 })
  }
  return rooms.get(roomId)!
}

function broadcast(room: Room, message: object, excludeId?: string): void {
  const json = JSON.stringify(message)
  for (const [id, player] of room.players) {
    if (id !== excludeId && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(json)
    }
  }
}

wss.on('connection', (ws) => {
  let currentPlayer: Player | null = null

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())

      if (msg.type === 'JOIN_ROOM') {
        const room = getOrCreateRoom(msg.roomId)
        const colorIdx = room.players.size % PLAYER_COLORS.length
        currentPlayer = {
          id: `player_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          name: msg.playerName ?? 'Player',
          ws,
          roomId: msg.roomId,
          color: PLAYER_COLORS[colorIdx],
        }
        room.players.set(currentPlayer.id, currentPlayer)

        ws.send(JSON.stringify({
          type: 'ROOM_STATE',
          playerId: currentPlayer.id,
          playerColor: currentPlayer.color,
          players: [...room.players.values()].map(p => ({ id: p.id, name: p.name, color: p.color })),
          towers: room.towers,
          wave: room.wave,
        }))

        broadcast(room, {
          type: 'PLAYER_JOINED',
          player: { id: currentPlayer.id, name: currentPlayer.name, color: currentPlayer.color },
        }, currentPlayer.id)
      }

      if (msg.type === 'PLACE_TOWER' && currentPlayer) {
        const room = rooms.get(currentPlayer.roomId)
        if (!room) return
        const tower: TowerState = {
          x: Math.round(msg.x),
          z: Math.round(msg.z),
          towerType: msg.towerType ?? 'basic',
          placedBy: currentPlayer.id,
        }
        // 重複チェック
        const dup = room.towers.some(t => t.x === tower.x && t.z === tower.z)
        if (!dup) {
          room.towers.push(tower)
          broadcast(room, { type: 'TOWER_PLACED', ...tower }, currentPlayer.id)
        }
      }

      if (msg.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }))
      }
    } catch {
      // JSON パースエラーは無視
    }
  })

  ws.on('close', () => {
    if (!currentPlayer) return
    const room = rooms.get(currentPlayer.roomId)
    if (room) {
      room.players.delete(currentPlayer.id)
      broadcast(room, { type: 'PLAYER_LEFT', playerId: currentPlayer.id })
      if (room.players.size === 0) rooms.delete(currentPlayer.roomId)
    }
  })
})

console.log('🚀 WebSocket server running on ws://localhost:8080')
```

---

### `hooks/use-multiplayer.ts`

```typescript
'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

export interface MPPlayer {
  id: string
  name: string
  color: string
}

interface UseMultiplayerOptions {
  roomId: string
  playerName: string
  enabled: boolean
  onTowerPlaced: (x: number, z: number, towerType: string, placedBy: string) => void
  onPlayerJoined: (player: MPPlayer) => void
  onPlayerLeft: (playerId: string) => void
  onRoomState: (players: MPPlayer[], towers: Array<{ x: number; z: number; towerType: string }>) => void
}

export function useMultiplayer({
  roomId, playerName, enabled,
  onTowerPlaced, onPlayerJoined, onPlayerLeft, onRoomState,
}: UseMultiplayerOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [players, setPlayers] = useState<MPPlayer[]>([])
  const [myId, setMyId] = useState<string | null>(null)
  const [myColor, setMyColor] = useState<string>('#3b82f6')
  const [latency, setLatency] = useState(0)

  useEffect(() => {
    if (!enabled) return

    const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8080'
    let pingInterval: ReturnType<typeof setInterval>
    let pingTime = 0

    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomId, playerName }))
        pingInterval = setInterval(() => {
          pingTime = Date.now()
          ws.send(JSON.stringify({ type: 'PING' }))
        }, 5000)
      }

      ws.onmessage = ({ data }) => {
        const msg = JSON.parse(data)
        if (msg.type === 'ROOM_STATE') {
          setMyId(msg.playerId)
          setMyColor(msg.playerColor)
          setPlayers(msg.players)
          onRoomState(msg.players, msg.towers)
        }
        if (msg.type === 'PLAYER_JOINED') {
          setPlayers(p => [...p, msg.player])
          onPlayerJoined(msg.player)
        }
        if (msg.type === 'PLAYER_LEFT') {
          setPlayers(p => p.filter(pl => pl.id !== msg.playerId))
          onPlayerLeft(msg.playerId)
        }
        if (msg.type === 'TOWER_PLACED') {
          onTowerPlaced(msg.x, msg.z, msg.towerType, msg.placedBy)
        }
        if (msg.type === 'PONG') {
          setLatency(Date.now() - pingTime)
        }
      }

      ws.onclose = () => {
        setConnected(false)
        clearInterval(pingInterval)
      }

      ws.onerror = () => { setConnected(false) }

      return () => {
        clearInterval(pingInterval)
        ws.close()
      }
    } catch {
      return
    }
  }, [enabled, roomId, playerName])

  const sendTowerPlaced = useCallback((x: number, z: number, towerType: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'PLACE_TOWER', x, z, towerType }))
    }
  }, [])

  return { connected, players, myId, myColor, latency, sendTowerPlaced }
}
```

---

### `components/game/MultiplayerLobby.tsx`

```tsx
'use client'

import { useState } from 'react'

interface MultiplayerLobbyProps {
  onJoin: (roomId: string, playerName: string) => void
  onCancel: () => void
}

export function MultiplayerLobby({ onJoin, onCancel }: MultiplayerLobbyProps) {
  const [roomId, setRoomId] = useState(() => Math.random().toString(36).slice(2, 8).toUpperCase())
  const [playerName, setPlayerName] = useState('')

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
      <div className="bg-gray-900 rounded-2xl p-8 w-96 text-white border border-gray-700">
        <h2 className="text-2xl font-bold mb-6 text-center">CO-OP PLAY</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">プレイヤー名</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              maxLength={12}
              className="w-full bg-black/50 border border-gray-600 text-white px-3 py-2 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">ルーム ID</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                className="flex-1 bg-black/50 border border-gray-600 text-white px-3 py-2 rounded-lg font-mono"
              />
              <button
                onClick={() => setRoomId(Math.random().toString(36).slice(2, 8).toUpperCase())}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
              >
                新規
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">友達に同じ ID を教えてください</p>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => playerName && onJoin(roomId, playerName)}
            disabled={!playerName}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-bold transition-colors"
          >
            参加する
          </button>
          <button onClick={onCancel} className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
            キャンセル
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## 確認方法

1. `npm run ws-server` でサーバーを起動
2. `npm run dev` でフロントエンドを起動
3. ブラウザを 2 タブ開いて同じルーム ID で参加
4. 一方のタブでタワーを設置すると、もう一方のタブにも表示される
