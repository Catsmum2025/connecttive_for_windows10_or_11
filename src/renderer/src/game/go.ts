// Copyright 2026 Catsmum2025
// MIT License

export const BOARD_SIZE = 19

export type Stone = 'black' | 'white'
export type Cell = Stone | null
export type Board = Cell[][]
export type GameResult = Stone | 'draw' | null

export interface GoMove {
  row: number
  col: number
  stone: Stone
  captured: number
}

export interface GoGameState {
  board: Board
  currentTurn: Stone
  capturedByBlack: number
  capturedByWhite: number
  passes: number
  gameOver: boolean
  winner: GameResult
  blackScore: number
  whiteScore: number
  lastMove: GoMove | null
  koPoint: [number, number] | null
  moveHistory: GoMove[]
}

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null))
}

export function createInitialState(): GoGameState {
  return {
    board: createEmptyBoard(),
    currentTurn: 'black',
    capturedByBlack: 0,
    capturedByWhite: 0,
    passes: 0,
    gameOver: false,
    winner: null,
    blackScore: 0,
    whiteScore: 0,
    lastMove: null,
    koPoint: null,
    moveHistory: []
  }
}

/** 获取某个位置的邻居坐标 */
function getNeighbors(row: number, col: number): [number, number][] {
  const neighbors: [number, number][] = []
  if (row > 0) neighbors.push([row - 1, col])
  if (row < BOARD_SIZE - 1) neighbors.push([row + 1, col])
  if (col > 0) neighbors.push([row, col - 1])
  if (col < BOARD_SIZE - 1) neighbors.push([row, col + 1])
  return neighbors
}

/** BFS 找到某个棋子所在的连通块 */
function findGroup(board: Board, row: number, col: number): [number, number][] {
  const stone = board[row][col]
  if (!stone) return []
  const group: [number, number][] = []
  const visited = new Set<string>()
  const queue: [number, number][] = [[row, col]]
  visited.add(`${row},${col}`)

  while (queue.length > 0) {
    const [r, c] = queue.shift()!
    group.push([r, c])
    for (const [nr, nc] of getNeighbors(r, c)) {
      const key = `${nr},${nc}`
      if (!visited.has(key) && board[nr][nc] === stone) {
        visited.add(key)
        queue.push([nr, nc])
      }
    }
  }
  return group
}

/** 计算一个连通块的气数 */
function countLiberties(board: Board, group: [number, number][]): number {
  const liberties = new Set<string>()
  for (const [r, c] of group) {
    for (const [nr, nc] of getNeighbors(r, c)) {
      if (board[nr][nc] === null) {
        liberties.add(`${nr},${nc}`)
      }
    }
  }
  return liberties.size
}

/** 下子后，检查并移除对方的无气之块。返回被提的子数 */
function captureStones(board: Board, opponent: Stone): number {
  let totalCaptured = 0
  const checked = new Set<string>()

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === opponent && !checked.has(`${r},${c}`)) {
        const group = findGroup(board, r, c)
        group.forEach(([gr, gc]) => checked.add(`${gr},${gc}`))
        if (countLiberties(board, group) === 0) {
          group.forEach(([gr, gc]) => {
            board[gr][gc] = null
            totalCaptured++
          })
        }
      }
    }
  }
  return totalCaptured
}

/** 检查是否是打劫（Ko） */
function isKo(
  board: Board,
  row: number,
  col: number,
  stone: Stone,
  prevBoard: Board,
  captured: number
): boolean {
  if (captured !== 1) return false
  // 检查是否和上一步棋盘状态完全相同
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== prevBoard[r][c]) return false
    }
  }
  return true
}

/** 深拷贝棋盘 */
function cloneBoard(board: Board): Board {
  return board.map(row => [...row])
}

