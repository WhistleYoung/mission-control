import { NextResponse } from 'next/server'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'
import { getOpenClawConfig, getAgentWorkspace } from '@/lib/paths'

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

// Save memories to database (backup mode)
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

// GET /api/memory - Read from files (always up-to-date) + save to cache
export async function GET(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

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

    // Also save to cache for backup
    if (memories.length > 0) {
      saveMemoriesToDb(memories)
    }

    return NextResponse.json(memories)
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