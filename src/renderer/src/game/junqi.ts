// Copyright 2026 Catsmum2025
// MIT License

export const BOARD_ROWS = 12
export const BOARD_COLS = 5

// 列名：A=0, B=1, C=2, D=3, E=4
export const COL_NAMES = ['A', 'B', 'C', 'D', 'E'] as const

// 棋子类型
export type PieceType =
  | '司令' | '军长' | '师长' | '旅长' | '团长' | '营长' | '连长' | '排长'
  | '工兵' | '炸弹' | '地雷' | '军旗'

// 每方棋子数量
export const PIECE_COUNTS: Record<PieceType, number> = {
  '军旗': 1, '司令': 1, '军长': 1, '师长': 2, '旅长': 2,
  '团长': 2, '营长': 2, '连长': 3, '排长': 3, '工兵': 3,
  '地雷': 3, '炸弹': 2,
}

// 棋子等级：司令>军长>师长>旅长>团长>营长>连长>排长>工兵
const RANK_VALUES: Record<PieceType, number> = {
  '司令': 9, '军长': 8, '师长': 7, '旅长': 6,
  '团长': 5, '营长': 4, '连长': 3, '排长': 2,
  '工兵': 1, '炸弹': 0, '地雷': -1, '军旗': -2,
}

export type Player = 'red' | 'blue'

export interface Piece {
  type: PieceType
  player: Player
  id: string
}

// 格子类型：兵站、行营、大本营、空位(山界B/D列)
export type CellType = 'normal' | 'camp' | 'headquarters'

// board[row][col] = Piece | null
// B6(5,1), D6(5,3), B7(6,1), D7(6,3) 始终为 null（空位，不放置棋子）
export const NULL_CELLS = new Set(['5,1', '5,3', '6,1', '6,3'])

export function getCellType(row: number, col: number): CellType | null {
  if (NULL_CELLS.has(`${row},${col}`)) return null
  // 红方大本营：B1(0,1), D1(0,3)
  if ((row === 0 && col === 1) || (row === 0 && col === 3)) return 'headquarters'
  // 蓝方大本营：B12(11,1), D12(11,3)
  if ((row === 11 && col === 1) || (row === 11 && col === 3)) return 'headquarters'
  // 红方行营：B2(1,1), D2(1,3), C3(2,2), B4(3,1), D4(3,3)
  if ((row === 1 && col === 1) || (row === 1 && col === 3)) return 'camp'
  if (row === 2 && col === 2) return 'camp'
  if ((row === 3 && col === 1) || (row === 3 && col === 3)) return 'camp'
  // 蓝方行营：B9(8,1), D9(8,3), C10(9,2), B11(10,1), D11(10,3)
  if ((row === 8 && col === 1) || (row === 8 && col === 3)) return 'camp'
  if (row === 9 && col === 2) return 'camp'
  if ((row === 10 && col === 1) || (row === 10 && col === 3)) return 'camp'
  return 'normal'
}

// 铁路交叉点（工兵可以在此转弯）
const RAILWAY_INTERSECTIONS = new Set([
  '5,0', '5,2', '5,4',  // A6, C6, E6
  '6,0', '6,2', '6,4',  // A7, C7, E7
])

// 检查格子是否在铁路上（A/C/E 列，或第6-7行的A/C/E列）
export function isOnRailway(row: number, col: number): boolean {
  if (getCellType(row, col) === null) return false
  // A列(0), C列(2), E列(4) 整列都是铁路
  if (col === 0 || col === 2 || col === 4) return true
  return false
}

// 检查是否在铁路交叉点
function isRailwayIntersection(row: number, col: number): boolean {
  return RAILWAY_INTERSECTIONS.has(`${row},${col}`)
}

function isOnBoard(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS
}

function isValidCell(row: number, col: number): boolean {
  return isOnBoard(row, col) && getCellType(row, col) !== null
}

// ---- 移动逻辑 ----

/**
 * 公路移动：一步（上下左右），不能跨越空位
 */
