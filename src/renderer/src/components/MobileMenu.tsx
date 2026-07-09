// Copyright 2026 Catsmum2025
// MIT License

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useTheme } from './ThemeContext'

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
}

const navLinks = [
  { label: '五子棋', href: '/games/gomoku' },
  { label: '井字棋', href: '/games/tictactoe' },
  { label: '国际象棋', href: '/games/chess' },
  { label: '中国象棋', href: '/games/chinesechess' },
  { label: '围棋', href: '/games/go' },
  { label: '军棋beta', href: '/games/junqi' }
]

export function MobileMenu({ isOpen, onClose }: MobileMenuProps): React.ReactElement {
  const navigate = useNavigate()
  const [visibleItems, setVisibleItems] = useState<number>(0)
  const { textPrimary, textSecondary, textMuted, mode } = useTheme()

  useEffect(() => {
    if (isOpen) {
      setVisibleItems(0)
      const timers = navLinks.map((_, i) =>
        setTimeout(() => setVisibleItems(i + 1), 100 + i * 80)
      )
      return () => timers.forEach(clearTimeout)
    } else {
      setVisibleItems(0)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleNavClick = (href: string) => {
    onClose()
    navigate(href)
  }

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-all duration-500 ease-in-out lg:hidden ${
          isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
      />

      <div
        className={`fixed top-0 right-0 z-50 h-full w-72 backdrop-blur-2xl shadow-2xl transition-all duration-400 ease-[cubic-bezier(0.4,0,0.2,1)] lg:hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ background: mode === 'dark' ? 'rgba(26,31,28,0.98)' : 'rgba(255,255,255,0.98)' }}
      >
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center justify-end">
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200"
              style={{
                background: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                color: textSecondary
              }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="mt-12 flex flex-col gap-4">
            {navLinks.map((link, index) => (
              <button
                key={link.label}
                onClick={() => handleNavClick(link.href)}
                className={`text-lg font-medium tracking-[-0.02em] transition-all duration-300 text-left ${
                  index < visibleItems
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 translate-x-4'
                }`}
                style={{ color: textPrimary }}
              >
                {link.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-4 pb-8">
            <button
              onClick={() => handleNavClick('/games')}
              className="w-full rounded-full bg-[#F49D4D] py-3 text-sm font-semibold tracking-[-0.02em] text-[#2B312C] transition-all duration-300 hover:bg-[#F49D4D]/90 hover:shadow-lg hover:shadow-[#F49D4D]/25 active:scale-95"
            >
              开始游戏
            </button>
          </div>
        </div>
      </div>
    </>
  )
}