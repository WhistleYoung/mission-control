import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const agentId = searchParams.get('agentId')

    let sql = 'SELECT c.*, p.name as project_name, p.emoji as project_emoji FROM conversations c LEFT JOIN projects p ON c.project_id = p.id WHERE 1=1'
    const params: any[] = []

    if (projectId) {
      sql += ' AND c.project_id = ?'
      params.push(projectId)
    }
    if (agentId) {
      sql += ' AND c.agent_id = ?'
      params.push(agentId)
    }

    sql += ' ORDER BY c.created_at DESC LIMIT 100'

    const [rows] = await pool.query(sql, params)
    return NextResponse.json(rows)
  } catch (error) {
    console.error('Failed to fetch conversations:', error)
    return NextResponse.json({ error: '获取对话记录失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { projectId, agentId, title, summary, messageCount } = await request.json()

    const [result] = await pool.query(
      'INSERT INTO conversations (project_id, agent_id, title, summary, message_count) VALUES (?, ?, ?, ?, ?)',
      [projectId || null, agentId, title || '新对话', summary || '', messageCount || 0]
    )

    return NextResponse.json({ success: true, id: (result as any).insertId })
  } catch (error) {
    console.error('Failed to create conversation:', error)
    return NextResponse.json({ error: '创建对话记录失败' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { id, projectId, title, summary } = await request.json()

    const updates: string[] = []
    const values: any[] = []

    if (projectId !== undefined) { updates.push('project_id = ?'); values.push(projectId || null) }
    if (title !== undefined) { updates.push('title = ?'); values.push(title) }
    if (summary !== undefined) { updates.push('summary = ?'); values.push(summary) }

    if (updates.length === 0) {
      return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 })
    }

    values.push(id)
    await pool.query(`UPDATE conversations SET ${updates.join(', ')} WHERE id = ?`, values)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update conversation:', error)
    return NextResponse.json({ error: '更新对话记录失败' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: '缺少ID' }, { status: 400 })
    }

    await pool.query('DELETE FROM conversations WHERE id = ?', [id])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete conversation:', error)
    return NextResponse.json({ error: '删除对话记录失败' }, { status: 500 })
  }
}
