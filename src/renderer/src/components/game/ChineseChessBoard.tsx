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
  createInitialBoard,
  getLegalMoves,
  makeMoveWithInfo,
  checkGameOver,
  COLS,
  ROWS,
  type Board,
  type Side,
  type PieceType,
  type Move,
  type GameResult
} from '../../game/chinesechess'

const PIECE_NAMES: Record<Side, Record<PieceType, string>> = {
  r: { K: '\u5E05', A: '\u4ED5', E: '\u76F8', H: '\u99AC', R: '\u8ECA', C: '\u70AE', P: '\u5175' },
  b: { K: '\u5C06', A: '\u58EB', E: '\u8C61', H: '\u99AC', R: '\u8ECA', C: '\u782A', P: '\u5352' }
}

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

export function ChineseChessBoard({ network }: Props): React.ReactElement {
  const navigate = useNavigate()
  const { bgGradient, bgOverlay, textPrimary, textSecondary, textMuted, borderColor, mode } = useTheme()
  const [board, setBoard] = useState<Board>(createInitialBoard())
  const [currentTurn, setCurrentTurn] = useState<Side>('r')
  const [gameResult, setGameResult] = useState<GameResult | null>(null)
  const [gameStatus, setGameStatus] = useState<'playing' | 'win'>('playing')
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null)
  const [legalMoves, setLegalMoves] = useState<Move[]>([])
  const [showConfetti, setShowConfetti] = useState(false)
  const [restartRequested, setRestartRequested] = useState(false)
  const [restartIncoming, setRestartIncoming] = useState(false)
  const [restartDeclined, setRestartDeclined] = useState(false)
  const [moveCount, setMoveCount] = useState(0)
  const [zoom, setZoom] = useState(1)
  const isNetworkMode = !!network

  const mySide: Side = network?.isHost ? 'r' : 'b'
  const netGame = useNetworkGame(
    network?.myId ?? null,
    network?.isHost ?? false,
    network?.opponentId ?? null,
    network?.opponentIp ?? null
  )
  const isMyTurn = !isNetworkMode || (currentTurn === mySide) && gameStatus === 'playing'
  const netGameRef = useRef(netGame)
  netGameRef.current = netGame

  useEffect(() => {
    if (!isNetworkMode) return
    const ng = netGameRef.current

    const unsubMove = ng.onOpponentMove((payload) => {
      const fromRow = payload.fromRow as number
      const fromCol = payload.fromCol as number
      const toRow = payload.toRow as number
      const toCol = payload.toCol as number
      if (typeof fromRow !== 'number' || typeof toRow !== 'number') return
      const oppSide: Side = mySide === 'r' ? 'b' : 'r'
      const result = makeMoveWithInfo(board, fromRow, fromCol, toRow, toCol, oppSide)
      if (result) {
        setBoard(result.board)
        setMoveCount(prev => prev + 1)
        const nextTurn: Side = oppSide === 'r' ? 'b' : 'r'
        setCurrentTurn(nextTurn)
        const over = checkGameOver(result.board, nextTurn)
        if (over) {
          setGameResult(over)
          setGameStatus('win')
        }
      }
    })

    const unsubGameOver = ng.onOpponentGameOver((payload) => {
      setGameResult({ winner: (payload.winner as Side) || 'r', reason: 'checkmate' })
      setGameStatus('win')
    })

    const unsubDisc = ng.onOpponentDisconnected(() => {
      setGameStatus('win')
      setGameResult({ winner: mySide, reason: 'checkmate' })
    })

    const unsubRestartReq = ng.onRestartRequest(() => {
      setRestartIncoming(true)
    })

    const unsubRestartAccept = ng.onRestartAccept(() => {
      setRestartRequested(false)
      setRestartIncoming(false)
      setRestartDeclined(false)
      setBoard(createInitialBoard())
      setCurrentTurn('r')
      setGameResult(null)
      setGameStatus('playing')
      setSelectedCell(null)
      setLegalMoves([])
      setShowConfetti(false)
      setMoveCount(0)
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
  }, [isNetworkMode, board, mySide])

  if (gameResult && !showConfetti) {
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 5000)
  }

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (gameStatus !== 'playing') return
      if (isNetworkMode && !isMyTurn) return

      const piece = board[row][col]

      if (selectedCell) {
        if (selectedCell[0] === row && selectedCell[1] === col) {
          setSelectedCell(null)
          setLegalMoves([])
          return
        }
        if (piece && piece.side === currentTurn) {
          setSelectedCell([row, col])
          setLegalMoves(getLegalMoves(board, row, col))
          return
        }
        const result = makeMoveWithInfo(board, selectedCell[0], selectedCell[1], row, col, currentTurn)
        if (result) {
          setBoard(result.board)
          setMoveCount(prev => prev + 1)
          const nextTurn: Side = currentTurn === 'r' ? 'b' : 'r'
          setCurrentTurn(nextTurn)
          setSelectedCell(null)
          setLegalMoves([])

          if (isNetworkMode) {
            netGame.sendMove({
              fromRow: selectedCell[0],
              fromCol: selectedCell[1],
              toRow: row,
              toCol: col
            })
          }

          const over = checkGameOver(result.board, nextTurn)
          if (over) {
            setGameResult(over)
            setGameStatus('win')
            if (isNetworkMode) {
              netGame.sendGameOver({ winner: over.winner, reason: over.reason })
            }
          }
        }
      } else {
        if (piece && piece.side === currentTurn) {
          setSelectedCell([row, col])
          setLegalMoves(getLegalMoves(board, row, col))
        }
      }
    },
    [board, currentTurn, selectedCell, gameStatus, isNetworkMode, isMyTurn, netGame]
  )

  const handleNewGame = useCallback(() => {
    if (isNetworkMode) {
      netGame.sendRestartRequest()
      if (network) {
        netGame.sendRestartInvite(network.opponentIp, network.opponentId, network.room.gameType)
      }
      setRestartRequested(true)
    } else {
      setBoard(createInitialBoard())
      setCurrentTurn('r')
      setGameResult(null)
      setGameStatus('playing')
      setSelectedCell(null)
      setLegalMoves([])
      setShowConfetti(false)
      setMoveCount(0)
    }
  }, [isNetworkMode, netGame, network])

  const handleAcceptRestart = useCallback(() => {
    netGame.sendRestartAccept()
    setRestartRequested(false)
    setRestartIncoming(false)
    setRestartDeclined(false)
    setBoard(createInitialBoard())
    setCurrentTurn('r')
    setGameResult(null)
    setGameStatus('playing')
    setSelectedCell(null)
    setLegalMoves([])
    setShowConfetti(false)
    setMoveCount(0)
  }, [netGame])

  const isLegalTarget = (r: number, c: number): boolean => {
    return legalMoves.some(m => m.toRow === r && m.toCol === c)
  }

  const isSelected = (r: number, c: number): boolean => {
    return selectedCell !== null && selectedCell[0] === r && selectedCell[1] === c
  }

  const cellSize = Math.min(48, Math.floor((Math.min(window.innerWidth, 500) - 60) / COLS))

  return (
    <section className="relative w-full min-h-screen overflow-hidden">
      <Confetti active={showConfetti} />
      <div className="absolute inset-0" style={{ background: bgGradient }} />
      <div className="absolute inset-0" style={{ background: bgOverlay }} />

      <div className="relative z-10 flex flex-col items-center min-h-screen p-4">
        <div className="w-full max-w-2xl flex items-center justify-between mb-4">
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
              中国象棋 · {isNetworkMode ? '联机对战' : '本地双人'}
            </h2>
          </div>
          <div className="w-20" />
        </div>

        {isNetworkMode && (
          <div className="mb-2 text-xs tracking-[-0.02em]" style={{ color: textMuted }}>
            {network?.isHost ? `你 (红方) vs ${network?.opponentName} (黑方)` : `${network?.opponentName} (红方) vs 你 (黑方)`}
            {!isMyTurn && gameStatus === 'playing' && <span className="ml-2 text-[#F49D4D]">— 等待对手走棋...</span>}
          </div>
        )}

        <div className="w-full max-w-md flex items-center justify-between mb-6">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full ring-2 transition-all duration-300" style={
              currentTurn === 'b' && gameStatus === 'playing'
                ? { background: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', boxShadow: mode === 'dark' ? '0 0 0 2px rgba(255,255,255,0.6)' : '0 0 0 2px rgba(0,0,0,0.15)' }
                : { background: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', boxShadow: mode === 'dark' ? '0 0 0 2px rgba(255,255,255,0.1)' : '0 0 0 2px rgba(0,0,0,0.04)' }
            }>
              <span className="text-base font-bold" style={{ color: textPrimary }}>将</span>
            </div>
            <span className="text-xs tracking-[-0.02em]" style={{ color: textSecondary }}>
              {isNetworkMode ? (network?.isHost ? '对手 · 黑方' : '你 · 黑方') : '玩家2 · 黑方'}
            </span>
            {currentTurn === 'b' && <Crown className="h-3 w-3" style={{ color: textSecondary }} />}
          </div>

          <div className="flex flex-col items-center">
            <Swords className="h-6 w-6" style={{ color: textMuted }} />
            <span className="text-xs mt-1 tracking-[-0.02em]" style={{ color: textMuted }}>
              {gameStatus === 'win' ? '游戏结束' : `第 ${moveCount + 1} 手`}
            </span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full ring-2 transition-all duration-300" style={
              currentTurn === 'r' && gameStatus === 'playing'
                ? { background: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', boxShadow: mode === 'dark' ? '0 0 0 2px rgba(255,255,255,0.6)' : '0 0 0 2px rgba(0,0,0,0.15)' }
                : { background: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', boxShadow: mode === 'dark' ? '0 0 0 2px rgba(255,255,255,0.1)' : '0 0 0 2px rgba(0,0,0,0.04)' }
            }>
              <span className="text-base font-bold text-[#F49D4D]">帅</span>
            </div>
            <span className="text-xs tracking-[-0.02em]" style={{ color: textSecondary }}>
              {isNetworkMode ? (network?.isHost ? '你 · 红方' : '对手 · 红方') : '玩家1 · 红方'}
            </span>
            {currentTurn === 'r' && <Crown className="h-3 w-3 text-[#F49D4D]/60" />}
          </div>
        </div>

        <div className="relative mb-6">
          {gameStatus !== 'playing' && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-2xl">
              <div className="text-center">
                <p className="text-2xl font-black tracking-[-0.04em] mb-3" style={{ color: textPrimary }}>
                  {gameResult?.winner === 'r' ? (isNetworkMode ? (network?.isHost ? '你（红方）' : network?.opponentName + '（红方）') : '玩家1（红方）') + '获胜！' : (isNetworkMode ? (network?.isHost ? network?.opponentName + '（黑方）' : '你（黑方）') : '玩家2（黑方）') + '获胜！'}
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

          <div className="p-3 rounded-2xl bg-[#D4A574]/20 border backdrop-blur-sm" style={{ borderColor: borderColor }}>
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
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${COLS}, ${cellSize}px)`,
                  gridTemplateRows: `repeat(${ROWS}, ${cellSize}px)`,
                  gap: '0px'
                }}
              >
              {board.map((row, r) =>
                row.map((cell, c) => {
                  const isLegal = isLegalTarget(r, c)
                  const isCapture = isLegal && cell !== null
                  const sel = isSelected(r, c)
                  const isRiver = r === 4 || r === 5

                  return (
                    <button
                      key={`${r}-${c}`}
                      onClick={() => handleCellClick(r, c)}
                      disabled={isNetworkMode && !isMyTurn && !sel}
                      className="relative flex items-center justify-center"
                      style={{
                        width: cellSize,
                        height: cellSize,
                        background: sel ? '#F49D4D' : 'transparent'
                      }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        {(c > 0 && c < COLS - 1) && (
                          <>
                            <div className="absolute h-full w-px bg-[#2B312C]/60" style={{ top: 0 }} />
                            {isRiver && (
                              <>
                                <div className="absolute h-1/2 w-px bg-[#2B312C]/60" style={{ top: 0 }} />
                                <div className="absolute h-1/2 w-px bg-[#2B312C]/60" style={{ bottom: 0 }} />
                              </>
                            )}
                          </>
                        )}
                        {(c === 0 || c === COLS - 1) && (
                          <div className="absolute h-full w-px bg-[#2B312C]/60" />
                        )}
                        <div className="absolute w-full h-px bg-[#2B312C]/60" />
                        {((r >= 0 && r <= 2 && c >= 3 && c <= 5) || (r >= 7 && r <= 9 && c >= 3 && c <= 5)) && (
                          (r + c) % 2 === 1 && (
                            (() => {
                              const isTopPalace = r <= 2
                              const pr = isTopPalace ? 0 : 7
                              const pc = 3
                              const dr = (r === pr ? 1 : r === pr + 2 ? -1 : 0)
                              const dc = (c === pc ? 1 : c === pc + 2 ? -1 : 0)
                              if (dr !== 0 && dc !== 0) {
                                return (
                                  <>
                                    <div className="absolute w-px h-px bg-[#2B312C]/60" style={{ top: 0, left: 0 }} />
                                    <div className="absolute w-px h-px bg-[#2B312C]/60" style={{ bottom: 0, right: 0 }} />
                                  </>
                                )
                              }
                              return null
                            })()
                          )
                        )}
                      </div>

                      {isRiver && c === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ width: cellSize * COLS }}>
                          <span className="text-xs tracking-[0.15em] text-[#2B312C]/40 font-bold italic">
                            楚 河　　　　汉 界
                          </span>
                        </div>
                      )}

                      {isLegal && !isCapture && (
                        <div className="absolute w-1/3 h-1/3 rounded-full bg-[#F49D4D]/40 z-10" />
                      )}
                      {isLegal && isCapture && (
                        <div className="absolute inset-1 rounded-full ring-2 ring-[#F49D4D]/50 z-10" />
                      )}

                      {cell && (
                        <div
                          className="z-20 flex items-center justify-center rounded-full select-none pointer-events-none"
                          style={{
                            width: cellSize * 0.82,
                            height: cellSize * 0.82,
                            background: cell.side === 'r'
                              ? 'radial-gradient(circle at 40% 35%, #f5e6d3, #d4a574)'
                              : 'radial-gradient(circle at 40% 35%, #e8e8e8, #b0b0b0)',
                            border: `2px solid ${cell.side === 'r' ? '#8B4513' : '#333'}`,
                            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                            fontSize: cellSize * 0.52,
                            fontWeight: 'bold',
                            color: cell.side === 'r' ? '#8B0000' : '#1a1a1a',
                            textShadow: '0 1px 1px rgba(0,0,0,0.2)'
                          }}
                        >
                          {PIECE_NAMES[cell.side][cell.type]}
                        </div>
                      )}
                    </button>
                  )
                })
              )}
            </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}