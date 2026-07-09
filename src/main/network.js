"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.networkManager = void 0;
const dgram = __importStar(require("dgram"));
const net = __importStar(require("net"));
const os = __importStar(require("os"));
const events_1 = require("events");
const DISCOVERY_PORT = 9527;
const DISCOVERY_MULTICAST = '224.0.0.114';
class NetworkManager extends events_1.EventEmitter {
    constructor() {
        super();
        this.udpSocket = null;
        this.tcpServer = null;
        this.tcpClients = new Map();
        this.tcpServerPort = 0;
        this.onlinePlayers = new Map();
        this.discoveryTimer = null;
        this.currentRoom = null;
        const hostname = os.hostname();
        const localIp = this.getLocalIP();
        this.myInfo = {
            id: `${hostname}-${process.pid}`,
            name: hostname,
            ip: localIp,
            lastSeen: Date.now()
        };
    }
    getLocalIP() {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            const iface = interfaces[name];
            if (!iface)
                continue;
            for (const info of iface) {
                if (info.family === 'IPv4' && !info.internal) {
                    return info.address;
                }
            }
        }
        return '127.0.0.1';
    }
    getMyInfo() {
        return { ...this.myInfo };
    }
    getOnlinePlayers() {
        this.cleanStalePlayers();
        return Array.from(this.onlinePlayers.values()).filter(p => p.id !== this.myInfo.id);
    }
    getOnlinePlayersWithRooms() {
        return this.getOnlinePlayers();
    }
    getCurrentRoom() {
        return this.currentRoom;
    }
    setMyName(name) {
        this.myInfo.name = name;
    }
    // ========== UDP 局域网发现 ==========
    startDiscovery() {
        this.udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        this.udpSocket.on('listening', () => {
            this.udpSocket.setBroadcast(true);
            this.udpSocket.addMembership(DISCOVERY_MULTICAST);
            console.log(`[UDP] Discovery listening on port ${DISCOVERY_PORT}`);
        });
        this.udpSocket.on('message', (msg, rinfo) => {
            try {
                const data = JSON.parse(msg.toString());
                if (data.type === 'HELLO' && data.player.id !== this.myInfo.id) {
                    const player = data.player;
                    player.lastSeen = Date.now();
                    this.onlinePlayers.set(player.id, player);
                    this.emit('players-update', this.getOnlinePlayersWithRooms());
                }
                if (data.type === 'ROOM_BROADCAST' && data.room) {
                    console.log('[UDP] Room broadcast received:', data.room);
                    this.emit('room-update', data.room);
                }
            }
            catch {
                // ignore invalid messages
            }
        });
        this.udpSocket.on('error', (err) => {
            console.error('[UDP] Error:', err.message);
        });
        this.udpSocket.bind(DISCOVERY_PORT, () => {
            // Start broadcasting HELLO periodically
            this.discoveryTimer = setInterval(() => {
                this.broadcastHello();
            }, 2000);
            // Initial broadcast
            this.broadcastHello();
        });
    }
    broadcastHello() {
        if (!this.udpSocket)
            return;
        const msg = JSON.stringify({
            type: 'HELLO',
            player: this.myInfo
        });
        this.udpSocket.send(msg, DISCOVERY_PORT, DISCOVERY_MULTICAST, (err) => {
            if (err)
                console.error('[UDP] Broadcast error:', err.message);
        });
    }
    broadcastRoom(room) {
        if (!this.udpSocket)
            return;
        const msg = JSON.stringify({
            type: 'ROOM_BROADCAST',
            player: this.myInfo,
            room
        });
        this.udpSocket.send(msg, DISCOVERY_PORT, DISCOVERY_MULTICAST);
    }
    cleanStalePlayers() {
        const now = Date.now();
        for (const [id, player] of this.onlinePlayers) {
            if (now - player.lastSeen > 8000) {
                this.onlinePlayers.delete(id);
            }
        }
    }
    // ========== TCP 游戏服务器 ==========
    startTCPServer() {
        return new Promise((resolve, reject) => {
            this.tcpServer = net.createServer((socket) => {
                let clientId = '';
                socket.on('data', (data) => {
                    try {
                        const msg = JSON.parse(data.toString());
                        console.log('[TCP] Received:', msg.type, 'from', msg.from);
                        if (msg.type === 'SPECTATE_JOIN') {
                            clientId = msg.from;
                            this.tcpClients.set(clientId, socket);
                            this.handleSpectateJoin(msg, socket);
                        }
                        this.emit('game-message', msg);
                    }
                    catch {
                        // ignore invalid messages
                    }
                });
                socket.on('close', () => {
                    if (clientId) {
                        this.tcpClients.delete(clientId);
                        this.emit('client-disconnected', clientId);
                    }
                });
                socket.on('error', (err) => {
                    console.error('[TCP] Socket error:', err.message);
                });
            });
            this.tcpServer.listen(0, '0.0.0.0', () => {
                const addr = this.tcpServer.address();
                this.tcpServerPort = addr.port;
                console.log(`[TCP] Game server listening on port ${this.tcpServerPort}`);
                resolve(this.tcpServerPort);
            });
            this.tcpServer.on('error', (err) => {
                console.error('[TCP] Server error:', err.message);
                reject(err);
            });
        });
    }
    handleSpectateJoin(msg, socket) {
        if (!this.currentRoom)
            return;
        if (this.currentRoom.spectators.length >= 2) {
            socket.write(JSON.stringify({
                type: 'REJECT',
                from: this.myInfo.id,
                to: msg.from,
                payload: { reason: '房间观战已满（最多2人）' }
            }));
            socket.end();
            return;
        }
        this.currentRoom.spectators.push(msg.from);
        this.broadcastRoom(this.currentRoom);
        socket.write(JSON.stringify({
            type: 'ACCEPT',
            from: this.myInfo.id,
            to: msg.from,
            payload: { room: this.currentRoom }
        }));
    }
    connectToPlayer(ip, port) {
        const socket = new net.Socket();
        socket.connect(port, ip, () => {
            console.log(`[TCP] Connected to ${ip}:${port}`);
        });
        return socket;
    }
    sendToClient(socket, msg) {
        socket.write(JSON.stringify(msg));
    }
    broadcastToSpectators(msg) {
        for (const [, socket] of this.tcpClients) {
            socket.write(JSON.stringify(msg));
        }
    }
    getTCPServerPort() {
        return this.tcpServerPort;
    }
    setCurrentRoom(room) {
        this.currentRoom = room;
    }
    stop() {
        if (this.discoveryTimer)
            clearInterval(this.discoveryTimer);
        if (this.udpSocket) {
            this.udpSocket.close();
            this.udpSocket = null;
        }
        if (this.tcpServer) {
            this.tcpServer.close();
            this.tcpServer = null;
        }
        for (const [, socket] of this.tcpClients) {
            socket.destroy();
        }
        this.tcpClients.clear();
    }
}
exports.networkManager = new NetworkManager();