function getRoadMoves(
  board: (Piece | null)[][],
  player: Player,
  row: number,
  col: number
): [number, number][] {
  const moves: [number, number][] = []
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]

  for (const [dr, dc] of directions) {
    const nr = row + dr
    const nc = col + dc
    if (!isValidCell(nr, nc)) continue
    const target = board[nr][nc]
    if (target && target.player === player) continue
    // 不能攻击行营中的棋子
    if (getCellType(nr, nc) === 'camp' && target) continue
    moves.push([nr, nc])
  }
  return moves
}

/**
 * 铁路直线移动（非工兵）：沿铁路线直走，不限步数，不能转弯
 * 铁路线在 A/C/E 列上纵向，在第6-7行横向
 */
function getRailwayStraightMoves(
  board: (Piece | null)[][],
  player: Player,
  row: number,
  col: number
): [number, number][] {
  const moves: [number, number][] = []
  // 纵向移动（A/C/E列）
  const vertDirs = [[-1, 0], [1, 0]]
  for (const [dr, dc] of vertDirs) {
    for (let dist = 1; dist < BOARD_ROWS; dist++) {
      const nr = row + dr * dist
      const nc = col + dc * dist
      if (!isValidCell(nr, nc)) break
      if (!isOnRailway(nr, nc)) break
      if (getCellType(nr, nc) === 'camp' && board[nr][nc]) break
      const target = board[nr][nc]
      if (target) {
        if (target.player !== player) {
          if (!(getCellType(nr, nc) === 'camp')) moves.push([nr, nc])
        }
        break
      }
      if (getCellType(nr, nc) !== 'camp') moves.push([nr, nc])
    }
  }
  // 横向移动（仅第6-7行，A/C/E列之间的铁路）
  if (row === 5 || row === 6) {
    const horzDirs = [[0, -2], [0, 2]] // A→C→E 间隔2列
    for (const [dr, dc] of horzDirs) {
      const nr = row
      const nc = col + dc
      if (!isValidCell(nr, nc)) continue
      if (!isOnRailway(nr, nc)) continue
      if (getCellType(nr, nc) === 'camp' && board[nr][nc]) continue
      const target = board[nr][nc]
      if (target) {
        if (target.player !== player) {
          if (!(getCellType(nr, nc) === 'camp')) moves.push([nr, nc])
        }
      } else {
        if (getCellType(nr, nc) !== 'camp') moves.push([nr, nc])
      }
    }
  }
  return moves
}

/**
 * 工兵铁路移动：可在铁路上行进，在交叉点转弯（A6/C6/E6/A7/C7/E7）
 * 使用 BFS 遍历铁路网络
 */
function getEngineerRailwayMoves(
  board: (Piece | null)[][],
  player: Player,
  startRow: number,
  startCol: number
): [number, number][] {
  const moves: [number, number][] = []
  const visited = new Set<string>()
  visited.add(`${startRow},${startCol}`)
  const queue: [number, number][] = [[startRow, startCol]]

  // 铁路上的邻居：纵向邻居（上下）+ 横向邻居（仅第6-7行，A/C/E列间）
  function getRailNeighbors(r: number, c: number): [number, number][] {
    const neighbors: [number, number][] = []
    // 纵向
    for (const [dr, dc] of [[-1, 0], [1, 0]]) {
      const nr = r + dr
      const nc = c + dc
      if (isValidCell(nr, nc) && isOnRailway(nr, nc)) {
        neighbors.push([nr, nc])
      }
    }
    // 横向（仅第6-7行）
    if (r === 5 || r === 6) {
      for (const dc of [-2, 2]) {
        const nc = c + dc
        if (isValidCell(r, nc) && isOnRailway(r, nc)) {
          neighbors.push([r, nc])
        }
      }
    }
    return neighbors
  }

  while (queue.length > 0) {
    const [r, c] = queue.shift()!
    for (const [nr, nc] of getRailNeighbors(r, c)) {
      const key = `${nr},${nc}`
      if (visited.has(key)) continue
      // 检查路径上是否有阻挡（中间格子）
      if (r === nr) {
        // 横向移动，检查中间格子
        const midCol = (c + nc) / 2
        if (midCol !== Math.floor(midCol)) continue
        const midKey = `${r},${midCol}`
        // 中间格子如果不存在或不在铁路上，跳过
        if (!isValidCell(r, midCol) || !isOnRailway(r, midCol)) continue
        if (board[r][midCol]) continue // 中间有棋子阻挡
      }
      if (getCellType(nr, nc) === 'camp' && board[nr][nc]) continue
      const target = board[nr][nc]
      if (target) {
        if (target.player !== player) {
          if (!(getCellType(nr, nc) === 'camp')) {
            visited.add(key)
            moves.push([nr, nc])
          }
        }
        continue
      }
      visited.add(key)
      if (getCellType(nr, nc) !== 'camp') {
        moves.push([nr, nc])
      }
      // 工兵只能在交叉点转弯
      if (isRailwayIntersection(r, c) || isRailwayIntersection(nr, nc)) {
        queue.push([nr, nc])
      } else if (r === nr) {
        // 横向移动且不在交叉点，继续横向
        queue.push([nr, nc])
      } else if (c === nc) {
        // 纵向移动且不在交叉点，继续纵向
        queue.push([nr, nc])
      }
    }
  }
  return moves
}

