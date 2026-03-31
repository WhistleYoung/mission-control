import { NextResponse } from 'next/server'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import type { NextRequest } from 'next/server'

const OPENCLAW_LOG_DIR = '/tmp/openclaw'

interface LogEntry {
  time: string
  level: string
  name: string
  message: string
  subsystem?: string
  parentNames?: string[]
  hostname?: string
  pid?: number
}

function parseLogLine(line: string): LogEntry | null {
  try {
    const data = JSON.parse(line)
    if (!data._meta) return null
    
    // Extract message from various formats
    let message = ''
    if (typeof data['0'] === 'string') {
      // Try to parse JSON in the message
      if (data['0'].startsWith('{')) {
        try {
          const parsed = JSON.parse(data['0'])
          message = parsed.message || parsed.msg || data['0']
        } catch {
          message = data['0']
        }
      } else {
        message = data['0']
      }
    }
    if (data['1']) {
      if (typeof data['1'] === 'string') {
        message += ' ' + data['1']
      } else if (typeof data['1'] === 'object') {
        // Object like {intervalMs: xxx}
        message += ' ' + JSON.stringify(data['1'])
      }
    }
    
    // Extract subsystem from name if it's JSON
    let subsystem = data._meta.name
    try {
      if (data._meta.name.startsWith('{')) {
        const parsed = JSON.parse(data._meta.name)
        subsystem = parsed.subsystem || parsed.module || data._meta.name
      }
    } catch {}
    
    return {
      time: data.time || data._meta?.date || '',
      level: data._meta?.logLevelName || 'INFO',
      name: subsystem || 'unknown',
      message: message.trim(),
      subsystem: subsystem,
      parentNames: data._meta?.parentNames,
      hostname: data._meta?.hostname,
      pid: data._meta?.pid,
    }
  } catch {
    return null
  }
}

function getLogFiles(): string[] {
  if (!existsSync(OPENCLAW_LOG_DIR)) {
    return []
  }
  const files = readdirSync(OPENCLAW_LOG_DIR)
    .filter(f => f.startsWith('openclaw-') && f.endsWith('.log'))
    .sort()
    .reverse() // Most recent first
  return files.map(f => join(OPENCLAW_LOG_DIR, f))
}

export async function GET(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const searchParams = request.nextUrl.searchParams
    const level = searchParams.get('level') // DEBUG, INFO, WARN, ERROR
    const subsystem = searchParams.get('subsystem') // Filter by subsystem
    const search = searchParams.get('search') // Search in message
    const limit = parseInt(searchParams.get('limit') || '500')
    const date = searchParams.get('date') // Specific date YYYY-MM-DD

    // Determine which log file to read
    let logFile: string
    if (date) {
      logFile = join(OPENCLAW_LOG_DIR, `openclaw-${date}.log`)
    } else {
      const files = getLogFiles()
      if (files.length === 0) {
        return NextResponse.json({ logs: [], total: 0, subsystems: [] })
      }
      logFile = files[0] // Most recent
    }

    if (!existsSync(logFile)) {
      return NextResponse.json({ error: 'Log file not found' }, { status: 404 })
    }

    // Read log file
    const content = readFileSync(logFile, 'utf-8')
    const lines = content.split('\n').filter(l => l.trim())
    
    // Parse and filter logs
    const logs: LogEntry[] = []
    const subsystems = new Set<string>()
    
    for (const line of lines) {
      const entry = parseLogLine(line)
      if (!entry) continue
      
      subsystems.add(entry.name)
      
      // Apply filters
      if (level && entry.level !== level) continue
      if (subsystem && !entry.name.includes(subsystem)) continue
      if (search && !entry.message.toLowerCase().includes(search.toLowerCase())) continue
      
      logs.push(entry)
    }
    
    // Limit results
    const limitedLogs = logs.slice(-limit)
    
    return NextResponse.json({
      logs: limitedLogs,
      total: logs.length,
      subsystems: Array.from(subsystems).sort(),
      logFile: logFile,
    })
  } catch (error) {
    console.error('Failed to read logs:', error)
    return NextResponse.json({ error: 'Failed to read logs' }, { status: 500 })
  }
}
