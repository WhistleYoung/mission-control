import { NextRequest, NextResponse } from 'next/server'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { verifyAuth } from '@/lib/auth'
import { getAgentNames } from '@/lib/agent-config'

const AGENTS_DIR = '/home/bullrom/.openclaw/agents'
const OPENCLAW_CONFIG = '/home/bullrom/.openclaw/openclaw.json'

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

interface UsageData {
  inputTokens: number
  outputTokens: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
  cost: number
}

interface ModelUsage {
  model: string
  provider: string
  inputTokens: number
  outputTokens: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
  cost: number
  sessionCount: number
}

interface AgentUsage {
  agentId: string
  agentName: string
  inputTokens: number
  outputTokens: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
  cost: number
  sessionCount: number
  models: Record<string, ModelUsage>
}

interface DailyUsage {
  date: string
  inputTokens: number
  outputTokens: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
  cost: number
  sessionCount: number
}

interface HourlyUsage {
  hour: string  // Format: "YYYY-MM-DD HH:00"
  inputTokens: number
  outputTokens: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
  cost: number
  sessionCount: number
}

interface MonthlyUsage {
  month: string  // Format: "YYYY-MM"
  inputTokens: number
  outputTokens: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
  cost: number
  sessionCount: number
}

// Parse usage from message event
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

// Get provider from API name
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

// Get all agent IDs from directory structure
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

// Usage cache to avoid slow disk reads
let usageCache: { data: any; timestamp: number } = {
  data: null,
  timestamp: 0
}
const USAGE_CACHE_TTL = 30000 // 30 seconds

// Format date to Beijing time (UTC+8) hour string
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

// Message-level usage entry with timestamp
interface UsageEntry {
  usage: UsageData
  model: string
  provider: string
  hour: string  // "YYYY-MM-DD HH:00" (Beijing time)
}

