import { NextResponse } from 'next/server'
import { db, sql } from '@/lib/db'
import * as fs from 'fs'

// Cache for exec log entries
let execLogCache: { entries: any[]; timestamp: number } = { entries: [], timestamp: 0 }
const LOG_CACHE_TTL = 60000 // 1 minute

/**
 * Parse OpenClaw exec logs and extract exec operations
 */
function parseExecLogs(): any[] {
  const entries: any[] = []
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
            command,
            agent_id: agentId,
            session_key: sessionKey,
            created_at: logTime,
            decision: 'logged',
            resolved_by: 'system',
          })
        } catch (e) {}
      }
    } catch (e) {
      console.log('Error reading log file:', logFile, e)
    }
  }
  
  entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return entries
}

async function syncExecLogs() {
  const now = Date.now()
  if ((now - execLogCache.timestamp) > LOG_CACHE_TTL) {
    execLogCache.entries = parseExecLogs()
    execLogCache.timestamp = now
  }
  
  let synced = 0
  for (const entry of execLogCache.entries) {
    try {
      const [existing] = db.prepare(
        'SELECT id FROM approval_history WHERE command = ? AND created_at = ?'
      ).get(entry.command, entry.created_at) as any[]
      
      if (!existing) {
        sql.insert('approval_history', {
          approval_id: entry.id,
          kind: entry.kind,
          request_type: entry.request_type,
          command: entry.command || '',
          agent_id: entry.agent_id || 'unknown',
          session_key: entry.session_key || '',
          decision: entry.decision,
          resolved_by: entry.resolved_by,
          created_at: entry.created_at,
          resolved_at: entry.created_at,
        })
        synced++
      }
    } catch (e) {}
  }
  
  console.log(`Synced ${synced} exec logs to approval_history`)
}

// POST /api/sync - Sync all cached data to database
export async function POST() {
  try {
    // Sync exec logs first
    await syncExecLogs()
    
    // Sync sessions
    syncSessions()
    
    // Sync realtime tasks  
    syncRealtimeTasks()
    
    return NextResponse.json({ success: true, synced_at: new Date().toISOString() })
  } catch (error) {
    console.error('Sync failed:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

async function syncSessions() {
  // Get sessions from gateway via WebSocket RPC
  const { gatewayCall } = await import('@/lib/gateway-rpc')
  
  try {
    const result = await gatewayCall('sessions.list', {}) as any[]
    
    if (!Array.isArray(result)) return
    
    // Clear old cache
    db.exec('DELETE FROM sessions_cache')
    
    // Insert new data
    const insert = db.prepare(`
      INSERT OR REPLACE INTO sessions_cache 
      (session_id, agent_id, agent_name, title, summary, last_message, last_message_time, 
       project_id, custom_tags, message_count, is_cron, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)
    
    const insertMany = db.transaction((sessions: any[]) => {
      for (const s of sessions) {
        insert.run(
          s.sessionKey || s.id || '',
          s.agentId || '',
          s.agentName || '',
          s.title || '',
          s.summary || '',
          s.lastMessage?.slice(0, 500) || '',
          s.lastMessageTime || '',
          s.projectId || null,
          s.customTags || '',
          s.messageCount || 0,
          s.isCron ? 1 : 0
        )
      }
    })
    
    insertMany(result)
    
    // Update sync metadata
    db.prepare('INSERT INTO sessions_sync_meta (last_sync_at) VALUES (CURRENT_TIMESTAMP)').run()
    
    console.log(`Synced ${result.length} sessions to cache`)
  } catch (error) {
    console.error('Sessions sync failed:', error)
  }
}

async function syncRealtimeTasks() {
  const { gatewayCall } = await import('@/lib/gateway-rpc')
  
  try {
    const result = await gatewayCall('sessions.list', {}) as any[]
    
    if (!Array.isArray(result)) return
    
    // Filter to only active/realtime sessions
    const activeSessions = result.filter(s => {
      const status = s.status?.toLowerCase()
      return status === 'running' || status === 'active'
    })
    
    // Clear old cache
    db.exec('DELETE FROM realtime_tasks_cache')
    
    // Insert new data
    const insert = db.prepare(`
      INSERT OR REPLACE INTO realtime_tasks_cache 
      (session_key, agent_id, agent_name, model, status, task, started_at, 
       last_active, is_subagent, is_main_agent, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)
    
    const insertMany = db.transaction((tasks: any[]) => {
      for (const t of tasks) {
        insert.run(
          t.sessionKey || t.id || '',
          t.agentId || '',
          t.agentName || '',
          t.model || '',
          t.status || 'unknown',
          t.task?.slice(0, 200) || '',
          t.startedAt || '',
          t.lastActive || '',
          t.isSubagent ? 1 : 0,
          t.isMainAgent ? 1 : 0
        )
      }
    })
    
    insertMany(activeSessions)
    
    // Update sync metadata
    db.prepare('INSERT INTO realtime_tasks_sync_meta (last_sync_at) VALUES (CURRENT_TIMESTAMP)').run()
    
    console.log(`Synced ${activeSessions.length} realtime tasks to cache`)
  } catch (error) {
    console.error('Realtime tasks sync failed:', error)
  }
}
