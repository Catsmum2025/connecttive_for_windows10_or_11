// Copyright 2026 Catsmum2025
// MIT License

import { useState, useCallback } from 'react'
import { Navbar } from '../components/Navbar'
import { MobileMenu } from '../components/MobileMenu'
import { useTheme } from '../components/ThemeContext'
import { Gamepad2, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function LandPage(): React.ReactElement {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 })
  const navigate = useNavigate()
  const { bgGradient, bgOverlay, textPrimary, textSecondary, textMuted, borderColor, mode } = useTheme()

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height
    })
  }, [])

  return (
    <section
      className="relative w-full min-h-screen sm:h-screen overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      {/* ======== 背景层 ======== */}
      <div
        className="absolute inset-0"
        style={{ background: bgGradient }}
      />
      {/* 半透明叠加层 */}
      <div className="absolute inset-0" style={{ background: bgOverlay }} />

      {/* 鼠标跟随光效 */}
      <div
        className="absolute inset-0 pointer-events-none transition-[opacity] duration-700"
        style={{
          background: `radial-gradient(
            600px circle at ${mousePos.x * 100}% ${mousePos.y * 100}%,
            rgba(244, 157, 77, 0.06) 0%,
            rgba(48, 82, 78, 0.04) 30%,
            transparent 60%
          )`
        }}
      />

      {/* 装饰性光晕 */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#30524E]/20 blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-[#F49D4D]/8 blur-[100px]" />

      {/* 装饰网格 */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }}
      />

      {/* ======== 导航栏 ======== */}
      <Navbar onMobileMenuToggle={setIsMobileMenuOpen} isMobileMenuOpen={isMobileMenuOpen} />
      <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      {/* ======== 主内容 ======== */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 pt-20 pb-32 sm:pb-0">
        {/* 主标题区 */}
        <div className="text-center max-w-3xl mx-auto">
          {/* 小标签 */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 backdrop-blur-sm" style={{ borderColor, background: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}>
            <span className="h-2 w-2 rounded-full bg-[#F49D4D] animate-pulse" />
            <span className="text-xs font-medium tracking-[-0.01em]" style={{ color: textSecondary }}>
              LAN Multiplayer
            </span>
          </div>

          {/* 大标题 */}
          <h1 className="text-4xl font-black tracking-[-0.04em] sm:text-5xl md:text-6xl lg:text-7xl">
            <span style={{ color: textPrimary }}>棋逢对手</span>
            <br />
            <span
              className="bg-gradient-to-r from-[#F49D4D] via-[#F49D4D] to-[#74754F] bg-clip-text text-transparent"
            >
              联机对弈
            </span>
          </h1>

          {/* 副标题 */}
          <p className="mt-6 text-base sm:text-lg font-normal tracking-[-0.02em] max-w-xl mx-auto leading-relaxed" style={{ color: textSecondary }}>
            同一局域网下，与好友即时开局。支持五子棋、井字棋、国际象棋与中国象棋，还有更多像素小游戏即将上线。
          </p>
        </div>

        {/* ======== 底部左侧内容区块 ======== */}
        <div className="absolute bottom-8 left-8 z-20 sm:left-12 sm:bottom-12 mx-auto sm:mx-0 text-center sm:text-left">
          {/* 图标 + 标签 */}
          <div className="mb-4 flex items-center justify-center gap-3 sm:justify-start">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F49D4D]/15 ring-1 ring-[#F49D4D]/25">
              <Users className="h-5 w-5 text-[#F49D4D]" />
            </div>
            <span className="text-sm font-semibold tracking-[-0.02em]" style={{ color: textPrimary }}>
              本地联机 · 零延迟
            </span>
          </div>

          {/* 描述文字 */}
          <p className="mb-6 text-sm font-normal tracking-[-0.02em] leading-relaxed" style={{ color: textSecondary }}>
            无需服务器，无需注册。同一 WiFi 或交换机下自动发现对手，即刻开始对弈。
          </p>

          {/* 按钮组 */}
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center sm:justify-start sm:flex-nowrap">
            <button
              onClick={() => navigate('/games')}
              className="group flex items-center gap-2 rounded-full bg-[#F49D4D] px-6 py-2.5 text-sm font-semibold tracking-[-0.02em] text-[#2B312C] whitespace-nowrap shadow-lg shadow-[#F49D4D]/20 transition-all duration-300 hover:bg-[#F49D4D]/90 hover:shadow-xl hover:shadow-[#F49D4D]/30 active:scale-95"
            >
              <Gamepad2 className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
              开始游戏
            </button>
          </div>
        </div>

        {/* ======== 底部右侧区块 — 文字教程 (sm 以上显示) ======== */}
        <div className="absolute bottom-8 right-8 z-20 hidden sm:flex sm:bottom-12 sm:right-12 items-start gap-4 max-w-[240px]">
          <div className="text-right">
            <p className="text-sm font-semibold tracking-[-0.02em] mb-2" style={{ color: textPrimary }}>
              如何开始
            </p>
            <ol className="text-xs font-normal tracking-[-0.02em] space-y-1 leading-relaxed" style={{ color: textSecondary }}>
              <li>
                <span className="text-[#F49D4D]/80 font-medium">1.</span> 确保与好友在同一 WiFi 或交换机下
              </li>
              <li>
                <span className="text-[#F49D4D]/80 font-medium">2.</span> 进入大厅，查看在线玩家列表
              </li>
              <li>
                <span className="text-[#F49D4D]/80 font-medium">3.</span> 选择对手发起邀请，等待对方接受
              </li>
              <li>
                <span className="text-[#F49D4D]/80 font-medium">4.</span> 开始对弈！其他好友可进入观战
              </li>
            </ol>
          </div>
        </div>
      </div>
    </section>
  )
}