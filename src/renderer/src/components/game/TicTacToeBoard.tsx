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
  type Board,
  type Player,
  type GameResult
} from '../../game/tictactoe'

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

export function TicTacToeBoard({ network }: Props): React.ReactElement {
  const navigate = useNavigate()
  const { bgGradient, bgOverlay, textPrimary, textSecondary, textMuted, borderColor, mode } = useTheme()
  const [board, setBoard] = useState<Board>(createEmptyBoard())
  const [zoom, setZoom] = useState(1)
  const [currentTurn, setCurrentTurn] = useState<Player>('X')
  const [gameResult, setGameResult] = useState<GameResult>(null)
  const [gameStatus, setGameStatus] = useState<'playing' | 'win' | 'draw'>('playing')
  const [hoverCell, setHoverCell] = useState<number | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [restartRequested, setRestartRequested] = useState(false)
  const [restartIncoming, setRestartIncoming] = useState(false)
  const [restartDeclined, setRestartDeclined] = useState(false)
  const isNetworkMode = !!network

  const myPlayer: Player = network?.isHost ? 'X' : 'O'
  const netGame = useNetworkGame(
    network?.myId ?? null,
    network?.isHost ?? false,
    network?.opponentId ?? null,
    network?.opponentIp ?? null
  )
  const isMyTurn = !isNetworkMode || (currentTurn === myPlayer)
  const netGameRef = useRef(netGame)
  netGameRef.current = netGame

  useEffect(() => {
    if (!isNetworkMode) return
    const ng = netGameRef.current

    const unsubMove = ng.onOpponentMove((payload) => {
      const moveIndex = payload.index as number
      if (typeof moveIndex !== 'number') return
      const oppPlayer: Player = myPlayer === 'X' ? 'O' : 'X'
      if (!isValidMove(board, moveIndex)) return
      const newBoard = makeMove(board, moveIndex, oppPlayer)
      setBoard(newBoard)
      const result = checkWinner(newBoard)
      if (result) {
        setGameResult(result)
        setGameStatus('win')
      } else if (getGameStatus(newBoard) === 'draw') {
        setGameStatus('draw')
      } else {
        setCurrentTurn(myPlayer)
      }
    })

    const unsubGameOver = ng.onOpponentGameOver((payload) => {
      setGameResult({ winner: (payload.winner as Player) || null, line: (payload.line as number[]) || null })
      setGameStatus(payload.status as 'win' | 'draw')
    })

    const unsubDisc = ng.onOpponentDisconnected(() => {
      setGameStatus('win')
      setGameResult({ winner: myPlayer, line: null })
    })

    const unsubRestartReq = ng.onRestartRequest(() => {
      setRestartIncoming(true)
    })

    const unsubRestartAccept = ng.onRestartAccept(() => {
      setRestartRequested(false)
      setRestartIncoming(false)
      setRestartDeclined(false)
      setBoard(createEmptyBoard())
      setCurrentTurn('X')
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
  }, [isNetworkMode, board, myPlayer])

  if (gameStatus === 'win' && !showConfetti) {
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 5000)
  }

  const handleCellClick = useCallback(
    (index: number) => {
      if (gameStatus !== 'playing') return
      if (!isValidMove(board, index)) return
      if (isNetworkMode && !isMyTurn) return

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
        const nextTurn = currentTurn === 'X' ? 'O' : 'X'
        setCurrentTurn(nextTurn)
        if (isNetworkMode) {
          netGame.sendMove({ index })
        }
      }
    },
    [board, currentTurn, gameStatus, isNetworkMode, isMyTurn, netGame]
  )

  const handleNewGame = useCallback(() => {
    if (isNetworkMode) {
      // 发送 TCP RESTART_REQUEST（对手在游戏页面时能收到）
      netGame.sendRestartRequest()
      // 同时发送 UDP INVITE（对手离开游戏页面时也能收到邀请）
      if (network) {
        netGame.sendRestartInvite(network.opponentIp, network.opponentId, network.room.gameType)
      }
      setRestartRequested(true)
    } else {
      setBoard(createEmptyBoard())
      setCurrentTurn('X')
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
    setCurrentTurn('X')
    setGameResult(null)
    setGameStatus('playing')
    setShowConfetti(false)
  }, [netGame])

  const isWinCell = (index: number): boolean => {
    if (!gameResult?.line) return false
    return gameResult.line.includes(index)
  }

  const getCellContent = (value: string | null): React.ReactNode => {
    if (!value) return null
    if (value === 'X') {
      return (
        <svg viewBox="0 0 40 40" className="w-8 h-8 sm:w-12 sm:h-12">
          <line x1="8" y1="8" x2="32" y2="32" stroke="#F49D4D" strokeWidth="3" strokeLinecap="round" />
          <line x1="32" y1="8" x2="8" y2="32" stroke="#F49D4D" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )
    }
    return (
      <svg viewBox="0 0 40 40" className="w-8 h-8 sm:w-12 sm:h-12">
        <circle cx="20" cy="20" r="12" stroke="#74754F" strokeWidth="3" fill="none" />
      </svg>
    )
  }

  return (
    <section className="relative w-full min-h-screen sm:h-screen overflow-hidden">
      <Confetti active={showConfetti} />
      <div className="absolute inset-0" style={{ background: bgGradient }} />
      <div className="absolute inset-0" style={{ background: bgOverlay }} />

      <div className="relative z-10 flex flex-col items-center min-h-screen p-4 sm:p-6">
        <div className="w-full max-w-2xl flex items-center justify-between mb-6">
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
              井字棋 · {isNetworkMode ? '联机对战' : '本地双人'}
            </h2>
          </div>
          <div className="w-20" />
        </div>

        {isNetworkMode && (
          <div className="mb-4 text-xs tracking-[-0.02em]" style={{ color: textMuted }}>
            {network?.isHost ? `你 (X) vs ${network?.opponentName} (O)` : `${network?.opponentName} (X) vs 你 (O)`}
            {!isMyTurn && gameStatus === 'playing' && <span className="ml-2 text-[#F49D4D]">— 等待对手走棋...</span>}
          </div>
        )}

        <div className="w-full max-w-md flex items-center justify-between mb-8">
          <div className="flex flex-col items-center gap-2">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300 ${
              currentTurn === 'X' && gameStatus === 'playing' ? 'bg-[#F49D4D]/20 ring-2 ring-[#F49D4D] shadow-lg shadow-[#F49D4D]/20' : ''
            }`} style={currentTurn === 'X' && gameStatus === 'playing' ? {} : {
              background: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
              boxShadow: mode === 'dark' ? '0 0 0 2px rgba(255,255,255,0.1)' : '0 0 0 2px rgba(0,0,0,0.08)',
            }}>
              {getCellContent('X')}
            </div>
            <span className="text-xs tracking-[-0.02em]" style={{ color: textSecondary }}>
              {isNetworkMode ? (network?.isHost ? '你 (X)' : '对手 (X)') : '玩家1 (X)'}
            </span>
            {currentTurn === 'X' && <Crown className="h-3 w-3 text-[#F49D4D]/60" />}
          </div>

          <div className="flex flex-col items-center">
            <Swords className="h-6 w-6" style={{ color: textMuted }} />
            <span className="text-xs mt-1 tracking-[-0.02em]" style={{ color: textMuted }}>
              {gameStatus === 'win' ? '游戏结束' : gameStatus === 'draw' ? '平局' : '对局中'}
            </span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300 ${
              currentTurn === 'O' && gameStatus === 'playing' ? 'bg-[#74754F]/20 ring-2 ring-[#74754F] shadow-lg shadow-[#74754F]/20' : ''
            }`} style={currentTurn === 'O' && gameStatus === 'playing' ? {} : {
              background: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
              boxShadow: mode === 'dark' ? '0 0 0 2px rgba(255,255,255,0.1)' : '0 0 0 2px rgba(0,0,0,0.08)',
            }}>
              {getCellContent('O')}
            </div>
            <span className="text-xs tracking-[-0.02em]" style={{ color: textSecondary }}>
              {isNetworkMode ? (network?.isHost ? '对手 (O)' : '你 (O)') : '玩家2 (O)'}
            </span>
            {currentTurn === 'O' && <Crown className="h-3 w-3 text-[#74754F]/60" />}
          </div>
        </div>

        <div className="relative mb-8">
          {gameStatus !== 'playing' && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-2xl">
              <div className="text-center">
                <p className="text-2xl font-black tracking-[-0.04em] mb-3" style={{ color: textPrimary }}>
                  {gameStatus === 'draw' ? '平局！' : `${gameResult?.winner === 'X' ? (isNetworkMode ? (network?.isHost ? '你' : network?.opponentName) : '玩家1') : (isNetworkMode ? (network?.isHost ? network?.opponentName : '你') : '玩家2')} 获胜！`}
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

          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 p-4 sm:p-6 rounded-2xl border backdrop-blur-sm" style={{
              background: mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
              borderColor: borderColor,
            }}>
            {board.map((cell, index) => (
              <button
                key={index}
                onClick={() => handleCellClick(index)}
                onMouseEnter={() => setHoverCell(index)}
                onMouseLeave={() => setHoverCell(null)}
                disabled={gameStatus !== 'playing' || cell !== null || (isNetworkMode && !isMyTurn)}
                className={`relative flex items-center justify-center w-20 h-20 sm:w-28 sm:h-28 rounded-xl transition-all duration-200 ${
                  gameStatus === 'playing' && !cell && (!isNetworkMode || isMyTurn) ? 'cursor-pointer' : 'cursor-default'
                }`}
                style={{
                  background: isWinCell(index)
                    ? 'rgba(244, 157, 77, 0.1)'
                    : cell !== null
                      ? (mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)')
                      : hoverCell === index
                        ? (mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)')
                        : (mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'),
                  boxShadow: isWinCell(index)
                    ? '0 0 0 2px rgba(244, 157, 77, 0.3)'
                    : hoverCell === index && !cell && (!isNetworkMode || isMyTurn)
                      ? (mode === 'dark' ? '0 0 0 1px rgba(255,255,255,0.1)' : '0 0 0 1px rgba(0,0,0,0.08)')
                      : undefined,
                }}
              >
                {cell ? (
                  getCellContent(cell)
                ) : (
                  hoverCell === index && gameStatus === 'playing' && (!isNetworkMode || isMyTurn) && (
                    <div className="opacity-20">
                      {getCellContent(currentTurn)}
                    </div>
                  )
                )}
              </button>
            ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}