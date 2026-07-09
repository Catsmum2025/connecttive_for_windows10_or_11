// Copyright 2026 Catsmum2025
// MIT License

import { useEffect, useRef, useCallback, useState } from 'react'
import type { GameMessage, ElectronAPI } from '../types'

export interface NetworkGameState {
  isConnected: boolean
  connectionError: string | null
  sendMove: (payload: Record<string, unknown>) => void
  sendGameOver: (payload: Record<string, unknown>) => void
  sendSyncBoard: (payload: Record<string, unknown>) => void
  sendRestartRequest: () => void
  sendRestartAccept: () => void
  sendRestartDecline: () => void
  sendRestartInvite: (targetIp: string, targetId: string, gameType: string) => void
  onOpponentMove: (callback: (payload: Record<string, unknown>) => void) => () => void
  onOpponentGameOver: (callback: (payload: Record<string, unknown>) => void) => () => void
  onSyncBoard: (callback: (payload: Record<string, unknown>) => void) => () => void
  onOpponentDisconnected: (callback: () => void) => () => void
  onRestartRequest: (callback: () => void) => () => void
  onRestartAccept: (callback: () => void) => () => void
  onRestartDecline: (callback: () => void) => () => void
}

export function useNetworkGame(
  myId: string | null,
  isHost: boolean,
  opponentId: string | null,
  opponentIp?: string | null
): NetworkGameState {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const moveCallbacks = useRef<Set<(payload: Record<string, unknown>) => void>>(new Set())
  const gameOverCallbacks = useRef<Set<(payload: Record<string, unknown>) => void>>(new Set())
  const syncBoardCallbacks = useRef<Set<(payload: Record<string, unknown>) => void>>(new Set())
  const disconnectCallbacks = useRef<Set<() => void>>(new Set())
  const restartRequestCallbacks = useRef<Set<() => void>>(new Set())
  const restartAcceptCallbacks = useRef<Set<() => void>>(new Set())
  const restartDeclineCallbacks = useRef<Set<() => void>>(new Set())

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api: ElectronAPI | null = typeof window !== 'undefined'
    ? ((window as any).__mockElectronAPI as ElectronAPI | undefined) ?? window.electronAPI ?? null
    : null

  // 监听游戏消息
  useEffect(() => {
    if (!api || !myId) return

    const unsubGameMsg = api.onGameMessage((msg: GameMessage) => {
      // 只处理发给我的消息，或者来自对手的消息
      if (msg.to && msg.to !== myId) return

      switch (msg.type) {
        case 'MOVE':
          moveCallbacks.current.forEach(cb => cb(msg.payload))
          break
        case 'GAME_OVER':
          gameOverCallbacks.current.forEach(cb => cb(msg.payload))
          break
        case 'SYNC_BOARD':
          syncBoardCallbacks.current.forEach(cb => cb(msg.payload))
          break
        case 'RESTART_REQUEST':
          restartRequestCallbacks.current.forEach(cb => cb())
          break
        case 'RESTART_ACCEPT':
          restartAcceptCallbacks.current.forEach(cb => cb())
          break
        case 'RESTART_DECLINE':
          restartDeclineCallbacks.current.forEach(cb => cb())
          break
      }
    })

    const unsubConnErr = api.onConnectionError((data) => {
      setConnectionError(`连接失败: ${data.error}`)
      setIsConnected(false)
    })

    const unsubConnClosed = api.onConnectionClosed(() => {
      setIsConnected(false)
      disconnectCallbacks.current.forEach(cb => cb())
    })

    // 标记已连接（在 TCP 连接建立后）
    setIsConnected(true)

    return () => {
      unsubGameMsg()
      unsubConnErr()
      unsubConnClosed()
    }
  }, [api, myId])

  const sendMessage = useCallback(
    (type: 'MOVE' | 'GAME_OVER' | 'SYNC_BOARD' | 'RESTART_REQUEST' | 'RESTART_ACCEPT' | 'RESTART_DECLINE', payload: Record<string, unknown>) => {
      if (!api || !myId || !opponentId) return
      const msg: GameMessage = {
        type,
        from: myId,
        to: opponentId,
        payload
      }
      // 始终通过 TCP 发送（局域网使用）
      api.sendGameMessage(msg)
      // 如果有 opponentIp，也通过 UDP 发送（远程联机使用）
      if (opponentIp) {
        api.sendGameMessageUdp(opponentIp, msg)
      }
    },
    [api, myId, opponentId, opponentIp]
  )

  const sendMove = useCallback(
    (payload: Record<string, unknown>) => sendMessage('MOVE', payload),
    [sendMessage]
  )

  const sendGameOver = useCallback(
    (payload: Record<string, unknown>) => sendMessage('GAME_OVER', payload),
    [sendMessage]
  )

  const sendSyncBoard = useCallback(
    (payload: Record<string, unknown>) => sendMessage('SYNC_BOARD', payload),
    [sendMessage]
  )

  const onOpponentMove = useCallback(
    (callback: (payload: Record<string, unknown>) => void) => {
      moveCallbacks.current.add(callback)
      return () => { moveCallbacks.current.delete(callback) }
    },
    []
  )

  const onOpponentGameOver = useCallback(
    (callback: (payload: Record<string, unknown>) => void) => {
      gameOverCallbacks.current.add(callback)
      return () => { gameOverCallbacks.current.delete(callback) }
    },
    []
  )

  const onSyncBoard = useCallback(
    (callback: (payload: Record<string, unknown>) => void) => {
      syncBoardCallbacks.current.add(callback)
      return () => { syncBoardCallbacks.current.delete(callback) }
    },
    []
  )

  const onOpponentDisconnected = useCallback(
    (callback: () => void) => {
      disconnectCallbacks.current.add(callback)
      return () => { disconnectCallbacks.current.delete(callback) }
    },
    []
  )

  const sendRestartRequest = useCallback(
    () => sendMessage('RESTART_REQUEST', {}),
    [sendMessage]
  )

  const sendRestartAccept = useCallback(
    () => sendMessage('RESTART_ACCEPT', {}),
    [sendMessage]
  )

  const sendRestartDecline = useCallback(
    () => sendMessage('RESTART_DECLINE', {}),
    [sendMessage]
  )

  const sendRestartInvite = useCallback(
    (targetIp: string, targetId: string, gameType: string) => {
      if (!api) return
      api.sendRestartInvite(targetIp, targetId, gameType)
    },
    [api]
  )

  const onRestartRequest = useCallback(
    (callback: () => void) => {
      restartRequestCallbacks.current.add(callback)
      return () => { restartRequestCallbacks.current.delete(callback) }
    },
    []
  )

  const onRestartAccept = useCallback(
    (callback: () => void) => {
      restartAcceptCallbacks.current.add(callback)
      return () => { restartAcceptCallbacks.current.delete(callback) }
    },
    []
  )

  const onRestartDecline = useCallback(
    (callback: () => void) => {
      restartDeclineCallbacks.current.add(callback)
      return () => { restartDeclineCallbacks.current.delete(callback) }
    },
    []
  )

  return {
    isConnected,
    connectionError,
    sendMove,
    sendGameOver,
    sendSyncBoard,
    sendRestartRequest,
    sendRestartAccept,
    sendRestartDecline,
    sendRestartInvite,
    onOpponentMove,
    onOpponentGameOver,
    onSyncBoard,
    onOpponentDisconnected,
    onRestartRequest,
    onRestartAccept,
    onRestartDecline
  }
}