import { NextResponse } from 'next/server'
import { rmSync, readFileSync, writeFileSync, existsSync, mkdirSync, cpSync } from 'fs'
import path, { join, resolve } from 'path'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import { restartGateway } from '@/lib/gateway'
import { getAgentNames, getAgentEmojis } from '@/lib/agent-config'
import type { NextRequest } from 'next/server'
import { OPENCLAW_CONFIG, MC_AGENT_CONFIGS, TEMPLATE_WORKSPACE, getAgentWorkspace, getAgentDir, MC_DATA_DIR, WORKSPACE, WORKSPACE_PREFIX } from '@/lib/paths'

function getAgentIdentityName(agentId: string, agentName?: string): string {
  // Use names from openclaw.json config (single source of truth)
  const names = getAgentNames()
  // If agent has a name in config and it's different from the id, use it
  if (agentName && agentName !== agentId && !names[agentId]) {
    return agentName
  }
  return names[agentId] || agentId
}

function getAgentIdentityEmoji(agentId: string, workspacePath?: string): string {
  // Try to read from IDENTITY.md first
  if (workspacePath) {
    try {
      const identityPath = join(workspacePath, 'IDENTITY.md')
      if (existsSync(identityPath)) {
        const content = readFileSync(identityPath, 'utf-8')
        const match = content.match(/- \*\*Emoji:\*\* (.+)/)
        if (match) return match[1].trim()
      }
    } catch (e) {}
  }
  
  // Fallback to emojis from openclaw.json config
  const emojis = getAgentEmojis()
  return emojis[agentId] || '🤖'
}

// Parse AGENTS.md
function parseAgentsFile(workspacePath: string): string | null {
  const filePath = join(workspacePath, 'AGENTS.md')
  if (!existsSync(filePath)) return null
  try {
    return readFileSync(filePath, 'utf-8')
  } catch (e) {
    return null
  }
}

// Parse SOUL.md
function parseSoulFile(workspacePath: string): { coreTruths?: string; boundaries?: string; vibe?: string; continuity?: string } | null {
  const soulPath = join(workspacePath, 'SOUL.md')
  if (!existsSync(soulPath)) return null
  
  try {
    const content = readFileSync(soulPath, 'utf-8')
    const result: any = {}
    
    // Parse sections using markdown headers
    const sections = [
      { key: 'coreTruths', header: '## Core Truths' },
      { key: 'boundaries', header: '## Boundaries' },
      { key: 'vibe', header: '## Vibe' },
      { key: 'continuity', header: '## Continuity' },
    ]
    
    for (const section of sections) {
      const regex = new RegExp(`${section.header}[\\s\\S]*?(?=## |$)`, 'i')
      const match = content.match(regex)
      if (match) {
        // Remove the header and clean up
        let text = match[0].replace(section.header, '').trim()
        // Remove leading/trailing whitespace
        text = text.replace(/^\s*[\r\n]+/gm, '').trim()
        if (text) result[section.key] = text
      }
    }
    
    return Object.keys(result).length > 0 ? result : null
  } catch (e) {
    console.log('Error parsing SOUL.md:', e)
    return null
  }
}

// Parse USER.md
function parseUserFile(workspacePath: string): { name?: string; callName?: string; pronouns?: string; timezone?: string; notes?: string; context?: string } | null {
  const filePath = join(workspacePath, 'USER.md')
  if (!existsSync(filePath)) return null
  
  try {
    const content = readFileSync(filePath, 'utf-8')
    const result: any = {}
    
    // Parse simple key-value format
    const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/)
    if (nameMatch) result.name = nameMatch[1].trim()
    
    const callNameMatch = content.match(/\*\*What to call them:\*\*\s*(.+)/)
    if (callNameMatch) result.callName = callNameMatch[1].trim()
    
    const pronounsMatch = content.match(/\*\*Pronouns:\*\*\s*(.+)/)
    if (pronounsMatch) result.pronouns = pronounsMatch[1].trim()
    
    const timezoneMatch = content.match(/\*\*Timezone:\*\*\s*(.+)/)
    if (timezoneMatch) result.timezone = timezoneMatch[1].trim()
    
    // Extract notes section
    const notesMatch = content.match(/## Context\n([\s\S]*?)(?:---|$)/)
    if (notesMatch) result.context = notesMatch[1].trim()
    
    return Object.keys(result).length > 0 ? result : null
  } catch (e) {
    console.log('Error parsing USER.md:', e)
    return null
  }
}

