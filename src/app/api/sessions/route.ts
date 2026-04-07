import { NextResponse } from 'next/server'
import { readdirSync, readFileSync, existsSync, statSync } from 'fs'
import { join, basename } from 'path'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getAgentNames } from '@/lib/agent-config'
import type { NextRequest } from 'next/server'

const AGENTS_DIR = '/home/bullrom/.openclaw/agents'

// Sessions cache to avoid slow disk reads
let sessionsCache: { sessions: any[]; timestamp: number } = {
  sessions: [],
  timestamp: 0
}
const SESSIONS_CACHE_TTL = 300000 // 5 minutes - return cached immediately

// Agent name mapping from openclaw.json
function getAgentName(agentId: string): string {
  const names = getAgentNames()
  return names[agentId] || agentId
}

// Check if message is a real conversation message
function isRealConversationMessage(event: any): boolean {
  if (event.type !== 'message' || !event.message) return false
  if (!['user', 'assistant'].includes(event.message.role)) return false
  const content = event.message.content
  if (Array.isArray(content)) {
    // User: accept if has text
    if (event.message.role === 'user') {
      return content.some((c: any) => c.type === 'text')
    }
    // Assistant: only accept if has text (skip pure thinking/toolCall messages)
    return content.some((c: any) => c.type === 'text')
  }
  return typeof content === 'string' && content.length > 0
}

// Check if session is a cron/heartbeat session - optimized to only read first few lines
function isCronSession(filePath: string): boolean {
  // Only read first 2KB of file to check for cron patterns (much faster)
  const fd = require('fs').openSync(filePath, 'r')
  const buffer = Buffer.alloc(2048)
  const bytesRead = require('fs').readSync(fd, buffer, 0, 2048, 0)
  require('fs').closeSync(fd)
  
  if (bytesRead === 0) return false
  
  const content = buffer.toString('utf-8', 0, bytesRead)
  const lines = content.split('\n').filter(l => l.trim())
  
  // Check first few lines for cron patterns
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    try {
      const event = JSON.parse(lines[i])
      const sessionKey = event.sessionKey || event.id || ''
      
      // Skip if session key contains cron or heartbeat (reliable indicator)
      if (sessionKey.includes(':cron:') || sessionKey.includes('cron:')) return true
      if (sessionKey.includes(':heartbeat') || sessionKey.includes('heartbeat')) return true
      
      // Skip if first user message is clearly a cron/heartbeat message
      if (event.message?.role === 'user') {
        const message = event.message?.content
        // Extract actual text content from the message array
        let textContent = ''
        if (typeof message === 'string') {
          textContent = message
        } else if (Array.isArray(message)) {
          const textObj = message.find((c: any) => c.type === 'text')
          textContent = textObj?.text || ''
        }
        
        // Check for [cron: pattern at start - reliable cron indicator
        if (textContent.startsWith('[cron:') || textContent.startsWith('[heartbeat') || textContent.startsWith('[cron ')) {
          return true
        }
        
        // Also filter short messages with heartbeat/cron
        if (textContent.length < 100) {
          const lowerMsg = textContent.toLowerCase()
          if (lowerMsg.includes('heartbeat') || lowerMsg.includes('cron')) {
            return true
          }
        }
      }
    } catch {}
  }
  return false
}

// Clean content - only keep TEXT, completely skip thinking and tool calls
function cleanContent(content: any): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    // For user messages: extract text
    // For assistant messages: ONLY extract text, skip thinking and tool calls entirely
    const texts = content
      .filter((c: any) => c.type === 'text' && c.text && c.text.trim())
      .map((c: any) => c.text.trim())
    return texts.join(' ').trim()
  }
  return String(content)
}

// Check if content is a system message (should be filtered out)
function isSystemMessage(text: string): boolean {
  if (!text) return false
  // Filter out system log messages
  const lowerText = text.toLowerCase()
  if (lowerText.startsWith('system:')) return true
  if (lowerText.startsWith('system ')) return true
  if (lowerText.includes('[gmt+8]') && lowerText.includes('exec completed')) return true
  // Filter out heartbeat/cron system messages
  if (lowerText.includes('heartbeat_ok')) return true
  return false
}

// Extract text from message content (handles both user and assistant)
function extractUserText(text: string, role?: string): string {
  if (!text) return ''
  
  // Skip system messages
  if (isSystemMessage(text)) return ''
  
  // For user messages, remove metadata blocks
  if (role === 'user') {
    // Split by conversation markers and take the last substantial part
    const parts = text.split('```')
    if (parts.length > 1) {
      // Take the last part after the last ```
      const lastPart = parts[parts.length - 1].trim()
      if (lastPart) return lastPart
    }
    // Remove metadata blocks
    return text
      .replace(/^Conversation info[\s\S]*?```/gm, '')
      .replace(/^Sender[\s\S]*?```/gm, '')
      .trim()
  }
  
  return text
}

