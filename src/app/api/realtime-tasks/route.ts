import { NextResponse } from 'next/server'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import { getAgentNames } from '@/lib/agent-config'
import { gatewayCall } from '@/lib/gateway-rpc'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

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

export async function GET(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    // 直接调用 CLI 获取 sessions
    const sessions: any[] = await gatewayCall('sessions.list', {})
    
    console.log('sessions.list returned:', JSON.stringify(sessions, null, 2).substring(0, 2000))

    const agentNames = getAgentNames()
    const tasks: RealtimeTask[] = []

    for (const session of sessions) {
      const status = (session.status || '').toLowerCase()
      const agentId = session.agentId || session.agent?.id || session.agent_id || 'unknown'
      
      // Determine agent name: priority is agentNames map > session.agent?.name > agentId
      let agentName = agentNames[agentId] || session.agent?.name || session.agent_name || agentId

      tasks.push({
        sessionKey: session.key || session.sessionKey || session.id || '',
        sessionId: session.sessionId || session.id,
        agentId,
        agentName,
        model: session.model || session.agent?.model || '',
        status: status === 'running' ? 'running' : status === 'active' ? 'running' : 'idle',
        task: session.task || session.currentTask || '',
        startedAt: session.startedAt || session.started_at || '',
        lastActive: session.lastActive || session.last_active || '',
        childSessions: session.childSessions || [],
        isSubagent: !!session.isSubagent,
        isMainAgent: !!session.isMainAgent
      })
    }

    // Sort: main agents first, then by last active
    tasks.sort((a, b) => {
      if (a.isMainAgent && !b.isMainAgent) return -1
      if (!a.isMainAgent && b.isMainAgent) return 1
      return 0
    })

    // Sync to database using INSERT OR REPLACE to handle duplicates
    try {
      const insert = db.prepare(`
        INSERT OR REPLACE INTO realtime_tasks_cache
        (session_key, agent_id, agent_name, model, status, task, started_at, last_active, is_subagent, is_main_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      for (const t of tasks) {
        insert.run(
          t.sessionKey || '',
          t.agentId || '',
          t.agentName || '',
          t.model || '',
          t.status || 'idle',
          t.task || '',
          t.startedAt || '',
          t.lastActive || '',
          t.isSubagent ? 1 : 0,
          t.isMainAgent ? 1 : 0
        )
      }
    } catch (dbError: any) {
      console.error('Database sync error:', dbError.message)
    }

    return NextResponse.json({ tasks, cached: false, age: 0 })
  } catch (error: any) {
    console.error('Failed to fetch realtime tasks:', error)
    return NextResponse.json({
      tasks: [],
      cached: false,
      error: String(error)
    }, { status: 500 })
  }
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

    await gatewayCall('sessions.delete', { key: sessionKey })
    return NextResponse.json({ ok: true, sessionKey, message: '任务已删除' })
  } catch (error: any) {
    console.error('Failed to delete session:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
