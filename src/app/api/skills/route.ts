import { NextResponse } from 'next/server'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import { readdirSync, existsSync, readFileSync, mkdirSync, cpSync, constants } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import type { NextRequest } from 'next/server'

const OPENCLAW_CONFIG = '/home/bullrom/.openclaw/openclaw.json'

// Get all agent workspaces from OpenClaw config
function getAgentWorkspaces(): { id: string; name: string; workspace: string }[] {
  try {
    if (!existsSync(OPENCLAW_CONFIG)) return []
    const config = JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'))
    const agents = config.agents?.list || []
    return agents.map((agent: any) => ({
      id: agent.id,
      name: agent.name || agent.id,
      workspace: agent.workspace || `/home/bullrom/.openclaw/workspace-${agent.id}`,
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

// List installed skills for each agent
function listInstalledSkills() {
  const agents = getAgentWorkspaces()
  const result: { agentId: string; agentName: string; skills: any[] }[] = []

  for (const agent of agents) {
    const skillsDir = join(agent.workspace, 'skills')
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
            })
          }
        }
      } catch (e) {
        console.error(`Error reading skills for agent ${agent.id}:`, e)
      }
    }

    result.push({
      agentId: agent.id,
      agentName: agent.name,
      skills,
    })
  }

  return result
}

// Search clawhub for skills
function searchClawhub(query: string): any[] {
  try {
    const output = execSync(`clawhub search "${query}"`, { timeout: 30000 })
    const text = output.toString()
    
    // Parse clawhub search output (simple text parsing)
    const lines = text.split('\n').filter((l: string) => l.trim())
    const results: any[] = []
    
    for (const line of lines) {
      // Try to extract skill name and description from search output
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
    // Return empty array if clawhub fails
    return []
  }
}

// Install a skill to all agent workspaces
function installSkillToAllAgents(skillName: string): { success: boolean; message: string; installed: string[] } {
  const agents = getAgentWorkspaces()
  const installed: string[] = []
  const errors: string[] = []

  for (const agent of agents) {
    try {
      // Ensure skills directory exists
      const skillsDir = join(agent.workspace, 'skills')
      if (!existsSync(skillsDir)) {
        mkdirSync(skillsDir, { recursive: true })
      }

      // Try to install using clawhub
      execSync(`clawhub install ${skillName} --workdir "${agent.workspace}" --dir skills`, { timeout: 60000 })
      installed.push(agent.name)
    } catch (e: any) {
      const msg = `Failed to install to ${agent.name}: ${e.message}`
      console.error(msg)
      errors.push(msg)
    }
  }

  if (installed.length === 0) {
    return { success: false, message: `安装失败: ${errors.join(', ')}`, installed }
  }

  return { 
    success: true, 
    message: `成功安装到 ${installed.length} 个Agent: ${installed.join(', ')}`,
    installed 
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
    if (targetId === sourceAgentId) continue // Skip self
    
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
      
      // Remove existing skill if present
      if (existsSync(targetSkillPath)) {
        execSync(`rm -rf "${targetSkillPath}"`)
      }
      
      // Copy skill directory
      cpSync(sourceSkillPath, targetSkillPath, { recursive: true, dereference: true })
      copied.push(targetAgent.name)
    } catch (e: any) {
      console.error(`Failed to copy skill to ${targetAgent.name}:`, e.message)
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

  try {
    if (action === 'list') {
      // List installed skills for all agents
      const skills = listInstalledSkills()
      return NextResponse.json({ success: true, skills })
    } else if (action === 'search') {
      // Search clawhub
      if (!query) {
        return NextResponse.json({ error: '搜索关键词不能为空' }, { status: 400 })
      }
      const results = searchClawhub(query)
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
      const result = installSkillToAllAgents(skillName)
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
