import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import type { NextRequest } from 'next/server'
import { existsSync, readFileSync } from 'fs'
import path from 'path'

// Check if message is a real conversation message (user or assistant only)
function isRealConversationMessage(event: any): boolean {
  if (event.type !== 'message' || !event.message) return false
  if (!['user', 'assistant'].includes(event.message.role)) return false
  const content = event.message.content
  if (Array.isArray(content)) {
    return content.some((c: any) => c.type === 'text')
  }
  return false
}

// Clean content - only keep text, remove thinking/reasoning blocks
function cleanContent(content: any): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text || '')
      .join('')
  }
  return String(content)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { id } = await params
    const convId = parseInt(id)
    
    if (isNaN(convId)) {
      return NextResponse.json({ error: '无效的ID' }, { status: 400 })
    }

    const [rows] = await pool.query('SELECT * FROM conversations WHERE id = ?', [convId])
    const convs = rows as any[]
    
    if (convs.length === 0) {
      return NextResponse.json({ error: '对话不存在' }, { status: 404 })
    }
    
    const conv = convs[0]
    const parts = conv.session_key.split(':')
    const agentId = parts[1] || 'main'
    const sessionDir = `/home/bullrom/.openclaw/agents/${agentId}/sessions`
    const sessionFile = conv.session_id 
      ? path.join(sessionDir, `${conv.session_id}.jsonl`)
      : null
    
    if (sessionFile && existsSync(sessionFile)) {
      const content = readFileSync(sessionFile, 'utf-8')
      const lines = content.split('\n').filter(l => l.trim())
      const messages = lines
        .map(l => {
          try {
            const event = JSON.parse(l)
            if (!isRealConversationMessage(event)) return null
            return {
              id: event.id,
              role: event.message.role,
              content: cleanContent(event.message.content),
              timestamp: event.timestamp,
            }
          } catch {
            return null
          }
        })
        .filter(Boolean)
      
      return NextResponse.json(messages)
    }
    
    return NextResponse.json([])
  } catch (error) {
    console.error('Failed to fetch conversation messages:', error)
    return NextResponse.json({ error: '获取消息失败' }, { status: 500 })
  }
}
