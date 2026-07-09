// Copyright 2026 Catsmum2025
// MIT License

import { Sun, Moon } from 'lucide-react'
import { useTheme } from './ThemeContext'

export function ThemeToggle(): React.ReactElement {
  const { mode, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      title={mode === 'dark' ? '切换浅色模式' : '切换深色模式'}
      className="fixed top-5 right-6 z-40 flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 hover:scale-110 active:scale-95"
      style={{
        background: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
        color: mode === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'
      }}
    >
      {mode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}