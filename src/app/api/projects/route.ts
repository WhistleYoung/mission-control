import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import type { NextRequest } from 'next/server'

// Ensure project_history table exists
async function ensureHistoryTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS project_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      action VARCHAR(50) NOT NULL,
      description TEXT,
      actor_type ENUM('human', 'ai', 'system') DEFAULT 'system',
      actor_name VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_project_id (project_id),
      INDEX idx_created_at (created_at)
    )
  `)
}

// Log project history
async function logProjectHistory(projectId: number, action: string, description: string, actorType: string = 'human', actorName: string = '张扬') {
  try {
    await ensureHistoryTable()
    await pool.query(
      'INSERT INTO project_history (project_id, action, description, actor_type, actor_name) VALUES (?, ?, ?, ?, ?)',
      [projectId, action, description, actorType, actorName]
    )
  } catch (error) {
    console.error('Failed to log project history:', error)
  }
}

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
    
    const [result]: any = await pool.query(
      'INSERT INTO projects (name, description, emoji, agent_id, agent_name) VALUES (?, ?, ?, ?, ?)',
      [name, description, emoji || '📁', agent_id, agent_name]
    )
    
    // Log history
    await logProjectHistory(
      result.insertId,
      'created',
      `创建项目「${name}」${emoji || '📁'}`,
      'human',
      '张扬'
    )
    
    return NextResponse.json({ success: true, id: result.insertId })
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
    
    // Log history
    const changeDesc = Object.keys(fields).map(k => {
      const labels: Record<string, string> = { name: '名称', description: '描述', emoji: '图标', progress: '进度', status: '状态', agent_id: '负责人', agent_name: '负责人' }
      return labels[k] || k
    }).join('、')
    if (changeDesc) {
      await logProjectHistory(id, 'updated', `更新项目：${changeDesc}`, 'human', '张扬')
    }
    
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
    
    // Get project info before deletion for history
    const [projects] = await pool.query('SELECT * FROM projects WHERE id = ?', [id])
    const projectList = projects as any[]
    if (projectList.length > 0) {
      const project = projectList[0]
      await logProjectHistory(id, 'deleted', `删除项目「${project.name}」${project.emoji || '📁'}`, 'human', '张扬')
    }
    
    await pool.query('DELETE FROM projects WHERE id = ?', [id])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete project:', error)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}
