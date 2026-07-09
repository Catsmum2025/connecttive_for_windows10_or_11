// Copyright 2026 Catsmum2025
// MIT License

import { HashRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './components/ThemeContext'
import { LandPage } from './pages/LandPage'
import { GamesPage } from './pages/GamesPage'
import { GameIntro } from './pages/GameIntro'
import { Lobby } from './pages/Lobby'
import { GameRoom } from './pages/GameRoom'
import { LocalTestPage } from './pages/LocalTestPage'

export default function App(): React.ReactElement {
  return (
    <ThemeProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<LandPage />} />
          <Route path="/games" element={<GamesPage />} />
          <Route path="/games/:gameType" element={<GameIntro />} />
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/game/:gameType/:roomId" element={<GameRoom />} />
          <Route path="/test/:gameType" element={<LocalTestPage />} />
        </Routes>
      </HashRouter>
    </ThemeProvider>
  )
}