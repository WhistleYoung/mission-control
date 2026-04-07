import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import { getAgentNames } from '@/lib/agent-config'
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

// In-memory cache to avoid slow CLI calls
let taskCache: { tasks: RealtimeTask[]; timestamp: number } = {
  tasks: [],
  timestamp: 0
}
const CACHE_TTL = 60000 // 60 seconds - reduce CLI calls for better performance

/**
 * Get active/realtime tasks from OpenClaw Gateway via CLI
 * Uses async spawn instead of execSync to avoid timeout issues
 */
export async function GET(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  const now = Date.now()
  const searchParams = new URL(request.url).searchParams
  const forceRefresh = searchParams.get('refresh') === 'true'

  // Return cached data if still fresh (and not forcing refresh)
  if (!forceRefresh && taskCache.timestamp && (now - taskCache.timestamp) < CACHE_TTL) {
    return NextResponse.json({ 
      tasks: taskCache.tasks,
      cached: true,
      age: now - taskCache.timestamp
    })
  }

  try {
    // Use async spawn instead of execSync to avoid timeout issues
    const result = await new Promise<any>((resolve, reject) => {
      const output: Buffer[] = []
      const proc = spawn('openclaw', ['gateway', 'call', 'sessions.list', '--params', '{}', '--json'], {
        timeout: 15000,
        shell: false
      })
      
      proc.stdout.on('data', (data) => output.push(data))
      proc.stderr.on('data', () => {}) // Ignore stderr
      
      proc.on('error', (err) => reject(err))
      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Process exited with code ${code}`))
        } else {
          try {
            resolve(JSON.parse(Buffer.concat(output).toString()))
          } catch (e) {
            reject(new Error('Failed to parse JSON output'))
          }
        }
      })
      
      // Timeout after 15 seconds
      setTimeout(() => {
        proc.kill('SIGTERM')
        reject(new Error('Command timeout'))
      }, 15000)
    })
    
    const tasks: RealtimeTask[] = []
    
    // Agent name mapping from openclaw.json
    const agentNames = getAgentNames()
    
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
    
    // Update cache
    taskCache = { tasks, timestamp: now }
    
    return NextResponse.json({ tasks, cached: false, age: 0 })
  } catch (error) {
    console.error('Failed to fetch realtime tasks:', error)
    // Return cached data on error if available
    if (taskCache.tasks.length > 0) {
      return NextResponse.json({ 
        tasks: taskCache.tasks, 
        cached: true,
        error: '使用缓存数据',
        age: now - taskCache.timestamp
      })
    }
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
    const result = await new Promise<any>((resolve, reject) => {
      const output: Buffer[] = []
      const proc = spawn('openclaw', ['gateway', 'call', 'sessions.delete', '--params', `{"key":"${sessionKey}"}`, '--json'], {
        timeout: 10000,
        shell: false
      })
      
      proc.stdout.on('data', (data) => output.push(data))
      proc.stderr.on('data', () => {})
      
      proc.on('error', (err) => reject(err))
      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Process exited with code ${code}`))
        } else {
          try {
            resolve(JSON.parse(Buffer.concat(output).toString()))
          } catch (e) {
            reject(new Error('Failed to parse JSON output'))
          }
        }
      })
      
      setTimeout(() => {
        proc.kill('SIGTERM')
        reject(new Error('Command timeout'))
      }, 10000)
    })
    
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
