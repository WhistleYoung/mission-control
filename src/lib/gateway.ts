// Gateway restart utilities - WebSocket RPC method (no exec needed)
// This is more portable for open source distribution

import { spawn } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { OPENCLAW_CONFIG } from './paths'
import os from 'os'

/**
 * Restart OpenClaw Gateway via WebSocket RPC (no exec, no PATH issues)
 * Falls back to spawn if WebSocket fails
 */
export function restartGateway(): void {
  setTimeout(async () => {
    try {
      // Read gateway token from config
      const config = JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'))
      const token = config.gatewayToken || config.gateway?.token
      const port = config.gateway?.port || 18789
      const host = config.gateway?.host || 'localhost'
      
      if (!token) {
        console.error('No gateway token found in config')
        restartViaSpawn()
        return
      }
      
      const wsUrl = `ws://${host}:${port}`
      
      // Try WebSocket method first
      try {
        const { WebSocket } = await import('ws')
        await restartViaWebSocket(wsUrl, token)
      } catch {
        // Fallback to spawn if ws module not available
        restartViaSpawn()
      }
    } catch (err) {
      console.error('Failed to restart Gateway via WebSocket:', err)
      restartViaSpawn()
    }
  }, 2000)
}

async function restartViaWebSocket(wsUrl: string, token: string): Promise<void> {
  const { WebSocket } = await import('ws')
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    let requestId = 0
    
    ws.on('open', () => {
      // Send connect request with operator role and scopes
      ws.send(JSON.stringify({
        type: 'req',
        id: `connect-${++requestId}`,
        method: 'connect',
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: 'mission-control',
            version: '1.0.0',
            platform: process.platform,
            mode: 'operator'
          },
          role: 'operator',
          scopes: ['operator.read', 'operator.write', 'operator.admin'],
          auth: { token }
        }
      }))
    })
    
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString())
        
        // Handle connect response
        if (msg.type === 'res' && msg.id?.startsWith('connect')) {
          if (!msg.ok) {
            ws.close()
            reject(new Error('Gateway connect failed'))
            return
          }
          
          // Send restart request
          ws.send(JSON.stringify({
            type: 'req',
            id: `restart-${++requestId}`,
            method: 'gateway.restart',
            params: {}
          }))
        }
        
        // Handle restart response
        if (msg.type === 'res' && msg.id?.startsWith('restart')) {
          ws.close()
          if (msg.ok) {
            console.log('OpenClaw Gateway restart completed via WebSocket')
            resolve()
          } else {
            reject(new Error(msg.error || 'Restart failed'))
          }
        }
      } catch (err) {
        // Ignore parse errors
      }
    })
    
    ws.on('error', (err) => {
      reject(err)
    })
    
    ws.on('close', () => {
      // Connection closed before we got a response
    })
    
    // Timeout after 10 seconds
    setTimeout(() => {
      ws.close()
      reject(new Error('Gateway restart timeout'))
    }, 10000)
  })
}

// Fallback: use spawn to call openclaw CLI
function restartViaSpawn(): void {
  const HOME = process.env.HOME || os.homedir()
  const npmGlobal = process.env.npm_config_prefix || path.join(HOME, '.npm-global')
  const cmdPaths = ['openclaw', path.join(npmGlobal, 'bin', 'openclaw'), '/usr/local/bin/openclaw']
  
  for (const cmd of cmdPaths) {
    try {
      const child = spawn(cmd, ['gateway', 'restart'], {
        detached: true,
        stdio: 'ignore'
      })
      
      child.on('error', () => {})
      child.on('exit', (code) => {
        if (code === 0) console.log('OpenClaw Gateway restart completed')
      })
      child.unref()
      return
    } catch {}
  }
  
  console.error('Failed to restart OpenClaw Gateway: openclaw command not found')
}
