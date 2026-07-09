// Copyright 2026 Catsmum2025
// MIT License

export type PieceColor = 'w' | 'b'
export type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P'
export type PromotionChoice = 'Q' | 'R' | 'B' | 'N'

export interface Piece {
  type: PieceType
  color: PieceColor
}

export type Cell = Piece | null
export type Board = Cell[][]

export const BOARD_SIZE = 8

export interface GameResult {
  winner?: PieceColor
  reason: 'checkmate' | 'stalemate'
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
  needsPromotion?: boolean
  promotionPos?: [number, number]
  castling?: 'K' | 'Q'
  enPassant?: boolean
}

export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null))

  const backRank: PieceType[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']

  for (let col = 0; col < 8; col++) {
    board[0][col] = { type: backRank[col], color: 'b' }
    board[1][col] = { type: 'P', color: 'b' }
    board[6][col] = { type: 'P', color: 'w' }
    board[7][col] = { type: backRank[col], color: 'w' }
  }

  return board
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8
}

function cloneBoard(board: Board): Board {
  return board.map(row => row.map(cell => (cell ? { ...cell } : null)))
}

export function getPieceAt(board: Board, row: number, col: number): Piece | null {
  if (!inBounds(row, col)) return null
  return board[row][col]
}

function getRawMoves(board: Board, row: number, col: number, castlingRights: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean }, enPassantTarget: [number, number] | null): Move[] {
  const piece = board[row][col]
  if (!piece) return []
  const { type, color } = piece
  const moves: Move[] = []

  const addMove = (r: number, c: number) => {
    if (!inBounds(r, c)) return false
    const target = board[r][c]
    if (target && target.color === color) return false
    moves.push({ fromRow: row, fromCol: col, toRow: r, toCol: c })
    return target === null
  }

  const addSliding = (dr: number, dc: number) => {
    for (let i = 1; i < 8; i++) {
      if (!addMove(row + dr * i, col + dc * i)) break
    }
  }

  switch (type) {
    case 'P': {
      const dir = color === 'w' ? -1 : 1
      const startRow = color === 'w' ? 6 : 1
      if (inBounds(row + dir, col) && !board[row + dir][col]) {
        moves.push({ fromRow: row, fromCol: col, toRow: row + dir, toCol: col })
        if (row === startRow && !board[row + 2 * dir][col]) {
          moves.push({ fromRow: row, fromCol: col, toRow: row + 2 * dir, toCol: col })
        }
      }
      for (const dc of [-1, 1]) {
        const nr = row + dir
        const nc = col + dc
        if (inBounds(nr, nc)) {
          const target = board[nr][nc]
          if (target && target.color !== color) {
            moves.push({ fromRow: row, fromCol: col, toRow: nr, toCol: nc })
          }
          if (enPassantTarget && nr === enPassantTarget[0] && nc === enPassantTarget[1]) {
            moves.push({ fromRow: row, fromCol: col, toRow: nr, toCol: nc })
          }
        }
      }
      break
    }
    case 'N':
      for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
        addMove(row + dr, col + dc)
      }
      break
    case 'B':
      for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        addSliding(dr, dc)
      }
      break
    case 'R':
      for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        addSliding(dr, dc)
      }
      break
    case 'Q':
      for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        addSliding(dr, dc)
      }
      break
    case 'K':
      for (const [dr, dc] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
        addMove(row + dr, col + dc)
      }
      if (color === 'w' && row === 7 && col === 4) {
        if (castlingRights.wK && !board[7][5] && !board[7][6] && board[7][7]?.type === 'R') {
          moves.push({ fromRow: 7, fromCol: 4, toRow: 7, toCol: 6 })
        }
        if (castlingRights.wQ && !board[7][3] && !board[7][2] && !board[7][1] && board[7][0]?.type === 'R') {
          moves.push({ fromRow: 7, fromCol: 4, toRow: 7, toCol: 2 })
        }
      }
      if (color === 'b' && row === 0 && col === 4) {
        if (castlingRights.bK && !board[0][5] && !board[0][6] && board[0][7]?.type === 'R') {
          moves.push({ fromRow: 0, fromCol: 4, toRow: 0, toCol: 6 })
        }
        if (castlingRights.bQ && !board[0][3] && !board[0][2] && !board[0][1] && board[0][0]?.type === 'R') {
          moves.push({ fromRow: 0, fromCol: 4, toRow: 0, toCol: 2 })
        }
      }
      break
  }
  return moves
}

function findKing(board: Board, color: PieceColor): [number, number] | null {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (p && p.type === 'K' && p.color === color) return [r, c]
    }
  }
  return null
}

export function isInCheck(board: Board, color: PieceColor): boolean {
  const kingPos = findKing(board, color)
  if (!kingPos) return true
  const opponent = color === 'w' ? 'b' : 'w'
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (p && p.color === opponent) {
        const rawMoves = getRawMoves(board, r, c, { wK: false, wQ: false, bK: false, bQ: false }, null)
        if (rawMoves.some(m => m.toRow === kingPos[0] && m.toCol === kingPos[1])) {
          return true
        }
      }
    }
  }
  return false
}

function applyMove(board: Board, move: Move): Board {
  const newBoard = cloneBoard(board)
  newBoard[move.toRow][move.toCol] = newBoard[move.fromRow][move.fromCol]
  newBoard[move.fromRow][move.fromCol] = null
  return newBoard
}

