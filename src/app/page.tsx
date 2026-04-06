'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Inbox, FolderKanban, Brain, Settings, Users, Plus, Search, MessageSquare,
  MoreHorizontal, ChevronDown, Clock, User, Bot, X, Check, RefreshCw,
  Activity, Terminal, ChevronLeft, ChevronRight, Sparkles, LogOut, Trash2,
  Network, Zap, ExternalLink, FileText, Filter, RefreshCw as RefreshCwIcon,
  Key, FolderTree, Grid, Cpu, Edit2, Shield, ShieldCheck, ShieldX, List,
  TrendingUp,
} from 'lucide-react'

type Tab = 'inbox' | 'projects' | 'memory' | 'agents' | 'skills' | 'settings' | 'channels' | 'timing' | 'realtime' | 'logs' | 'models' | 'approvals' | 'usage'
type TaskStatus = 'backlog' | 'todo' | 'in-progress' | 'in-review' | 'done'
type Priority = 'urgent' | 'high' | 'medium' | 'low'
type MemoryFilter = 'daily' | 'long-term' | 'all'

interface Task {
  id: number
  title: string
  description?: string
  status: TaskStatus
  priority: Priority
  assignee_id: string
  assignee_name: string
  assignee_type: 'ai' | 'human'
  due_date?: string
  created_at: string
  updated_at: string
}

interface Project {
  id: number
  name: string
  description?: string
  emoji: string
  progress: number
  status: 'active' | 'completed' | 'on-hold'
  agent_id: string
  agent_name: string
}

interface Agent {
  id: string
  name: string
  identityName: string
  identityEmoji: string
  model: string
  workspace: string
  isDefault: boolean
  boundChannel?: string | null
  agents?: string | null
  soul?: AgentSoul | null
  user?: AgentUser | null
}

interface AgentSoul {
  coreTruths?: string
  boundaries?: string
  vibe?: string
  continuity?: string
}

interface AgentUser {
  name?: string
  callName?: string
  pronouns?: string
  timezone?: string
  notes?: string
  context?: string
}

interface Skill {
  name: string
  status: 'ready' | 'needs_setup' | 'unknown'
  description: string
}

interface CronJob {
  id: string
  name: string
  enabled: boolean
  schedule: string
  scheduleKind: string
  nextRunAt: string | null
  createdAt: string
  updatedAt: string
  sessionTarget: string
  wakeMode: string
  message: string
  deliverMode: string
  deliverChannel: string
}

interface ProjectHistory {
  id: number
  project_id: number
  action: string
  description: string
  actor_type: 'human' | 'ai' | 'system'
  actor_name: string
  created_at: string
}

interface Conversation {
  id: number
  project_id: number | null
  agent_id: string
  session_key: string
  session_id: string
  title: string
  summary: string
  message_count: number
  channel: string
  last_to: string
  created_at: string
  project_name?: string
  project_emoji?: string
}

interface MemoryEntry {
  id: string
  agentId: string
  agentName: string
  agentEmoji: string
  date: string
  preview: string
  type: 'daily' | 'long-term'
  tags: string[]
}

interface Channel {
  id: string
  name: string
  provider: string
  status: 'active' | 'inactive'
  agentId: string
  agentName: string
  displayName?: string
  channelType?: string
  accountId?: string
  lastMessage?: string
  updatedAt: string
}

const sampleMemories: MemoryEntry[] = [
  { id: '1', agentId: 'main', agentName: '小七', agentEmoji: '🧑💻', date: '2026-03-29', preview: '部署 Mission Control 可视化管理面板，完成登录认证、项目管理、员工管理模块开发...', type: 'daily', tags: ['开发', '前端'] },
  { id: '2', agentId: 'main', agentName: '小七', agentEmoji: '🧑💻', date: '2026-03-28', preview: '配置 MySQL 数据库连接，创建用户表和项目表，集成 bcrypt 加密认证...', type: 'daily', tags: ['后端', '数据库'] },
  { id: '3', agentId: 'worker', agentName: '壹号牛马', agentEmoji: '🐂', date: '2026-03-28', preview: '完成 OpenClaw CLI 代理配置，优化 qwen3-coder-plus 模型调用性能...', type: 'daily', tags: ['优化', 'AI'] },
  { id: '4', agentId: 'main', agentName: '小七', agentEmoji: '🧑💻', date: '2026-03-27', preview: '配置飞书机器人接入，完成 TTS 语音服务集成，实现钉钉消息收发...', type: 'daily', tags: ['集成', '飞书'] },
  { id: '5', agentId: 'main', agentName: '小七', agentEmoji: '🧑💻', date: '2026-03-25', preview: '用户偏好：喜欢折腾新技术、追求效率、使用飞书通讯、重视文档解析能力...', type: 'long-term', tags: ['用户', '偏好'] },
  { id: '6', agentId: 'main', agentName: '小七', agentEmoji: '🧑💻', date: '2026-03-20', preview: '系统架构：OpenClaw Gateway 在 192.168.1.152:18789，Token 已记录...', type: 'long-term', tags: ['配置', '架构'] },
]

const agentSkills: Record<string, { name: string; desc: string }[]> = {
  main: [
    { name: '文档解析 (PaddleOCR)', desc: 'OCR 文档和图片识别' },
    { name: '飞书集成', desc: '飞书文档、云空间、Wiki 管理' },
    { name: '钉钉集成', desc: '钉钉消息收发' },
    { name: '天气查询', desc: '实时天气预报' },
    { name: 'TTS语音合成', desc: '文字转语音' },
    { name: 'ECS磁盘管理', desc: '联通云服务器管理' },
    { name: '云智眼设备管理', desc: '设备监控和录像查询' },
    { name: '网页搜索', desc: '百度/网络搜索' },
  ],
  worker: [
    { name: '代码编写', desc: '多语言代码生成' },
    { name: '代码审查', desc: 'PR 代码审查' },
    { name: '数据分析', desc: '数据处理和分析' },
    { name: '技术文档生成', desc: 'API 文档编写' },
    { name: 'Debug辅助', desc: '问题诊断和修复' },
  ],
}

const PriorityBadge = ({ priority }: { priority: Priority }) => {
  const colors: Record<Priority, string> = {
    urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  }
  return <span className={`px-1.5 py-0.5 text-xs rounded border ${colors[priority]}`}>{priority === 'urgent' ? '紧急' : priority === 'high' ? '高' : priority === 'medium' ? '中' : '低'}</span>
}

const StatusDot = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    backlog: 'bg-gray-500', todo: 'bg-gray-400', 'in-progress': 'bg-blue-500',
    'in-review': 'bg-orange-500', done: 'bg-green-500', scheduled: 'bg-gray-400',
    running: 'bg-blue-500 animate-pulse', completed: 'bg-green-500', failed: 'bg-red-500',
  }
  return <span className={`w-2 h-2 rounded-full ${colors[status] || 'bg-gray-500'}`} />
}

