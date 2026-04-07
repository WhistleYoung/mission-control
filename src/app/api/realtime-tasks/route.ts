import { NextResponse } from 'next/server'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import { getAgentNames } from '@/lib/agent-config'
import { gatewayCall } from '@/lib/gateway-rpc'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

// Cache TTL - 5 minutes
const CACHE_TTL = 300000

interface RealtimeTask {
  sessionKey: string
  sessionId?: string
  agentId: string
  agentName: string
  model?: string
  status: 'running' | 'idle' | 'error'
  task?: string
  startedAt?: string
  lastActive?: string
  childSessions?: string[]
  isSubagent?: boolean
  isMainAgent?: boolean
}

let taskCache: { tasks: RealtimeTask[]; timestamp: number } = {
  tasks: [],
  timestamp: 0
}

export async function GET(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  const now = Date.now()
  const searchParams = new URL(request.url).searchParams
  const forceRefresh = searchParams.get('refresh') === 'true'

  // Return cached data if still fresh
  if (!forceRefresh && taskCache.timestamp && (now - taskCache.timestamp) < CACHE_TTL) {
    return NextResponse.json({ 
      tasks: taskCache.tasks,
      cached: true,
      age: now - taskCache.timestamp
    })
  }

  // Try to read from database cache first
  if (!forceRefresh) {
    try {
      const cached = db.prepare('SELECT * FROM realtime_tasks_cache').all() as any[]
      if (cached && cached.length > 0) {
        const meta = db.prepare('SELECT last_sync_at FROM realtime_tasks_sync_meta ORDER BY id DESC LIMIT 1').get() as any
        const age = meta?.last_sync_at ? now - new Date(meta.last_sync_at).getTime() : 0
        
        if (age < CACHE_TTL) {
          const tasks: RealtimeTask[] = cached.map(c => ({
            sessionKey: c.session_key,
            agentId: c.agent_id,
            agentName: c.agent_name,
            model: c.model,
            status: c.status,
            task: c.task,
            startedAt: c.started_at,
            lastActive: c.last_active,
            isSubagent: !!c.is_subagent,
            isMainAgent: !!c.is_main_agent
          }))
          
          // Trigger background refresh
          refreshCacheInBackground()
          
          return NextResponse.json({ tasks, cached: true, age })
        }
      }
    } catch (e) {
      console.error('Failed to read tasks from cache:', e)
    }
  }

  // Fetch fresh data from gateway
  try {
    const result = await gatewayCall('sessions.list', {}) as any[]
    
    if (!Array.isArray(result)) {
      throw new Error('Invalid result from gateway')
    }

    const agentNames = getAgentNames()
    const tasks: RealtimeTask[] = []
    
    for (const session of result) {
      const status = session.status?.toLowerCase()
      if (status !== 'running' && status !== 'active') continue
      
      const agentId = session.agentId || session.agent?.id || 'unknown'
      
      tasks.push({
        sessionKey: session.sessionKey || session.id || '',
        sessionId: session.sessionId || session.id,
        agentId,
        agentName: agentNames[agentId] || session.agent?.name || agentId,
        model: session.model || session.agent?.model,
        status: status === 'running' ? 'running' : 'idle',
        task: session.task || session.currentTask || '',
        startedAt: session.startedAt || session.started_at,
        lastActive: session.lastActive || session.last_active,
        childSessions: session.childSessions || [],
        isSubagent: session.isSubagent || session.is_subagent,
        isMainAgent: session.isMainAgent || session.is_main_agent
      })
    }

    // Sort: main agents first, then by last active
    tasks.sort((a, b) => {
      if (a.isMainAgent && !b.isMainAgent) return -1
      if (!a.isMainAgent && b.isMainAgent) return 1
      return 0
    })

    // Update cache
    taskCache = { tasks, timestamp: now }
    
    // Trigger background sync to database
    syncToDatabase(tasks)

    return NextResponse.json({ tasks, cached: false, age: 0 })
  } catch (error) {
    console.error('Failed to fetch realtime tasks:', error)
    
    // Return cached data on error if available
    if (taskCache.tasks.length > 0) {
      return NextResponse.json({ 
        tasks: taskCache.tasks,
        cached: true,
        age: now - taskCache.timestamp,
        error: 'Using stale cache'
      })
    }
    
    return NextResponse.json({ 
      tasks: [],
      cached: false,
      error: String(error)
    }, { status: 500 })
  }
}

function syncToDatabase(tasks: RealtimeTask[]) {
  try {
    db.exec('DELETE FROM realtime_tasks_cache')
    
    const insert = db.prepare(`
      INSERT INTO realtime_tasks_cache 
      (session_key, agent_id, agent_name, model, status, task, started_at, last_active, is_subagent, is_main_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    const insertMany = db.transaction((ts: RealtimeTask[]) => {
      for (const t of ts) {
        insert.run(t.sessionKey, t.agentId, t.agentName, t.model || '', t.status, 
                   t.task || '', t.startedAt || '', t.lastActive || '', 
                   t.isSubagent ? 1 : 0, t.isMainAgent ? 1 : 0)
      }
    })
    
    insertMany(tasks)
    db.prepare('INSERT INTO realtime_tasks_sync_meta (last_sync_at) VALUES (CURRENT_TIMESTAMP)').run()
  } catch (e) {
    console.error('Failed to sync tasks to database:', e)
  }
}

function refreshCacheInBackground() {
  // Fire and forget - will update cache for next request
  fetch(new URL('/api/sync', 'http://localhost:10086'), { method: 'POST' }).catch(() => {})
}

// DELETE - Kill a session
export async function DELETE(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { sessionKey } = await request.json()
    
    if (!sessionKey) {
      return NextResponse.json({ error: '缺少 sessionKey' }, { status: 400 })
    }

    // Check if this is a main agent
    const cached = db.prepare('SELECT * FROM realtime_tasks_cache WHERE session_key = ?').get(sessionKey) as any
    if (cached?.is_main_agent) {
      return NextResponse.json({ 
        error: '无法删除主 Agent 进程',
        code: 'MAIN_AGENT_PROTECTED'
      }, { status: 403 })
    }

    await gatewayCall('sessions.delete', { key: sessionKey })
    
    // Update cache
    taskCache.tasks = taskCache.tasks.filter(t => t.sessionKey !== sessionKey)
    
    // Update database
    db.prepare('DELETE FROM realtime_tasks_cache WHERE session_key = ?').run(sessionKey)

    return NextResponse.json({ ok: true, sessionKey, message: '任务已删除' })
  } catch (error) {
    console.error('Failed to delete session:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
