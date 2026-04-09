import { NextResponse } from 'next/server'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import { getAgentNames, getAgentEmojis } from '@/lib/agent-config'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

const OPENCLAW_CONFIG = '/home/bullrom/.openclaw/openclaw.json'

function getAgentIdentity(agentId: string): { name: string; emoji: string } {
  const names = getAgentNames()
  const emojis = getAgentEmojis()
  return {
    name: names[agentId] || agentId,
    emoji: emojis[agentId] || '🤖'
  }
}

// Get agent workspaces from openclaw.json
function getAgentWorkspaces(): { id: string; workspace: string }[] {
  try {
    if (!existsSync(OPENCLAW_CONFIG)) return []
    const config = JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'))
    const agents = config.agents?.list || []
    return agents.map((agent: any) => ({
      id: agent.id,
      workspace: agent.workspace || `/home/bullrom/.openclaw/workspace-${agent.id}`,
    }))
  } catch {
    return []
  }
}

// Read memory from workspace files
function readMemoryFromWorkspace(workspacePath: string, agentId: string): any[] {
  const memories: any[] = []
  const { name: agentName, emoji: agentEmoji } = getAgentIdentity(agentId)

  // Read daily memories from memory/ directory
  const memoryDir = join(workspacePath, 'memory')
  if (existsSync(memoryDir)) {
    try {
      const files = readdirSync(memoryDir)
      for (const file of files.filter(f => f.endsWith('.md'))) {
        const filePath = join(memoryDir, file)
        const content = readFileSync(filePath, 'utf-8')
        const preview = content.substring(0, 200).replace(/[#*`]/g, '').trim()
        memories.push({
          id: `${agentId}-${file}`,
          agentId,
          agentName,
          agentEmoji,
          date: file.replace('.md', '').substring(0, 10),
          preview: preview + (content.length > 200 ? '...' : ''),
          type: file.includes('long-term') || file.includes('MEMORY') ? 'long-term' : 'daily',
          tags: ['日常'],
          content,
          filePath,
        })
      }
    } catch (e) {
      console.error(`Error reading memory dir for ${agentId}:`, e)
    }
  }

  // Read MEMORY.md (long-term memory)
  const memFile = join(workspacePath, 'MEMORY.md')
  if (existsSync(memFile)) {
    try {
      const content = readFileSync(memFile, 'utf-8')
      const preview = content.substring(0, 200).replace(/[#*\n`]/g, ' ').trim()
      memories.push({
        id: `${agentId}-MEMORY`,
        agentId,
        agentName,
        agentEmoji,
        date: new Date().toISOString().split('T')[0],
        preview: preview + (content.length > 200 ? '...' : ''),
        type: 'long-term',
        tags: ['长期', '重要'],
        content,
        filePath: memFile,
      })
    } catch (e) {
      console.error(`Error reading MEMORY.md for ${agentId}:`, e)
    }
  }

  return memories
}

// Get memories from SQLite cache (fast)
function getMemoriesFromCache() {
  try {
    const rows = db.prepare('SELECT * FROM memory_cache ORDER BY agent_id, memory_type').all() as any[]
    return rows.map(row => ({
      id: `${row.agent_id}-${row.memory_type}`,
      agentId: row.agent_id,
      agentName: row.agent_name || row.agent_id,
      agentEmoji: '🤖',
      date: row.file_path ? row.file_path.split('/').pop()?.replace('.md', '').substring(0, 10) || '' : '',
      preview: (row.content || '').substring(0, 200).replace(/[#*`]/g, '').trim(),
      type: row.memory_type,
      tags: row.memory_type === 'long-term' ? ['长期', '重要'] : ['日常'],
      content: row.content,
      filePath: row.file_path,
    }))
  } catch (e) {
    console.error('Error reading memory cache:', e)
    return []
  }
}

// Save memories to SQLite cache
function saveMemoriesToCache(agentId: string, agentName: string, memories: any[]) {
  try {
    const insert = db.prepare(`
      INSERT OR REPLACE INTO memory_cache (agent_id, agent_name, memory_type, content, file_path, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)

    const insertMany = db.transaction((mems: any[]) => {
      for (const m of mems) {
        insert.run(agentId, agentName, m.type, m.content || '', m.filePath || '')
      }
    })

    insertMany(memories)

    // Clear old memories for this agent
    const currentTypes = memories.map(m => m.type)
    if (currentTypes.length > 0) {
      const placeholders = currentTypes.map(() => '?').join(',')
      db.prepare(`DELETE FROM memory_cache WHERE agent_id = ? AND memory_type NOT IN (${placeholders})`).run(agentId, ...currentTypes)
    }
  } catch (e) {
    console.error('Error saving memory cache:', e)
  }
}

// Sync memories from files to cache (background)
function syncMemoryCache() {
  try {
    const workspaces = getAgentWorkspaces()
    for (const { id, workspace } of workspaces) {
      const memories = readMemoryFromWorkspace(workspace, id)
      if (memories.length > 0) {
        saveMemoriesToCache(id, memories[0].agentName, memories)
      }
    }
    console.log('Memory cache synced')
  } catch (e) {
    console.error('Error syncing memory cache:', e)
  }
}

export async function GET(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(request.url)
  const forceRefresh = searchParams.get('refresh') === 'true'

  try {
    // Try cache first
    if (!forceRefresh) {
      const cached = getMemoriesFromCache()
      if (cached.length > 0) {
        // Sort by date descending
        cached.sort((a, b) => b.date.localeCompare(a.date))
        return NextResponse.json(cached)
      }
    }

    // No cache: read from files and cache
    const workspaces = getAgentWorkspaces()
    const memories: any[] = []

    for (const { id, workspace } of workspaces) {
      const mems = readMemoryFromWorkspace(workspace, id)
      memories.push(...mems)
      if (mems.length > 0) {
        saveMemoriesToCache(id, mems[0].agentName, mems)
      }
    }

    // Sort by date descending
    memories.sort((a, b) => b.date.localeCompare(a.date))

    return NextResponse.json(memories)
  } catch (error) {
    console.error('Failed to fetch memories:', error)
    return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 })
  }
}

// POST /api/memory - sync cache in background
export async function POST(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { action } = await request.json()
    if (action === 'sync') {
      // Background sync
      syncMemoryCache()
      return NextResponse.json({ success: true, message: '同步中...' })
    }
    return NextResponse.json({ error: '未知操作' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to sync memories' }, { status: 500 })
  }
}
