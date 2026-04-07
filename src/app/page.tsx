'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Inbox, Calendar, FolderKanban, Brain, Settings, Users, Plus, Search,
  MoreHorizontal, ChevronDown, Clock, User, Bot, X, Check, RefreshCw,
  Activity, Terminal, ChevronLeft, ChevronRight, Sparkles, LogOut, Trash2,
  Network,
} from 'lucide-react'

type Tab = 'inbox' | 'calendar' | 'projects' | 'memory' | 'agents' | 'skills' | 'settings' | 'channels'
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
}

interface Skill {
  name: string
  status: 'ready' | 'needs_setup' | 'unknown'
  description: string
}

interface CalendarEvent {
  id: number | string
  title: string
  date: string
  time: string
  type: 'cron' | 'one-time'
  status: 'scheduled' | 'running' | 'completed' | 'failed'
  agent_id?: string
  agent_name?: string
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
  lastMessage?: string
  updatedAt: string
  channelType?: string
  accountId?: string
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

  const modelOptions = [
    { value: 'minimax/MiniMax-M2.7', label: 'MiniMax-M2.7 (默认)' },
    { value: 'cli-proxy/qwen3-coder-plus', label: 'Qwen3-Coder-Plus (代码)' },
    { value: 'cli-proxy/kimi-k2-thinking', label: 'Kimi-K2-Thinking (思考)' },
    { value: 'cli-proxy/kimi-k2.5', label: 'Kimi-K2.5 (多模态)' },
    { value: 'volcengine/ark-code-latest', label: 'Ark-Code-Latest (代码)' },
    { value: 'volcengine/doubao-seed-2.0-pro', label: 'Doubao-Seed-2.0-Pro' },
    { value: 'volcengine/doubao-seed-2.0-code', label: 'Doubao-Seed-2.0-Code' },
    { value: 'volcengine/doubao-seed-2.0-lite', label: 'Doubao-Seed-2.0-Lite' },
    { value: 'volcengine/kimi-k2.5', label: 'Kimi-K2.5 (多模态)' },
    { value: 'volcengine/glm-4.7', label: 'GLM-4.7 (通用)' },
    { value: 'volcengine/deepseek-v3.2', label: 'DeepSeek-V3.2' },
  ]

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
                <option key={c.id} value={c.id}>{c.name}（未绑定）</option>
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

const ProjectCard = ({ project, onDelete }: { project: Project; onDelete: (id: number) => void }) => {
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

const AgentCard = ({ agent, onModelChange, onDelete, channels, onChannelChange }: { 
  agent: Agent; 
  onModelChange: (agentId: string, newModel: string) => void
  onDelete: (agentId: string) => void
  channels: Channel[]
  onChannelChange: (agentId: string, newChannel: string) => void
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [selectedModel, setSelectedModel] = useState(agent.model)
  const [showMenu, setShowMenu] = useState(false)
  const [isEditingChannel, setIsEditingChannel] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState(agent.boundChannel || '')

  const handleSave = () => {
    onModelChange(agent.id, selectedModel)
    setIsEditing(false)
  }

  const handleChannelSave = () => {
    onChannelChange(agent.id, selectedChannel)
    setIsEditingChannel(false)
  }

  // Get all channels and unassigned ones (excluding the one already bound to this agent)
  const availableChannels = channels.filter(c => !c.agentId || c.id === agent.boundChannel)

  const allModels = [
    { value: 'minimax/MiniMax-M2.7', label: 'minimax/MiniMax-M2.7 (默认推理)' },
    { value: 'cli-proxy/qwen3-coder-plus', label: 'cli-proxy/qwen3-coder-plus (代码专家)' },
    { value: 'cli-proxy/kimi-k2-thinking', label: 'cli-proxy/kimi-k2-thinking (思考模型)' },
    { value: 'cli-proxy/kimi-k2.5', label: 'cli-proxy/kimi-k2.5 (多模态)' },
    { value: 'volcengine/ark-code-latest', label: 'volcengine/ark-code-latest (代码)' },
    { value: 'volcengine/doubao-seed-2.0-pro', label: 'volcengine/doubao-seed-2.0-pro' },
    { value: 'volcengine/doubao-seed-2.0-code', label: 'volcengine/doubao-seed-2.0-code' },
    { value: 'volcengine/doubao-seed-2.0-lite', label: 'volcengine/doubao-seed-2.0-lite' },
    { value: 'volcengine/glm-4.7', label: 'volcengine/glm-4.7' },
    { value: 'volcengine/deepseek-v3.2', label: 'volcengine/deepseek-v3.2' },
    { value: 'volcengine/minimax-m2.5', label: 'volcengine/minimax-m2.5' },
    { value: 'volcengine/kimi-k2.5', label: 'volcengine/kimi-k2.5 (多模态)' },
  ]

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
                <option key={c.id} value={c.id}>{c.name}</option>
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
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [memories, setMemories] = useState<MemoryEntry[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false)
  const [showCreateAgentModal, setShowCreateAgentModal] = useState(false)
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false)
  const [activityExpanded, setActivityExpanded] = useState(true)
  const [currentUser, setCurrentUser] = useState<{ username: string; displayName: string } | null>(null)
  const [memoryFilter, setMemoryFilter] = useState<MemoryFilter>('all')
  const [memoryAgentFilter, setMemoryAgentFilter] = useState<string>('all')
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [apiStatus, setApiStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting')

  const getCookie = (name: string): string | null => {
    if (typeof document === 'undefined') return null
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
    return match ? match[2] : null
  }

  useEffect(() => {
    const auth = getCookie('mc-auth')
    const userStr = getCookie('mc-user')
    if (auth === 'true' && userStr) {
      try {
        setCurrentUser(JSON.parse(decodeURIComponent(userStr)))
      } catch { router.push('/login') }
    } else { router.push('/login') }
  }, [router])

  // Auto-reset calendar to current month when switching to calendar tab
  useEffect(() => {
    if (activeTab === 'calendar') {
      setCalendarMonth(new Date())
    }
  }, [activeTab])

  // Fetch real data
  const fetchData = async () => {
    setApiStatus('connecting')
    try {
      const [tasksRes, projectsRes, eventsRes, agentsRes, memoriesRes, channelsRes] = await Promise.all([
        fetch('/api/tasks').then(r => r.json()),
        fetch('/api/projects').then(r => r.json()),
        fetch('/api/events').then(r => r.json()),
        fetch('/api/agents').then(r => r.json()),
        fetch('/api/memory').then(r => r.json()),
        fetch('/api/channels').then(r => r.json()),
      ])

      if (Array.isArray(tasksRes)) setTasks(tasksRes)
      if (Array.isArray(projectsRes)) setProjects(projectsRes)
      if (agentsRes.agents) setAgents(agentsRes.agents)
      
      // Skills from agents API
      if (agentsRes.skills) setSkills(agentsRes.skills)
      
      // Events: combine custom + cron
      if (eventsRes.custom || eventsRes.cron) {
        const custom = eventsRes.custom || []
        const cron = eventsRes.cron || []
        setCalendarEvents([...cron, ...custom])
      }

      // Memories from memory API
      if (Array.isArray(memoriesRes)) setMemories(memoriesRes)

      // Channels
      if (Array.isArray(channelsRes)) setChannels(channelsRes)

      setApiStatus('connected')
    } catch (error) {
      console.error('Failed to fetch data:', error)
      setApiStatus('disconnected')
    }
  }

  useEffect(() => { fetchData() }, [])

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
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center font-bold text-sm">MC</div>
          <span className="font-semibold text-white text-sm">Mission Control</span>
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
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center font-bold text-sm">MC</div>
                <span className="font-semibold text-white">Mission Control</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-gray-800 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <nav className="flex-1 p-2 overflow-auto">
              {[
                { id: 'inbox', label: '任务看板', icon: Inbox },
                { id: 'calendar', label: '日历', icon: Calendar },
                { id: 'projects', label: '项目', icon: FolderKanban },
                { id: 'agents', label: '员工', icon: Users },
                { id: 'skills', label: '技能', icon: Sparkles },
                { id: 'memory', label: '记忆', icon: Brain },
                { id: 'channels', label: '渠道', icon: Network },
                { id: 'settings', label: '设置', icon: Settings },
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
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center font-bold text-sm">MC</div>
            <span className="font-semibold text-white">Mission Control</span>
          </div>
        </div>
        <nav className="flex-1 p-2">
          {[
            { id: 'inbox', label: '任务看板', icon: Inbox },
            { id: 'calendar', label: '日历', icon: Calendar },
            { id: 'projects', label: '项目', icon: FolderKanban },
            { id: 'agents', label: '员工', icon: Users },
            { id: 'skills', label: '技能', icon: Sparkles },
            { id: 'memory', label: '记忆', icon: Brain },
            { id: 'channels', label: '渠道', icon: Network },
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
              {activeTab === 'calendar' && '日历'}
              {activeTab === 'projects' && '项目'}
              {activeTab === 'agents' && '员工'}
              {activeTab === 'skills' && '技能'}
              {activeTab === 'memory' && '记忆'}
              {activeTab === 'channels' && '渠道'}
              {activeTab === 'settings' && '设置'}
            </h1>
            <span className="text-sm text-gray-500">
              {activeTab === 'inbox' && `${tasks.length} 个任务`}
              {activeTab === 'projects' && `${projects.length} 个项目`}
              {activeTab === 'agents' && `${agents.length} 个员工`}
              {activeTab === 'skills' && `${skills.length} 个技能`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input type="text" placeholder="搜索..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="linear-input pr-10 w-64" />
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 z-10" />
            </div>
            {activeTab === 'inbox' && <button onClick={() => setShowCreateModal(true)} className="linear-btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />新建任务</button>}
            {activeTab === 'projects' && <button onClick={() => setShowCreateProjectModal(true)} className="linear-btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />新建项目</button>}
            {activeTab === 'agents' && <button onClick={() => setShowCreateAgentModal(true)} className="linear-btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />新建员工</button>}
          </div>
        </header>

        {/* Mobile Header Actions */}
        <header className="md:hidden border-b border-gray-800 p-4 bg-gray-950">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold text-white">
              {activeTab === 'inbox' && '任务看板'}
              {activeTab === 'calendar' && '日历'}
              {activeTab === 'projects' && '项目'}
              {activeTab === 'agents' && '员工'}
              {activeTab === 'skills' && '技能'}
              {activeTab === 'memory' && '记忆'}
              {activeTab === 'channels' && '渠道'}
              {activeTab === 'settings' && '设置'}
            </h1>
            <span className="text-sm text-gray-500">
              {activeTab === 'inbox' && `${tasks.length} 个任务`}
              {activeTab === 'projects' && `${projects.length} 个项目`}
              {activeTab === 'agents' && `${agents.length} 个员工`}
              {activeTab === 'skills' && `${skills.length} 个技能`}
            </span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input type="text" placeholder="搜索..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="linear-input pr-8 w-full text-sm" />
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
            </div>
            {activeTab === 'inbox' && <button onClick={() => setShowCreateModal(true)} className="linear-btn-primary flex items-center gap-1 px-3 py-2 text-sm"><Plus className="w-4 h-4" />新建</button>}
            {activeTab === 'projects' && <button onClick={() => setShowCreateProjectModal(true)} className="linear-btn-primary flex items-center gap-1 px-3 py-2 text-sm"><Plus className="w-4 h-4" />新建</button>}
            {activeTab === 'agents' && <button onClick={fetchData} className="linear-btn-ghost flex items-center gap-1 px-3 py-2 text-sm"><RefreshCw className="w-4 h-4" />刷新</button>}
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
                  <div className="flex-1 space-y-3 overflow-auto">
                    {tasks.slice(0, 5).map(task => (
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

          {/* Calendar */}
          {activeTab === 'calendar' && (
            <div className="p-4 md:p-6 max-w-full overflow-x-auto">
              <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4 md:p-6 min-w-[320px]">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                  <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))} className="p-2 hover:bg-gray-800 rounded-lg"><ChevronLeft className="w-5 h-5 text-gray-400" /></button>
                  <div className="flex items-center gap-3">
                    <h3 className="text-base md:text-lg font-medium text-white">{calendarMonth.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })}</h3>
                    <button onClick={() => setCalendarMonth(new Date())} className="px-2 md:px-3 py-1 text-xs bg-blue-500/20 text-blue-400 rounded-md hover:bg-blue-500/30">今天</button>
                  </div>
                  <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))} className="p-2 hover:bg-gray-800 rounded-lg"><ChevronRight className="w-5 h-5 text-gray-400" /></button>
                </div>
                <div className="grid grid-cols-7 gap-1 md:gap-4 mb-4 md:mb-6">
                  {['日', '一', '二', '三', '四', '五', '六'].map(day => <div key={day} className="text-center text-xs text-gray-500 font-medium py-1">{day}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1 md:gap-2">
                  {(() => {
                    const year = calendarMonth.getFullYear()
                    const month = calendarMonth.getMonth()
                    const firstDay = new Date(year, month, 1).getDay()
                    const daysInMonth = new Date(year, month + 1, 0).getDate()
                    const now = new Date()
                    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
                    const cells = []
                    for (let i = 0; i < firstDay; i++) cells.push(<div key={`empty-${i}`} />)
                    for (let day = 1; day <= daysInMonth; day++) {
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                      const dayEvents = calendarEvents.filter(e => e.date === dateStr)
                      const isToday = dateStr === today
                      cells.push(
                        <div key={day} className={`p-1 md:p-2 rounded-lg min-h-[60px] md:min-h-[80px] border ${isToday ? 'bg-blue-500/10 border-blue-500/50' : 'bg-gray-850 border-gray-800'}`}>
                          <span className={`text-xs md:text-sm font-medium ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>{day}</span>
                          <div className="mt-1 space-y-1">
                            {dayEvents.slice(0, 2).map(event => (
                              <div key={event.id} className="text-xs p-1 bg-gray-800 rounded truncate flex items-center gap-1">
                                <StatusDot status={event.status} />
                                <span className="truncate hidden sm:block">{event.title}</span>
                              </div>
                            ))}
                            {dayEvents.length > 2 && <div className="text-xs text-gray-500">+{dayEvents.length - 2}</div>}
                          </div>
                        </div>
                      )
                    }
                    return cells
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Projects */}
          {activeTab === 'projects' && (
            <div className="p-4 md:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl">
                {projects.map(project => (
                  <ProjectCard key={project.id} project={project} onDelete={handleDeleteProject} />
                ))}
              </div>
            </div>
          )}

          {/* Agents */}
          {activeTab === 'agents' && (
            <div className="p-4 md:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl">
                {agents.map(agent => <AgentCard key={agent.id} agent={agent} onModelChange={handleModelChange} onDelete={handleDeleteAgent} channels={channels} onChannelChange={handleChannelChange} />)}
              </div>
            </div>
          )}

          {/* Skills */}
          {activeTab === 'skills' && (
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-medium text-white mb-2">已安装技能</h3>
                <p className="text-sm text-gray-500">所有 Agent 已安装的技能插件</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {skills.map((skill, i) => (
                  <div key={i} className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${skill.status === 'ready' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-white font-medium text-sm md:text-base">{skill.name}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded ${skill.status === 'ready' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{skill.status === 'ready' ? '已安装' : '需配置'}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">{skill.description}</p>
                  </div>
                ))}
              </div>
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
            <div className="p-4 md:p-6 max-w-2xl">
              <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4 md:p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">账号设置</h3>
                  <div className="space-y-4">
                    <div><label className="block text-sm text-gray-400 mb-1.5">当前账号</label><input type="text" value={currentUser?.username || ''} disabled className="linear-input w-full bg-gray-800" /></div>
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
                </div>
                <div className="border-t border-gray-800 pt-6">
                  <h3 className="text-lg font-medium text-white mb-4">关于</h3>
                  <p className="text-sm text-gray-400">Mission Control v1.0.0</p>
                </div>
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
                            <h4 className="text-white font-medium">{channel.name}</h4>
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
        </div>
      </main>

      <CreateTaskModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} onCreate={handleCreateTask} agents={agents} />
      <CreateProjectModal isOpen={showCreateProjectModal} onClose={() => setShowCreateProjectModal(false)} onCreate={handleCreateProject} agents={agents} />
      <CreateAgentModal isOpen={showCreateAgentModal} onClose={() => setShowCreateAgentModal(false)} onCreate={handleCreateAgent} channels={channels} />
      <CreateChannelModal isOpen={showCreateChannelModal} onClose={() => setShowCreateChannelModal(false)} onCreate={handleCreateChannel} />
    </div>
  )
}
