'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, FolderKanban, Brain, Settings, Sparkles, Plus, Search,
  MoreHorizontal, Clock, User, Bot, X, Check, Trash2,
  Network, Zap, FileText, TrendingUp, Cpu, LogOut,
  ChevronDown, Edit3, Calendar, ListTodo, ArrowLeft,
  GripVertical,
} from 'lucide-react'

type TaskStatus = 'backlog' | 'todo' | 'in-progress' | 'in-review' | 'done'
type Priority = 'urgent' | 'high' | 'medium' | 'low'

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

interface Agent {
  id: string
  name: string
  identityName: string
  identityEmoji: string
  model: string
}

type Tab = 'tasks' | 'agents' | 'models' | 'skills' | 'memory' | 'channels' | 'timing' | 'realtime' | 'logs' | 'usage' | 'settings'

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string }> = {
  urgent: { label: '紧急', color: 'text-red-400', bg: 'bg-red-500/20' },
  high: { label: '高', color: 'text-orange-400', bg: 'bg-orange-500/20' },
  medium: { label: '中', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  low: { label: '低', color: 'text-gray-400', bg: 'bg-gray-500/20' },
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; border: string; headerBg: string }> = {
  backlog: { label: '待办', color: 'text-gray-400', border: 'border-gray-600', headerBg: 'bg-gray-800' },
  todo: { label: '计划中', color: 'text-gray-300', border: 'border-gray-500', headerBg: 'bg-gray-700' },
  'in-progress': { label: '进行中', color: 'text-blue-400', border: 'border-blue-500', headerBg: 'bg-blue-500/10' },
  'in-review': { label: '审核中', color: 'text-orange-400', border: 'border-orange-500', headerBg: 'bg-orange-500/10' },
  done: { label: '已完成', color: 'text-green-400', border: 'border-green-500', headerBg: 'bg-green-500/10' },
}

const PriorityBadge = ({ priority }: { priority: Priority }) => (
  <span className={`px-1.5 py-0.5 text-xs rounded ${PRIORITY_CONFIG[priority].bg} ${PRIORITY_CONFIG[priority].color}`}>
    {PRIORITY_CONFIG[priority].label}
  </span>
)

// Task Card Component
const TaskCard = ({ task, onEdit, onDelete, onStatusChange }: {
  task: Task
  onEdit: (task: Task) => void
  onDelete: (id: number) => void
  onStatusChange: (id: number, status: TaskStatus) => void
}) => {
  const [showMenu, setShowMenu] = useState(false)
  const statuses: TaskStatus[] = ['backlog', 'todo', 'in-progress', 'in-review', 'done']

  return (
    <div className="bg-gray-850 border border-gray-700 rounded-lg p-3 hover:border-gray-600 group relative" draggable>
      <div className="flex items-start justify-between mb-2">
        <PriorityBadge priority={task.priority} />
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-1 hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100">
            <MoreHorizontal className="w-4 h-4 text-gray-500" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20">
              <button onClick={() => { onEdit(task); setShowMenu(false) }} className="w-full px-3 py-2 text-sm text-left text-gray-300 hover:bg-gray-700 flex items-center gap-2">
                <Edit3 className="w-4 h-4" />编辑
              </button>
              <div className="px-3 py-1.5 text-xs text-gray-500">移动到</div>
              {statuses.filter(s => s !== task.status).map(s => (
                <button key={s} onClick={() => { onStatusChange(task.id, s); setShowMenu(false) }} className="w-full px-3 py-1.5 text-sm text-left text-gray-300 hover:bg-gray-700 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[s].border.replace('border-', 'bg-')}`} />
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
              <button onClick={() => { if (confirm('确定删除此任务？')) onDelete(task.id); setShowMenu(false) }} className="w-full px-3 py-2 text-sm text-left text-red-400 hover:bg-gray-700 flex items-center gap-2 border-t border-gray-700 mt-1">
                <Trash2 className="w-4 h-4" />删除
              </button>
            </div>
          )}
        </div>
      </div>
      <h4 className="text-sm text-white font-medium mb-2 line-clamp-2">{task.title}</h4>
      {task.description && (
        <p className="text-xs text-gray-500 mb-2 line-clamp-2">{task.description}</p>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-base">{task.assignee_type === 'ai' ? '🤖' : '👤'}</span>
          <span className="text-xs text-gray-500">{task.assignee_name}</span>
        </div>
        {task.due_date && (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {task.due_date}
          </span>
        )}
      </div>
    </div>
  )
}

// Task Form Modal (Create / Edit)
const TaskFormModal = ({ isOpen, onClose, onSave, agents, task, mode }: {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<Task>) => void
  agents: Agent[]
  task?: Task
  mode: 'create' | 'edit'
}) => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [status, setStatus] = useState<TaskStatus>('backlog')
  const [assigneeType, setAssigneeType] = useState<'ai' | 'human'>('ai')
  const [selectedAgent, setSelectedAgent] = useState('main')
  const [dueDate, setDueDate] = useState('')

  useEffect(() => {
    if (task && mode === 'edit') {
      setTitle(task.title)
      setDescription(task.description || '')
      setPriority(task.priority)
      setStatus(task.status)
      setAssigneeType(task.assignee_type)
      setSelectedAgent(task.assignee_id || 'main')
      setDueDate(task.due_date || '')
    } else {
      setTitle('')
      setDescription('')
      setPriority('medium')
      setStatus('backlog')
      setAssigneeType('ai')
      setSelectedAgent('main')
      setDueDate('')
    }
  }, [task, mode])

  if (!isOpen) return null

  const handleSubmit = () => {
    if (!title.trim()) return
    const agent = agents.find(a => a.id === selectedAgent)
    onSave({
      ...(task?.id ? { id: task.id } : {}),
      title,
      description,
      priority,
      status,
      assignee_type: assigneeType,
      assignee_id: assigneeType === 'human' ? 'human' : selectedAgent,
      assignee_name: assigneeType === 'human' ? '张扬' : (agent?.identityName || '未知'),
      due_date: dueDate || undefined,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-850 border border-gray-700 rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">{mode === 'create' ? '创建任务' : '编辑任务'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">任务标题 *</label>
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
                <option value="urgent">紧急</option>
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </div>
            {mode === 'edit' && (
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">状态</label>
                <select value={status} onChange={e => setStatus(e.target.value as TaskStatus)} className="linear-input w-full">
                  <option value="backlog">待办</option>
                  <option value="todo">计划中</option>
                  <option value="in-progress">进行中</option>
                  <option value="in-review">审核中</option>
                  <option value="done">已完成</option>
                </select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">截止日期</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="linear-input w-full" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">负责人类型</label>
            <div className="flex gap-2">
              <button onClick={() => setAssigneeType('ai')} className={`flex-1 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-1 ${assigneeType === 'ai' ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400'}`}>
                <Bot className="w-4 h-4" />AI
              </button>
              <button onClick={() => setAssigneeType('human')} className={`flex-1 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-1 ${assigneeType === 'human' ? 'bg-purple-500 text-white' : 'bg-gray-800 text-gray-400'}`}>
                <User className="w-4 h-4" />人类
              </button>
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
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 text-sm">取消</button>
          <button onClick={handleSubmit} className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 text-sm font-medium">{mode === 'create' ? '创建' : '保存'}</button>
        </div>
      </div>
    </div>
  )
}

// Main Tasks Page
export default function TasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<{ username: string; displayName: string } | null>(null)
  const [projectName, setProjectName] = useState('OpenClaw Panel')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all')
  const [filterAssignee, setFilterAssignee] = useState<string>('all')
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)

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
      } catch {
        router.push('/login')
      }
    } else {
      router.push('/login')
    }

    const savedProjectName = getCookie('mc-project-name')
    if (savedProjectName) setProjectName(savedProjectName)
  }, [router])

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) setTasks(data)
      }
    } catch (e) {
      console.error('Failed to fetch tasks', e)
    }
  }, [])

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents')
      if (res.ok) {
        const data = await res.json()
        if (data.agents) setAgents(data.agents)
      }
    } catch (e) {
      console.error('Failed to fetch agents', e)
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchTasks(), fetchAgents()])
      setLoading(false)
    }
    load()
  }, [fetchTasks, fetchAgents])

  const handleLogout = () => {
    document.cookie = 'mc-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
    document.cookie = 'mc-user=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
    router.push('/login')
  }

  const handleCreateTask = async (taskData: Partial<Task>) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      })
      if (res.ok) {
        await fetchTasks()
      } else {
        alert('创建任务失败')
      }
    } catch (e) {
      console.error('Failed to create task', e)
      alert('创建任务失败')
    }
  }

  const handleUpdateTask = async (taskData: Partial<Task>) => {
    if (!taskData.id) return
    try {
      const res = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      })
      if (res.ok) {
        await fetchTasks()
      } else {
        alert('更新任务失败')
      }
    } catch (e) {
      console.error('Failed to update task', e)
      alert('更新任务失败')
    }
  }

  const handleDeleteTask = async (taskId: number) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId }),
      })
      if (res.ok) {
        await fetchTasks()
      } else {
        alert('删除任务失败')
      }
    } catch (e) {
      console.error('Failed to delete task', e)
      alert('删除任务失败')
    }
  }

  const handleStatusChange = async (taskId: number, newStatus: TaskStatus) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      })
      if (res.ok) {
        await fetchTasks()
      }
    } catch (e) {
      console.error('Failed to update task status', e)
    }
  }

  const getTasksByStatus = (status: TaskStatus) => {
    return tasks.filter(t => {
      if (t.status !== status) return false
      if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false
      if (filterAssignee !== 'all' && t.assignee_id !== filterAssignee) return false
      return true
    })
  }

  const statusOrder: TaskStatus[] = ['backlog', 'todo', 'in-progress', 'in-review', 'done']

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault()
    if (draggedTask && draggedTask.status !== status) {
      await handleStatusChange(draggedTask.id, status)
    }
    setDraggedTask(null)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-lg">🦞</div>
                <span className="font-semibold text-white">{projectName}</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-gray-800 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <nav className="flex-1 p-2 overflow-auto">
              <button onClick={() => router.push('/')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-1 bg-gray-800 text-white">
                <ListTodo className="w-5 h-5" />任务
              </button>
              {[
                { id: 'agents', label: '员工', icon: Users },
                { id: 'models', label: '模型', icon: Cpu },
                { id: 'skills', label: '技能', icon: Sparkles },
                { id: 'memory', label: '记忆', icon: Brain },
                { id: 'channels', label: '渠道', icon: Network },
                { id: 'timing', label: '定时任务', icon: Clock },
                { id: 'realtime', label: '实时会话', icon: Zap },
                { id: 'logs', label: '工具日志', icon: FileText },
                { id: 'usage', label: '模型用量', icon: TrendingUp },
              ].map(item => (
                <button key={item.id} onClick={() => { router.push('/'); setMobileMenuOpen(false) }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-1 text-gray-400 hover:text-white">
                  <item.icon className="w-5 h-5" />{item.label}
                </button>
              ))}
            </nav>
            <div className="p-4 border-t border-gray-800">
              {currentUser && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-sm font-medium">
                    {currentUser.displayName?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm text-white">{currentUser.displayName}</p>
                    <p className="text-xs text-gray-500">{currentUser.username}</p>
                  </div>
                </div>
              )}
              <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-gray-800">
                <LogOut className="w-4 h-4" />退出登录
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-56 bg-gray-900 border-r border-gray-800 flex-col">
        <div className="p-4 border-b border-gray-800">
          <button onClick={() => router.push('/')} className="flex items-center gap-2 w-full">
            <ArrowLeft className="w-4 h-4 text-gray-500" />
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-lg">🦞</div>
            <span className="font-semibold text-white">{projectName}</span>
          </button>
        </div>
        <nav className="flex-1 p-2">
          <div className="px-3 py-2 text-xs text-gray-500 uppercase tracking-wider mb-1">任务</div>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-1 bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <ListTodo className="w-5 h-5" />任务看板
          </button>

          <div className="px-3 py-2 text-xs text-gray-500 uppercase tracking-wider mt-4 mb-1">管理</div>
          {[
            { label: '员工', icon: Users, path: '/' },
            { label: '模型', icon: Cpu, path: '/' },
            { label: '技能', icon: Sparkles, path: '/' },
            { label: '记忆', icon: Brain, path: '/' },
            { label: '渠道', icon: Network, path: '/' },
            { label: '定时任务', icon: Clock, path: '/' },
            { label: '实时会话', icon: Zap, path: '/' },
            { label: '工具日志', icon: FileText, path: '/' },
            { label: '模型用量', icon: TrendingUp, path: '/' },
          ].map(item => (
            <button key={item.label} onClick={() => router.push(item.path)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-1 text-gray-400 hover:text-white hover:bg-gray-800">
              <item.icon className="w-5 h-5" />{item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-800">
          {currentUser && (
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-sm font-medium text-white">
                {currentUser.displayName?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{currentUser.displayName}</p>
                <p className="text-xs text-gray-500 truncate">{currentUser.username}</p>
              </div>
            </div>
          )}
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-gray-800">
            <LogOut className="w-4 h-4" />退出登录
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex h-14 border-b border-gray-800 items-center justify-between px-4 bg-gray-950 z-10">
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 hover:bg-gray-800 rounded-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-blue-400" />
            <span className="font-semibold text-white text-sm">任务看板</span>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="p-2 hover:bg-gray-800 rounded-lg text-blue-400">
            <Plus className="w-5 h-5" />
          </button>
        </header>

        {/* Desktop Header */}
        <header className="hidden md:flex h-14 border-b border-gray-800 items-center justify-between px-6 bg-gray-950">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-white">任务看板</h1>
            <span className="text-sm text-gray-500">{tasks.length} 个任务</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="搜索任务..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="linear-input pl-9 pr-4 w-64"
              />
            </div>
            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value as Priority | 'all')}
              className="linear-input text-sm"
            >
              <option value="all">全部优先级</option>
              <option value="urgent">紧急</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
            <select
              value={filterAssignee}
              onChange={e => setFilterAssignee(e.target.value)}
              className="linear-input text-sm"
            >
              <option value="all">全部负责人</option>
              <option value="human">👤 人类</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>🤖 {a.identityName}</option>
              ))}
            </select>
            <button onClick={() => setShowCreateModal(true)} className="linear-btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />新建任务
            </button>
          </div>
        </header>

        {/* Mobile Filters */}
        <header className="md:hidden border-b border-gray-800 p-4 bg-gray-950 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="搜索任务..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="linear-input pl-9 pr-4 w-full text-sm"
            />
          </div>
          <div className="flex gap-2">
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value as Priority | 'all')} className="linear-input text-sm flex-1">
              <option value="all">全部优先级</option>
              <option value="urgent">紧急</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
            <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} className="linear-input text-sm flex-1">
              <option value="all">全部负责人</option>
              <option value="human">👤 人类</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>🤖 {a.identityName}</option>
              ))}
            </select>
          </div>
        </header>

        {/* Kanban Board */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-4 p-4 md:p-6 h-full min-w-max">
            {statusOrder.map(status => {
              const columnTasks = getTasksByStatus(status)
              const config = STATUS_CONFIG[status]
              return (
                <div
                  key={status}
                  className="flex flex-col w-72 flex-shrink-0"
                  onDragOver={handleDragOver}
                  onDrop={e => handleDrop(e, status)}
                >
                  {/* Column Header */}
                  <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg ${config.headerBg} border-t border-x ${config.border}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${config.border.replace('border-', 'bg-')}`} />
                      <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                      <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded-full">{columnTasks.length}</span>
                    </div>
                  </div>

                  {/* Column Content */}
                  <div className={`flex-1 overflow-y-auto bg-gray-900/30 border-x border-b ${config.border} rounded-b-lg p-2 space-y-2`}
                    style={{ maxHeight: 'calc(100vh - 220px)' }}
                  >
                    {columnTasks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-gray-600">
                        <ListTodo className="w-8 h-8 mb-2 opacity-50" />
                        <p className="text-xs">暂无任务</p>
                      </div>
                    ) : (
                      columnTasks.map(task => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={e => handleDragStart(e, task)}
                          onDragEnd={() => setDraggedTask(null)}
                          className={`cursor-grab active:cursor-grabbing ${draggedTask?.id === task.id ? 'opacity-50' : ''}`}
                        >
                          <TaskCard
                            task={task}
                            onEdit={(t) => setEditingTask(t)}
                            onDelete={handleDeleteTask}
                            onStatusChange={handleStatusChange}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      {/* Create Task Modal */}
      <TaskFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleCreateTask}
        agents={agents}
        mode="create"
      />

      {/* Edit Task Modal */}
      <TaskFormModal
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleUpdateTask}
        agents={agents}
        task={editingTask || undefined}
        mode="edit"
      />
    </div>
  )
}
