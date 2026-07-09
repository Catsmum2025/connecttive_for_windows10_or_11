// Copyright 2026 Catsmum2025
// MIT License

import { useState, useCallback, useEffect, useRef } from 'react'
import { ArrowLeft, Crown, Wifi, ZoomIn, ZoomOut, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../ThemeContext'
import { Confetti } from '../Confetti'
import { useNetworkGame } from '../../hooks/useNetworkGame'
import type { GameRoom } from '../../types'
import {
  BOARD_ROWS,
  BOARD_COLS,
  getCellType,
  isOnRailway,
  NULL_CELLS,
  getValidMoves,
  makeMove,
  getGameStatus,
  isPieceVisible,
  createDeploymentState,
  placePiece,
  removePiece,
  confirmDeployment,
  createGameStateFromDeployment,
  type JunqiGameState,
  type DeploymentState,
  type PieceType,
  type Player,
  PIECE_COUNTS,
} from '../../game/junqi'

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

const PIECE_SHORT: Record<PieceType, string> = {
  '司令': '司', '军长': '军', '师长': '师', '旅长': '旅',
  '团长': '团', '营长': '营', '连长': '连', '排长': '排',
  '工兵': '工', '炸弹': '炸', '地雷': '雷', '军旗': '旗',
}

export function JunqiBoard({ network }: Props): React.ReactElement {
  const navigate = useNavigate()
  const { bgGradient, bgOverlay, textPrimary, textSecondary, textMuted, borderColor, mode } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [deployState, setDeployState] = useState<DeploymentState>(createDeploymentState())
  const [gameState, setGameState] = useState<JunqiGameState | null>(null)
  const [selectedPieceType, setSelectedPieceType] = useState<PieceType | null>(null)
  const [hoverCell, setHoverCell] = useState<[number, number] | null>(null)
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null)
  const [validMoves, setValidMoves] = useState<[number, number][]>([])
  const [gameStatus, setGameStatus] = useState<'playing' | 'win' | 'draw'>('playing')
  const [showConfetti, setShowConfetti] = useState(false)
  const [message, setMessage] = useState('')
  const [canvasSize, setCanvasSize] = useState(600)
  const [zoom, setZoom] = useState(1)

  const isNetworkMode = !!network
  const myPlayer: Player = network?.isHost ? 'red' : 'blue'
  const netGame = useNetworkGame(
    network?.myId ?? null,
    network?.isHost ?? false,
    network?.opponentId ?? null,
    network?.opponentIp ?? null
  )
  const netGameRef = useRef(netGame)
  netGameRef.current = netGame

  const isDeploying = deployState.phase !== 'playing'
  const isMyDeploy = deployState.phase === 'red_deploy' ? myPlayer === 'red' : myPlayer === 'blue'
  const myConfirmed = myPlayer === 'red' ? deployState.redConfirmed : deployState.blueConfirmed
  const opponentConfirmed = myPlayer === 'red' ? deployState.blueConfirmed : deployState.redConfirmed
  const isMyTurn = gameState ? gameState.currentTurn === myPlayer : false
  const canAct = gameState && gameStatus === 'playing' && isMyTurn

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const maxH = Math.min(containerRef.current.clientHeight - 180, 700)
        const maxW = Math.min(containerRef.current.clientWidth - 32, 360)
        const cellByH = (maxH - 40) / BOARD_ROWS
        const cellByW = (maxW - 40) / BOARD_COLS
        setCanvasSize(Math.min(cellByH, cellByW, 46))
      }
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  const getCellFromEvent = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const padding = 20
      const cellSize = canvasSize * zoom
      const col = Math.floor((x - padding) / cellSize)
      const row = Math.floor((y - padding) / cellSize)
      if (col < 0 || col >= BOARD_COLS || row < 0 || row >= BOARD_ROWS) return null
      return { row, col }
    },
    [canvasSize, zoom]
  )

  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const cellSize = canvasSize * zoom
    const padding = 20
    const width = BOARD_COLS * cellSize + padding * 2
    const height = BOARD_ROWS * cellSize + padding * 2
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    const isDark = mode === 'dark'
    const boardBg = isDark ? '#D4A760' : '#DEB870'
    const lineColor = isDark ? '#5A4A32' : '#6B5A3E'
    const roadColor = isDark ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.08)'
    const railColor = isDark ? '#4A3820' : '#5A4A2E'
    const campBg = isDark ? 'rgba(76,175,80,0.12)' : 'rgba(76,175,80,0.08)'
    const hqBg = isDark ? 'rgba(244,157,77,0.15)' : 'rgba(244,157,77,0.1)'

    const board = gameState?.board ?? deployState.board

    // 全局背景
    ctx.fillStyle = boardBg
    ctx.fillRect(0, 0, width, height)

    // 第一步：绘制所有公路线（细线，连接相邻格子）
    ctx.strokeStyle = roadColor
    ctx.lineWidth = 0.6
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        if (getCellType(r, c) === null) continue
        const cx = padding + c * cellSize + cellSize / 2
        const cy = padding + r * cellSize + cellSize / 2
        // 右邻居
        if (c + 1 < BOARD_COLS && getCellType(r, c + 1) !== null) {
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(cx + cellSize, cy)
          ctx.stroke()
        }
        // 下邻居
        if (r + 1 < BOARD_ROWS && getCellType(r + 1, c) !== null) {
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(cx, cy + cellSize)
          ctx.stroke()
        }
      }
    }

    // 第二步：绘制所有铁路线（粗线）
    ctx.strokeStyle = railColor
    ctx.lineWidth = 2.5
    // 三条纵向铁路：A列(0), C列(2), E列(4)
    for (const col of [0, 2, 4]) {
      for (let r = 0; r < BOARD_ROWS - 1; r++) {
        if (getCellType(r, col) === null) continue
        // 找到下一个有效的铁路格子
        let nextR = r + 1
        while (nextR < BOARD_ROWS && getCellType(nextR, col) === null) nextR++
        if (nextR >= BOARD_ROWS) break
        const cy1 = padding + r * cellSize + cellSize / 2
        const cx1 = padding + col * cellSize + cellSize / 2
        const cy2 = padding + nextR * cellSize + cellSize / 2
        const cx2 = padding + col * cellSize + cellSize / 2
        ctx.beginPath()
        ctx.moveTo(cx1, cy1)
        ctx.lineTo(cx2, cy2)
        ctx.stroke()
      }
    }
    // 横向铁路：A6→C6→E6, A7→C7→E7
    for (const row of [5, 6]) {
      const cols = [0, 2, 4]
      for (let i = 0; i < cols.length - 1; i++) {
        const c1 = cols[i]
        const c2 = cols[i + 1]
        if (getCellType(row, c1) === null || getCellType(row, c2) === null) continue
        // 检查中间列是否为空(跳过B/D列空位)
        const midCol = (c1 + c2) / 2
        if (getCellType(row, midCol) !== null) continue // 中间有格子，不画长线
        const cx1 = padding + c1 * cellSize + cellSize / 2
        const cy = padding + row * cellSize + cellSize / 2
        const cx2 = padding + c2 * cellSize + cellSize / 2
        ctx.beginPath()
        ctx.moveTo(cx1, cy)
        ctx.lineTo(cx2, cy)
        ctx.stroke()
      }
    }

    // 绘制每个格子
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const ct = getCellType(r, c)
        if (ct === null) continue
        const cx = padding + c * cellSize
        const cy = padding + r * cellSize
        const centerX = cx + cellSize / 2
        const centerY = cy + cellSize / 2

        // 格子背景
        if (ct === 'camp') {
          ctx.fillStyle = campBg
          ctx.fillRect(cx, cy, cellSize, cellSize)
        } else if (ct === 'headquarters') {
          ctx.fillStyle = hqBg
          ctx.fillRect(cx, cy, cellSize, cellSize)
        }

        // 格子边框
        ctx.strokeStyle = lineColor
        ctx.lineWidth = 0.6
        ctx.strokeRect(cx, cy, cellSize, cellSize)

        // 行营圆圈
        if (ct === 'camp') {
          ctx.strokeStyle = isDark ? 'rgba(76,175,80,0.5)' : 'rgba(76,175,80,0.35)'
          ctx.lineWidth = 1.8
          ctx.beginPath()
          ctx.arc(centerX, centerY, cellSize * 0.35, 0, Math.PI * 2)
          ctx.stroke()
          ctx.strokeStyle = isDark ? 'rgba(76,175,80,0.2)' : 'rgba(76,175,80,0.12)'
          ctx.lineWidth = 0.8
          ctx.beginPath()
          ctx.arc(centerX, centerY, cellSize * 0.18, 0, Math.PI * 2)
          ctx.stroke()
        }

        // 大本营标识
        if (ct === 'headquarters') {
          ctx.fillStyle = isDark ? 'rgba(244,157,77,0.5)' : 'rgba(244,157,77,0.4)'
          ctx.font = `${cellSize * 0.45}px serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('🏁', centerX, centerY)
        }
      }
    }

    // 山界分隔线（第6-7行之间）
    const dividerY = padding + 6 * cellSize
    ctx.fillStyle = isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.12)'
    ctx.fillRect(padding, dividerY - 2, BOARD_COLS * cellSize, 4)
    ctx.fillStyle = isDark ? '#8B7355' : '#A0896C'
    ctx.font = `bold ${cellSize * 0.38}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('山  界', padding + (BOARD_COLS * cellSize) / 2, dividerY)

    // 布阵阶段：高亮己方可放置区域
    if (isDeploying && isMyDeploy && !myConfirmed && selectedPieceType) {
      const playerRows = myPlayer === 'red' ? [0, 1, 2, 3, 4] : [7, 8, 9, 10, 11]
      for (const r of playerRows) {
        for (let c = 0; c < BOARD_COLS; c++) {
          if (getCellType(r, c) === null) continue
          if (board[r]?.[c]) continue
          const ct = getCellType(r, c)
          if (ct === 'camp') continue
          // 简单检查可否放置
          let canPlace = true
          if (selectedPieceType === '军旗' && ct !== 'headquarters') canPlace = false
          if (selectedPieceType === '地雷' && ct === 'headquarters') canPlace = false
          if (selectedPieceType === '地雷' && myPlayer === 'red' && r !== 0 && r !== 1) canPlace = false
          if (selectedPieceType === '地雷' && myPlayer === 'blue' && r !== 10 && r !== 11) canPlace = false
          if (selectedPieceType === '炸弹' && myPlayer === 'red' && r === 0) canPlace = false
          if (selectedPieceType === '炸弹' && myPlayer === 'blue' && r === 11) canPlace = false
          if (selectedPieceType !== '军旗' && ct === 'headquarters') {
            const hqRow = myPlayer === 'red' ? 0 : 11
            if (board[hqRow][1] && board[hqRow][3]) canPlace = false
          }
          if (canPlace) {
            const px = padding + c * cellSize + cellSize / 2
            const py = padding + r * cellSize + cellSize / 2
            ctx.fillStyle = 'rgba(76,175,80,0.3)'
            ctx.beginPath()
            ctx.arc(px, py, cellSize * 0.12, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }
    }

    // 对局阶段：高亮可移动位置
    if (!isDeploying && selectedCell && gameState) {
      for (const [mr, mc] of validMoves) {
        const mx = padding + mc * cellSize + cellSize / 2
        const my = padding + mr * cellSize + cellSize / 2
        const target = gameState.board[mr][mc]
        if (target && target.player !== myPlayer) {
          ctx.fillStyle = 'rgba(244,67,54,0.25)'
          ctx.beginPath()
          ctx.arc(mx, my, cellSize * 0.38, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = 'rgba(244,67,54,0.5)'
          ctx.lineWidth = 2
          ctx.stroke()
        } else {
          ctx.fillStyle = 'rgba(76,175,80,0.35)'
          ctx.beginPath()
          ctx.arc(mx, my, cellSize * 0.14, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    // 选中格高亮
    if (selectedCell) {
      const [sr, sc] = selectedCell
      if (getCellType(sr, sc) !== null) {
        const sx = padding + sc * cellSize
        const sy = padding + sr * cellSize
        ctx.strokeStyle = '#FFD700'
        ctx.lineWidth = 2.5
        ctx.strokeRect(sx + 1, sy + 1, cellSize - 2, cellSize - 2)
      }
    }

    // 绘制棋子
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const ct = getCellType(r, c)
        if (ct === null) continue
        const piece = board[r]?.[c]
        if (!piece) continue
        const cx = padding + c * cellSize + cellSize / 2
        const cy = padding + r * cellSize + cellSize / 2
        const radius = cellSize * 0.38

        const viewer = myPlayer
        let visible = true
        let label = PIECE_SHORT[piece.type]
        if (gameState && !isDeploying) {
          visible = isPieceVisible(gameState, piece, viewer)
          if (!visible) label = '?'
        }

        const isSelected = selectedCell && selectedCell[0] === r && selectedCell[1] === c

        // 阴影
        ctx.fillStyle = 'rgba(0,0,0,0.25)'
        ctx.beginPath()
        ctx.arc(cx + 1, cy + 1.5, radius, 0, Math.PI * 2)
        ctx.fill()

        // 棋子主体
        let pieceColor: string
        if (visible) {
          pieceColor = piece.player === 'red' ? '#C62828' : '#1565C0'
        } else {
          pieceColor = isDark ? '#555' : '#888'
        }
        ctx.fillStyle = pieceColor
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.fill()

        // 边框
        if (isSelected) {
          ctx.strokeStyle = '#FFD700'
          ctx.lineWidth = 2.5
        } else {
          ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'
          ctx.lineWidth = 1
        }
        ctx.stroke()

        // 文字
        ctx.fillStyle = '#fff'
        const fontSize = cellSize * 0.32
        ctx.font = `bold ${fontSize}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, cx, cy)

        // 最后一步移动指示
        if (gameState) {
          const lastMove = gameState.moveHistory[gameState.moveHistory.length - 1]
          if (lastMove && lastMove.toRow === r && lastMove.toCol === c) {
            ctx.strokeStyle = '#FFD700'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2)
            ctx.stroke()
          }
        }
      }
    }

    // 悬停预览
    if (hoverCell && !isDeploying && canAct && gameState) {
      const [hr, hc] = hoverCell
      const piece = gameState.board[hr][hc]
      if (piece && piece.player === myPlayer && !selectedCell) {
        const cx = padding + hc * cellSize + cellSize / 2
        const cy = padding + hr * cellSize + cellSize / 2
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(cx, cy, cellSize * 0.38 + 2, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }, [deployState, gameState, hoverCell, selectedCell, selectedPieceType, validMoves, canvasSize, zoom, isDeploying, isMyDeploy, myConfirmed, myPlayer, canAct, mode])

  useEffect(() => {
    drawBoard()
  }, [drawBoard])

  // 布阵阶段：放置棋子
  const handleDeployClick = useCallback(
    (row: number, col: number) => {
      if (!isMyDeploy || myConfirmed) return
      if (!selectedPieceType) {
        // 点击已有棋子：移除
        const piece = deployState.board[row][col]
        if (piece && piece.player === myPlayer) {
          const result = removePiece(deployState, myPlayer, row, col)
          if (result.valid && result.newState) {
            setDeployState(result.newState)
            setMessage('')
          }
        }
        return
      }
      // 放置棋子
      const result = placePiece(deployState, myPlayer, selectedPieceType, row, col)
      if (result.valid && result.newState) {
        setDeployState(result.newState)
        setMessage('')
        // 检查是否还有该类型棋子
        const remaining = myPlayer === 'red' ? result.newState.redRemaining : result.newState.blueRemaining
        if (!remaining.includes(selectedPieceType)) {
          setSelectedPieceType(null)
        }
      } else {
        setMessage(result.message)
        setTimeout(() => setMessage(''), 2000)
      }
    },
    [deployState, isMyDeploy, myConfirmed, selectedPieceType, myPlayer]
  )

  // 对局阶段：行棋
  const handlePlayClick = useCallback(
    (row: number, col: number) => {
      if (!gameState || !canAct) return
      const piece = gameState.board[row][col]

      if (selectedCell) {
        const [sr, sc] = selectedCell
        if (sr === row && sc === col) {
          setSelectedCell(null)
          setValidMoves([])
          return
        }
        if (validMoves.some(([r, c]) => r === row && c === col)) {
          const result = makeMove(gameState, sr, sc, row, col)
          if (result.valid && result.newState) {
            setGameState(result.newState)
            setSelectedCell(null)
            setValidMoves([])
            setMessage('')
            const status = getGameStatus(result.newState)
            setGameStatus(status)

            if (isNetworkMode) {
              const lastMove = result.newState.moveHistory[result.newState.moveHistory.length - 1]
              netGameRef.current.sendMove({
                fromRow: sr, fromCol: sc, toRow: row, toCol: col,
                piece: lastMove.piece,
                captured: lastMove.captured,
                battleResult: lastMove.battleResult,
              })
            }
            if (status === 'win') {
              setShowConfetti(true)
              setTimeout(() => setShowConfetti(false), 4000)
            }
          } else {
            setMessage(result.message)
            setTimeout(() => setMessage(''), 2000)
          }
          return
        }
        if (piece && piece.player === myPlayer) {
          setSelectedCell([row, col])
          return
        }
        setSelectedCell(null)
        setValidMoves([])
        return
      }

      if (piece && piece.player === myPlayer) {
        setSelectedCell([row, col])
      }
    },
    [gameState, canAct, selectedCell, validMoves, myPlayer, isNetworkMode]
  )

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const cell = getCellFromEvent(e)
      if (!cell) return
      const { row, col } = cell
      if (getCellType(row, col) === null) return

      if (isDeploying) {
        handleDeployClick(row, col)
      } else {
        handlePlayClick(row, col)
      }
    },
    [isDeploying, handleDeployClick, handlePlayClick, getCellFromEvent]
  )

  useEffect(() => {
    if (selectedCell && gameState && !isDeploying) {
      const [sr, sc] = selectedCell
      setValidMoves(getValidMoves(gameState.board, sr, sc, myPlayer))
    } else {
      setValidMoves([])
    }
  }, [selectedCell, gameState, isDeploying, myPlayer])

  const handleCanvasMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const cell = getCellFromEvent(e)
      setHoverCell(cell ? [cell.row, cell.col] : null)
    },
    [getCellFromEvent]
  )

  // 确认布阵
  const handleConfirmDeploy = () => {
    const result = confirmDeployment(deployState, myPlayer)
    if (result.valid && result.newState) {
      setDeployState(result.newState)
      setMessage('')
      if (result.newState.phase === 'playing') {
        setGameState(createGameStateFromDeployment(result.newState))
      }
    } else {
      setMessage(result.message)
      setTimeout(() => setMessage(''), 2000)
    }
  }

  // 对手移动
  useEffect(() => {
    if (!isNetworkMode || !gameState) return
    const unsub = netGame.onOpponentMove((payload) => {
      const { fromRow, fromCol, toRow, toCol } = payload as {
        fromRow: number; fromCol: number; toRow: number; toCol: number
        piece?: PieceType; captured?: PieceType; battleResult?: string
      }
      const result = makeMove(gameState, fromRow, fromCol, toRow, toCol)
      if (result.valid && result.newState) {
        setGameState(result.newState)
        const status = getGameStatus(result.newState)
        setGameStatus(status)
        if (status === 'win') {
          setShowConfetti(true)
          setTimeout(() => setShowConfetti(false), 4000)
        }
      }
    })
    return () => unsub()
  }, [isNetworkMode, gameState])

  const turnLabel = gameState ? (gameState.currentTurn === 'red' ? '红方' : '蓝方') : ''
  const myLabel = myPlayer === 'red' ? '红方' : '蓝方'
  const opponentLabel = myPlayer === 'red' ? '蓝方' : '红方'

  // 剩余棋子列表
  const myRemaining = myPlayer === 'red' ? deployState.redRemaining : deployState.blueRemaining
  const remainingCounts = new Map<PieceType, number>()
  for (const t of myRemaining) {
    remainingCounts.set(t, (remainingCounts.get(t) || 0) + 1)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: bgGradient }}>
      {showConfetti && <Confetti active={true} />}
      <div className="absolute inset-0 pointer-events-none" style={{ background: bgOverlay }} />

      <div className="relative z-10 flex-1 flex flex-col">
        {/* 顶部栏 */}
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
            {isNetworkMode && (
              <div className="flex items-center gap-1.5">
                <Wifi className="h-3.5 w-3.5" style={{ color: '#4CAF50' }} />
                <span className="text-xs tracking-[-0.02em]" style={{ color: '#4CAF50' }}>联机中</span>
              </div>
            )}
          </div>
        </div>

        {/* 对手信息 */}
        <div className="flex items-center justify-between px-4 py-1">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ background: myPlayer === 'red' ? '#1565C0' : '#C62828' }} />
            <span className="text-sm font-medium tracking-[-0.02em]" style={{ color: textPrimary }}>
              {opponentLabel}
            </span>
            {isNetworkMode && (
              <span className="text-xs tracking-[-0.02em]" style={{ color: textMuted }}>
                {network?.opponentName}
              </span>
            )}
          </div>
          {gameState && (
            <span className="text-xs tracking-[-0.02em]" style={{ color: textMuted }}>
              被吃: {myPlayer === 'red' ? gameState.blueCaptured.length : gameState.redCaptured.length}
            </span>
          )}
        </div>

        {/* 棋盘 */}
        <div className="flex-1 flex flex-col items-center justify-center p-4" ref={containerRef}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="p-1.5 rounded-full transition-all hover:opacity-70" style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
              <ZoomOut className="h-4 w-4" style={{ color: textSecondary }} />
            </button>
            <span className="text-xs tracking-[-0.02em]" style={{ color: textMuted }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2, z + 0.25))} className="p-1.5 rounded-full transition-all hover:opacity-70" style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
              <ZoomIn className="h-4 w-4" style={{ color: textSecondary }} />
            </button>
          </div>

          {/* 布阵阶段：棋子选择面板 */}
          {isDeploying && isMyDeploy && !myConfirmed && (
            <div className="flex flex-wrap gap-1.5 justify-center mb-2 max-w-[360px]">
              {Array.from(remainingCounts.entries())
                .sort(([a], [b]) => PIECE_COUNTS[b] - PIECE_COUNTS[a])
                .map(([type, count]) => (
                  <button
                    key={type}
                    onClick={() => setSelectedPieceType(selectedPieceType === type ? null : type)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                      selectedPieceType === type
                        ? 'bg-[#F49D4D] text-white'
                        : 'bg-white/10 text-white/80 hover:bg-white/20'
                    }`}
                  >
                    {PIECE_SHORT[type]}
                    <span className="opacity-60">×{count}</span>
                  </button>
                ))}
            </div>
          )}

          <div className="overflow-auto max-w-full max-h-full">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMove}
              onMouseLeave={() => setHoverCell(null)}
              className="rounded-lg shadow-2xl cursor-pointer"
              style={{ borderColor, borderWidth: 1 }}
            />
          </div>
        </div>

        {/* 己方信息 */}
        <div className="flex items-center justify-between px-4 py-1">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ background: myPlayer === 'red' ? '#C62828' : '#1565C0' }} />
            <span className="text-sm font-medium tracking-[-0.02em]" style={{ color: textPrimary }}>
              {myLabel}（你）
            </span>
          </div>
          {gameState && (
            <span className="text-xs tracking-[-0.02em]" style={{ color: textMuted }}>
              被吃: {myPlayer === 'red' ? gameState.redCaptured.length : gameState.blueCaptured.length}
            </span>
          )}
        </div>

        {/* 底部状态 */}
        <div className="px-4 py-3 flex flex-col items-center gap-2">
          {message && (
            <div className="text-xs px-3 py-1 rounded-full bg-red-500/10 text-red-400 tracking-[-0.02em]">
              {message}
            </div>
          )}

          {isDeploying ? (
            <div className="flex flex-col items-center gap-2">
              {isMyDeploy ? (
                <>
                  <span className="text-sm font-medium tracking-[-0.02em]" style={{ color: textPrimary }}>
                    {myConfirmed ? '等待对方布阵完成...' : `布阵阶段 - 剩余 ${myRemaining.length} 枚棋子`}
                  </span>
                  {!myConfirmed && (
                    <button
                      onClick={handleConfirmDeploy}
                      disabled={myRemaining.length > 0}
                      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                        myRemaining.length === 0
                          ? 'bg-[#F49D4D] text-[#2B312C] hover:opacity-90'
                          : 'bg-white/10 text-white/40 cursor-not-allowed'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                      布阵完成
                    </button>
                  )}
                </>
              ) : (
                <span className="text-sm font-medium tracking-[-0.02em]" style={{ color: textMuted }}>
                  {opponentConfirmed ? '对方已完成布阵，等待你...' : '等待对方布阵...'}
                </span>
              )}
            </div>
          ) : gameStatus === 'playing' ? (
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${gameState?.currentTurn === 'red' ? 'bg-red-600' : 'bg-blue-600'}`} />
              <span className="text-sm font-medium tracking-[-0.02em]" style={{ color: textPrimary }}>
                {turnLabel}回合
              </span>
              {isNetworkMode && (
                <span className="text-xs tracking-[-0.02em]" style={{ color: textMuted }}>
                  {isMyTurn ? '（你的回合）' : '（等待对方）'}
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                <span className="text-lg font-semibold tracking-[-0.02em]" style={{ color: textPrimary }}>
                  {gameState?.winner === 'red' ? '红方胜！' : '蓝方胜！'}
                </span>
              </div>
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