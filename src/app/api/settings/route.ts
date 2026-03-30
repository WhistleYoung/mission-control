import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import type { NextRequest } from 'next/server'
import { execSync } from 'child_process'

// Ensure settings table exists and has required columns
async function ensureSettingsTable() {
  try {
    // Check if table exists
    const [tables] = await pool.query("SHOW TABLES LIKE 'settings'")
    if ((tables as any[]).length === 0) {
      // Create table if not exists
      await pool.query(`
        CREATE TABLE settings (
          id INT PRIMARY KEY DEFAULT 1,
          project_name VARCHAR(255) DEFAULT 'Mission Control',
          show_lobster_module TINYINT(1) DEFAULT 1,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `)
      await pool.query(`INSERT IGNORE INTO settings (id, project_name, show_lobster_module) VALUES (1, 'Mission Control', 1)`)
    } else {
      // Table exists, check if column exists and add if not
      try {
        await pool.query(`ALTER TABLE settings ADD COLUMN show_lobster_module TINYINT(1) DEFAULT 1 AFTER project_name`)
      } catch (e: any) {
        // Column might already exist, ignore error
        if (!e.message.includes('Duplicate column name')) {
          console.log('Column check:', e.message)
        }
      }
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
    await ensureSettingsTable()
    const [rows] = await pool.query('SELECT * FROM settings WHERE id = 1')
    const settings = (rows as any[])[0] || {}
    
    return NextResponse.json({
      projectName: settings.project_name || 'Mission Control',
      showLobsterModule: settings.show_lobster_module !== 0,
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

    // Update project name
    if (projectName !== undefined) {
      await ensureSettingsTable()
      await pool.query('UPDATE settings SET project_name = ? WHERE id = 1', [projectName])
    }

    // Update show lobster module setting
    if (showLobsterModule !== undefined) {
      await ensureSettingsTable()
      await pool.query('UPDATE settings SET show_lobster_module = ? WHERE id = 1', [showLobsterModule ? 1 : 0])
    }

    // Update username
    if (newUsername) {
      const [users] = await pool.query('SELECT * FROM users WHERE id = 1')
      if ((users as any[]).length > 0) {
        await pool.query('UPDATE users SET username = ?, display_name = ? WHERE id = 1', [newUsername, newUsername])
      }
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
      // Restart OpenClaw Gateway - use nohup to prevent SIGTERM from killing the API process
      try {
        // Use setsid to run in new session, preventing signal propagation
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
