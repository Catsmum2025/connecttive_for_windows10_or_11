// Copyright 2026 Catsmum2025
// MIT License

import * as dgram from 'dgram'
import * as net from 'net'
import * as os from 'os'
import { EventEmitter } from 'events'

const DISCOVERY_PORT = 9527
const DISCOVERY_MULTICAST = '224.0.0.114'
const MSG_DELIMITER = '\n'

export interface PlayerInfo {
  id: string
  name: string
  ip: string
  lastSeen: number
}

export interface GameRoom {
  roomId: string
  hostId: string
  guestId: string
  hostName: string
  guestName: string
  hostPort: number
  spectators: string[]
  gameType: string
}

export interface GameMessage {
  type: 'INVITE' | 'ACCEPT' | 'REJECT' | 'MOVE' | 'GAME_OVER' | 'SYNC_BOARD' | 'SPECTATE_JOIN' | 'SPECTATE_LEAVE' | 'ROOM_INFO' | 'RESTART_REQUEST' | 'RESTART_ACCEPT' | 'RESTART_DECLINE' | 'PUNCH' | 'PONG' | 'REMOTE_HELLO'
  from: string
  to?: string
  payload: Record<string, unknown>
}

class NetworkManager extends EventEmitter {
  private udpSocket: dgram.Socket | null = null
  private tcpServer: net.Server | null = null
  private tcpClients: Map<string, net.Socket> = new Map()
  private tcpServerPort: number = 0
  private myInfo: PlayerInfo
  private onlinePlayers: Map<string, PlayerInfo> = new Map()
  private discoveryTimer: NodeJS.Timeout | null = null
  private currentRoom: GameRoom | null = null
  /** 已知的对等节点 IP，用于周期性单播 HELLO（解决组播/广播不对称问题） */
  private knownPeers: Map<string, { ip: string; lastSeen: number }> = new Map()
  /** UDP 打洞状态 */
  private punchTimer: NodeJS.Timeout | null = null
  private punchTargetIp: string | null = null
  /** 远程玩家（通过打洞发现的） */
  private remotePlayers: Map<string, PlayerInfo> = new Map()

  constructor() {
    super()
    const hostname = os.hostname()
    const localIp = this.getLocalIP()
    this.myInfo = {
      id: `${hostname}-${process.pid}`,
      name: hostname,
      ip: localIp,
      lastSeen: Date.now()
    }
  }

  getLocalIP(): string {
    const interfaces = os.networkInterfaces()
    const physicalIPs: string[] = []
    const virtualIPs: string[] = []

    const isPrivateIP = (ip: string): boolean => {
      if (ip.startsWith('192.168.')) return true
      if (ip.startsWith('10.')) return true
      if (ip.startsWith('172.')) {
        const second = parseInt(ip.split('.')[1], 10)
        if (second >= 16 && second <= 31) return true
      }
      return false
    }

    // 已知的 VM 虚拟适配器关键字（这些适配器只用于 VM 内部通信，桥接 VM 无法通过它们访问主机）
    const isVMOnlyAdapter = (name: string): boolean => {
      const lower = name.toLowerCase()
      return (
        lower.includes('vmware') ||
        lower.includes('virtualbox') ||
        lower.includes('hyper-v virtual') ||
        lower.includes('v ethernet') ||
        lower.includes('vbox') ||
        lower.includes('wsl')
      )
    }

    for (const name of Object.keys(interfaces)) {
      const lower = name.toLowerCase()
      if (lower.includes('loopback') || lower.includes('bluetooth')) {
        continue
      }

      const iface = interfaces[name]
      if (!iface) continue

      for (const info of iface) {
        if (info.family === 'IPv4' && !info.internal && isPrivateIP(info.address)) {
          if (isVMOnlyAdapter(name)) {
            // VM 专属适配器 → 最低优先级，桥接 VM 无法通过它访问主机
            virtualIPs.push(info.address)
          } else {
            // 物理网卡或桥接适配器 → 高优先级
            physicalIPs.push(info.address)
          }
        }
      }
    }

    // 优先级：物理网卡 > 虚拟适配器 > 回退 127.0.0.1
    const selected = physicalIPs.length > 0 ? physicalIPs[0] : (virtualIPs.length > 0 ? virtualIPs[0] : '127.0.0.1')
    console.log(`[Network] getLocalIP: physical=${JSON.stringify(physicalIPs)}, virtual=${JSON.stringify(virtualIPs)} → selected=${selected}`)
    return selected
  }