const CreateTaskModal = ({ isOpen, onClose, onCreate, agents }: {
  isOpen: boolean; onClose: () => void; onCreate: (task: Partial<Task>) => void; agents: Agent[]
}) => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [assigneeType, setAssigneeType] = useState<'ai' | 'human'>('ai')
  const [selectedAgent, setSelectedAgent] = useState('main')
  const [dueDate, setDueDate] = useState('')

  if (!isOpen) return null

  const handleSubmit = () => {
    if (!title.trim()) return
    const agent = agents.find(a => a.id === selectedAgent)
    onCreate({
      title, description, priority, assignee_type: assigneeType,
      assignee_id: assigneeType === 'human' ? 'human' : selectedAgent,
      assignee_name: assigneeType === 'human' ? '张扬' : (agent?.identityName || '未知'),
      due_date: dueDate || undefined,
    })
    setTitle(''); setDescription(''); onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-850 border border-gray-700 rounded-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">创建任务</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">任务标题</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="linear-input w-full" placeholder="输入任务标题..." />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">描述</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="linear-input w-full h-20 resize-none" placeholder="输入任务描述..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">优先级</label>
              <select value={priority} onChange={e => setPriority(e.target.value as Priority)} className="linear-input w-full">
                <option value="urgent">紧急</option><option value="high">高</option><option value="medium">中</option><option value="low">低</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">截止日期</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="linear-input w-full" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">负责人类型</label>
            <div className="flex gap-2">
              <button onClick={() => setAssigneeType('ai')} className={`flex-1 py-2 rounded-md text-sm font-medium ${assigneeType === 'ai' ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400'}`}><Bot className="w-4 h-4 mx-auto mb-1" />AI</button>
              <button onClick={() => setAssigneeType('human')} className={`flex-1 py-2 rounded-md text-sm font-medium ${assigneeType === 'human' ? 'bg-purple-500 text-white' : 'bg-gray-800 text-gray-400'}`}><User className="w-4 h-4 mx-auto mb-1" />人类</button>
            </div>
          </div>
          {assigneeType === 'ai' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">选择 Agent</label>
              <div className="grid grid-cols-2 gap-2">
                {agents.map(agent => (
                  <button key={agent.id} onClick={() => setSelectedAgent(agent.id)} className={`flex items-center gap-2 p-3 rounded-lg border ${selectedAgent === agent.id ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 bg-gray-800'}`}>
                    <span className="text-lg">{agent.identityEmoji}</span>
                    <span className="text-sm text-white">{agent.identityName}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="linear-btn-secondary">取消</button>
          <button onClick={handleSubmit} className="linear-btn-primary">创建</button>
        </div>
      </div>
    </div>
  )
}

const CreateProjectModal = ({ isOpen, onClose, onCreate, agents }: {
  isOpen: boolean; onClose: () => void; onCreate: (project: Partial<Project>) => void; agents: Agent[]
}) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('📁')
  const [selectedAgent, setSelectedAgent] = useState('main')
  const emojis = ['📁', '🚀', '⚙️', '💬', '🔄', '📚', '🎯', '💡', '📊', '🎨', '🔧', '📱']

  if (!isOpen) return null

  const handleSubmit = () => {
    if (!name.trim()) return
    const agent = agents.find(a => a.id === selectedAgent)
    onCreate({ name, description, emoji, agent_id: selectedAgent, agent_name: agent?.identityName || '未知' })
    setName(''); setDescription(''); setEmoji('📁'); onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-850 border border-gray-700 rounded-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">创建项目</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">项目名称</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="linear-input w-full" placeholder="输入项目名称..." />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">描述</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="linear-input w-full h-20 resize-none" placeholder="输入项目描述..." />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">负责人</label>
            <div className="grid grid-cols-2 gap-2">
              {agents.map(agent => (
                <button key={agent.id} onClick={() => setSelectedAgent(agent.id)} className={`flex items-center gap-2 p-3 rounded-lg border ${selectedAgent === agent.id ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 bg-gray-800'}`}>
                  <span className="text-lg">{agent.identityEmoji}</span>
                  <span className="text-sm text-white">{agent.identityName}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">图标</label>
            <div className="flex flex-wrap gap-2">
              {emojis.map(e => (
                <button key={e} onClick={() => setEmoji(e)} className={`w-10 h-10 text-xl rounded-lg border ${emoji === e ? 'border-blue-500 bg-blue-500/20' : 'border-gray-700 bg-gray-800'}`}>{e}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="linear-btn-secondary">取消</button>
          <button onClick={handleSubmit} className="linear-btn-primary">创建</button>
        </div>
      </div>
    </div>
  )
}

const CreateChannelModal = ({ isOpen, onClose, onCreate }: {
  isOpen: boolean; onClose: () => void; onCreate: (channelType: string, accountId: string, accountData: any) => void
}) => {
  const [channelType, setChannelType] = useState('feishu')
  const [accountId, setAccountId] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  
  const channelTypes = [
    { value: 'feishu', label: '飞书', fields: ['appId', 'appSecret'] },
    { value: 'dingtalk-connector', label: '钉钉', fields: ['clientId', 'clientSecret'] },
  ]

  if (!isOpen) return null

  const handleSubmit = () => {
    if (!accountId.trim()) return
    const selectedChannel = channelTypes.find(c => c.value === channelType)
    const accountData: any = {}
    if (channelType === 'feishu') {
      accountData.appId = clientId
      accountData.appSecret = clientSecret
    } else if (channelType === 'dingtalk-connector') {
      accountData.clientId = clientId
      accountData.clientSecret = clientSecret
    }
    onCreate(channelType, accountId, accountData)
    setChannelType('feishu'); setAccountId(''); setClientId(''); setClientSecret(''); onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-850 border border-gray-700 rounded-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">新增渠道账号</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">渠道类型</label>
            <select value={channelType} onChange={e => setChannelType(e.target.value)} className="linear-input w-full">
              {channelTypes.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">账号ID</label>
            <input type="text" value={accountId} onChange={e => setAccountId(e.target.value)} className="linear-input w-full" placeholder="输入账号ID，如: main, worker" />
          </div>
          {channelType === 'feishu' && (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">App ID</label>
                <input type="text" value={clientId} onChange={e => setClientId(e.target.value)} className="linear-input w-full" placeholder="飞书 App ID" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">App Secret</label>
                <input type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)} className="linear-input w-full" placeholder="飞书 App Secret" />
              </div>
            </>
          )}
          {channelType === 'dingtalk-connector' && (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Client ID</label>
                <input type="text" value={clientId} onChange={e => setClientId(e.target.value)} className="linear-input w-full" placeholder="钉钉 Client ID" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Client Secret</label>
                <input type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)} className="linear-input w-full" placeholder="钉钉 Client Secret" />
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="linear-btn-secondary">取消</button>
          <button onClick={handleSubmit} className="linear-btn-primary">创建</button>
        </div>
      </div>
    </div>
  )
}

const CreateAgentModal = ({ isOpen, onClose, onCreate, channels }: {
  isOpen: boolean; onClose: () => void; onCreate: (agent: { id: string; name: string; model: string; boundChannel?: string }) => void; channels: Channel[]
}) => {
  const [agentId, setAgentId] = useState('')
  const [agentName, setAgentName] = useState('')
  const [selectedModel, setSelectedModel] = useState('minimax/MiniMax-M2.7')
  const [selectedChannel, setSelectedChannel] = useState('')
  const [emoji, setEmoji] = useState('🤖')
  const emojis = ['🤖', '👨‍💻', '👩‍💻', '🐂', '🦊', '🐱', '🐶', '🦁', '🐯', '🦄', '🐲', '🦅']

  // Model options - loaded from openclaw.json via API
  const [modelOptions, setModelOptions] = useState<{ value: string; label: string }[]>([
    { value: 'minimax/MiniMax-M2.7', label: 'MiniMax-M2.7 (默认)' },
  ])

  // Fetch models from API on mount
  useEffect(() => {
    fetch('/api/models')
      .then(res => res.json())
      .then(data => {
        if (data.models && data.models.length > 0) {
          setModelOptions(data.models)
        }
      })
      .catch(console.error)
  }, [])

  // Get unassigned channels (channels that are not bound to any agent)
  const unassignedChannels = channels.filter(c => !c.agentId)

  if (!isOpen) return null

  const handleSubmit = () => {
    if (!agentId.trim() || !agentName.trim()) return
    // Convert to lowercase and remove special chars for ID
    const normalizedId = agentId.toLowerCase().replace(/[^a-z0-9]/g, '-')
    onCreate({ id: normalizedId, name: agentName, model: selectedModel, boundChannel: selectedChannel || undefined })
    setAgentId(''); setAgentName(''); setSelectedModel('minimax/MiniMax-M2.7'); setSelectedChannel(''); setEmoji('🤖'); onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-850 border border-gray-700 rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">新建员工</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">员工ID（英文、数字、连字符）</label>
            <input type="text" value={agentId} onChange={e => setAgentId(e.target.value)} className="linear-input w-full" placeholder="例如: developer-1" />
            <p className="text-xs text-gray-500 mt-1">将创建 workspace-{agentId || 'xxx'} 目录</p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">员工名称</label>
            <input type="text" value={agentName} onChange={e => setAgentName(e.target.value)} className="linear-input w-full" placeholder="输入员工名称..." />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">图标</label>
            <div className="flex flex-wrap gap-2">
              {emojis.map(e => (
                <button key={e} onClick={() => setEmoji(e)} className={`w-10 h-10 text-xl rounded-lg border ${emoji === e ? 'border-blue-500 bg-blue-500/20' : 'border-gray-700 bg-gray-800'}`}>{e}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">AI 模型</label>
            <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} className="linear-input w-full">
              {modelOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">绑定渠道（可选）</label>
            <select value={selectedChannel} onChange={e => setSelectedChannel(e.target.value)} className="linear-input w-full">
              <option value="">不绑定渠道</option>
              {unassignedChannels.map(c => (
                <option key={c.id} value={c.id}>{c.displayName}（未绑定）</option>
              ))}
            </select>
            {unassignedChannels.length === 0 && <p className="text-xs text-gray-500 mt-1">暂无可用渠道，所有渠道已绑定</p>}
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="linear-btn-secondary">取消</button>
          <button onClick={handleSubmit} className="linear-btn-primary">创建</button>
        </div>
      </div>
    </div>
  )
}

const CreateCronModal = ({ isOpen, onClose, onCreate, agents }: {
  isOpen: boolean; onClose: () => void; onCreate: (job: { name: string; cron: string; message: string; agent?: string }) => void; agents: Agent[]
}) => {
  const [name, setName] = useState('')
  const [cron, setCron] = useState('')
  const [message, setMessage] = useState('')
  const [selectedAgent, setSelectedAgent] = useState('main')

  if (!isOpen) return null

  const handleSubmit = () => {
    if (!name.trim() || !cron.trim()) return
    onCreate({ name, cron, message, agent: selectedAgent })
    setName(''); setCron(''); setMessage(''); onClose()
  }

  const cronPresets = [
    { label: '每5分钟', value: '*/5 * * * *' },
    { label: '每15分钟', value: '*/15 * * * *' },
    { label: '每小时', value: '0 * * * *' },
    { label: '每天早上9点', value: '0 9 * * *' },
    { label: '每天晚上6点', value: '0 18 * * *' },
    { label: '每周一', value: '0 9 * * 1' },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-850 border border-gray-700 rounded-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">创建定时任务</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">任务名称</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="linear-input w-full" placeholder="输入任务名称..." />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Cron 表达式</label>
            <input type="text" value={cron} onChange={e => setCron(e.target.value)} className="linear-input w-full font-mono" placeholder="* * * * *" />
            <div className="flex flex-wrap gap-2 mt-2">
              {cronPresets.map(preset => (
                <button key={preset.value} onClick={() => setCron(preset.value)} className={`px-2 py-1 text-xs rounded border ${cron === preset.value ? 'border-blue-500 bg-blue-500/20 text-blue-400' : 'border-gray-700 bg-gray-800 text-gray-400'}`}>
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">执行消息</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} className="linear-input w-full h-20 resize-none" placeholder="输入要执行的任务描述..." />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">执行 Agent</label>
            <div className="grid grid-cols-2 gap-2">
              {agents.map(agent => (
                <button key={agent.id} onClick={() => setSelectedAgent(agent.id)} className={`flex items-center gap-2 p-3 rounded-lg border ${selectedAgent === agent.id ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 bg-gray-800'}`}>
                  <span className="text-lg">{agent.identityEmoji}</span>
                  <span className="text-sm text-white">{agent.identityName}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="linear-btn-secondary">取消</button>
          <button onClick={handleSubmit} className="linear-btn-primary">创建</button>
        </div>
      </div>
    </div>
  )
}

// Add Model Modal - OpenAI compatible format
function AddModelModal({ isOpen, onClose, onAdd, providers = {} }: {
  isOpen: boolean
  onClose: () => void
  onAdd: (providerId: string, provider: any, models: any[]) => void
  providers?: Record<string, any>
}) {
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [selectedProvider, setSelectedProvider] = useState('')
  const [providerId, setProviderId] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [apiType, setApiType] = useState<'openai-completions' | 'anthropic'>('openai-completions')
  const [modelsInput, setModelsInput] = useState('')
  const [contextWindow, setContextWindow] = useState('128000')
  const [maxTokens, setMaxTokens] = useState('8192')
  const [reasoning, setReasoning] = useState(false)

  // Presets for common providers
  const providerPresets = [
    { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKey: '', apiType: 'openai-completions' as const },
    { name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', apiKey: '', apiType: 'anthropic' as const },
    { name: '兼容 OpenAI', baseUrl: '', apiKey: '', apiType: 'openai-completions' as const },
    { name: 'Ollama', baseUrl: 'http://localhost:11434/v1', apiKey: 'ollama', apiType: 'openai-completions' as const },
    { name: 'LM Studio', baseUrl: 'http://localhost:1234/v1', apiKey: 'lm-studio', apiType: 'openai-completions' as const },
    { name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', apiKey: '', apiType: 'openai-completions' as const },
    { name: 'Together', baseUrl: 'https://api.together.xyz/v1', apiKey: '', apiType: 'openai-completions' as const },
  ]

  const existingProviders = Object.keys(providers)

  const applyPreset = (preset: any) => {
    setBaseUrl(preset.baseUrl)
    setApiKey(preset.apiKey)
    setApiType(preset.apiType)
    if (!providerId && preset.baseUrl) {
      try {
        const url = new URL(preset.baseUrl)
        setProviderId(url.host.replace(/\./g, '-'))
      } catch {}
    }
  }

  const handleSubmit = () => {
    // Parse models input (format: "modelId:显示名称" or just "modelId")
    const models: any[] = []
    const lines = modelsInput.trim().split('\n').filter(l => l.trim())
    
    if (lines.length === 0) {
      alert('请至少添加一个模型')
      return
    }

    for (const line of lines) {
      const [id, ...nameParts] = line.split(':')
      const modelId = id.trim()
      const modelName = nameParts.join(':').trim() || modelId
      if (modelId) {
        models.push({
          id: modelId,
          name: modelName,
          reasoning,
          input: ['text'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: parseInt(contextWindow) || 128000,
          maxTokens: parseInt(maxTokens) || 8192,
        })
      }
    }

    if (models.length === 0) {
      alert('请至少添加一个模型')
      return
    }

    const finalProviderId = mode === 'existing' ? selectedProvider : providerId.trim()
    if (!finalProviderId) {
      alert('请选择或输入 Provider ID')
      return
    }

    if (mode === 'new' && !baseUrl.trim()) {
      alert('请输入 Base URL')
      return
    }

    const provider = mode === 'existing' 
      ? providers[selectedProvider]
      : {
          baseUrl: baseUrl.trim(),
          apiKey: apiKey.trim(),
          api: apiType,
        }

    onAdd(finalProviderId, provider, models)
    handleClose()
  }

  const handleClose = () => {
    setMode('new')
    setSelectedProvider('')
    setProviderId('')
    setBaseUrl('')
    setApiKey('')
    setApiType('openai-completions')
    setModelsInput('')
    setContextWindow('128000')
    setMaxTokens('8192')
    setReasoning(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClose}>
      <div className="bg-gray-850 border border-gray-700 rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">新增模型</h3>
          <button onClick={handleClose} className="p-1 hover:bg-gray-700 rounded"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        
        <div className="space-y-4">
          {/* Mode selection: new provider or existing */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">添加到</label>
            <div className="flex gap-2">
              <button 
                onClick={() => setMode('new')} 
                className={`flex-1 py-2 px-3 rounded-lg text-sm border ${mode === 'new' ? 'border-blue-500 bg-blue-500/20 text-blue-400' : 'border-gray-700 bg-gray-800 text-gray-400'}`}>
                新建厂商
              </button>
              <button 
                onClick={() => setMode('existing')} 
                className={`flex-1 py-2 px-3 rounded-lg text-sm border ${mode === 'existing' ? 'border-blue-500 bg-blue-500/20 text-blue-400' : 'border-gray-700 bg-gray-800 text-gray-400'}`}
                disabled={existingProviders.length === 0}>
                已有厂商 {existingProviders.length > 0 && `(${existingProviders.length})`}
              </button>
            </div>
          </div>

          {/* Existing provider selection */}
          {mode === 'existing' ? (
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">选择厂商</label>
              <select 
                value={selectedProvider} 
                onChange={e => setSelectedProvider(e.target.value)}
                className="linear-input w-full">
                <option value="">-- 选择已有厂商 --</option>
                {existingProviders.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          ) : (
            <>
              {/* Provider Presets */}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">快速配置</label>
                <div className="flex flex-wrap gap-2">
                  {providerPresets.map(preset => (
                    <button key={preset.name} onClick={() => applyPreset(preset)} className="px-3 py-1.5 text-xs bg-gray-800 text-gray-300 rounded-lg border border-gray-700 hover:border-blue-500">
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Provider ID */}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">厂商 ID</label>
                <input type="text" value={providerId} onChange={e => setProviderId(e.target.value)} className="linear-input w-full" placeholder="如: openai, groq, my-provider" />
              </div>
              
              {/* Base URL */}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Base URL</label>
                <input type="text" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} className="linear-input w-full" placeholder="https://api.openai.com/v1" />
              </div>
              
              {/* API Type */}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">接口协议</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setApiType('openai-completions')} 
                    className={`flex-1 py-2 px-3 rounded-lg text-sm border ${apiType === 'openai-completions' ? 'border-blue-500 bg-blue-500/20 text-blue-400' : 'border-gray-700 bg-gray-800 text-gray-400'}`}>
                    OpenAI 兼容
                  </button>
                  <button 
                    onClick={() => setApiType('anthropic')} 
                    className={`flex-1 py-2 px-3 rounded-lg text-sm border ${apiType === 'anthropic' ? 'border-purple-500 bg-purple-500/20 text-purple-400' : 'border-gray-700 bg-gray-800 text-gray-400'}`}>
                    Anthropic
                  </button>
                </div>
              </div>
              
              {/* API Key */}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">API Key</label>
                <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="linear-input w-full" placeholder="sk-... 或 anthropic-key" />
              </div>
            </>
          )}
          
          {/* Models Input */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">模型列表</label>
            <textarea 
              value={modelsInput} 
              onChange={e => setModelsInput(e.target.value)} 
              className="linear-input w-full h-32 resize-none font-mono text-sm" 
              placeholder={'格式: 模型ID:显示名称\n例如:\ngpt-4o:GPT-4o\ngpt-4o-mini:GPT-4o Mini\nclaude-sonnet-3-5:Claude 3.5 Sonnet'} />
            <p className="text-xs text-gray-500 mt-1">每行一个模型，格式: ID:显示名称（显示名称可省略）</p>
          </div>
          
          {/* Context Window */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">上下文窗口</label>
              <input type="number" value={contextWindow} onChange={e => setContextWindow(e.target.value)} className="linear-input w-full" placeholder="128000" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">最大输出</label>
              <input type="number" value={maxTokens} onChange={e => setMaxTokens(e.target.value)} className="linear-input w-full" placeholder="8192" />
            </div>
          </div>
          
          {/* Reasoning */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={reasoning} onChange={e => setReasoning(e.target.checked)} className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500" />
              <span className="text-sm text-gray-300">支持推理模型（如 o1, o3, 思考模型）</span>
            </label>
          </div>
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={handleClose} className="linear-btn-secondary">取消</button>
          <button onClick={handleSubmit} className="linear-btn-primary">添加模型</button>
        </div>
      </div>
    </div>
  )
}

const ConversationDetailModal = ({ isOpen, onClose, conversation, messages, projects, onAssign }: {
  isOpen: boolean
  onClose: () => void
  conversation: Conversation | null
  messages: any[]
  projects: Project[]
  onAssign: (convId: number, projectId: number | null) => void
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)

  // Sync selectedProjectId when conversation changes
  useEffect(() => {
    if (conversation) {
      setSelectedProjectId(conversation.project_id || null)
    }
  }, [conversation])

  if (!isOpen || !conversation) return null

  const formatContent = (content: any) => {
    if (Array.isArray(content)) {
      return content.map((c, i) => {
        if (c.type === 'text') return <span key={i}>{c.text}</span>
        if (c.type === 'image') return <img key={i} src={c.url} className="max-w-full rounded" />
        return null
      })
    }
    return String(content || '')
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-850 border border-gray-700 rounded-xl w-full max-w-3xl p-6 max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white truncate">{conversation.title}</h3>
            <p className="text-xs text-gray-500">
              {conversation.agent_id} · {new Date(conversation.created_at).toLocaleString('zh-CN')}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded ml-4"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        
        {/* Project assignment */}
        <div className="flex items-center gap-2 mb-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
          <span className="text-sm text-gray-400">分配项目：</span>
          <select 
            value={selectedProjectId || ''} 
            onChange={e => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
            className="linear-input text-sm flex-1"
          >
            <option value="">未分类</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
            ))}
          </select>
          <button 
            onClick={() => onAssign(conversation.id, selectedProjectId)}
            className="linear-btn-primary text-sm px-3 py-1"
          >
            保存
          </button>
        </div>
        
        {/* Messages */}
        <div className="flex-1 overflow-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">暂无消息内容</div>
          ) : (
            messages.map((msg, idx) => (
              <div key={msg.id || idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-800 text-gray-200'
                }`}>
                  <div className="text-xs opacity-70 mb-1">
                    {msg.role === 'user' ? '👤 用户' : '🤖 AI'}
                  </div>
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {formatContent(msg.content)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// Helper function to get short description
function getShortDescription(description: string): string {
  if (!description) return '暂无描述'
  if (description.length <= 60) return description
  return description.substring(0, 60) + '...'
}

// Edit Model Modal
function EditModelModal({ isOpen, onClose, onUpdate, providerId, model }: {
  isOpen: boolean
  onClose: () => void
  onUpdate: (providerId: string, modelId: string, data: any) => void
  providerId: string
  model: any
}) {
  const [contextWindow, setContextWindow] = useState(String(model?.contextWindow || 128000))
  const [maxTokens, setMaxTokens] = useState(String(model?.maxTokens || 8192))
  const [inputText, setInputText] = useState(model?.input?.includes('text') || false)
  const [inputImage, setInputImage] = useState(model?.input?.includes('image') || false)
  const [reasoning, setReasoning] = useState(model?.reasoning || false)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-850 border border-gray-700 rounded-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">编辑模型参数</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">上下文窗口（tokens）</label>
            <input type="number" value={contextWindow} onChange={e => setContextWindow(e.target.value)} className="linear-input w-full" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">最大输出（tokens）</label>
            <input type="number" value={maxTokens} onChange={e => setMaxTokens(e.target.value)} className="linear-input w-full" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">输入类型</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={inputText} onChange={e => setInputText(e.target.checked)} className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500" />
                <span className="text-sm text-gray-300">文本</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={inputImage} onChange={e => setInputImage(e.target.checked)} className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500" />
                <span className="text-sm text-gray-300">图片</span>
              </label>
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={reasoning} onChange={e => setReasoning(e.target.checked)} className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500" />
              <span className="text-sm text-gray-300">推理模型</span>
            </label>
          </div>
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="linear-btn-secondary">取消</button>
          <button onClick={() => {
            const input: string[] = []
            if (inputText) input.push('text')
            if (inputImage) input.push('image')
            onUpdate(providerId, model.id, {
              contextWindow: parseInt(contextWindow) || 128000,
              maxTokens: parseInt(maxTokens) || 8192,
              input,
              reasoning,
            })
          }} className="linear-btn-primary">保存</button>
        </div>
      </div>
    </div>
  )
}

// Skill Detail Modal
const SkillDetailModal = ({ skill, agents, installedSkillsByAgent, onClose, onCopySuccess, onDeleteSuccess }: { 
  skill: { name: string; description: string; directory: string; sourceAgentId: string; sourceAgentName: string } | null
  agents: any[]
  installedSkillsByAgent: {agentId: string; agentName: string; skills: any[]}[]
  onClose: () => void
  onCopySuccess: () => void
  onDeleteSuccess: () => void
}) => {
  const [selectedTargets, setSelectedTargets] = useState<string[]>([])
  const [isCopying, setIsCopying] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  if (!skill) return null

  // Get other agents that don't have this skill yet
  const otherAgents = agents.filter(a => {
    // Exclude source agent
    if (a.id === skill.sourceAgentId) return false
    // Check if this agent already has the skill
    const agentData = installedSkillsByAgent.find(ag => ag.agentId === a.id)
    if (!agentData) return true
    return !agentData.skills.some((s: any) => s.directory === skill.directory)
  })

  const toggleTarget = (agentId: string) => {
    setSelectedTargets(prev => 
      prev.includes(agentId) 
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    )
  }

  const handleCopy = async () => {
    if (selectedTargets.length === 0) {
      alert('请选择要复制到的目标 Agent')
      return
    }
    setIsCopying(true)
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'copy',
          skillDir: skill.directory,
          sourceAgentId: skill.sourceAgentId,
          targetAgentIds: selectedTargets
        })
      })
      const data = await res.json()
      alert(data.message)
      if (data.success) {
        setSelectedTargets([])
        onCopySuccess()
        onClose()
      }
    } catch (e) {
      alert('复制失败')
    }
    setIsCopying(false)
  }

  const handleDelete = async () => {
    if (!confirm(`确定要从 "${skill.sourceAgentName}" 删除技能 "${skill.name}" 吗？此操作不可恢复。`)) return
    setIsDeleting(true)
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          skillDir: skill.directory,
          agentId: skill.sourceAgentId
        })
      })
      const data = await res.json()
      alert(data.message)
      if (data.success) {
        onDeleteSuccess()
        onClose()
      }
    } catch (e) {
      alert('删除失败')
    }
    setIsDeleting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-lg border border-gray-700" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-green-400" />
            {skill.name}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">技能标识</label>
            <p className="text-white font-mono text-sm bg-gray-900/50 px-3 py-2 rounded">{skill.directory}</p>
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">所属 Agent</label>
            <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-400 text-sm rounded-lg">{skill.sourceAgentName}</span>
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">详细说明</label>
            <p className="text-white text-sm bg-gray-900/50 px-3 py-2 rounded whitespace-pre-wrap max-h-40 overflow-y-auto">{skill.description || '暂无描述'}</p>
          </div>
          
          {/* Copy to other agents */}
          {otherAgents.length > 0 && (
            <div>
              <label className="text-sm text-gray-400 mb-2 block">复制到其他 Agent</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {otherAgents.map(a => (
                  <button
                    key={a.id}
                    onClick={() => toggleTarget(a.id)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      selectedTargets.includes(a.id)
                        ? 'bg-green-500/30 text-green-400 border border-green-500/50'
                        : 'bg-gray-700 text-gray-300 border border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    {a.identityEmoji} {a.identityName}
                  </button>
                ))}
              </div>
              <button
                onClick={handleCopy}
                disabled={isCopying || selectedTargets.length === 0}
                className="w-full px-4 py-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCopying ? '复制中...' : `复制到 ${selectedTargets.length} 个 Agent`}
              </button>
            </div>
          )}
          
          {/* Delete skill */}
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors disabled:opacity-50"
          >
            {isDeleting ? '删除中...' : `从 ${skill.sourceAgentName} 删除此技能`}
          </button>
        </div>
      </div>
    </div>
  )
}

const ProjectHistoryModal = ({ isOpen, onClose, project, history }: {
  isOpen: boolean; onClose: () => void; project: Project | null; history: ProjectHistory[]
}) => {
  if (!isOpen || !project) return null

  const actionLabels: Record<string, { label: string; color: string }> = {
    created: { label: '创建', color: 'bg-green-500/20 text-green-400' },
    updated: { label: '更新', color: 'bg-blue-500/20 text-blue-400' },
    deleted: { label: '删除', color: 'bg-red-500/20 text-red-400' },
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-850 border border-gray-700 rounded-xl w-full max-w-lg p-6 max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{project.emoji}</span>
            <div>
              <h3 className="text-lg font-semibold text-white">{project.name}</h3>
              <p className="text-xs text-gray-500">项目历史记录</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="flex-1 overflow-auto space-y-3">
          {history.length === 0 ? (
            <div className="text-center py-8 text-gray-500">暂无历史记录</div>
          ) : (
            history.map(item => (
              <div key={item.id} className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 text-xs rounded ${actionLabels[item.action]?.color || 'bg-gray-500/20 text-gray-400'}`}>
                    {actionLabels[item.action]?.label || item.action}
                  </span>
                  <span className="text-xs text-gray-500">
                    {item.actor_type === 'human' ? '👤' : item.actor_type === 'ai' ? '🤖' : '⚙️'} {item.actor_name}
                  </span>
                  <span className="text-xs text-gray-600 ml-auto">
                    {new Date(item.created_at).toLocaleString('zh-CN')}
                  </span>
                </div>
                <p className="text-sm text-gray-300">{item.description}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

const ProjectCard = ({ project, onDelete, onShowHistory }: { project: Project; onDelete: (id: number) => void; onShowHistory: (project: Project) => void }) => {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-5 hover:border-gray-700">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{project.emoji}</span>
          <div>
            <h3 className="text-white font-medium">{project.name}</h3>
            <p className="text-xs text-gray-500">{project.agent_name ? `负责人: ${project.agent_name}` : '未分配'}</p>
          </div>
        </div>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-1 hover:bg-gray-700 rounded"><MoreHorizontal className="w-4 h-4 text-gray-500" /></button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10">
              <button onClick={() => { onShowHistory(project); setShowMenu(false) }} className="w-full px-3 py-2 text-sm text-left text-gray-300 hover:bg-gray-700 flex items-center gap-2">
                <Clock className="w-4 h-4" />历史记录
              </button>
              <button onClick={() => { if(confirm('确定删除此项目？项目内容将全部删除！')) { onDelete(project.id) }; setShowMenu(false) }} className="w-full px-3 py-2 text-sm text-left text-red-400 hover:bg-gray-700 flex items-center gap-2">
                <Trash2 className="w-4 h-4" />删除项目
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="text-sm text-gray-400 mb-4">{project.description}</p>
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-500">进度</span>
          <span className="text-white">{project.progress}%</span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" style={{ width: `${project.progress}%` }} />
        </div>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className={`px-2 py-1 rounded text-xs ${project.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
          {project.status === 'active' ? '进行中' : project.status}
        </span>
        <span className="text-gray-500">{project.agent_id ? `🤖 ${project.agent_name}` : ''}</span>
      </div>
    </div>
  )
}

const TaskCard = ({ task, onDelete }: { task: Task; onDelete: (id: number) => void }) => {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div className="bg-gray-850 border border-gray-700 rounded-lg p-3 hover:border-gray-600 group relative">
      <div className="flex items-start justify-between mb-2">
        <PriorityBadge priority={task.priority} />
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-1 hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100">
            <MoreHorizontal className="w-4 h-4 text-gray-500" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-32 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10">
              <button onClick={() => { if(confirm('确定删除此任务？')) { onDelete(task.id) }; setShowMenu(false) }} className="w-full px-3 py-2 text-sm text-left text-red-400 hover:bg-gray-700 flex items-center gap-2">
                <Trash2 className="w-4 h-4" />删除
              </button>
            </div>
          )}
        </div>
      </div>
      <h4 className="text-sm text-white font-medium mb-2">{task.title}</h4>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-base">{task.assignee_type === 'ai' ? '🤖' : '👤'}</span>
          <span className="text-xs text-gray-500">{task.assignee_name}</span>
        </div>
        {task.due_date && <span className="text-xs text-gray-500">{task.due_date}</span>}
      </div>
    </div>
  )
}

const AgentCard = ({ agent, onModelChange, onDelete, channels, onChannelChange, onEditSoul, onEditInfo }: { 
  agent: Agent; 
  onModelChange: (agentId: string, newModel: string) => void
  onDelete: (agentId: string) => void
  channels: Channel[]
  onChannelChange: (agentId: string, newChannel: string) => void
  onEditSoul: (agent: Agent) => void
  onEditInfo: (agent: Agent) => void
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [selectedModel, setSelectedModel] = useState(agent.model)
  const [showMenu, setShowMenu] = useState(false)
  const [isEditingChannel, setIsEditingChannel] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState(agent.boundChannel || '')
  const [allModels, setAllModels] = useState<{ value: string; label: string }[]>([])

  // Fetch models from API on mount
  useEffect(() => {
    fetch('/api/models')
      .then(res => res.json())
      .then(data => {
        if (data.models && data.models.length > 0) {
          setAllModels(data.models)
        }
      })
      .catch(console.error)
  }, [])

  const handleSave = () => {
    onModelChange(agent.id, selectedModel)
    setIsEditing(false)
  }

  const handleChannelSave = () => {
    onChannelChange(agent.id, selectedChannel)
    setIsEditingChannel(false)
  }

  // Get available channels:
  // - If this agent already has a channel bound, only show that channel (to allow unbinding)
  // - If no channel bound, show only unassigned channels
  const availableChannels = agent.boundChannel 
    ? channels.filter(c => c.id === agent.boundChannel)
    : channels.filter(c => !c.agentId)

  return (
    <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center text-2xl">
            {agent.identityEmoji}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-white">{agent.identityName}</h3>
              {agent.isDefault && <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded-full">默认</span>}
            </div>
            <p className="text-sm text-gray-500">{agent.id}</p>
          </div>
        </div>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-2 hover:bg-gray-700 rounded-lg">
            <MoreHorizontal className="w-5 h-5 text-gray-500" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10">
              <button onClick={() => { setIsEditing(true); setShowMenu(false) }} className="w-full px-3 py-2 text-sm text-left text-gray-300 hover:bg-gray-700 flex items-center gap-2">
                <Edit3 className="w-4 h-4" />编辑模型
              </button>
              <button onClick={() => { setIsEditingChannel(true); setSelectedChannel(agent.boundChannel || ''); setShowMenu(false) }} className="w-full px-3 py-2 text-sm text-left text-gray-300 hover:bg-gray-700 flex items-center gap-2">
                <Network className="w-4 h-4" />绑定渠道
              </button>
              <button onClick={() => { onEditSoul(agent); setShowMenu(false) }} className="w-full px-3 py-2 text-sm text-left text-gray-300 hover:bg-gray-700 flex items-center gap-2">
                <Brain className="w-4 h-4" />编辑人格
              </button>
              <button onClick={() => { onEditInfo(agent); setShowMenu(false) }} className="w-full px-3 py-2 text-sm text-left text-gray-300 hover:bg-gray-700 flex items-center gap-2">
                <Bot className="w-4 h-4" />编辑名称/头像
              </button>
              {!agent.isDefault && (
                <button onClick={() => { if(confirm('确定删除此员工？工作文件夹也将被删除！')) { onDelete(agent.id) }; setShowMenu(false) }} className="w-full px-3 py-2 text-sm text-left text-red-400 hover:bg-gray-700 flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />删除员工
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-400 mb-4">
        {agent.id === 'main' ? '主要助手，负责日常对话、文档处理、飞书/钉钉通讯' : '编码专家，专注于代码开发和技术任务'}
      </p>

      {/* Model Section */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-2">模型</p>
        {isEditing ? (
          <div className="space-y-2">
            <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} className="linear-input w-full text-sm">
              {allModels.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={handleSave} className="flex-1 py-1.5 bg-blue-500 text-white rounded-md text-sm">保存</button>
              <button onClick={() => setIsEditing(false)} className="flex-1 py-1.5 bg-gray-700 text-gray-300 rounded-md text-sm">取消</button>
            </div>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-850 rounded-lg border border-gray-700">
            <Terminal className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-white font-mono">{agent.model}</span>
            <button onClick={() => setIsEditing(true)} className="ml-2 p-1 hover:bg-gray-700 rounded"><Edit3 className="w-3 h-3 text-gray-500" /></button>
          </div>
        )}
      </div>

      {/* Channel Binding Section */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-2">绑定渠道</p>
        {isEditingChannel ? (
          <div className="space-y-2">
            <select value={selectedChannel} onChange={e => setSelectedChannel(e.target.value)} className="linear-input w-full text-sm">
              <option value="">不绑定</option>
              {availableChannels.map(c => (
                <option key={c.id} value={c.id}>{c.displayName}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={handleChannelSave} className="flex-1 py-1.5 bg-blue-500 text-white rounded-md text-sm">保存</button>
              <button onClick={() => setIsEditingChannel(false)} className="flex-1 py-1.5 bg-gray-700 text-gray-300 rounded-md text-sm">取消</button>
            </div>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-850 rounded-lg border border-gray-700">
            <Network className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-white">{agent.boundChannel || '未绑定'}</span>
            <button onClick={() => setIsEditingChannel(true)} className="ml-2 p-1 hover:bg-gray-700 rounded"><Edit3 className="w-3 h-3 text-gray-500" /></button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {(agentSkills[agent.id] || []).map(skill => (
          <span key={skill.name} className="px-2.5 py-1 text-xs bg-gray-800 text-gray-300 rounded-md border border-gray-700" title={skill.desc}>
            {skill.name}
          </span>
        ))}
      </div>
    </div>
  )
}

// Agent Groups View Component
function AgentGroupsView({ 
  agents, 
  groups, 
  channels,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onModelChange,
  onDeleteAgent,
  onChannelChange,
  onEditSoul,
  onEditInfo
}: { 
  agents: Agent[]
  groups: {id: number; name: string; emoji: string; color: string; sortOrder: number; agentIds: string[]}[]
  channels: Channel[]
  onCreateGroup: (data: { name: string; emoji: string; color: string; agentIds: string[] }) => void
  onUpdateGroup: (data: { id: number; name: string; emoji: string; color: string; agentIds: string[] }) => void
  onDeleteGroup: (id: number) => void
  onModelChange: (agentId: string, newModel: string) => void
  onDeleteAgent: (agentId: string) => void
  onChannelChange: (agentId: string, newChannel: string) => void
  onEditSoul: (agent: Agent) => void
  onEditInfo: (agent: Agent) => void
}) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<typeof groups[0] | null>(null)
  const [groupName, setGroupName] = useState('')
  const [groupEmoji, setGroupEmoji] = useState('📁')
  const [groupColor, setGroupColor] = useState('#6366f1')
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([])
  const emojis = ['📁', '🚀', '⚙️', '💬', '🔄', '📚', '🎯', '💡', '📊', '🎨', '🔧', '📱', '🤖', '👥', '⭐', '🔥']
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6']

  // Get ungrouped agents (agents not in any group)
  const groupedAgentIds = groups.flatMap(g => g.agentIds)
  const ungroupedAgents = agents.filter(a => !groupedAgentIds.includes(a.id))

  const openCreateModal = () => {
    setEditingGroup(null)
    setGroupName('')
    setGroupEmoji('📁')
    setGroupColor('#6366f1')
    setSelectedAgentIds([])
    setShowCreateModal(true)
  }

  const openEditModal = (group: typeof groups[0]) => {
    setEditingGroup(group)
    setGroupName(group.name)
    setGroupEmoji(group.emoji)
    setGroupColor(group.color)
    setSelectedAgentIds(group.agentIds)
    setShowCreateModal(true)
  }

  const handleSave = () => {
    if (!groupName.trim()) return
    if (editingGroup) {
      onUpdateGroup({ id: editingGroup.id, name: groupName, emoji: groupEmoji, color: groupColor, agentIds: selectedAgentIds })
    } else {
      onCreateGroup({ name: groupName, emoji: groupEmoji, color: groupColor, agentIds: selectedAgentIds })
    }
    setShowCreateModal(false)
  }

  const toggleAgent = (agentId: string) => {
    setSelectedAgentIds(prev => 
      prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]
    )
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header with create button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FolderTree className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">员工分组</h2>
          <span className="text-sm text-gray-500">({groups.length} 个分组, {ungroupedAgents.length} 个未分组)</span>
        </div>
        <button onClick={openCreateModal} className="linear-btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />新建分组
        </button>
      </div>

      {/* Groups */}
      <div className="space-y-6">
        {groups.map(group => {
          const groupAgents = agents.filter(a => group.agentIds.includes(a.id))
          return (
            <div key={group.id} className="bg-gray-900/30 rounded-xl border border-gray-800 p-4">
              {/* Group Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ backgroundColor: group.color + '20', border: `1px solid ${group.color}40` }}>
                    {group.emoji}
                  </div>
                  <div>
                    <h3 className="text-white font-medium">{group.name}</h3>
                    <p className="text-xs text-gray-500">{groupAgents.length} 个员工</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEditModal(group)} className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => onDeleteGroup(group.id)} className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {/* Group Agents Grid */}
              {groupAgents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {groupAgents.map(agent => (
                    <AgentCard key={agent.id} agent={agent} onModelChange={onModelChange} onDelete={onDeleteAgent} channels={channels} onChannelChange={onChannelChange} onEditSoul={onEditSoul} onEditInfo={onEditInfo} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">分组中暂无员工</p>
              )}
            </div>
          )
        })}

        {/* Ungrouped Agents */}
        {ungroupedAgents.length > 0 && (
          <div className="bg-gray-900/30 rounded-xl border border-gray-800 border-dashed p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-700/50 text-xl">
                ❓
              </div>
              <div>
                <h3 className="text-white font-medium">未分组</h3>
                <p className="text-xs text-gray-500">{ungroupedAgents.length} 个员工</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {ungroupedAgents.map(agent => (
                <AgentCard key={agent.id} agent={agent} onModelChange={onModelChange} onDelete={onDeleteAgent} channels={channels} onChannelChange={onChannelChange} onEditSoul={onEditSoul} onEditInfo={onEditInfo} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-gray-850 border border-gray-700 rounded-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">{editingGroup ? '编辑分组' : '新建分组'}</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-gray-700 rounded"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">分组名称</label>
                <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)} className="linear-input w-full" placeholder="输入分组名称..." />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">图标</label>
                <div className="flex flex-wrap gap-2">
                  {emojis.map(e => (
                    <button key={e} onClick={() => setGroupEmoji(e)} className={`w-10 h-10 text-xl rounded-lg border ${groupEmoji === e ? 'border-blue-500 bg-blue-500/20' : 'border-gray-700 bg-gray-800'}`}>{e}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">颜色</label>
                <div className="flex flex-wrap gap-2">
                  {colors.map(c => (
                    <button key={c} onClick={() => setGroupColor(c)} className={`w-8 h-8 rounded-lg ${groupColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-850' : ''}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">成员 ({selectedAgentIds.length} 个已选)</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {agents.map(agent => (
                    <button key={agent.id} onClick={() => toggleAgent(agent.id)} className={`flex items-center gap-2 p-2 rounded-lg border text-left ${selectedAgentIds.includes(agent.id) ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 bg-gray-800'}`}>
                      <span>{agent.identityEmoji}</span>
                      <span className="text-sm text-white truncate">{agent.identityName}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)} className="linear-btn-secondary">取消</button>
              <button onClick={handleSave} className="linear-btn-primary">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getChannelDisplayName(channelType: string): string {
  const names: Record<string, string> = {
    feishu: '飞书',
    'feishu-connector': '飞书',
    'dingtalk-connector': '钉钉',
    dingtalk: '钉钉',
    telegram: 'Telegram',
    discord: 'Discord',
    whatsapp: 'WhatsApp',
    slack: 'Slack',
    wechat: '微信',
  }
  return names[channelType] || channelType
}

function Edit3({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
}

export default function MissionControl() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('inbox')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeTaskColumn, setActiveTaskColumn] = useState<string>('backlog')
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentGroups, setAgentGroups] = useState<{id: number; name: string; emoji: string; color: string; sortOrder: number; agentIds: string[]}[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [installedSkillsByAgent, setInstalledSkillsByAgent] = useState<{agentId: string; agentName: string; skills: any[]}[]>([])
  const [clawhubQuery, setClawhubQuery] = useState('')
  const [clawhubResults, setClawhubResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)
  const [skillsTab, setSkillsTab] = useState<'installed' | 'search'>('installed')
  const [modelsConfig, setModelsConfig] = useState<{mode: string; models: any[]; providers: any}>({ mode: 'merge', models: [], providers: {} })
  const [showAddModelModal, setShowAddModelModal] = useState(false)
  const [showEditModelModal, setShowEditModelModal] = useState(false)
  const [editingModel, setEditingModel] = useState<{providerId: string, model: any} | null>(null)
  const [selectedSkill, setSelectedSkill] = useState<{name: string; description: string; directory: string; sourceAgentId: string; sourceAgentName: string} | null>(null)
  const [copyTargetAgents, setCopyTargetAgents] = useState<string[]>([])
  const [isCopying, setIsCopying] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [installToAllAgents, setInstallToAllAgents] = useState(true)
  const [selectedInstallTargets, setSelectedInstallTargets] = useState<string[]>([])
  const [showClawhubSettings, setShowClawhubSettings] = useState(false)
  const [clawhubApiToken, setClawhubApiToken] = useState('')
  const [isSavingToken, setIsSavingToken] = useState(false)
  const [clawhubLoggedIn, setClawhubLoggedIn] = useState(false)
  const [clawhubUser, setClawhubUser] = useState<string | null>(null)
  const [installDropdownOpen, setInstallDropdownOpen] = useState<string | null>(null)
  const [tempInstallTargets, setTempInstallTargets] = useState<string[]>([])
  const [memories, setMemories] = useState<MemoryEntry[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false)
  const [showCreateAgentModal, setShowCreateAgentModal] = useState(false)
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false)
  const [activityExpanded, setActivityExpanded] = useState(true)
  const [currentUser, setCurrentUser] = useState<{ username: string; displayName: string } | null>(null)
  const [projectName, setProjectName] = useState('Mission Control')
  const [projectNameLoaded, setProjectNameLoaded] = useState(false)
  const [memoryFilter, setMemoryFilter] = useState<MemoryFilter>('all')
  const [memoryAgentFilter, setMemoryAgentFilter] = useState<string>('all')
  const [apiStatus, setApiStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [cronJobs, setCronJobs] = useState<CronJob[]>([])
  const [showCreateCronModal, setShowCreateCronModal] = useState(false)
  const [projectHistory, setProjectHistory] = useState<ProjectHistory[]>([])
  const [selectedProjectForHistory, setSelectedProjectForHistory] = useState<Project | null>(null)
  const [showProjectHistoryModal, setShowProjectHistoryModal] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationFilter, setConversationFilter] = useState<{ projectId?: number; agentId?: string }>({})
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [showConversationDetail, setShowConversationDetail] = useState(false)
  const [conversationMessages, setConversationMessages] = useState<any[]>([])
  const [realtimeSessions, setRealtimeSessions] = useState<any[]>([])
  const [realtimeTasks, setRealtimeTasks] = useState<any[]>([])
  const [selectedSession, setSelectedSession] = useState<any | null>(null)
  const [sessionMessages, setSessionMessages] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [logSubsystems, setLogSubsystems] = useState<string[]>([])
  const [logFilter, setLogFilter] = useState<{ level?: string; subsystem?: string; search?: string }>({})
  const [showSessionDetail, setShowSessionDetail] = useState(false)
  const [sessionFilter, setSessionFilter] = useState<{ projectId?: number; agentId?: string }>({})
  const [customTags, setCustomTags] = useState<string[]>([])
  const [editingSoulAgent, setEditingSoulAgent] = useState<Agent | null>(null)
  const [editingAgentInfo, setEditingAgentInfo] = useState<{agent: Agent; name: string; emoji: string} | null>(null)
  const [activeEditTab, setActiveEditTab] = useState<'agents' | 'soul' | 'user'>('soul')
  const [agentsForm, setAgentsForm] = useState({
    sessionStartup: '',
    memory: '',
    redLines: '',
    externalVsInternal: '',
    groupChat: '',
    heartbeat: '',
    tools: '',
  })
  const [soulForm, setSoulForm] = useState({ coreTruths: '', boundaries: '', vibe: '', continuity: '' })
  const [userForm, setUserForm] = useState({ name: '', callName: '', pronouns: '', timezone: '', notes: '', context: '' })

  // Approvals state
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([])
  const [approvalHistory, setApprovalHistory] = useState<any[]>([])
  const [approvalTab, setApprovalTab] = useState<'pending' | 'history'>('pending')
  const [isResolvingApproval, setIsResolvingApproval] = useState(false)

  // Usage state
  const [usageData, setUsageData] = useState<{
    total: { inputTokens: number; outputTokens: number; cacheRead: number; cacheWrite: number; totalTokens: number; cost: number }
    totalSessions: number
    agents: any[]
    models: any[]
    daily: any[]
    hourly: any[]
    monthly: any[]
  } | null>(null)

  const getCookie = (name: string): string | null => {
    if (typeof document === 'undefined') return null
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
    return match ? decodeURIComponent(match[2]) : null
  }

  useEffect(() => {
    const auth = getCookie('mc-auth')
    const userStr = getCookie('mc-user')
    if (auth === 'true' && userStr) {
      try {
        setCurrentUser(JSON.parse(decodeURIComponent(userStr)))
      } catch { router.push('/login') }
    } else { router.push('/login') }
    
    // Load project name from cookie immediately
    const savedProjectName = getCookie('mc-project-name')
    if (savedProjectName) {
      setProjectName(savedProjectName)
      setProjectNameLoaded(true)
    }
  }, [router])

  // Load logs when switching to logs tab
  useEffect(() => {
    if (activeTab === 'logs' && logs.length === 0) {
      fetchLogs()
    }
  }, [activeTab])

  // Load approvals when switching to approvals tab
  useEffect(() => {
    if (activeTab === 'approvals') {
      if (approvalTab === 'pending') {
        fetch('/api/approvals')
          .then(res => res.json())
          .then(data => { if (data.approvals) setPendingApprovals(data.approvals) })
          .catch(console.error)
      } else {
        fetch('/api/approvals?history=true')
          .then(res => res.json())
          .then(data => { if (data.approvals) setApprovalHistory(data.approvals) })
          .catch(console.error)
      }
    }
  }, [activeTab, approvalTab])

  // Load skills when switching to skills tab
  const fetchInstalledSkills = async () => {
    try {
      const res = await fetch('/api/skills?action=list')
      const data = await res.json()
      if (data.success) {
        setInstalledSkillsByAgent(data.skills)
      }
    } catch (e) { console.error('Failed to fetch skills', e) }
  }

  // Fetch ClawHub status
  const fetchClawhubStatus = async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      if (data.clawhubLoggedIn !== undefined) {
        setClawhubLoggedIn(data.clawhubLoggedIn)
        setClawhubUser(data.clawhubUser)
      }
    } catch (e) { console.error('Failed to fetch clawhub status', e) }
  }

  useEffect(() => {
    if (activeTab === 'skills') {
      fetchInstalledSkills()
      fetchClawhubStatus()
    }
  }, [activeTab])

  const handleSearchClawhub = async () => {
    if (!clawhubQuery.trim()) return
    setIsSearching(true)
    setClawhubResults([])
    try {
      const params = new URLSearchParams({ action: 'search', query: clawhubQuery })
      if (clawhubApiToken) {
        params.set('apiToken', clawhubApiToken)
      }
      const res = await fetch(`/api/skills?${params}`)
      const data = await res.json()
      if (data.success) setClawhubResults(data.results)
    } catch (e) { console.error('Search failed', e) }
    setIsSearching(false)
  }

  const handleInstallSkill = async (skillName: string) => {
    const targets = installToAllAgents ? 'all' : selectedInstallTargets
    if (!installToAllAgents && selectedInstallTargets.length === 0) {
      alert('请选择要安装的目标 Agent')
      return
    }
    const targetMsg = installToAllAgents ? '所有 Agent' : `${selectedInstallTargets.length} 个 Agent`
    if (!confirm(`确定要安装 "${skillName}" 到 ${targetMsg} 吗？`)) return
    setIsInstalling(true)
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'install', skillName, targetAgents: targets })
      })
      const data = await res.json()
      alert(data.message)
      if (data.success) {
        setClawhubResults([])
        setClawhubQuery('')
        fetchInstalledSkills()
      }
    } catch (e) { alert('安装失败') }
    setIsInstalling(false)
  }

  const handleSaveClawhubToken = async () => {
    if (!clawhubApiToken.trim()) {
      alert('请输入 API Token')
      return
    }
    setIsSavingToken(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clawhubApiToken: clawhubApiToken.trim() })
      })
      const data = await res.json()
      if (data.success) {
        alert('ClawHub API Token 配置成功！')
        setShowClawhubSettings(false)
        setClawhubApiToken('')
        fetchClawhubStatus()
      } else {
        alert(data.error || '配置失败')
      }
    } catch (e) { alert('配置请求失败') }
    setIsSavingToken(false)
  }

  const toggleInstallTarget = (agentId: string) => {
    setSelectedInstallTargets(prev =>
      prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]
    )
  }

  const handleOpenInstallDropdown = (skillName: string) => {
    setInstallDropdownOpen(skillName)
    setTempInstallTargets(installToAllAgents ? agents.map(a => a.id) : selectedInstallTargets)
  }

  const handleCloseInstallDropdown = () => {
    setInstallDropdownOpen(null)
    setTempInstallTargets([])
  }

  const handleConfirmInstall = async (skillName: string) => {
    setInstallToAllAgents(tempInstallTargets.length === agents.length)
    setSelectedInstallTargets(tempInstallTargets.length === agents.length ? [] : tempInstallTargets)
    setInstallDropdownOpen(null)
    // Now install
    if (!installToAllAgents && selectedInstallTargets.length === 0) {
      alert('请选择要安装的目标 Agent')
      return
    }
    const targetMsg = installToAllAgents ? '所有 Agent' : `${selectedInstallTargets.length} 个 Agent`
    if (!confirm(`确定要安装 "${skillName}" 到 ${targetMsg} 吗？`)) return
    setIsInstalling(true)
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'install', skillName, targetAgents: installToAllAgents ? 'all' : selectedInstallTargets })
      })
      const data = await res.json()
      alert(data.message)
      if (data.success) {
        setClawhubResults([])
        setClawhubQuery('')
        fetchInstalledSkills()
      }
    } catch (e) { alert('安装失败') }
    setIsInstalling(false)
  }

  const toggleTempTarget = (agentId: string) => {
    setTempInstallTargets(prev =>
      prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]
    )
  }

  const handleSelectAllAgents = () => {
    if (tempInstallTargets.length === agents.length) {
      setTempInstallTargets([])
    } else {
      setTempInstallTargets(agents.map(a => a.id))
    }
  }

  const fetchLogs = async () => {
    const params = new URLSearchParams()
    if (logFilter.level) params.set('level', logFilter.level)
    if (logFilter.subsystem) params.set('subsystem', logFilter.subsystem)
    if (logFilter.search) params.set('search', logFilter.search)
    params.set('limit', '500')
    try {
      const res = await fetch(`/api/logs?${params}`)
      const data = await res.json()
      setLogs(data.logs || [])
      if (data.subsystems) setLogSubsystems(data.subsystems)
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    }
  }

  // Fast fetch with timeout - optimized for speed
  const fastFetch = async (url: string, timeout = 5000) => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log(`Fetch timeout for ${url}`)
      }
      return null
    }
  }

  // Tab data fetching configuration - single source of truth for all tab data loading
  // Add new tabs here to enable lazy loading
  const TAB_DATA_CONFIG: Record<string, () => void> = {
    realtime: () => {
      fastFetch('/api/realtime-tasks').then(data => { if (data?.tasks) setRealtimeTasks(data.tasks) })
      fastFetch('/api/sessions').then(data => { if (Array.isArray(data)) setRealtimeSessions(data) })
    },
    timing: () => {
      fastFetch('/api/cron').then(data => { if (data?.jobs) setCronJobs(data.jobs) })
    },
    models: () => {
      fastFetch('/api/models-config').then(data => { if (data?.models) setModelsConfig(data) })
    },
    memory: () => {
      fastFetch('/api/memory').then(data => { if (Array.isArray(data)) setMemories(data) })
    },
    channels: () => {
      fastFetch('/api/channels').then(data => { if (Array.isArray(data)) setChannels(data) })
    },
    usage: () => {
      fastFetch('/api/usage').then(data => { if (data?.total !== undefined) setUsageData(data) })
    },
  }

  // Unified tab data loading - automatically handles all configured tabs
  useEffect(() => {
    const fetcher = TAB_DATA_CONFIG[activeTab]
    if (fetcher) fetcher()
  }, [activeTab])

  // Core data: fetch on mount for fast initial page render
  const fetchData = () => {
    setApiStatus('connected')
    Promise.all([
      fastFetch('/api/tasks').then(data => { if (Array.isArray(data)) setTasks(data) }),
      fastFetch('/api/projects').then(data => { if (Array.isArray(data)) setProjects(data) }),
      fastFetch('/api/agents').then(data => { 
        if (data?.agents) setAgents(data.agents)
        if (data?.skills) setSkills(data.skills)
      }),
      fastFetch('/api/settings').then(data => {
        if (data?.projectName) {
          setProjectName(data.projectName)
          setProjectNameLoaded(true)
          document.title = data.projectName
        }
      }),
    ]).catch(e => console.error('Core data fetch error', e))
  }

  useEffect(() => { 
    fetchData()
  }, [])

  const handleLogout = () => {
    document.cookie = 'mc-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
    document.cookie = 'mc-user=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
    router.push('/login')
  }

  const handleCreateTask = async (taskData: Partial<Task>) => {
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      })
      fetchData()
    } catch (error) { console.error('Failed to create task:', error) }
  }

  const handleCreateProject = async (projectData: Partial<Project>) => {
    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
      })
      fetchData()
    } catch (error) { console.error('Failed to create project:', error) }
  }

  const handleCreateAgent = async (agentData: { id: string; name: string; model: string; boundChannel?: string }) => {
    try {
      await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentData),
      })
      fetchData()
    } catch (error) { console.error('Failed to create agent:', error) }
  }

  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    e.dataTransfer.setData('taskId', String(taskId))
  }

  const handleDrop = async (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('taskId')
    if (!taskId) return
    try {
      await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: parseInt(taskId), status }),
      })
      fetchData()
    } catch (error) { console.error('Failed to update task:', error) }
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault() }

  const handleModelChange = async (agentId: string, newModel: string) => {
    try {
      // Update via API
      await fetch('/api/agents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: agentId, model: newModel }),
      })
      // Update local state
      setAgents(agents.map(a => a.id === agentId ? { ...a, model: newModel } : a))
    } catch (error) {
      console.error('Failed to update model:', error)
      alert('保存失败，请重试')
    }
  }

  const handleChannelChange = async (agentId: string, newChannel: string) => {
    try {
      await fetch('/api/agents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: agentId, boundChannel: newChannel || null }),
      })
      // Update local state
      setAgents(agents.map(a => a.id === agentId ? { ...a, boundChannel: newChannel || null } : a))
      // Update channels state
      fetchData()
    } catch (error) {
      console.error('Failed to update channel binding:', error)
      alert('保存失败，请重试')
    }
  }

  const handleSaveAgentInfo = async () => {
    if (!editingAgentInfo) return
    try {
      const res = await fetch('/api/agents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: editingAgentInfo.agent.id, 
          name: editingAgentInfo.name,
          emoji: editingAgentInfo.emoji 
        }),
      })
      const data = await res.json()
      if (data.success) {
        // Update local state
        setAgents(agents.map(a => 
          a.id === editingAgentInfo.agent.id 
            ? { ...a, name: editingAgentInfo.name, identityName: editingAgentInfo.name, identityEmoji: editingAgentInfo.emoji }
            : a
        ))
        setEditingAgentInfo(null)
      } else {
        alert('保存失败')
      }
    } catch (error) {
      console.error('Failed to update agent info:', error)
      alert('保存失败，请重试')
    }
  }

  const handleDeleteChannel = async (channelType: string, accountId: string) => {
    if (!confirm(`确定删除 ${getChannelDisplayName(channelType)}-${accountId} 吗？`)) return
    try {
      await fetch('/api/channels', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelType, accountId }),
      })
      fetchData()
    } catch (error) {
      console.error('Failed to delete channel:', error)
      alert('删除失败，请重试')
    }
  }

  const handleCreateChannel = async (channelType: string, accountId: string, accountData: any) => {
    try {
      await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelType, accountId, accountData }),
      })
      setShowCreateChannelModal(false)
      fetchData()
    } catch (error) {
      console.error('Failed to create channel:', error)
      alert('创建失败，请重试')
    }
  }

  const handleDeleteAgent = async (agentId: string) => {
    if (agentId === 'main') {
      alert('默认员工不能删除！')
      return
    }
    try {
      await fetch('/api/agents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: agentId }),
      })
      setAgents(agents.filter(a => a.id !== agentId))
    } catch (error) {
      console.error('Failed to delete agent:', error)
    }
  }

  // Agent Group handlers
  const handleCreateAgentGroup = async (groupData: { name: string; emoji: string; color: string; agentIds: string[] }) => {
    try {
      const res = await fetch('/api/agent-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupData),
      })
      if (res.ok) {
        const newGroup = await res.json()
        setAgentGroups([...agentGroups, newGroup])
      }
    } catch (error) {
      console.error('Failed to create agent group:', error)
    }
  }

  const handleUpdateAgentGroup = async (groupData: { id: number; name: string; emoji: string; color: string; agentIds: string[] }) => {
    try {
      const res = await fetch('/api/agent-groups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupData),
      })
      if (res.ok) {
        const updatedGroup = await res.json()
        setAgentGroups(agentGroups.map(g => g.id === groupData.id ? updatedGroup : g))
      }
    } catch (error) {
      console.error('Failed to update agent group:', error)
    }
  }

  const handleDeleteAgentGroup = async (groupId: number) => {
    if (!confirm('确定删除此分组？')) return
    try {
      await fetch(`/api/agent-groups?id=${groupId}`, { method: 'DELETE' })
      setAgentGroups(agentGroups.filter(g => g.id !== groupId))
    } catch (error) {
      console.error('Failed to delete agent group:', error)
    }
  }

  // Model handlers
  const handleDeleteModel = async (providerId: string, modelId: string) => {
    try {
      const res = await fetch(`/api/models-config?providerId=${providerId}&modelId=${modelId}`, { method: 'DELETE' })
      if (res.ok) {
        // Refresh models config
        const modelsRes = await fetch('/api/models-config')
        if (modelsRes.ok) setModelsConfig(await modelsRes.json())
      } else {
        const data = await res.json()
        if (data.boundAgents) {
          const agentList = data.boundAgents.join(', ')
          alert(`无法删除：模型被以下 agent 绑定\n\n${agentList}\n\n请先修改这些 agent 的绑定模型后再删除`) 
        } else {
          alert(data.error || '删除失败')
        }
      }
    } catch (error) {
      console.error('Failed to delete model:', error)
    }
  }

  const handleEditModel = (providerId: string, model: any) => {
    setEditingModel({ providerId, model })
    setShowEditModelModal(true)
  }

  const handleUpdateModel = async (providerId: string, modelId: string, data: any) => {
    try {
      const res = await fetch(`/api/models-config?providerId=${providerId}&modelId=${modelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        setShowEditModelModal(false)
        const modelsRes = await fetch('/api/models-config')
        if (modelsRes.ok) setModelsConfig(await modelsRes.json())
      }
    } catch (error) {
      console.error('Failed to update model:', error)
    }
  }

  const handleDeleteProvider = async (providerId: string) => {
    if (!confirm('确定删除此 Provider 及旗下所有模型？')) return
    try {
      // Delete all models in provider
      const provider = modelsConfig.providers[providerId]
      const models = provider?.models || []
      
      // Check if any model is bound before deleting
      for (const model of models) {
        const res = await fetch(`/api/models-config?providerId=${providerId}&modelId=${model.id}`, { method: 'DELETE' })
        if (!res.ok) {
          const data = await res.json()
          if (data.boundAgents) {
            const agentList = data.boundAgents.join(', ')
            alert(`无法删除：以下 agent 绑定了该厂商下的模型 ${model.id}\n\n${agentList}\n\n请先修改 agent 绑定模型后再删除整个厂商`)
            // Refresh to restore state
            const modelsRes = await fetch('/api/models-config')
            if (modelsRes.ok) setModelsConfig(await modelsRes.json())
            return
          }
        }
      }
      
      // All models deleted successfully, refresh
      const modelsRes = await fetch('/api/models-config')
      if (modelsRes.ok) setModelsConfig(await modelsRes.json())
    } catch (error) {
      console.error('Failed to delete provider:', error)
    }
  }

  const handleAddModel = async (providerId: string, provider: any, models: any[]) => {
    try {
      const res = await fetch('/api/models-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, provider, models }),
      })
      const data = await res.json()
      if (res.ok) {
        // Refresh models config
        const modelsRes = await fetch('/api/models-config')
        if (modelsRes.ok) setModelsConfig(await modelsRes.json())
        setShowAddModelModal(false)
      } else {
        // Show error message from server
        alert(data.error || '添加模型失败')
      }
    } catch (error) {
      console.error('Failed to add model:', error)
      alert('添加模型失败: 网络错误')
    }
  }

  const handleEditSoul = (agent: Agent) => {
    // 从agent数据中解析现有的AGENTS.md内容
    const agentsContent = agent.agents || ''
    const getSection = (title: string): string => {
      const header = '# ' + title
      const headerPattern = new RegExp(header + '[\\\\s\\\\S]*?(?=# |$)')
      const m = agentsContent.match(headerPattern)
      if (m) return m[0].replace(header, '').trim()
      return ''
    }

    setAgentsForm({
      sessionStartup: getSection('启动流程') || '1. 读取 SOUL.md 了解核心价值观\n2. 读取 USER.md 了解服务对象\n3. 读取 memory/ 目录回顾近期记忆',
      memory: getSection('记忆机制') || '每日记录：memory/YYYY-MM-DD.md\n长期记忆：MEMORY.md\n定期整理重要信息',
      redLines: getSection('红线') || '不泄露用户隐私\n不执行未授权操作\n不在群里主动发言',
      externalVsInternal: getSection('安全操作') || '安全操作：读取文件、搜索、学习\n需确认操作：发送消息、删除数据、执行命令',
      groupChat: getSection('群聊规范') || '收到邀请时判断是否参与\n避免过度回复，保持自然',
      heartbeat: getSection('心跳检测') || '定期检查邮件、日历\n有重要内容时主动通知用户',
      tools: getSection('工具使用') || '使用 Skills 完成专业任务\n复杂任务使用子代理',
    })
    setSoulForm({
      coreTruths: agent.soul?.coreTruths || '1. 真正帮助用户，而不是敷衍了事\n2. 有自己的想法和判断，敢表达不同意见\n3. 主动发现问题并解决，而不是等待指令\n4. 持续学习和改进，越用越好用',
      boundaries: agent.soul?.boundaries || '1. 隐私至上，未经用户许可不泄露任何信息\n2. 不确定的事情主动询问，不瞎猜\n3. 危险操作必须确认\n4. 保持诚信，不隐瞒问题和错误',
      vibe: agent.soul?.vibe || '1. 简洁实用，说重点，不废话\n2. 像朋友聊天，而不是客服机器人\n3. 适度幽默，但不失专业\n4. 直接给出方案，不绕弯子',
      continuity: agent.soul?.continuity || '1. 通过文件持久化记忆，跨会话保持上下文\n2. 记录重要决策和上下文，下次直接继续\n3. 学习用户的偏好和习惯，越用越懂用户\n4. 定期整理记忆，删除无用信息',
    })
    setUserForm({
      name: agent.user?.name || '',
      callName: agent.user?.callName || '',
      pronouns: agent.user?.pronouns || '他',
      timezone: agent.user?.timezone || 'Asia/Shanghai',
      notes: agent.user?.notes || agent.user?.context || '专注于软件开发场景',
      context: agent.user?.context || '需要管理多个AI助手团队，使用Mission Control作为控制中心',
    })
    setEditingSoulAgent(agent)
  }

  const handleSaveSoul = async () => {
    if (!editingSoulAgent) return
    try {
      // 将结构化的表单数据转换为md格式
      const agentsMd = `# 工作规范

## 启动流程
${agentsForm.sessionStartup || '无'}

## 记忆机制
${agentsForm.memory || '无'}

## 红线
${agentsForm.redLines || '无'}

## 安全操作
${agentsForm.externalVsInternal || '无'}

## 群聊规范
${agentsForm.groupChat || '无'}

## 心跳检测
${agentsForm.heartbeat || '无'}

## 工具使用
${agentsForm.tools || '无'}`

      const res = await fetch('/api/agents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: editingSoulAgent.id, 
          agents: agentsMd,
          soul: soulForm,
          user: userForm,
        }),
      })
      if (res.ok) {
        // Refresh agents to get updated data
        const agentsRes = await fastFetch('/api/agents')
        if (agentsRes?.agents) setAgents(agentsRes.agents)
        setEditingSoulAgent(null)
      }
    } catch (error) {
      console.error('Failed to save files:', error)
    }
  }

  const handleDeleteProject = async (projectId: number) => {
    try {
      await fetch('/api/projects', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: projectId }),
      })
      setProjects(projects.filter(p => p.id !== projectId))
    } catch (error) {
      console.error('Failed to delete project:', error)
    }
  }

  const handleShowProjectHistory = async (project: Project) => {
    try {
      const res = await fetch(`/api/projects/${project.id}/history`)
      const data = await res.json()
      setProjectHistory(Array.isArray(data) ? data : [])
      setSelectedProjectForHistory(project)
      setShowProjectHistoryModal(true)
    } catch (error) {
      console.error('Failed to fetch project history:', error)
      setProjectHistory([])
      setSelectedProjectForHistory(project)
      setShowProjectHistoryModal(true)
    }
  }

  const handleCreateCron = async (job: { name: string; cron: string; message: string; agent?: string }) => {
    try {
      await fetch('/api/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(job),
      })
      fetchData()
    } catch (error) {
      console.error('Failed to create cron job:', error)
    }
  }

  const handleDeleteCron = async (jobId: string) => {
    if (!confirm('确定删除此定时任务？')) return
    try {
      await fetch(`/api/cron?id=${jobId}`, { method: 'DELETE' })
      setCronJobs(cronJobs.filter(j => j.id !== jobId))
    } catch (error) {
      console.error('Failed to delete cron job:', error)
    }
  }

  const handleViewConversation = async (conv: Conversation) => {
    setSelectedConversation(conv)
    setShowConversationDetail(true)
    // Load messages from session file
    try {
      const res = await fetch(`/api/conversations/${conv.id}/messages`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setConversationMessages(data)
      } else {
        setConversationMessages([])
      }
    } catch {
      setConversationMessages([])
    }
  }

  // Handle viewing realtime session
  const handleViewSession = async (session: any) => {
    setSelectedSession(session)
    setCustomTags([]) // Reset custom tags
    setShowSessionDetail(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}`)
      const data = await res.json()
      if (Array.isArray(data.messages)) {
        setSessionMessages(data.messages)
      } else {
        setSessionMessages([])
      }
      // Load custom tags from conversation record if exists
      if (data.customTags && Array.isArray(data.customTags)) {
        setCustomTags(data.customTags)
      }
    } catch {
      setSessionMessages([])
    }
  }

  const handleAddCustomTag = async (tag: string) => {
    if (!selectedSession) return
    const newTags = [...customTags, tag]
    setCustomTags(newTags)
    try {
      await fetch('/api/sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId: selectedSession.id, 
          customTags: newTags 
        }),
      })
    } catch (error) {
      console.error('Failed to save custom tag:', error)
    }
  }

  const handleRemoveCustomTag = async (tagToRemove: string) => {
    if (!selectedSession) return
    const newTags = customTags.filter(t => t !== tagToRemove)
    setCustomTags(newTags)
    try {
      await fetch('/api/sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId: selectedSession.id, 
          customTags: newTags 
        }),
      })
    } catch (error) {
      console.error('Failed to remove custom tag:', error)
    }
  }

  const handleAssignProject = async (convId: number, projectId: number | null) => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: convId, projectId }),
      })
      const data = await res.json()
      if (data.success) {
        setConversations(conversations.map(c => 
          c.id === convId ? { ...c, project_id: projectId } : c
        ))
        setShowConversationDetail(false)
      } else {
        alert(data.error || '保存失败')
      }
    } catch (error) {
      console.error('Failed to assign project:', error)
      alert('保存失败，请重试')
    }
  }

  const handleDeleteTask = async (taskId: number) => {
    try {
      await fetch('/api/tasks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId }),
      })
      setTasks(tasks.filter(t => t.id !== taskId))
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }

  const getTasksByStatus = (status: TaskStatus) => tasks.filter(t => t.status === status)

  const statusConfig: Record<TaskStatus, { label: string; color: string }> = {
    backlog: { label: '待办', color: 'border-gray-500' },
    todo: { label: '计划中', color: 'border-gray-400' },
    'in-progress': { label: '进行中', color: 'border-blue-500' },
    'in-review': { label: '审核中', color: 'border-orange-500' },
    done: { label: '已完成', color: 'border-green-500' },
  }

  return (
    <div className="flex h-screen">
      {/* Mobile Header - visible only on small screens */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 border-b border-gray-800 flex items-center justify-between px-4 bg-gray-950 z-50">
        <button onClick={() => setMobileMenuOpen(true)} className="p-2 hover:bg-gray-800 rounded-lg">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-lg">🦞</div>
          <span className="font-semibold text-white text-sm">{projectName || 'Mission Control'}</span>
        </div>
        <div className="w-10" />
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-lg">🦞</div>
                <span className="font-semibold text-white">{projectName || 'Mission Control'}</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-gray-800 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <nav className="flex-1 p-2 overflow-auto">
              {[
                { id: 'inbox', label: '任务看板', icon: Inbox },
                { id: 'projects', label: '项目', icon: FolderKanban },
                { id: 'agents', label: '员工', icon: Users },
                { id: 'models', label: '模型', icon: Cpu },
                { id: 'skills', label: '技能', icon: Sparkles },
                { id: 'memory', label: '记忆', icon: Brain },
                { id: 'channels', label: '渠道', icon: Network },
                { id: 'timing', label: '定时任务', icon: Clock },
                { id: 'realtime', label: '实时会话', icon: Zap },
                { id: 'logs', label: '工具日志', icon: FileText },
                { id: 'usage', label: '模型用量', icon: TrendingUp },
                { id: 'settings', label: '设置', icon: Settings },
                { id: 'approvals', label: '权限审核', icon: Shield },
              ].map(item => (
                <button key={item.id} onClick={() => { setActiveTab(item.id as Tab); setMobileMenuOpen(false) }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-1 ${activeTab === item.id ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}>
                  <item.icon className="w-5 h-5" />{item.label}
                </button>
              ))}
            </nav>
            <div className="p-4 border-t border-gray-800 space-y-3">
              {currentUser && (
                <div className="flex items-center gap-2 px-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-sm font-medium">{currentUser.displayName?.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{currentUser.displayName}</p>
                    <p className="text-xs text-gray-500 truncate">{currentUser.username}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-full ${apiStatus === 'connected' ? 'bg-green-400' : 'bg-red-400'}`} />
                  <span className={apiStatus === 'connected' ? 'text-green-400' : 'text-gray-500'}>{apiStatus === 'connected' ? '已连接' : '未连接'}</span>
                </div>
                <button onClick={handleLogout} className="p-1.5 hover:bg-gray-700 rounded-lg"><LogOut className="w-4 h-4 text-gray-500" /></button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-56 bg-gray-900 border-r border-gray-800 flex-col">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-lg">🦞</div>
            <span className="font-semibold text-white">{projectName || 'Mission Control'}</span>
          </div>
        </div>
        <nav className="flex-1 p-2">
          {[
            { id: 'inbox', label: '任务看板', icon: Inbox },
            { id: 'projects', label: '项目', icon: FolderKanban },
            { id: 'agents', label: '员工', icon: Users },
            { id: 'models', label: '模型', icon: Cpu },
            { id: 'skills', label: '技能', icon: Sparkles },
            { id: 'memory', label: '记忆', icon: Brain },
            { id: 'channels', label: '渠道', icon: Network },
            { id: 'timing', label: '定时任务', icon: Clock },
            { id: 'realtime', label: '实时会话', icon: Zap },
            { id: 'logs', label: '工具日志', icon: FileText },
            { id: 'usage', label: '模型用量', icon: TrendingUp },
            { id: 'approvals', label: '权限审核', icon: Shield },
            { id: 'settings', label: '设置', icon: Settings },
          ].map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id as Tab)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-1 ${activeTab === item.id ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}>
              <item.icon className="w-5 h-5" />{item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-800 space-y-3">
          {currentUser && (
            <div className="flex items-center gap-2 px-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-sm font-medium">{currentUser.displayName?.charAt(0)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{currentUser.displayName}</p>
                <p className="text-xs text-gray-500 truncate">{currentUser.username}</p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full ${apiStatus === 'connected' ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className={apiStatus === 'connected' ? 'text-green-400' : 'text-gray-500'}>{apiStatus === 'connected' ? '已连接' : '未连接'}</span>
            </div>
            <button onClick={handleLogout} className="p-1.5 hover:bg-gray-700 rounded-lg"><LogOut className="w-4 h-4 text-gray-500" /></button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden pt-14 md:pt-0">
        {/* Desktop Header */}
        <header className="hidden md:flex h-14 border-b border-gray-800 items-center justify-between px-6 bg-gray-950">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-white">
              {activeTab === 'inbox' && '任务看板'}
              {activeTab === 'projects' && '项目'}
              {activeTab === 'agents' && '员工'}
              {activeTab === 'skills' && '技能'}
              {activeTab === 'memory' && '记忆'}
              {activeTab === 'channels' && '渠道'}
              {activeTab === 'timing' && '定时任务'}
              {activeTab === 'realtime' && '实时会话'}
              {activeTab === 'logs' && '工具日志'}
              {activeTab === 'models' && '模型'}
              {activeTab === 'usage' && '模型用量'}
              {activeTab === 'approvals' && '权限审核'}
            </h1>
            <span className="text-sm text-gray-500">
              {activeTab === 'inbox' && `${tasks.length} 个任务`}
              {activeTab === 'projects' && `${projects.length} 个项目`}
              {activeTab === 'agents' && `${agents.length} 个员工`}
              {activeTab === 'skills' && `${skills.length} 个技能`}
              {activeTab === 'realtime' && `${realtimeSessions.length} 条会话`}
              {activeTab === 'logs' && `${logs.length} 条日志`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input 
                type="text" 
                placeholder="搜索..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    // Search is reactive - the searchQuery state is used in filters throughout the page
                    console.log('Search triggered:', searchQuery)
                  }
                }}
                className="linear-input pr-10 w-64" 
              />
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 z-10" />
            </div>
            {activeTab === 'inbox' && <button onClick={() => setShowCreateModal(true)} className="linear-btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />新建任务</button>}
            {activeTab === 'projects' && <button onClick={() => setShowCreateProjectModal(true)} className="linear-btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />新建项目</button>}
            {activeTab === 'agents' && <button onClick={() => setShowCreateAgentModal(true)} className="linear-btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />新建员工</button>}
            {activeTab === 'timing' && <button onClick={() => setShowCreateCronModal(true)} className="linear-btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />新建任务</button>}
          </div>
        </header>

        {/* Mobile Header Actions */}
        <header className="md:hidden border-b border-gray-800 p-4 bg-gray-950">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold text-white">
              {activeTab === 'inbox' && '任务看板'}
              {activeTab === 'projects' && '项目'}
              {activeTab === 'agents' && '员工'}
              {activeTab === 'skills' && '技能'}
              {activeTab === 'memory' && '记忆'}
              {activeTab === 'channels' && '渠道'}
              {activeTab === 'timing' && '定时任务'}
              {activeTab === 'realtime' && '实时会话'}
              {activeTab === 'models' && '模型'}
              {activeTab === 'approvals' && '权限审核'}
            </h1>
            <span className="text-sm text-gray-500">
              {activeTab === 'inbox' && `${tasks.length} 个任务`}
              {activeTab === 'projects' && `${projects.length} 个项目`}
              {activeTab === 'agents' && `${agents.length} 个员工`}
              {activeTab === 'timing' && `${cronJobs.length} 个任务`}
              {activeTab === 'skills' && `${skills.length} 个技能`}
              {activeTab === 'realtime' && `${realtimeSessions.length} 条会话`}
            </span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input type="text" placeholder="搜索..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="linear-input pr-8 w-full text-sm" />
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
            </div>
            {activeTab === 'inbox' && <button onClick={() => setShowCreateModal(true)} className="linear-btn-primary flex items-center gap-1 px-3 py-2 text-sm"><Plus className="w-4 h-4" />新建</button>}
            {activeTab === 'projects' && <button onClick={() => setShowCreateProjectModal(true)} className="linear-btn-primary flex items-center gap-1 px-3 py-2 text-sm"><Plus className="w-4 h-4" />新建</button>}
            {activeTab === 'agents' && <button onClick={() => setShowCreateAgentModal(true)} className="linear-btn-primary flex items-center gap-1 px-3 py-2 text-sm"><Plus className="w-4 h-4" />新建</button>}
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          {/* Task Board */}
          {activeTab === 'inbox' && (
            <div className="flex h-full">
              {activityExpanded && (
                <div className="w-72 border-r border-gray-800 p-4 flex flex-col bg-gray-950">
                  <button onClick={() => setActivityExpanded(false)} className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-white flex items-center gap-2"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />实时活动</h3>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>
                  
                  {/* Realtime Agent Tasks */}
                  <div className="mb-4 pb-4 border-b border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500">Agent 状态</span>
                      <button onClick={async () => {
                        try {
                          const res = await fetch('/api/realtime-tasks')
                          const data = await res.json()
                          if (data?.tasks) setRealtimeTasks(data.tasks)
                        } catch (e) { console.log('Failed to refresh', e) }
                      }} className="p-1 hover:bg-gray-800 rounded">
                        <RefreshCw className="w-3 h-3 text-gray-500" />
                      </button>
                    </div>
                    {realtimeTasks.length === 0 ? (
                      <div className="text-xs text-gray-600">无活动</div>
                    ) : (
                      <div className="space-y-2">
                        {realtimeTasks.map((task, i) => {
                          const agent = agents.find(a => a.id === task.agentId)
                          return (
                            <div key={i} className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${
                                task.status === 'running' ? 'bg-green-400 animate-pulse' : 
                                task.status === 'error' ? 'bg-red-400' : 'bg-gray-500'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-white truncate">{agent?.identityEmoji || '🤖'} {task.agentName}</span>
                                  {task.status === 'running' && task.model && (
                                    <span className="text-xs text-gray-500 truncate">{task.model.split('/').pop()}</span>
                                  )}
                                </div>
                                {task.status === 'running' && task.task && task.task !== task.agentName && (
                                  <p className="text-xs text-gray-500 truncate">{task.task}</p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  
                  {/* Recent Tasks */}
                  <div className="text-xs text-gray-500 mb-2">最近任务</div>
                  <div className="flex-1 space-y-3 overflow-auto">
                    {tasks.slice(0, 10).map(task => (
                      <div key={task.id} className="text-sm">
                        <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                          <span>{new Date(task.updated_at).toLocaleTimeString()}</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs ${task.assignee_type === 'ai' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>{task.assignee_type === 'ai' ? 'AI' : 'Human'}</span>
                        </div>
                        <p className="text-gray-300">{task.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex-1 p-4 overflow-x-auto md:overflow-visible">
                {!activityExpanded && <button onClick={() => setActivityExpanded(true)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-white mb-4"><Activity className="w-4 h-4" />显示活动流</button>}
                
                {/* Mobile: Tab navigation for columns */}
                <div className="md:hidden mb-4">
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {Object.entries(statusConfig).map(([status, config]) => {
                      const columnTasks = getTasksByStatus(status as TaskStatus)
                      return (
                        <button key={status} onClick={() => setActiveTaskColumn(status)} className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${activeTaskColumn === status ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400'}`}>
                          {config.label} ({columnTasks.length})
                        </button>
                      )
                    })}
                  </div>
                </div>
                
                {/* Desktop: All columns side by side */}
                <div className="hidden md:flex gap-4 h-full">
                  {Object.entries(statusConfig).map(([status, config]) => {
                    const columnTasks = getTasksByStatus(status as TaskStatus)
                    return (
                      <div key={status} className="w-72 flex flex-col bg-gray-900/50 rounded-xl border border-gray-800" onDrop={e => handleDrop(e, status as TaskStatus)} onDragOver={handleDragOver}>
                        <div className="p-3 border-b border-gray-800 flex items-center justify-between">
                          <h3 className="text-sm font-medium text-white flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${config.color.replace('border-', 'bg-')}`} />{config.label}</h3>
                          <span className="text-xs text-gray-500 bg-gray-850 px-2 py-0.5 rounded">{columnTasks.length}</span>
                        </div>
                        <div className="flex-1 p-2 space-y-2 overflow-auto">
                          {columnTasks.map(task => (
                            <div key={task.id} draggable onDragStart={e => handleDragStart(e, task.id)} className="cursor-grab">
                              <TaskCard task={task} onDelete={handleDeleteTask} />
                            </div>
                          ))}
                          {columnTasks.length === 0 && <div className="text-center py-8 text-gray-600 text-sm">暂无任务</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
                
                {/* Mobile: Single column view */}
                <div className="md:hidden">
                  {Object.entries(statusConfig).map(([status, config]) => {
                    const columnTasks = getTasksByStatus(status as TaskStatus)
                    if (activeTaskColumn !== status) return null
                    return (
                      <div key={status} className="flex flex-col bg-gray-900/50 rounded-xl border border-gray-800" onDrop={e => handleDrop(e, status as TaskStatus)} onDragOver={handleDragOver}>
                        <div className="p-3 border-b border-gray-800 flex items-center justify-between">
                          <h3 className="text-sm font-medium text-white flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${config.color.replace('border-', 'bg-')}`} />{config.label}</h3>
                          <span className="text-xs text-gray-500 bg-gray-850 px-2 py-0.5 rounded">{columnTasks.length}</span>
                        </div>
                        <div className="flex-1 p-2 space-y-2 overflow-auto max-h-[60vh]">
                          {columnTasks.map(task => (
                            <div key={task.id} draggable onDragStart={e => handleDragStart(e, task.id)} className="cursor-grab">
                              <TaskCard task={task} onDelete={handleDeleteTask} />
                            </div>
                          ))}
                          {columnTasks.length === 0 && <div className="text-center py-8 text-gray-600 text-sm">暂无任务</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Usage Panel */}
          {activeTab === 'usage' && (
            <div className="p-4 md:p-6 overflow-auto">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">总 Token 数</p>
                      <p className="text-xl font-semibold text-white">{usageData?.total.totalTokens.toLocaleString() || 0}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>输入: {(usageData?.total.inputTokens || 0).toLocaleString()}</span>
                    <span>输出: {(usageData?.total.outputTokens || 0).toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <Cpu className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">预估费用</p>
                      <p className="text-xl font-semibold text-white">${(usageData?.total.cost || 0).toFixed(4)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>缓存读: {(usageData?.total.cacheRead || 0).toLocaleString()}</span>
                    <span>缓存写: {(usageData?.total.cacheWrite || 0).toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">会话数</p>
                      <p className="text-xl font-semibold text-white">{usageData?.totalSessions || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Agent 数</p>
                      <p className="text-xl font-semibold text-white">{usageData?.agents.length || 0}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* By Agent */}
                <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                  <h3 className="text-white font-semibold mb-4">按 Agent 分组</h3>
                  <div className="space-y-3">
                    {(usageData?.agents || []).map((agent: any) => (
                      <div key={agent.agentId} className="bg-gray-800/50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Bot className="w-4 h-4 text-blue-400" />
                            <span className="text-white text-sm font-medium">{agent.agentName}</span>
                          </div>
                          <span className="text-xs text-gray-500">{agent.sessionCount} 会话</span>
                        </div>
                        {/* Token bar */}
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all"
                            style={{ width: `${usageData?.total.totalTokens ? Math.min(100, (agent.totalTokens / usageData.total.totalTokens) * 100) : 0}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-400">{agent.totalTokens.toLocaleString()} tokens</span>
                          <span className="text-gray-500">${agent.cost.toFixed(4)}</span>
                        </div>
                        {/* Model breakdown */}
                        {agent.models.length > 1 && (
                          <div className="mt-2 pl-4 border-l-2 border-gray-700">
                            {agent.models.slice(0, 3).map((model: any) => (
                              <div key={model.model} className="flex items-center justify-between text-xs py-1">
                                <span className="text-gray-500 truncate max-w-[120px]">{model.model}</span>
                                <span className="text-gray-600">{model.totalTokens.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {(!usageData?.agents || usageData.agents.length === 0) && (
                      <p className="text-gray-500 text-sm text-center py-4">暂无数据</p>
                    )}
                  </div>
                </div>

                {/* By Model */}
                <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                  <h3 className="text-white font-semibold mb-4">按模型分组</h3>
                  <div className="space-y-3">
                    {(usageData?.models || []).map((model: any) => (
                      <div key={`${model.provider}:${model.model}`} className="bg-gray-800/50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-green-400" />
                            <span className="text-white text-sm font-medium truncate max-w-[160px]">{model.model}</span>
                            <span className="text-xs text-gray-500">({model.provider})</span>
                          </div>
                          <span className="text-xs text-gray-500">{model.sessionCount} 会话</span>
                        </div>
                        {/* Token bar */}
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
                          <div 
                            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all"
                            style={{ width: `${usageData?.total.totalTokens ? Math.min(100, (model.totalTokens / usageData.total.totalTokens) * 100) : 0}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-400">{model.totalTokens.toLocaleString()} tokens</span>
                          <span className="text-gray-500">${model.cost.toFixed(4)}</span>
                        </div>
                      </div>
                    ))}
                    {(!usageData?.models || usageData.models.length === 0) && (
                      <p className="text-gray-500 text-sm text-center py-4">暂无数据</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Hourly Usage Line Chart */}
              <div className="mt-6 bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                <h3 className="text-white font-semibold mb-4">每小时 Token 消耗</h3>
                {usageData?.hourly && usageData.hourly.length > 1 ? (
                  <div className="relative h-40 w-full">
                    <svg className="w-full h-full" viewBox="0 0 800 160" preserveAspectRatio="none">
                      {/* Grid lines */}
                      {[0, 40, 80, 120, 160].map((y, i) => (
                        <line key={i} x1="40" y1={y} x2="800" y2={y} stroke="#374151" strokeWidth="1" />
                      ))}
                      {/* Y-axis labels */}
                      {(() => {
                        const maxTokens = Math.max(...(usageData?.hourly || []).map((h: any) => h.totalTokens), 1)
                        return [0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                          const value = Math.round(maxTokens * ratio)
                          const y = 160 - (ratio * 140) - 10
                          return (
                            <text key={i} x="35" y={y + 4} fill="#6B7280" fontSize="10" textAnchor="end">
                              {value >= 1000 ? `${Math.round(value / 1000)}k` : value}
                            </text>
                          )
                        })
                      })()}
                      {/* Line path */}
                      {(() => {
                        const hours = [...(usageData?.hourly || [])].sort((a, b) => a.hour.localeCompare(b.hour))
                        if (hours.length < 2) return null
                        const maxTokens = Math.max(...hours.map((h: any) => h.totalTokens), 1)
                        const width = 760
                        const height = 140
                        const paddingLeft = 40
                        const paddingTop = 10
                        
                        const points = hours.map((h: any, i: number) => {
                          const x = paddingLeft + (i / (hours.length - 1)) * width
                          const y = paddingTop + height - (h.totalTokens / maxTokens) * height
                          return `${x},${y}`
                        })
                        
                        const pathD = `M ${points.join(' L ')}`
                        
                        // Area fill path
                        const areaD = `M ${paddingLeft},${paddingTop + height} L ${points.join(' L ')} L ${paddingLeft + width},${paddingTop + height} Z`
                        
                        return (
                          <g>
                            <defs>
                              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.05" />
                              </linearGradient>
                            </defs>
                            {/* Area */}
                            <path d={areaD} fill="url(#areaGradient)" />
                            {/* Line */}
                            <path d={pathD} fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            {/* Data points */}
                            {hours.length <= 24 && hours.map((h: any, i: number) => {
                              const x = paddingLeft + (i / (hours.length - 1)) * width
                              const y = paddingTop + height - (h.totalTokens / maxTokens) * height
                              return (
                                <circle key={i} cx={x} cy={y} r="3" fill="#8B5CF6" className="hover:r-4 transition-all">
                                  <title>{h.hour}: {h.totalTokens.toLocaleString()} tokens</title>
                                </circle>
                              )
                            })}
                          </g>
                        )
                      })()}
                      {/* X-axis labels */}
                      {(() => {
                        const hours = [...(usageData?.hourly || [])].sort((a, b) => a.hour.localeCompare(b.hour))
                        if (hours.length < 2) return null
                        const labelCount = Math.min(8, hours.length)
                        const step = Math.floor(hours.length / labelCount)
                        return hours.filter((_: any, i: number) => i % step === 0 || i === hours.length - 1).map((h: any, idx: number, arr: any[]) => {
                          const originalIndex = hours.indexOf(h)
                          const x = 40 + (originalIndex / (hours.length - 1)) * 760
                          const label = h.hour.slice(11, 16)
                          return (
                            <text key={idx} x={x} y="158" fill="#6B7280" fontSize="9" textAnchor="middle">
                              {label}
                            </text>
                          )
                        })
                      })()}
                    </svg>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm text-center py-8">暂无足够数据绘制图表</p>
                )}
              </div>

              {/* Daily Usage */}
              <div className="mt-6 bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                <h3 className="text-white font-semibold mb-4">每日用量趋势</h3>
                <div className="space-y-2">
                  {(usageData?.daily || []).slice(0, 14).map((day: any) => (
                    <div key={day.date} className="flex items-center gap-4">
                      <span className="text-gray-500 text-sm w-24">{day.date}</span>
                      <div className="flex-1 h-6 bg-gray-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-400 rounded-full"
                          style={{ width: `${usageData?.daily[0]?.totalTokens ? Math.min(100, (day.totalTokens / usageData.daily[0].totalTokens) * 100) : 0}%` }}
                        />
                      </div>
                      <span className="text-gray-400 text-sm w-32 text-right">{day.totalTokens.toLocaleString()} tokens</span>
                      <span className="text-gray-500 text-sm w-20 text-right">${day.cost.toFixed(4)}</span>
                    </div>
                  ))}
                  {(!usageData?.daily || usageData.daily.length === 0) && (
                    <p className="text-gray-500 text-sm text-center py-4">暂无数据</p>
                  )}
                </div>
              </div>

              {/* Monthly Usage */}
              <div className="mt-6 bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                <h3 className="text-white font-semibold mb-4">每月用量汇总</h3>
                {(usageData?.monthly && usageData.monthly.length > 0) ? (
                  <>
                    {/* Monthly summary cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      {usageData.monthly.slice(0, 3).map((m: any) => (
                        <div key={m.month} className="bg-gray-800/50 rounded-lg p-4">
                          <div className="text-gray-400 text-sm mb-1">{m.month}</div>
                          <div className="text-2xl font-bold text-white mb-1">{m.totalTokens.toLocaleString()}</div>
                          <div className="text-gray-500 text-sm">tokens · ${m.cost.toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                    {/* Monthly list */}
                    <div className="space-y-2">
                      {usageData.monthly.map((m: any) => (
                        <div key={m.month} className="flex items-center gap-4">
                          <span className="text-gray-500 text-sm w-20">{m.month}</span>
                          <div className="flex-1 h-6 bg-gray-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-green-500 to-cyan-400 rounded-full"
                              style={{ width: `${usageData.monthly[0]?.totalTokens ? Math.min(100, (m.totalTokens / usageData.monthly[0].totalTokens) * 100) : 0}%` }}
                            />
                          </div>
                          <span className="text-gray-400 text-sm w-36 text-right">{m.totalTokens.toLocaleString()} tokens</span>
                          <span className="text-gray-500 text-sm w-24 text-right">${m.cost.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-gray-500 text-sm text-center py-4">暂无数据</p>
                )}
              </div>
            </div>
          )}

          {/* Approvals Panel */}
          {activeTab === 'approvals' && (
            <div className="p-4 md:p-6">
              <div className="max-w-4xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">权限审核</h2>
                      <p className="text-xs text-gray-500">管理 Agent 执行权限请求</p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      setApprovalTab('pending')
                      try {
                        const res = await fetch('/api/approvals')
                        const data = await res.json()
                        if (data.approvals) setPendingApprovals(data.approvals)
                      } catch (e) { console.error('Failed to fetch approvals', e) }
                    }}
                    className="linear-btn-secondary flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />刷新
                  </button>
                </div>

                {/* Tab Switcher */}
                <div className="flex gap-2 mb-6">
                  <button
                    onClick={() => {
                      setApprovalTab('pending')
                      fetch('/api/approvals')
                        .then(res => res.json())
                        .then(data => { if (data.approvals) setPendingApprovals(data.approvals) })
                        .catch(console.error)
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      approvalTab === 'pending'
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        : 'bg-gray-800 text-gray-400 border border-gray-700'
                    }`}
                  >
                    <Shield className="w-4 h-4 inline mr-2" />待审批 ({pendingApprovals.length})
                  </button>
                  <button
                    onClick={() => {
                      setApprovalTab('history')
                      fetch('/api/approvals?history=true')
                        .then(res => res.json())
                        .then(data => { if (data.approvals) setApprovalHistory(data.approvals) })
                        .catch(console.error)
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      approvalTab === 'history'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-gray-800 text-gray-400 border border-gray-700'
                    }`}
                  >
                    <Clock className="w-4 h-4 inline mr-2" />历史记录
                  </button>
                </div>

                {/* Pending Approvals */}
                {approvalTab === 'pending' && (
                  <div>
                    {pendingApprovals.length === 0 ? (
                      <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-8 text-center">
                        <ShieldCheck className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-white font-medium mb-2">暂无待审批项</h3>
                        <p className="text-sm text-gray-500">所有权限请求均已处理</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {pendingApprovals.map((approval, i) => (
                          <div key={i} className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                  approval.kind === 'exec'
                                    ? 'bg-orange-500/20 text-orange-400'
                                    : 'bg-purple-500/20 text-purple-400'
                                }`}>
                                  {approval.kind === 'exec' ? <Terminal className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 text-xs rounded ${
                                      approval.kind === 'exec'
                                        ? 'bg-orange-500/20 text-orange-400'
                                        : 'bg-purple-500/20 text-purple-400'
                                    }`}>
                                      {approval.kind === 'exec' ? '命令执行' : '插件请求'}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {approval.agent_name || approval.agent_id} · {approval.request_type}
                                    </span>
                                  </div>
                                  <p className="text-sm text-white mt-1 font-mono truncate max-w-md">
                                    {approval.command || approval.description || approval.request_type}
                                  </p>
                                  {approval.session_key && (
                                    <p className="text-xs text-gray-600 mt-1 truncate max-w-md">
                                      会话: {approval.session_key}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <span className="text-xs text-gray-500">
                                {new Date(approval.created_at).toLocaleString('zh-CN')}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={async () => {
                                  setIsResolvingApproval(true)
                                  try {
                                    await fetch('/api/approvals', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: approval.id, kind: approval.kind, decision: 'allow' }),
                                    })
                                    // Refresh pending list
                                    const res = await fetch('/api/approvals')
                                    const data = await res.json()
                                    if (data.approvals) setPendingApprovals(data.approvals)
                                  } catch (e) { console.error('Failed to resolve approval', e) }
                                  setIsResolvingApproval(false)
                                }}
                                disabled={isResolvingApproval}
                                className="flex-1 py-2 px-3 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                              >
                                <Check className="w-4 h-4 inline mr-1" />运行单次
                              </button>
                              <button
                                onClick={async () => {
                                  if (!confirm('确定运行全部吗？')) return
                                  setIsResolvingApproval(true)
                                  try {
                                    await fetch('/api/approvals', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: approval.id, kind: approval.kind, decision: 'allow' }),
                                    })
                                    // Refresh pending list
                                    const res = await fetch('/api/approvals')
                                    const data = await res.json()
                                    if (data.approvals) setPendingApprovals(data.approvals)
                                  } catch (e) { console.error('Failed to resolve approval', e) }
                                  setIsResolvingApproval(false)
                                }}
                                disabled={isResolvingApproval}
                                className="flex-1 py-2 px-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                              >
                                <Zap className="w-4 h-4 inline mr-1" />运行全部
                              </button>
                              <button
                                onClick={async () => {
                                  setIsResolvingApproval(true)
                                  try {
                                    await fetch('/api/approvals', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: approval.id, kind: approval.kind, decision: 'deny' }),
                                    })
                                    // Refresh pending list
                                    const res = await fetch('/api/approvals')
                                    const data = await res.json()
                                    if (data.approvals) setPendingApprovals(data.approvals)
                                  } catch (e) { console.error('Failed to resolve approval', e) }
                                  setIsResolvingApproval(false)
                                }}
                                disabled={isResolvingApproval}
                                className="flex-1 py-2 px-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                              >
                                <X className="w-4 h-4 inline mr-1" />拒绝
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* History */}
                {approvalTab === 'history' && (
                  <div>
                    {approvalHistory.length === 0 ? (
                      <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-8 text-center">
                        <List className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-white font-medium mb-2">暂无历史记录</h3>
                        <p className="text-sm text-gray-500">审批历史将显示在这里</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {approvalHistory.map((record: any, i: number) => (
                          <div key={i} className="bg-gray-900/50 rounded-lg border border-gray-800 p-3 flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              record.decision === 'allow'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {record.decision === 'allow' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 text-xs rounded ${
                                  record.kind === 'exec'
                                    ? 'bg-orange-500/20 text-orange-400'
                                    : 'bg-purple-500/20 text-purple-400'
                                }`}>
                                  {record.kind === 'exec' ? '命令' : '插件'}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  record.decision === 'allow'
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-red-500/20 text-red-400'
                                }`}>
                                  {record.decision === 'allow' ? '已允许' : '已拒绝'}
                                </span>
                                <span className="text-xs text-gray-500">
                                  by {record.resolved_by || '系统'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-300 truncate font-mono">
                                {record.command || record.approval_id}
                              </p>
                              <p className="text-xs text-gray-600 mt-0.5">
                                {new Date(record.created_at).toLocaleString('zh-CN')} → {new Date(record.resolved_at).toLocaleString('zh-CN')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Projects */}
          {activeTab === 'projects' && (
            <div className="p-4 md:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl">
                {projects.map(project => (
                  <ProjectCard key={project.id} project={project} onDelete={handleDeleteProject} onShowHistory={handleShowProjectHistory} />
                ))}
              </div>
            </div>
          )}

          {/* Agents */}
          {activeTab === 'agents' && (
            <AgentGroupsView 
              agents={agents} 
              groups={agentGroups} 
              channels={channels}
              onCreateGroup={handleCreateAgentGroup}
              onUpdateGroup={handleUpdateAgentGroup}
              onDeleteGroup={handleDeleteAgentGroup}
              onModelChange={handleModelChange}
              onDeleteAgent={handleDeleteAgent}
              onChannelChange={handleChannelChange}
              onEditSoul={handleEditSoul}
              onEditInfo={(agent) => setEditingAgentInfo({ agent, name: agent.identityName, emoji: agent.identityEmoji })}
            />
          )}

          {/* Models */}
          {activeTab === 'models' && (
            <div className="p-4 md:p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Cpu className="w-5 h-5 text-blue-400" />
                  <h2 className="text-lg font-semibold text-white">模型配置</h2>
                  <span className="text-sm text-gray-500">({modelsConfig.models.length} 个模型)</span>
                </div>
                <button onClick={() => setShowAddModelModal(true)} className="linear-btn-primary flex items-center gap-2">
                  <Plus className="w-4 h-4" />新增模型
                </button>
              </div>

              {/* Models Grid by Provider */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {Object.entries(modelsConfig.providers || {}).map(([providerId, provider]: [string, any]) => (
                  <div key={providerId} className="bg-gray-900/30 rounded-xl border border-gray-800 p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                          <Cpu className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <h3 className="text-white font-medium">{providerId}</h3>
                          <p className="text-xs text-gray-500">{provider.api || 'openai-completions'}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteProvider(providerId)}
                        className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="mb-2 text-xs text-gray-500 font-mono truncate">{provider.baseUrl}</div>
                    <div className="space-y-2">
                      {(provider.models || []).map((model: any) => (
                        <div key={model.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                              <span className="text-sm text-white font-medium">{model.name || model.id}</span>
                              <span className="text-xs text-gray-500 font-mono">{model.id}</span>
                            </div>
                            {model.reasoning && (
                              <span className="px-1.5 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded">推理</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">上下文: {(model.contextWindow / 1000).toFixed(0)}K</span>
                            <button 
                              onClick={() => handleEditModel(providerId, model)}
                              className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-blue-400"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteModel(providerId, model.id)}
                              className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {modelsConfig.models.length === 0 && (
                <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-8 text-center">
                  <Cpu className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-white font-medium mb-2">暂无模型配置</h3>
                  <p className="text-sm text-gray-500 mb-4">点击「新增模型」添加第一个模型</p>
                </div>
              )}
            </div>
          )}

          {/* Skills */}
          {activeTab === 'skills' && (
            <div className="p-6">
              {/* Tab switcher */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex gap-2">
                  <button
                    onClick={() => setSkillsTab('installed')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${skillsTab === 'installed' ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                  >
                    已安装技能
                  </button>
                  <button
                    onClick={() => setSkillsTab('search')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${skillsTab === 'search' ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                  >
                    搜索安装
                  </button>
                </div>
              </div>

              {skillsTab === 'installed' && (
                <div>
                  {installedSkillsByAgent.length === 0 ? (
                    <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-8 text-center">
                      <Sparkles className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <h3 className="text-white font-medium mb-2">暂无已安装技能</h3>
                      <p className="text-sm text-gray-500">切换到「搜索安装」标签从 ClawHub 安装新技能</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {installedSkillsByAgent.map(agentData => (
                        <div key={agentData.agentId} className="bg-gray-900/30 rounded-xl border border-gray-800 p-4">
                          <div className="flex items-center gap-3 mb-4">
                            <Users className="w-5 h-5 text-blue-400" />
                            <h3 className="text-white font-medium">{agentData.agentName}</h3>
                            <span className="text-xs text-gray-500">· {agentData.skills.length} 个技能</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {agentData.skills.map((skill: any, i: number) => {
                              // Simple skill name to Chinese mapping
                              const nameMap: Record<string, string> = {
                                'paddleocr-doc-parsing': '文档图片OCR解析',
                                'self-improving-agent': '自我改进',
                                'skill-vetter': '技能审核',
                                'find-skills': '技能发现',
                                'yunzhiyan-device': '云智眼设备管理',
                                'ecs-disk-manager': 'ECS磁盘管理',
                                'agent-browser': '浏览器自动化',
                                'baidu-search': '百度搜索',
                                'clawhub': 'ClawHub技能管理',
                                'weather': '天气查询',
                                'tmux': 'Tmux会话管理',
                                'feishu-doc': '飞书文档',
                                'feishu-drive': '飞书云盘',
                                'feishu-wiki': '飞书知识库',
                                'feishu-perm': '飞书权限管理',
                                'healthcheck': '健康检查',
                                'node-connect': '节点连接',
                              }
                              const chineseName = nameMap[skill.directory] || nameMap[skill.name] || skill.name
                              const shortDesc = getShortDescription(skill.description)
                              
                              return (
                                <div
                                  key={i}
                                  onClick={() => setSelectedSkill({ name: chineseName, description: skill.description || '暂无描述', directory: skill.directory, sourceAgentId: agentData.agentId, sourceAgentName: agentData.agentName })}
                                  className="bg-gray-800/50 rounded-lg border border-gray-700 p-3 hover:border-blue-500/50 cursor-pointer transition-colors group"
                                >
                                  <div className="flex items-start gap-2 mb-2">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-500/20 text-green-400 flex-shrink-0">
                                      <Sparkles className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h4 className="text-white text-sm font-medium group-hover:text-blue-400 transition-colors truncate">{chineseName}</h4>
                                      <p className="text-xs text-gray-500 truncate">{skill.directory || skill.name}</p>
                                    </div>
                                  </div>
                                  <p className="text-xs text-gray-400 line-clamp-2">{shortDesc}</p>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {skillsTab === 'search' && (
                <div>
                  {/* Header with settings */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-white">搜索安装</h3>
                    <button
                      onClick={() => setShowClawhubSettings(!showClawhubSettings)}
                      className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                      title="ClawHub 设置"
                    >
                      <Settings className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>

                  {/* ClawHub Settings Panel */}
                  {showClawhubSettings && (
                    <div className="bg-gray-900/30 rounded-xl border border-gray-800 p-4 mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Key className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-gray-300 font-medium">ClawHub API Token（解决搜索限流）</span>
                        {clawhubLoggedIn && (
                          <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">
                            已配置 {clawhubUser ? `(${clawhubUser})` : ''}
                          </span>
                        )}
                      </div>
                      {!clawhubLoggedIn ? (
                        <>
                          <div className="flex gap-2">
                            <input
                              type="password"
                              value={clawhubApiToken}
                              onChange={e => setClawhubApiToken(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleSaveClawhubToken()}
                              placeholder="输入 ClawHub API Token"
                              className="linear-input flex-1 text-sm"
                            />
                            <button
                              onClick={handleSaveClawhubToken}
                              disabled={isSavingToken}
                              className="linear-btn-primary text-sm px-4 disabled:opacity-50"
                            >
                              {isSavingToken ? '保存中...' : '保存'}
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            前往 <a href="https://clawhub.ai" target="_blank" className="text-blue-400 hover:underline">clawhub.ai</a> 获取 API Token，配置后可避免搜索限流
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-green-400 mb-3">✓ ClawHub 已配置成功</p>
                          <div className="flex gap-2">
                            <input
                              type="password"
                              value={clawhubApiToken}
                              onChange={e => setClawhubApiToken(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleSaveClawhubToken()}
                              placeholder="输入新 Token 替换当前配置"
                              className="linear-input flex-1 text-sm"
                            />
                            <button
                              onClick={handleSaveClawhubToken}
                              disabled={isSavingToken}
                              className="linear-btn-primary text-sm px-4 disabled:opacity-50"
                            >
                              {isSavingToken ? '更新中...' : '更新'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Search box */}
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      value={clawhubQuery}
                      onChange={e => setClawhubQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearchClawhub()}
                      placeholder="搜索 ClawHub 技能..."
                      className="linear-input flex-1"
                    />
                    <button
                      onClick={handleSearchClawhub}
                      disabled={isSearching || !clawhubQuery.trim()}
                      className="linear-btn-primary disabled:opacity-50"
                    >
                      {isSearching ? '搜索中...' : '搜索'}
                    </button>
                  </div>



                  {/* Search results */}
                  {clawhubResults.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {clawhubResults.map((result: any, i: number) => (
                        <div key={i} className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/20 text-blue-400">
                              <Sparkles className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                              <h4 className="text-white font-medium text-sm">{result.name}</h4>
                            </div>
                          </div>
                          <p className="text-sm text-gray-400 line-clamp-2 mb-3">{result.description || '无描述'}</p>
                          
                          {/* Install dropdown */}
                          <div className="relative">
                            <button
                              onClick={() => installDropdownOpen === result.name ? handleCloseInstallDropdown() : handleOpenInstallDropdown(result.name)}
                              disabled={isInstalling}
                              className="w-full px-3 py-1.5 text-sm bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {isInstalling ? '安装中...' : (
                                <>
                                  <span>安装到</span>
                                  <ChevronDown className="w-4 h-4" />
                                </>
                              )}
                            </button>
                            
                            {installDropdownOpen === result.name && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 p-2">
                                <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-700">
                                  <span className="text-xs text-gray-400">选择安装目标</span>
                                  <button
                                    onClick={handleSelectAllAgents}
                                    className="text-xs text-blue-400 hover:text-blue-300"
                                  >
                                    {tempInstallTargets.length === agents.length ? '取消全选' : '全选'}
                                  </button>
                                </div>
                                <div className="max-h-40 overflow-y-auto space-y-1">
                                  {agents.map(a => (
                                    <label key={a.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-700 rounded cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={tempInstallTargets.includes(a.id)}
                                        onChange={() => toggleTempTarget(a.id)}
                                        className="w-4 h-4 accent-green-500"
                                      />
                                      <span className="text-sm text-gray-200">{a.identityEmoji} {a.identityName}</span>
                                    </label>
                                  ))}
                                </div>
                                <div className="mt-2 pt-2 border-t border-gray-700">
                                  <button
                                    onClick={() => {
                                      setInstallToAllAgents(tempInstallTargets.length === agents.length)
                                      setSelectedInstallTargets(tempInstallTargets.length === agents.length ? [] : tempInstallTargets)
                                      handleCloseInstallDropdown()
                                      // Trigger install
                                      const targetMsg = tempInstallTargets.length === agents.length ? '所有 Agent' : `${tempInstallTargets.length} 个 Agent`
                                      if (!confirm(`确定要安装 "${result.name}" 到 ${targetMsg} 吗？`)) return
                                      setIsInstalling(true)
                                      fetch('/api/skills', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ action: 'install', skillName: result.name, targetAgents: tempInstallTargets.length === agents.length ? 'all' : tempInstallTargets })
                                      }).then(r => r.json()).then(data => {
                                        alert(data.message)
                                        if (data.success) {
                                          setClawhubResults([])
                                          setClawhubQuery('')
                                          fetchInstalledSkills()
                                        }
                                        setIsInstalling(false)
                                      }).catch(() => { alert('安装失败'); setIsInstalling(false) })
                                    }}
                                    disabled={tempInstallTargets.length === 0}
                                    className="w-full px-3 py-1.5 text-sm bg-green-500 text-white hover:bg-green-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    确认安装 ({tempInstallTargets.length})
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : clawhubQuery && !isSearching ? (
                    <div className="text-center py-12 text-gray-500">
                      <p>未找到相关技能</p>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                      <p>输入关键词搜索 ClawHub 技能</p>
                      <p className="text-sm mt-2">例如: weather, github, database, slack...</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Memory */}
          {activeTab === 'memory' && (
            <div className="p-4 md:p-6">
              <div className="mb-4">
                <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
                  <button onClick={() => setMemoryFilter('all')} className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap ${memoryFilter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400'}`}>全部</button>
                  <button onClick={() => setMemoryFilter('daily')} className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap ${memoryFilter === 'daily' ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400'}`}>每日</button>
                  <button onClick={() => setMemoryFilter('long-term')} className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap ${memoryFilter === 'long-term' ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400'}`}>长期</button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  <button onClick={() => setMemoryAgentFilter('all')} className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap ${memoryAgentFilter === 'all' ? 'bg-purple-500 text-white' : 'bg-gray-800 text-gray-400'}`}>全部Agent</button>
                  {agents.map(agent => (
                    <button key={agent.id} onClick={() => setMemoryAgentFilter(agent.id)} className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1 whitespace-nowrap ${memoryAgentFilter === agent.id ? 'bg-purple-500 text-white' : 'bg-gray-800 text-gray-400'}`}>
                      <span>{agent.identityEmoji}</span>{agent.identityName}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3 max-w-3xl">
                {memories.filter(m => 
                  (memoryFilter === 'all' || m.type === memoryFilter) && 
                  (memoryAgentFilter === 'all' || m.agentId === memoryAgentFilter)
                ).map(memory => (
                  <div key={memory.id} className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-lg">{memory.agentEmoji}</span>
                      <span className="text-sm font-medium text-white">{memory.agentName}</span>
                      <span className="text-gray-600">·</span>
                      <span className="text-sm text-gray-500">{memory.date}</span>
                      <span className={`px-2 py-0.5 text-xs rounded ${memory.type === 'daily' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                        {memory.type === 'daily' ? '每日' : '长期'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mb-2">{memory.preview}</p>
                    <div className="flex gap-2 flex-wrap">
                      {memory.tags.map(tag => <span key={tag} className="px-2 py-0.5 text-xs bg-gray-800 text-gray-400 rounded">{tag}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settings */}
          {activeTab === 'settings' && (
            <div className="p-4 md:p-6 max-w-2xl space-y-4">
              {/* System Settings */}
              <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4 md:p-6 space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">系统设置</h3>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">控制台名称</label>
                  <div className="flex gap-2">
                    <input type="text" id="projectNameInput" defaultValue={projectName} className="linear-input flex-1" placeholder="输入控制台名称..." />
                    <button onClick={async () => {
                      const newName = (document.getElementById('projectNameInput') as HTMLInputElement).value
                      if (!newName.trim()) { alert('名称不能为空'); return }
                      try {
                        const res = await fetch('/api/settings', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ projectName: newName }),
                        })
                        const data = await res.json()
                        if (data.success) {
                          setProjectName(newName)
                          document.title = newName
                          alert('名称修改成功！')
                        } else {
                          alert(data.error || '修改失败')
                        }
                      } catch { alert('修改失败') }
                    }} className="linear-btn-primary">保存</button>
                  </div>
                </div>
              </div>

              {/* Account Settings */}
              <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4 md:p-6 space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">账号设置</h3>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">用户名</label>
                  <div className="flex gap-2">
                    <input type="text" id="usernameInput" defaultValue={currentUser?.username || ''} className="linear-input flex-1" placeholder="输入用户名..." />
                    <button onClick={async () => {
                      const newUsername = (document.getElementById('usernameInput') as HTMLInputElement).value
                      if (!newUsername.trim()) { alert('用户名不能为空'); return }
                      try {
                        const res = await fetch('/api/settings', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ newUsername }),
                        })
                        const data = await res.json()
                        if (data.success) {
                          setCurrentUser({ ...currentUser!, username: newUsername, displayName: newUsername })
                          alert('用户名修改成功！')
                        } else {
                          alert(data.error || '修改失败')
                        }
                      } catch { alert('修改失败') }
                    }} className="linear-btn-primary">保存</button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">原密码</label>
                  <input type="password" id="oldPassword" placeholder="输入原密码" className="linear-input w-full" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">新密码</label>
                  <input type="password" id="newPassword" placeholder="输入新密码" className="linear-input w-full" />
                </div>
                <button onClick={async () => {
                  const oldPwd = (document.getElementById('oldPassword') as HTMLInputElement).value
                  const newPwd = (document.getElementById('newPassword') as HTMLInputElement).value
                  if (!oldPwd || !newPwd) { alert('请填写完整'); return }
                  try {
                    const res = await fetch('/api/auth/password', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ username: currentUser?.username, oldPassword: oldPwd, newPassword: newPwd }),
                    })
                    const data = await res.json()
                    if (data.success) {
                      alert('密码修改成功！')
                      ;(document.getElementById('oldPassword') as HTMLInputElement).value = ''
                      ;(document.getElementById('newPassword') as HTMLInputElement).value = ''
                    } else {
                      alert(data.error || '修改失败')
                    }
                  } catch { alert('修改失败') }
                }} className="linear-btn-primary w-full">修改密码</button>
              </div>

              {/* Gateway Management */}
              <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4 md:p-6 space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">网关管理</h3>
                <div className="flex items-center justify-between p-3 bg-gray-850 rounded-lg border border-gray-700">
                  <div>
                    <p className="text-sm text-white">OpenClaw Gateway</p>
                    <p className="text-xs text-gray-500">ws://127.0.0.1:18789</p>
                  </div>
                  <button onClick={async () => {
                    if (!confirm('确定要重启 OpenClaw Gateway 吗？')) return
                    try {
                      const res = await fetch('/api/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'restartGateway' }),
                      })
                      const data = await res.json()
                      if (data.success) {
                        alert('网关重启成功！')
                      } else {
                        alert(data.error || '重启失败')
                      }
                    } catch { alert('重启失败') }
                  }} className="px-4 py-2 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-lg text-sm hover:bg-orange-500/30">
                    重启网关
                  </button>
                </div>
              </div>

              {/* About */}
              <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4 md:p-6">
                <h3 className="text-lg font-medium text-white mb-4">关于</h3>
                <p className="text-sm text-gray-400">{projectName || 'Mission Control'} v1.1.0</p>
              </div>
            </div>
          )}

          {/* Channels */}
          {activeTab === 'channels' && (
            <div className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-white">渠道列表</h2>
                <button onClick={() => setShowCreateChannelModal(true)} className="linear-btn-primary flex items-center gap-2">
                  <Plus className="w-4 h-4" />新增账号
                </button>
              </div>
              <div className="space-y-4 max-w-4xl">
                {channels.length === 0 ? (
                  <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-8 text-center">
                    <Network className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-white font-medium mb-2">暂无渠道配置</h3>
                    <p className="text-sm text-gray-500">渠道用于连接外部消息平台（如飞书、钉钉等）</p>
                  </div>
                ) : (
                  channels.map(channel => (
                    <div key={channel.id} className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${channel.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                            <Network className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-white font-medium">{channel.displayName}</h4>
                            <span className="text-xs text-gray-500">{channel.channelType}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs rounded ${channel.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                            {channel.status === 'active' ? '在线' : '离线'}
                          </span>
                          {!channel.agentId && channel.channelType && channel.accountId && (
                            <button onClick={() => handleDeleteChannel(channel.channelType!, channel.accountId!)} className="p-1.5 hover:bg-red-500/20 rounded text-red-400">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">绑定员工:</span>{' '}
                          <span className={channel.agentId ? 'text-blue-400' : 'text-gray-500'}>{channel.agentName}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">账号ID:</span>{' '}
                          <span className="text-white">{channel.accountId}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Timing / Cron Jobs */}
          {activeTab === 'timing' && (
            <div className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-white">定时任务</h2>
                <button onClick={() => setShowCreateCronModal(true)} className="linear-btn-primary flex items-center gap-2">
                  <Plus className="w-4 h-4" />新建任务
                </button>
              </div>
              <div className="space-y-4 max-w-4xl">
                {cronJobs.length === 0 ? (
                  <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-8 text-center">
                    <Clock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-white font-medium mb-2">暂无定时任务</h3>
                    <p className="text-sm text-gray-500">定时任务可以按照 cron 表达式自动执行</p>
                  </div>
                ) : (
                  cronJobs.map(job => (
                    <div key={job.id} className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${job.enabled ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>
                            <Clock className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-white font-medium">{job.name}</h4>
                              <span className={`px-2 py-0.5 text-xs rounded ${job.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                {job.enabled ? '启用' : '禁用'}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500 font-mono">{job.schedule}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleDeleteCron(job.id)} className="p-1.5 hover:bg-red-500/20 rounded text-red-400">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 mb-2">{job.message || '无消息内容'}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {job.nextRunAt && <span>下次执行: {new Date(job.nextRunAt).toLocaleString('zh-CN')}</span>}
                        <span>Agent: {job.sessionTarget}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Realtime Sessions Tab */}
          {activeTab === 'realtime' && (
            <div className="p-4 md:p-6">
              {/* 左右布局：后台运行任务 | 实时会话 */}
              <div className="flex gap-6 h-[calc(100vh-12rem)]">
                {/* 左侧：后台运行任务 */}
                <div className="w-80 flex-shrink-0 flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-green-400" />
                      <h3 className="text-sm font-medium text-white">后台运行任务</h3>
                      <span className="px-1.5 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">
                        {realtimeTasks.filter(t => t.status === 'running').length} 运行
                      </span>
                    </div>
                    <button 
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/realtime-tasks')
                          const data = await res.json()
                          if (data?.tasks) setRealtimeTasks(data.tasks)
                        } catch (e) { console.log('Failed to refresh tasks', e) }
                      }}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2">
                    {realtimeTasks.length === 0 ? (
                      <div className="bg-gray-900/30 rounded-lg border border-gray-800 p-4 text-center">
                        <p className="text-sm text-gray-500">暂无后台运行任务</p>
                      </div>
                    ) : (
                      realtimeTasks.map((task, i) => {
                        const agent = agents.find(a => a.id === task.agentId)
                        return (
                          <div 
                            key={i}
                            className={`bg-gray-900/50 rounded-lg border p-3 ${
                              task.status === 'running' 
                                ? 'border-green-500/50 hover:border-green-500/80' 
                                : task.status === 'error'
                                ? 'border-red-500/50 hover:border-red-500/80'
                                : 'border-gray-700'
                            } cursor-pointer transition-colors group`}
                            onClick={() => {
                              if (task.sessionId) {
                                const session = realtimeSessions.find(s => s.id === task.sessionId)
                                if (session) handleViewSession(session)
                              }
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${
                                  task.status === 'running' ? 'bg-green-400 animate-pulse' : 
                                  task.status === 'error' ? 'bg-red-400' : 'bg-gray-500'
                                }`} />
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-white">
                                      {agent?.identityEmoji || '🤖'} {task.agentName}
                                    </span>
                                    {task.isSubagent && (
                                      <span className="text-xs px-1 py-0.5 rounded bg-purple-500/20 text-purple-400">
                                        Subagent
                                      </span>
                                    )}
                                    {task.isMainAgent && (
                                      <span className="text-xs px-1 py-0.5 rounded bg-blue-500/20 text-blue-400">
                                        主进程
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                                      task.status === 'running' 
                                        ? 'bg-green-500/20 text-green-400' 
                                        : task.status === 'error'
                                        ? 'bg-red-500/20 text-red-400'
                                        : 'bg-gray-700 text-gray-400'
                                    }`}>
                                      {task.status === 'running' ? '运行中' : task.status === 'error' ? '失败' : '空闲'}
                                    </span>
                                    {task.model && (
                                      <span className="text-xs text-gray-500 font-mono truncate max-w-[80px]">
                                        {task.model.split('/').pop()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {task.lastActive && (
                                  <span className="text-xs text-gray-500">
                                    {new Date(task.lastActive).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                                {/* 杀死按钮：只对 Subagent 和非运行中的任务显示 */}
                                {task.isSubagent && task.status !== 'running' && (
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation()
                                      if (!confirm(`确定要杀死 ${task.agentName} 的任务吗？`)) return
                                      try {
                                        const res = await fetch(`/api/realtime-tasks?sessionKey=${encodeURIComponent(task.sessionKey)}`, {
                                          method: 'DELETE'
                                        })
                                        const data = await res.json()
                                        if (data.error) {
                                          alert(data.error)
                                        } else {
                                          // Refresh tasks
                                          const tasksRes = await fetch('/api/realtime-tasks')
                                          const tasksData = await tasksRes.json()
                                          if (tasksData?.tasks) setRealtimeTasks(tasksData.tasks)
                                        }
                                      } catch (err) {
                                        console.error('Failed to kill task:', err)
                                        alert('终止任务失败')
                                      }
                                    }}
                                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded text-red-400 hover:text-red-300 transition-all"
                                    title="杀死任务"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                            {task.task && task.task !== task.agentName && (
                              <p className="text-xs text-gray-400 mt-1.5 truncate">
                                {task.task}
                              </p>
                            )}
                            {task.childSessions && task.childSessions.length > 0 && (
                              <div className="mt-2 text-xs text-gray-500">
                                子任务: {task.childSessions.length} 个
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* 右侧：实时会话 */}
                <div className="flex-1 flex flex-col min-w-0">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-medium text-white">实时会话</h2>
                    <div className="flex gap-2">
                      <select 
                        value={sessionFilter.agentId || ''} 
                        onChange={e => setSessionFilter({ ...sessionFilter, agentId: e.target.value || undefined })}
                        className="linear-input text-sm"
                      >
                        <option value="">全员工</option>
                        {agents.map(a => <option key={a.id} value={a.id}>{a.identityEmoji} {a.identityName}</option>)}
                      </select>
                      <select 
                        value={sessionFilter.projectId || ''} 
                        onChange={e => setSessionFilter({ ...sessionFilter, projectId: e.target.value ? Number(e.target.value) : undefined })}
                        className="linear-input text-sm"
                  >
                    <option value="">全项目</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
                  </select>
                  <button onClick={async () => {
                    try {
                      const params = new URLSearchParams()
                      if (sessionFilter.agentId) params.set('agentId', sessionFilter.agentId)
                      if (sessionFilter.projectId) params.set('projectId', String(sessionFilter.projectId))
                      const res = await fetch(`/api/sessions?${params}`)
                      const data = await res.json()
                      if (Array.isArray(data)) {
                        setRealtimeSessions(data)
                      } else if (data.error) {
                        console.error('Failed to fetch sessions:', data.error)
                      }
                      // Also refresh realtime tasks
                      const tasksRes = await fetch('/api/realtime-tasks')
                      const tasksData = await tasksRes.json()
                      if (tasksData?.tasks) setRealtimeTasks(tasksData.tasks)
                    } catch (error) {
                      console.error('Failed to fetch sessions:', error)
                    }
                  }} className="linear-btn-secondary flex items-center gap-1">
                    <RefreshCw className="w-4 h-4" />刷新
                  </button>
                </div>
              </div>
              <div className="space-y-4 max-w-4xl">
                {realtimeSessions
                  .filter(s => {
                    if (sessionFilter.agentId && s.agentId !== sessionFilter.agentId) return false
                    // Use loose equality for projectId comparison
                    if (sessionFilter.projectId && String(s.projectId) !== String(sessionFilter.projectId)) return false
                    // Search filter
                    if (searchQuery) {
                      const query = searchQuery.toLowerCase()
                      if (!s.title?.toLowerCase().includes(query) && 
                          !s.agentName?.toLowerCase().includes(query) &&
                          !s.projectName?.toLowerCase().includes(query) &&
                          !s.id?.toLowerCase().includes(query)) {
                        return false
                      }
                    }
                    return true
                  })
                  .map(session => (
                  <div 
                    key={session.id} 
                    className="bg-gray-900/50 rounded-xl border border-gray-800 p-4 hover:border-green-500/50 cursor-pointer transition-colors"
                    onClick={() => handleViewSession(session)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center">
                          <Zap className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-white font-medium">{session.title}</h4>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            {session.projectName ? (
                              <>
                                <span>{session.projectEmoji} {session.projectName}</span>
                                <span>·</span>
                              </>
                            ) : (
                              <span className="text-yellow-500">未分类</span>
                            )}
                            <span>{session.agentName}</span>
                            <span>·</span>
                            <span>{session.messageCount} 条消息</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mb-2 flex-wrap">
                      {session.autoTags?.map((tag: string) => (
                        <span key={tag} className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">{tag}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{new Date(session.lastMessage).toLocaleString('zh-CN')}</span>
                    </div>
                  </div>
                ))}
                {realtimeSessions.filter(s => {
                  if (sessionFilter.agentId && s.agentId !== sessionFilter.agentId) return false
                  if (sessionFilter.projectId && s.projectId !== sessionFilter.projectId) return false
                  return true
                }).length === 0 && (
                  <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-8 text-center">
                    <Zap className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-white font-medium mb-2">暂无实时会话</h3>
                    <p className="text-sm text-gray-500">实时会话直接从会话文件读取</p>
                  </div>
                )}
              </div>
                </div>
              </div>
            </div>
          )}

          {/* Logs Tab - OpenClaw 日志查看器 */}
          {activeTab === 'logs' && (
            <div className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-white">工具日志</h2>
                <div className="flex gap-2 items-center">
                  <select
                    value={logFilter.level || ''}
                    onChange={e => setLogFilter({ ...logFilter, level: e.target.value || undefined })}
                    className="linear-input text-sm"
                  >
                    <option value="">全部级别</option>
                    <option value="DEBUG">DEBUG</option>
                    <option value="INFO">INFO</option>
                    <option value="WARN">WARN</option>
                    <option value="ERROR">ERROR</option>
                  </select>
                  <select
                    value={logFilter.subsystem || ''}
                    onChange={e => setLogFilter({ ...logFilter, subsystem: e.target.value || undefined })}
                    className="linear-input text-sm"
                  >
                    <option value="">全部分类</option>
                    {logSubsystems.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input
                    type="text"
                    placeholder="搜索日志..."
                    value={logFilter.search || ''}
                    onChange={e => setLogFilter({ ...logFilter, search: e.target.value || undefined })}
                    className="linear-input text-sm w-48"
                  />
                  <button onClick={async () => {
                    const params = new URLSearchParams()
                    if (logFilter.level) params.set('level', logFilter.level)
                    if (logFilter.subsystem) params.set('subsystem', logFilter.subsystem)
                    if (logFilter.search) params.set('search', logFilter.search)
                    params.set('limit', '500')
                    const res = await fetch(`/api/logs?${params}`)
                    const data = await res.json()
                    setLogs(data.logs || [])
                    if (data.subsystems) setLogSubsystems(data.subsystems)
                  }} className="linear-btn-secondary flex items-center gap-1">
                    <RefreshCwIcon className="w-4 h-4" />刷新
                  </button>
                </div>
              </div>
              <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
                <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800 text-gray-400 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-2 w-36">时间</th>
                        <th className="text-left px-4 py-2 w-20">级别</th>
                        <th className="text-left px-4 py-2 w-40">分类</th>
                        <th className="text-left px-4 py-2">消息</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {[...logs].reverse().map((log, i) => (
                        <tr key={i} className="hover:bg-gray-800/50">
                          <td className="px-4 py-2 text-gray-400 font-mono text-xs whitespace-nowrap">
                            {new Date(log.time).toLocaleTimeString('zh-CN')}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              log.level === 'ERROR' ? 'bg-red-500/20 text-red-400' :
                              log.level === 'WARN' ? 'bg-yellow-500/20 text-yellow-400' :
                              log.level === 'DEBUG' ? 'bg-gray-500/20 text-gray-400' :
                              'bg-green-500/20 text-green-400'
                            }`}>
                              {log.level}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-blue-400 text-xs truncate max-w-xs" title={log.name}>
                            {log.name}
                          </td>
                          <td className="px-4 py-2 text-gray-300 text-xs font-mono">
                            {log.message}
                          </td>
                        </tr>
                      ))}
                      {logs.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                            暂无日志数据
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <CreateTaskModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} onCreate={handleCreateTask} agents={agents} />
      <CreateProjectModal isOpen={showCreateProjectModal} onClose={() => setShowCreateProjectModal(false)} onCreate={handleCreateProject} agents={agents} />
      <CreateAgentModal isOpen={showCreateAgentModal} onClose={() => setShowCreateAgentModal(false)} onCreate={handleCreateAgent} channels={channels} />
      <AddModelModal isOpen={showAddModelModal} onClose={() => setShowAddModelModal(false)} onAdd={handleAddModel} providers={modelsConfig.providers} />
      <EditModelModal 
        isOpen={showEditModelModal} 
        onClose={() => setShowEditModelModal(false)} 
        onUpdate={handleUpdateModel}
        providerId={editingModel?.providerId || ''}
        model={editingModel?.model || null}
      />
      <CreateChannelModal isOpen={showCreateChannelModal} onClose={() => setShowCreateChannelModal(false)} onCreate={handleCreateChannel} />
      <CreateCronModal isOpen={showCreateCronModal} onClose={() => setShowCreateCronModal(false)} onCreate={handleCreateCron} agents={agents} />
      
      {/* Edit Agent Files Modal */}
      {editingSoulAgent && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditingSoulAgent(null)}>
          <div className="bg-gray-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-gray-700" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Brain className="w-5 h-5" />编辑配置 - {editingSoulAgent.identityName}
              </h3>
              <button onClick={() => setEditingSoulAgent(null)} className="p-1 hover:bg-gray-700 rounded"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            {/* Tabs */}
            <div className="flex border-b border-gray-700">
              <button onClick={() => setActiveEditTab('agents')} className={`px-4 py-2 text-sm font-medium ${activeEditTab === 'agents' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'}`}>AGENTS.md</button>
              <button onClick={() => setActiveEditTab('soul')} className={`px-4 py-2 text-sm font-medium ${activeEditTab === 'soul' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'}`}>SOUL.md</button>
              <button onClick={() => setActiveEditTab('user')} className={`px-4 py-2 text-sm font-medium ${activeEditTab === 'user' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'}`}>USER.md</button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {activeEditTab === 'agents' && (
                <div className="space-y-4">
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-3">
                    <p className="text-sm text-blue-300">💡 AGENTS.md 定义了 agent 的工作规范、工具使用、行为准则等。</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">会话启动 (Session Startup)</label>
                    <textarea 
                      value={agentsForm.sessionStartup} 
                      onChange={e => setAgentsForm({ ...agentsForm, sessionStartup: e.target.value })}
                      className="linear-input w-full h-20 resize-none"
                      placeholder="填写示例：\n1. 读取 SOUL.md 了解核心价值观\n2. 读取 USER.md 了解服务对象\n3. 读取 memory/ 目录回顾近期记忆"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">记忆机制 (Memory)</label>
                    <textarea 
                      value={agentsForm.memory} 
                      onChange={e => setAgentsForm({ ...agentsForm, memory: e.target.value })}
                      className="linear-input w-full h-20 resize-none"
                      placeholder="填写示例：\n每日记录：memory/YYYY-MM-DD.md\n长期记忆：MEMORY.md\n定期整理重要信息"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">红线 (Red Lines)</label>
                    <textarea 
                      value={agentsForm.redLines} 
                      onChange={e => setAgentsForm({ ...agentsForm, redLines: e.target.value })}
                      className="linear-input w-full h-20 resize-none"
                      placeholder="填写示例：\n不泄露用户隐私\n不执行未授权操作\n不在群里主动发言"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">安全操作 (External vs Internal)</label>
                    <textarea 
                      value={agentsForm.externalVsInternal} 
                      onChange={e => setAgentsForm({ ...agentsForm, externalVsInternal: e.target.value })}
                      className="linear-input w-full h-20 resize-none"
                      placeholder="填写示例：\n安全操作：读取文件、搜索、学习\n需确认操作：发送消息、删除数据、执行命令"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">群聊规范 (Group Chat)</label>
                    <textarea 
                      value={agentsForm.groupChat} 
                      onChange={e => setAgentsForm({ ...agentsForm, groupChat: e.target.value })}
                      className="linear-input w-full h-20 resize-none"
                      placeholder="填写示例：\n收到邀请时判断是否参与\n避免过度回复，保持自然"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">心跳检测 (Heartbeat)</label>
                    <textarea 
                      value={agentsForm.heartbeat} 
                      onChange={e => setAgentsForm({ ...agentsForm, heartbeat: e.target.value })}
                      className="linear-input w-full h-20 resize-none"
                      placeholder="填写示例：\n定期检查邮件、日历\n有重要内容时主动通知用户"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">工具使用 (Tools)</label>
                    <textarea 
                      value={agentsForm.tools} 
                      onChange={e => setAgentsForm({ ...agentsForm, tools: e.target.value })}
                      className="linear-input w-full h-20 resize-none"
                      placeholder="填写示例：\n使用 Skills 完成专业任务\n复杂任务使用子代理"
                    />
                  </div>
                </div>
              )}
              {activeEditTab === 'soul' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">核心理念 (Core Truths)</label>
                    <textarea 
                      value={soulForm.coreTruths} 
                      onChange={e => setSoulForm({ ...soulForm, coreTruths: e.target.value })}
                      className="linear-input w-full h-24 resize-none"
                      placeholder={"填写示例：\n1. 真正帮助用户，而不是敷衍了事\n2. 有自己的想法和判断，敢表达不同意见\n3. 主动发现问题并解决，而不是等待指令\n4. 持续学习和改进，越用越好用"}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">边界 (Boundaries)</label>
                    <textarea 
                      value={soulForm.boundaries} 
                      onChange={e => setSoulForm({ ...soulForm, boundaries: e.target.value })}
                      className="linear-input w-full h-20 resize-none"
                      placeholder={"填写示例：\n1. 隐私至上，未经用户许可不泄露任何信息\n2. 不确定的事情主动询问，不瞎猜\n3. 危险操作（如删除、发布）必须确认\n4. 保持诚信，不隐瞒问题和错误"}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">风格 (Vibe)</label>
                    <textarea 
                      value={soulForm.vibe} 
                      onChange={e => setSoulForm({ ...soulForm, vibe: e.target.value })}
                      className="linear-input w-full h-20 resize-none"
                      placeholder={"填写示例：\n1. 简洁实用，说重点，不废话\n2. 像朋友聊天，而不是客服机器人\n3. 适度幽默，但不失专业\n4. 直接给出方案，不绕弯子"}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">连续性 (Continuity)</label>
                    <textarea 
                      value={soulForm.continuity} 
                      onChange={e => setSoulForm({ ...soulForm, continuity: e.target.value })}
                      className="linear-input w-full h-20 resize-none"
                      placeholder={"填写示例：\n1. 通过文件持久化记忆，跨会话保持上下文\n2. 记录重要决策和上下文，下次直接继续\n3. 学习用户的偏好和习惯，越用越懂用户\n4. 定期整理记忆，删除无用信息"}
                    />
                  </div>
                </div>
              )}
              {activeEditTab === 'user' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">用户名称</label>
                      <input 
                        value={userForm.name} 
                        onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                        className="linear-input w-full"
                        placeholder="填写示例：张扬"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">称呼方式</label>
                      <input 
                        value={userForm.callName} 
                        onChange={e => setUserForm({ ...userForm, callName: e.target.value })}
                        className="linear-input w-full"
                        placeholder="填写示例：张老师"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">代词</label>
                      <input 
                        value={userForm.pronouns} 
                        onChange={e => setUserForm({ ...userForm, pronouns: e.target.value })}
                        className="linear-input w-full"
                        placeholder="填写示例：他"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">时区</label>
                      <input 
                        value={userForm.timezone} 
                        onChange={e => setUserForm({ ...userForm, timezone: e.target.value })}
                        className="linear-input w-full"
                        placeholder="填写示例：Asia/Shanghai"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">备注</label>
                    <textarea 
                      value={userForm.notes} 
                      onChange={e => setUserForm({ ...userForm, notes: e.target.value })}
                      className="linear-input w-full h-20 resize-none"
                      placeholder={"填写示例：\n- 专注于软件开发场景\n- 喜欢简洁实用的工具\n- 常用编程语言：JavaScript/TypeScript\n- 使用钉钉进行沟通"}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">上下文</label>
                    <textarea 
                      value={userForm.context} 
                      onChange={e => setUserForm({ ...userForm, context: e.target.value })}
                      className="linear-input w-full h-20 resize-none"
                      placeholder={"填写示例：\n- 需要管理多个AI助手团队\n- 使用Mission Control作为控制中心\n- 经常需要批量操作和定时任务"}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-700">
              <button onClick={() => setEditingSoulAgent(null)} className="px-4 py-2 text-gray-400 hover:text-white">取消</button>
              <button onClick={handleSaveSoul} className="linear-btn-primary">保存全部</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Agent Name/Emoji Modal */}
      {editingAgentInfo && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditingAgentInfo(null)}>
          <div className="bg-gray-800 rounded-xl w-full max-w-md border border-gray-700" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">编辑员工信息</h3>
              <button onClick={() => setEditingAgentInfo(null)} className="p-1 hover:bg-gray-700 rounded">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">员工名称（显示名称，非ID）</label>
                <input
                  type="text"
                  value={editingAgentInfo.name}
                  onChange={e => setEditingAgentInfo({ ...editingAgentInfo, name: e.target.value })}
                  className="linear-input w-full"
                  placeholder="输入员工显示名称"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">员工头像</label>
                <div className="grid grid-cols-8 gap-2">
                  {['🤖', '🧑‍💻', '🧑‍🔧', '🧑‍🎨', '🧑‍💼', '🧑‍🔬', '🧑‍🚀', '🧑‍🏫', '🐂', '🦊', '🐸', '🦄', '🐼', '🐨', '🦁', '🐯', '🌟', '💡', '🎯', '🚀', '⚡', '🔥', '💎', '🎸'].map(e => (
                    <button
                      key={e}
                      onClick={() => setEditingAgentInfo({ ...editingAgentInfo, emoji: e })}
                      className={`w-10 h-10 text-xl rounded-lg border ${editingAgentInfo.emoji === e ? 'border-blue-500 bg-blue-500/20' : 'border-gray-600 bg-gray-700 hover:border-gray-500'}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-700">
              <button onClick={() => setEditingAgentInfo(null)} className="linear-btn-secondary">取消</button>
              <button onClick={handleSaveAgentInfo} className="linear-btn-primary">保存</button>
            </div>
          </div>
        </div>
      )}

      <ProjectHistoryModal isOpen={showProjectHistoryModal} onClose={() => setShowProjectHistoryModal(false)} project={selectedProjectForHistory} history={projectHistory} />
      <ConversationDetailModal 
        isOpen={showConversationDetail} 
        onClose={() => setShowConversationDetail(false)} 
        conversation={selectedConversation}
        messages={conversationMessages}
        projects={projects}
        onAssign={handleAssignProject}
      />
      <SkillDetailModal 
        skill={selectedSkill} 
        agents={agents}
        installedSkillsByAgent={installedSkillsByAgent}
        onClose={() => { setSelectedSkill(null); setCopyTargetAgents([]) }} 
        onCopySuccess={fetchInstalledSkills}
        onDeleteSuccess={fetchInstalledSkills}
      />
      
      {/* Session Detail Modal */}
      {showSessionDetail && selectedSession && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowSessionDetail(false)}>
          <div className="bg-gray-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-gray-700" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-green-400" />实时会话详情
                </h3>
                <p className="text-sm text-gray-400">{selectedSession.agentName} · {selectedSession.messageCount} 条消息</p>
              </div>
              <button onClick={() => setShowSessionDetail(false)} className="p-1 hover:bg-gray-700 rounded"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            {/* Project and Tags */}
            <div className="p-3 border-b border-gray-700 bg-gray-900/30">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm text-gray-400">项目:</span>
                <select 
                  value={selectedSession.projectId || ''} 
                  onChange={async (e) => {
                    const newProjectId = e.target.value ? Number(e.target.value) : null
                    console.log('Changing project to:', newProjectId, 'for session:', selectedSession.id)
                    try {
                      const res = await fetch('/api/sessions', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId: selectedSession.id, projectId: newProjectId })
                      })
                      const result = await res.json()
                      console.log('PATCH result:', result)
                      setSelectedSession({ ...selectedSession, projectId: newProjectId })
                      // Refresh sessions
                      const refreshRes = await fetch('/api/sessions')
                      const data = await refreshRes.json()
                      console.log('Refresh result:', Array.isArray(data) ? `${data.length} sessions` : data.error)
                      if (Array.isArray(data)) setRealtimeSessions(data)
                    } catch (err) {
                      console.error('Error updating project:', err)
                    }
                  }}
                  className="linear-input text-sm"
                >
                  <option value="">未分类</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-400">标签:</span>
                {selectedSession.autoTags?.map((tag: string) => (
                  <span key={tag} className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">{tag}</span>
                ))}
                {customTags.map((tag, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded flex items-center gap-1">
                    {tag}
                    <button onClick={() => handleRemoveCustomTag(tag)} className="hover:text-white">×</button>
                  </span>
                ))}
                <input 
                  type="text" 
                  placeholder="+ 添加标签" 
                  className="bg-transparent border border-gray-600 rounded px-2 py-0.5 text-xs text-gray-300 focus:border-blue-500 outline-none"
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      const newTag = e.currentTarget.value.trim()
                      handleAddCustomTag(newTag)
                      e.currentTarget.value = ''
                    }
                  }}
                />
              </div>
            </div>
            <div className="p-4 max-h-[50vh] overflow-y-auto space-y-4">
              {sessionMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg p-3 ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-100'}`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p className="text-xs opacity-50 mt-1">{new Date(msg.timestamp).toLocaleString('zh-CN')}</p>
                  </div>
                </div>
              ))}
              {sessionMessages.length === 0 && (
                <p className="text-center text-gray-500">暂无消息</p>
              )}
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-700">
              <button onClick={() => setShowSessionDetail(false)} className="px-4 py-2 text-gray-400 hover:text-white">关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
