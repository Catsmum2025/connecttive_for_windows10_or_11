// Copyright 2026 Catsmum2025
// MIT License

import { contextBridge, ipcRenderer } from 'electron'
import type { PlayerInfo, GameRoom, GameMessage } from '../main/network'

const api = {
  // 玩家信息
  setPlayerName: (name: string) => ipcRenderer.invoke('set-player-name', name),
  getMyInfo: () => ipcRenderer.invoke('get-my-info') as Promise<PlayerInfo>,
  getOnlinePlayers: () => ipcRenderer.invoke('get-online-players') as Promise<PlayerInfo[]>,
  getCurrentRoom: () => ipcRenderer.invoke('get-current-room') as Promise<GameRoom | null>,
  getTcpServerPort: () => ipcRenderer.invoke('get-tcp-server-port') as Promise<number>,

  // 邀请相关
  sendInvite: (targetIp: string, targetId: string, gameType: string) =>
    ipcRenderer.invoke('send-invite', targetIp, targetId, gameType),
  acceptInvite: (targetIp: string, targetId: string, hostId: string, hostName: string, guestName: string, gameType: string) =>
    ipcRenderer.invoke('accept-invite', targetIp, targetId, hostId, hostName, guestName, gameType),
  rejectInvite: (targetIp: string, targetId: string, reason: string) =>
    ipcRenderer.invoke('reject-invite', targetIp, targetId, reason),
  connectToHost: (hostIp: string, hostPort: number) =>
    ipcRenderer.invoke('connect-to-host', hostIp, hostPort),

  // 游戏消息
  sendGameMessage: (msg: GameMessage) =>
    ipcRenderer.invoke('send-game-message', msg),
  sendGameMessageUdp: (targetIp: string, msg: GameMessage) =>
    ipcRenderer.invoke('send-game-message-udp', targetIp, msg),

  // 再来一局邀请（UDP）
  sendRestartInvite: (targetIp: string, targetId: string, gameType: string) =>
    ipcRenderer.invoke('send-restart-invite', targetIp, targetId, gameType),

  // 远程联机
  getMyIp: () => ipcRenderer.invoke('get-my-ip') as Promise<string>,
  getPublicIp: () => ipcRenderer.invoke('get-public-ip') as Promise<string>,
  getRemotePlayers: () => ipcRenderer.invoke('get-remote-players') as Promise<PlayerInfo[]>,
  startPunching: (targetIp: string, playerName: string) =>
    ipcRenderer.invoke('start-punching', targetIp, playerName),
  stopPunching: () => ipcRenderer.invoke('stop-punching'),
  sendRemoteInvite: (targetIp: string, targetId: string, gameType: string) =>
    ipcRenderer.invoke('send-remote-invite', targetIp, targetId, gameType),

  // IP 加密/解密
  encryptIp: (ip: string) => ipcRenderer.invoke('encrypt-ip', ip) as Promise<string>,
  decryptIp: (code: string) => ipcRenderer.invoke('decrypt-ip', code) as Promise<string>,

  // 事件监听
  onPlayersUpdate: (callback: (players: PlayerInfo[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, players: PlayerInfo[]) => callback(players)
    ipcRenderer.on('players-update', handler)
    return () => ipcRenderer.removeListener('players-update', handler)
  },
  onRoomUpdate: (callback: (room: GameRoom) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, room: GameRoom) => callback(room)
    ipcRenderer.on('room-update', handler)
    return () => ipcRenderer.removeListener('room-update', handler)
  },
  onGameMessage: (callback: (msg: GameMessage) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, msg: GameMessage) => callback(msg)
    ipcRenderer.on('game-message', handler)
    return () => ipcRenderer.removeListener('game-message', handler)
  },
  onClientDisconnected: (callback: (clientId: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, clientId: string) => callback(clientId)
    ipcRenderer.on('client-disconnected', handler)
    return () => ipcRenderer.removeListener('client-disconnected', handler)
  },
  onConnectionError: (callback: (data: { ip: string; port: number; error: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { ip: string; port: number; error: string }) => callback(data)
    ipcRenderer.on('connection-error', handler)
    return () => ipcRenderer.removeListener('connection-error', handler)
  },
  onConnectionClosed: (callback: (data: { ip: string; port: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { ip: string; port: number }) => callback(data)
    ipcRenderer.on('connection-closed', handler)
    return () => ipcRenderer.removeListener('connection-closed', handler)
  },
  onInviteReceived: (callback: (data: { from: string; fromIp: string; fromName: string; gameType: string; hostPort: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { from: string; fromIp: string; fromName: string; gameType: string; hostPort: number }) => callback(data)
    ipcRenderer.on('invite-received', handler)
    return () => ipcRenderer.removeListener('invite-received', handler)
  },
  onInviteAccepted: (callback: (data: { from: string; fromIp: string; gameType: string; room?: GameRoom }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { from: string; fromIp: string; gameType: string; room?: GameRoom }) => callback(data)
    ipcRenderer.on('invite-accepted', handler)
    return () => ipcRenderer.removeListener('invite-accepted', handler)
  },
  onInviteRejected: (callback: (data: { from: string; fromIp: string; reason: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { from: string; fromIp: string; reason: string }) => callback(data)
    ipcRenderer.on('invite-rejected', handler)
    return () => ipcRenderer.removeListener('invite-rejected', handler)
  },

  onRemotePlayerJoined: (callback: (player: PlayerInfo) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, player: PlayerInfo) => callback(player)
    ipcRenderer.on('remote-player-joined', handler)
    return () => ipcRenderer.removeListener('remote-player-joined', handler)
  },

  onPunchSuccess: (callback: (data: { ip: string; player: unknown }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { ip: string; player: unknown }) => callback(data)
    ipcRenderer.on('punch-success', handler)
    return () => ipcRenderer.removeListener('punch-success', handler)
  },

  // 获取待处理的邀请（大厅挂载时拉取）
  getPendingInvite: () => ipcRenderer.invoke('get-pending-invite'),

  // 通用事件发送（用于清理所有监听器）
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electronAPI = api
}