  getMyInfo(): PlayerInfo {
    return { ...this.myInfo }
  }

  getOnlinePlayers(): PlayerInfo[] {
    this.cleanStalePlayers()
    const lanPlayers = Array.from(this.onlinePlayers.values()).filter(p => p.id !== this.myInfo.id)
    const remotePlayers = Array.from(this.remotePlayers.values())
    // 合并去重（远程玩家优先使用 remotePlayers 中的 IP）
    const seen = new Set<string>()
    const all: PlayerInfo[] = []
    for (const p of [...remotePlayers, ...lanPlayers]) {
      if (!seen.has(p.id)) {
        seen.add(p.id)
        all.push(p)
      }
    }
    return all
  }

  getOnlinePlayersWithRooms(): PlayerInfo[] {
    return this.getOnlinePlayers()
  }

  getRemotePlayers(): PlayerInfo[] {
    return Array.from(this.remotePlayers.values())
  }

  startPunching(targetIp: string, playerName: string): void {
    if (!this.udpSocket) {
      console.error('[UDP] Cannot punch: socket not available')
      return
    }
    this.stopPunching()
    this.punchTargetIp = targetIp
    console.log(`[UDP] Starting hole punching to ${targetIp}`)

    const sendPunch = () => {
      if (!this.udpSocket || !this.punchTargetIp) return
      const punchMsg = JSON.stringify({
        type: 'PUNCH',
        from: this.myInfo.id,
        to: 'remote',
        payload: { playerName }
      }) + MSG_DELIMITER
      this.udpSocket.send(punchMsg, DISCOVERY_PORT, this.punchTargetIp, (err) => {
        if (err) console.error('[UDP] Punch send error:', err.message)
      })
    }

    // 立即发送一次，然后每 500ms 发送
    sendPunch()
    this.punchTimer = setInterval(sendPunch, 500)
  }

  stopPunching(): void {
    if (this.punchTimer) {
      clearInterval(this.punchTimer)
      this.punchTimer = null
    }
    this.punchTargetIp = null
  }

  getCurrentRoom(): GameRoom | null {
    return this.currentRoom
  }

  setMyName(name: string): void {
    this.myInfo.name = name
  }