export async function GET(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  let localModels: Record<string, string> = {}
  try {
    if (existsSync(MC_AGENT_CONFIGS)) {
      localModels = JSON.parse(readFileSync(MC_AGENT_CONFIGS, 'utf-8'))
    }
  } catch (e) {}

  let openclawConfig: any = { agents: { list: [] }, bindings: [] }
  try {
    if (existsSync(OPENCLAW_CONFIG)) {
      openclawConfig = JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'))
    }
  } catch (e) {}

  const agentsList = openclawConfig.agents?.list || []
  const bindings = openclawConfig.bindings || []
  
  const agents = agentsList.map((agent: any) => {
    const localModel = localModels[agent.id]
    const agentBinding = bindings.find((b: any) => b.agentId === agent.id)
    let boundChannel = null
    if (agentBinding) {
      boundChannel = `${agentBinding.match.channel}:${agentBinding.match.accountId}`
    }
    
    // Try to read AGENTS.md, SOUL.md, USER.md from workspace
    let agentsContent = null
    let soul = null
    let user = null
    if (agent.workspace) {
      agentsContent = parseAgentsFile(agent.workspace)
      soul = parseSoulFile(agent.workspace)
      user = parseUserFile(agent.workspace)
    }
    
    // Model priority: openclaw.json > LOCAL_CONFIG > unknown
    // This ensures manual edits to openclaw.json take effect
    const model = agent.model || localModel || 'unknown'
    
    return {
      id: agent.id,
      name: agent.name,
      identityName: getAgentIdentityName(agent.id, agent.name),
      identityEmoji: getAgentIdentityEmoji(agent.id, agent.workspace),
      model,
      workspace: agent.workspace,
      isDefault: agent.id === 'main',
      boundChannel,
      agents: agentsContent,
      soul,
      user,
    }
  })

  const skills = [
    { name: '文档解析 (PaddleOCR)', status: 'ready', description: 'OCR 文档和图片识别' },
    { name: '飞书集成', status: 'ready', description: '飞书文档，云空间、Wiki 管理' },
    { name: '钉钉集成', status: 'ready', description: '钉钉消息收发' },
    { name: '天气查询', status: 'ready', description: '实时天气预报' },
    { name: 'TTS语音合成', status: 'ready', description: '文字转语音' },
    { name: 'ECS磁盘管理', status: 'ready', description: '联通云服务器管理' },
    { name: '云智眼设备管理', status: 'ready', description: '设备监控和录像查询' },
    { name: '网页搜索', status: 'ready', description: '百度/网络搜索' },
    { name: '代码编写', status: 'ready', description: '多语言代码生成' },
    { name: '代码审查', status: 'ready', description: 'PR 代码审查' },
    { name: '数据分析', status: 'ready', description: '数据处理和分析' },
    { name: '技术文档生成', status: 'ready', description: 'API 文档编写' },
    { name: 'Debug辅助', status: 'ready', description: '问题诊断和修复' },
  ]

  return NextResponse.json({ agents, skills })
}

