import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import type { NextRequest } from 'next/server'

// Table is auto-created in db.ts on startup, no need to ensure here

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { id } = await params
    const projectId = parseInt(id)
    
    if (isNaN(projectId)) {
      return NextResponse.json({ error: '无效的项目ID' }, { status: 400 })
    }

    // Verify project exists
    const [projects] = await pool.query('SELECT id FROM projects WHERE id = ?', [projectId])
    if ((projects as any).length === 0) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    const [rows] = await pool.query(
      'SELECT * FROM project_history WHERE project_id = ? ORDER BY created_at DESC LIMIT 100',
      [projectId]
    )

    return NextResponse.json(rows)
  } catch (error) {
    console.error('Failed to fetch project history:', error)
    return NextResponse.json({ error: '获取项目历史失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { id } = await params
    const projectId = parseInt(id)
    
    if (isNaN(projectId)) {
      return NextResponse.json({ error: '无效的项目ID' }, { status: 400 })
    }

    // Verify project exists
    const [projects] = await pool.query('SELECT id, name FROM projects WHERE id = ?', [projectId])
    const projectList = projects as any[]
    if (projectList.length === 0) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    const body = await request.json()
    const { action, description, actor_type, actor_name } = body

    if (!action) {
      return NextResponse.json({ error: '缺少操作类型' }, { status: 400 })
    }

    const [result] = await pool.query(
      'INSERT INTO project_history (project_id, action, description, actor_type, actor_name) VALUES (?, ?, ?, ?, ?)',
      [projectId, action, description || '', actor_type || 'system', actor_name || '系统']
    )

    return NextResponse.json({ success: true, id: (result as any).insertId })
  } catch (error) {
    console.error('Failed to create project history:', error)
    return NextResponse.json({ error: '创建项目历史失败' }, { status: 500 })
  }
}