import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const [rows] = await pool.query('SELECT * FROM projects ORDER BY updated_at DESC')
    return NextResponse.json(rows)
  } catch (error) {
    console.error('Failed to fetch projects:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { name, description, emoji, agent_id, agent_name } = await request.json()
    
    const [result] = await pool.query(
      'INSERT INTO projects (name, description, emoji, agent_id, agent_name) VALUES (?, ?, ?, ?, ?)',
      [name, description, emoji || '📁', agent_id, agent_name]
    )
    
    return NextResponse.json({ success: true, id: (result as any).insertId ?? 0 })
  } catch (error) {
    console.error('Failed to create project:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
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
    
    if (fields.name !== undefined) { updates.push('name = ?'); values.push(fields.name) }
    if (fields.description !== undefined) { updates.push('description = ?'); values.push(fields.description) }
    if (fields.emoji !== undefined) { updates.push('emoji = ?'); values.push(fields.emoji) }
    if (fields.progress !== undefined) { updates.push('progress = ?'); values.push(fields.progress) }
    if (fields.status !== undefined) { updates.push('status = ?'); values.push(fields.status) }
    if (fields.agent_id !== undefined) { updates.push('agent_id = ?'); values.push(fields.agent_id) }
    if (fields.agent_name !== undefined) { updates.push('agent_name = ?'); values.push(fields.agent_name) }
    
    values.push(id)
    
    await pool.query(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, values)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update project:', error)
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { id } = await request.json()
    await pool.query('DELETE FROM projects WHERE id = ?', [id])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete project:', error)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}