export async function POST(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { id, name, model, boundChannel } = await request.json()
    
    if (!id || !name) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }
    
    const workspacePath = getAgentWorkspace(id)
    try {
      mkdirSync(workspacePath, { recursive: true })
      // Create empty memory directory for new agent (memory is agent-specific, not copied)
      mkdirSync(join(workspacePath, 'memory'), { recursive: true })
      const basicFiles = ['AGENTS.md', 'IDENTITY.md', 'SOUL.md', 'TOOLS.md', 'HEARTBEAT.md']
      for (const file of basicFiles) {
        const srcFile = join(TEMPLATE_WORKSPACE, file)
        if (existsSync(srcFile)) {
          cpSync(srcFile, join(workspacePath, file))
        }
      }
      
      // Customize copied files for the new agent
      const displayName = name || id
      
      // Update IDENTITY.md
      const identityPath = join(workspacePath, 'IDENTITY.md')
      if (existsSync(identityPath)) {
        const identityContent = `# IDENTITY.md - Who Am I?

- **Name:** ${displayName}
- **Creature:** AI 助手
- **Vibe:** 实用、简洁、不废话
- **Emoji:** 🤖
- **Avatar:** (待定)

---

This isn't just metadata. It's the start of figuring out who you are.
`
        writeFileSync(identityPath, identityContent)
      }
      
      // Update USER.md with default template
      const userPath = join(workspacePath, 'USER.md')
      const userContent = `# USER.md - About Your Human

- **Name:** 用户
- **What to call them:** 用户
- **Pronouns:** 他/她
- **Timezone:** Asia/Shanghai
- **Notes:**
  - 请根据实际情况修改用户信息
  - 例如：职位、爱好、常用工具等

## Context

- 请补充此员工的实际工作场景和用途

---

The more you know, the better you can help. But remember — you're learning about a person, not building a dossier. Respect the difference.
`
      writeFileSync(userPath, userContent)
      
    } catch (e) {
      console.log('Error creating workspace:', e)
    }
    
    try {
      if (existsSync(OPENCLAW_CONFIG)) {
        const openclawConfig = JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'))
        
        if (!openclawConfig.agents?.list) {
          openclawConfig.agents = { list: [] }
        }
        if (!openclawConfig.bindings) {
          openclawConfig.bindings = []
        }
        
        if (boundChannel) {
          const [channelType, accountId] = boundChannel.split(':')
          openclawConfig.bindings = openclawConfig.bindings.filter((b: any) => 
            !(b.match.channel === channelType && b.match.accountId === accountId)
          )
          openclawConfig.bindings.push({
            agentId: id,
            match: { channel: channelType, accountId }
          })
        }
        
        const newAgent = {
          id: id,
          name: name,
          workspace: workspacePath,
          agentDir: getAgentDir(id) + '/agent',
          model: model || 'minimax/MiniMax-M2.7',
        }
        
        openclawConfig.agents.list.push(newAgent)
        writeFileSync(OPENCLAW_CONFIG, JSON.stringify(openclawConfig, null, 2))
      }
    } catch (e) {
      console.log('Could not update OpenClaw config:', e)
    }
    
    // Restart gateway to reload config
    restartGateway()
    
    return NextResponse.json({ success: true, id, name, model, boundChannel, workspace: workspacePath })
  } catch (error) {
    console.error('Failed to create agent:', error)
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { id, model, boundChannel, name, emoji } = await request.json()
    
    if (!id) {
      return NextResponse.json({ error: 'Missing agent ID' }, { status: 400 })
    }
    
    if (model) {
      let localModels: Record<string, string> = {}
      try {
        if (existsSync(MC_AGENT_CONFIGS)) {
          localModels = JSON.parse(readFileSync(MC_AGENT_CONFIGS, 'utf-8'))
        }
      } catch (e) {}
      localModels[id] = model
      
      const dir = MC_DATA_DIR
      if (!existsSync(dir)) {
        require('fs').mkdirSync(dir, { recursive: true })
      }
      writeFileSync(MC_AGENT_CONFIGS, JSON.stringify(localModels, null, 2))
    }
    
    // Find agent workspace path first
    let agentWorkspace = ''
    try {
      if (existsSync(OPENCLAW_CONFIG)) {
        const openclawConfig = JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'))
        const agent = openclawConfig.agents?.list?.find((a: any) => a.id === id)
        if (agent?.workspace) {
          agentWorkspace = agent.workspace
        }
      }
    } catch (e) {}
    
    try {
      if (existsSync(OPENCLAW_CONFIG)) {
        const openclawConfig = JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'))
        
        if (!openclawConfig.bindings) {
          openclawConfig.bindings = []
        }
        
        if (boundChannel !== undefined) {
          openclawConfig.bindings = openclawConfig.bindings.filter((b: any) => b.agentId !== id)
          
          if (boundChannel) {
            const [channelType, accountId] = boundChannel.split(':')
            openclawConfig.bindings = openclawConfig.bindings.filter((b: any) => 
              !(b.match.channel === channelType && b.match.accountId === accountId)
            )
            openclawConfig.bindings.push({
              agentId: id,
              match: { channel: channelType, accountId }
            })
          }
        }
        
        if (openclawConfig.agents?.list) {
          const agentIndex = openclawConfig.agents.list.findIndex((a: any) => a.id === id)
          if (agentIndex !== -1) {
            if (model) {
              openclawConfig.agents.list[agentIndex].model = model
            }
            if (name !== undefined) {
              openclawConfig.agents.list[agentIndex].name = name
            }
            // Note: emoji is NOT saved to openclaw.json - OpenClaw schema doesn't support it
            // Emoji is saved to IDENTITY.md instead
          }
        }
        
        writeFileSync(OPENCLAW_CONFIG, JSON.stringify(openclawConfig, null, 2))
      }
    } catch (e) {
      console.log('Could not update OpenClaw config:', e)
    }
    
    // Save emoji to IDENTITY.md if provided
    if (emoji !== undefined && agentWorkspace) {
      try {
        const identityPath = join(agentWorkspace, 'IDENTITY.md')
        if (existsSync(identityPath)) {
          let content = readFileSync(identityPath, 'utf-8')
          // Replace or add emoji line
          if (content.includes('- **Emoji:**')) {
            content = content.replace(/- \*\*Emoji:\*\* .*/, `- **Emoji:** ${emoji}`)
          } else {
            // Add after IDENTITY.md header
            content = content.replace(/(# IDENTITY.*?\n)/, `$1- **Emoji:** ${emoji}\n`)
          }
          writeFileSync(identityPath, content)
        }
      } catch (e) {
        console.error('Failed to update IDENTITY.md emoji:', e)
      }
    }
    
    // Restart gateway to reload config
    restartGateway()
    
    return NextResponse.json({ success: true, model, boundChannel, name, emoji })
  } catch (error) {
    console.error('Failed to update agent:', error)
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 })
  }
}

