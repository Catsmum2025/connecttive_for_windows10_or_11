// Copyright 2026 Catsmum2025
// MIT License

import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Clock, Wifi } from 'lucide-react'
import { useTheme } from '../components/ThemeContext'
import { GAME_TYPES, type GameTypeConfig } from '../game/config'

function GameCard({ game, onClick, textPrimary, textSecondary, textMuted, borderColor, mode }: { game: GameTypeConfig; onClick: () => void; textPrimary: string; textSecondary: string; textMuted: string; borderColor: string; mode: string }) {
  const Icon = game.icon
  return (
    <button
      onClick={onClick}
      disabled={!game.available}
      className={`group relative flex flex-col items-center gap-4 rounded-3xl border p-6 sm:p-8 text-center transition-all duration-300 ${
        game.available
          ? 'hover:border-[#F49D4D]/30 hover:shadow-xl hover:shadow-[#F49D4D]/5 active:scale-[0.98]'
          : 'opacity-40 cursor-not-allowed'
      }`}
      style={{
        borderColor: game.available ? borderColor : 'rgba(255,255,255,0.04)',
        background: game.available
          ? mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
          : mode === 'dark' ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)'
      }}
    >
      {/* 即将上线标签 */}
      {!game.available && (
        <div className="absolute -top-2.5 right-4 flex items-center gap-1.5 rounded-full bg-[#F49D4D]/15 border border-[#F49D4D]/20 px-3 py-1 backdrop-blur-sm">
          <Clock className="h-3 w-3 text-[#F49D4D]" />
          <span className="text-[10px] font-semibold text-[#F49D4D] tracking-[-0.02em]">即将上线</span>
        </div>
      )}

      {/* 仅支持联机标签 */}
      {game.key === 'junqi' && (
        <div className="absolute -top-2.5 left-4 flex items-center gap-1.5 rounded-lg bg-blue-500/15 border border-blue-500/20 px-3 py-1 backdrop-blur-sm">
          <Wifi className="h-3 w-3 text-blue-500" />
          <span className="text-[10px] font-semibold text-blue-500 tracking-[-0.02em]">仅支持联机</span>
        </div>
      )}

      <div className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300 ${
        game.available
          ? 'bg-[#F49D4D]/10 ring-1 ring-[#F49D4D]/20 group-hover:bg-[#F49D4D]/20 group-hover:scale-110'
          : 'ring-1'
      }`}
      style={!game.available ? { background: mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', borderColor: borderColor } : undefined}
      >
        <Icon className={`h-8 w-8 ${game.available ? 'text-[#F49D4D]' : ''}`} style={!game.available ? { color: textMuted } : undefined} />
      </div>

      <div>
        <h3 className="text-lg font-bold tracking-[-0.03em] mb-1.5" style={{ color: game.available ? textPrimary : textMuted }}>
          {game.emoji} {game.name}
        </h3>
        <p className="text-xs leading-relaxed tracking-[-0.02em] max-w-[240px]" style={{ color: textMuted }}>
          {game.description}
        </p>
      </div>

      {game.available && (
        <span className="flex items-center gap-1.5 text-xs font-semibold text-[#F49D4D] tracking-[-0.02em] opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
          查看详情
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      )}
    </button>
  )
}

export function GamesPage(): React.ReactElement {
  const navigate = useNavigate()
  const { bgGradient, bgOverlay, textPrimary, textSecondary, textMuted, borderColor, mode } = useTheme()

  return (
    <section className="relative w-full min-h-screen">
      {/* 背景 */}
      <div
        className="absolute inset-0"
        style={{ background: bgGradient }}
      />
      <div className="absolute inset-0" style={{ background: bgOverlay }} />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-[#30524E]/15 blur-[100px]" />

      <div className="relative z-10 flex flex-col min-h-screen p-6 sm:p-8 pb-16">
        {/* 顶部导航 */}
        <div className="flex items-center justify-between mb-10">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 transition-all duration-200 group"
            style={{ color: textSecondary }}
          >
            <ArrowLeft className="h-5 w-5 transition-transform duration-200 group-hover:-translate-x-1" />
            <span className="text-sm tracking-[-0.02em]">返回首页</span>
          </button>
        </div>

        {/* 主内容 */}
        <div className="flex-1 flex flex-col items-center max-w-4xl mx-auto w-full">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black tracking-[-0.04em] mb-3" style={{ color: textPrimary }}>
              选择游戏
            </h2>
            <p className="text-sm tracking-[-0.02em]" style={{ color: textMuted }}>
              选择一款游戏，了解规则后开始匹配对手
            </p>
          </div>

          {/* 游戏卡片网格 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 w-full">
            {GAME_TYPES.map((game: GameTypeConfig) => (
              <GameCard
                key={game.key}
                game={game}
                onClick={() => navigate(`/games/${game.key}`)}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                textMuted={textMuted}
                borderColor={borderColor}
                mode={mode}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}