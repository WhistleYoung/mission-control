/**
 * Gateway RPC client - Simple CLI based implementation
 * Uses direct node call to openclaw.mjs for reliability
 */
import { readFileSync, existsSync } from 'fs'

const OPENCLAW_MJS = '/home/bullrom/.npm-global/lib/node_modules/openclaw/openclaw.mjs'
const OPENCLAW_CONFIG = '/home/bullrom/.openclaw/openclaw.json'

interface GatewayConfig {
  host: string
  port: number
  token: string
}

function getGatewayConfig(): GatewayConfig | null {
  try {
    if (!existsSync(OPENCLAW_CONFIG)) return null
    const config = JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'))
    return {
      host: config.gateway?.host || 'localhost',
      port: config.gateway?.port || 18789,
      token: config.gateway?.auth?.token || '',
    }
  } catch {
    return null
  }
}

/**
 * Call Gateway RPC method via CLI
 * This is more reliable than WebSocket in some environments
 */
export async function gatewayCall<T = any>(method: string, params: Record<string, any> = {}): Promise<T> {
  const { execSync } = require('child_process')
  const paramsStr = JSON.stringify(params)
  
  // Use node to run openclaw.mjs directly with full path
  const cmd = `node "${OPENCLAW_MJS}" gateway call ${method} --json --params '${paramsStr}' 2>/dev/null`
  
  try {
    const output = execSync(cmd, { timeout: 30000 })
    return JSON.parse(output.toString())
  } catch (error: any) {
    console.error(`gatewayCall ${method} failed:`, error.message)
    throw error
  }
}
