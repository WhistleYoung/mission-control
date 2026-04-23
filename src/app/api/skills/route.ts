import { NextResponse } from 'next/server'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import { readdirSync, existsSync, readFileSync, mkdirSync, cpSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'
import { OPENCLAW_CONFIG, getAgentWorkspace } from '@/lib/paths'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes cache

// Get all agent workspaces from OpenClaw config
function getAgentWorkspaces(): { id: string; name: string; workspace: string }[] {
  try {
    if (!existsSync(OPENCLAW_CONFIG)) return []
    const config = JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'))
    const agents = config.agents?.list || []
    return agents.map((agent: any) => ({
      id: agent.id,
      name: agent.name || agent.id,
      workspace: agent.workspace || getAgentWorkspace(agent.id),
    }))
  } catch (e) {
    console.error('Error reading OpenClaw config:', e)
    return []
  }
}

// Parse skill metadata from SKILL.md
function parseSkillMeta(skillPath: string): { name: string; description: string; status: string } {
  const skillMd = join(skillPath, 'SKILL.md')
  try {
    if (existsSync(skillMd)) {
      const content = readFileSync(skillMd, 'utf-8')
      const nameMatch = content.match(/---\s*name:\s*(.+)/)
      const descMatch = content.match(/description:\s*(.+)/)
      return {
        name: nameMatch ? nameMatch[1].trim() : skillPath.split('/').pop() || 'Unknown',
        description: descMatch ? descMatch[1].trim() : '',
        status: 'ready',
      }
    }
  } catch (e) {}
  return {
    name: skillPath.split('/').pop() || 'Unknown',
    description: '',
    status: 'ready',
  }
}

// Scan skills from filesystem for an agent
function scanSkillsFromFiles(agentId: string, agentName: string, workspace: string): any[] {
  const skillsDir = join(workspace, 'skills')
  const skills: any[] = []

  if (existsSync(skillsDir)) {
    try {
      const entries = readdirSync(skillsDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillPath = join(skillsDir, entry.name)
          const meta = parseSkillMeta(skillPath)
          skills.push({
            name: meta.name,
            description: meta.description,
            status: meta.status,
            path: skillPath,
            directory: entry.name,
            agentId,
            agentName,
          })
        }
      }
    } catch (e) {
      console.error(`Error reading skills for agent ${agentId}:`, e)
    }
  }
  return skills
}

// Get skills from SQLite cache
function getSkillsFromCache(): { agentId: string; agentName: string; skills: any[] }[] {
  try {
    const rows = db.prepare('SELECT * FROM skills_cache ORDER BY agent_id, skill_name').all() as any[]
    if (!rows || rows.length === 0) return []

    // Group by agent
    const grouped = new Map<string, { agentId: string; agentName: string; skills: any[] }>()
    for (const row of rows) {
      if (!grouped.has(row.agent_id)) {
        grouped.set(row.agent_id, {
          agentId: row.agent_id,
          agentName: row.agent_name || row.agent_id,
          skills: []
        })
      }
      grouped.get(row.agent_id)!.skills.push({
        name: row.skill_name,
        description: row.skill_description || '',
        status: 'ready',
        path: row.skill_path,
        directory: row.skill_name,
        agentId: row.agent_id,
        agentName: row.agent_name || row.agent_id,
      })
    }
    return Array.from(grouped.values())
  } catch (e) {
    console.error('Error reading skills from cache:', e)
    return []
  }
}

// Save skills to SQLite cache
function saveSkillsToCache(agentId: string, agentName: string, skills: any[]) {
  try {
    const insert = db.prepare(`
      INSERT OR REPLACE INTO skills_cache (skill_name, agent_id, agent_name, skill_path, skill_description)
      VALUES (?, ?, ?, ?, ?)
    `)

    const insertMany = db.transaction((s: any[]) => {
      for (const skill of s) {
        insert.run(skill.name, agentId, agentName, skill.path || '', skill.description || '')
      }
    })

    insertMany(skills)

    // Clear old skills for this agent not in current scan
    const currentNames = skills.map(s => s.name)
    if (currentNames.length > 0) {
      const placeholders = currentNames.map(() => '?').join(',')
      db.prepare(`DELETE FROM skills_cache WHERE agent_id = ? AND skill_name NOT IN (${placeholders})`).run(agentId, ...currentNames)
    }
  } catch (e) {
    console.error('Error saving skills to cache:', e)
  }
}

