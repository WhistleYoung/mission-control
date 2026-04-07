import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/sync - Sync all cached data to database
export async function POST() {
  try {
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
