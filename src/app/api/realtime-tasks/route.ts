import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
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

/**
 * Get active/realtime tasks from OpenClaw Gateway via CLI
 */
export async function GET(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    // Use CLI to get sessions list - more reliable than WebSocket
    const output = execSync(
      'openclaw gateway call sessions.list --params "{}" --json 2>/dev/null',
      { timeout: 10000 }
    ).toString()
    
    const result = JSON.parse(output)
    const tasks: RealtimeTask[] = []
    
    // Agent name mapping
    const agentNames: Record<string, string> = {
      main: '小七',
      worker: '壹号牛马',
      devper: 'devper',
    }
    
    const sessions = result.sessions || []
    for (const session of sessions) {
      const sessionKey = session.key || session.sessionId || ''
      
      // Extract agentId from session key: "agent:main:dingtalk-connector:direct:xxx"
      const keyParts = sessionKey.split(':')
      const agentId = keyParts[1] || keyParts[0] || 'unknown'
      
      // Skip cron, heartbeat and openai system sessions
      if (sessionKey.includes('heartbeat') || sessionKey.includes('cron') || sessionKey.includes('openai:')) {
        continue
      }
      
      // Determine if this is a subagent or main agent
      const isSubagent = sessionKey.includes(':subagent:')
      
      // Get display name or origin label as task description
      let task = session.displayName || session.summary || ''
      
      tasks.push({
        sessionKey,
        sessionId: session.sessionId,
        agentId,
        agentName: agentNames[agentId] || agentId,
        model: session.model ? `${session.modelProvider}/${session.model}` : '',
        status: session.status === 'running' ? 'running' : (session.status === 'failed' ? 'error' : 'idle'),
        task: task.substring(0, 100),
        startedAt: session.startedAt ? new Date(session.startedAt).toISOString() : undefined,
        lastActive: session.updatedAt ? new Date(session.updatedAt).toISOString() : undefined,
        childSessions: session.childSessions || [],
        isSubagent,
        isMainAgent: !isSubagent,
      })
    }
    
    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('Failed to fetch realtime tasks:', error)
    return NextResponse.json({ error: '获取实时任务失败', tasks: [] }, { status: 500 })
  }
}

/**
 * Abort a realtime task (subagent or idle session)
 * Main agent sessions cannot be killed
 */
export async function DELETE(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const sessionKey = searchParams.get('sessionKey')

    if (!sessionKey) {
      return NextResponse.json({ error: '缺少 sessionKey 参数' }, { status: 400 })
    }

    // Check if this is a main agent session (not a subagent)
    // Main agent sessions contain ':cron:', ':heartbeat:' or are direct sessions without 'subagent'
    const isMainAgent = !sessionKey.includes(':subagent:') || 
                        sessionKey.includes(':cron:') || 
                        sessionKey.includes(':heartbeat:')

    if (isMainAgent) {
      return NextResponse.json({ 
        error: '主 Agent 进程无法被杀死',
        reason: 'main_agent_protected'
      }, { status: 403 })
    }

    // Delete the session via Gateway CLI (use sessions.delete for idle/done sessions)
    const output = execSync(
      `openclaw gateway call sessions.delete --params '{"key":"${sessionKey}"}' --json 2>/dev/null`,
      { timeout: 10000 }
    ).toString()

    const result = JSON.parse(output)
    return NextResponse.json({ 
      ok: true, 
      sessionKey,
      message: '任务已删除',
      archived: result.archived
    })
  } catch (error: any) {
    console.error('Failed to abort task:', error)
    return NextResponse.json({ 
      error: '终止任务失败',
      details: error.message 
    }, { status: 500 })
  }
}
