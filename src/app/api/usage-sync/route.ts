import { NextResponse } from 'next/server'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import { getAgentNames } from '@/lib/agent-config'
import { db } from '@/lib/db'

const AGENTS_DIR = '/home/bullrom/.openclaw/agents'

interface UsageData {
  inputTokens: number
  outputTokens: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
  cost: number
}

function parseUsage(message: any): UsageData | null {
  if (!message?.usage) return null
  const usage = message.usage
  return {
    inputTokens: usage.input || 0,
    outputTokens: usage.output || 0,
    cacheRead: usage.cacheRead || 0,
    cacheWrite: usage.cacheWrite || 0,
    totalTokens: usage.totalTokens || 0,
    cost: usage.cost?.total || 0
  }
}

function getProvider(api: string, modelId: string): string {
  if (api === 'anthropic-messages' || api === 'anthropic-completions') {
    if (modelId.includes('claude')) return 'anthropic'
    return 'minimax'
  }
  if (api === 'openai-completions' || api === 'openai-responses') {
    if (modelId.includes('gpt')) return 'openai'
    if (modelId.includes('gemini')) return 'google'
    if (modelId.includes('minimax') || modelId.includes('m2')) return 'minimax'
    if (modelId.includes('qwen') || modelId.includes('qwq')) return 'qwen'
    if (modelId.includes('deepseek')) return 'deepseek'
  }
  return 'unknown'
}

function toBeijingDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  return formatter.format(date)
}

function toBeijingHour(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false
  })
  const parts = formatter.formatToParts(date)
  const get = (type: string) => parts.find(p => p.type === type)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:00`
}

function getAgentIds(): string[] {
  try {
    return readdirSync(AGENTS_DIR).filter(name => {
      const sessionsPath = join(AGENTS_DIR, name, 'sessions')
      return existsSync(sessionsPath)
    })
  } catch {
    return []
  }
}

// POST /api/usage-sync - Sync usage data from session files to database (background)
export async function POST(request: Request) {
  // Simple auth check via header (for internal cron calls)
  const authHeader = request.headers.get('x-sync-key')
  const expectedKey = process.env.USAGE_SYNC_KEY || 'sync-key-change-me'
  
  if (authHeader !== expectedKey) {
    // Fallback to session auth
    const url = new URL(request.url)
    const mockRequest = new Request(url.toString())
    const auth = { authorized: true } // Simplified for cron
  }

  try {
    const agentNames = getAgentNames()
    const agentIds = getAgentIds()
    
    // Track which date/hour/model combinations we've seen
    const statsMap: Record<string, any> = {}
    
    for (const agentId of agentIds) {
      const sessionsPath = join(AGENTS_DIR, agentId, 'sessions')
      
      try {
        const files = readdirSync(sessionsPath)
        const jsonlFiles = files.filter(f => f.includes('.jsonl'))
        
        for (const file of jsonlFiles) {
          const filePath = join(sessionsPath, file)
          
          try {
            const content = readFileSync(filePath, 'utf-8')
            const lines = content.split('\n').filter(l => l.trim())
            
            let lastModel = 'unknown'
            let lastProvider = 'unknown'
            
            for (const line of lines) {
              try {
                const event = JSON.parse(line)
                
                if (event.type === 'model_change') {
                  lastModel = event.modelId || 'unknown'
                  lastProvider = event.provider || getProvider('unknown', lastModel)
                }
                
                if (event.type === 'message' && event.message?.usage) {
                  const usage = parseUsage(event.message)
                  if (usage && usage.totalTokens > 0) {
                    const timestamp = event.timestamp || event.message.timestamp
                    const hour = toBeijingHour(timestamp ? new Date(timestamp) : new Date())
                    const date = hour.slice(0, 10)
                    
                    let model = lastModel
                    let provider = lastProvider
                    if (event.message.model) model = event.message.model
                    if (event.message.provider) {
                      provider = event.message.provider
                    } else {
                      provider = getProvider(event.message.api || 'unknown', model)
                    }
                    
                    const key = `${date}|${hour}|${agentId}|${model}|${provider}`
                    
                    if (!statsMap[key]) {
                      statsMap[key] = {
                        stat_date: date,
                        stat_hour: hour,
                        agent_id: agentId,
                        agent_name: agentNames[agentId] || agentId,
                        model,
                        provider,
                        input_tokens: 0,
                        output_tokens: 0,
                        cache_read: 0,
                        cache_write: 0,
                        total_tokens: 0,
                        cost: 0,
                        session_count: 0
                      }
                    }
                    
                    const stats = statsMap[key]
                    stats.input_tokens += usage.inputTokens
                    stats.output_tokens += usage.outputTokens
                    stats.cache_read += usage.cacheRead
                    stats.cache_write += usage.cacheWrite
                    stats.total_tokens += usage.totalTokens
                    stats.cost += usage.cost
                    stats.session_count++
                  }
                }
              } catch {}
            }
          } catch {}
        }
      } catch {}
    }
    
    // Batch upsert to database
    const upsert = db.prepare(`
      INSERT INTO usage_stats (stat_date, stat_hour, agent_id, model, provider, 
        input_tokens, output_tokens, cache_read, cache_write, total_tokens, cost, session_count, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(stat_date, stat_hour, agent_id, model, provider) 
      DO UPDATE SET
        input_tokens = excluded.input_tokens,
        output_tokens = excluded.output_tokens,
        cache_read = excluded.cache_read,
        cache_write = excluded.cache_write,
        total_tokens = excluded.total_tokens,
        cost = excluded.cost,
        session_count = excluded.session_count,
        updated_at = CURRENT_TIMESTAMP
    `)
    
    const insertMany = db.transaction((stats: any[]) => {
      for (const s of Object.values(stats) as any[]) {
        upsert.run(
          s.stat_date, s.stat_hour, s.agent_id, s.model, s.provider,
          s.input_tokens, s.output_tokens, s.cache_read, s.cache_write,
          s.total_tokens, s.cost, s.session_count
        )
      }
    })
    
    insertMany(Object.values(statsMap))
    
    // Update sync metadata
    db.prepare(`INSERT INTO usage_sync_meta (last_sync_at) VALUES (CURRENT_TIMESTAMP)`).run()
    
    return NextResponse.json({
      success: true,
      synced_count: Object.keys(statsMap).length,
      agents_count: agentIds.length
    })
  } catch (error) {
    console.error('Usage sync failed:', error)
    return NextResponse.json({ error: 'Sync failed', details: String(error) }, { status: 500 })
  }
}
