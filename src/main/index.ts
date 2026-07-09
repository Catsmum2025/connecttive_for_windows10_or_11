// Copyright 2026 Catsmum2025
// MIT License

import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { networkManager, GameMessage } from './network'
import * as net from 'net'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null
let hostSocket: net.Socket | null = null
// 缓存待处理的邀请，以便渲染进程重新挂载时能拉取
// 使用数组支持多个待处理邀请，不清除直到接受/拒绝/超时
interface PendingInvite {
  from: string
  fromIp: string
  fromName: string
  gameType: string
  hostPort: number
  timestamp: number
}
const pendingInvites: PendingInvite[] = []
const INVITE_TIMEOUT = 60000 // 60秒超时

/** 安全地向渲染进程发送 IPC 消息，防止窗口已销毁时报错 */
function safeSend(channel: string, ...args: unknown[]): void {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args)
  }
}

function cleanExpiredInvites(): void {
  const now = Date.now()
  for (let i = pendingInvites.length - 1; i >= 0; i--) {
    if (now - pendingInvites[i].timestamp > INVITE_TIMEOUT) {
      pendingInvites.splice(i, 1)
    }
  }
}

function removeInvite(fromId: string): void {
  const idx = pendingInvites.findIndex(i => i.from === fromId)
  if (idx !== -1) pendingInvites.splice(idx, 1)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#2B312C',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function setupIPC(): void {
  // 设置玩家名称
  ipcMain.handle('set-player-name', (_event, name: string) => {
    networkManager.setMyName(name)
    return true
  })

  // 获取本机信息
  ipcMain.handle('get-my-info', () => {
    return networkManager.getMyInfo()
  })

  // 获取在线玩家列表
  ipcMain.handle('get-online-players', () => {
    return networkManager.getOnlinePlayersWithRooms()
  })

  // 获取当前房间
  ipcMain.handle('get-current-room', () => {
    return networkManager.getCurrentRoom()
  })

  // 获取 TCP 服务器端口
  ipcMain.handle('get-tcp-server-port', () => {
    return networkManager.getTCPServerPort()
  })

  // 发送邀请：通过 UDP 单播向目标玩家发送 INVITE
  ipcMain.handle('send-invite', (_event, targetIp: string, targetId: string, gameType: string) => {
    const myInfo = networkManager.getMyInfo()
    networkManager.sendUdpMessage(targetIp, {
      type: 'INVITE',
      from: myInfo.id,
      to: targetId,
      payload: {
        gameType,
        hostName: myInfo.name,
        hostPort: networkManager.getTCPServerPort()
      }
    })
    return true
  })

  // 接受邀请：发送 ACCEPT 并创建房间
  ipcMain.handle('accept-invite', (_event, targetIp: string, targetId: string, hostId: string, hostName: string, guestName: string, gameType: string) => {
    const myInfo = networkManager.getMyInfo()
    // 移除已处理的邀请
    removeInvite(hostId)
    // 创建房间（hostId=邀请方, hostName=邀请方名称, guestId=本机, guestName=本机名称）
    const room = networkManager.createRoom(hostId, hostName, myInfo.id, guestName, gameType)
    // 广播房间
    networkManager.broadcastRoom(room)
    // 发送 ACCEPT 给邀请方
    networkManager.sendUdpMessage(targetIp, {
      type: 'ACCEPT',
      from: myInfo.id,
      to: targetId,
      payload: {
        gameType,
        guestName: myInfo.name,
        room
      }
    })
    return room
  })

  // 拒绝邀请
  ipcMain.handle('reject-invite', (_event, targetIp: string, targetId: string, reason: string) => {
    const myInfo = networkManager.getMyInfo()
    // 移除已处理的邀请
    removeInvite(targetId)
    networkManager.sendUdpMessage(targetIp, {
      type: 'REJECT',
      from: myInfo.id,
      to: targetId,
      payload: { reason }
    })
    return true
  })

  // === 远程联机：UDP 打洞 ===

  // 获取本机 IP（供远程联机显示）
  ipcMain.handle('get-my-ip', () => {
    return networkManager.getMyInfo().ip
  })

  // 获取公网 IP（多路并行 HTTP + STUN 兜底）
  ipcMain.handle('get-public-ip', async () => {
    // 方式一：多个 HTTP 服务并行请求，哪个先成功用哪个
    const httpEndpoints = [
      {
        url: 'https://opendata.baidu.com/api.php?query=114.114.114.114&co=&resource_id=6006&oe=utf8',
        parser: (text: string): string => {
          // 百度返回 JSON，从 client_ip 字段提取
          try {
            const data = JSON.parse(text)
            if (data.data && data.data[0] && data.data[0].client_ip) {
              return data.data[0].client_ip
            }
          } catch { /* ignore */ }
          return ''
        }
      },
      {
        url: 'https://api.ip.sb/ip',
        parser: (text: string) => text.trim()
      },
      {
        url: 'https://ipv4.ip.sb/ip',
        parser: (text: string) => text.trim()
      },
      {
        url: 'https://checkip.amazonaws.com',
        parser: (text: string) => text.trim()
      },
      {
        url: 'https://icanhazip.com',
        parser: (text: string) => text.trim()
      },
      {
        url: 'https://api.ipify.org',
        parser: (text: string) => text.trim()
      },
    ]

    const httpResults = await Promise.allSettled(
      httpEndpoints.map(async (ep) => {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 3000)
        try {
          const res = await fetch(ep.url, { signal: controller.signal })
          const text = await res.text()
          return ep.parser(text)
        } finally {
          clearTimeout(timeout)
        }
      })
    )

    for (const result of httpResults) {
      if (result.status === 'fulfilled' && result.value) {
        const ip = result.value
        // 验证是不是合法 IPv4
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
          return ip
        }
      }
    }

    // 方式二：STUN 协议获取公网 IP（不依赖 HTTP）
    try {
      const dgram = await import('dgram')
      const stunIp = await new Promise<string>((resolve, reject) => {
        const socket = dgram.createSocket('udp4')
        const stunRequest = Buffer.from([
          0x00, 0x01, 0x00, 0x00, 0x21, 0x12, 0xa4, 0x42,
          ...Array(12).fill(0)
        ])
        const timer = setTimeout(() => { socket.close(); reject(new Error('timeout')) }, 3000)

        socket.on('message', (msg) => {
          clearTimeout(timer)
          socket.close()
          try {
            // STUN response: bytes 28-31 = mapped address (after XOR with magic cookie)
            const port = msg.readUInt16BE(26) ^ 0x2112
            const ip = `${msg[28] ^ 0x21}.${msg[29] ^ 0x12}.${msg[30] ^ 0xa4}.${msg[31] ^ 0x42}`
            resolve(ip)
          } catch {
            reject(new Error('parse error'))
          }
        })

        socket.on('error', () => { clearTimeout(timer); socket.close(); reject(new Error('error')) })
        socket.send(stunRequest, 3478, 'stun.l.google.com')
      })
      return stunIp
    } catch {
      return ''
    }
  })

  // 获取远程玩家列表
  ipcMain.handle('get-remote-players', () => {
    return networkManager.getRemotePlayers()
  })

  // 开始打洞：向目标 IP 发送 PUNCH 包
  ipcMain.handle('start-punching', (_event, targetIp: string, playerName: string) => {
    networkManager.startPunching(targetIp, playerName)
    return true
  })

  // 停止打洞
  ipcMain.handle('stop-punching', () => {
    networkManager.stopPunching()
    return true
  })

  // 向远程玩家发送邀请（通过 UDP 单播到已打洞的 IP）
  ipcMain.handle('send-remote-invite', (_event, targetIp: string, targetId: string, gameType: string) => {
    const myInfo = networkManager.getMyInfo()
    networkManager.sendUdpMessage(targetIp, {
      type: 'INVITE',
      from: myInfo.id,
      to: targetId,
      payload: {
        gameType,
        hostName: myInfo.name,
        hostPort: networkManager.getTCPServerPort()
      }
    })
    return true
  })

  // 客机连接到主机 TCP 服务器
  ipcMain.handle('connect-to-host', (_event, hostIp: string, hostPort: number) => {
    hostSocket = networkManager.connectToPlayer(hostIp, hostPort)
    return true
  })

  // 获取待处理的邀请（渲染进程挂载时拉取，不清除）
  ipcMain.handle('get-pending-invite', () => {
    cleanExpiredInvites()
    return [...pendingInvites]
  })

  // 发送游戏消息（主机 → 客机 或 客机 → 主机）
  ipcMain.handle('send-game-message', (_event, msg: GameMessage) => {
    if (msg.type === 'MOVE' || msg.type === 'GAME_OVER' || msg.type === 'SYNC_BOARD' ||
        msg.type === 'RESTART_REQUEST' || msg.type === 'RESTART_ACCEPT' || msg.type === 'RESTART_DECLINE') {
      if (hostSocket && !hostSocket.destroyed) {
        // 客机 → 主机：通过已建立的 TCP 连接发送
        networkManager.sendGameMessage(hostSocket, msg)
      }
      // 主机 → 客机：广播给所有 TCP 客户端
      networkManager.broadcastToSpectators(msg)
    }
    return true
  })

  // 通过 UDP 发送游戏消息（远程联机使用）
  ipcMain.handle('send-game-message-udp', (_event, targetIp: string, msg: GameMessage) => {
    networkManager.sendGameMessageUdp(targetIp, msg)
    return true
  })

  // 发送再来一局邀请（UDP + TCP 双重保险）
  ipcMain.handle('send-restart-invite', (_event, targetIp: string, targetId: string, gameType: string) => {
    const myInfo = networkManager.getMyInfo()
    // 发送 UDP INVITE（让对方即使离开了游戏页面也能看到邀请）
    networkManager.sendUdpMessage(targetIp, {
      type: 'INVITE',
      from: myInfo.id,
      to: targetId,
      payload: {
        gameType,
        hostName: myInfo.name,
        hostPort: networkManager.getTCPServerPort(),
        restart: true
      }
    })
    return true
  })

  // 玩家列表更新事件 → 转发给渲染进程
  networkManager.on('players-update', (players) => {
    safeSend('players-update', players)
  })

  // 房间更新事件
  networkManager.on('room-update', (room) => {
    safeSend('room-update', room)
  })

  // 游戏消息事件
  networkManager.on('game-message', (msg: GameMessage) => {
    safeSend('game-message', msg)
  })

  // 客户端断连事件
  networkManager.on('client-disconnected', (clientId: string) => {
    safeSend('client-disconnected', clientId)
  })

  // TCP 连接错误事件
  networkManager.on('connection-error', (data) => {
    safeSend('connection-error', data)
  })

  // TCP 连接关闭事件
  networkManager.on('connection-closed', (data) => {
    safeSend('connection-closed', data)
  })

  // 收到邀请事件
  networkManager.on('invite-received', (data) => {
    // 缓存邀请（不清除旧邀请，支持多个待处理邀请）
    cleanExpiredInvites()
    // 避免重复缓存同一发送方的邀请
    const existingIdx = pendingInvites.findIndex(i => i.from === data.from && i.gameType === data.gameType)
    if (existingIdx !== -1) {
      pendingInvites[existingIdx] = { ...data, timestamp: Date.now() }
    } else {
      pendingInvites.push({ ...data, timestamp: Date.now() })
    }
    console.log(`[IPC] Pending invites: ${pendingInvites.length}`)
    safeSend('invite-received', data)
  })

  // 邀请被接受事件
  networkManager.on('invite-accepted', (data) => {
    safeSend('invite-accepted', data)
  })

  // 邀请被拒绝事件
  networkManager.on('invite-rejected', (data) => {
    safeSend('invite-rejected', data)
  })

  // 远程玩家加入事件（打洞成功，对方出现在列表）
  networkManager.on('remote-player-joined', (player) => {
    safeSend('remote-player-joined', player)
  })

  // 打洞成功事件（本端发起打洞后收到 PONG）
  networkManager.on('punch-success', (data) => {
    safeSend('punch-success', data)
  })

  // IP 加密：IP 转纯数字码
  ipcMain.handle('encrypt-ip', (_event, ip: string) => {
    const parts = ip.split('.').map(Number)
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
      return ''
    }
    // IP → 32位整数 → XOR 混淆
    const num = ((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3]
    const key = 0x7A3F9C2E
    const encrypted = (num ^ key) >>> 0
    return String(encrypted)
  })

  // IP 解密：纯数字码转 IP
  ipcMain.handle('decrypt-ip', (_event, code: string) => {
    const num = parseInt(code, 10)
    if (isNaN(num) || num < 0 || num > 0xFFFFFFFF) {
      return ''
    }
    const key = 0x7A3F9C2E
    const decrypted = (num ^ key) >>> 0
    const a = (decrypted >>> 24) & 0xFF
    const b = (decrypted >>> 16) & 0xFF
    const c = (decrypted >>> 8) & 0xFF
    const d = decrypted & 0xFF
    return `${a}.${b}.${c}.${d}`
  })
}

app.whenReady().then(async () => {
  setupIPC()
  createWindow()

  // 启动网络服务
  networkManager.startDiscovery()
  const tcpPort = await networkManager.startTCPServer()
  console.log(`[ConnectTive] 本机IP: ${networkManager.getMyInfo().ip} | UDP组播: 224.0.0.114:9527 | TCP: ${tcpPort}`)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // 先销毁 hostSocket，防止 stop() 过程中触发 close 事件导致往已销毁窗口发 IPC
  if (hostSocket && !hostSocket.destroyed) {
    hostSocket.removeAllListeners()
    hostSocket.destroy()
    hostSocket = null
  }
  networkManager.stop()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})