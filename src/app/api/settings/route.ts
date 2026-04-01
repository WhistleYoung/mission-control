import { NextResponse } from 'next/server'
import { pool, db } from '@/lib/db'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import type { NextRequest } from 'next/server'
import { execSync } from 'child_process'

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

export async function GET(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    ensureSettingsTable()
    const row = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any
    
    return NextResponse.json({
      projectName: row?.project_name || 'Mission Control',
      showLobsterModule: row?.show_lobster_module !== 0,
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
    const { projectName, newUsername, showLobsterModule } = body

    ensureSettingsTable()

    // Update project name
    if (projectName !== undefined) {
      db.prepare('UPDATE settings SET project_name = ? WHERE id = 1').run(projectName)
    }

    // Update show lobster module setting
    if (showLobsterModule !== undefined) {
      db.prepare('UPDATE settings SET show_lobster_module = ? WHERE id = 1').run(showLobsterModule ? 1 : 0)
    }

    // Update username
    if (newUsername) {
      db.prepare('UPDATE users SET username = ?, display_name = ? WHERE id = 1').run(newUsername, newUsername)
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
