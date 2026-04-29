import { NextRequest, NextResponse } from 'next/server'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import { getAgentNames } from '@/lib/agent-config'
import { db } from '@/lib/db'
import { AGENTS_DIR, OPENCLAW_CONFIG } from '@/lib/paths'

// Get all configured models from openclaw.json
function getAllConfiguredModels(): Array<{id: string, provider: string}> {
  try {
    const config = JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'))
    const modelsConfig = config.models || { providers: {} }
    const result: Array<{id: string, provider: string}> = []
    for (const [providerId, providerData] of Object.entries(modelsConfig.providers || {})) {
      const provider = providerData as any
      for (const model of (provider.models || [])) {
        result.push({ id: model.id, provider: providerId })
      }
    }
    return result
  } catch {
    return []
  }
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

function parseUsage(message: any): { inputTokens: number; outputTokens: number; cacheRead: number; cacheWrite: number; totalTokens: number; cost: number } | null {
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

// ============ GET /api/usage ============
// 只从 SQLite 读取，不做任何同步
export async function GET(request: NextRequest): Promise<Response> {
  const authResult = await verifyAuth(request)
  if (!authResult.authorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const configuredModels = getAllConfiguredModels()

    // Daily stats (last 10 days)
    const dailyStats = db.prepare(`
      SELECT stat_date as date,
        SUM(input_tokens) as inputTokens,
        SUM(output_tokens) as outputTokens,
        SUM(cache_read) as cacheRead,
        SUM(cache_write) as cacheWrite,
        SUM(total_tokens) as totalTokens,
        SUM(cost) as cost,
        SUM(session_count) as sessionCount
      FROM usage_stats
      GROUP BY stat_date
      ORDER BY stat_date DESC
      LIMIT 10
    `).all() as any[]

    // Hourly stats (last 24 hours)
    const hourlyStats = db.prepare(`
      SELECT stat_hour as hour,
        SUM(input_tokens) as inputTokens,
        SUM(output_tokens) as outputTokens,
        SUM(cache_read) as cacheRead,
        SUM(cache_write) as cacheWrite,
        SUM(total_tokens) as totalTokens,
        SUM(cost) as cost,
        SUM(session_count) as sessionCount
      FROM usage_stats
      GROUP BY stat_hour
      ORDER BY stat_hour DESC
      LIMIT 24
    `).all() as any[]

    // Monthly stats
    const monthlyStats = db.prepare(`
      SELECT substr(stat_date, 1, 7) as month,
        SUM(input_tokens) as inputTokens,
        SUM(output_tokens) as outputTokens,
        SUM(cache_read) as cacheRead,
        SUM(cache_write) as cacheWrite,
        SUM(total_tokens) as totalTokens,
        SUM(cost) as cost,
        SUM(session_count) as sessionCount
      FROM usage_stats
      GROUP BY substr(stat_date, 1, 7)
      ORDER BY month DESC
    `).all() as any[]

    // Agent stats
    const agentStatsRaw = db.prepare(`
      SELECT agent_id as agentId, agent_name as agentName,
        SUM(input_tokens) as inputTokens,
        SUM(output_tokens) as outputTokens,
        SUM(cache_read) as cacheRead,
        SUM(cache_write) as cacheWrite,
        SUM(total_tokens) as totalTokens,
        SUM(cost) as cost,
        SUM(session_count) as sessionCount
      FROM usage_stats
      GROUP BY agent_id
    `).all() as any[]

    // Model stats
    const modelStatsRaw = db.prepare(`
      SELECT model, provider,
        SUM(input_tokens) as inputTokens,
        SUM(output_tokens) as outputTokens,
        SUM(cache_read) as cacheRead,
        SUM(cache_write) as cacheWrite,
        SUM(total_tokens) as totalTokens,
        SUM(cost) as cost,
        SUM(session_count) as sessionCount
      FROM usage_stats
      GROUP BY model, provider
    `).all() as any[]

    // Totals
    const totalResult = db.prepare(`
      SELECT 
        SUM(input_tokens) as inputTokens,
        SUM(output_tokens) as outputTokens,
        SUM(cache_read) as cacheRead,
        SUM(cache_write) as cacheWrite,
        SUM(total_tokens) as totalTokens,
        SUM(cost) as cost
      FROM usage_stats
    `).get() as any

    const totalSessionsResult = db.prepare(`
      SELECT SUM(session_count) as total FROM usage_stats
    `).get() as any

    const total = {
      inputTokens: totalResult?.inputTokens || 0,
      outputTokens: totalResult?.outputTokens || 0,
      cacheRead: totalResult?.cacheRead || 0,
      cacheWrite: totalResult?.cacheWrite || 0,
      totalTokens: totalResult?.totalTokens || 0,
      cost: totalResult?.cost || 0
    }

    const totalSessions = totalSessionsResult?.total || 0

    // Build agent map
    const agentMap: Record<string, any> = {}
    for (const stats of agentStatsRaw) {
      agentMap[stats.agentId] = { ...stats, models: {} }
    }

    // Agent model breakdown
    const agentModelStats = db.prepare(`
      SELECT agent_id, model, provider,
        SUM(input_tokens) as inputTokens,
        SUM(output_tokens) as outputTokens,
        SUM(cache_read) as cacheRead,
        SUM(cache_write) as cacheWrite,
        SUM(total_tokens) as totalTokens,
        SUM(cost) as cost,
        SUM(session_count) as sessionCount
      FROM usage_stats
      GROUP BY agent_id, model, provider
    `).all() as any[]

    for (const stats of agentModelStats) {
      if (agentMap[stats.agent_id]) {
        const key = `${stats.provider}:${stats.model}`
        agentMap[stats.agent_id].models[key] = {
          model: stats.model,
          provider: stats.provider,
          inputTokens: stats.inputTokens,
          outputTokens: stats.outputTokens,
          cacheRead: stats.cacheRead,
          cacheWrite: stats.cacheWrite,
          totalTokens: stats.totalTokens,
          cost: stats.cost,
          sessionCount: stats.sessionCount
        }
      }
    }

    // Build model map (pad with configured models)
    const modelMap: Record<string, any> = {}
    for (const cm of configuredModels) {
      const key = `${cm.provider}:${cm.id}`
      modelMap[key] = { model: cm.id, provider: cm.provider, inputTokens: 0, outputTokens: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: 0, sessionCount: 0 }
    }
    for (const stats of modelStatsRaw) {
      const key = `${stats.provider}:${stats.model}`
      modelMap[key] = { model: stats.model, provider: stats.provider, inputTokens: stats.inputTokens, outputTokens: stats.outputTokens, cacheRead: stats.cacheRead, cacheWrite: stats.cacheWrite, totalTokens: stats.totalTokens, cost: stats.cost, sessionCount: stats.sessionCount }
    }

    const agents = Object.values(agentMap)
      .sort((a: any, b: any) => b.totalTokens - a.totalTokens)
      .map((a: any) => ({
        ...a,
        models: Object.values(a.models).sort((m1: any, m2: any) => m2.totalTokens - m1.totalTokens)
      }))

    const models = Object.values(modelMap).sort((a: any, b: any) => b.totalTokens - a.totalTokens)

    // Pad daily to 10 days
    const today = new Date()
    const tenDays: string[] = []
    for (let i = 9; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      tenDays.push(d.toISOString().slice(0, 10))
    }
    const daily = tenDays.map(date => {
      const existing = dailyStats.find(d => d.date === date)
      return existing || { date, inputTokens: 0, outputTokens: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: 0, sessionCount: 0 }
    })

    return NextResponse.json({
      total,
      totalSessions,
      agents,
      models,
      daily,
      hourly: hourlyStats,
      monthly: monthlyStats
    })
  } catch (error) {
    console.error('Failed to read usage from DB:', error)
    return NextResponse.json({ error: 'Failed to read usage data' }, { status: 500 })
  }
}

// ============ POST /api/usage-sync ============
// 从会话文件读取，同步到 SQLite
export async function POST(request: NextRequest) {
  const authResult = await verifyAuth(request)
  if (!authResult.authorized) {
    return createAuthResponse(false, '请先登录') as Response
  }

  try {
    const agentNames = getAgentNames()
    const agentIds = getAgentIds()

    // 聚合统计数据
    const statsMap: Record<string, any> = {}

    for (const agentId of agentIds) {
      const sessionsPath = join(AGENTS_DIR, agentId, 'sessions')
      try {
        const files = readdirSync(sessionsPath).filter(f => f.endsWith('.jsonl') && !f.includes('.checkpoint.') && !f.includes('.trajectory.'))

        for (const file of files) {
          const filePath = join(sessionsPath, file)
          try {
            const content = readFileSync(filePath, 'utf-8')
            const lines = content.split('\n').filter(l => l.trim())

            let lastModel = 'unknown'
            let lastProvider = 'unknown'
            let sessionHasUsage = false
            let sessionFirstTimestamp: number | null = null

            // First pass: collect all usage
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
                    sessionHasUsage = true
                    if (!sessionFirstTimestamp) {
                      sessionFirstTimestamp = event.timestamp || event.message?.timestamp || Date.now()
                    }

                    const timestamp = event.timestamp || event.message.timestamp
                    const hour = toBeijingHour(timestamp ? new Date(timestamp) : new Date())
                    const date = hour.slice(0, 10)

                    let model = event.message.model || lastModel
                    let provider = event.message.provider || getProvider(event.message.api || 'unknown', model)

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
                  }
                }
              } catch {}
            }

            // Count session once
            if (sessionHasUsage && sessionFirstTimestamp) {
              const hour = toBeijingHour(new Date(sessionFirstTimestamp))
              const date = hour.slice(0, 10)
              // Find the model for first usage
              let foundModel = lastModel
              let foundProvider = lastProvider
              for (const line of lines) {
                try {
                  const event = JSON.parse(line)
                  if (event.type === 'message' && event.message?.usage) {
                    if (event.message.model) foundModel = event.message.model
                    if (event.message.provider) foundProvider = event.message.provider
                    else foundProvider = getProvider(event.message.api || 'unknown', foundModel)
                    break
                  }
                } catch {}
              }
              const key = `${date}|${hour}|${agentId}|${foundModel}|${foundProvider}`
              if (statsMap[key]) {
                statsMap[key].session_count++
              }
            }
          } catch {}
        }
      } catch {}
    }

    // Upsert all stats to DB using ON CONFLICT UPDATE
    const upsert = db.prepare(`
      INSERT INTO usage_stats (stat_date, stat_hour, agent_id, agent_name, model, provider,
        input_tokens, output_tokens, cache_read, cache_write, total_tokens, cost, session_count, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(stat_date, stat_hour, agent_id, model, provider) 
      DO UPDATE SET
        agent_name = excluded.agent_name,
        input_tokens = excluded.input_tokens,
        output_tokens = excluded.output_tokens,
        cache_read = excluded.cache_read,
        cache_write = excluded.cache_write,
        total_tokens = excluded.total_tokens,
        cost = excluded.cost,
        session_count = excluded.session_count,
        updated_at = CURRENT_TIMESTAMP
    `)

    const insertMany = db.transaction((items: any[]) => {
      for (const s of items) {
        upsert.run(
          s.stat_date, s.stat_hour, s.agent_id, s.agent_name, s.model, s.provider,
          s.input_tokens, s.output_tokens, s.cache_read, s.cache_write,
          s.total_tokens, s.cost, s.session_count
        )
      }
    })

    const items = Object.values(statsMap) as any[]
    insertMany(items)

    return NextResponse.json({
      success: true,
      synced_count: items.length,
      agents_count: agentIds.length
    })
  } catch (error) {
    console.error('Usage sync failed:', error)
    return NextResponse.json({ error: 'Sync failed', details: String(error) }, { status: 500 })
  }
}