/**
 * Shared utility for loading agent names from openclaw.json config
 * This ensures all API routes use the same source of truth for agent names
 */
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { OPENCLAW_CONFIG } from './paths'

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

  try {
    const configPath = OPENCLAW_CONFIG
    if (!existsSync(configPath)) {
      return getDefaultAgents()
    }

    const config = JSON.parse(readFileSync(configPath, 'utf-8'))
    const agentsList = config.agents?.list || []
    
    agentCache = agentsList.map((agent: any) => ({
      id: agent.id,
      name: agent.name || agent.id,
      emoji: agent.emoji || undefined,
    }))
    cacheTimestamp = Date.now()
    
    return agentCache!
  } catch (error) {
    console.error('Failed to load agent config:', error)
    return getDefaultAgents()
  }
}

function getDefaultAgents(): AgentInfo[] {
  return [
    { id: 'main', name: '小七', emoji: '🧑💻' },
    { id: 'worker', name: '壹号牛马', emoji: '🐂' },
    { id: 'devper', name: 'devper', emoji: '🎸' },
  ]
}

let cacheTimestamp = 0
