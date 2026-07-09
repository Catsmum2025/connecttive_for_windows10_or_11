// Copyright 2026 Catsmum2025
// MIT License

export type Stone = 'black' | 'white'
export type CellValue = Stone | null
export type Board = CellValue[]

export const BOARD_SIZE = 19
export const TOTAL_CELLS = BOARD_SIZE * BOARD_SIZE

export type GameResult = {
  winner: Stone
  line: number[]
} | null

// 四个方向：水平、垂直、对角线、反对角线
const DIRECTIONS = [
  [0, 1],   // 水平
  [1, 0],   // 垂直
  [1, 1],   // 对角线
  [1, -1],  // 反对角线
]

function toRowCol(index: number): [number, number] {
  return [Math.floor(index / BOARD_SIZE), index % BOARD_SIZE]
}

function toIndex(row: number, col: number): number {
  return row * BOARD_SIZE + col
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE
}

export function createEmptyBoard(): Board {
  return Array(TOTAL_CELLS).fill(null)
}

export function checkWinner(board: Board): GameResult {
  for (let i = 0; i < TOTAL_CELLS; i++) {
    const stone = board[i]
    if (!stone) continue
    const [row, col] = toRowCol(i)

    for (const [dr, dc] of DIRECTIONS) {
      const line: number[] = [i]
      // 正方向延伸
      for (let k = 1; k < 5; k++) {
        const r = row + dr * k
        const c = col + dc * k
        if (!inBounds(r, c)) break
        const idx = toIndex(r, c)
        if (board[idx] !== stone) break
        line.push(idx)
      }
      // 反方向延伸
      for (let k = 1; k < 5; k++) {
        const r = row - dr * k
        const c = col - dc * k
        if (!inBounds(r, c)) break
        const idx = toIndex(r, c)
        if (board[idx] !== stone) break
        line.unshift(idx)
      }

      if (line.length >= 5) {
        return { winner: stone, line: line.slice(0, 5) }
      }
    }
  }
  return null
}

export function isBoardFull(board: Board): boolean {
  return board.every(cell => cell !== null)
}

export function isValidMove(board: Board, index: number): boolean {
  return index >= 0 && index < TOTAL_CELLS && board[index] === null
}

export function makeMove(board: Board, index: number, stone: Stone): Board {
  if (!isValidMove(board, index)) return board
  const newBoard = [...board]
  newBoard[index] = stone
  return newBoard
}

export function getGameStatus(board: Board): 'playing' | 'win' | 'draw' {
  if (checkWinner(board)) return 'win'
  if (isBoardFull(board)) return 'draw'
  return 'playing'
}