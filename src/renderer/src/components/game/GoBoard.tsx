// Copyright 2026 Catsmum2025
// MIT License

import { useState, useCallback, useEffect, useRef } from 'react'
import { ArrowLeft, Swords, Crown, Wifi, WifiOff, Check, X, SkipForward, ZoomIn, ZoomOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../ThemeContext'
import { Confetti } from '../Confetti'
import { useNetworkGame } from '../../hooks/useNetworkGame'
import type { GameRoom } from '../../types'
import {
  createInitialState,
  makeMove,
  pass,
  getGameStatus,
  BOARD_SIZE,
  type GoGameState,
  type Stone,
  type GameResult
} from '../../game/go'

interface NetworkProps {
  room: GameRoom
  myId: string
  isHost: boolean
  opponentId: string
  opponentName: string
  opponentIp: string
}

interface Props {
  network?: NetworkProps | null
}

// 星位坐标
const STAR_POINTS: [number, number][] = [
  [3, 3], [3, 9], [3, 15],
  [9, 3], [9, 9], [9, 15],
  [15, 3], [15, 9], [15, 15],
]

export function GoBoard({ network }: Props): React.ReactElement {
  const navigate = useNavigate()
  const { bgGradient, bgOverlay, textPrimary, textSecondary, textMuted, borderColor, mode } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<GoGameState>(createInitialState())
  const [gameStatus, setGameStatus] = useState<'playing' | 'win' | 'draw'>('playing')
  const [hoverCell, setHoverCell] = useState<[number, number] | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [message, setMessage] = useState('')
  const [canvasSize, setCanvasSize] = useState(600)
  const [zoom, setZoom] = useState(1)
  const isNetworkMode = !!network

  const myStone: Stone = network?.isHost ? 'black' : 'white'
  const netGame = useNetworkGame(
    network?.myId ?? null,
    network?.isHost ?? false,
    network?.opponentId ?? null,
    network?.opponentIp ?? null
  )
  const isMyTurn = !isNetworkMode || (state.currentTurn === myStone) && gameStatus === 'playing'
  const netGameRef = useRef(netGame)
  netGameRef.current = netGame

  // 自动调整 Canvas 大小
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const size = Math.min(containerRef.current.clientWidth - 32, 640)
        setCanvasSize(size)
      }
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // 绘制棋盘
  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const size = canvasSize * zoom
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    ctx.scale(dpr, dpr)

    const padding = 24
    const cellSize = (size - padding * 2) / (BOARD_SIZE - 1)
    const boardColor = mode === 'dark' ? '#D4A760' : '#DEB870'
    const lineColor = mode === 'dark' ? '#3A3022' : '#4A3828'

    // 背景
    ctx.fillStyle = boardColor
    ctx.fillRect(0, 0, size, size)

    // 网格线
    ctx.strokeStyle = lineColor
    ctx.lineWidth = 0.8
    for (let i = 0; i < BOARD_SIZE; i++) {
      const pos = padding + i * cellSize
      ctx.beginPath()
      ctx.moveTo(padding, pos)
      ctx.lineTo(padding + (BOARD_SIZE - 1) * cellSize, pos)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(pos, padding)
      ctx.lineTo(pos, padding + (BOARD_SIZE - 1) * cellSize)
      ctx.stroke()
    }

    // 星位
    STAR_POINTS.forEach(([r, c]) => {
      ctx.fillStyle = lineColor
      ctx.beginPath()
      ctx.arc(padding + c * cellSize, padding + r * cellSize, cellSize * 0.12, 0, Math.PI * 2)
      ctx.fill()
    })

    // 棋子
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const stone = state.board[r][c]
        if (!stone) continue
        const cx = padding + c * cellSize
        const cy = padding + r * cellSize
        const radius = cellSize * 0.44

        // 阴影
        ctx.fillStyle = 'rgba(0,0,0,0.2)'
        ctx.beginPath()
        ctx.arc(cx + 1.5, cy + 1.5, radius, 0, Math.PI * 2)
        ctx.fill()

        // 棋子
        const gradient = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, radius * 0.1, cx, cy, radius)
        if (stone === 'black') {
          gradient.addColorStop(0, '#555')
          gradient.addColorStop(1, '#111')
        } else {
          gradient.addColorStop(0, '#fff')
          gradient.addColorStop(1, '#ccc')
        }
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.fill()

        // 最后一步标记
        if (state.lastMove && state.lastMove.row === r && state.lastMove.col === c) {
          ctx.fillStyle = stone === 'black' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'
          ctx.beginPath()
          ctx.arc(cx, cy, radius * 0.25, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    // 悬停预览
    if (hoverCell && isMyTurn && gameStatus === 'playing') {
      const [hr, hc] = hoverCell
      if (!state.board[hr][hc]) {
        const cx = padding + hc * cellSize
        const cy = padding + hr * cellSize
        const radius = cellSize * 0.44
        ctx.fillStyle = state.currentTurn === 'black' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)'
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }, [state, hoverCell, canvasSize, zoom, isMyTurn, gameStatus, mode])

  useEffect(() => {
    drawBoard()
  }, [drawBoard])

  // Canvas 点击处理
  const getCellFromEvent = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const padding = 24
      const cellSize = (canvasSize * zoom - padding * 2) / (BOARD_SIZE - 1)
      const col = Math.round((x - padding) / cellSize)
      const row = Math.round((y - padding) / cellSize)
      if (col < 0 || col >= BOARD_SIZE || row < 0 || row >= BOARD_SIZE) return null
      return { row, col }
    },
    [canvasSize, zoom]
  )

  const handlePlaceStone = useCallback(
    (row: number, col: number) => {
      const result = makeMove(state, row, col)
      if (!result.valid || !result.newState) {
        setMessage(result.message)
        setTimeout(() => setMessage(''), 2000)
        return
      }
      setMessage('')
      setState(result.newState)
      const status = getGameStatus(result.newState)
      setGameStatus(status)

      // 网络模式：发送落子
      if (isNetworkMode) {
        netGameRef.current.sendMove({
          row,
          col,
          captured: (result.newState.lastMove?.captured || 0)
        })
      }

      if (status === 'win') {
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 4000)
      }
    },
    [state, isNetworkMode]
  )

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isMyTurn || gameStatus !== 'playing') return
      const cell = getCellFromEvent(e)
      if (!cell) return
      handlePlaceStone(cell.row, cell.col)
    },
    [isMyTurn, gameStatus, getCellFromEvent, handlePlaceStone]
  )

  const handleCanvasMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const cell = getCellFromEvent(e)
      setHoverCell(cell ? [cell.row, cell.col] : null)
    },
    [getCellFromEvent]
  )

  const handleCanvasLeave = useCallback(() => {
    setHoverCell(null)
  }, [])

  const handlePass = useCallback(() => {
    const { newState, gameOver } = pass(state)
    setState(newState)
    if (gameOver) {
      setGameStatus(newState.winner === 'draw' ? 'draw' : 'win')
      if (newState.winner !== 'draw') setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 4000)
    }

    if (isNetworkMode) {
      netGameRef.current.sendMove({ row: -1, col: -1, captured: 0 })
    }
  }, [state, isNetworkMode])

  // 网络消息处理
  useEffect(() => {
    if (!isNetworkMode) return
    const unsub = netGame.onOpponentMove((payload) => {
      const { row, col, captured } = payload as { row: number; col: number; captured: number }
      if (row === -1 && col === -1) {
        // 对方 Pass
        const { newState, gameOver } = pass(state)
        setState(newState)
        if (gameOver) {
          setGameStatus(newState.winner === 'draw' ? 'draw' : 'win')
          if (newState.winner !== 'draw') setShowConfetti(true)
          setTimeout(() => setShowConfetti(false), 4000)
        }
      } else {
        const result = makeMove(state, row, col)
        if (result.valid && result.newState) {
          setState(result.newState)
          const status = getGameStatus(result.newState)
          setGameStatus(status)
          if (status === 'win') {
            setShowConfetti(true)
            setTimeout(() => setShowConfetti(false), 4000)
          }
        }
      }
    })
    return () => unsub()
  }, [isNetworkMode, state])

  const turnLabel = state.currentTurn === 'black' ? '黑棋' : '白棋'
  const myLabel = myStone === 'black' ? '黑棋' : '白棋'
  const opponentLabel = myStone === 'black' ? '白棋' : '黑棋'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: bgGradient }}>
      {showConfetti && <Confetti active={true} />}
      <div className="absolute inset-0 pointer-events-none" style={{ background: bgOverlay }} />

      <div className="relative z-10 flex-1 flex flex-col">
        {/* 顶栏 */}
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate('/games')}
            className="flex items-center gap-1.5 text-sm tracking-[-0.02em] transition-colors hover:opacity-70"
            style={{ color: textSecondary }}
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </button>

          <div className="flex items-center gap-3">
            {isNetworkMode ? (
              <div className="flex items-center gap-1.5">
                <Wifi className="h-3.5 w-3.5" style={{ color: '#4CAF50' }} />
                <span className="text-xs tracking-[-0.02em]" style={{ color: '#4CAF50' }}>联机中</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <WifiOff className="h-3.5 w-3.5" style={{ color: textMuted }} />
                <span className="text-xs tracking-[-0.02em]" style={{ color: textMuted }}>本地</span>
              </div>
            )}
          </div>
        </div>

        {/* 玩家信息 */}
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-white border border-gray-300" />
            <span className="text-sm font-medium tracking-[-0.02em]" style={{ color: textPrimary }}>
              {isNetworkMode ? (myStone === 'white' ? `${myLabel}（你）` : myLabel) : '白棋'}
            </span>
            {isNetworkMode && myStone === 'white' && (
              <span className="text-xs tracking-[-0.02em]" style={{ color: textMuted }}>(你)</span>
            )}
            <span className="text-xs tracking-[-0.02em]" style={{ color: textMuted }}>
              提子: {state.capturedByWhite}
            </span>
            {gameStatus !== 'playing' && state.gameOver && (
              <span className="text-xs font-semibold" style={{ color: state.winner === 'white' ? '#4CAF50' : textMuted }}>
                {state.whiteScore}子
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isNetworkMode && (
              <span className="text-xs tracking-[-0.02em]" style={{ color: textMuted }}>
                {network?.opponentName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs tracking-[-0.02em]" style={{ color: textMuted }}>
              提子: {state.capturedByBlack}
            </span>
            {gameStatus !== 'playing' && state.gameOver && (
              <span className="text-xs font-semibold" style={{ color: state.winner === 'black' ? '#4CAF50' : textMuted }}>
                {state.blackScore}子
              </span>
            )}
            <span className="text-sm font-medium tracking-[-0.02em]" style={{ color: textPrimary }}>
              {isNetworkMode ? (myStone === 'black' ? `${myLabel}（你）` : myLabel) : '黑棋'}
            </span>
            {isNetworkMode && myStone === 'black' && (
              <span className="text-xs tracking-[-0.02em]" style={{ color: textMuted }}>(你)</span>
            )}
            <div className="h-3 w-3 rounded-full bg-gray-900 border border-gray-600" />
          </div>
        </div>

        {/* 棋盘 */}
        <div className="flex-1 flex flex-col items-center justify-center p-4" ref={containerRef}>
          <div className="flex items-center justify-center gap-2 mb-3">
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="p-1.5 rounded-full transition-all hover:opacity-70" style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
              <ZoomOut className="h-4 w-4" style={{ color: textSecondary }} />
            </button>
            <span className="text-xs tracking-[-0.02em]" style={{ color: textMuted }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2, z + 0.25))} className="p-1.5 rounded-full transition-all hover:opacity-70" style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
              <ZoomIn className="h-4 w-4" style={{ color: textSecondary }} />
            </button>
          </div>
          <div className="overflow-auto max-w-full max-h-full">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMove}
              onMouseLeave={handleCanvasLeave}
              className="rounded-lg shadow-2xl cursor-pointer"
              style={{ borderColor, borderWidth: 1 }}
            />
          </div>
        </div>

        {/* 底部控制 */}
        <div className="px-4 py-3 flex flex-col items-center gap-2">
          {/* 状态消息 */}
          {message && (
            <div className="text-xs px-3 py-1 rounded-full bg-red-500/10 text-red-400 tracking-[-0.02em]">
              {message}
            </div>
          )}

          {gameStatus === 'playing' ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${state.currentTurn === 'black' ? 'bg-gray-900' : 'bg-white border border-gray-400'}`} />
                <span className="text-sm font-medium tracking-[-0.02em]" style={{ color: textPrimary }}>
                  {turnLabel}回合
                </span>
                {isNetworkMode && (
                  <span className="text-xs tracking-[-0.02em]" style={{ color: textMuted }}>
                    {isMyTurn ? '（你的回合）' : '（等待对方）'}
                  </span>
                )}
              </div>
              {isMyTurn && (
                <button
                  onClick={handlePass}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium tracking-[-0.02em] transition-all hover:opacity-80 active:scale-95"
                  style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', color: textPrimary }}
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  虚着 (Pass)
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                <span className="text-lg font-semibold tracking-[-0.02em]" style={{ color: textPrimary }}>
                  {gameStatus === 'draw'
                    ? '和棋！'
                    : state.winner === 'black'
                      ? '黑棋胜！'
                      : '白棋胜！'}
                </span>
              </div>
              {state.gameOver && (
                <div className="text-xs tracking-[-0.02em]" style={{ color: textSecondary }}>
                  黑棋 {state.blackScore} 子 · 白棋 {state.whiteScore} 子（含贴目 7.5）
                </div>
              )}
              <button
                onClick={() => navigate('/games')}
                className="px-4 py-1.5 rounded-full text-xs font-medium tracking-[-0.02em] transition-all hover:opacity-80"
                style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', color: textPrimary }}
              >
                返回游戏列表
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}