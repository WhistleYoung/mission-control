import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import type { NextRequest } from 'next/server'
import { getOpenClawConfig, getAgentWorkspace } from '@/lib/paths'
import { db } from '@/lib/db'

// Get dream content by inlinePath (on-demand loading)
export async function GET(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const inlinePath = searchParams.get('path')
    const phase = searchParams.get('phase') || 'light'
    
    if (!inlinePath) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 })
    }

    // Get agents for hit count lookup
    const agents = getAgents()
    
    // Read phase signals for hit counts
    let lightHits = 0
    let remHits = 0
    let lastLightAt = ''
    
    for (const agent of agents) {
      const workspace = getAgentWorkspace(agent.id)
      const phaseSignalsFile = join(workspace, 'memory', '.dreams', 'phase-signals.json')
      
      if (existsSync(phaseSignalsFile)) {
        try {
          const signals = JSON.parse(readFileSync(phaseSignalsFile, 'utf-8'))
          const entries = signals.entries || {}
          
          const dateMatch = inlinePath.match(/(\d{4}-\d{2}-\d{2})\.md$/)
          const date = dateMatch ? dateMatch[1] : ''
          
          for (const [key, value] of Object.entries(entries)) {
            if (key.includes(date + '.txt')) {
              const entry = value as any
              lightHits += entry.lightHits || 0
              remHits += entry.remHits || 0
              if (entry.lastLightAt && (!lastLightAt || entry.lastLightAt > lastLightAt)) {
                lastLightAt = entry.lastLightAt
              }
            }
          }
        } catch (e) {
          // Continue
        }
      }
    }

    // Read dream content
    let content = ''
    if (existsSync(inlinePath)) {
      try {
        const fileContent = readFileSync(inlinePath, 'utf-8')
        const fileLines = fileContent.split('\n')
        
        const phaseMarker = phase === 'rem' ? '## REM Sleep' : '## Light Sleep'
        
        let startIdx = -1
        let endIdx = fileLines.length
        
        for (let i = 0; i < fileLines.length; i++) {
          if (fileLines[i].includes(phaseMarker)) {
            startIdx = i + 1
            for (let j = i + 1; j < fileLines.length; j++) {
              if (fileLines[j].startsWith('## ')) {
                endIdx = j
                break
              }
            }
            break
          }
        }
        
        if (startIdx >= 0) {
          const sectionLines = fileLines.slice(startIdx, endIdx)
          content = sectionLines.join('\n')
        }
      } catch (e) {
        content = 'Failed to read dream content'
      }
    } else {
      content = 'Dream file not found'
    }

    // Update hit counts in database
    try {
      const preview = content.substring(0, 300).replace(/[#*`\-]/g, '').trim()
      db.prepare(`
        UPDATE dreams_cache SET light_hits = ?, rem_hits = ?, last_light_at = ?, preview = ?, content = ?
        WHERE inline_path = ?
      `).run(lightHits, remHits, lastLightAt, preview + (content.length > 300 ? '...' : ''), content, inlinePath)
    } catch (e) {
      console.error('Error updating dream in db:', e)
    }

    return NextResponse.json({
      content,
      lightHits,
      remHits,
      lastLightAt
    })
  } catch (error) {
    console.error('Failed to fetch dream content:', error)
    return NextResponse.json({ error: 'Failed to fetch dream content' }, { status: 500 })
  }
}

function getAgents() {
  try {
    if (!existsSync(getOpenClawConfig())) return []
    const config = JSON.parse(readFileSync(getOpenClawConfig(), 'utf-8'))
    const agents = config.agents?.list || []
    return agents.map((agent: any) => ({
      id: agent.id,
      name: agent.name || agent.id,
      emoji: agent.emoji || '🤖'
    }))
  } catch {
    return []
  }
}
