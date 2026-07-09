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
  finalizePromotion,
  isInCheck,
  BOARD_SIZE,
  type Board,
  type PieceColor,
  type PieceType,
  type PromotionChoice,
  type Move,
  type GameResult
} from '../../game/chess'

const PIECE_SYMBOLS: Record<PieceColor, Record<PieceType, string>> = {
  w: { K: '\u2654', Q: '\u2655', R: '\u2656', B: '\u2657', N: '\u2658', P: '\u2659' },
  b: { K: '\u265A', Q: '\u265B', R: '\u265C', B: '\u265D', N: '\u265E', P: '\u265F' }
}

const PROMOTION_OPTIONS: { type: PromotionChoice; label: string }[] = [
  { type: 'Q', label: '\u540E' },
  { type: 'R', label: '\u8F66' },
  { type: 'B', label: '\u8C61' },
  { type: 'N', label: '\u9A6C' }
]

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

export function ChessBoard({ network }: Props): React.ReactElement {
  const navigate = useNavigate()
  const { bgGradient, bgOverlay, textPrimary, textSecondary, textMuted, borderColor, mode } = useTheme()
  const [board, setBoard] = useState<Board>(createInitialBoard())
  const [currentTurn, setCurrentTurn] = useState<PieceColor>('w')
  const [gameResult, setGameResult] = useState<GameResult | null>(null)
  const [gameStatus, setGameStatus] = useState<'playing' | 'win' | 'draw'>('playing')
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null)
  const [legalMoves, setLegalMoves] = useState<Move[]>([])
  const [showConfetti, setShowConfetti] = useState(false)
  const [restartRequested, setRestartRequested] = useState(false)
  const [restartIncoming, setRestartIncoming] = useState(false)
  const [restartDeclined, setRestartDeclined] = useState(false)
  const [castlingRights, setCastlingRights] = useState({ wK: true, wQ: true, bK: true, bQ: true })
  const [enPassantTarget, setEnPassantTarget] = useState<[number, number] | null>(null)
  const [moveCount, setMoveCount] = useState(0)
  const [backBtnHover, setBackBtnHover] = useState(false)
  const [promotionPending, setPromotionPending] = useState(false)
  const [promotionPos, setPromotionPos] = useState<[number, number] | null>(null)
  const [pendingResult, setPendingResult] = useState<{
    board: Board
    newCastlingRights: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean }
    newEnPassantTarget: [number, number] | null
    nextTurn: PieceColor
  } | null>(null)
  const [zoom, setZoom] = useState(1)
  const isNetworkMode = !!network

  const myColor: PieceColor = network?.isHost ? 'w' : 'b'
  const netGame = useNetworkGame(
    network?.myId ?? null,
    network?.isHost ?? false,
    network?.opponentId ?? null,
    network?.opponentIp ?? null
  )
  const isMyTurn = !isNetworkMode || (currentTurn === myColor) && gameStatus === 'playing'
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
      const oppColor: PieceColor = myColor === 'w' ? 'b' : 'w'
      const result = makeMoveWithInfo(board, fromRow, fromCol, toRow, toCol, oppColor, castlingRights, enPassantTarget)
      if (result) {
        const nextTurn: PieceColor = oppColor === 'w' ? 'b' : 'w'
        if (result.info.needsPromotion && result.info.promotionPos && payload.promotion) {
          const finalBoard = finalizePromotion(result.board, result.info.promotionPos[0], result.info.promotionPos[1], payload.promotion as PromotionChoice, oppColor)
          setBoard(finalBoard)
          setCastlingRights(result.newCastlingRights)
          setEnPassantTarget(result.newEnPassantTarget)
          setCurrentTurn(nextTurn)
          setMoveCount(prev => prev + 1)
          const over = checkGameOver(finalBoard, nextTurn, result.newCastlingRights, result.newEnPassantTarget)
          if (over) {
            setGameResult(over)
            setGameStatus(over.reason === 'stalemate' ? 'draw' : 'win')
          }
        } else {
          setBoard(result.board)
          setCastlingRights(result.newCastlingRights)
          setEnPassantTarget(result.newEnPassantTarget)
          setMoveCount(prev => prev + 1)
          setCurrentTurn(nextTurn)
          const over = checkGameOver(result.board, nextTurn, result.newCastlingRights, result.newEnPassantTarget)
          if (over) {
            setGameResult(over)
            setGameStatus(over.reason === 'stalemate' ? 'draw' : 'win')
          }
        }
      }
    })

    const unsubGameOver = ng.onOpponentGameOver((payload) => {
      setGameResult({ winner: (payload.winner as PieceColor) || 'w', reason: (payload.reason as GameResult['reason']) || 'checkmate' })
      setGameStatus(payload.reason === 'stalemate' ? 'draw' : 'win')
    })

    const unsubDisc = ng.onOpponentDisconnected(() => {
      setGameStatus('win')
      setGameResult({ winner: myColor, reason: 'checkmate' })
    })

    const unsubRestartReq = ng.onRestartRequest(() => {
      setRestartIncoming(true)
    })

    const unsubRestartAccept = ng.onRestartAccept(() => {
      setRestartRequested(false)
      setRestartIncoming(false)
      setRestartDeclined(false)
      setBoard(createInitialBoard())
      setCurrentTurn('w')
      setGameResult(null)
      setGameStatus('playing')
      setSelectedCell(null)
      setLegalMoves([])
      setShowConfetti(false)
      setCastlingRights({ wK: true, wQ: true, bK: true, bQ: true })
      setEnPassantTarget(null)
      setMoveCount(0)
      setPromotionPending(false)
      setPromotionPos(null)
      setPendingResult(null)
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
  }, [isNetworkMode, board, myColor, castlingRights, enPassantTarget])

  if (gameResult && !showConfetti && gameResult.reason === 'checkmate') {
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 5000)
  }

  const handlePromotion = useCallback(
    (choice: PromotionChoice) => {
      if (!promotionPos || !pendingResult) return
      const { board: preBoard, newCastlingRights, newEnPassantTarget, nextTurn } = pendingResult
      const finalBoard = finalizePromotion(preBoard, promotionPos[0], promotionPos[1], choice, currentTurn)

      setBoard(finalBoard)
      setCastlingRights(newCastlingRights)
      setEnPassantTarget(newEnPassantTarget)
      setCurrentTurn(nextTurn)
      setMoveCount(prev => prev + 1)
      setPromotionPending(false)
      setPromotionPos(null)
      setPendingResult(null)

      if (isNetworkMode) {
        netGame.sendMove({
          fromRow: selectedCell?.[0],
          fromCol: selectedCell?.[1],
          toRow: promotionPos[0],
          toCol: promotionPos[1],
          promotion: choice
        })
      }

      const over = checkGameOver(finalBoard, nextTurn, newCastlingRights, newEnPassantTarget)
      if (over) {
        setGameResult(over)
        setGameStatus(over.reason === 'stalemate' ? 'draw' : 'win')
        if (isNetworkMode) {
          netGame.sendGameOver({ winner: over.winner, reason: over.reason, status: over.reason === 'stalemate' ? 'draw' : 'win' })
        }
      }
    },
    [promotionPos, pendingResult, currentTurn, isNetworkMode, netGame, selectedCell]
  )

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (gameStatus !== 'playing' || promotionPending) return
      if (isNetworkMode && !isMyTurn) return

      const piece = board[row][col]

      if (selectedCell) {
        if (selectedCell[0] === row && selectedCell[1] === col) {
          setSelectedCell(null)
          setLegalMoves([])
          return
        }
        if (piece && piece.color === currentTurn) {
          setSelectedCell([row, col])
          setLegalMoves(getLegalMoves(board, row, col, castlingRights, enPassantTarget))
          return
        }
        const result = makeMoveWithInfo(board, selectedCell[0], selectedCell[1], row, col, currentTurn, castlingRights, enPassantTarget)
        if (result) {
          const nextTurn: PieceColor = currentTurn === 'w' ? 'b' : 'w'

          if (result.info.needsPromotion && result.info.promotionPos) {
            setPromotionPending(true)
            setPromotionPos(result.info.promotionPos)
            setPendingResult({
              board: result.board,
              newCastlingRights: result.newCastlingRights,
              newEnPassantTarget: result.newEnPassantTarget,
              nextTurn
            })
            setSelectedCell(null)
            setLegalMoves([])
          } else {
            setBoard(result.board)
            setCastlingRights(result.newCastlingRights)
            setEnPassantTarget(result.newEnPassantTarget)
            setMoveCount(prev => prev + 1)
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

            const over = checkGameOver(result.board, nextTurn, result.newCastlingRights, result.newEnPassantTarget)
            if (over) {
              setGameResult(over)
              setGameStatus(over.reason === 'stalemate' ? 'draw' : 'win')
              if (isNetworkMode) {
                netGame.sendGameOver({ winner: over.winner, reason: over.reason, status: over.reason === 'stalemate' ? 'draw' : 'win' })
              }
            }
          }
        }
      } else {
        if (piece && piece.color === currentTurn) {
          setSelectedCell([row, col])
          setLegalMoves(getLegalMoves(board, row, col, castlingRights, enPassantTarget))
        }
      }
    },
    [board, currentTurn, selectedCell, gameStatus, castlingRights, enPassantTarget, promotionPending, isNetworkMode, isMyTurn, netGame]
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
      setCurrentTurn('w')
      setGameResult(null)
      setGameStatus('playing')
      setSelectedCell(null)
      setLegalMoves([])
      setShowConfetti(false)
      setCastlingRights({ wK: true, wQ: true, bK: true, bQ: true })
      setEnPassantTarget(null)
      setMoveCount(0)
      setPromotionPending(false)
      setPromotionPos(null)
      setPendingResult(null)
    }
  }, [isNetworkMode, netGame, network])

  const handleAcceptRestart = useCallback(() => {
    netGame.sendRestartAccept()
    setRestartRequested(false)
    setRestartIncoming(false)
    setRestartDeclined(false)
    setBoard(createInitialBoard())
    setCurrentTurn('w')
    setGameResult(null)
    setGameStatus('playing')
    setSelectedCell(null)
    setLegalMoves([])
    setShowConfetti(false)
    setCastlingRights({ wK: true, wQ: true, bK: true, bQ: true })
    setEnPassantTarget(null)
    setMoveCount(0)
    setPromotionPending(false)
    setPromotionPos(null)
    setPendingResult(null)
  }, [netGame])

  const isLegalTarget = (r: number, c: number): boolean => {
    return legalMoves.some(m => m.toRow === r && m.toCol === c)
  }

  const isSelected = (r: number, c: number): boolean => {
    return selectedCell !== null && selectedCell[0] === r && selectedCell[1] === c
  }

  const cellSize = Math.min(52, Math.floor((Math.min(window.innerWidth, 500) - 40) / BOARD_SIZE))

  const inCheck = isInCheck(board, currentTurn)

  return (
    <section className="relative w-full min-h-screen overflow-hidden">
      <Confetti active={showConfetti} />
      <div className="absolute inset-0" style={{ background: bgGradient }} />
      <div className="absolute inset-0" style={{ background: bgOverlay }} />

      <div className="relative z-10 flex flex-col items-center min-h-screen p-4">
        <div className="w-full max-w-2xl flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/')}
            onMouseEnter={() => setBackBtnHover(true)}
            onMouseLeave={() => setBackBtnHover(false)}
            className="flex items-center gap-2 transition-all duration-200 group"
            style={{ color: backBtnHover ? textPrimary : textSecondary }}
          >
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
              国际象棋 · {isNetworkMode ? '联机对战' : '本地双人'}
            </h2>
          </div>
          <div className="w-20" />
        </div>

        {isNetworkMode && (
          <div className="mb-2 text-xs tracking-[-0.02em]" style={{ color: textMuted }}>
            {network?.isHost ? `你 (白方) vs ${network?.opponentName} (黑方)` : `${network?.opponentName} (白方) vs 你 (黑方)`}
            {!isMyTurn && gameStatus === 'playing' && <span className="ml-2 text-[#F49D4D]">— 等待对手走棋...</span>}
          </div>
        )}

        <div className="w-full max-w-md flex items-center justify-between mb-6">
          <div className="flex flex-col items-center gap-2">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300"
              style={{
                background: currentTurn === 'b' && gameStatus === 'playing'
                  ? (mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)')
                  : (mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                boxShadow: currentTurn === 'b' && gameStatus === 'playing'
                  ? (mode === 'dark' ? '0 0 0 2px rgba(255,255,255,0.6)' : '0 0 0 2px rgba(0,0,0,0.15)')
                  : (mode === 'dark' ? '0 0 0 2px rgba(255,255,255,0.1)' : '0 0 0 2px rgba(0,0,0,0.06)')
              }}
            >
              <span className="text-xl">{'\u265A'}</span>
            </div>
            <span className="text-xs tracking-[-0.02em]" style={{ color: textSecondary }}>
              {isNetworkMode ? (network?.isHost ? '对手 · 黑方' : '你 · 黑方') : '玩家2 · 黑方'}
            </span>
            {currentTurn === 'b' && <Crown className="h-3 w-3" style={{ color: textSecondary }} />}
          </div>

          <div className="flex flex-col items-center">
            <Swords className="h-6 w-6" style={{ color: textMuted }} />
            <span className="text-xs mt-1 tracking-[-0.02em]" style={{ color: textMuted }}>
              {gameStatus === 'win' ? '游戏结束' : gameStatus === 'draw' ? '和棋' : inCheck ? '将军！' : `第 ${moveCount + 1} 手`}
            </span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300"
              style={{
                background: currentTurn === 'w' && gameStatus === 'playing'
                  ? (mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)')
                  : (mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                boxShadow: currentTurn === 'w' && gameStatus === 'playing'
                  ? (mode === 'dark' ? '0 0 0 2px rgba(255,255,255,0.6)' : '0 0 0 2px rgba(0,0,0,0.15)')
                  : (mode === 'dark' ? '0 0 0 2px rgba(255,255,255,0.1)' : '0 0 0 2px rgba(0,0,0,0.06)')
              }}
            >
              <span className="text-xl">{'\u2654'}</span>
            </div>
            <span className="text-xs tracking-[-0.02em]" style={{ color: textSecondary }}>
              {isNetworkMode ? (network?.isHost ? '你 · 白方' : '对手 · 白方') : '玩家1 · 白方'}
            </span>
            {currentTurn === 'w' && <Crown className="h-3 w-3 text-[#F49D4D]/60" />}
          </div>
        </div>

        <div className="relative mb-6">
          {gameStatus !== 'playing' && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-2xl">
              <div className="text-center">
                <p className="text-2xl font-black tracking-[-0.04em] mb-3" style={{ color: textPrimary }}>
                  {gameResult?.reason === 'stalemate'
                    ? '逼和！'
                    : gameResult?.winner === 'w'
                      ? (isNetworkMode ? (network?.isHost ? '你（白方）' : network?.opponentName + '（白方）') : '玩家1（白方）') + '获胜！'
                      : (isNetworkMode ? (network?.isHost ? network?.opponentName + '（黑方）' : '你（黑方）') : '玩家2（黑方）') + '获胜！'}
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

          {promotionPending && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl">
              <div className="bg-[#2B312C] rounded-2xl p-6 border shadow-2xl" style={{ borderColor }}>
                <p className="text-lg font-bold mb-4 text-center tracking-[-0.02em]" style={{ color: textPrimary }}>
                  选择升变棋子
                </p>
                <div className="flex gap-3">
                  {PROMOTION_OPTIONS.map(opt => (
                    <button
                      key={opt.type}
                      onClick={() => handlePromotion(opt.type)}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl border hover:bg-[#F49D4D]/20 hover:border-[#F49D4D]/40 transition-all duration-200"
                      style={{
                        background: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                        borderColor
                      }}
                    >
                      <span className="text-3xl">
                        {PIECE_SYMBOLS[currentTurn][opt.type as PieceType]}
                      </span>
                      <span className="text-xs" style={{ color: textSecondary }}>{opt.label}</span>
                    </button>
                  ))}
                </div>
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

          <div className="p-2 rounded-2xl bg-[#D4A574]/20 border backdrop-blur-sm" style={{ borderColor }}>
            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}>
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${BOARD_SIZE}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${BOARD_SIZE}, ${cellSize}px)`,
                gap: '0px'
              }}
            >
              {board.map((row, r) =>
                row.map((cell, c) => {
                  const isLight = (r + c) % 2 === 0
                  const isLegal = isLegalTarget(r, c)
                  const isCapture = isLegal && cell !== null
                  const sel = isSelected(r, c)

                  return (
                    <button
                      key={`${r}-${c}`}
                      onClick={() => handleCellClick(r, c)}
                      disabled={isNetworkMode && !isMyTurn && !sel}
                      className="relative flex items-center justify-center transition-all duration-150"
                      style={{
                        width: cellSize,
                        height: cellSize,
                        background: sel
                          ? '#F49D4D'
                          : isLight
                            ? '#E8D5B7'
                            : '#B58863'
                      }}
                    >
                      {isLegal && !isCapture && (
                        <div className="absolute w-1/3 h-1/3 rounded-full bg-black/20" />
                      )}
                      {isLegal && isCapture && (
                        <div className="absolute inset-1 rounded-full ring-2 ring-black/20" />
                      )}

                      {cell && (
                        <span
                          className="z-10 select-none pointer-events-none"
                          style={{
                            fontSize: cellSize * 0.75,
                            lineHeight: 1,
                            textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                          }}
                        >
                          {PIECE_SYMBOLS[cell.color][cell.type]}
                        </span>
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