export function getValidMoves(
  board: (Piece | null)[][],
  row: number,
  col: number,
  player: Player
): [number, number][] {
  const piece = board[row][col]
  if (!piece) return []
  if (piece.player !== player) return []

  const cellType = getCellType(row, col)
  if (cellType === null) return []

  // 大本营中的棋子不能移动
  if (cellType === 'headquarters') return []

  // 地雷和军旗不能移动
  if (piece.type === '地雷' || piece.type === '军旗') return []

  // 行营中的棋子只能走公路一步
  if (cellType === 'camp') {
    return getRoadMoves(board, player, row, col)
  }

  let moves: [number, number][] = []

  if (isOnRailway(row, col)) {
    if (piece.type === '工兵') {
      moves = getEngineerRailwayMoves(board, player, row, col)
    } else {
      moves = getRailwayStraightMoves(board, player, row, col)
    }
  }

  // 公路移动（所有棋子都可以走一步离开当前位置）
  // 注意：铁路棋子也可以走公路一步
  moves = moves.concat(getRoadMoves(board, player, row, col))

  // 去重
  const unique = new Map<string, [number, number]>()
  for (const [r, c] of moves) {
    unique.set(`${r},${c}`, [r, c])
  }
  return [...unique.values()]
}

// ---- 战斗逻辑 ----

function resolveBattle(
  attacker: Piece,
  defender: Piece
): { winner: Piece | null; loser: Piece | null } {
  // 炸弹与任何棋子同归于尽
  if (attacker.type === '炸弹' || defender.type === '炸弹') {
    return { winner: null, loser: null }
  }
  // 工兵挖地雷
  if (attacker.type === '工兵' && defender.type === '地雷') {
    return { winner: attacker, loser: defender }
  }
  // 地雷杀除工兵外的所有进攻棋子
  if (defender.type === '地雷') {
    return { winner: defender, loser: attacker }
  }
  // 任何棋子都能吃军旗
  if (defender.type === '军旗') {
    return { winner: attacker, loser: defender }
  }
  // 等级比较
  const aRank = RANK_VALUES[attacker.type]
  const dRank = RANK_VALUES[defender.type]
  if (aRank > dRank) return { winner: attacker, loser: defender }
  if (aRank < dRank) return { winner: defender, loser: attacker }
  return { winner: null, loser: null }
}

function hasMovablePieces(board: (Piece | null)[][], player: Player): boolean {
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const piece = board[r][c]
      if (!piece || piece.player !== player) continue
      if (piece.type === '地雷' || piece.type === '军旗') continue
      const ct = getCellType(r, c)
      if (ct === 'headquarters' || ct === null) continue
      return true
    }
  }
  return false
}

// ---- 移动记录 ----

export interface JunqiMove {
  fromRow: number
  fromCol: number
  toRow: number
  toCol: number
  piece: PieceType
  player: Player
  captured?: PieceType
  battleResult?: 'win' | 'lose' | 'draw'
}

