import { NextResponse } from 'next/server'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'
import { getOpenClawConfig, getAgentWorkspace } from '@/lib/paths'

// Simple in-memory cache
let cache: { data: any[] | null; timestamp: number } = { data: null, timestamp: 0 }
const CACHE_TTL_MS = 30000 // 30 seconds
const DEFAULT_LIMIT = 5000 // Default limit for initial load

interface MemoryEntry {
  id: string
  agentId: string
  agentName: string
  agentEmoji: string
  date: string
  preview: string
  type: 'daily' | 'long-term'
  tags: string[]
  content: string
  filePath: string
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

// Ensure memory table exists
function ensureMemoryTable() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS memory_cache (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        agent_name TEXT,
        agent_emoji TEXT,
        date TEXT,
        memory_type TEXT,
        content TEXT,
        file_path TEXT,
        preview TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  } catch (e) {
    console.error('Error creating memory table:', e)
  }
}

// Read memories from workspace files
function readMemoriesFromWorkspace(workspacePath: string, agentId: string, agentName: string, agentEmoji: string): MemoryEntry[] {
  const memories: MemoryEntry[] = []
  const memoryDir = join(workspacePath, 'memory')

  if (existsSync(memoryDir)) {
    try {
      const files = readdirSync(memoryDir).filter(f => f.endsWith('.md'))
      for (const file of files) {
        const filePath = join(memoryDir, file)
        const content = readFileSync(filePath, 'utf-8')
        const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/)
        const date = dateMatch ? dateMatch[1] : file.replace('.md', '').substring(0, 10)
        
        memories.push({
          id: `${agentId}-${file}`,
          agentId,
          agentName,
          agentEmoji,
          date,
          type: file.includes('long-term') || file.includes('MEMORY') ? 'long-term' : 'daily',
          tags: file.includes('long-term') || file.includes('MEMORY') ? ['长期', '重要'] : ['日常'],
          content,
          filePath,
          preview: content.substring(0, 200).replace(/[#*`]/g, '').trim() + (content.length > 200 ? '...' : ''),
        })
      }
    } catch (e) {
      console.error(`Error reading memory dir for ${agentId}:`, e)
    }
  }

  const memFile = join(workspacePath, 'MEMORY.md')
  if (existsSync(memFile)) {
    try {
      const content = readFileSync(memFile, 'utf-8')
      const existingIdx = memories.findIndex(m => m.type === 'long-term')
      const memEntry: MemoryEntry = {
        id: `${agentId}-MEMORY`,
        agentId,
        agentName,
        agentEmoji,
        date: new Date().toISOString().split('T')[0],
        type: 'long-term',
        tags: ['长期', '重要'],
        content,
        filePath: memFile,
        preview: content.substring(0, 200).replace(/[#*\n`]/g, ' ').trim() + (content.length > 200 ? '...' : ''),
      }
      if (existingIdx >= 0) {
        memories[existingIdx] = memEntry
      } else {
        memories.push(memEntry)
      }
    } catch (e) {
      console.error(`Error reading MEMORY.md for ${agentId}:`, e)
    }
  }

  return memories
}

// Read memories from database cache (fast path)
function readMemoriesFromDb(limit: number = DEFAULT_LIMIT): MemoryEntry[] {
  try {
    const rows = db.prepare(`
      SELECT id, agent_id as agentId, agent_name as agentName, agent_emoji as agentEmoji, 
        date, memory_type as type, content, file_path as filePath, preview
      FROM memory_cache
      ORDER BY date DESC
      LIMIT ?
    `).all(limit) as MemoryEntry[]
    return rows
  } catch (e) {
    console.error('Error reading memories from db:', e)
    return []
  }
}

// Save memories to database
function saveMemoriesToDb(memories: MemoryEntry[]) {
  ensureMemoryTable()
  
  try {
    const insert = db.prepare(`
      INSERT OR REPLACE INTO memory_cache (id, agent_id, agent_name, agent_emoji, date, memory_type, content, file_path, preview, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)

    for (const m of memories) {
      insert.run(m.id, m.agentId, m.agentName, m.agentEmoji, m.date, m.type, m.content, m.filePath, m.preview)
    }
  } catch (e) {
    console.error('Error saving memories to db:', e)
  }
}

// GET /api/memory - Read from DB cache first, fallback to files + background sync
// GET /api/memory - Read from DB cache first, fallback to files + background sync
export async function GET(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  const searchParams = new URL(request.url).searchParams
  const limit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT)) || DEFAULT_LIMIT
  const sync = searchParams.get('sync') === 'true' // Force sync from files
  
  const now = Date.now()
  
  // Check in-memory cache first (30s TTL)
  if (!sync && cache.data && (now - cache.timestamp) < CACHE_TTL_MS) {
    return NextResponse.json(cache.data.slice(0, limit))
  }
  
  // Try reading from database first (fast path)
  if (!sync) {
    const dbMemories = readMemoriesFromDb(limit)
    if (dbMemories.length > 0) {
      // Update in-memory cache
      cache = { data: dbMemories, timestamp: now }
      
      // Trigger background sync (fire and forget)
      ;(async () => {
        try {
          const agents = getAgents()
          const allMemories: MemoryEntry[] = []
          for (const agent of agents) {
            const workspace = getAgentWorkspace(agent.id)
            const mems = readMemoriesFromWorkspace(workspace, agent.id, agent.name, agent.emoji)
            allMemories.push(...mems)
          }
          allMemories.sort((a, b) => b.date.localeCompare(a.date))
          saveMemoriesToDb(allMemories)
        } catch (e) {
          console.error('Background sync failed:', e)
        }
      })()
      
      return NextResponse.json(dbMemories)
    }
  }
  
  // Fallback: read from files (slow path)
  try {
    const agents = getAgents()
    const memories: MemoryEntry[] = []

    for (const agent of agents) {
      const workspace = getAgentWorkspace(agent.id)
      const mems = readMemoriesFromWorkspace(workspace, agent.id, agent.name, agent.emoji)
      memories.push(...mems)
    }

    // Sort by date descending
    memories.sort((a, b) => b.date.localeCompare(a.date))

    // Update cache with full data
    cache = { data: memories, timestamp: now }
    
    // Save to database for future fast reads
    saveMemoriesToDb(memories)

    // Return limited results
    return NextResponse.json(memories.slice(0, limit))
  } catch (error) {
    console.error('Failed to fetch memories:', error)
    return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 })
  }
}

// POST /api/memory - Force sync to cache
export async function POST(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { action } = await request.json()
    
    if (action === 'sync') {
      // Sync all memories to database
      const agents = getAgents()
      const allMemories: MemoryEntry[] = []
      for (const agent of agents) {
        const workspace = getAgentWorkspace(agent.id)
        const mems = readMemoriesFromWorkspace(workspace, agent.id, agent.name, agent.emoji)
        allMemories.push(...mems)
      }
      saveMemoriesToDb(allMemories)
      return NextResponse.json({ success: true, count: allMemories.length })
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: '同步失败' }, { status: 500 })
  }
}
