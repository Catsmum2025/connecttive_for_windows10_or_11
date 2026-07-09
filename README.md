# ConnectTive - 联机棋类游戏桌面应用

基于 Electron + React + TypeScript 构建的局域网/远程联机棋类游戏平台，支持四款经典棋类游戏的本地双人及联机对战。

## 游戏列表

| 游戏 | 棋盘 | 简介 |
|------|------|------|
| 井字棋 | 3×3 | 经典三连棋，简单但充满策略 |
| 五子棋 | 19×19 | 黑棋先行，先连成五子者胜 |
| 国际象棋 | 8×8 | 六种棋子各具独特走法，将死对手国王即获胜 |
| 中国象棋 | 9×10 | 楚河汉界，红黑双方七种兵种对决 |

## 技术栈

- **框架**: Electron 33
- **前端**: React 18 + TypeScript + Tailwind CSS
- **路由**: React Router v6
- **图标**: Lucide React
- **网络**: UDP 广播/组播发现 + TCP 直连（局域网） + UDP 打洞 + UDP 数据通道（远程）
- **构建**: Vite + electron-builder

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

此命令会同时启动 Vite 开发服务器（渲染进程）和 Electron 主进程。

### 构建

```bash
npm run build
```

### 打包为便携版 exe

```bash
npm run pack
```

生成的可执行文件位于 `release/` 目录下。

### 类型检查

```bash
npm run typecheck
```

## 联机对战

### 局域网联机

1. 所有玩家通过 **UDP 广播/组播**（端口 9527）在局域网内自动发现彼此
2. 一方发起邀请后，双方通过 **TCP 直连** 建立点对点游戏会话
3. 游戏数据（走棋、胜负、再来一局等）通过 TCP 通道实时同步

### 远程联机（UDP 打洞）

无需服务器，通过 UDP 打洞实现 NAT 穿透，支持跨网络联机：

1. 主机在大厅点击"远程联机 → 我是主机"，获取公网 IP 发给对方
2. 客机在大厅点击"远程联机 → 连接到远程"，输入主机公网 IP
3. 双方同时互打建立双向 UDP 通道，打洞成功后自动出现在玩家列表
4. 后续游戏数据通过 UDP 通道实时同步，支持所有棋类

**工作原理**：双方同时向对方 NAT 发送 UDP 包，在各自 NAT 上打开映射，实现 P2P 直连。采用同时互打（Simultaneous Mutual Punching）机制，应对 CGNAT 和 Symmetric NAT。

### 防火墙注意事项

如果无法发现对方，请确保：
- 局域网模式下，两台设备在同一网段且能互相 ping 通
- UDP 端口 9527 未被防火墙拦截
- 远程模式下，主机需要将公网 IP 发给对方（应用会自动尝试获取）

### 测试方式

- **局域网**：同一局域网下两台设备，或同一台电脑开启两个实例
- **远程**：两台不同网络下的设备；或在宿主机和 NAT 模式虚拟机之间测试

## 项目结构

```
connecttive_game_bar/
├── src/
│   ├── main/                  # Electron 主进程
│   │   ├── index.ts           # 主进程入口、窗口管理、IPC 注册
│   │   └── network.ts         # UDP 网络发现 + TCP 直连 + UDP 打洞管理
│   ├── preload/
│   │   └── index.ts           # 预加载脚本，暴露 IPC API
│   └── renderer/
│       └── src/
│           ├── hooks/
│           │   ├── useNetwork.ts      # 玩家在线状态管理
│           │   └── useNetworkGame.ts  # 游戏内消息收发（TCP + UDP 双通道）
│           ├── components/
│           │   ├── game/
│           │   │   ├── TicTacToeBoard.tsx    # 井字棋
│           │   │   ├── GomokuBoard.tsx       # 五子棋
│           │   │   ├── ChessBoard.tsx        # 国际象棋
│           │   │   └── ChineseChessBoard.tsx # 中国象棋
│           │   ├── Navbar.tsx          # 导航栏（含深浅色切换）
│           │   ├── MobileMenu.tsx      # 移动端菜单
│           │   ├── ThemeToggle.tsx     # 深浅色切换按钮
│           │   ├── ThemeContext.tsx     # 深浅色主题上下文
│           │   └── Confetti.tsx        # 胜利彩带特效
│           ├── game/
│           │   ├── tictactoe.ts     # 井字棋逻辑
│           │   ├── gomoku.ts        # 五子棋逻辑
│           │   ├── chess.ts         # 国际象棋逻辑
│           │   ├── chinesechess.ts  # 中国象棋逻辑
│           │   └── config.ts        # 游戏配置
│           ├── pages/
│           │   ├── LandPage.tsx      # 首页
│           │   ├── GamesPage.tsx     # 游戏选择页
│           │   ├── GameIntro.tsx     # 游戏详情页
│           │   ├── GameRoom.tsx      # 游戏房间（网络对战）
│           │   ├── Lobby.tsx         # 游戏大厅（配对 + 远程联机）
│           │   └── LocalTestPage.tsx # 本地测试页
│           ├── App.tsx               # 路由入口
│           ├── main.tsx              # 渲染进程入口
│           └── types.ts              # 类型定义
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
├── tsconfig.preload.json
└── vite.config.ts
```

## 许可证

[MIT](LICENSE) © 2026 Catsmum2025