// ---- 游戏状态 ----

export interface JunqiGameState {
  board: (Piece | null)[][]
  currentTurn: Player
  gameOver: boolean
  winner: Player | null
  revealedPieces: Set<string> // 已暴露的棋子ID（对方可见）
  moveHistory: JunqiMove[]
  redCaptured: PieceType[]
  blueCaptured: PieceType[]
}

// ---- 布阵阶段状态 ----

export type DeploymentPhase = 'red_deploy' | 'blue_deploy' | 'playing'

export interface DeploymentState {
  board: (Piece | null)[][]
  phase: DeploymentPhase
  redConfirmed: boolean
  blueConfirmed: boolean
  // 剩余待放置棋子
  redRemaining: PieceType[]
  blueRemaining: PieceType[]
}

let pieceIdCounter = 0

function createPiece(type: PieceType, player: Player): Piece {
  return { type, player, id: `${player}-${type}-${pieceIdCounter++}` }
}

// 初始化空棋盘
export function createEmptyBoard(): (Piece | null)[][] {
  pieceIdCounter = 0
  return Array.from({ length: BOARD_ROWS }, (_, r) =>
    Array(BOARD_COLS).fill(null).map((_, c) =>
      getCellType(r, c) === null ? null : null
    )
  )
}

// 初始化布阵状态
export function createDeploymentState(): DeploymentState {
  return {
    board: createEmptyBoard(),
    phase: 'red_deploy',
    redConfirmed: false,
    blueConfirmed: false,
    redRemaining: [
      '军旗', '司令', '军长', '师长', '师长', '旅长', '旅长',
      '团长', '团长', '营长', '营长', '连长', '连长', '连长',
      '排长', '排长', '排长', '工兵', '工兵', '工兵',
      '地雷', '地雷', '地雷', '炸弹', '炸弹',
    ],
    blueRemaining: [
      '军旗', '司令', '军长', '师长', '师长', '旅长', '旅长',
      '团长', '团长', '营长', '营长', '连长', '连长', '连长',
      '排长', '排长', '排长', '工兵', '工兵', '工兵',
      '地雷', '地雷', '地雷', '炸弹', '炸弹',
    ],
  }
}

// 布阵合法性校验
export function canPlacePiece(
  deployState: DeploymentState,
  player: Player,
  pieceType: PieceType,
  row: number,
  col: number
): { valid: boolean; message: string } {
  if (getCellType(row, col) === null) return { valid: false, message: '此位置不存在' }
  const ct = getCellType(row, col)!

  // 检查是否在己方半区
  if (player === 'red') {
    if (row < 0 || row > 4) return { valid: false, message: '只能放置在己方半区（第1-5行）' }
  } else {
    if (row < 7 || row > 11) return { valid: false, message: '只能放置在己方半区（第8-12行）' }
  }

  // 行营不能放置棋子
  if (ct === 'camp') return { valid: false, message: '行营不能放置棋子（只能在行棋中进入）' }

  // 该位置已有棋子
  if (deployState.board[row][col]) return { valid: false, message: '此位置已有棋子' }

  // 军旗必须放在大本营
  if (pieceType === '军旗') {
    if (ct !== 'headquarters') return { valid: false, message: '军旗必须放在大本营' }
  }

  // 非军旗不能放在大本营（除非另一个大本营尚未放棋子）
  if (pieceType !== '军旗' && ct === 'headquarters') {
    // 检查另一个大本营是否已有棋子
    const hqRow = player === 'red' ? 0 : 11
    const hq1 = deployState.board[hqRow][1]
    const hq2 = deployState.board[hqRow][3]
    if (hq1 && hq2) return { valid: false, message: '两个大本营已满' }
    if (hq1 && hq1.type === '军旗' && hq2 && hq2.type === '军旗') {
      // 不应该出现
    }
  }

  // 地雷只能放在最后两行，且不能在大本营
  if (pieceType === '地雷') {
    if (ct === 'headquarters') return { valid: false, message: '地雷不能放在大本营' }
    if (player === 'red') {
      if (row !== 0 && row !== 1) return { valid: false, message: '地雷只能放在第1-2行' }
    } else {
      if (row !== 10 && row !== 11) return { valid: false, message: '地雷只能放在第11-12行' }
    }
  }

  // 炸弹不能放在第一行
  if (pieceType === '炸弹') {
    if (player === 'red' && row === 0) return { valid: false, message: '炸弹不能放在第一行' }
    if (player === 'blue' && row === 11) return { valid: false, message: '炸弹不能放在第一行' }
  }

  return { valid: true, message: '' }
}

