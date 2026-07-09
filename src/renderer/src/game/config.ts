// Copyright 2026 Catsmum2025
// MIT License

import { Grid3X3, Hash, Crown, Castle, CircleDot, Shield } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface GameTypeConfig {
  key: string
  name: string
  emoji: string
  description: string
  rules: string[]
  icon: LucideIcon
  available: boolean
}

export const GAME_TYPES: GameTypeConfig[] = [
  {
    key: 'tictactoe',
    name: '井字棋',
    emoji: '⭕',
    description: '经典三连棋，3×3 棋盘，简单但充满策略。先连成一线者获胜！',
    rules: [
      '3×3 的九宫格棋盘',
      '玩家轮流在空格中放置自己的棋子（X 或 O）',
      '先在横、竖、斜任意方向连成三子一线者获胜',
      '棋盘填满且无人获胜则为平局'
    ],
    icon: Grid3X3,
    available: true
  },
  {
    key: 'gomoku',
    name: '五子棋',
    emoji: '⚫',
    description: '19×19 棋盘，先连成五子者胜。深谋远虑，步步为营。',
    rules: [
      '19×19 的棋盘，黑棋先行',
      '玩家轮流在交叉点落子',
      '先在横、竖、斜任意方向连成五子者获胜',
      '无禁手规则，简单易上手'
    ],
    icon: Hash,
    available: true
  },
  {
    key: 'chess',
    name: '国际象棋',
    emoji: '♟️',
    description: '8×8 棋盘，六种棋子，各具独特走法。将死对手国王即获胜。',
    rules: [
      '8×8 棋盘，双方各有 16 枚棋子',
      '六种棋子：王、后、车、象、马、兵',
      '每种棋子有独特的移动规则',
      '将对方国王逼入绝境（将死）即获胜'
    ],
    icon: Crown,
    available: true
  },
  {
    key: 'chinesechess',
    name: '中国象棋',
    emoji: '🐉',
    description: '楚河汉界，9×10 棋盘。红黑双方各 16 枚棋子，将帅对决。',
    rules: [
      '9×10 的棋盘，中间有楚河汉界',
      '双方各有 16 枚棋子，七种兵种',
      '每种棋子有独特的走法和规则',
      '将死对方将/帅，或迫使对方无棋可走即获胜'
    ],
    icon: Castle,
    available: true
  },
  {
    key: 'go',
    name: '围棋',
    emoji: '⚪',
    description: '19×19 棋盘，黑白双方交替落子，围地多者胜。千年智慧，一局一世界。',
    rules: [
      '19×19 的棋盘，黑棋先行，白棋后行',
      '双方轮流在交叉点上落子，棋子下定后不可移动',
      '无气的棋子被提走（吃子）',
      '禁止全局同形（打劫规则）',
      '双方连续虚着（Pass）即终局',
      '中国规则数子法，黑贴 3又3/4 子'
    ],
    icon: CircleDot,
    available: true
  },
  {
    key: 'junqi',
    name: '军棋beta',
    emoji: '🔰',
    description: '经典暗棋对战，双方各有25枚棋子，布阵后通过铁路公路行军，夺旗或歼灭对方机动兵力者胜。',
    rules: [
      '棋盘12×5，含兵站、行营、大本营三种点位，中间以山界分隔',
      '铁路线不限步数直行，公路线每次一步；工兵可在铁路交叉点转弯',
      '行营内棋子不可被攻击，大本营内棋子永久锁定不可移动',
      '布阵阶段：行营不可放置，地雷限末两行，炸弹禁首行，军旗必入大本营',
      '双方各25枚棋子：军旗、司令、军长、师长×2、旅长×2、团长×2、营长×2、连长×3、排长×3、工兵×3、地雷×3、炸弹×2',
      '高级吃低级，同级同归于尽；炸弹与任何棋子同归于尽',
      '工兵可挖地雷，地雷反杀除工兵外的进攻棋子',
      '夺对方军旗，或杀光对方所有可移动棋子者获胜'
    ],
    icon: Shield,
    available: true
  }
]

export function getGameConfig(key: string): GameTypeConfig | undefined {
  return GAME_TYPES.find(g => g.key === key)
}

export const GAME_NAMES: Record<string, string> = {
  tictactoe: '井字棋',
  gomoku: '五子棋',
  chess: '国际象棋',
  chinesechess: '中国象棋',
  go: '围棋',
  junqi: '军棋'
}