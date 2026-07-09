// Copyright 2026 Catsmum2025
// MIT License

// 与 preload/index.d.ts 保持同步的类型定义
// 浏览器环境下无法直接 import 主进程模块

export interface PlayerInfo {
  id: string
  name: string
  ip: string
  lastSeen: number
}

export interface GameRoom {
  roomId: string
  hostId: string
  guestId: string
  hostName: string
  guestName: string
  hostPort: number
  spectators: string[]
  gameType: string
}

export interface GameMessage {
  type: 'INVITE' | 'ACCEPT' | 'REJECT' | 'MOVE' | 'GAME_OVER' | 'SYNC_BOARD' | 'SPECTATE_JOIN' | 'SPECTATE_LEAVE' | 'ROOM_INFO' | 'RESTART_REQUEST' | 'RESTART_ACCEPT' | 'RESTART_DECLINE' | 'PUNCH' | 'PONG' | 'REMOTE_HELLO'
  from: string
  to?: string
  payload: Record<string, unknown>
}

export interface InviteReceivedData {
  from: string
  fromIp: string
  fromName: string
  gameType: string
  hostPort: number
}

export interface InviteAcceptedData {
  from: string
  fromIp: string
  gameType: string
  room?: GameRoom
}

export interface InviteRejectedData {
  from: string
  fromIp: string
  reason: string
}

export interface ElectronAPI {
  setPlayerName: (name: string) => Promise<boolean>
  getMyInfo: () => Promise<PlayerInfo>
  getOnlinePlayers: () => Promise<PlayerInfo[]>
  getCurrentRoom: () => Promise<GameRoom | null>
  getTcpServerPort: () => Promise<number>

  sendInvite: (targetIp: string, targetId: string, gameType: string) => Promise<boolean>
  acceptInvite: (targetIp: string, targetId: string, hostId: string, hostName: string, guestName: string, gameType: string) => Promise<GameRoom>
  rejectInvite: (targetIp: string, targetId: string, reason: string) => Promise<boolean>
  connectToHost: (hostIp: string, hostPort: number) => Promise<boolean>
  sendGameMessage: (msg: GameMessage) => Promise<boolean>
  sendGameMessageUdp: (targetIp: string, msg: GameMessage) => Promise<boolean>
  sendRestartInvite: (targetIp: string, targetId: string, gameType: string) => Promise<boolean>
  getPendingInvite: () => Promise<{ from: string; fromIp: string; fromName: string; gameType: string; hostPort: number; timestamp: number }[]>

  getMyIp: () => Promise<string>
  getPublicIp: () => Promise<string>
  getRemotePlayers: () => Promise<PlayerInfo[]>
  startPunching: (targetIp: string, playerName: string) => Promise<boolean>
  stopPunching: () => Promise<boolean>
  sendRemoteInvite: (targetIp: string, targetId: string, gameType: string) => Promise<boolean>

  encryptIp: (ip: string) => Promise<string>
  decryptIp: (code: string) => Promise<string>

  onPlayersUpdate: (callback: (players: PlayerInfo[]) => void) => () => void
  onRoomUpdate: (callback: (room: GameRoom) => void) => () => void
  onGameMessage: (callback: (msg: GameMessage) => void) => () => void
  onClientDisconnected: (callback: (clientId: string) => void) => () => void
  onConnectionError: (callback: (data: { ip: string; port: number; error: string }) => void) => () => void
  onConnectionClosed: (callback: (data: { ip: string; port: number }) => void) => () => void
  onInviteReceived: (callback: (data: InviteReceivedData) => void) => () => void
  onInviteAccepted: (callback: (data: InviteAcceptedData) => void) => () => void
  onInviteRejected: (callback: (data: InviteRejectedData) => void) => () => void
  onRemotePlayerJoined: (callback: (player: PlayerInfo) => void) => () => void
  onPunchSuccess: (callback: (data: { ip: string; player: unknown }) => void) => () => void

  removeAllListeners: (channel: string) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}