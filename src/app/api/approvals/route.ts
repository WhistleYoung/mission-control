import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import { pool, sql } from '@/lib/db'
import type { NextRequest } from 'next/server'
import { PLUGIN_APPROVALS, EXEC_APPROVALS } from '@/lib/paths'
import * as fs from 'fs'

interface ApprovalItem {
  id: string
  kind: 'exec' | 'plugin'
  request_type: string
  command?: string
  agent_id: string
  agent_name: string
  session_key: string
  created_at: string
  description?: string
}

// Cache for pending approvals (these CLI calls are slow)
let approvalsCache: { approvals: ApprovalItem[]; timestamp: number } = { approvals: [], timestamp: 0 }
const CACHE_TTL = 15000 // 15 seconds

// Cache for logged exec entries from log file
let execLogCache: { entries: ApprovalItem[]; timestamp: number } = { entries: [], timestamp: 0 }
const LOG_CACHE_TTL = 60000 // 1 minute
let lastSyncCount = 0 // Track how many were synced last time

/**
 * Parse OpenClaw exec logs and extract exec operations
 * Logs are in /tmp/openclaw/openclaw-YYYY-MM-DD.log
 */
function parseExecLogs(): ApprovalItem[] {
  const entries: ApprovalItem[] = []
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  
  const logFiles = [
    `/tmp/openclaw/openclaw-${today.toISOString().split('T')[0]}.log`,
    `/tmp/openclaw/openclaw-${yesterday.toISOString().split('T')[0]}.log`
  ]
  
  const seenCommands = new Set<string>()
  
  for (const logFile of logFiles) {
    try {
      if (!fs.existsSync(logFile)) continue
      
      const content = fs.readFileSync(logFile, 'utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      const lines = content.split('\n')
      
      for (const line of lines) {
        if (!line.includes('subsystem') || !line.includes('exec')) continue
        
        try {
          const obj = JSON.parse(line)
          const message = obj['1'] || ''
          
          if (!message.startsWith('elevated command ')) continue
          
          const command = message.replace(/^elevated command /, '')
          const logTime = obj._meta?.date || new Date().toISOString()
          const hash = `${command}-${logTime}`.substring(0, 100)
          
          if (seenCommands.has(hash)) continue
          seenCommands.add(hash)
          
          const sessionKey = obj.sessionKey || obj._meta?.sessionKey || ''
          const agentMatch = sessionKey.match(/agent:([^:]+)/)
          const agentId = agentMatch ? agentMatch[1] : 'unknown'
          
          entries.push({
            id: `logged-${Buffer.from(hash).toString('base64').substring(0, 16)}`,
            kind: 'exec',
            request_type: 'exec',
            command: command,
            agent_id: agentId,
            agent_name: agentId,
            session_key: sessionKey,
            created_at: logTime,
            description: `[日志记录] ${command}`,
          })
        } catch (e) {
          // Skip malformed JSON lines
        }
      }
    } catch (e) {
      console.log('Error reading log file:', logFile, e)
    }
  }
  
  entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return entries
}

/**
 * Sync new exec logs to database (only new ones)
 * Returns number of newly synced entries
 */
async function syncLogsToDatabase(): Promise<number> {
  const now = Date.now()
  
  // Refresh log cache if stale
  if ((now - execLogCache.timestamp) > LOG_CACHE_TTL) {
    execLogCache.entries = parseExecLogs()
    execLogCache.timestamp = now
  }
  
  let syncedCount = 0
  
  // Only sync entries we haven't seen in the last sync
  // We sync the newest ones that are newer than the oldest already in DB
  for (const entry of execLogCache.entries) {
    try {
      // Check if already exists in DB
      const [existing] = await pool.query<any[]>(
        'SELECT id FROM approval_history WHERE command = ? AND created_at = ?',
        [entry.command, entry.created_at]
      )
      if (existing.length === 0) {
        sql.insert('approval_history', {
          approval_id: entry.id,
          kind: 'exec',
          request_type: 'exec',
          command: entry.command || '',
          agent_id: entry.agent_id || 'unknown',
          session_key: entry.session_key || '',
          decision: 'logged',
          resolved_by: 'system',
          created_at: entry.created_at,
          resolved_at: entry.created_at,
        })
        syncedCount++
      }
    } catch (e) {
      // Ignore duplicate key errors
    }
  }
  
  lastSyncCount = syncedCount
  return syncedCount
}

/**
 * GET /api/approvals
 * 
 * ?pending=true  (default) - Get real-time pending approvals from Gateway (fast, no DB)
 * ?history=true  - Load history from DB, sync new logs first
 * ?sync=true     - Manually trigger log sync
 */
export async function GET(request: NextRequest) {
  const searchParams = new URL(request.url).searchParams
  const history = searchParams.get('history') === 'true'
  const sync = searchParams.get('sync') === 'true'
  
  // Manual sync trigger - no auth needed, returns sync status
  if (sync) {
    try {
      const count = await syncLogsToDatabase()
      return NextResponse.json({ ok: true, synced: count, total: execLogCache.entries.length })
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
    }
  }
  
  // Check for readonly history mode (no auth required)
  const readonly = searchParams.get('readonly') === '1' || searchParams.get('readonly') === 'true'
  
  // Auth check for non-readonly requests
  if (!readonly) {
    const auth = verifyAuth(request)
    const errorResponse = createAuthResponse(auth.authorized, '请先登录')
    if (errorResponse) return errorResponse
  }

  // ============ HISTORY MODE ============
  if (history) {
    // readonly is already checked above, no need to check again
    try {
      // First sync new logs to DB
      await syncLogsToDatabase()
      
      // Then fetch from DB
      const [rows] = await pool.query<any[]>(
        "SELECT * FROM approval_history WHERE decision != 'pending' ORDER BY created_at DESC LIMIT 200",
        []
      )
      return NextResponse.json({ 
        approvals: rows,
        synced: lastSyncCount,
        total: rows.length
      })
    } catch (error) {
      console.error('Failed to fetch approval history:', error)
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
    }
  }

  // ============ PENDING MODE (default) ============
  // Return cached pending approvals if fresh
  const now = Date.now()
  if (approvalsCache.timestamp && (now - approvalsCache.timestamp) < CACHE_TTL) {
    return NextResponse.json({ approvals: approvalsCache.approvals, cached: true })
  }

  // Read pending approvals from the gateway socket files
  const pendingApprovals: ApprovalItem[] = []

  // Try exec approvals socket
  try {
    const execResult = execSync(
      'openclaw gateway call exec.approvals.get --json --params "{}" 2>/dev/null',
      { timeout: 8000 }
    ).toString()
    
    const execData = JSON.parse(execResult)
    
    if (execData.path) {
      try {
        const approvalData = JSON.parse(fs.readFileSync(execData.path, 'utf-8'))
        
        const agents = approvalData.agents || {}
        for (const [agentId, agentData] of Object.entries(agents)) {
          const ad = agentData as any
          const pending = ad.pending || []
          for (const item of pending) {
            pendingApprovals.push({
              id: item.id || item.approvalId || `exec-${agentId}-${Math.random().toString(36).substr(2, 9)}`,
              kind: 'exec',
              request_type: item.type || 'exec',
              command: item.command || item.script || item.cmd || '',
              agent_id: agentId,
              agent_name: agentId,
              session_key: item.sessionKey || ad.sessionKey || '',
              created_at: item.createdAt || new Date().toISOString(),
              description: item.description || item.summary || item.command || '',
            })
          }
        }
        
        const defaults = approvalData.defaults || {}
        const defaultPending = defaults.pending || []
        for (const item of defaultPending) {
          pendingApprovals.push({
            id: item.id || item.approvalId || `exec-default-${Math.random().toString(36).substr(2, 9)}`,
            kind: 'exec',
            request_type: item.type || 'exec',
            command: item.command || item.script || item.cmd || '',
            agent_id: 'default',
            agent_name: '默认',
            session_key: item.sessionKey || '',
            created_at: item.createdAt || new Date().toISOString(),
            description: item.description || item.summary || item.command || '',
          })
        }
      } catch (e: any) {
        console.log('Exec approvals socket not readable:', e?.message)
      }
    }
  } catch (error: any) {
    console.log('exec.approvals.get call failed:', error?.message)
  }

  // Try plugin approvals
  try {
    const pluginResult = execSync(
      'openclaw gateway call plugin.approvals.get --json --params "{}" 2>/dev/null',
      { timeout: 8000 }
    ).toString()
    
    const pluginData = JSON.parse(pluginResult)
    if (pluginData.approvals && Array.isArray(pluginData.approvals)) {
      for (const item of pluginData.approvals) {
        pendingApprovals.push({
          id: item.id || item.approvalId || `plugin-${Math.random().toString(36).substr(2, 9)}`,
          kind: 'plugin',
          request_type: item.type || 'plugin',
          command: item.plugin || item.name || '',
          agent_id: item.agentId || 'unknown',
          agent_name: item.agentName || item.agentId || '未知',
          session_key: item.sessionKey || '',
          created_at: item.createdAt || new Date().toISOString(),
          description: item.description || item.plugin || '',
        })
      }
    }
  } catch (error: any) {
    try {
      const pluginApprovalsPath = PLUGIN_APPROVALS
      if (fs.existsSync(pluginApprovalsPath)) {
        const pluginData = JSON.parse(fs.readFileSync(pluginApprovalsPath, 'utf-8'))
        const agents = pluginData.agents || {}
        for (const [agentId, agentData] of Object.entries(agents)) {
          const ad = agentData as any
          const pending = ad.pending || []
          for (const item of pending) {
            pendingApprovals.push({
              id: item.id || item.approvalId || `plugin-${agentId}-${Math.random().toString(36).substr(2, 9)}`,
              kind: 'plugin',
              request_type: item.type || 'plugin',
              command: item.plugin || item.name || '',
              agent_id: agentId,
              agent_name: agentId,
              session_key: item.sessionKey || ad.sessionKey || '',
              created_at: item.createdAt || new Date().toISOString(),
              description: item.description || item.plugin || '',
            })
          }
        }
      }
    } catch (e2: any) {
      console.log('Plugin approvals read failed:', e2?.message)
    }
  }

  // Update cache
  approvalsCache = { approvals: pendingApprovals, timestamp: now }

  return NextResponse.json({ approvals: pendingApprovals, pendingCount: pendingApprovals.length })
}

/**
 * POST /api/approvals
 * Resolve an approval request
 */
export async function POST(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { id, kind, decision, resolved_by } = await request.json()

    if (!id || !kind || !decision) {
      return NextResponse.json({ error: '缺少必要参数: id, kind, decision' }, { status: 400 })
    }

    if (!['allow', 'deny'].includes(decision)) {
      return NextResponse.json({ error: 'decision 必须是 allow 或 deny' }, { status: 400 })
    }

    const method = kind === 'exec' ? 'exec.approval.resolve' : 'plugin.approval.resolve'

    // Call gateway to resolve the approval
    let gatewayResult: any
    try {
      const output = execSync(
        `openclaw gateway call ${method} --json --params '{"id":"${id}","decision":"${decision}"}' 2>/dev/null`,
        { timeout: 10000 }
      ).toString()
      gatewayResult = JSON.parse(output)
    } catch (execError: any) {
      gatewayResult = { ok: false, error: execError?.message || String(execError) }
    }

    // Record in history database
    try {
      let approvalInfo: any = { agent_id: 'unknown', session_key: '', command: '' }
      try {
        if (kind === 'exec') {
          const execApprovalsPath = EXEC_APPROVALS
          if (fs.existsSync(execApprovalsPath)) {
            const data = JSON.parse(fs.readFileSync(execApprovalsPath, 'utf-8'))
            const agents = data.agents || {}
            for (const [, agentData] of Object.entries(agents)) {
              const ad = agentData as any
              const pending = ad.pending || []
              const found = pending.find((p: any) => p.id === id)
              if (found) {
                approvalInfo = { agent_id: id.includes('default') ? 'default' : Object.keys(data.agents || {}).find(k => k === id) || 'default', session_key: found.sessionKey || '', command: found.command || '' }
                break
              }
            }
          }
        }
      } catch (e: any) {
        // Ignore read errors
      }

      sql.insert('approval_history', {
        approval_id: id,
        kind,
        request_type: kind === 'exec' ? 'exec' : 'plugin',
        command: approvalInfo.command || '',
        agent_id: approvalInfo.agent_id || 'unknown',
        session_key: approvalInfo.session_key || '',
        decision,
        resolved_by: resolved_by || auth.user?.username || 'admin',
        created_at: new Date().toISOString(),
        resolved_at: new Date().toISOString(),
      })
    } catch (dbError: any) {
      console.error('Failed to record approval history:', dbError)
    }

    // Clear pending cache so next fetch gets fresh data
    approvalsCache = { approvals: [], timestamp: 0 }

    return NextResponse.json({ 
      ok: gatewayResult.ok !== false, 
      gatewayResult,
      message: decision === 'allow' ? '已允许执行' : '已拒绝'
    })
  } catch (error: any) {
    console.error('Failed to resolve approval:', error)
    return NextResponse.json({ error: '处理审批失败: ' + (error?.message || String(error)) }, { status: 500 })
  }
}
