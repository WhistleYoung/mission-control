import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const [rows] = await pool.query('SELECT * FROM tasks ORDER BY updated_at DESC')
    return NextResponse.json(rows)
  } catch (error) {
    console.error('Failed to fetch tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { title, description, status, priority, assignee_type, assignee_id, assignee_name, due_date } = await request.json()
    
    const [result] = await pool.query(
      'INSERT INTO tasks (title, description, status, priority, assignee_type, assignee_id, assignee_name, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [title, description, status || 'backlog', priority || 'medium', assignee_type || 'ai', assignee_id, assignee_name, due_date]
    )
    
    return NextResponse.json({ success: true, id: (result as any).insertId ?? 0 })
  } catch (error) {
    console.error('Failed to create task:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { id, ...fields } = await request.json()
    
    const updates: string[] = []
    const values: any[] = []
    
    if (fields.title !== undefined) { updates.push('title = ?'); values.push(fields.title) }
    if (fields.description !== undefined) { updates.push('description = ?'); values.push(fields.description) }
    if (fields.status !== undefined) { updates.push('status = ?'); values.push(fields.status) }
    if (fields.priority !== undefined) { updates.push('priority = ?'); values.push(fields.priority) }
    if (fields.assignee_type !== undefined) { updates.push('assignee_type = ?'); values.push(fields.assignee_type) }
    if (fields.assignee_id !== undefined) { updates.push('assignee_id = ?'); values.push(fields.assignee_id) }
    if (fields.assignee_name !== undefined) { updates.push('assignee_name = ?'); values.push(fields.assignee_name) }
    if (fields.due_date !== undefined) { updates.push('due_date = ?'); values.push(fields.due_date) }
    
    values.push(id)
    
    await pool.query(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, values)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update task:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { id } = await request.json()
    await pool.query('DELETE FROM tasks WHERE id = ?', [id])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete task:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
