// Copyright 2026 Catsmum2025
// MIT License

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useNetwork } from '../hooks/useNetwork'
import { useTheme } from '../components/ThemeContext'
import { ArrowLeft, Users, Wifi, UserPlus, Clock, Swords, AlertTriangle, Check, X, Monitor, Globe, Copy, Link } from 'lucide-react'
import { GAME_NAMES } from '../game/config'
import type { PlayerInfo, GameRoom } from '../types'

interface IncomingInvite {
  from: string
  fromIp: string
  fromName: string
  gameType: string
  hostPort: number
}

export function Lobby(): React.ReactElement {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const gameType = searchParams.get('game') || 'tictactoe'
  const gameName = GAME_NAMES[gameType] || '井字棋'
  const { api, myInfo, onlinePlayers, setPlayerName, refreshPlayers } = useNetwork()
  const { bgGradient, bgOverlay, textPrimary, textSecondary, textMuted, borderColor, mode } = useTheme()
  const [nameInput, setNameInput] = useState(myInfo?.name || '')
  const [editing, setEditing] = useState(false)
  const [invitePending, setInvitePending] = useState<string | null>(null)
  const [inviteMessage, setInviteMessage] = useState<string | null>(null)
  const [incomingInvite, setIncomingInvite] = useState<IncomingInvite | null>(null)
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI

  // 远程联机状态
  const [remoteMode, setRemoteMode] = useState<'host' | 'guest' | null>(null)
  const [remoteIp, setRemoteIp] = useState('')
  const [myIp, setMyIp] = useState('')
  const [publicIp, setPublicIp] = useState<string | null>(null)
  const [punching, setPunching] = useState(false)
  const [punched, setPunched] = useState(false)
  const [remotePlayer, setRemotePlayer] = useState<PlayerInfo | null>(null)
  const [copied, setCopied] = useState(false)
  const [loadingPublicIp, setLoadingPublicIp] = useState(false)
  const [encryptedPublicIp, setEncryptedPublicIp] = useState<string | null>(null)

  useEffect(() => {
    if (myInfo) setNameInput(myInfo.name)
  }, [myInfo])

  // 监听收到邀请（作为被邀请方）
  useEffect(() => {
    const unsub = api.onInviteReceived((data) => {
      console.log('[Lobby] Invite received:', data)
      setIncomingInvite(data)
    })
    return () => unsub()
  }, [api])

  // 挂载时拉取所有待处理的邀请（解决不在大厅时错过邀请的问题）
  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.getPendingInvite().then((invites) => {
      if (invites && Array.isArray(invites) && invites.length > 0) {
        console.log('[Lobby] Pending invites found:', invites.length)
        const invite = invites[0]
        setIncomingInvite({
          from: invite.from,
          fromIp: invite.fromIp,
          fromName: invite.fromName,
          gameType: invite.gameType,
          hostPort: invite.hostPort
        })
      }
    })
    // 获取本机 IP
    window.electronAPI.getMyIp().then(setMyIp)
  }, [])

  // 进入主机模式时自动获取公网 IP
  useEffect(() => {
    if (remoteMode === 'host' && window.electronAPI) {
      setLoadingPublicIp(true)
      setPublicIp(null)
      setEncryptedPublicIp(null)
      window.electronAPI.getPublicIp().then(async (ip) => {
        setPublicIp(ip || null)
        if (ip) {
          const code = await window.electronAPI.encryptIp(ip)
          setEncryptedPublicIp(code || null)
        }
        setLoadingPublicIp(false)
      }).catch(() => {
        setPublicIp(null)
        setLoadingPublicIp(false)
      })
    }
  }, [remoteMode])

  // 离开大厅时自动断开远程连接
  useEffect(() => {
    return () => {
      if (window.electronAPI) {
        window.electronAPI.stopPunching().catch(() => {})
      }
    }
  }, [])

  // 监听远程玩家加入（作为主机时，对方打洞成功后出现在列表）
  useEffect(() => {
    const unsub = api.onRemotePlayerJoined((player) => {
      console.log('[Lobby] Remote player joined:', player)
      setRemotePlayer(player)
      setPunched(true)
      setInviteMessage(`${player.name} 已通过远程连接加入！`)
      setTimeout(() => setInviteMessage(null), 3000)
    })
    return () => unsub()
  }, [api])

  // 监听打洞成功（双向：主机和客机都会收到）
  useEffect(() => {
    const unsub = api.onPunchSuccess((data) => {
      console.log('[Lobby] Punch success:', data)
      setPunching(false)
      setPunched(true)
      setInviteMessage('打洞成功！双向通道已建立，可以在列表中看到对方')
      refreshPlayers()
    })
    return () => unsub()
  }, [api, refreshPlayers])

  // 监听邀请被接受（作为邀请方）
  useEffect(() => {
    const unsub = api.onInviteAccepted((data) => {
      if (data.gameType === gameType && data.room) {
        setInviteMessage('对方已接受邀请，正在进入游戏...')
        const room = data.room as GameRoom
        navigate(`/game/${gameType}/${room.roomId}`, {
          state: {
            room,
            myId: myInfo?.id,
            isHost: true,
            opponentId: room.guestId,
            opponentName: room.guestName,
            opponentIp: data.fromIp
          }
        })
      }
    })
    return () => unsub()
  }, [api, navigate, myInfo, gameType])

  // 监听邀请被拒绝
  useEffect(() => {
    const unsub = api.onInviteRejected((data) => {
      setInviteMessage(data.reason || '对方拒绝了邀请')
      setInvitePending(null)
      setTimeout(() => setInviteMessage(null), 3000)
    })
    return () => unsub()
  }, [api])

  const handleSaveName = useCallback(async () => {
    const trimmed = nameInput.trim()
    if (trimmed) {
      await setPlayerName(trimmed)
      setEditing(false)
    }
  }, [nameInput, setPlayerName])

  const handleInvite = useCallback(async (player: PlayerInfo) => {
    if (!window.electronAPI) {
      setInviteMessage('浏览器模式下无法发起邀请，请在 Electron 中运行')
      setTimeout(() => setInviteMessage(null), 3000)
      return
    }

    setInvitePending(player.id)
    setInviteMessage(null)

    try {
      await window.electronAPI.sendInvite(player.ip, player.id, gameType)
      setInviteMessage(`已向 ${player.name} 发送邀请，等待回应...`)
    } catch {
      setInviteMessage('发送邀请失败')
      setInvitePending(null)
      setTimeout(() => setInviteMessage(null), 3000)
    }
  }, [gameType])

  const handleAcceptInvite = useCallback(async () => {
    if (!incomingInvite || !window.electronAPI || !myInfo) return
    try {
      const room = await window.electronAPI.acceptInvite(
        incomingInvite.fromIp,           // targetIp: 邀请方的 IP
        incomingInvite.from,             // targetId: 邀请方的 player ID
        incomingInvite.from,             // hostId: 邀请方是 host
        incomingInvite.fromName,         // hostName: 邀请方名称
        myInfo.name,                     // guestName: 自己
        incomingInvite.gameType
      )
      // 连接到主机 TCP 服务器
      await window.electronAPI.connectToHost(incomingInvite.fromIp, incomingInvite.hostPort)
      setIncomingInvite(null)
      navigate(`/game/${incomingInvite.gameType}/${room.roomId}`, {
        state: {
          room,
          myId: myInfo.id,
          isHost: false,
          opponentId: room.hostId,
          opponentName: room.hostName,
          opponentIp: incomingInvite.fromIp
        }
      })
    } catch (err) {
      console.error('[Lobby] Accept invite failed:', err)
      setIncomingInvite(null)
    }
  }, [incomingInvite, myInfo, navigate])

  const handleRejectInvite = useCallback(async () => {
    if (!incomingInvite || !window.electronAPI) return
    try {
      await window.electronAPI.rejectInvite(incomingInvite.fromIp, incomingInvite.from, '对方拒绝了邀请')
    } catch {
      // ignore
    }
    setIncomingInvite(null)
  }, [incomingInvite])

  // 远程联机：开始打洞（客机模式）
  const handleStartPunching = useCallback(async () => {
    if (!window.electronAPI || !remoteIp.trim()) return
    setPunching(true)
    setInviteMessage(null)
    try {
      // 解密 IP 码 → 真实 IP
      const code = remoteIp.trim()
      const realIp = /^\d{1,10}$/.test(code) ? await window.electronAPI.decryptIp(code) : code
      if (!realIp) {
        setPunching(false)
        setInviteMessage('无效的联机码，请检查后重试')
        setTimeout(() => setInviteMessage(null), 3000)
        return
      }
      await window.electronAPI.startPunching(realIp, myInfo?.name || '远程玩家')
      setInviteMessage(`正在向对方打洞...`)
    } catch {
      setPunching(false)
      setInviteMessage('打洞失败，请检查联机码是否正确')
      setTimeout(() => setInviteMessage(null), 3000)
    }
  }, [remoteIp, myInfo])

  // 远程联机：停止打洞
  const handleStopPunching = useCallback(async () => {
    if (!window.electronAPI) return
    setPunching(false)
    setInviteMessage(null)
    try {
      await window.electronAPI.stopPunching()
    } catch {
      // ignore
    }
  }, [])

  // 复制联机码到剪贴板
  const handleCopyIp = useCallback(async () => {
    const text = encryptedPublicIp || myIp
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }, [encryptedPublicIp, myIp])

  // 远程联机：向远程玩家发起邀请
  const handleRemoteInvite = useCallback(async (player: PlayerInfo) => {
    if (!window.electronAPI) return
    setInvitePending(player.id)
    setInviteMessage(null)
    try {
      await window.electronAPI.sendRemoteInvite(player.ip, player.id, gameType)
      setInviteMessage(`已向 ${player.name} 发送邀请，等待回应...`)
    } catch {
      setInviteMessage('发送邀请失败')
      setInvitePending(null)
      setTimeout(() => setInviteMessage(null), 3000)
    }
  }, [gameType])

  return (
    <section className="relative w-full min-h-screen">
      {/* 背景 */}
      <div
        className="absolute inset-0"
        style={{ background: bgGradient }}
      />
      <div className="absolute inset-0" style={{ background: bgOverlay }} />

      <div className="relative z-10 flex flex-col h-full min-h-screen p-6 sm:p-8">
        {/* 顶部导航 */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate(`/games/${gameType}`)}
            className="flex items-center gap-2 transition-all duration-200 group"
            style={{ color: textSecondary }}
          >
            <ArrowLeft className="h-5 w-5 transition-transform duration-200 group-hover:-translate-x-1" />
            <span className="text-sm tracking-[-0.02em]">返回{gameName}</span>
          </button>

          <div className="flex items-center gap-4">
            {/* 网络状态 */}
            <div className="flex items-center gap-2 rounded-full px-3 py-1.5 backdrop-blur-sm" style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}>
              <Wifi className="h-3.5 w-3.5 text-[#F49D4D]" />
              <span className="text-xs tracking-[-0.02em]" style={{ color: textSecondary }}>
                {onlinePlayers.length} 人在线
              </span>
            </div>

            {/* 玩家名称 */}
            <div className="flex items-center gap-2">
              {editing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                    className="rounded-full px-3 py-1.5 text-sm tracking-[-0.02em] outline-none border w-32 focus:border-[#F49D4D]/50"
                    style={{
                      background: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                      color: textPrimary,
                      borderColor: borderColor
                    }}
                    maxLength={12}
                    autoFocus
                  />
                  <button
                    onClick={handleSaveName}
                    className="text-xs text-[#F49D4D] hover:text-[#F49D4D]/80 tracking-[-0.02em]"
                  >
                    保存
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm tracking-[-0.02em] transition-all"
                  style={{
                    background: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                    color: textSecondary
                  }}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {myInfo?.name || '未命名'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 连接状态提示 */}
        {!isElectron && (
          <div className="flex items-center gap-3 rounded-xl bg-[#F49D4D]/10 border border-[#F49D4D]/20 px-4 py-3 mb-4 backdrop-blur-sm">
            <AlertTriangle className="h-5 w-5 text-[#F49D4D] flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#F49D4D] tracking-[-0.02em]">
                浏览器模式 — 无法联机
              </p>
              <p className="text-xs text-[#F49D4D]/60 tracking-[-0.02em]">
                请在终端运行 <code className="bg-[#F49D4D]/10 px-1 rounded">npm run dev:main</code> 启动 Electron 窗口
              </p>
            </div>
          </div>
        )}

        {/* 本地测试按钮 */}
        <div className="flex items-center gap-3 rounded-xl bg-[#74754F]/10 border border-[#74754F]/20 px-4 py-3 mb-4 backdrop-blur-sm">
          <Monitor className="h-5 w-5 text-[#74754F] flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#74754F] tracking-[-0.02em]">
              单电脑测试模式
            </p>
            <p className="text-xs text-[#74754F]/60 tracking-[-0.02em]">
              无需两台电脑，在同一个窗口中切换主机/客机视角进行联机测试
            </p>
          </div>
          <button
            onClick={() => navigate(`/test/${gameType}`)}
            className="flex items-center gap-2 rounded-full bg-[#74754F] px-4 py-2 text-xs font-semibold tracking-[-0.02em] text-white shadow-lg shadow-[#74754F]/15 transition-all duration-300 hover:bg-[#74754F]/90 hover:shadow-xl active:scale-95 whitespace-nowrap"
          >
            <Monitor className="h-3.5 w-3.5" />
            开始测试
          </button>
        </div>

        {/* 远程联机 */}
        {isElectron && (
          <div className="rounded-2xl border px-5 py-4 mb-4 backdrop-blur-sm"
            style={{ background: mode === 'dark' ? 'rgba(116,117,79,0.08)' : 'rgba(116,117,79,0.06)', borderColor: 'rgba(116,117,79,0.2)' }}
          >
            <div className="flex items-center gap-3 mb-3">
              <Globe className="h-5 w-5 text-[#74754F] flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#74754F] tracking-[-0.02em]">
                  远程联机
                </p>
                <p className="text-xs text-[#74754F]/60 tracking-[-0.02em]">
                  UDP 打洞 P2P 直连 · 无需服务器
                </p>
              </div>
            </div>

            {!remoteMode ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setRemoteMode('host')}
                  className="flex-1 rounded-full bg-[#74754F]/15 border border-[#74754F]/30 px-3 py-2 text-xs font-semibold text-[#74754F] tracking-[-0.02em] transition-all hover:bg-[#74754F]/25 active:scale-95"
                >
                  我是主机
                </button>
                <button
                  onClick={() => setRemoteMode('guest')}
                  className="flex-1 rounded-full bg-[#74754F]/15 border border-[#74754F]/30 px-3 py-2 text-xs font-semibold text-[#74754F] tracking-[-0.02em] transition-all hover:bg-[#74754F]/25 active:scale-95"
                >
                  连接到远程
                </button>
              </div>
            ) : remoteMode === 'host' ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs tracking-[-0.02em]" style={{ color: textSecondary }}>联机码：</span>
                  {loadingPublicIp ? (
                    <span className="text-xs text-[#74754F]/60 tracking-[-0.02em] animate-pulse">获取中...</span>
                  ) : encryptedPublicIp ? (
                    <code className="text-sm font-mono font-bold tracking-[-0.02em] px-2 py-0.5 rounded" style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', color: textPrimary }}>
                      {encryptedPublicIp}
                    </code>
                  ) : publicIp ? (
                    <code className="text-sm font-mono font-bold tracking-[-0.02em] px-2 py-0.5 rounded" style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', color: textPrimary }}>
                      {publicIp}
                    </code>
                  ) : (
                    <span className="text-xs text-red-400 tracking-[-0.02em]">获取失败，请手动查询（百度搜"IP"）</span>
                  )}
                  {(encryptedPublicIp || publicIp) && (
                    <button
                      onClick={handleCopyIp}
                      className="flex items-center gap-1 text-xs text-[#74754F] tracking-[-0.02em] transition-all hover:text-[#74754F]/80"
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? '已复制' : '复制'}
                    </button>
                  )}
                </div>
                <p className="text-xs tracking-[-0.02em] mb-2" style={{ color: textMuted }}>
                  将此联机码发给对方，对方输入后点击连接即可打通
                </p>
                <div className="flex items-center gap-2">
                  {punched ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-[#4CAF50]" />
                      <span className="text-xs text-[#4CAF50] tracking-[-0.02em]">已连接</span>
                    </>
                  ) : (
                    <>
                      <span className="h-2 w-2 rounded-full bg-[#4CAF50] animate-pulse" />
                      <span className="text-xs text-[#4CAF50] tracking-[-0.02em]">等待连接中...</span>
                    </>
                  )}
                  <button
                    onClick={() => setRemoteMode(null)}
                    className="ml-auto text-xs text-[#74754F]/60 tracking-[-0.02em] hover:text-[#74754F]"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={remoteIp}
                    onChange={(e) => setRemoteIp(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="输入对方联机码"
                    className="flex-1 rounded-full px-3 py-1.5 text-sm tracking-[-0.02em] outline-none border"
                    style={{
                      background: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                      color: textPrimary,
                      borderColor: borderColor
                    }}
                    disabled={punching || punched}
                    onKeyDown={(e) => e.key === 'Enter' && handleStartPunching()}
                  />
                  {punching ? (
                    <button
                      onClick={handleStopPunching}
                      className="flex items-center gap-1.5 rounded-full bg-red-500/20 border border-red-500/30 px-4 py-1.5 text-xs font-semibold text-red-400 tracking-[-0.02em] transition-all hover:bg-red-500/30 active:scale-95"
                    >
                      <X className="h-3.5 w-3.5" />
                      停止
                    </button>
                  ) : punched ? (
                    <button
                      onClick={() => { setRemoteMode(null); setPunched(false); handleStopPunching() }}
                      className="flex items-center gap-1.5 rounded-full bg-[#4CAF50]/20 border border-[#4CAF50]/30 px-4 py-1.5 text-xs font-semibold text-[#4CAF50] tracking-[-0.02em]"
                    >
                      <Check className="h-3.5 w-3.5" />
                      已连接
                    </button>
                  ) : (
                    <button
                      onClick={handleStartPunching}
                      disabled={!remoteIp.trim()}
                      className="flex items-center gap-1.5 rounded-full bg-[#74754F] px-4 py-1.5 text-xs font-semibold text-white tracking-[-0.02em] shadow-lg shadow-[#74754F]/15 transition-all duration-300 hover:bg-[#74754F]/90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Link className="h-3.5 w-3.5" />
                      连接
                    </button>
                  )}
                </div>
                {punching && (
                  <p className="text-xs tracking-[-0.02em] animate-pulse" style={{ color: textSecondary }}>
                    正在打洞... 请确保对方也开启了远程联机的主机模式
                  </p>
                )}
                <button
                  onClick={() => { setRemoteMode(null); handleStopPunching() }}
                  className="text-xs text-[#74754F]/60 tracking-[-0.02em] hover:text-[#74754F] mt-1"
                >
                  取消
                </button>
              </div>
            )}
          </div>
        )}

        {/* 主内容 */}
        <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
          {/* 标题 */}
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-black tracking-[-0.04em] mb-3" style={{ color: textPrimary }}>
              {gameName} · 在线玩家
            </h2>
            <p className="text-sm tracking-[-0.02em]" style={{ color: textMuted }}>
              选择一名玩家发起{gameName}对局 · 同一局域网下自动发现
            </p>
          </div>

          {/* 邀请提示 */}
          {inviteMessage && (
            <div className="mb-4 w-full rounded-xl bg-[#F49D4D]/10 border border-[#F49D4D]/20 px-4 py-3 text-sm text-[#F49D4D]/90 tracking-[-0.02em] text-center backdrop-blur-sm">
              {inviteMessage}
            </div>
          )}

          {/* 收到的邀请弹窗 */}
          {incomingInvite && (
            <div className="mb-4 w-full rounded-2xl bg-[#F49D4D]/10 border-2 border-[#F49D4D]/40 px-6 py-5 backdrop-blur-sm animate-pulse">
              <p className="text-sm tracking-[-0.02em] mb-1" style={{ color: textSecondary }}>
                <span className="font-bold text-[#F49D4D]">{incomingInvite.fromName}</span> 邀请你进行一局
                <span className="font-bold" style={{ color: textPrimary }}> {GAME_NAMES[incomingInvite.gameType] || incomingInvite.gameType}</span>
              </p>
              <p className="text-xs tracking-[-0.02em] mb-4" style={{ color: textMuted }}>
                来自 {incomingInvite.fromIp}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleAcceptInvite}
                  className="flex items-center gap-2 rounded-full bg-[#4CAF50] px-5 py-2 text-sm font-semibold tracking-[-0.02em] text-white shadow-lg shadow-[#4CAF50]/20 transition-all duration-300 hover:bg-[#4CAF50]/90 hover:shadow-xl active:scale-95"
                >
                  <Check className="h-4 w-4" />
                  接受
                </button>
                <button
                  onClick={handleRejectInvite}
                  className="flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold tracking-[-0.02em] transition-all duration-300 active:scale-95"
                  style={{
                    background: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                    color: textSecondary
                  }}
                >
                  <X className="h-4 w-4" />
                  拒绝
                </button>
              </div>
            </div>
          )}

          {/* 玩家列表 */}
          <div className="w-full space-y-3 mb-8">
            {onlinePlayers.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
                  <Users className="h-8 w-8" style={{ color: textMuted }} />
                </div>
                <p className="text-sm tracking-[-0.02em]" style={{ color: textMuted }}>
                  暂无在线玩家
                </p>
                <p className="text-xs tracking-[-0.02em]" style={{ color: textMuted }}>
                  确保其他玩家也打开了本应用，并处于同一网络下
                </p>
              </div>
            ) : (
              onlinePlayers.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between rounded-2xl border px-5 py-4 backdrop-blur-sm transition-all duration-300"
                  style={{
                    background: mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    borderColor: borderColor
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F49D4D]/10 ring-1 ring-[#F49D4D]/20">
                      <span className="text-sm font-bold text-[#F49D4D] tracking-[-0.02em]">
                        {player.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold tracking-[-0.02em]" style={{ color: textPrimary }}>
                        {player.name}
                        {remotePlayer && player.id === remotePlayer.id && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-[#74754F]/15 border border-[#74754F]/30 px-1.5 py-0.5 text-[10px] font-semibold text-[#74754F] tracking-[-0.02em]">
                            <Globe className="h-2.5 w-2.5 mr-0.5" />
                            远程
                          </span>
                        )}
                      </p>
                      <p className="text-xs tracking-[-0.02em] flex items-center gap-1" style={{ color: textMuted }}>
                        <Clock className="h-3 w-3" />
                        {player.ip}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleInvite(player)}
                      disabled={invitePending === player.id}
                      className="flex items-center gap-2 rounded-full bg-[#F49D4D] px-4 py-2 text-xs font-semibold tracking-[-0.02em] text-[#2B312C] shadow-lg shadow-[#F49D4D]/15 transition-all duration-300 hover:bg-[#F49D4D]/90 hover:shadow-xl hover:shadow-[#F49D4D]/25 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Swords className="h-3.5 w-3.5" />
                      {invitePending === player.id ? '等待中...' : '发起对局'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}