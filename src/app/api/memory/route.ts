import { NextResponse } from 'next/server'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import type { NextRequest } from 'next/server'

const OPENCLAW_CONFIG = '/home/bullrom/.openclaw/openclaw.json'

// Get agent identity info from config
function getAgentIdentity(agentId: string): { name: string; emoji: string } {
  const names: Record<string, string> = {
    main: '小七',
    worker: '壹号牛马',
  }
  const emojis: Record<string, string> = {
    main: '🧑💻',
    worker: '🐂',
  }
  return {
    name: names[agentId] || agentId,
    emoji: emojis[agentId] || '🤖'
  }
}

// Read memory from a workspace
function readMemoryFromWorkspace(workspacePath: string, agentId: string): any[] {
  const memories: any[] = []
  const { name: agentName, emoji: agentEmoji } = getAgentIdentity(agentId)
  
  // Read daily memories from memory/ directory
  const memoryDir = join(workspacePath, 'memory')
  if (existsSync(memoryDir)) {
    try {
      const files = readdirSync(memoryDir)
      for (const file of files.filter(f => f.endsWith('.md'))) {
        const content = readFileSync(join(memoryDir, file), 'utf-8')
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
      })
    } catch (e) {
      console.error(`Error reading MEMORY.md for ${agentId}:`, e)
    }
  }
  
  return memories
}

export async function GET(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const memories: any[] = []
    
    // Get all agents from openclaw config
    let agents: any[] = []
    try {
      if (existsSync(OPENCLAW_CONFIG)) {
        const config = JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'))
        agents = config.agents?.list || []
      }
    } catch (e) {
      console.error('Error reading openclaw config:', e)
    }
    
    // If no agents found, fallback to default workspaces
    if (agents.length === 0) {
      agents = [
        { id: 'main', workspace: '/home/bullrom/.openclaw/workspace' },
        { id: 'worker', workspace: '/home/bullrom/.openclaw/workspace-worker' },
      ]
    }
    
    // Read memory from each agent's workspace
    for (const agent of agents) {
      if (agent.workspace) {
        const agentMemories = readMemoryFromWorkspace(agent.workspace, agent.id)
        memories.push(...agentMemories)
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
