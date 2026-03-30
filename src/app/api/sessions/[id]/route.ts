import { NextResponse } from 'next/server'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import type { NextRequest } from 'next/server'

// Extract user text from metadata blocks
function extractUserText(text: string): string {
  if (!text) return ''
  // Split by conversation markers and take the last substantial part
  const parts = text.split('```')
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1].trim()
    if (lastPart) return lastPart
  }
  return text
    .replace(/^Conversation info[\s\S]*?```/gm, '')
    .replace(/^Sender[\s\S]*?```/gm, '')
    .trim()
}

// Check if message is a real conversation message
function isRealConversationMessage(event: any): boolean {
  if (event.type !== 'message' || !event.message) return false
  if (!['user', 'assistant'].includes(event.message.role)) return false
  const content = event.message.content
  if (Array.isArray(content)) {
    return content.some((c: any) => c.type === 'text')
  }
  return typeof content === 'string' && content.length > 0
}

// Clean content - only keep text, remove thinking blocks
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
    
    // Try to find the session in different agents
    const agentsDir = '/home/bullrom/.openclaw/agents'
    let sessionFile: string | null = null
    let foundAgentId = ''
    
    const fs = require('fs')
    const dirs = fs.readdirSync(agentsDir).filter((d: string) => {
      return fs.statSync(join(agentsDir, d)).isDirectory()
    })
    
    for (const dir of dirs) {
      const possiblePath = join(agentsDir, dir, 'sessions', `${id}.jsonl`)
      if (fs.existsSync(possiblePath)) {
        sessionFile = possiblePath
        foundAgentId = dir
        break
      }
    }
    
    if (!sessionFile) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 })
    }
    
    const content = readFileSync(sessionFile, 'utf-8')
    const lines = content.split('\n').filter((l: string) => l.trim())
    
    const messages = lines
      .map((line: string) => {
        try {
          const event = JSON.parse(line)
          if (!isRealConversationMessage(event)) return null
          return {
            id: event.id,
            role: event.message.role,
            content: extractUserText(cleanContent(event.message.content)),
            timestamp: event.timestamp,
          }
        } catch {
          return null
        }
      })
      .filter(Boolean)
    
    return NextResponse.json({
      sessionId: id,
      agentId: foundAgentId,
      messages,
    })
  } catch (error) {
    console.error('Failed to fetch session messages:', error)
    return NextResponse.json({ error: '获取消息失败' }, { status: 500 })
  }
}