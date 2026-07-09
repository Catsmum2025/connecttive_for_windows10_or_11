// Copyright 2026 Catsmum2025
// MIT License

export type Player = 'X' | 'O'
export type CellValue = Player | null
export type Board = CellValue[]

export type GameResult = {
  winner: Player | null
  line: number[] | null
} | null

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6]              // diagonals
]

export function createEmptyBoard(): Board {
  return Array(9).fill(null)
}

export function checkWinner(board: Board): GameResult {
  for (const line of WIN_LINES) {
    const [a, b, c] = line
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a] as Player, line }
    }
  }
  return null
}

export function isBoardFull(board: Board): boolean {
  return board.every(cell => cell !== null)
}

export function isValidMove(board: Board, index: number): boolean {
  return index >= 0 && index < 9 && board[index] === null
}

export function makeMove(board: Board, index: number, player: Player): Board {
  if (!isValidMove(board, index)) return board
  const newBoard = [...board]
  newBoard[index] = player
  return newBoard
}

export function getGameStatus(board: Board): 'playing' | 'win' | 'draw' {
  if (checkWinner(board)) return 'win'
  if (isBoardFull(board)) return 'draw'
  return 'playing'
}