export function getLegalMoves(
  board: Board,
  row: number,
  col: number,
  castlingRights: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean },
  enPassantTarget: [number, number] | null
): Move[] {
  const piece = board[row][col]
  if (!piece) return []
  const rawMoves = getRawMoves(board, row, col, castlingRights, enPassantTarget)
  return rawMoves.filter(move => {
    const newBoard = applyMove(board, move)
    if (piece.type === 'K' && Math.abs(move.toCol - move.fromCol) === 2) {
      const dir = move.toCol > move.fromCol ? 1 : -1
      for (let c = move.fromCol; c !== move.toCol + dir; c += dir) {
        const midBoard = cloneBoard(board)
        midBoard[move.fromRow][move.fromCol] = null
        midBoard[move.fromRow][c] = piece
        if (isInCheck(midBoard, piece.color)) return false
      }
      return !isInCheck(newBoard, piece.color)
    }
    return !isInCheck(newBoard, piece.color)
  })
}

export function hasLegalMoves(
  board: Board,
  color: PieceColor,
  castlingRights: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean },
  enPassantTarget: [number, number] | null
): boolean {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (p && p.color === color) {
        if (getLegalMoves(board, r, c, castlingRights, enPassantTarget).length > 0) {
          return true
        }
      }
    }
  }
  return false
}

export function checkGameOver(
  board: Board,
  currentTurn: PieceColor,
  castlingRights: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean },
  enPassantTarget: [number, number] | null
): GameResult | null {
  if (!hasLegalMoves(board, currentTurn, castlingRights, enPassantTarget)) {
    if (isInCheck(board, currentTurn)) {
      const winner: PieceColor = currentTurn === 'w' ? 'b' : 'w'
      return { winner, reason: 'checkmate' }
    }
    return { reason: 'stalemate' }
  }
  return null
}

export function isValidMove(
  board: Board,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  currentTurn: PieceColor,
  castlingRights: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean },
  enPassantTarget: [number, number] | null
): boolean {
  const piece = board[fromRow][fromCol]
  if (!piece || piece.color !== currentTurn) return false
  const legalMoves = getLegalMoves(board, fromRow, fromCol, castlingRights, enPassantTarget)
  return legalMoves.some(m => m.toRow === toRow && m.toCol === toCol)
}

export function makeMoveWithInfo(
  board: Board,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  currentTurn: PieceColor,
  castlingRights: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean },
  enPassantTarget: [number, number] | null
): { board: Board; info: MoveInfo; newCastlingRights: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean }; newEnPassantTarget: [number, number] | null } | null {
  const piece = board[fromRow][fromCol]
  if (!piece || piece.color !== currentTurn) return null
  const legalMoves = getLegalMoves(board, fromRow, fromCol, castlingRights, enPassantTarget)
  if (!legalMoves.some(m => m.toRow === toRow && m.toCol === toCol)) return null

  const newBoard = cloneBoard(board)
  const info: MoveInfo = { move: { fromRow, fromCol, toRow, toCol } }
  info.captured = newBoard[toRow][toCol] || undefined

  if (piece.type === 'P' && enPassantTarget && toRow === enPassantTarget[0] && toCol === enPassantTarget[1]) {
    const capturedRow = currentTurn === 'w' ? toRow + 1 : toRow - 1
    info.captured = newBoard[capturedRow][toCol] || undefined
    newBoard[capturedRow][toCol] = null
    info.enPassant = true
  }

  newBoard[toRow][toCol] = newBoard[fromRow][fromCol]
  newBoard[fromRow][fromCol] = null

  const newCR = { ...castlingRights }
  if (piece.type === 'K' && Math.abs(toCol - fromCol) === 2) {
    info.castling = toCol > fromCol ? 'K' : 'Q'
    if (toCol > fromCol) {
      newBoard[fromRow][5] = newBoard[fromRow][7]
      newBoard[fromRow][7] = null
    } else {
      newBoard[fromRow][3] = newBoard[fromRow][0]
      newBoard[fromRow][0] = null
    }
  }

  // 兵升变：不自动升变，标记 needsPromotion
  if (piece.type === 'P' && (toRow === 0 || toRow === 7)) {
    info.needsPromotion = true
    info.promotionPos = [toRow, toCol]
  }

  if (piece.type === 'K') {
    if (piece.color === 'w') { newCR.wK = false; newCR.wQ = false }
    else { newCR.bK = false; newCR.bQ = false }
  }
  if (piece.type === 'R') {
    if (fromRow === 7 && fromCol === 0) newCR.wQ = false
    if (fromRow === 7 && fromCol === 7) newCR.wK = false
    if (fromRow === 0 && fromCol === 0) newCR.bQ = false
    if (fromRow === 0 && fromCol === 7) newCR.bK = false
  }
  if (toRow === 7 && toCol === 0) newCR.wQ = false
  if (toRow === 7 && toCol === 7) newCR.wK = false
  if (toRow === 0 && toCol === 0) newCR.bQ = false
  if (toRow === 0 && toCol === 7) newCR.bK = false

  let newEP: [number, number] | null = null
  if (piece.type === 'P' && Math.abs(toRow - fromRow) === 2) {
    newEP = [(fromRow + toRow) / 2, fromCol]
  }

  return { board: newBoard, info, newCastlingRights: newCR, newEnPassantTarget: newEP }
}

export function finalizePromotion(board: Board, row: number, col: number, promotionType: PromotionChoice, color: PieceColor): Board {
  const newBoard = cloneBoard(board)
  newBoard[row][col] = { type: promotionType, color }
  return newBoard
}