/** 执行落子，返回 { valid, captured, koViolation } */
export function makeMove(
  state: GoGameState,
  row: number,
  col: number
): { valid: boolean; newState: GoGameState | null; message: string } {
  if (state.gameOver) {
    return { valid: false, newState: null, message: '游戏已结束' }
  }
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
    return { valid: false, newState: null, message: '无效位置' }
  }
  if (state.board[row][col] !== null) {
    return { valid: false, newState: null, message: '此处已有棋子' }
  }
  // 打劫检查
  if (state.koPoint && state.koPoint[0] === row && state.koPoint[1] === col) {
    return { valid: false, newState: null, message: '打劫，需先在其他地方落子' }
  }

  const newBoard = cloneBoard(state.board)
  const stone = state.currentTurn
  const opponent: Stone = stone === 'black' ? 'white' : 'black'

  // 尝试落子
  newBoard[row][col] = stone

  // 先提对方子
  const captured = captureStones(newBoard, opponent)

  // 检查自己是否无气（自杀）
  const myGroup = findGroup(newBoard, row, col)
  if (countLiberties(newBoard, myGroup) === 0) {
    return { valid: false, newState: null, message: '禁着点（自杀）' }
  }

  // 打劫检查
  const prevBoard = state.moveHistory.length > 0
    ? state.moveHistory[state.moveHistory.length - 1].boardAfter || state.board
    : state.board
  let koPoint: [number, number] | null = null
  if (isKo(newBoard, row, col, stone, prevBoard, captured)) {
    koPoint = [row, col] // 对方不能立即回提
  }

  const move: GoMove = {
    row,
    col,
    stone,
    captured,
    boardAfter: newBoard
  }

  const newState: GoGameState = {
    ...state,
    board: newBoard,
    currentTurn: opponent,
    capturedByBlack: stone === 'black' ? state.capturedByBlack + captured : state.capturedByBlack,
    capturedByWhite: stone === 'white' ? state.capturedByWhite + captured : state.capturedByWhite,
    passes: 0,
    lastMove: move,
    koPoint,
    moveHistory: [...state.moveHistory, move]
  }

  return { valid: true, newState, message: '' }
}

/** 虚着（Pass） */
export function pass(state: GoGameState): { newState: GoGameState; gameOver: boolean } {
  const newPasses = state.passes + 1
  const gameOver = newPasses >= 2

  const newState: GoGameState = {
    ...state,
    currentTurn: state.currentTurn === 'black' ? 'white' : 'black',
    passes: newPasses,
    gameOver,
    koPoint: null,
    lastMove: null
  }

  if (gameOver) {
    const { blackScore, whiteScore, winner } = calculateScore(newState.board, newState.capturedByBlack, newState.capturedByWhite)
    newState.blackScore = blackScore
    newState.whiteScore = whiteScore
    newState.winner = winner
  }

  return { newState, gameOver }
}

/** 中国规则数子法计分 */
export function calculateScore(
  board: Board,
  capturedByBlack: number,
  capturedByWhite: number
): { blackScore: number; whiteScore: number; winner: GameResult } {
  // 标记每个交叉点的归属
  const territory: (Stone | 'neutral' | null)[][] = new Array(BOARD_SIZE).fill(null).map(() => new Array(BOARD_SIZE).fill(null))

  // 先标记有棋子的点
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c]) {
        territory[r][c] = board[r][c]
      }
    }
  }

  // BFS 填充空地：判断每个空地属于哪个颜色
  const visited = new Set<string>()
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === null && !visited.has(`${r},${c}`)) {
        const region: [number, number][] = []
        const borders = new Set<Stone>()
        const queue: [number, number][] = [[r, c]]
        visited.add(`${r},${c}`)

        while (queue.length > 0) {
          const [cr, cc] = queue.shift()!
          region.push([cr, cc])
          for (const [nr, nc] of getNeighbors(cr, cc)) {
            const key = `${nr},${nc}`
            if (board[nr][nc]) {
              borders.add(board[nr][nc]!)
            } else if (!visited.has(key)) {
              visited.add(key)
              queue.push([nr, nc])
            }
          }
        }

        const owner: Stone | 'neutral' =
          borders.size === 1 ? (borders.has('black') ? 'black' : 'white') : 'neutral'

        region.forEach(([rr, rc]) => {
          territory[rr][rc] = owner
        })
      }
    }
  }

  // 数子
  let blackCount = 0
  let whiteCount = 0

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (territory[r][c] === 'black') blackCount++
      else if (territory[r][c] === 'white') whiteCount++
      else if (territory[r][c] === 'neutral') {
        // 中立点各得一半
        blackCount += 0.5
        whiteCount += 0.5
      }
    }
  }

  // 中国规则：黑贴 3又3/4 子 (7.5 目)
  const komi = 7.5
  const blackScore = blackCount
  const whiteScore = whiteCount + komi

  let winner: GameResult = null
  if (blackScore > whiteScore) winner = 'black'
  else if (whiteScore > blackScore) winner = 'white'
  else winner = 'draw'

  // 返回目数差（便于显示）
  return {
    blackScore: Math.round(blackScore * 10) / 10,
    whiteScore: Math.round(whiteScore * 10) / 10,
    winner
  }
}

/** 获取游戏状态文本 */
export function getGameStatus(state: GoGameState): 'playing' | 'win' | 'draw' {
  if (!state.gameOver) return 'playing'
  if (state.winner === 'draw') return 'draw'
  return 'win'
}

// 扩展 GoMove 类型以支持 boardAfter
declare module './go' {
  interface GoMove {
    boardAfter?: Board
  }
}