// Parse session file and extract conversations
function parseSessionFile(filePath: string, agentId: string) {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n').filter(l => l.trim())
    
    const messages: any[] = []
    for (const line of lines) {
      try {
        const event = JSON.parse(line)
        if (isRealConversationMessage(event)) {
          const role = event.message.role
          const rawContent = cleanContent(event.message.content)
          const content = extractUserText(rawContent, role)
          
          // Skip empty or system messages
          if (!content || content.length < 2) continue
          
          // For assistant messages, only keep pure text responses (no tool calls, no thinking)
          if (role === 'assistant') {
            // Check if content is just tool call summaries or empty
            if (!content.trim() || content.startsWith('[调用工具:')) continue
          }
          
          messages.push({
            id: event.id,
            role,
            content,
            timestamp: event.timestamp,
          })
        }
      } catch {}
    }
    
    return messages
  } catch (e) {
    return []
  }
}

// Get projects from database for tagging
async function getProjects(): Promise<{ id: number; name: string; emoji: string }[]> {
  try {
    const [rows] = await pool.query('SELECT id, name, emoji FROM projects')
    return rows as { id: number; name: string; emoji: string }[]
  } catch {
    return []
  }
}

// Auto-tag conversation based on content matching project names
async function autoTagConversation(messages: any[], projects: { id: number; name: string; emoji: string }[]): Promise<{ projectId: number | null; projectName: string; projectEmoji: string; autoTags: string[] }> {
  const allText = messages.map(m => m.content.toLowerCase()).join(' ')
  
  // Find matching projects by name
  let matchedProject: { id: number; name: string; emoji: string } | null = null
  for (const proj of projects) {
    if (allText.includes(proj.name.toLowerCase())) {
      matchedProject = proj
      break
    }
  }
  
  // Auto categorize based on keywords
  const autoTags: string[] = []
  if (allText.includes('mission control') || allText.includes('任务') || allText.includes('项目')) {
    autoTags.push('项目相关')
  }
  if (allText.includes('优化') || allText.includes('新增') || allText.includes('修改') || allText.includes('bug') || allText.includes('功能')) {
    autoTags.push('功能开发')
  }
  if (allText.includes('部署') || allText.includes('启动') || allText.includes('服务') || allText.includes('运行')) {
    autoTags.push('运维')
  }
  if (allText.includes('设备') || allText.includes('监控') || allText.includes('云智眼') || allText.includes('摄像头')) {
    autoTags.push('设备管理')
  }
  if (allText.includes('文档') || allText.includes('飞书') || allText.includes('wiki') || allText.includes('知识库')) {
    autoTags.push('文档协作')
  }
  if (allText.includes('天气') || allText.includes('查询') || allText.includes('搜索')) {
    autoTags.push('信息查询')
  }
  if (allText.includes('定时') || allText.includes('cron') || allText.includes('schedule')) {
    autoTags.push('定时任务')
  }
  
  // Default tag if nothing matched
  if (autoTags.length === 0 && messages.length > 0) {
    autoTags.push('日常对话')
  }
  
  return {
    projectId: matchedProject?.id || null,
    projectName: matchedProject?.name || '',
    projectEmoji: matchedProject?.emoji || '',
    autoTags,
  }
}

// Generate title from first user message
function generateTitle(messages: any[]): string {
  const userMessage = messages.find(m => m.role === 'user')
  if (userMessage && userMessage.content) {
    const content = userMessage.content.substring(0, 50)
    return content + (userMessage.content.length > 50 ? '...' : '')
  }
  return '新对话'
}

