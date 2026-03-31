import { NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { exec } from 'child_process'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import type { NextRequest } from 'next/server'

const OPENCLAW_CONFIG = '/home/bullrom/.openclaw/openclaw.json'

// Restart OpenClaw Gateway to reload config (delayed, non-blocking)
function restartGateway() {
  // Delay restart by 2 seconds to ensure API response is sent first
  setTimeout(() => {
    const openclawCmd = process.env.OPENCLAW_PATH || '/home/bullrom/.npm-global/bin/openclaw'
    exec(`${openclawCmd} gateway restart`, (error) => {
      if (error) {
        console.error('Failed to restart OpenClaw Gateway:', error)
        return
      }
      console.log('OpenClaw Gateway restart completed')
    })
  }, 2000)
}

export async function GET(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    let channels: any[] = []
    
    if (existsSync(OPENCLAW_CONFIG)) {
      const config = JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'))
      const bindings = config.bindings || []
      
      if (config.channels) {
        for (const [channelType, channelData] of Object.entries(config.channels)) {
          const accounts = (channelData as any).accounts || {}
          for (const [accountId, accountData] of Object.entries(accounts)) {
            const binding = bindings.find((b: any) => 
              b.match.channel === channelType && b.match.accountId === accountId
            )
            
            channels.push({
              id: `${channelType}:${accountId}`,
              displayName: `${getChannelDisplayName(channelType)}-${accountId}`,
              channelType,
              accountId,
              agentId: binding?.agentId || null,
              agentName: binding?.agentId ? getAgentName(binding.agentId) : '未绑定',
              status: 'active',
              enabled: (accountData as any).enabled !== false,
            })
          }
        }
      }
    }
    
    return NextResponse.json(channels)
  } catch (error) {
    console.error('Failed to fetch channels:', error)
    return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { channelType, accountId, accountData } = await request.json()
    
    if (!channelType || !accountId || !accountData) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }
    
    if (existsSync(OPENCLAW_CONFIG)) {
      const config = JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'))
      
      if (!config.channels) {
        config.channels = {}
      }
      if (!config.channels[channelType]) {
        return NextResponse.json({ error: 'Channel type does not exist' }, { status: 400 })
      }
      
      if (config.channels[channelType].accounts?.[accountId]) {
        return NextResponse.json({ error: 'Account already exists' }, { status: 400 })
      }
      
      if (!config.channels[channelType].accounts) {
        config.channels[channelType].accounts = {}
      }
      
      config.channels[channelType].accounts[accountId] = {
        enabled: true,
        ...accountData,
      }
      
      writeFileSync(OPENCLAW_CONFIG, JSON.stringify(config, null, 2))
      
      // Restart gateway to reload config
      restartGateway()
      
      return NextResponse.json({ 
        success: true, 
        channel: {
          id: `${channelType}:${accountId}`,
          displayName: `${getChannelDisplayName(channelType)}-${accountId}`,
          channelType,
          accountId,
          agentId: null,
          agentName: '未绑定',
          status: 'active',
          enabled: true,
        }
      })
    }
    
    return NextResponse.json({ error: 'Config file not found' }, { status: 500 })
  } catch (error) {
    console.error('Failed to create channel account:', error)
    return NextResponse.json({ error: 'Failed to create channel account' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { channelType, accountId } = await request.json()
    
    if (!channelType || !accountId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }
    
    if (existsSync(OPENCLAW_CONFIG)) {
      const config = JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'))
      const bindings = config.bindings || []
      
      const binding = bindings.find((b: any) => 
        b.match.channel === channelType && b.match.accountId === accountId
      )
      
      if (binding) {
        return NextResponse.json({ error: 'Cannot delete bound channel. Please unbind first.' }, { status: 400 })
      }
      
      if (!config.channels?.[channelType]?.accounts?.[accountId]) {
        return NextResponse.json({ error: 'Channel account not found' }, { status: 404 })
      }
      
      delete config.channels[channelType].accounts[accountId]
      
      if (Object.keys(config.channels[channelType].accounts || {}).length === 0) {
        delete config.channels[channelType]
      }
      
      writeFileSync(OPENCLAW_CONFIG, JSON.stringify(config, null, 2))
      
      // Restart gateway to reload config
      restartGateway()
      
      return NextResponse.json({ success: true })
    }
    
    return NextResponse.json({ error: 'Config file not found' }, { status: 500 })
  } catch (error) {
    console.error('Failed to delete channel account:', error)
    return NextResponse.json({ error: 'Failed to delete channel account' }, { status: 500 })
  }
}

function getChannelDisplayName(channelType: string): string {
  const names: Record<string, string> = {
    feishu: '飞书',
    'feishu-connector': '飞书',
    'dingtalk-connector': '钉钉',
    dingtalk: '钉钉',
    telegram: 'Telegram',
    discord: 'Discord',
    whatsapp: 'WhatsApp',
    slack: 'Slack',
    wechat: '微信',
  }
  return names[channelType] || channelType
}

function getAgentName(agentId: string): string {
  const names: Record<string, string> = {
    main: '小七',
    worker: '壹号牛马',
  }
  return names[agentId] || agentId
}
