import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import { pool, sql } from '@/lib/db'
import type { NextRequest } from 'next/server'

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

/**
 * GET /api/approvals
 * Returns pending approval requests from the gateway socket files
 */
export async function GET(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  const searchParams = new URL(request.url).searchParams
  const history = searchParams.get('history') === 'true'

  // Return history records
  if (history) {
    try {
      const [rows] = await pool.query<any[]>(
        'SELECT * FROM approval_history ORDER BY created_at DESC LIMIT 100',
        []
      )
      return NextResponse.json({ approvals: rows })
    } catch (error) {
      console.error('Failed to fetch approval history:', error)
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
    }
  }

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
    
    // The exec-approvals.sock file contains pending approval IDs
    // Read the socket to get actual pending approvals
    if (execData.path) {
      const fs = require('fs')
      try {
        const approvalData = JSON.parse(fs.readFileSync(execData.path, 'utf-8'))
        
        // Extract pending approvals from agents config
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
        
        // Also check defaults
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
        // Socket file not readable, try alternate approach
        console.log('Exec approvals socket not readable:', e?.message)
      }
    }
  } catch (error: any) {
    // exec.approvals.get not available or failed
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
    // plugin.approvals.get not available, try plugin-approvals.json
    try {
      const fs = require('fs')
      const pluginApprovalsPath = '/home/bullrom/.openclaw/plugin-approvals.json'
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

  return NextResponse.json({ approvals: pendingApprovals })
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
      // If gateway call fails (e.g., unknown/expired id), still record in history
      gatewayResult = { ok: false, error: execError?.message || String(execError) }
    }

    // Record in history database
    try {
      // Try to get current approval info for history
      let approvalInfo: any = { agent_id: 'unknown', session_key: '', command: '' }
      try {
        const fs = require('fs')
        if (kind === 'exec') {
          const execApprovalsPath = '/home/bullrom/.openclaw/exec-approvals.json'
          if (fs.existsSync(execApprovalsPath)) {
            const data = JSON.parse(fs.readFileSync(execApprovalsPath, 'utf-8'))
            // Try to find the approval
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