// 放置棋子（布阵阶段）
export function placePiece(
  deployState: DeploymentState,
  player: Player,
  pieceType: PieceType,
  row: number,
  col: number
): { valid: boolean; newState?: DeploymentState; message: string } {
  const check = canPlacePiece(deployState, player, pieceType, row, col)
  if (!check.valid) return { valid: false, message: check.message }

  const remaining = player === 'red' ? [...deployState.redRemaining] : [...deployState.blueRemaining]
  const idx = remaining.indexOf(pieceType)
  if (idx === -1) return { valid: false, message: '没有可用的该类型棋子' }

  const newBoard = deployState.board.map(r => [...r])
  newBoard[row][col] = createPiece(pieceType, player)
  remaining.splice(idx, 1)

  const newState: DeploymentState = {
    ...deployState,
    board: newBoard,
    redRemaining: player === 'red' ? remaining : deployState.redRemaining,
    blueRemaining: player === 'blue' ? remaining : deployState.blueRemaining,
  }

  return { valid: true, newState, message: '' }
}

// 移除棋子（布阵阶段，仅未确认时可用）
export function removePiece(
  deployState: DeploymentState,
  player: Player,
  row: number,
  col: number
): { valid: boolean; newState?: DeploymentState; message: string } {
  const piece = deployState.board[row][col]
  if (!piece) return { valid: false, message: '此位置没有棋子' }
  if (piece.player !== player) return { valid: false, message: '不是你的棋子' }

  // 确认后不能移除
  if (player === 'red' && deployState.redConfirmed) return { valid: false, message: '已确认布阵，不能修改' }
  if (player === 'blue' && deployState.blueConfirmed) return { valid: false, message: '已确认布阵，不能修改' }

  const newBoard = deployState.board.map(r => [...r])
  newBoard[row][col] = null

  const remaining = player === 'red' ? [...deployState.redRemaining, piece.type] : [...deployState.blueRemaining, piece.type]

  const newState: DeploymentState = {
    ...deployState,
    board: newBoard,
    redRemaining: player === 'red' ? remaining : deployState.redRemaining,
    blueRemaining: player === 'blue' ? remaining : deployState.blueRemaining,
  }

  return { valid: true, newState, message: '' }
}

// 确认布阵
export function confirmDeployment(
  deployState: DeploymentState,
  player: Player
): { valid: boolean; newState?: DeploymentState; message: string } {
  const remaining = player === 'red' ? deployState.redRemaining : deployState.blueRemaining
  if (remaining.length > 0) return { valid: false, message: `还有 ${remaining.length} 枚棋子未放置` }

  // 检查军旗是否在大本营
  const hqRow = player === 'red' ? 0 : 11
  const hq1 = deployState.board[hqRow][1]
  const hq2 = deployState.board[hqRow][3]
  if (!hq1 || !hq2) return { valid: false, message: '两个大本营都必须放置棋子' }
  const hasFlag = (hq1.type === '军旗') || (hq2.type === '军旗')
  if (!hasFlag) return { valid: false, message: '军旗必须放在大本营中' }

  const newState: DeploymentState = {
    ...deployState,
    redConfirmed: player === 'red' ? true : deployState.redConfirmed,
    blueConfirmed: player === 'blue' ? true : deployState.blueConfirmed,
    phase: (player === 'red' && deployState.blueConfirmed) || (player === 'blue' && deployState.redConfirmed)
      ? 'playing' : deployState.phase,
  }
  return { valid: true, newState, message: '' }
}

