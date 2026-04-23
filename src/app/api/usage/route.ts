import { NextRequest, NextResponse } from 'next/server'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { verifyAuth } from '@/lib/auth'
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

// Read usage from database (fast path)
function readUsageFromDB() {
  try {
    const agentNames = getAgentNames()
    const agentIds = getAgentIds()
    
    // Get all configured models
    const configuredModels = getAllConfiguredModels()
    
    // Get daily stats from DB
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
    `).all() as any[]
    
    // Get hourly stats from DB (last 24 hours)
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
    
    // Get monthly stats from DB
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
    
    // Get agent stats from DB
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
    
    // Get model stats from DB
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
    
    // Get total sessions count
    const totalSessionsResult = db.prepare(`
      SELECT SUM(session_count) as total FROM usage_stats
    `).get() as any
    const totalSessions = totalSessionsResult?.total || 0
    
    // Build totals
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
    
    const total = {
      inputTokens: totalResult?.inputTokens || 0,
      outputTokens: totalResult?.outputTokens || 0,
      cacheRead: totalResult?.cacheRead || 0,
      cacheWrite: totalResult?.cacheWrite || 0,
      totalTokens: totalResult?.totalTokens || 0,
      cost: totalResult?.cost || 0
    }
    
    // Build agent map with models
    const agentMap: Record<string, any> = {}
    for (const stats of agentStatsRaw) {
      agentMap[stats.agentId] = {
        ...stats,
        models: {}
      }
    }
    
    // Get agent model breakdown from DB
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
    
    // Build model map
    const modelMap: Record<string, any> = {}
    
    // Add configured models with 0 values
    for (const cm of configuredModels) {
      const key = `${cm.provider}:${cm.id}`
      modelMap[key] = {
        model: cm.id,
        provider: cm.provider,
        inputTokens: 0,
        outputTokens: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: 0,
        sessionCount: 0
      }
    }
    
    // Override with actual values
    for (const stats of modelStatsRaw) {
      const key = `${stats.provider}:${stats.model}`
      modelMap[key] = {
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
    
    // Sort agents by total tokens
    const agents = Object.values(agentMap)
      .sort((a, b) => b.totalTokens - a.totalTokens)
      .map((a: any) => ({
        ...a,
        models: Object.values(a.models).sort((m1: any, m2: any) => m2.totalTokens - m1.totalTokens)
      }))
    
    // Sort models by total tokens
    const models = Object.values(modelMap).sort((a: any, b: any) => b.totalTokens - a.totalTokens)
    
    return {
      total,
      totalSessions,
      agents,
      models,
      daily: dailyStats,
      hourly: hourlyStats,
      monthly: monthlyStats,
      fromCache: true
    }
  } catch (error) {
    console.error('Failed to read from DB:', error)
    return null
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

// In-memory cache for usage data
let usageCache: { data: any; timestamp: number } | null = null
const CACHE_TTL_MS = 30 * 1000 // 30 seconds cache

// GET /api/usage
export async function GET(request: NextRequest) {
  // Auth check
  const authResult = await verifyAuth(request)
  if (!authResult.authorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const searchParams = new URL(request.url).searchParams
  const forceRefresh = searchParams.get('refresh') === 'true'
  
  // Try reading from DB cache first (fast path, ~0ms)
  if (!forceRefresh && usageCache && (Date.now() - usageCache.timestamp) < CACHE_TTL_MS) {
    return NextResponse.json(usageCache.data)
  }
  
  // Try reading from database (medium path, ~10-50ms)
  if (!forceRefresh) {
    const dbData = readUsageFromDB()
    if (dbData) {
      // Update cache
      usageCache = { data: dbData, timestamp: Date.now() }
      return NextResponse.json(dbData)
    }
  }
  
  // Fall back to reading files (slow path, ~1000ms+)
  // This also updates the DB cache for next time
  
  const agentNames = getAgentNames()
  const agentIds = getAgentIds()
  
  const agentUsageMap: Record<string, any> = {}
  const modelUsageMap: Record<string, any> = {}
  const dailyUsageMap: Record<string, any> = {}
  const hourlyUsageMap: Record<string, any> = {}
  const monthlyUsageMap: Record<string, any> = {}
  
  let totalUsage: any = {
    inputTokens: 0,
    outputTokens: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: 0
  }
  
  let totalSessions = 0
  
  // Process each agent's sessions
  for (const agentId of agentIds) {
    const sessionsPath = join(AGENTS_DIR, agentId, 'sessions')
    
    // Initialize agent usage
    agentUsageMap[agentId] = {
      agentId,
      agentName: agentNames[agentId] || agentId,
      inputTokens: 0,
      outputTokens: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: 0,
      sessionCount: 0,
      models: {}
    }
    
    try {
      const files = readdirSync(sessionsPath)
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl') && !f.includes('.checkpoint.'))
      
      for (const file of jsonlFiles) {
        const filePath = join(sessionsPath, file)
        
        try {
          const content = readFileSync(filePath, 'utf-8')
          const lines = content.split('\n').filter(l => l.trim())
          
          let lastModel = 'unknown'
          let lastProvider = 'unknown'
          let sessionHasUsage = false
          
          for (const line of lines) {
            try {
              const event = JSON.parse(line)
              
              if (event.type === 'model_change') {
                lastModel = event.modelId || 'unknown'
                lastProvider = event.provider || getProvider('unknown', lastModel)
              }
              
              if (event.type === 'message' && event.message?.usage) {
                const usage = event.message.usage
                const inputTokens = usage.input || 0
                const outputTokens = usage.output || 0
                const cacheRead = usage.cacheRead || 0
                const cacheWrite = usage.cacheWrite || 0
                const totalTokens = usage.totalTokens || 0
                const cost = usage.cost?.total || 0
                
                if (totalTokens > 0) {
                  sessionHasUsage = true
                  
                  const timestamp = event.timestamp || event.message.timestamp
                  const hour = toBeijingHour(timestamp ? new Date(timestamp) : new Date())
                  const date = hour.slice(0, 10)
                  const month = date.slice(0, 7)
                  
                  let model = lastModel
                  let provider = lastProvider
                  if (event.message.model) model = event.message.model
                  if (event.message.provider) {
                    provider = event.message.provider
                  } else {
                    provider = getProvider(event.message.api || 'unknown', model)
                  }
                  
                  // Update agent
                  const agentUsage = agentUsageMap[agentId]
                  agentUsage.inputTokens += inputTokens
                  agentUsage.outputTokens += outputTokens
                  agentUsage.cacheRead += cacheRead
                  agentUsage.cacheWrite += cacheWrite
                  agentUsage.totalTokens += totalTokens
                  agentUsage.cost += cost
                  
                  // Update model key
                  const modelKey = `${provider}:${model}`
                  if (!agentUsage.models[modelKey]) {
                    agentUsage.models[modelKey] = {
                      model,
                      provider,
                      inputTokens: 0,
                      outputTokens: 0,
                      cacheRead: 0,
                      cacheWrite: 0,
                      totalTokens: 0,
                      cost: 0,
                      sessionCount: 0
                    }
                  }
                  const modelUsage = agentUsage.models[modelKey]
                  modelUsage.inputTokens += inputTokens
                  modelUsage.outputTokens += outputTokens
                  modelUsage.cacheRead += cacheRead
                  modelUsage.cacheWrite += cacheWrite
                  modelUsage.totalTokens += totalTokens
                  modelUsage.cost += cost
                  
                  // Update global model
                  if (!modelUsageMap[modelKey]) {
                    modelUsageMap[modelKey] = {
                      model,
                      provider,
                      inputTokens: 0,
                      outputTokens: 0,
                      cacheRead: 0,
                      cacheWrite: 0,
                      totalTokens: 0,
                      cost: 0,
                      sessionCount: 0
                    }
                  }
                  const globalModel = modelUsageMap[modelKey]
                  globalModel.inputTokens += inputTokens
                  globalModel.outputTokens += outputTokens
                  globalModel.cacheRead += cacheRead
                  globalModel.cacheWrite += cacheWrite
                  globalModel.totalTokens += totalTokens
                  globalModel.cost += cost
                  
                  // Update daily
                  if (!dailyUsageMap[date]) {
                    dailyUsageMap[date] = {
                      date,
                      inputTokens: 0,
                      outputTokens: 0,
                      cacheRead: 0,
                      cacheWrite: 0,
                      totalTokens: 0,
                      cost: 0,
                      sessionCount: 0
                    }
                  }
                  const dailyUsage = dailyUsageMap[date]
                  dailyUsage.inputTokens += inputTokens
                  dailyUsage.outputTokens += outputTokens
                  dailyUsage.cacheRead += cacheRead
                  dailyUsage.cacheWrite += cacheWrite
                  dailyUsage.totalTokens += totalTokens
                  dailyUsage.cost += cost
                  
                  // Update hourly
                  if (!hourlyUsageMap[hour]) {
                    hourlyUsageMap[hour] = {
                      hour,
                      agentId,
                      agentName: agentNames[agentId] || agentId,
                      inputTokens: 0,
                      outputTokens: 0,
                      cacheRead: 0,
                      cacheWrite: 0,
                      totalTokens: 0,
                      cost: 0,
                      sessionCount: 0,
                      models: {}
                    }
                  }
                  const hourlyUsage = hourlyUsageMap[hour]
                  hourlyUsage.inputTokens += inputTokens
                  hourlyUsage.outputTokens += outputTokens
                  hourlyUsage.cacheRead += cacheRead
                  hourlyUsage.cacheWrite += cacheWrite
                  hourlyUsage.totalTokens += totalTokens
                  hourlyUsage.cost += cost
                  
                  // Update hourly model breakdown
                  const hourModelKey = provider + ':' + model
                  if (!hourlyUsage.models[hourModelKey]) {
                    hourlyUsage.models[hourModelKey] = { model, provider, inputTokens: 0, outputTokens: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: 0 }
                  }
                  const hm = hourlyUsage.models[hourModelKey]
                  hm.inputTokens += inputTokens
                  hm.outputTokens += outputTokens
                  hm.cacheRead += cacheRead
                  hm.cacheWrite += cacheWrite
                  hm.totalTokens += totalTokens
                  hm.cost += cost
                  
                  // Update monthly
                  if (!monthlyUsageMap[month]) {
                    monthlyUsageMap[month] = {
                      month,
                      inputTokens: 0,
                      outputTokens: 0,
                      cacheRead: 0,
                      cacheWrite: 0,
                      totalTokens: 0,
                      cost: 0,
                      sessionCount: 0
                    }
                  }
                  const monthlyUsage = monthlyUsageMap[month]
                  monthlyUsage.inputTokens += inputTokens
                  monthlyUsage.outputTokens += outputTokens
                  monthlyUsage.cacheRead += cacheRead
                  monthlyUsage.cacheWrite += cacheWrite
                  monthlyUsage.totalTokens += totalTokens
                  monthlyUsage.cost += cost
                  
                  // Update totals
                  totalUsage.inputTokens += inputTokens
                  totalUsage.outputTokens += outputTokens
                  totalUsage.cacheRead += cacheRead
                  totalUsage.cacheWrite += cacheWrite
                  totalUsage.totalTokens += totalTokens
                  totalUsage.cost += cost
                }
              }
            } catch {}
          }
          
          if (sessionHasUsage) {
            agentUsageMap[agentId].sessionCount++
            totalSessions++
          }
        } catch {}
      }
    } catch {}
  }
  
  // Get configured models for padding
  const configuredModels = getAllConfiguredModels()
  
  // Sort agents by total tokens
  const agents = Object.values(agentUsageMap)
    .sort((a: any, b: any) => b.totalTokens - a.totalTokens)
    .map((a: any) => ({
      ...a,
      models: Object.values(a.models).sort((m1: any, m2: any) => m2.totalTokens - m1.totalTokens)
    }))
  
  // Build model list with padding for unused models
  const modelMap: Record<string, any> = {}
  for (const cm of configuredModels) {
    const key = `${cm.provider}:${cm.id}`
    modelMap[key] = {
      model: cm.id,
      provider: cm.provider,
      inputTokens: 0,
      outputTokens: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: 0,
      sessionCount: 0
    }
  }
  for (const [key, model] of Object.entries(modelUsageMap)) {
    modelMap[key] = model
  }
  const models = Object.values(modelMap).sort((a: any, b: any) => b.totalTokens - a.totalTokens)
  
  // Daily: pad to 10 days
  const today = new Date()
  const tenDays: string[] = []
  for (let i = 9; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    tenDays.push(d.toISOString().slice(0, 10))
  }
  const daily = tenDays.map(date => {
    const existing = dailyUsageMap[date]
    if (existing) return existing
    return {
      date,
      inputTokens: 0,
      outputTokens: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: 0,
      sessionCount: 0
    }
  })
  
  // Sort hourly by hour descending, take last 24 hours
  const hourly = Object.values(hourlyUsageMap)
    .sort((a: any, b: any) => b.hour.localeCompare(a.hour))
    .slice(0, 24)
  
  // Sort monthly by month descending
  const monthly = Object.values(monthlyUsageMap)
    .sort((a: any, b: any) => b.month.localeCompare(a.month))

  const result = {
    total: totalUsage,
    totalSessions,
    agents,
    models,
    daily,
    hourly,
    monthly
  }
  
  // Get existing records to preserve old data
  const existingRecords = new Set<string>()
  try {
    const existing = db.prepare('SELECT stat_hour, agent_id, model, provider FROM usage_stats').all() as any[]
    for (const r of existing) {
      existingRecords.add(`${r.stat_hour}:${r.agent_id}:${r.model}:${r.provider}`)
    }
  } catch {}

  // Save to database cache for other fast-read scenarios
  try {
    const insert = db.prepare(`
      INSERT INTO usage_stats (stat_date, stat_hour, agent_id, agent_name, model, provider, 
        input_tokens, output_tokens, cache_read, cache_write, total_tokens, cost, session_count, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)

    const agentNames = getAgentNames()

    // Save all NEW hourly stats to DB (skip existing)
    const insertMany = db.transaction((items: any[]) => {
      for (const item of items) {
        if (item.hour) {
          insert.run(
            item.hour.slice(0, 10),
            item.hour,
            item.agentId || 'unknown',
            agentNames[item.agentId] || item.agentId || 'unknown',
            item.model || 'unknown',
            item.provider || 'unknown',
            item.inputTokens,
            item.outputTokens,
            item.cacheRead,
            item.cacheWrite,
            item.totalTokens,
            item.cost,
            item.sessionCount || 0
          )
        }
      }
    })

    const allItems: any[] = []
    for (const hour of Object.keys(hourlyUsageMap)) {
      const data = hourlyUsageMap[hour]
      for (const modelKey of Object.keys(data.models)) {
        const m = data.models[modelKey]
        const key = `${data.hour}:${data.agentId}:${m.model}:${m.provider}`
        // Only add if not exists
        if (!existingRecords.has(key)) {
          allItems.push({
            hour: data.hour,
            agentId: data.agentId,
            agentName: data.agentName,
            model: m.model,
            provider: m.provider,
            inputTokens: m.inputTokens,
            outputTokens: m.outputTokens,
            cacheRead: m.cacheRead,
            cacheWrite: m.cacheWrite,
            totalTokens: m.totalTokens,
            cost: m.cost,
            sessionCount: m.sessionCount
          })
        }
      }
    }

    if (allItems.length > 0) {
      insertMany(allItems)
    }
  } catch (e) {
    console.error('Failed to save usage to cache:', e)
  }
  
  // Update cache before returning
  usageCache = { data: result, timestamp: Date.now() }
  
  return NextResponse.json(result)
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
