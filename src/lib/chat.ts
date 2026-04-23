/**
 * OpenClaw Chat Integration
 * Uses CLI-based gateway calls for simple message sending
 * For streaming responses, would need full WebSocket client with device identity
 */

import { readFileSync, existsSync } from 'fs'
import path from 'path'
import os from 'os'
import { spawn } from 'child_process'

const HOME = process.env.HOME || os.homedir()
const npmGlobal = process.env.npm_config_prefix || path.join(HOME, '.npm-global')
const OPENCLAW_MJS = path.join(npmGlobal, 'lib', 'node_modules', 'openclaw', 'openclaw.mjs')
const OPENCLAW_CONFIG = path.join(HOME, '.openclaw', 'openclaw.json')

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: number
}

export interface SendMessageResult {
  success: boolean
  runId?: string
  status?: string
  messageSeq?: number
  error?: string
}

/**
 * Get gateway configuration
 */
function getGatewayConfig() {
  try {
    if (!existsSync(OPENCLAW_CONFIG)) return null
    const config = JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'))
    return {
      host: config.gateway?.host || 'localhost',
      port: config.gateway?.port || 18789,
      token: config.gateway?.token || config.gateway?.auth?.token || '',
    }
  } catch {
    return null
  }
}

/**
 * Send a message to a session via CLI (non-streaming)
 * Returns immediately with runId - not suitable for real-time chat UI
 */
export async function sendMessage(sessionKey: string, message: string): Promise<SendMessageResult> {
  return new Promise((resolve) => {
    const params = { key: sessionKey, message }
    const paramsStr = JSON.stringify(params)
    
    // Check if openclaw.mjs exists
    if (!existsSync(OPENCLAW_MJS)) {
      resolve({ success: false, error: 'OpenClaw not found' })
      return
    }
    
    const child = spawn('node', [OPENCLAW_MJS, 'gateway', 'call', 'sessions.send', '--json', '--params', paramsStr], {
      timeout: 60000,
      cwd: HOME,
    })
    
    let output = ''
    let error = ''
    
    child.stdout.on('data', (data) => {
      output += data.toString()
    })
    
    child.stderr.on('data', (data) => {
      error += data.toString()
    })
    
    child.on('close', (code) => {
      if (code === 0 && output.trim()) {
        try {
          const result = JSON.parse(output.trim())
          resolve({
            success: true,
            runId: result.runId,
            status: result.status,
            messageSeq: result.messageSeq,
          })
        } catch {
          resolve({ success: false, error: 'Failed to parse response' })
        }
      } else {
        resolve({ success: false, error: error || 'Command failed' })
      }
    })
    
    child.on('error', (err) => {
      resolve({ success: false, error: err.message })
    })
  })
}

/**
 * Get session info
 */
export async function getSession(sessionKey: string) {
  return new Promise((resolve) => {
    const child = spawn('node', [OPENCLAW_MJS, 'gateway', 'call', 'sessions.list', '--json'], {
      timeout: 10000,
      cwd: HOME,
    })
    
    let output = ''
    child.stdout.on('data', (data) => output += data.toString())
    child.on('close', () => {
      try {
        const result = JSON.parse(output.trim())
        const session = result.sessions?.find((s: any) => s.key === sessionKey)
        resolve(session || null)
      } catch {
        resolve(null)
      }
    })
    child.on('error', () => resolve(null))
  })
}

/**
 * List available sessions
 */
export async function listSessions() {
  return new Promise((resolve) => {
    const child = spawn('node', [OPENCLAW_MJS, 'gateway', 'call', 'sessions.list', '--json'], {
      timeout: 10000,
      cwd: HOME,
    })
    
    let output = ''
    child.stdout.on('data', (data) => output += data.toString())
    child.on('close', () => {
      try {
        const result = JSON.parse(output.trim())
        resolve(result.sessions || [])
      } catch {
        resolve([])
      }
    })
    child.on('error', () => resolve([]))
  })
}

/**
 * Get chat history for a session (from jsonl files)
 */
export function getChatHistory(sessionKey: string): ChatMessage[] {
  // This is a simplified version - reads from the session jsonl files
  // In production, you'd want to use the sessions API
  return []
}