// Process a single session file - returns all usage entries with timestamps
function processSessionFile(filePath: string, agentId: string): UsageEntry[] {
  const entries: UsageEntry[] = []
  
  try {
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n').filter(l => l.trim())
    
    let lastModel = 'unknown'
    let lastProvider = 'unknown'
    
    for (const line of lines) {
      try {
        const event = JSON.parse(line)
        
        // Track model changes
        if (event.type === 'model_change') {
          lastModel = event.modelId || 'unknown'
          lastProvider = event.provider || getProvider('unknown', lastModel)
        }
        
        // Extract usage from messages
        if (event.type === 'message' && event.message?.usage) {
          const usage = parseUsage(event.message)
          if (usage && usage.totalTokens > 0) {
            // Get timestamp for hourly aggregation (Beijing time)
            const timestamp = event.timestamp || event.message.timestamp
            let hour = toBeijingHour(new Date())
            if (timestamp) {
              const d = new Date(timestamp)
              hour = toBeijingHour(d)
            }
            
            // Update model info from message
            let model = lastModel
            let provider = lastProvider
            if (event.message.model) {
              model = event.message.model
            }
            if (event.message.provider) {
              provider = event.message.provider
            } else {
              provider = getProvider(event.message.api || 'unknown', model)
            }
            
            entries.push({ usage, model, provider, hour })
          }
        }
      } catch {}
    }
  } catch {}
  
  return entries
}

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

  // Check cache first
  const now = Date.now()
  const searchParams = new URL(request.url).searchParams
  const forceRefresh = searchParams.get('refresh') === 'true'
  
  if (!forceRefresh && usageCache.data && (now - usageCache.timestamp) < USAGE_CACHE_TTL) {
    return NextResponse.json(usageCache.data)
  }

  const agentNames = getAgentNames()
  const agentIds = getAgentIds()
  
  const agentUsageMap: Record<string, AgentUsage> = {}
  const modelUsageMap: Record<string, ModelUsage> = {}
  const dailyUsageMap: Record<string, DailyUsage> = {}
  const hourlyUsageMap: Record<string, HourlyUsage> = {}
  const monthlyUsageMap: Record<string, MonthlyUsage> = {}
  
  let totalUsage: UsageData = {
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
      const jsonlFiles = files.filter(f => f.includes('.jsonl'))
      
      for (const file of jsonlFiles) {
        const filePath = join(sessionsPath, file)
        const entries = processSessionFile(filePath, agentId)
        
        if (entries.length > 0) {
          totalSessions++
          
          // Track if we've counted this session for agent
          let agentSessionCounted = false
          
          for (const entry of entries) {
            const { usage, model, provider, hour } = entry
            
            // Update agent totals
            const agentUsage = agentUsageMap[agentId]
            if (!agentSessionCounted) {
              agentUsage.sessionCount++
              agentSessionCounted = true
            }
            agentUsage.inputTokens += usage.inputTokens
            agentUsage.outputTokens += usage.outputTokens
            agentUsage.cacheRead += usage.cacheRead
            agentUsage.cacheWrite += usage.cacheWrite
            agentUsage.totalTokens += usage.totalTokens
            agentUsage.cost += usage.cost
            
            // Update model key (provider:model)
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
            modelUsage.inputTokens += usage.inputTokens
            modelUsage.outputTokens += usage.outputTokens
            modelUsage.cacheRead += usage.cacheRead
            modelUsage.cacheWrite += usage.cacheWrite
            modelUsage.totalTokens += usage.totalTokens
            modelUsage.cost += usage.cost
            modelUsage.sessionCount++
            
            // Update global model totals
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
            globalModel.inputTokens += usage.inputTokens
            globalModel.outputTokens += usage.outputTokens
            globalModel.cacheRead += usage.cacheRead
            globalModel.cacheWrite += usage.cacheWrite
            globalModel.totalTokens += usage.totalTokens
            globalModel.cost += usage.cost
            globalModel.sessionCount++
            
            // Update daily totals
            const date = hour.slice(0, 10)
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
            dailyUsage.inputTokens += usage.inputTokens
            dailyUsage.outputTokens += usage.outputTokens
            dailyUsage.cacheRead += usage.cacheRead
            dailyUsage.cacheWrite += usage.cacheWrite
            dailyUsage.totalTokens += usage.totalTokens
            dailyUsage.cost += usage.cost
            dailyUsage.sessionCount++
            
            // Update hourly totals
            if (!hourlyUsageMap[hour]) {
              hourlyUsageMap[hour] = {
                hour,
                inputTokens: 0,
                outputTokens: 0,
                cacheRead: 0,
                cacheWrite: 0,
                totalTokens: 0,
                cost: 0,
                sessionCount: 0
              }
            }
            const hourlyUsage = hourlyUsageMap[hour]
            hourlyUsage.inputTokens += usage.inputTokens
            hourlyUsage.outputTokens += usage.outputTokens
            hourlyUsage.cacheRead += usage.cacheRead
            hourlyUsage.cacheWrite += usage.cacheWrite
            hourlyUsage.totalTokens += usage.totalTokens
            hourlyUsage.cost += usage.cost
            hourlyUsage.sessionCount++

            // Update monthly totals
            const month = hour.slice(0, 7)
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
            monthlyUsage.inputTokens += usage.inputTokens
            monthlyUsage.outputTokens += usage.outputTokens
            monthlyUsage.cacheRead += usage.cacheRead
            monthlyUsage.cacheWrite += usage.cacheWrite
            monthlyUsage.totalTokens += usage.totalTokens
            monthlyUsage.cost += usage.cost
            monthlyUsage.sessionCount++
            
            // Update totals
            totalUsage.inputTokens += usage.inputTokens
            totalUsage.outputTokens += usage.outputTokens
            totalUsage.cacheRead += usage.cacheRead
            totalUsage.cacheWrite += usage.cacheWrite
            totalUsage.totalTokens += usage.totalTokens
            totalUsage.cost += usage.cost
          }
        }
      }
    } catch {}
  }
  
  // Sort agents by total tokens (show ALL agents including 0 usage)
  const agents = Object.values(agentUsageMap)
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .map(a => ({
      ...a,
      models: Object.values(a.models).sort((m1, m2) => m2.totalTokens - m1.totalTokens)
    }))
  
  // Get all configured models + merge with actual usage data
  const configuredModels = getAllConfiguredModels()
  const allModelsMap: Record<string, ModelUsage> = {}
  
  // First add all configured models with 0 usage
  for (const cm of configuredModels) {
    const key = `${cm.provider}:${cm.id}`
    if (!allModelsMap[key]) {
      allModelsMap[key] = {
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
  }
  // Then merge actual usage data (overwrites zeros if model was used)
  for (const [key, model] of Object.entries(modelUsageMap)) {
    allModelsMap[key] = model
  }
  const models = Object.values(allModelsMap).sort((a, b) => b.totalTokens - a.totalTokens)
  
  // Daily: pad to exactly 10 days including dates with 0 usage
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
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
    .sort((a, b) => b.hour.localeCompare(a.hour))
    .slice(0, 24)

  // Sort monthly by month descending
  const monthly = Object.values(monthlyUsageMap)
    .sort((a, b) => b.month.localeCompare(a.month))

  const result = {
    total: totalUsage,
    totalSessions,
    agents,
    models,
    daily,
    hourly,
    monthly
  }
  
  // Update cache
  usageCache = { data: result, timestamp: now }

  return NextResponse.json(result)
}