// PATCH: Update AGENTS.md, SOUL.md, USER.md
export async function PATCH(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { id, agents, soul, user } = await request.json()
    
    if (!id) {
      return NextResponse.json({ error: 'Missing agent ID' }, { status: 400 })
    }
    
    // Find agent workspace
    let workspacePath = ''
    try {
      if (existsSync(OPENCLAW_CONFIG)) {
        const openclawConfig = JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'))
        const agent = openclawConfig.agents?.list?.find((a: any) => a.id === id)
        if (agent?.workspace) {
          workspacePath = agent.workspace
        }
      }
    } catch (e) {
      workspacePath = getAgentWorkspace(id)
    }
    
    if (!workspacePath) {
      workspacePath = getAgentWorkspace(id)
    }
    
    // Update AGENTS.md
    if (agents !== undefined) {
      const agentsPath = join(workspacePath, 'AGENTS.md')
      writeFileSync(agentsPath, agents)
    }
    
    // Update SOUL.md
    if (soul !== undefined) {
      const soulPath = join(workspacePath, 'SOUL.md')
      const content = `# SOUL.md - Who You Are

${soul.coreTruths ? `## Core Truths

${soul.coreTruths}

` : ''}${soul.boundaries ? `## Boundaries

${soul.boundaries}

` : ''}${soul.vibe ? `## Vibe

${soul.vibe}

` : ''}${soul.continuity ? `## Continuity

${soul.continuity}

` : ''}
---

_This file is yours to evolve. As you learn who you are, update it._
`
      writeFileSync(soulPath, content)
    }
    
    // Update USER.md
    if (user !== undefined) {
      const userPath = join(workspacePath, 'USER.md')
      const content = `# USER.md - About Your Human

- **Name:** ${user.name || '用户'}
- **What to call them:** ${user.callName || '用户'}
- **Pronouns:** ${user.pronouns || '他/她'}
- **Timezone:** ${user.timezone || 'Asia/Shanghai'}
- **Notes:**
${user.notes ? user.notes.split('\n').map((line: string) => `  - ${line}`).join('\n') : '  - 默认用户'}

## Context

${user.context || '用户信息待补充'}
---

The more you know, the better you can help. But remember — you're learning about a person, not building a dossier. Respect the difference.
`
      writeFileSync(userPath, content)
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update agent files:', error)
    return NextResponse.json({ error: 'Failed to update agent files' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { id } = await request.json()
    
    if (id === 'main') {
      return NextResponse.json({ error: 'Cannot delete default agent' }, { status: 400 })
    }
    
    let workspacePath = ''
    
    try {
      if (existsSync(OPENCLAW_CONFIG)) {
        const openclawConfig = JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'))
        
        if (openclawConfig.bindings) {
          openclawConfig.bindings = openclawConfig.bindings.filter((b: any) => b.agentId !== id)
        }
        
        if (openclawConfig.agents?.list) {
          const agent = openclawConfig.agents.list.find((a: any) => a.id === id)
          if (agent?.workspace) {
            workspacePath = agent.workspace
          }
          openclawConfig.agents.list = openclawConfig.agents.list.filter((a: any) => a.id !== id)
        }
        
        writeFileSync(OPENCLAW_CONFIG, JSON.stringify(openclawConfig, null, 2))
      }
    } catch (e) {}
    
    // Fallback path if not found in config
    if (!workspacePath) {
      workspacePath = getAgentWorkspace(id)
    }
    
    // Also try common workspace naming patterns
    const possiblePaths = [
      workspacePath,
      getAgentWorkspace(id),
      path.join(WORKSPACE, id),
    ]
    
    for (const p of possiblePaths) {
      try {
        if (existsSync(p)) {
          rmSync(p, { recursive: true, force: true })
        }
      } catch (e) {}
    }
    
    // Delete agent folder in agents directory
    const agentDir = getAgentDir(id)
    try {
      if (existsSync(agentDir)) {
        rmSync(agentDir, { recursive: true, force: true })
      }
    } catch (e) {}
    
    // Restart gateway to reload config
    restartGateway()
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete agent:', error)
    return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 })
  }
}
