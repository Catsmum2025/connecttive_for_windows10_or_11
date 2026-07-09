// Copyright 2026 Catsmum2025
// MIT License

export type Side = 'r' | 'b'
export type PieceType = 'K' | 'A' | 'E' | 'H' | 'R' | 'C' | 'P'

export interface Piece {
  type: PieceType
  side: Side
}

export type Cell = Piece | null
export type Board = Cell[][]

export const COLS = 9
export const ROWS = 10

export interface GameResult {
  winner: Side
  reason: 'checkmate'
}

export interface Move {
  fromRow: number
  fromCol: number
  toRow: number
  toCol: number
}

export interface MoveInfo {
  move: Move
  captured?: Piece
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS
}

function cloneBoard(board: Board): Board {
  return board.map(row => row.map(cell => (cell ? { ...cell } : null)))
}

export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: ROWS }, () => Array(COLS).fill(null))

  // 黑方（上方，row 0-4）
  board[0][0] = { type: 'R', side: 'b' }
  board[0][1] = { type: 'H', side: 'b' }
  board[0][2] = { type: 'E', side: 'b' }
  board[0][3] = { type: 'A', side: 'b' }
  board[0][4] = { type: 'K', side: 'b' }
  board[0][5] = { type: 'A', side: 'b' }
  board[0][6] = { type: 'E', side: 'b' }
  board[0][7] = { type: 'H', side: 'b' }
  board[0][8] = { type: 'R', side: 'b' }
  board[2][1] = { type: 'C', side: 'b' }
  board[2][7] = { type: 'C', side: 'b' }
  board[3][0] = { type: 'P', side: 'b' }
  board[3][2] = { type: 'P', side: 'b' }
  board[3][4] = { type: 'P', side: 'b' }
  board[3][6] = { type: 'P', side: 'b' }
  board[3][8] = { type: 'P', side: 'b' }

  // 红方（下方，row 5-9）
  board[9][0] = { type: 'R', side: 'r' }
  board[9][1] = { type: 'H', side: 'r' }
  board[9][2] = { type: 'E', side: 'r' }
  board[9][3] = { type: 'A', side: 'r' }
  board[9][4] = { type: 'K', side: 'r' }
  board[9][5] = { type: 'A', side: 'r' }
  board[9][6] = { type: 'E', side: 'r' }
  board[9][7] = { type: 'H', side: 'r' }
  board[9][8] = { type: 'R', side: 'r' }
  board[7][1] = { type: 'C', side: 'r' }
  board[7][7] = { type: 'C', side: 'r' }
  board[6][0] = { type: 'P', side: 'r' }
  board[6][2] = { type: 'P', side: 'r' }
  board[6][4] = { type: 'P', side: 'r' }
  board[6][6] = { type: 'P', side: 'r' }
  board[6][8] = { type: 'P', side: 'r' }

  return board
}

function inPalace(row: number, col: number, side: Side): boolean {
  return col >= 3 && col <= 5 && ((side === 'b' && row >= 0 && row <= 2) || (side === 'r' && row >= 7 && row <= 9))
}

function hasCrossedRiver(row: number, side: Side): boolean {
  return side === 'r' ? row <= 4 : row >= 5
}

function countPiecesBetween(board: Board, r1: number, c1: number, r2: number, c2: number): number {
  let count = 0
  if (r1 === r2) {
    const minC = Math.min(c1, c2)
    const maxC = Math.max(c1, c2)
    for (let c = minC + 1; c < maxC; c++) {
      if (board[r1][c]) count++
    }
  } else if (c1 === c2) {
    const minR = Math.min(r1, r2)
    const maxR = Math.max(r1, r2)
    for (let r = minR + 1; r < maxR; r++) {
      if (board[r][c1]) count++
    }
  }
  return count
}

