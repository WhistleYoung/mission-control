import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'
import { getOpenClawConfig, getAgentWorkspace } from '@/lib/paths'

// Simple in-memory cache
let cache: { data: any[] | null; timestamp: number } = { data: null, timestamp: 0 }
const CACHE_TTL_MS = 30000 // 30 seconds
const DEFAULT_LIMIT = 5000 // Default limit for initial load

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
        if (event.type === 'memory.dream.completed' && event.inlinePath) {
          const dateMatch = event.inlinePath?.match(/(\d{4}-\d{2}-\d{2})\.md$/)
          const date = dateMatch ? dateMatch[1] : ''
          // Use timestamp to make id unique (same agent+date+phase can have many dreams)
          const ts = event.timestamp ? event.timestamp.replace(/[^0-9]/g, '').slice(0, 14) : Date.now().toString()
          
          dreams.push({
            id: `${agentId}-${date}-${event.phase}-${ts}`,
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

// Read dreams from database cache (fast path)
function readDreamsFromDb(limit: number = DEFAULT_LIMIT): DreamEntry[] {
  try {
    const rows = db.prepare(`
      SELECT id, agent_id as agentId, agent_name as agentName, agent_emoji as agentEmoji,
        timestamp, phase, inline_path as inlinePath, line_count as lineCount, 
        storage_mode as storageMode, light_hits as lightHits, rem_hits as remHits, 
        last_light_at as lastLightAt, preview
      FROM dreams_cache
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit) as DreamEntry[]
    return rows
  } catch (e) {
    console.error('Error reading dreams from db:', e)
    return []
  }
}

// Save dreams to database
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

// GET /api/dreams - Read from DB cache first, fallback to files + background sync
export async function GET(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  const searchParams = new URL(request.url).searchParams
  const limit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT)) || DEFAULT_LIMIT
  const sync = searchParams.get('sync') === 'true'
  
  const now = Date.now()
  
  // Check in-memory cache first (30s TTL)
  if (!sync && cache.data && (now - cache.timestamp) < CACHE_TTL_MS) {
    return NextResponse.json(cache.data.slice(0, limit))
  }
  
  // Try reading from database first (fast path)
  if (!sync) {
    const dbDreams = readDreamsFromDb(limit)
    if (dbDreams.length > 0) {
      // Update in-memory cache
      cache = { data: dbDreams, timestamp: now }
      
      // Trigger background sync (fire and forget)
      ;(async () => {
        try {
          const agents = getAgents()
          const allDreams: DreamEntry[] = []
          for (const agent of agents) {
            const workspace = getAgentWorkspace(agent.id)
            const dreams = readDreamsFromWorkspace(workspace, agent.id, agent.name, agent.emoji)
            allDreams.push(...dreams)
          }
          allDreams.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
          saveDreamsToDb(allDreams)
        } catch (e) {
          console.error('Background sync failed:', e)
        }
      })()
      
      return NextResponse.json(dbDreams)
    }
  }
  
  // Fallback: read from files (slow path)
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

    // Update cache with full data
    cache = { data: allDreams, timestamp: now }
    
    // Save to database for future fast reads
    saveDreamsToDb(allDreams)

    // Return limited results
    return NextResponse.json(allDreams.slice(0, limit))
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
