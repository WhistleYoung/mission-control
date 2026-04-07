
/**
 * Gateway RPC client via WebSocket - much faster than CLI
 * Direct WebSocket connection to Gateway avoids CLI startup overhead (~4s → ~100ms)
 */
import { readFileSync, existsSync } from 'fs'
import * as crypto from 'crypto' // Import crypto module

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
  // For 'agents.list' method, always use CLI for now to ensure functionality
  if (method === 'agents.list') {
    return gatewayCallCLI<T>(method, params)
  }

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
    let pendingMethod: string | null = null

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
      // Initiate connect request
      pendingMethod = 'connect'
      ws.send(JSON.stringify({
        type: 'req',
        id: `rpc-${++requestId}`,
        method: 'connect',
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: 'openclaw-control-ui', // Mission Control client.id
            version: '1.0.0', // Mission Control version
            platform: process.platform,
            mode: 'ui' // Control UI mode
          },
          role: 'operator',
          scopes: ['operator.read', 'operator.write', 'operator.admin'],
          auth: { token: config.token } // Sending token directly initially
        }
      }))
    })

    ws.on('message', (data: any) => {
      try {
        const msg = JSON.parse(data.toString())

        // Handle connect response
        if (pendingMethod === 'connect' && msg.type === 'res' && msg.id?.startsWith('rpc-')) {
          if (msg.ok) {
            // Successfully connected, now send the actual RPC call
            pendingMethod = method
            ws.send(JSON.stringify({
              type: 'req',
              id: `call-${++requestId}`,
              method,
              params
            }))
          } else if (msg.method === 'challenge' && msg.params?.nonce) {
            // Received a challenge, respond with signature
            const hmac = crypto.createHmac('sha256', config.token)
            hmac.update(msg.params.nonce)
            const signature = hmac.digest('hex')

            pendingMethod = 'signature'
            ws.send(JSON.stringify({
              type: 'req',
              id: `sig-${++requestId}`,
              method: 'signature',
              params: {
                signature: signature
              }
            }))
          } else {
            // Failed connect or unexpected response during connect
            cleanup()
            reject(new Error(msg.error || 'Gateway connect failed'))
          }
          return
        }

        // Handle signature response
        if (pendingMethod === 'signature' && msg.type === 'res' && msg.id?.startsWith('sig-')) {
          if (msg.ok) {
            // Signature accepted, now send the actual RPC call
            pendingMethod = method
            ws.send(JSON.stringify({
              type: 'req',
              id: `call-${++requestId}`,
              method,
              params
            }))
          } else {
            // Signature failed
            cleanup()
            reject(new Error(msg.error || 'Gateway signature failed'))
          }
          return
        }

        // Handle actual RPC call response
        if (pendingMethod === method && msg.type === 'res' && msg.id?.startsWith('call-')) {
          cleanup()
          if (msg.ok) {
            resolve(msg.result)
          } else {
            reject(new Error(msg.error || `RPC call failed: ${method}`))
          }
        }
      } catch (err) {
        console.error('Error parsing message or during WebSocket handler:', err)
        // Ignore parse errors, but reject if it's a critical handler error
        // For now, let's assume non-critical parse errors
      }
    })

    ws.on('error', (err: any) => {
      cleanup()
      reject(err)
    })

    ws.on('close', () => {
      if (!connected) {
        cleanup()
        reject(new Error('Gateway connection closed unexpectedly'))
      }
    })
  })
}

function gatewayCallCLI<T>(method: string, params: Record<string, any> = {}): Promise<T> {
  const { execSync } = require('child_process')
  const paramsStr = JSON.stringify(params)
  const cmd = `openclaw gateway call ${method} --json --params '${paramsStr}' 2>/dev/null`
  try {
    const output = execSync(cmd, { timeout: 10000 }) // 10 second timeout
    return JSON.parse(output.toString())
  } catch (error: any) {
    // If CLI call times out or fails, throw a more informative error
    const errorMessage = error.message.includes('ETIMEDOUT')
      ? `CLI call timed out for ${method}`
      : `CLI call failed for ${method}: ${error.message}`
    throw new Error(errorMessage)
  }
}
