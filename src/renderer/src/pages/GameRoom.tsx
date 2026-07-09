// Copyright 2026 Catsmum2025
// MIT License

import { useParams, useLocation } from 'react-router-dom'
import { TicTacToeBoard } from '../components/game/TicTacToeBoard'
import { GomokuBoard } from '../components/game/GomokuBoard'
import { ChessBoard } from '../components/game/ChessBoard'
import { ChineseChessBoard } from '../components/game/ChineseChessBoard'
import { GoBoard } from '../components/game/GoBoard'
import { JunqiBoard } from '../components/game/JunqiBoard'
import type { GameRoom as GameRoomType } from '../types'

interface RoomState {
  room: GameRoomType
  myId: string
  isHost: boolean
  opponentId: string
  opponentName: string
  opponentIp: string
}

export function GameRoom(): React.ReactElement {
  const { gameType } = useParams<{ gameType: string; roomId?: string }>()
  const location = useLocation()
  const state = location.state as RoomState | null

  const networkProps = state ? {
    room: state.room,
    myId: state.myId,
    isHost: state.isHost,
    opponentId: state.opponentId,
    opponentName: state.opponentName,
    opponentIp: state.opponentIp
  } : null

  switch (gameType) {
    case 'tictactoe':
      return <TicTacToeBoard network={networkProps} />
    case 'gomoku':
      return <GomokuBoard network={networkProps} />
    case 'chess':
      return <ChessBoard network={networkProps} />
    case 'chinesechess':
      return <ChineseChessBoard network={networkProps} />
    case 'go':
      return <GoBoard network={networkProps} />
    case 'junqi':
      return <JunqiBoard network={networkProps} />
    default:
      return <TicTacToeBoard network={networkProps} />
  }
}