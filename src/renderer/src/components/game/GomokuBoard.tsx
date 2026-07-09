// Copyright 2026 Catsmum2025
// MIT License

import { useState, useCallback, useEffect, useRef } from 'react'
import { ArrowLeft, Swords, Crown, Wifi, WifiOff, Check, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../ThemeContext'
import { Confetti } from '../Confetti'
import { useNetworkGame } from '../../hooks/useNetworkGame'
import type { GameRoom } from '../../types'
import {
  createEmptyBoard,
  makeMove,
  checkWinner,
  getGameStatus,
  isValidMove,
  BOARD_SIZE,
  type Board,
  type Stone,
  type GameResult
} from '../../game/gomoku'

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

export function GomokuBoard({ network }: Props): React.ReactElement {
  const navigate = useNavigate()
  const { bgGradient, bgOverlay, textPrimary, textSecondary, textMuted, borderColor, mode } = useTheme()
  const [board, setBoard] = useState<Board>(createEmptyBoard())
  const [currentTurn, setCurrentTurn] = useState<Stone>('black')
  const [gameResult, setGameResult] = useState<GameResult>(null)
  const [gameStatus, setGameStatus] = useState<'playing' | 'win' | 'draw'>('playing')
  const [hoverCell, setHoverCell] = useState<number | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [restartRequested, setRestartRequested] = useState(false)
  const [restartIncoming, setRestartIncoming] = useState(false)
  const [restartDeclined, setRestartDeclined] = useState(false)
  const [zoom, setZoom] = useState(1)
  const isNetworkMode = !!network

  const myStone: Stone = network?.isHost ? 'black' : 'white'
  const netGame = useNetworkGame(
    network?.myId ?? null,
    network?.isHost ?? false,
    network?.opponentId ?? null,
    network?.opponentIp ?? null
  )
  const isMyTurn = !isNetworkMode || (currentTurn === myStone) && gameStatus === 'playing'
  const netGameRef = useRef(netGame)
  netGameRef.current = netGame

  useEffect(() => {
    if (!isNetworkMode) return
    const ng = netGameRef.current

    const unsubMove = ng.onOpponentMove((payload) => {
      const moveIndex = payload.index as number
      if (typeof moveIndex !== 'number') return
      const oppStone: Stone = myStone === 'black' ? 'white' : 'black'
      if (!isValidMove(board, moveIndex)) return
      const newBoard = makeMove(board, moveIndex, oppStone)
      setBoard(newBoard)
      const result = checkWinner(newBoard)
      if (result) {
        setGameResult(result)
        setGameStatus('win')
      } else if (getGameStatus(newBoard) === 'draw') {
        setGameStatus('draw')
      } else {
        setCurrentTurn(myStone)
      }
    })

    const unsubGameOver = ng.onOpponentGameOver((payload) => {
      setGameResult({ winner: (payload.winner as Stone) || 'black', line: (payload.line as number[]) || [] })
      setGameStatus(payload.status as 'win' | 'draw')
    })

    const unsubDisc = ng.onOpponentDisconnected(() => {
      setGameStatus('win')
      setGameResult({ winner: myStone, line: [] })
    })

    const unsubRestartReq = ng.onRestartRequest(() => {
      setRestartIncoming(true)
    })

    const unsubRestartAccept = ng.onRestartAccept(() => {
      setRestartRequested(false)
      setRestartIncoming(false)
      setRestartDeclined(false)
      setBoard(createEmptyBoard())
      setCurrentTurn('black')
      setGameResult(null)
      setGameStatus('playing')
      setShowConfetti(false)
    })

    const unsubRestartDecline = ng.onRestartDecline(() => {
      setRestartRequested(false)
      setRestartIncoming(false)
      setRestartDeclined(true)
      setTimeout(() => setRestartDeclined(false), 3000)
    })

    return () => {
      unsubMove()
      unsubGameOver()
      unsubDisc()
      unsubRestartReq()
      unsubRestartAccept()
      unsubRestartDecline()
    }
  }, [isNetworkMode, board, myStone])

  if (gameStatus === 'win' && !showConfetti) {
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 5000)
  }

  const handleCellClick = useCallback(
    (index: number) => {
      if (!isMyTurn || !isValidMove(board, index)) return
      const newBoard = makeMove(board, index, currentTurn)
      setBoard(newBoard)
      const result = checkWinner(newBoard)
      if (result) {
        setGameResult(result)
        setGameStatus('win')
        if (isNetworkMode) {
          netGame.sendGameOver({ winner: result.winner, line: result.line, status: 'win' })
        }
      } else if (getGameStatus(newBoard) === 'draw') {
        setGameStatus('draw')
        if (isNetworkMode) {
          netGame.sendGameOver({ winner: null, line: null, status: 'draw' })
        }
      } else {
        setCurrentTurn(currentTurn === 'black' ? 'white' : 'black')
        if (isNetworkMode) {
          netGame.sendMove({ index })
        }
      }
    },
    [isMyTurn, board, currentTurn, isNetworkMode, netGame]
  )

  const handleNewGame = useCallback(() => {
    if (isNetworkMode) {
      netGame.sendRestartRequest()
      if (network) {
        netGame.sendRestartInvite(network.opponentIp, network.opponentId, network.room.gameType)
      }
      setRestartRequested(true)
    } else {
      setBoard(createEmptyBoard())
      setCurrentTurn('black')
      setGameResult(null)
      setGameStatus('playing')
      setShowConfetti(false)
    }
  }, [isNetworkMode, netGame, network])

  const handleAcceptRestart = useCallback(() => {
    netGame.sendRestartAccept()
    setRestartRequested(false)
    setRestartIncoming(false)
    setRestartDeclined(false)
    setBoard(createEmptyBoard())
    setCurrentTurn('black')
    setGameResult(null)
    setGameStatus('playing')
    setShowConfetti(false)
  }, [netGame])

  const isWinCell = (index: number): boolean => {
    if (!gameResult?.line) return false
    return gameResult.line.includes(index)
  }

  const cellSize = Math.min(28, Math.floor((window.innerWidth - 40) / BOARD_SIZE))

  return (
    <section className="relative w-full min-h-screen overflow-hidden">
      <Confetti active={showConfetti} />
      <div className="absolute inset-0" style={{ background: bgGradient }} />
      <div className="absolute inset-0" style={{ background: bgOverlay }} />

      <div className="relative z-10 flex flex-col items-center min-h-screen p-4">
        <div className="w-full max-w-4xl flex items-center justify-between mb-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 transition-all duration-200 group" style={{ color: textSecondary }}>
            <ArrowLeft className="h-5 w-5 transition-transform duration-200 group-hover:-translate-x-1" />
            <span className="text-sm tracking-[-0.02em]">返回首页</span>
          </button>
          <div className="flex items-center gap-2">
            {isNetworkMode && (
              <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs" style={{
                background: netGame.isConnected ? 'rgba(76,175,80,0.15)' : 'rgba(244,67,54,0.15)',
                color: netGame.isConnected ? '#4CAF50' : '#F44336'
              }}>
                {netGame.isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {netGame.isConnected ? '已连接' : '未连接'}
              </div>
            )}
            <h2 className="text-lg font-bold tracking-[-0.03em]" style={{ color: textPrimary }}>
              五子棋 · {isNetworkMode ? '联机对战' : '本地双人'}
            </h2>
          </div>
          <div className="w-20" />
        </div>

        {isNetworkMode && (
          <div className="mb-2 text-xs tracking-[-0.02em]" style={{ color: textMuted }}>
            {network?.isHost ? `你 (黑棋) vs ${network?.opponentName} (白棋)` : `${network?.opponentName} (黑棋) vs 你 (白棋)`}
            {!isMyTurn && gameStatus === 'playing' && <span className="ml-2 text-[#F49D4D]">— 等待对手走棋...</span>}
          </div>
        )}

        <div className="w-full max-w-md flex items-center justify-between mb-6">
          <div className="flex flex-col items-center gap-2">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300`}
              style={{
                background: (currentTurn === 'black' && gameStatus === 'playing')
                  ? (mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)')
                  : (mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                boxShadow: (currentTurn === 'black' && gameStatus === 'playing')
                  ? (mode === 'dark' ? '0 0 0 2px rgba(255,255,255,0.6), 0 10px 15px -3px rgba(255,255,255,0.1), 0 4px 6px -4px rgba(255,255,255,0.1)' : '0 0 0 2px rgba(0,0,0,0.15), 0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.06)')
                  : (mode === 'dark' ? '0 0 0 2px rgba(255,255,255,0.1)' : '0 0 0 2px rgba(0,0,0,0.06)')
              }}>
              <div className="w-5 h-5 rounded-full bg-[#2B312C] ring-2 ring-[#F49D4D]" />
            </div>
            <span className="text-xs tracking-[-0.02em]" style={{ color: textSecondary }}>
              {isNetworkMode ? (network?.isHost ? '你 · 黑棋' : '对手 · 黑棋') : '玩家1 · 黑棋'}
            </span>
            {currentTurn === 'black' && <Crown className="h-3 w-3 text-[#F49D4D]/60" />}
          </div>

          <div className="flex flex-col items-center">
            <Swords className="h-6 w-6" style={{ color: textMuted }} />
            <span className="text-xs mt-1 tracking-[-0.02em]" style={{ color: textMuted }}>
              {gameStatus === 'win' ? '游戏结束' : gameStatus === 'draw' ? '平局' : `第 ${board.filter(c => c !== null).length + 1} 手`}
            </span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300`}
              style={{
                background: (currentTurn === 'white' && gameStatus === 'playing')
                  ? (mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)')
                  : (mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                boxShadow: (currentTurn === 'white' && gameStatus === 'playing')
                  ? (mode === 'dark' ? '0 0 0 2px rgba(255,255,255,0.6), 0 10px 15px -3px rgba(255,255,255,0.1), 0 4px 6px -4px rgba(255,255,255,0.1)' : '0 0 0 2px rgba(0,0,0,0.15), 0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.06)')
                  : (mode === 'dark' ? '0 0 0 2px rgba(255,255,255,0.1)' : '0 0 0 2px rgba(0,0,0,0.06)')
              }}>
              <div className="w-5 h-5 rounded-full bg-white ring-2 ring-[#74754F]" />
            </div>
            <span className="text-xs tracking-[-0.02em]" style={{ color: textSecondary }}>
              {isNetworkMode ? (network?.isHost ? '对手 · 白棋' : '你 · 白棋') : '玩家2 · 白棋'}
            </span>
            {currentTurn === 'white' && <Crown className="h-3 w-3 text-[#74754F]/60" />}
          </div>
        </div>

        <div className="relative mb-6">
          {gameStatus !== 'playing' && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-2xl">
              <div className="text-center">
                <p className="text-2xl font-black tracking-[-0.04em] mb-3" style={{ color: textPrimary }}>
                  {gameStatus === 'draw' ? '平局！' : `${gameResult?.winner === 'black' ? (isNetworkMode ? (network?.isHost ? '你（黑棋）' : network?.opponentName + '（黑棋）') : '玩家1（黑棋）') : (isNetworkMode ? (network?.isHost ? network?.opponentName + '（白棋）' : '你（白棋）') : '玩家2（白棋）')} 获胜！`}
                </p>

                {isNetworkMode && restartRequested ? (
                  <div>
                    <p className="text-sm mb-3" style={{ color: textMuted }}>等待对手回应...</p>
                    <button onClick={() => { netGame.sendRestartDecline(); setRestartRequested(false) }}
                      className="rounded-full px-6 py-2.5 text-sm font-semibold tracking-[-0.02em] transition-all"
                      style={{
                        background: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                        color: textSecondary
                      }}>
                      取消
                    </button>
                  </div>
                ) : isNetworkMode && restartIncoming ? (
                  <div>
                    <p className="text-sm mb-3 text-[#F49D4D]">对手想再来一局</p>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={handleAcceptRestart}
                        className="flex items-center gap-2 rounded-full bg-[#4CAF50] px-5 py-2 text-sm font-semibold tracking-[-0.02em] text-white shadow-lg shadow-[#4CAF50]/20 transition-all duration-300 hover:bg-[#4CAF50]/90 hover:shadow-xl active:scale-95"
                      >
                        <Check className="h-4 w-4" />
                        接受
                      </button>
                      <button
                        onClick={() => netGame.sendRestartDecline()}
                        className="flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold tracking-[-0.02em] transition-all duration-300 active:scale-95"
                        style={{
                          background: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                          color: textSecondary
                        }}
                      >
                        <X className="h-4 w-4" />
                        拒绝
                      </button>
                    </div>
                  </div>
                ) : isNetworkMode && restartDeclined ? (
                  <p className="text-sm" style={{ color: '#F44336' }}>对手不想再来一局</p>
                ) : (
                  <button onClick={handleNewGame} className="rounded-full bg-[#F49D4D] px-6 py-2.5 text-sm font-semibold tracking-[-0.02em] text-[#2B312C] shadow-lg shadow-[#F49D4D]/20 transition-all duration-300 hover:bg-[#F49D4D]/90 hover:shadow-xl active:scale-95">
                    再来一局
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 mb-4">
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="p-1.5 rounded-full transition-all hover:opacity-70" style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
              <ZoomOut className="h-4 w-4" style={{ color: textSecondary }} />
            </button>
            <span className="text-xs tracking-[-0.02em]" style={{ color: textMuted }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2, z + 0.25))} className="p-1.5 rounded-full transition-all hover:opacity-70" style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
              <ZoomIn className="h-4 w-4" style={{ color: textSecondary }} />
            </button>
          </div>

          <div className="p-3 rounded-2xl bg-[#D4A574]/30 border backdrop-blur-sm" style={{ borderColor }}>
            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}>
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${BOARD_SIZE}, ${cellSize}px)`,
                  gridTemplateRows: `repeat(${BOARD_SIZE}, ${cellSize}px)`,
                  gap: '0px'
                }}
              >
              {board.map((cell, index) => {
                const row = Math.floor(index / BOARD_SIZE)
                const col = index % BOARD_SIZE
                return (
                  <button
                    key={index}
                    onClick={() => handleCellClick(index)}
                    onMouseEnter={() => setHoverCell(index)}
                    onMouseLeave={() => setHoverCell(null)}
                    disabled={!isMyTurn || cell !== null || gameStatus !== 'playing'}
                    className="relative flex items-center justify-center"
                    style={{ width: cellSize, height: cellSize }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="absolute w-full h-px bg-white/25" />
                      <div className="absolute h-full w-px bg-white/25" />
                      {[3, 9, 15].includes(row) && [3, 9, 15].includes(col) && !cell && (
                        <div className="absolute w-1.5 h-1.5 rounded-full bg-white/30" />
                      )}
                    </div>

                    {cell && (
                      <div
                        className={`absolute rounded-full transition-all duration-200 z-10 ${
                          isWinCell(index) ? 'ring-2 ring-[#F49D4D] ring-offset-1 ring-offset-transparent' : ''
                        }`}
                        style={{
                          width: cellSize * 0.85,
                          height: cellSize * 0.85,
                          background: cell === 'black'
                            ? 'radial-gradient(circle at 35% 35%, #3a3a3a, #1a1a1a)'
                            : 'radial-gradient(circle at 35% 35%, #ffffff, #c0c0c0)',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.4)'
                        }}
                      />
                    )}

                    {!cell && isMyTurn && hoverCell === index && gameStatus === 'playing' && (
                      <div
                        className="absolute rounded-full opacity-30 z-10"
                        style={{
                          width: cellSize * 0.85,
                          height: cellSize * 0.85,
                          background: currentTurn === 'black'
                            ? 'radial-gradient(circle at 35% 35%, #3a3a3a, #1a1a1a)'
                            : 'radial-gradient(circle at 35% 35%, #ffffff, #c0c0c0)'
                        }}
                      />
                    )}
                  </button>
                )
              })}
            </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}