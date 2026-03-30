import { NextResponse } from 'next/server'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const memories: any[] = []
    
    // Read memory from main workspace
    const mainWorkspace = '/home/bullrom/.openclaw/workspace'
    const mainMemoryDir = join(mainWorkspace, 'memory')
    
    if (existsSync(mainMemoryDir)) {
      const files = readdirSync(mainMemoryDir)
      for (const file of files.filter(f => f.endsWith('.md'))) {
        const content = readFileSync(join(mainMemoryDir, file), 'utf-8')
        const preview = content.substring(0, 200).replace(/[#*`]/g, '').trim()
        memories.push({
          id: `main-${file}`,
          agentId: 'main',
          agentName: '小七',
          agentEmoji: '🧑💻',
          date: file.replace('.md', '').substring(0, 10),
          preview: preview + (content.length > 200 ? '...' : ''),
          type: file.includes('long-term') || file.includes('MEMORY') ? 'long-term' : 'daily',
          tags: ['日常'],
        })
      }
    }
    
    // Read MEMORY.md from main workspace
    const mainMemFile = join(mainWorkspace, 'MEMORY.md')
    if (existsSync(mainMemFile)) {
      const content = readFileSync(mainMemFile, 'utf-8')
      const preview = content.substring(0, 200).replace(/[#*`\n]/g, ' ').trim()
      memories.push({
        id: 'main-MEMORY',
        agentId: 'main',
        agentName: '小七',
        agentEmoji: '🧑💻',
        date: new Date().toISOString().split('T')[0],
        preview: preview + (content.length > 200 ? '...' : ''),
        type: 'long-term',
        tags: ['长期', '重要'],
      })
    }
    
    // Read memory from worker workspace
    const workerWorkspace = '/home/bullrom/.openclaw/workspace-worker'
    const workerMemoryDir = join(workerWorkspace, 'memory')
    
    if (existsSync(workerMemoryDir)) {
      const files = readdirSync(workerMemoryDir)
      for (const file of files.filter(f => f.endsWith('.md'))) {
        const content = readFileSync(join(workerMemoryDir, file), 'utf-8')
        const preview = content.substring(0, 200).replace(/[#*`]/g, '').trim()
        memories.push({
          id: `worker-${file}`,
          agentId: 'worker',
          agentName: '壹号牛马',
          agentEmoji: '🐂',
          date: file.replace('.md', '').substring(0, 10),
          preview: preview + (content.length > 200 ? '...' : ''),
          type: 'daily',
          tags: ['日常'],
        })
      }
    }
    
    // Read MEMORY.md from worker workspace
    const workerMemFile = join(workerWorkspace, 'MEMORY.md')
    if (existsSync(workerMemFile)) {
      const content = readFileSync(workerMemFile, 'utf-8')
      const preview = content.substring(0, 200).replace(/[#*`\n]/g, ' ').trim()
      memories.push({
        id: 'worker-MEMORY',
        agentId: 'worker',
        agentName: '壹号牛马',
        agentEmoji: '🐂',
        date: new Date().toISOString().split('T')[0],
        preview: preview + (content.length > 200 ? '...' : ''),
        type: 'long-term',
        tags: ['长期', '重要'],
      })
    }
    
    // Sort by date descending
    memories.sort((a, b) => b.date.localeCompare(a.date))
    
    return NextResponse.json(memories)
  } catch (error) {
    console.error('Failed to fetch memories:', error)
    return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 })
  }
}
