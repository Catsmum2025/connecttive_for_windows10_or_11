// Copyright 2026 Catsmum2025
// MIT License

import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Swords, Monitor, CircleCheck } from 'lucide-react'
import { useTheme } from '../components/ThemeContext'
import { getGameConfig } from '../game/config'

export function GameIntro(): React.ReactElement {
  const { gameType } = useParams<{ gameType: string }>()
  const navigate = useNavigate()
  const { bgGradient, bgOverlay, textPrimary, textSecondary, textMuted, borderColor, mode } = useTheme()
  const game = getGameConfig(gameType || '')

  if (!game) {
    return (
      <section className="relative w-full min-h-screen overflow-hidden flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg" style={{ color: textMuted }}>游戏未找到</p>
          <button onClick={() => navigate('/games')} className="mt-4 text-[#F49D4D] text-sm">
            返回游戏列表
          </button>
        </div>
      </section>
    )
  }

  const Icon = game.icon

  return (
    <section className="relative w-full min-h-screen overflow-hidden">
      {/* 背景 */}
      <div
        className="absolute inset-0"
        style={{ background: bgGradient }}
      />
      <div className="absolute inset-0" style={{ background: bgOverlay }} />
      <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-[#F49D4D]/5 blur-[100px]" />

      <div className="relative z-10 flex flex-col min-h-screen p-6 sm:p-8">
        {/* 顶部导航 */}
        <div className="flex items-center justify-between mb-10">
          <button
            onClick={() => navigate('/games')}
            className="flex items-center gap-2 transition-all duration-200 group"
            style={{ color: textSecondary }}
          >
            <ArrowLeft className="h-5 w-5 transition-transform duration-200 group-hover:-translate-x-1" />
            <span className="text-sm tracking-[-0.02em]">返回选择</span>
          </button>
        </div>

        {/* 主内容 */}
        <div className="flex-1 flex flex-col items-center max-w-2xl mx-auto w-full">
          {/* 游戏图标和标题 */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#F49D4D]/10 ring-1 ring-[#F49D4D]/20">
                <Icon className="h-10 w-10 text-[#F49D4D]" />
              </div>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-[-0.04em] mb-3" style={{ color: textPrimary }}>
              {game.emoji} {game.name}
            </h2>
            <p className="text-sm tracking-[-0.02em] leading-relaxed max-w-md mx-auto" style={{ color: textMuted }}>
              {game.description}
            </p>
          </div>

          {/* 规则说明 */}
          <div className="w-full rounded-2xl border p-6 sm:p-8 mb-10 backdrop-blur-sm"
            style={{
              background: mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              borderColor
            }}
          >
            <h3 className="text-sm font-semibold tracking-[-0.02em] mb-5 uppercase" style={{ color: textSecondary }}>
              游戏规则
            </h3>
            <ul className="space-y-4">
              {game.rules.map((rule: string, i: number) => (
                <li key={i} className="flex items-start gap-3">
                  <CircleCheck className="h-5 w-5 text-[#74754F] mt-0.5 flex-shrink-0" />
                  <span className="text-sm tracking-[-0.02em] leading-relaxed" style={{ color: textSecondary }}>
                    {rule}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* 操作按钮 */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md mx-auto">
            <button
              onClick={() => navigate(`/lobby?game=${game.key}`)}
              className="group flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-[#F49D4D] px-8 py-3 text-sm font-semibold tracking-[-0.02em] text-[#2B312C] shadow-lg shadow-[#F49D4D]/20 transition-all duration-300 hover:bg-[#F49D4D]/90 hover:shadow-xl hover:shadow-[#F49D4D]/30 active:scale-95"
            >
              <Swords className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
              现在开始匹配{game.name}的对手
            </button>

            {game.available && game.key !== 'junqi' && (
              <button
                onClick={() => navigate(`/game/${game.key}/local`)}
                className="group flex w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-[#74754F]/30 bg-[#74754F]/10 px-8 py-3 text-sm font-semibold tracking-[-0.02em] text-[#74754F] shadow-lg shadow-[#74754F]/10 transition-all duration-300 hover:bg-[#74754F]/20 hover:border-[#74754F]/50 hover:shadow-xl hover:shadow-[#74754F]/20 active:scale-95"
              >
                <Monitor className="h-4 w-4" />
                本地双人
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}