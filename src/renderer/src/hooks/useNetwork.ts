// Copyright 2026 Catsmum2025
// MIT License

import { useEffect, useRef, useCallback, useState } from 'react'
import type { PlayerInfo, ElectronAPI, GameMessage, GameRoom } from '../types'

// 浏览器兼容层 — 在非 Electron 环境下使用模拟数据
function getAPI(): ElectronAPI {
  if (window.electronAPI) return window.electronAPI

  const mockPlayers: PlayerInfo[] = []
  const listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map()

  function addListener(channel: string, cb: (...args: unknown[]) => void): () => void {
    if (!listeners.has(channel)) listeners.set(channel, new Set())
    listeners.get(channel)!.add(cb)
    return () => listeners.get(channel)?.delete(cb)
  }

  const mockAPI: ElectronAPI = {
    setPlayerName: async (_name: string) => true,
    getMyInfo: async () => ({
      id: 'browser-player',
      name: 'BrowserPlayer',
      ip: '127.0.0.1',
      lastSeen: Date.now()
    }),
    getOnlinePlayers: async () => mockPlayers,
    getCurrentRoom: async () => null,
    getTcpServerPort: async () => 0,

    sendInvite: async () => true,
    acceptInvite: async () => ({ roomId: '', hostId: '', guestId: '', hostName: '', guestName: '', hostPort: 0, spectators: [], gameType: '' }),
    rejectInvite: async () => true,
    connectToHost: async () => true,
    sendGameMessage: async () => true,
    sendGameMessageUdp: async () => true,
    sendRestartInvite: async () => true,
    getPendingInvite: async () => [],
    getMyIp: async () => '127.0.0.1',
    getPublicIp: async () => '1.2.3.4',
    getRemotePlayers: async () => [],
    startPunching: async () => true,
    stopPunching: async () => true,
    sendRemoteInvite: async () => true,

    encryptIp: async () => '',
    decryptIp: async () => '',

    onPlayersUpdate: (cb: (players: PlayerInfo[]) => void) =>
      addListener('players-update', cb as (...args: unknown[]) => void),
    onRoomUpdate: (cb: (room: GameRoom) => void) =>
      addListener('room-update', cb as (...args: unknown[]) => void),
    onGameMessage: (cb: (msg: GameMessage) => void) =>
      addListener('game-message', cb as (...args: unknown[]) => void),
    onClientDisconnected: (cb: (clientId: string) => void) =>
      addListener('client-disconnected', cb as (...args: unknown[]) => void),
    onConnectionError: (cb: (data: { ip: string; port: number; error: string }) => void) =>
      addListener('connection-error', cb as (...args: unknown[]) => void),
    onConnectionClosed: (cb: (data: { ip: string; port: number }) => void) =>
      addListener('connection-closed', cb as (...args: unknown[]) => void),
    onInviteReceived: (cb: (data: { from: string; fromIp: string; fromName: string; gameType: string; hostPort: number }) => void) =>
      addListener('invite-received', cb as (...args: unknown[]) => void),
    onInviteAccepted: (cb: (data: { from: string; fromIp: string; gameType: string; room?: GameRoom }) => void) =>
      addListener('invite-accepted', cb as (...args: unknown[]) => void),
    onInviteRejected: (cb: (data: { from: string; fromIp: string; reason: string }) => void) =>
      addListener('invite-rejected', cb as (...args: unknown[]) => void),
    onRemotePlayerJoined: (cb: (player: PlayerInfo) => void) =>
      addListener('remote-player-joined', cb as (...args: unknown[]) => void),
    onPunchSuccess: (cb: (data: { ip: string; player: unknown }) => void) =>
      addListener('punch-success', cb as (...args: unknown[]) => void),

    removeAllListeners: (_channel: string) => {}
  }
  return mockAPI
}

export function useNetwork() {
  const api = useRef(getAPI())
  const [myInfo, setMyInfo] = useState<PlayerInfo | null>(null)
  const [onlinePlayers, setOnlinePlayers] = useState<PlayerInfo[]>([])
  const [tcpPort, setTcpPort] = useState(0)

  useEffect(() => {
    api.current.getMyInfo().then(setMyInfo)
    api.current.getOnlinePlayers().then(setOnlinePlayers)
    api.current.getTcpServerPort().then(setTcpPort)

    const unsub1 = api.current.onPlayersUpdate((players) => {
      setOnlinePlayers(players)
    })

    return () => {
      unsub1()
    }
  }, [])

  const setPlayerName = useCallback(async (name: string) => {
    await api.current.setPlayerName(name)
    const info = await api.current.getMyInfo()
    setMyInfo(info)
  }, [])

  const refreshPlayers = useCallback(async () => {
    const players = await api.current.getOnlinePlayers()
    setOnlinePlayers(players)
  }, [])

  return {
    api: api.current,
    myInfo,
    onlinePlayers,
    tcpPort,
    setPlayerName,
    refreshPlayers
  }
}