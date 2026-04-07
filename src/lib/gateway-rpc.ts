/**
 * Gateway RPC client via WebSocket - much faster than CLI
 * Direct WebSocket connection to Gateway avoids CLI startup overhead (~4s → ~100ms)
 */
import { readFileSync, existsSync } from 'fs'

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
      token: config.gatewayToken || config.gateway?.token || '',
    }
  } catch {
    return null
  }
}

/**
 * Call Gateway RPC method via WebSocket
 * Returns parsed JSON response
 * Falls back to CLI if WebSocket fails
 */
export async function gatewayCall<T = any>(method: string, params: Record<string, any> = {}): Promise<T> {
  const config = getGatewayConfig()
  if (!config || !config.token) {
    // Fallback to CLI
    return gatewayCallCLI<T>(method, params)
  }

  try {
    return await gatewayCallWebSocket<T>(config, method, params)
  } catch (error) {
    console.warn(`WebSocket call failed for ${method}, falling back to CLI:`, error)
    return gatewayCallCLI<T>(method, params)
  }
}

async function gatewayCallWebSocket<T>(config: GatewayConfig, method: string, params: Record<string, any>): Promise<T> {
  // Use require for ws to avoid dynamic import issues in Next.js
  const { WebSocket } = require('ws')
  const wsUrl = `ws://${config.host}:${config.port}`
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    let requestId = 0
    let connected = false
    let timer: NodeJS.Timeout

    const cleanup = () => {
      clearTimeout(timer)
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
    }

    timer = setTimeout(() => {
      cleanup()
      reject(new Error(`Gateway call timeout: ${method}`))
    }, 8000)

    ws.on('open', () => {
      connected = true
      // Connect with operator role
      ws.send(JSON.stringify({
        type: 'req',
        id: `rpc-${++requestId}`,
        method: 'connect',
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: 'mission-control-rpc',
            version: '1.0.0',
            platform: process.platform,
            mode: 'operator'
          },
          role: 'operator',
          scopes: ['operator.read', 'operator.write', 'operator.admin'],
          auth: { token: config.token }
        }
      }))
    })

    ws.on('message', (data: any) => {
      try {
        const msg = JSON.parse(data.toString())

        // Connect response
        if (msg.type === 'res' && msg.id?.startsWith('rpc-') && !msg.method) {
          if (!msg.ok) {
            cleanup()
            reject(new Error(msg.error || 'Gateway connect failed'))
            return
          }

          // Send the actual RPC call
          ws.send(JSON.stringify({
            type: 'req',
            id: `call-${++requestId}`,
            method,
            params
          }))
          return
        }

        // RPC response
        if (msg.type === 'res' && msg.id?.startsWith('call-')) {
          cleanup()
          if (msg.ok) {
            resolve(msg.result)
          } else {
            reject(new Error(msg.error || `RPC call failed: ${method}`))
          }
        }
      } catch (err) {
        // Ignore parse errors
      }
    })

    ws.on('error', (err: any) => {
      cleanup()
      reject(err)
    })

    ws.on('close', () => {
      if (!connected) {
        cleanup()
        reject(new Error('Gateway connection closed'))
      }
    })
  })
}

function gatewayCallCLI<T>(method: string, params: Record<string, any> = {}): Promise<T> {
  const { execSync } = require('child_process')
  const paramsStr = JSON.stringify(params)
  const cmd = `openclaw gateway call ${method} --json --params '${paramsStr}' 2>/dev/null`
  const output = execSync(cmd, { timeout: 10000 })
  return JSON.parse(output.toString())
}
