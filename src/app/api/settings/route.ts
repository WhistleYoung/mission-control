import { NextResponse } from 'next/server'
import { pool, db } from '@/lib/db'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import type { NextRequest } from 'next/server'
import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { mkdirSync } from 'fs'
import { join } from 'path'

// Ensure settings table exists - SQLite compatible version
function ensureSettingsTable() {
  try {
    // Create settings table if not exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        project_name TEXT DEFAULT 'Mission Control',
        show_lobster_module INTEGER DEFAULT 1,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Insert default row if not exists
    const existing = db.prepare('SELECT id FROM settings WHERE id = 1').get()
    if (!existing) {
      db.prepare('INSERT INTO settings (id, project_name, show_lobster_module) VALUES (1, ?, 1)').run('Mission Control')
    }

    // Ensure show_lobster_module column exists (for existing tables)
    try {
      db.exec("ALTER TABLE settings ADD COLUMN show_lobster_module INTEGER DEFAULT 1")
    } catch (e: any) {
      // Column might already exist, ignore
    }
  } catch (e) {
    console.error('ensureSettingsTable error:', e)
  }
}

// Get ClawHub config directory
function getClawhubConfigDir(): string {
  return join(process.env.HOME || '/home/bullrom', '.config', 'clawhub')
}

// Ensure ClawHub config directory exists
function ensureClawhubConfigDir(): string {
  const dir = getClawhubConfigDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

// Update ClawHub API token using clawhub login command
function updateClawhubToken(token: string): { success: boolean; message: string } {
  try {
    // Use clawhub login with --token --no-browser to store the token
    execSync(`clawhub login --token "${token}" --no-browser`, { timeout: 30000 })
    return { success: true, message: 'Token 配置成功！' }
  } catch (e: any) {
    console.error('Failed to configure clawhub token:', e.message)
    return { success: false, message: 'Token 配置失败: ' + e.message }
  }
}

// Check if ClawHub token is configured
function isClawhubTokenConfigured(): boolean {
  try {
    const output = execSync(`clawhub whoami 2>&1`, { timeout: 10000 })
    const text = output.toString()
    return !text.includes('Not logged in') && !text.includes('Error')
  } catch (e) {
    return false
  }
}

// Get current ClawHub logged in user
function getClawhubUser(): string | null {
  try {
    const output = execSync(`clawhub whoami 2>&1`, { timeout: 10000 })
    const text = output.toString()
    if (text.includes('Not logged in') || text.includes('Error')) return null
    // Extract username from output like "Logged in as: username"
    const match = text.match(/Logged in as:\s*(.+)/)
    return match ? match[1].trim() : null
  } catch (e) {
    return null
  }
}

export async function GET(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    ensureSettingsTable()
    const row = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any
    
    // Check ClawHub login status
    const clawhubLoggedIn = isClawhubTokenConfigured()
    const clawhubUser = getClawhubUser()
    
    return NextResponse.json({
      projectName: row?.project_name || 'Mission Control',
      showLobsterModule: row?.show_lobster_module !== 0,
      clawhubLoggedIn,
      clawhubUser,
    })
  } catch (error) {
    console.error('Failed to fetch settings:', error)
    return NextResponse.json({ projectName: 'Mission Control', showLobsterModule: true })
  }
}

export async function PUT(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const { projectName, newUsername, showLobsterModule, clawhubApiToken } = body

    ensureSettingsTable()

    // Update project name
    if (projectName !== undefined) {
      db.prepare('UPDATE settings SET project_name = ? WHERE id = 1').run(projectName)
    }

    // Update username
    if (newUsername) {
      db.prepare('UPDATE users SET username = ?, display_name = ? WHERE id = 1').run(newUsername, newUsername)
    }

    // Update ClawHub API Token
    if (clawhubApiToken !== undefined) {
      const result = updateClawhubToken(clawhubApiToken)
      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, message: result.message })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update settings:', error)
    return NextResponse.json({ error: '更新失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const { action } = body

    if (action === 'restartGateway') {
      // Restart OpenClaw Gateway
      try {
        execSync('setsid openclaw gateway restart > /dev/null 2>&1 &', { timeout: 5000 })
        return NextResponse.json({ success: true, message: '网关重启命令已发送' })
      } catch (error: any) {
        console.error('Gateway restart failed:', error.stderr || error.message)
        return NextResponse.json({ error: '网关重启失败', details: error.stderr || error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 })
  } catch (error) {
    console.error('Failed to execute action:', error)
    return NextResponse.json({ error: '操作失败' }, { status: 500 })
  }
}
