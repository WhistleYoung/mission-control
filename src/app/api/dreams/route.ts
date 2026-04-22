import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'
import { getOpenClawConfig, getAgentWorkspace } from '@/lib/paths'

interface DreamEntry {
  id: string
  agentId: string
  agentName: string
  agentEmoji: string
  timestamp: string
  phase: 'light' | 'rem'
  inlinePath: string
  lineCount: number
  storageMode: string
  lightHits: number
  remHits: number
  lastLightAt: string
  preview: string
}

function getAgents(): { id: string; name: string; emoji: string }[] {
  try {
    if (!existsSync(getOpenClawConfig())) return []
    const config = JSON.parse(readFileSync(getOpenClawConfig(), 'utf-8'))
    const agents = config.agents?.list || []
    return agents.map((a: any) => ({
      id: a.id,
      name: a.name || a.id,
      emoji: a.emoji || '🤖'
    }))
  } catch { return [] }
}

// Ensure dreams table exists
function ensureDreamsTable() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS dreams_cache (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        agent_name TEXT,
        agent_emoji TEXT,
        timestamp TEXT,
        phase TEXT,
        inline_path TEXT,
        line_count INTEGER,
        storage_mode TEXT,
        light_hits INTEGER DEFAULT 0,
        rem_hits INTEGER DEFAULT 0,
        last_light_at TEXT,
        preview TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  } catch (e) {
    console.error('Error creating dreams table:', e)
  }
}

// Read dreams from workspace files
function readDreamsFromWorkspace(workspacePath: string, agentId: string, agentName: string, agentEmoji: string): DreamEntry[] {
  const dreamsDir = join(workspacePath, 'memory', '.dreams')
  const eventsFile = join(dreamsDir, 'events.jsonl')
  
  if (!existsSync(eventsFile)) {
    return []
  }

  const dreams: DreamEntry[] = []
  try {
    const content = readFileSync(eventsFile, 'utf-8')
    const lines = content.split('\n').filter(l => l.trim())
    
    for (const line of lines) {
      try {
        const event = JSON.parse(line)
        if (event.type === 'memory.dream.completed') {
          const dateMatch = event.inlinePath?.match(/(\d{4}-\d{2}-\d{2})\.md$/)
          const date = dateMatch ? dateMatch[1] : ''
          
          dreams.push({
            id: `${agentId}-${date}-${event.phase}`,
            agentId,
            agentName,
            agentEmoji,
            timestamp: event.timestamp,
            phase: event.phase,
            inlinePath: event.inlinePath,
            lineCount: event.lineCount,
            storageMode: event.storageMode,
            lightHits: 0,
            remHits: 0,
            lastLightAt: '',
            preview: '',
          })
        }
      } catch {}
    }
  } catch (e) {
    console.error('Error reading events file:', e)
  }

  return dreams
}

// Save dreams to database (backup mode)
function saveDreamsToDb(dreams: DreamEntry[]) {
  ensureDreamsTable()
  
  try {
    const insert = db.prepare(`
      INSERT OR REPLACE INTO dreams_cache (id, agent_id, agent_name, agent_emoji, timestamp, phase, inline_path, line_count, storage_mode, light_hits, rem_hits, last_light_at, preview, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)

    for (const d of dreams) {
      insert.run(d.id, d.agentId, d.agentName, d.agentEmoji, d.timestamp, d.phase, d.inlinePath, d.lineCount, d.storageMode, d.lightHits, d.remHits, d.lastLightAt, d.preview)
    }
  } catch (e) {
    console.error('Error saving dreams to db:', e)
  }
}

// GET /api/dreams - Read from files (always up-to-date) + save to cache
export async function GET(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const agents = getAgents()
    const allDreams: DreamEntry[] = []

    for (const agent of agents) {
      const workspace = getAgentWorkspace(agent.id)
      const dreams = readDreamsFromWorkspace(workspace, agent.id, agent.name, agent.emoji)
      allDreams.push(...dreams)
    }

    // Sort by timestamp descending
    allDreams.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

    // Also save to cache for backup
    if (allDreams.length > 0) {
      saveDreamsToDb(allDreams)
    }

    return NextResponse.json(allDreams)
  } catch (error) {
    console.error('Failed to fetch dreams:', error)
    return NextResponse.json({ error: 'Failed to fetch dreams' }, { status: 500 })
  }
}

// POST /api/dreams - Force sync to cache
export async function POST(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { action } = await request.json()
    
    if (action === 'sync') {
      // Sync all dreams to database
      const agents = getAgents()
      const allDreams: DreamEntry[] = []
      for (const agent of agents) {
        const workspace = getAgentWorkspace(agent.id)
        const dreams = readDreamsFromWorkspace(workspace, agent.id, agent.name, agent.emoji)
        allDreams.push(...dreams)
      }
      saveDreamsToDb(allDreams)
      return NextResponse.json({ success: true, count: allDreams.length })
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: '同步失败' }, { status: 500 })
  }
}