// 从布阵状态创建游戏状态
export function createGameStateFromDeployment(deployState: DeploymentState): JunqiGameState {
  return {
    board: deployState.board.map(r => [...r]),
    currentTurn: 'red', // 红方先行
    gameOver: false,
    winner: null,
    revealedPieces: new Set(),
    moveHistory: [],
    redCaptured: [],
    blueCaptured: [],
  }
}

// ---- 行棋 ----

export function makeMove(
  state: JunqiGameState,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): { valid: boolean; newState?: JunqiGameState; message: string } {
  if (state.gameOver) return { valid: false, message: '游戏已结束' }

  const piece = state.board[fromRow]?.[fromCol]
  if (!piece) return { valid: false, message: '没有棋子' }
  if (piece.player !== state.currentTurn) return { valid: false, message: '不是你的回合' }

  const validMoves = getValidMoves(state.board, fromRow, fromCol, state.currentTurn)
  if (!validMoves.some(([r, c]) => r === toRow && c === toCol)) {
    return { valid: false, message: '无效移动' }
  }

  const newBoard = state.board.map(row => [...row])
  const target = newBoard[toRow][toCol]
  const newRevealed = new Set(state.revealedPieces)
  const newRedCaptured = [...state.redCaptured]
  const newBlueCaptured = [...state.blueCaptured]

  let battleResult: 'win' | 'lose' | 'draw' | undefined
  let capturedType: PieceType | undefined
  let gameOver = false
  let winner: Player | null = null

  if (target && target.player !== piece.player) {
    const { winner: bWinner, loser: bLoser } = resolveBattle(piece, target)
    newRevealed.add(piece.id)
    newRevealed.add(target.id)

    if (bWinner === null && bLoser === null) {
      newBoard[fromRow][fromCol] = null
      newBoard[toRow][toCol] = null
      battleResult = 'draw'
      capturedType = target.type
      if (target.player === 'red') newRedCaptured.push(target.type)
      else newBlueCaptured.push(target.type)
      if (piece.player === 'red') newRedCaptured.push(piece.type)
      else newBlueCaptured.push(piece.type)
    } else if (bWinner === piece) {
      newBoard[fromRow][fromCol] = null
      newBoard[toRow][toCol] = piece
      battleResult = 'win'
      capturedType = target.type
      if (target.player === 'red') newRedCaptured.push(target.type)
      else newBlueCaptured.push(target.type)
      if (target.type === '军旗') {
        gameOver = true
        winner = piece.player
      }
    } else {
      newBoard[fromRow][fromCol] = null
      battleResult = 'lose'
      capturedType = piece.type
      if (piece.player === 'red') newRedCaptured.push(piece.type)
      else newBlueCaptured.push(piece.type)
    }
  } else {
    newBoard[fromRow][fromCol] = null
    newBoard[toRow][toCol] = piece
  }

  if (!gameOver) {
    const opponent: Player = state.currentTurn === 'red' ? 'blue' : 'red'
    if (!hasMovablePieces(newBoard, opponent)) {
      gameOver = true
      winner = state.currentTurn
    }
  }

  const move: JunqiMove = {
    fromRow, fromCol, toRow, toCol,
    piece: piece.type,
    player: piece.player,
    captured: capturedType,
    battleResult,
  }

  const nextTurn: Player = gameOver ? state.currentTurn : (state.currentTurn === 'red' ? 'blue' : 'red')

  return {
    valid: true,
    newState: {
      ...state,
      board: newBoard,
      currentTurn: nextTurn,
      gameOver,
      winner,
      revealedPieces: newRevealed,
      moveHistory: [...state.moveHistory, move],
      redCaptured: newRedCaptured,
      blueCaptured: newBlueCaptured,
    },
    message: '',
  }
}

export function getGameStatus(state: JunqiGameState): 'playing' | 'win' | 'draw' {
  return state.gameOver ? 'win' : 'playing'
}

/** 检查某棋子是否对指定玩家可见 */
export function isPieceVisible(
  state: JunqiGameState,
  piece: Piece,
  viewer: Player
): boolean {
  if (piece.player === viewer) return true
  return state.revealedPieces.has(piece.id)
}