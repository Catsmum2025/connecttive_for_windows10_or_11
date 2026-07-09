// Copyright 2026 Catsmum2025
// MIT License

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type ThemeMode = 'dark' | 'light'

interface ThemeContextValue {
  mode: ThemeMode
  toggleTheme: () => void
  bgGradient: string
  bgOverlay: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  borderColor: string
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const darkTheme: ThemeContextValue = {
  mode: 'dark',
  toggleTheme: () => {},
  bgGradient: 'linear-gradient(135deg, #1a1f1c 0%, #2B312C 50%, #1a1f1c 100%)',
  bgOverlay: 'rgba(0,0,0,0.3)',
  textPrimary: 'rgba(255,255,255,0.8)',
  textSecondary: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.2)',
  borderColor: 'rgba(255,255,255,0.06)'
}

const lightTheme: ThemeContextValue = {
  mode: 'light',
  toggleTheme: () => {},
  bgGradient: 'linear-gradient(135deg, #f5f0eb 0%, #e8e0d5 50%, #f5f0eb 100%)',
  bgOverlay: 'rgba(255,255,255,0.2)',
  textPrimary: 'rgba(0,0,0,0.75)',
  textSecondary: 'rgba(0,0,0,0.5)',
  textMuted: 'rgba(0,0,0,0.15)',
  borderColor: 'rgba(0,0,0,0.08)'
}

export function ThemeProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [mode, setMode] = useState<ThemeMode>('dark')

  const toggleTheme = useCallback(() => {
    setMode(prev => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  const theme = mode === 'dark' ? darkTheme : lightTheme

  const value: ThemeContextValue = {
    mode,
    toggleTheme,
    bgGradient: theme.bgGradient,
    bgOverlay: theme.bgOverlay,
    textPrimary: theme.textPrimary,
    textSecondary: theme.textSecondary,
    textMuted: theme.textMuted,
    borderColor: theme.borderColor
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}