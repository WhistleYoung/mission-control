/**
 * Shared utility for loading agent names from openclaw.json config
 * This ensures all API routes use the same source of truth for agent names
 */
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { OPENCLAW_CONFIG, AGENTS_DIR } from './paths'

interface AgentInfo {
  id: string
  name: string
  emoji?: string
}

let agentCache: AgentInfo[] | null = null
const CACHE_TTL = 30000 // 30 seconds

// Chinese aliases for agents without a meaningful name set in config
const CHINESE_ALIASES: Record<string, string> = {
  main: '小七',
  worker: '壹号牛马',
  devper: '编程小能手',
  codrever: '代码稽核',
  writer: '写作小能手',
  shenhe: '版权稽核',
  shipinyun: '视频云开发',
  shipysw: '视频云算法',
  huibao: '汇报机器人',
}

export function getAgentNames(): Record<string, string> {
  const agents = getAgentsList()
  const result: Record<string, string> = {}
  for (const agent of agents) {
    // If name is same as id (no custom name set), use Chinese alias
    if (agent.name === agent.id && CHINESE_ALIASES[agent.id]) {
      result[agent.id] = CHINESE_ALIASES[agent.id]
    } else {
      result[agent.id] = agent.name
    }
  }
  return result
}

export function getAgentEmojis(): Record<string, string> {
  // Default emojis for agents without IDENTITY.md
  const defaults: Record<string, string> = {
    main: '🧑💻',
    worker: '🐂',
    devper: '🎸',
  }
  
  const agents = getAgentsList()
  for (const agent of agents) {
    if (agent.emoji) {
      defaults[agent.id] = agent.emoji
    }
  }
  return defaults
}

export function getAgentsList(): AgentInfo[] {
  // Use cache if fresh
  if (agentCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return agentCache
  }

  const result: AgentInfo[] = []
  const seenIds = new Set<string>()

  // 1. First, get agents from openclaw.json (has higher priority for name/emoji)
  try {
    const configPath = OPENCLAW_CONFIG
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'))
      const agentsList = config.agents?.list || []
      for (const agent of agentsList) {
        if (!seenIds.has(agent.id)) {
          result.push({
            id: agent.id,
            name: agent.name || CHINESE_ALIASES[agent.id] || agent.id,
            emoji: agent.emoji || undefined,
          })
          seenIds.add(agent.id)
        }
      }
    }
  } catch (error) {
    console.error('Failed to load agents from config:', error)
  }

  // 2. Also scan AGENTS_DIR for directories with sessions (discover agents not in config)
  try {
    if (existsSync(AGENTS_DIR)) {
      const dirs = readdirSync(AGENTS_DIR)
      for (const dir of dirs) {
        if (!seenIds.has(dir)) {
          const sessionsPath = join(AGENTS_DIR, dir, 'sessions')
          // Only add if sessions directory exists
          if (existsSync(sessionsPath)) {
            result.push({
              id: dir,
              name: CHINESE_ALIASES[dir] || dir,
              emoji: undefined,
            })
            seenIds.add(dir)
          }
        }
      }
    }
  } catch {}

  cacheTimestamp = Date.now()
  agentCache = result
  return result
}

function getDefaultAgents(): AgentInfo[] {
  return [
    { id: 'main', name: '小七', emoji: '🧑💻' },
    { id: 'worker', name: '壹号牛马', emoji: '🐂' },
    { id: 'devper', name: 'devper', emoji: '🎸' },
  ]
}

let cacheTimestamp = 0