export async function GET(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  // Check cache first
  const now = Date.now()
  const searchParams = new URL(request.url).searchParams
  const forceRefresh = searchParams.get('refresh') === 'true'
  
  if (!forceRefresh && sessionsCache.timestamp && (now - sessionsCache.timestamp) < SESSIONS_CACHE_TTL) {
    let sessions = sessionsCache.sessions
    // Still apply filters if needed
    const agentId = searchParams.get('agentId')
    const projectId = searchParams.get('projectId')
    if (agentId) sessions = sessions.filter(s => s.agentId === agentId)
    if (projectId) sessions = sessions.filter(s => s.projectId === Number(projectId))
    return NextResponse.json(sessions)
  }

  try {
    const agentId = searchParams.get('agentId')
    const projectId = searchParams.get('projectId')
    
    const sessions: any[] = []
    
    // Get projects from DB for auto-tagging
    const projects = await getProjects()
    
    // Get saved project assignments from database
    const [savedProjects]: any = await pool.query('SELECT session_id, project_id FROM conversations WHERE session_id IS NOT NULL')
    console.log(`GET sessions: found ${savedProjects.length} saved project assignments`)
    const savedProjectMap: Record<string, number> = {}
    for (const row of savedProjects) {
      if (row.session_id) {
        savedProjectMap[row.session_id] = row.project_id
      }
    }
    
    // Read all agents
    if (!existsSync(AGENTS_DIR)) {
      return NextResponse.json([])
    }
    
    const agentDirs = readdirSync(AGENTS_DIR).filter(d => {
      const dirPath = join(AGENTS_DIR, d)
      return statSync(dirPath).isDirectory()
    })
    
    for (const dir of agentDirs) {
      if (agentId && dir !== agentId) continue
      
      const sessionsDir = join(AGENTS_DIR, dir, 'sessions')
      if (!existsSync(sessionsDir)) continue
      
      const files = readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'))
      
      for (const file of files) {
        // Skip reset files
        if (file.includes('.reset.')) continue
        
        const filePath = join(sessionsDir, file)
        
        // Skip cron/heartbeat sessions
        try {
          if (isCronSession(filePath)) continue
        } catch {
          continue
        }
        
        // Get session ID from filename
        const sessionId = file.replace('.jsonl', '')
        
        // Parse messages
        const messages = parseSessionFile(filePath, dir)
        
        // Skip sessions with no real messages
        if (messages.length === 0) continue
        
        // Auto-tag with projects and categories
        const tagResult = await autoTagConversation(messages, projects)
        
        // Use saved project if exists (check for null explicitly), otherwise use auto-tag result
        const savedProjectId = savedProjectMap[sessionId]
        const finalProjectId = savedProjectId !== undefined && savedProjectId !== null ? savedProjectId : tagResult.projectId
        
        // Find project info
        const project = projects.find(p => p.id === finalProjectId)
        
        // Filter by project if requested
        if (projectId && finalProjectId !== parseInt(projectId)) {
          continue
        }
        
        const title = generateTitle(messages)
        
        sessions.push({
          id: sessionId,
          agentId: dir,
          agentName: getAgentName(dir),
          title,
          messageCount: messages.length,
          projectId: finalProjectId,
          projectName: project?.name || tagResult.projectName,
          projectEmoji: project?.emoji || tagResult.projectEmoji,
          autoTags: tagResult.autoTags,
          firstMessage: messages[0]?.timestamp,
          lastMessage: messages[messages.length - 1]?.timestamp,
        })
      }
    }
    
    // Sort by last message time
    sessions.sort((a, b) => new Date(b.lastMessage).getTime() - new Date(a.lastMessage).getTime())
    
    // Update cache
    sessionsCache = { sessions, timestamp: now }
    
    return NextResponse.json(sessions)
  } catch (error) {
    console.error('Failed to fetch sessions:', error)
    return NextResponse.json({ error: '获取会话失败' }, { status: 500 })
  }
}
// PATCH - Update session project tag and custom tags
export async function PATCH(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { sessionId, projectId, customTags } = await request.json()
    
    if (!sessionId) {
      return NextResponse.json({ error: '缺少会话ID' }, { status: 400 })
    }
    
    // Store project tag and custom tags in database (conversations table)
    // First check if session exists in conversations table
    const [rows]: any = await pool.query(
      'SELECT id FROM conversations WHERE session_id = ? LIMIT 1',
      [sessionId]
    )
    
    const tagsJson = customTags ? JSON.stringify(customTags) : null
    
    // Debug log
    console.log(`PATCH sessions: sessionId=${sessionId}, projectId=${projectId}, customTags=${customTags}`)
    
    if (rows.length > 0) {
      // Update existing record
      if (projectId !== undefined) {
        console.log(`Updating existing record: project_id=${projectId}`)
        await pool.query(
          'UPDATE conversations SET project_id = ?, custom_tags = ? WHERE session_id = ?',
          [projectId, tagsJson, sessionId]
        )
      } else if (customTags !== undefined) {
        await pool.query(
          'UPDATE conversations SET custom_tags = ? WHERE session_id = ?',
          [tagsJson, sessionId]
        )
      }
    } else {
      // Insert new record (store session info without full sync)
      // Use 'realtime' as placeholder agent_id since realtime sessions don't have a proper agent_id
      console.log(`Inserting new record: session_id=${sessionId}, project_id=${projectId}`)
      await pool.query(
        'INSERT INTO conversations (session_id, agent_id, project_id, custom_tags, title, message_count) VALUES (?, ?, ?, ?, ?, ?)',
        [sessionId, 'realtime', projectId, tagsJson, `Session ${sessionId}`, 0]
      )
    }
    
    return NextResponse.json({ success: true, sessionId, projectId, customTags })
  } catch (error) {
    console.error('Failed to update session:', error)
    return NextResponse.json({ error: '更新会话失败' }, { status: 500 })
  }
}
