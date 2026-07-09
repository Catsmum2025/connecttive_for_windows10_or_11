// Copyright 2026 Catsmum2025
// MIT License

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, X, Gamepad2, Sun, Moon } from 'lucide-react'
import { useTheme } from './ThemeContext'

interface NavbarProps {
  onMobileMenuToggle: (open: boolean) => void
  isMobileMenuOpen: boolean
}

export function Navbar({ onMobileMenuToggle, isMobileMenuOpen }: NavbarProps): React.ReactElement {
  const [scrolled, setScrolled] = useState(false)
  const navigate = useNavigate()
  const { textPrimary, textSecondary, mode, toggleTheme } = useTheme()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const toggleMenu = () => {
    onMobileMenuToggle(!isMobileMenuOpen)
  }

  const navLinks = [
    { label: '五子棋', href: '/games/gomoku' },
    { label: '井字棋', href: '/games/tictactoe' },
    { label: '国际象棋', href: '/games/chess' },
    { label: '中国象棋', href: '/games/chinesechess' },
    { label: '围棋', href: '/games/go' },
    { label: '军棋beta', href: '/games/junqi' }
  ]

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? mode === 'dark' ? 'bg-[#2B312C]/80 shadow-lg' : 'bg-white/80 shadow-lg'
          : 'bg-transparent'
      } backdrop-blur-xl`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
        {/* 左侧品牌 */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 group"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F49D4D]/20 ring-1 ring-[#F49D4D]/30 group-hover:bg-[#F49D4D]/30 transition-all duration-300">
            <Gamepad2 className="h-5 w-5 text-[#F49D4D]" />
          </div>
          <span className="text-lg font-bold tracking-[-0.03em]" style={{ color: textPrimary }}>
            ConnectTive
          </span>
        </button>

        {/* 桌面端导航链接 */}
        <div className="hidden items-center gap-8 lg:flex">
          {navLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => navigate(link.href)}
              className="text-sm font-medium tracking-[-0.02em] transition-all duration-200 hover:scale-105"
              style={{ color: textSecondary }}
            >
              {link.label}
            </button>
          ))}
          <button
            onClick={() => navigate('/games')}
            className="rounded-full bg-[#F49D4D] px-5 py-2 text-sm font-semibold tracking-[-0.02em] text-[#2B312C] transition-all duration-300 hover:bg-[#F49D4D]/90 hover:shadow-lg hover:shadow-[#F49D4D]/25 active:scale-95"
          >
            开始游戏
          </button>
        </div>

        {/* 右侧：主题切换 + 移动端汉堡 */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            title={mode === 'dark' ? '切换浅色模式' : '切换深色模式'}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300 hover:scale-110 active:scale-95"
            style={{
              background: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
              color: mode === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'
            }}
          >
            {mode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* 移动端汉堡按钮 */}
          <button
            onClick={toggleMenu}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 lg:hidden"
            style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', color: textPrimary }}
            aria-label={isMobileMenuOpen ? '关闭菜单' : '打开菜单'}
          >
            <div
              className={`transition-all duration-300 ${
                isMobileMenuOpen ? 'rotate-90 scale-110' : 'rotate-0 scale-100'
              }`}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </div>
          </button>
        </div>
      </div>
    </nav>
  )
}