// 获取某只棋子的原始走法（不考虑将军）
function getRawMoves(board: Board, row: number, col: number): Move[] {
  const piece = board[row][col]
  if (!piece) return []
  const { type, side } = piece
  const moves: Move[] = []

  const addIfValid = (r: number, c: number): boolean => {
    if (!inBounds(r, c)) return false
    const target = board[r][c]
    if (target && target.side === side) return false
    moves.push({ fromRow: row, fromCol: col, toRow: r, toCol: c })
    return true
  }

  switch (type) {
    case 'K': {
      // 将在九宫内移动，每次一步（上下左右）
      for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nr = row + dr
        const nc = col + dc
        if (inPalace(nr, nc, side)) {
          addIfValid(nr, nc)
        }
      }
      break
    }
    case 'A': {
      // 士在九宫内斜走一步
      for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nr = row + dr
        const nc = col + dc
        if (inPalace(nr, nc, side)) {
          addIfValid(nr, nc)
        }
      }
      break
    }
    case 'E': {
      // 象走"田"字，不能过河，注意蹩脚
      for (const [dr, dc, er, ec] of [[-2, -2, -1, -1], [-2, 2, -1, 1], [2, -2, 1, -1], [2, 2, 1, 1]]) {
        const nr = row + dr
        const nc = col + dc
        const eyeR = row + er
        const eyeC = col + ec
        if (inBounds(nr, nc) && !board[eyeR][eyeC] && !hasCrossedRiver(nr, side)) {
          addIfValid(nr, nc)
        }
      }
      break
    }
    case 'H': {
      // 马走"日"字，注意蹩脚
      const horseMoves: [number, number, number, number][] = [
        [-2, -1, -1, 0], [-2, 1, -1, 0],
        [2, -1, 1, 0], [2, 1, 1, 0],
        [-1, -2, 0, -1], [-1, 2, 0, 1],
        [1, -2, 0, -1], [1, 2, 0, 1]
      ]
      for (const [dr, dc, legR, legC] of horseMoves) {
        const nr = row + dr
        const nc = col + dc
        const legRow = row + legR
        const legCol = col + legC
        if (inBounds(nr, nc) && !board[legRow][legCol]) {
          addIfValid(nr, nc)
        }
      }
      break
    }
    case 'R': {
      // 车直线移动
      for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        for (let k = 1; k < 10; k++) {
          const nr = row + dr * k
          const nc = col + dc * k
          if (!inBounds(nr, nc)) break
          const target = board[nr][nc]
          if (target && target.side === side) break
          moves.push({ fromRow: row, fromCol: col, toRow: nr, toCol: nc })
          if (target) break
        }
      }
      break
    }
    case 'C': {
      // 炮移动像车，但吃子时必须隔一个子
      for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        for (let k = 1; k < 10; k++) {
          const nr = row + dr * k
          const nc = col + dc * k
          if (!inBounds(nr, nc)) break
          const target = board[nr][nc]
          if (!target) {
            moves.push({ fromRow: row, fromCol: col, toRow: nr, toCol: nc })
          } else {
            // 找到一个炮架，继续找下一个目标
            for (let k2 = k + 1; k2 < 10; k2++) {
              const nr2 = row + dr * k2
              const nc2 = col + dc * k2
              if (!inBounds(nr2, nc2)) break
              const target2 = board[nr2][nc2]
              if (target2) {
                if (target2.side !== side) {
                  moves.push({ fromRow: row, fromCol: col, toRow: nr2, toCol: nc2 })
                }
                break
              }
            }
            break
          }
        }
      }
      break
    }
    case 'P': {
      // 兵：未过河只能向前，过河后可以向前或左右
      const forward = side === 'r' ? -1 : 1
      const nr = row + forward
      if (inBounds(nr, col)) {
        const target = board[nr][col]
        if (!target || target.side !== side) {
          moves.push({ fromRow: row, fromCol: col, toRow: nr, toCol: col })
        }
      }
      if (hasCrossedRiver(row, side)) {
        for (const dc of [-1, 1]) {
          const nc = col + dc
          if (inBounds(row, nc)) {
            const target = board[row][nc]
            if (!target || target.side !== side) {
              moves.push({ fromRow: row, fromCol: col, toRow: row, toCol: nc })
            }
          }
        }
      }
      break
    }
  }
  return moves
}

// 找到将/帅的位置
function findKing(board: Board, side: Side): [number, number] | null {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c]
      if (p && p.type === 'K' && p.side === side) return [r, c]
    }
  }
  return null
}

// 检查飞将（两将对面）
function kingsAreFacing(board: Board): boolean {
  const rKing = findKing(board, 'r')
  const bKing = findKing(board, 'b')
  if (!rKing || !bKing) return false
  if (rKing[1] !== bKing[1]) return false
  return countPiecesBetween(board, rKing[0], rKing[1], bKing[0], bKing[1]) === 0
}

// 检查是否被将军
function isInCheck(board: Board, side: Side): boolean {
  const kingPos = findKing(board, side)
  if (!kingPos) return true
  const opponent: Side = side === 'r' ? 'b' : 'r'
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c]
      if (p && p.side === opponent) {
        const rawMoves = getRawMoves(board, r, c)
        if (rawMoves.some(m => m.toRow === kingPos[0] && m.toCol === kingPos[1])) {
          return true
        }
      }
    }
  }
  if (kingsAreFacing(board)) return true
  return false
}

function applyMove(board: Board, move: Move): Board {
  const newBoard = cloneBoard(board)
  newBoard[move.toRow][move.toCol] = newBoard[move.fromRow][move.fromCol]
  newBoard[move.fromRow][move.fromCol] = null
  return newBoard
}

export function getLegalMoves(board: Board, row: number, col: number): Move[] {
  const piece = board[row][col]
  if (!piece) return []
  const rawMoves = getRawMoves(board, row, col)
  return rawMoves.filter(move => {
    const newBoard = applyMove(board, move)
    return !isInCheck(newBoard, piece.side) && !kingsAreFacing(newBoard)
  })
}

export function hasLegalMoves(board: Board, side: Side): boolean {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c]
      if (p && p.side === side) {
        if (getLegalMoves(board, r, c).length > 0) return true
      }
    }
  }
  return false
}

export function checkGameOver(board: Board, currentTurn: Side): GameResult | null {
  if (!hasLegalMoves(board, currentTurn)) {
    const winner: Side = currentTurn === 'r' ? 'b' : 'r'
    return { winner, reason: 'checkmate' }
  }
  return null
}

export function isValidMove(board: Board, fromRow: number, fromCol: number, toRow: number, toCol: number, currentTurn: Side): boolean {
  const piece = board[fromRow][fromCol]
  if (!piece || piece.side !== currentTurn) return false
  const legalMoves = getLegalMoves(board, fromRow, fromCol)
  return legalMoves.some(m => m.toRow === toRow && m.toCol === toCol)
}

export function makeMoveWithInfo(board: Board, fromRow: number, fromCol: number, toRow: number, toCol: number, currentTurn: Side): { board: Board; info: MoveInfo } | null {
  const piece = board[fromRow][fromCol]
  if (!piece || piece.side !== currentTurn) return null
  const legalMoves = getLegalMoves(board, fromRow, fromCol)
  if (!legalMoves.some(m => m.toRow === toRow && m.toCol === toCol)) return null

  const newBoard = cloneBoard(board)
  const info: MoveInfo = { move: { fromRow, fromCol, toRow, toCol } }
  info.captured = newBoard[toRow][toCol] || undefined

  newBoard[toRow][toCol] = newBoard[fromRow][fromCol]
  newBoard[fromRow][fromCol] = null

  return { board: newBoard, info }
}