// List installed skills - read from SQLite, fallback to filesystem
function listInstalledSkills(forceRefresh = false): { agentId: string; agentName: string; skills: any[] }[] {
  // Try to get from cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = getSkillsFromCache()
    if (cached.length > 0) {
      console.log('Skills: returning cached data')
      return cached
    }
  }

  // Scan from filesystem and cache
  console.log('Skills: scanning filesystem...')
  const agents = getAgentWorkspaces()
  const result: { agentId: string; agentName: string; skills: any[] }[] = []

  for (const agent of agents) {
    const skills = scanSkillsFromFiles(agent.id, agent.name, agent.workspace)
    if (skills.length > 0) {
      saveSkillsToCache(agent.id, agent.name, skills)
      result.push({
        agentId: agent.id,
        agentName: agent.name,
        skills,
      })
    }
  }

  // If no skills found, still cache empty result to avoid repeated scans
  if (result.length === 0) {
    for (const agent of agents) {
      if (!result.some(r => r.agentId === agent.id)) {
        result.push({
          agentId: agent.id,
          agentName: agent.name,
          skills: [],
        })
      }
    }
  }

  return result
}

// Get clawhub token from openclaw.json
function getClawhubToken(): string | undefined {
  try {
    if (existsSync(OPENCLAW_CONFIG)) {
      const config = JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'))
      return config.env?.CLAWHUB_TOKEN || undefined
    }
  } catch (e) {}
  return undefined
}

// Search clawhub for skills
function searchClawhub(query: string, apiToken?: string): any[] {
  try {
    // Use npx to ensure clawhub is found on all platforms
    let cmd = `npx clawhub search "${query}"`
    const token = apiToken || getClawhubToken()
    if (token) {
      cmd = `set CLAWHUB_TOKEN=${token} && ${cmd}`
    }
    const output = execSync(cmd, { timeout: 30000, shell: 'cmd.exe' })
    const text = output.toString()

    const lines = text.split('\n').filter((l: string) => l.trim())
    const results: any[] = []

    for (const line of lines) {
      const parts = line.split(/\s{2,}/)
      if (parts.length >= 1) {
        const name = parts[0].trim()
        const desc = parts[1]?.trim() || ''
        if (name && !name.startsWith('-') && !name.startsWith('Search')) {
          results.push({ name, description: desc })
        }
      }
    }

    return results
  } catch (e: any) {
    console.error('Clawhub search error:', e.message)
    return []
  }
}

// Install a skill to specified agents
function installSkillToAgents(skillName: string, targetAgents: 'all' | string[]): { success: boolean; message: string; installed: string[]; failed: string[] } {
  const allAgents = getAgentWorkspaces()
  const installed: string[] = []
  const failed: string[] = []

  const agentsToInstall = targetAgents === 'all'
    ? allAgents
    : allAgents.filter(a => (targetAgents as string[]).includes(a.id))

  for (const agent of agentsToInstall) {
    try {
      const skillsDir = join(agent.workspace, 'skills')
      if (!existsSync(skillsDir)) {
        mkdirSync(skillsDir, { recursive: true })
      }

      execSync(`clawhub install ${skillName} --workdir "${agent.workspace}" --dir skills`, { timeout: 60000 })
      installed.push(agent.name)

      // Update cache for this agent
      const skills = scanSkillsFromFiles(agent.id, agent.name, agent.workspace)
      saveSkillsToCache(agent.id, agent.name, skills)

    } catch (e: any) {
      failed.push(`${agent.name} (${e.message})`)
    }
  }

  if (installed.length === 0) {
    return { success: false, message: `安装失败: ${failed.join(', ')}`, installed, failed }
  }

  return {
    success: true,
    message: failed.length === 0
      ? `成功安装到 ${installed.length} 个Agent: ${installed.join(', ')}`
      : `安装到 ${installed.length} 个Agent成功, ${failed.length} 个失败: ${failed.join(', ')}`,
    installed,
    failed
  }
}

