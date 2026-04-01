# Mission Control

一个现代化的 AI Agent 任务管理与监控平台。

## 功能特性

### 📊 任务看板
- 可视化任务管理（创建、分配、状态跟踪）
- 支持按优先级、负责人筛选
- 截止日期管理

### 👥 员工管理
- 多 Agent 统一管理
- 模型配置（支持多种 AI 模型）
- 渠道绑定（DingTalk、Telegram 等）
- 人格配置（AGENTS.md、SOUL.md、USER.md）

### 🎯 项目管理
- 项目创建与跟踪
- 项目历史记录
- Agent 任务分配

### 📅 日历与定时任务
- 日历视图
- Cron 定时任务配置
- 心跳检测设置

### 💾 记忆模块
- 每日记忆自动记录
- 长期记忆管理
- 多 Agent 记忆隔离

### 🔌 技能模块
- ClawHub.ai 技能市场
- 一键安装技能到指定 Agent
- 技能按 Agent 分组展示
- 技能复制与删除

### 📡 渠道管理
- 多渠道接入（DingTalk 等）
- 渠道状态监控

### 📜 工具日志
- 实时日志查看
- 按级别、分类、关键词筛选

### ⚙️ 设置
- 项目名称配置
- 管理员账号管理
- 系统信息查看

## 技术栈

- **前端**：Next.js 14 + TypeScript + TailwindCSS
- **数据库**：SQLite（better-sqlite3）
- **实时**：Server-Sent Events

## 快速开始

### 环境要求

- Node.js >= 18
- npm / yarn / pnpm

### 安装

```bash
# 克隆项目
git clone https://github.com/WhistleYoung/mission-control.git
cd mission-control

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 生产部署

```bash
# 构建
npm run build

# 启动
npm start
```

默认账号：`admin` / `admin123`

## 项目结构

```
mission-control/
├── src/
│   ├── app/
│   │   ├── api/              # API 路由
│   │   │   ├── agents/
│   │   │   ├── auth/
│   │   │   ├── channels/
│   │   │   ├── conversations/
│   │   │   ├── cron/
│   │   │   ├── events/
│   │   │   ├── logs/
│   │   │   ├── memory/
│   │   │   ├── projects/
│   │   │   ├── sessions/
│   │   │   ├── settings/
│   │   │   ├── skills/
│   │   │   └── tasks/
│   │   ├── page.tsx          # 主页面
│   │   └── layout.tsx        # 布局
│   ├── components/            # UI 组件
│   └── lib/                   # 工具函数
│       ├── db.ts              # 数据库
│       └── auth.ts           # 认证
├── data/                     # 数据库文件目录
├── public/                   # 静态资源
├── package.json
└── README.md
```

## 数据库

数据库文件存储在 `data/mission-control.db`（自动创建，提交时被 .gitignore 忽略）。

如需手动初始化：
```bash
# 创建数据目录
mkdir -p data
```

## 配置

### Agent 配置

Agent 工作区位于 `~/.openclaw/workspace-{agentId}/`，包含：

- `AGENTS.md` - 工作规范
- `SOUL.md` - 人格定义
- `USER.md` - 用户信息
- `memory/` - 每日记忆
- `MEMORY.md` - 长期记忆
- `skills/` - 技能目录

### ClawHub 技能

配置 ClawHub API Token 可避免搜索限流：
1. 前往 [clawhub.ai](https://clawhub.ai) 获取 Token
2. 在技能模块设置中配置

## License

MIT