  startDiscovery(): void {
    this.udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true })

    this.udpSocket.on('listening', () => {
      this.udpSocket!.setBroadcast(true)
      // 指定组播接口为本机 IP，避免绑到 VM 虚拟适配器上
      this.udpSocket!.setMulticastInterface(this.myInfo.ip)
      this.udpSocket!.addMembership(DISCOVERY_MULTICAST, this.myInfo.ip)
      console.log(`[UDP] Discovery listening on port ${DISCOVERY_PORT}, multicast on ${this.myInfo.ip}`)
    })

    this.udpSocket.on('message', (msg: Buffer, rinfo: dgram.RemoteInfo) => {
      const raw = msg.toString()
      const lines = raw.split(MSG_DELIMITER).filter(l => l.trim())
      for (const line of lines) {
        try {
          const data = JSON.parse(line) as {
            type: string
            player?: PlayerInfo
            room?: GameRoom
            from?: string
            to?: string
            payload?: Record<string, unknown>
          }

          if (data.type === 'HELLO' && data.player && data.player.id !== this.myInfo.id) {
            const player = data.player
            player.lastSeen = Date.now()
            this.onlinePlayers.set(player.id, player)
            this.emit('players-update', this.getOnlinePlayersWithRooms())

            this.knownPeers.set(player.id, { ip: rinfo.address, lastSeen: Date.now() })

            const replyMsg = JSON.stringify({
              type: 'HELLO',
              player: this.myInfo
            }) + MSG_DELIMITER
            this.udpSocket!.send(replyMsg, DISCOVERY_PORT, rinfo.address, (err) => {
              if (err) console.error('[UDP] Unicast HELLO reply error:', err.message)
            })
          }

          // UDP 打洞：收到 PUNCH，回复 PONG、注册远程玩家、并回打对方
          if (data.type === 'PUNCH' && data.from) {
            const remoteId: string = data.from
            const remoteName: string = (data.payload?.playerName as string) || remoteId
            const isNew = !this.remotePlayers.has(remoteId)
            console.log(`[UDP] Punch received from ${remoteId} @ ${rinfo.address}${isNew ? ' (new)' : ''}`)
            // 回复 PONG
            const pongMsg = JSON.stringify({
              type: 'PONG',
              from: this.myInfo.id,
              to: remoteId,
              player: this.myInfo
            }) + MSG_DELIMITER
            this.udpSocket!.send(pongMsg, DISCOVERY_PORT, rinfo.address, (err) => {
              if (err) console.error('[UDP] PONG reply error:', err.message)
            })
            // 注册远程玩家（只在首次时触发事件）
            const remotePlayer: PlayerInfo = {
              id: remoteId,
              name: remoteName,
              ip: rinfo.address,
              lastSeen: Date.now()
            }
            this.remotePlayers.set(remoteId, remotePlayer)
            if (isNew) {
              this.emit('remote-player-joined', remotePlayer)
            }
            this.emit('players-update', this.getOnlinePlayersWithRooms())

            // 同时互打：主机也向对方打洞，应对 CGNAT / Symmetric NAT
            if (!this.punchTimer) {
              console.log(`[UDP] Mutual punching: starting punch back to ${rinfo.address}`)
              this.startPunching(rinfo.address, this.myInfo.name)
            }
          }

          // 收到 PONG（打洞成功）
          if (data.type === 'PONG') {
            console.log(`[UDP] PONG received from ${data.from} @ ${rinfo.address} — hole punched!`)
            // 停止打洞定时器
            this.stopPunching()
            this.emit('punch-success', { ip: rinfo.address, player: data.player })
          }

          // 游戏数据通过 UDP 传输（远程联机时使用）
          if (
            data.type === 'MOVE' || data.type === 'GAME_OVER' || data.type === 'SYNC_BOARD' ||
            data.type === 'RESTART_REQUEST' || data.type === 'RESTART_ACCEPT' || data.type === 'RESTART_DECLINE'
          ) {
            const gameMsg: GameMessage = {
              type: data.type,
              from: data.from || rinfo.address,
              to: data.to,
              payload: data.payload || {}
            }
            this.emit('game-message', gameMsg)
          }

          if (data.type === 'ROOM_BROADCAST' && data.room) {
            console.log('[UDP] Room broadcast received:', JSON.stringify(data.room))
            this.emit('room-update', data.room)
          }

          // 任何 UDP 消息都意味着发送方在线 —— 注册到 onlinePlayers
          // 这解决了 HELLO 广播/组播在跨网桥 VM 场景下不可达的问题
          if (data.from && data.from !== this.myInfo.id) {
            const existingPlayer = this.onlinePlayers.get(data.from)
            if (!existingPlayer) {
              const playerName = (data.payload?.hostName as string) || (data.payload?.guestName as string) || data.from
              const player: PlayerInfo = {
                id: data.from,
                name: playerName,
                ip: rinfo.address,
                lastSeen: Date.now()
              }
              this.onlinePlayers.set(data.from, player)
              this.knownPeers.set(data.from, { ip: rinfo.address, lastSeen: Date.now() })
              console.log(`[UDP] Registered player from ${data.type}: ${playerName} @ ${rinfo.address}`)
              this.emit('players-update', this.getOnlinePlayersWithRooms())
            } else {
              // 更新 lastSeen 和 knownPeers
              existingPlayer.lastSeen = Date.now()
              existingPlayer.ip = rinfo.address
              this.knownPeers.set(data.from, { ip: rinfo.address, lastSeen: Date.now() })
            }
          }

          if (data.type === 'INVITE' && data.to === this.myInfo.id) {
            console.log('[UDP] Invite received from:', data.from, 'ip:', rinfo.address, 'payload:', data.payload)
            this.emit('invite-received', {
              from: data.from,
              fromIp: rinfo.address,
              fromName: (data.payload?.hostName as string) || data.from,
              gameType: data.payload?.gameType as string,
              hostPort: data.payload?.hostPort as number
            })
          }

          if (data.type === 'ACCEPT' && data.to === this.myInfo.id) {
            console.log('[UDP] Accept received from:', data.from, 'ip:', rinfo.address, 'payload:', data.payload)
            this.emit('invite-accepted', {
              from: data.from,
              fromIp: rinfo.address,
              gameType: data.payload?.gameType as string,
              room: data.payload?.room as GameRoom | undefined
            })
          }

          if (data.type === 'REJECT' && data.to === this.myInfo.id) {
            console.log('[UDP] Reject received from:', data.from, 'ip:', rinfo.address, 'payload:', data.payload)
            this.emit('invite-rejected', {
              from: data.from,
              fromIp: rinfo.address,
              reason: (data.payload?.reason as string) || '对方拒绝了邀请'
            })
          }
        } catch {
          // ignore invalid messages
        }
      }
    })

    this.udpSocket.on('error', (err) => {
      console.error('[UDP] Error:', err.message)
    })

    this.udpSocket.bind(DISCOVERY_PORT, () => {
      this.discoveryTimer = setInterval(() => {
        this.broadcastHello()
        this.broadcastUnicastHello()
      }, 5000)

      this.broadcastHello()
    })
  }

  private broadcastHello(): void {
    if (!this.udpSocket) return

    const msg = JSON.stringify({
      type: 'HELLO',
      player: this.myInfo
    }) + MSG_DELIMITER

    this.udpSocket.send(msg, DISCOVERY_PORT, DISCOVERY_MULTICAST, (err) => {
      if (err) console.error('[UDP] Multicast error:', err.message)
    })

    this.udpSocket.send(msg, DISCOVERY_PORT, '255.255.255.255', (err) => {
      if (err) console.error('[UDP] Broadcast error:', err.message)
    })
  }

  /** 周期性向已知对等节点发送单播 HELLO，解决组播/广播不对称问题 */
  private broadcastUnicastHello(): void {
    if (!this.udpSocket || this.knownPeers.size === 0) return

    const now = Date.now()
    const msg = JSON.stringify({
      type: 'HELLO',
      player: this.myInfo
    }) + MSG_DELIMITER

    for (const [id, peer] of this.knownPeers) {
      if (now - peer.lastSeen > 30000) {
        this.knownPeers.delete(id)
        continue
      }
      this.udpSocket.send(msg, DISCOVERY_PORT, peer.ip, (err) => {
        if (err) console.error(`[UDP] Unicast HELLO to ${peer.ip} error:`, err.message)
      })
    }
  }

  broadcastRoom(room: GameRoom): void {
    if (!this.udpSocket) return
    const msg = JSON.stringify({
      type: 'ROOM_BROADCAST',
      player: this.myInfo,
      room
    }) + MSG_DELIMITER
    this.udpSocket.send(msg, DISCOVERY_PORT, DISCOVERY_MULTICAST)
  }

  private cleanStalePlayers(): void {
    const now = Date.now()
    for (const [id, player] of this.onlinePlayers) {
      if (now - player.lastSeen > 15000) {
        this.onlinePlayers.delete(id)
      }
    }
  }

  startTCPServer(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.tcpServer = net.createServer((socket) => {
        // 连接时立即注册客户端，而非等待 SPECTATE_JOIN 消息
        const clientId = `${socket.remoteAddress}:${socket.remotePort}`
        this.tcpClients.set(clientId, socket)
        console.log(`[TCP] Client connected: ${clientId}, total clients: ${this.tcpClients.size}`)

        // 启用 TCP keepalive 防止静默断连
        socket.setKeepAlive(true, 30000)
        let buffer = ''

        socket.on('data', (data: Buffer) => {
          buffer += data.toString()
          const lines = buffer.split(MSG_DELIMITER)
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const msg: GameMessage = JSON.parse(line)
              if (msg.type === 'SPECTATE_JOIN') {
                this.handleSpectateJoin(msg, socket)
              }

              this.emit('game-message', msg)
            } catch {
              // ignore invalid messages
            }
          }
        })

        socket.on('close', () => {
          this.tcpClients.delete(clientId)
          console.log(`[TCP] Client disconnected: ${clientId}, total clients: ${this.tcpClients.size}`)
          this.emit('client-disconnected', clientId)
        })

        socket.on('error', (err) => {
          console.error('[TCP] Socket error:', err.message)
        })
      })

      this.tcpServer.listen(0, '0.0.0.0', () => {
        const addr = this.tcpServer!.address() as net.AddressInfo
        this.tcpServerPort = addr.port
        console.log(`[TCP] Game server listening on port ${this.tcpServerPort}`)
        resolve(this.tcpServerPort)
      })

      this.tcpServer.on('error', (err) => {
        console.error('[TCP] Server error:', err.message)
        reject(err)
      })
    })
  }

  private handleSpectateJoin(msg: GameMessage, socket: net.Socket): void {
    if (!this.currentRoom) return
    if (this.currentRoom.spectators.length >= 2) {
      this.sendToClient(socket, {
        type: 'REJECT',
        from: this.myInfo.id,
        to: msg.from,
        payload: { reason: '房间观战已满（最多2人）' }
      })
      socket.end()
      return
    }
    this.currentRoom.spectators.push(msg.from)
    this.broadcastRoom(this.currentRoom)
    this.sendToClient(socket, {
      type: 'ACCEPT',
      from: this.myInfo.id,
      to: msg.from,
      payload: { room: this.currentRoom }
    })
  }

  connectToPlayer(ip: string, port: number): net.Socket {
    const socket = new net.Socket()
    let buffer = ''

    socket.setKeepAlive(true, 30000)

    socket.on('data', (data: Buffer) => {
      buffer += data.toString()
      const lines = buffer.split(MSG_DELIMITER)
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const msg: GameMessage = JSON.parse(line)
          this.emit('game-message', msg)
        } catch {
          // ignore
        }
      }
    })

    socket.on('error', (err) => {
      console.error('[TCP Client] Connection error:', err.message)
      this.emit('connection-error', { ip, port, error: err.message })
    })

    socket.on('close', () => {
      console.log('[TCP Client] Connection closed:', ip, port)
      this.emit('connection-closed', { ip, port })
    })

    socket.connect(port, ip, () => {
      console.log(`[TCP] Connected to ${ip}:${port}`)
    })
    return socket
  }

  sendGameMessage(socket: net.Socket, msg: GameMessage): void {
    if (socket.destroyed) {
      console.warn('[TCP] Cannot send, socket destroyed')
      return
    }
    socket.write(JSON.stringify(msg) + MSG_DELIMITER)
  }

  sendToClient(socket: net.Socket, msg: GameMessage): void {
    if (socket.destroyed) {
      console.warn('[TCP] sendToClient skipped: socket destroyed')
      return
    }
    socket.write(JSON.stringify(msg) + MSG_DELIMITER)
  }

  broadcastToSpectators(msg: GameMessage): void {
    const raw = JSON.stringify(msg) + MSG_DELIMITER
    for (const [id, socket] of this.tcpClients) {
      if (socket.destroyed) {
        console.warn(`[TCP] Skipping destroyed socket: ${id}`)
        this.tcpClients.delete(id)
        continue
      }
      try {
        socket.write(raw)
      } catch (err) {
        console.error(`[TCP] Broadcast write error on ${id}:`, (err as Error).message)
        this.tcpClients.delete(id)
      }
    }
  }

  getTCPServerPort(): number {
    return this.tcpServerPort
  }

  setCurrentRoom(room: GameRoom | null): void {
    this.currentRoom = room
  }

  sendUdpMessage(targetIp: string, msg: Record<string, unknown>): void {
    if (!this.udpSocket) return
    const raw = JSON.stringify(msg) + MSG_DELIMITER
    this.udpSocket.send(raw, DISCOVERY_PORT, targetIp, (err) => {
      if (err) console.error('[UDP] Unicast error:', err.message)
    })
  }

  /** 通过 UDP 发送游戏消息（远程联机使用） */
  sendGameMessageUdp(targetIp: string, msg: GameMessage): void {
    this.sendUdpMessage(targetIp, msg as unknown as Record<string, unknown>)
  }

  createRoom(hostId: string, hostName: string, guestId: string, guestName: string, gameType: string): GameRoom {
    const room: GameRoom = {
      roomId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      hostId,
      guestId,
      hostName,
      guestName,
      hostPort: this.tcpServerPort,
      spectators: [],
      gameType
    }
    this.currentRoom = room
    return room
  }

  stop(): void {
    if (this.discoveryTimer) clearInterval(this.discoveryTimer)
    this.stopPunching()
    this.knownPeers.clear()
    this.remotePlayers.clear()
    if (this.udpSocket) {
      this.udpSocket.close()
      this.udpSocket = null
    }
    if (this.tcpServer) {
      this.tcpServer.close()
      this.tcpServer = null
    }
    for (const [, socket] of this.tcpClients) {
      socket.destroy()
    }
    this.tcpClients.clear()
  }
}

export const networkManager = new NetworkManager()