// Copy skill from source agent to target agents
function copySkillToAgents(skillDir: string, sourceAgentId: string, targetAgentIds: string[]): { success: boolean; message: string; copied: string[]; failed: string[] } {
  const agents = getAgentWorkspaces()
  const sourceAgent = agents.find(a => a.id === sourceAgentId)
  if (!sourceAgent) {
    return { success: false, message: `源 Agent 不存在: ${sourceAgentId}`, copied: [], failed: [] }
  }

  const sourceSkillPath = join(sourceAgent.workspace, 'skills', skillDir)
  if (!existsSync(sourceSkillPath)) {
    return { success: false, message: `源技能不存在: ${sourceSkillPath}`, copied: [], failed: [] }
  }

  const copied: string[] = []
  const failed: string[] = []

  for (const targetId of targetAgentIds) {
    if (targetId === sourceAgentId) continue

    const targetAgent = agents.find(a => a.id === targetId)
    if (!targetAgent) {
      failed.push(`${targetId} (Agent不存在)`)
      continue
    }

    try {
      const targetSkillDir = join(targetAgent.workspace, 'skills')
      if (!existsSync(targetSkillDir)) {
        mkdirSync(targetSkillDir, { recursive: true })
      }

      const targetSkillPath = join(targetSkillDir, skillDir)

      if (existsSync(targetSkillPath)) {
        execSync(`rm -rf "${targetSkillPath}"`)
      }

      cpSync(sourceSkillPath, targetSkillPath, { recursive: true, dereference: true })
      copied.push(targetAgent.name)

      // Update cache for target agent
      const skills = scanSkillsFromFiles(targetAgent.id, targetAgent.name, targetAgent.workspace)
      saveSkillsToCache(targetAgent.id, targetAgent.name, skills)

    } catch (e: any) {
      failed.push(`${targetAgent.name} (${e.message})`)
    }
  }

  return {
    success: copied.length > 0,
    message: failed.length === 0
      ? `成功复制到 ${copied.length} 个Agent: ${copied.join(', ')}`
      : `复制到 ${copied.length} 个Agent成功, ${failed.length} 个失败: ${failed.join(', ')}`,
    copied,
    failed
  }
}

// Delete skill from an agent workspace
function deleteSkillFromAgent(skillDir: string, agentId: string): { success: boolean; message: string } {
  const agents = getAgentWorkspaces()
  const agent = agents.find(a => a.id === agentId)
  if (!agent) {
    return { success: false, message: `Agent 不存在: ${agentId}` }
  }

  const skillPath = join(agent.workspace, 'skills', skillDir)
  if (!existsSync(skillPath)) {
    return { success: false, message: `技能不存在: ${skillDir}` }
  }

  try {
    execSync(`rm -rf "${skillPath}"`)

    // Remove from cache
    try {
      db.prepare('DELETE FROM skills_cache WHERE agent_id = ? AND skill_name = ?').run(agentId, skillDir)
    } catch (e) {}

    return { success: true, message: `已从 ${agent.name} 删除技能 ${skillDir}` }
  } catch (e: any) {
    return { success: false, message: `删除失败: ${e.message}` }
  }
}

export async function GET(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'list'
  const query = searchParams.get('query') || ''
  const forceRefresh = searchParams.get('refresh') === 'true'

  try {
    if (action === 'list') {
      // List installed skills - from SQLite cache (fast)
      const skills = listInstalledSkills(forceRefresh)
      return NextResponse.json({ success: true, skills })

    } else if (action === 'search') {
      // Search clawhub (slow, only when explicitly searching)
      if (!query) {
        return NextResponse.json({ error: '搜索关键词不能为空' }, { status: 400 })
      }
      const username = searchParams.get('username') || undefined
      const results = searchClawhub(query, username)
      return NextResponse.json({ success: true, results })

    } else if (action === 'agents') {
      // Get all agents with their workspaces
      const agents = getAgentWorkspaces()
      return NextResponse.json({ success: true, agents })
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 })
  } catch (error: any) {
    console.error('Skills API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { action, skillName, targetAgents, skillDir, sourceAgentId, targetAgentIds, agentId } = await request.json()

    if (action === 'install') {
      if (!skillName) {
        return NextResponse.json({ error: '技能名称不能为空' }, { status: 400 })
      }
      const targetsRaw = targetAgents
      let targets: string[]
      if (!targetsRaw || targetsRaw === 'all' || (Array.isArray(targetsRaw) && targetsRaw.length === 0)) {
        targets = getAgentWorkspaces().map(a => a.id)
      } else if (Array.isArray(targetsRaw)) {
        targets = targetsRaw
      } else {
        targets = getAgentWorkspaces().map(a => a.id)
      }
      const result = installSkillToAgents(skillName, targets)
      return NextResponse.json(result)
    }

    if (action === 'copy') {
      if (!skillDir || !sourceAgentId || !targetAgentIds || !Array.isArray(targetAgentIds)) {
        return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
      }
      const result = copySkillToAgents(skillDir, sourceAgentId, targetAgentIds)
      return NextResponse.json(result)
    }

    if (action === 'delete') {
      if (!skillDir || !agentId) {
        return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
      }
      const result = deleteSkillFromAgent(skillDir, agentId)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 })
  } catch (error: any) {
    console.error('Skills API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
