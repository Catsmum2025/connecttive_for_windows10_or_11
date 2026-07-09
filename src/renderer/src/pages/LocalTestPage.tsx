// Copyright 2026 Catsmum2025
// MIT License

import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Monitor, RefreshCw, User, UserCheck } from 'lucide-react'
import { useTheme } from '../components/ThemeContext'
import { GAME_NAMES } from '../game/config'
import { TicTacToeBoard } from '../components/game/TicTacToeBoard'
import { GomokuBoard } from '../components/game/GomokuBoard'
import { ChessBoard } from '../components/game/ChessBoard'
import { ChineseChessBoard } from '../components/game/ChineseChessBoard'
import { GoBoard } from '../components/game/GoBoard'
import { JunqiBoard } from '../components/game/JunqiBoard'
import type { GameRoom, GameMessage } from '../types'

// 模拟网络事件总线
type Listener = (...args: unknown[]) => void
const mockEventBus = new Map<string, Set<Listener>>()

function mockEmit(channel: string, ...args: unknown[]) {
  const listeners = mockEventBus.get(channel)
  if (listeners) {
    listeners.forEach(fn => fn(...args))
  }
}

function mockOn(channel: string, cb: Listener): () => void {
  if (!mockEventBus.has(channel)) mockEventBus.set(channel, new Set())
  mockEventBus.get(channel)!.add(cb)
  return () => mockEventBus.get(channel)?.delete(cb)
}

function createMockRoom(): GameRoom {
  return {
    roomId: `test-${Date.now()}`,
    hostId: 'test-host',
    guestId: 'test-guest',
    hostName: '测试玩家A（主机）',
    guestName: '测试玩家B（客机）',
    hostPort: 0,
    spectators: [],
    gameType: ''
  }
}

// 声明 mock 全局变量
declare global {
  interface Window {
    __mockElectronAPI?: unknown
  }
}

export function LocalTestPage(): React.ReactElement {
  const { gameType } = useParams<{ gameType: string }>()
  const navigate = useNavigate()
  const { bgGradient, bgOverlay, textSecondary, textMuted, borderColor } = useTheme()
  const [currentView, setCurrentView] = useState<'host' | 'guest'>('host')
  const [room] = useState<GameRoom>(() => {
    const r = createMockRoom()
    r.gameType = gameType || 'tictactoe'
    return r
  })
  const mockSetup = useRef(false)
  const currentViewRef = useRef<'host' | 'guest'>('host')
  currentViewRef.current = currentView

  // 设置模拟 network API（不覆盖只读的 window.electronAPI）
  useEffect(() => {
    if (mockSetup.current) return
    mockSetup.current = true

    const mockAPI = {
      setPlayerName: async () => true,
      getMyInfo: async () => ({
        id: currentViewRef.current === 'host' ? 'test-host' : 'test-guest',
        name: currentViewRef.current === 'host' ? '测试玩家A' : '测试玩家B',
        ip: '127.0.0.1',
        lastSeen: Date.now()
      }),
      getOnlinePlayers: async () => [],
      getCurrentRoom: async () => room,
      getTcpServerPort: async () => 0,
      sendInvite: async () => true,
      acceptInvite: async () => room,
      rejectInvite: async () => true,
      connectToHost: async () => true,

      sendGameMessage: async (msg: GameMessage) => {
        setTimeout(() => {
          mockEmit('game-message', msg)
        }, 50)
        return true
      },

      onPlayersUpdate: (cb: Listener) => mockOn('players-update', cb),
      onRoomUpdate: (cb: Listener) => mockOn('room-update', cb),
      onGameMessage: (cb: Listener) => mockOn('game-message', cb),
      onClientDisconnected: (cb: Listener) => mockOn('client-disconnected', cb),
      onConnectionError: (cb: Listener) => mockOn('connection-error', cb),
      onConnectionClosed: (cb: Listener) => mockOn('connection-closed', cb),
      onInviteReceived: (cb: Listener) => mockOn('invite-received', cb),
      onInviteAccepted: (cb: Listener) => mockOn('invite-accepted', cb),
      onInviteRejected: (cb: Listener) => mockOn('invite-rejected', cb),
      removeAllListeners: () => {}
    }

    window.__mockElectronAPI = mockAPI

    return () => {
      mockEventBus.clear()
      mockSetup.current = false
      delete window.__mockElectronAPI
    }
  }, [room])

  const networkProps = {
    room,
    myId: currentView === 'host' ? 'test-host' : 'test-guest',
    isHost: currentView === 'host',
    opponentId: currentView === 'host' ? 'test-guest' : 'test-host',
    opponentName: currentView === 'host' ? '测试玩家B（客机）' : '测试玩家A（主机）',
    opponentIp: '127.0.0.1'
  }

  const gameName = GAME_NAMES[gameType || ''] || '游戏'

  const renderBoard = () => {
    switch (gameType) {
      case 'tictactoe':
        return <TicTacToeBoard network={networkProps} />
      case 'gomoku':
        return <GomokuBoard network={networkProps} />
      case 'chess':
        return <ChessBoard network={networkProps} />
      case 'chinesechess':
        return <ChineseChessBoard network={networkProps} />
      case 'go':
        return <GoBoard network={networkProps} />
      case 'junqi':
        return <JunqiBoard network={networkProps} />
      default:
        return <TicTacToeBoard network={networkProps} />
    }
  }

  return (
    <section className="relative w-full min-h-screen overflow-hidden">
      <div className="absolute inset-0" style={{ background: bgGradient }} />
      <div className="absolute inset-0" style={{ background: bgOverlay }} />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* 测试模式工具栏 */}
        <div className="flex items-center justify-between px-4 py-2 border-b backdrop-blur-sm" style={{
          background: 'rgba(48, 82, 78, 0.3)',
          borderColor: borderColor
        }}>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-sm transition-all duration-200"
              style={{ color: textSecondary }}
            >
              <ArrowLeft className="h-4 w-4" />
              退出测试
            </button>
            <div className="flex items-center gap-2 rounded-full px-3 py-1 text-xs" style={{
              background: 'rgba(244, 157, 77, 0.15)',
              color: '#F49D4D'
            }}>
              <Monitor className="h-3 w-3" />
              本地测试模式
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: textMuted }}>当前视角:</span>
            <button
              onClick={() => setCurrentView('host')}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
              style={currentView === 'host'
                ? { background: '#F49D4D', color: '#2B312C' }
                : { background: 'rgba(255,255,255,0.08)', color: textSecondary }
              }
            >
              {currentView === 'host' ? <UserCheck className="h-3 w-3" /> : <User className="h-3 w-3" />}
              主机 (先手)
            </button>
            <button
              onClick={() => setCurrentView('guest')}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
              style={currentView === 'guest'
                ? { background: '#74754F', color: '#FFFFFF' }
                : { background: 'rgba(255,255,255,0.08)', color: textSecondary }
              }
            >
              {currentView === 'guest' ? <UserCheck className="h-3 w-3" /> : <User className="h-3 w-3" />}
              客机 (后手)
            </button>
            <button
              onClick={() => {
                mockEventBus.clear()
                mockSetup.current = false
                delete window.__mockElectronAPI
                window.location.reload()
              }}
              className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs"
              style={{ color: textMuted }}
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* 测试说明 */}
        <div className="px-4 py-2 text-center">
          <p className="text-xs" style={{ color: textMuted }}>
            {gameName} 本地测试 · 切换「主机/客机」视角来模拟两个玩家
          </p>
        </div>

        {/* 游戏棋盘 */}
        <div className="flex-1">
          {renderBoard()}
        </div>
      </div>
    </section>
  )
}