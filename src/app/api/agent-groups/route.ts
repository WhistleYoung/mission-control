import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import type { NextRequest } from 'next/server'

// GET /api/agent-groups - List all groups with their members
export async function GET(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const groups = db.prepare(`
      SELECT id, name, emoji, color, sort_order, created_at 
      FROM agent_groups 
      ORDER BY sort_order ASC, id ASC
    `).all() as any[]

    // Get members for each group
    const groupsWithMembers = groups.map(group => {
      const members = db.prepare(`
        SELECT agent_id FROM agent_group_members WHERE group_id = ?
      `).all(group.id) as any[]
      return {
        ...group,
        agentIds: members.map(m => m.agent_id)
      }
    })

    return NextResponse.json(groupsWithMembers)
  } catch (error) {
    console.error('Failed to fetch agent groups:', error)
    return NextResponse.json({ error: '获取分组失败' }, { status: 500 })
  }
}

// POST /api/agent-groups - Create a new group
export async function POST(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { name, emoji, color, agentIds } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: '分组名称不能为空' }, { status: 400 })
    }

    // Get max sort_order
    const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM agent_groups').get() as any
    const sortOrder = (maxOrder?.max || 0) + 1

    // Insert group
    const result = db.prepare(`
      INSERT INTO agent_groups (name, emoji, color, sort_order) 
      VALUES (?, ?, ?, ?)
    `).run(name.trim(), emoji || '📁', color || '#6366f1', sortOrder)

    const groupId = result.lastInsertRowid

    // Add members if provided
    if (agentIds && Array.isArray(agentIds)) {
      const insertMember = db.prepare('INSERT OR IGNORE INTO agent_group_members (group_id, agent_id) VALUES (?, ?)')
      for (const agentId of agentIds) {
        insertMember.run(groupId, agentId)
      }
    }

    const newGroup = db.prepare('SELECT * FROM agent_groups WHERE id = ?').get(groupId) as any
    return NextResponse.json({
      ...newGroup,
      agentIds: agentIds || []
    })
  } catch (error) {
    console.error('Failed to create agent group:', error)
    return NextResponse.json({ error: '创建分组失败' }, { status: 500 })
  }
}

// PUT /api/agent-groups - Update a group
export async function PUT(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { id, name, emoji, color, sortOrder, agentIds } = await request.json()

    if (!id) {
      return NextResponse.json({ error: '分组ID不能为空' }, { status: 400 })
    }

    // Update group info
    if (name !== undefined || emoji !== undefined || color !== undefined || sortOrder !== undefined) {
      const updates: string[] = []
      const values: any[] = []
      
      if (name !== undefined) { updates.push('name = ?'); values.push(name.trim()) }
      if (emoji !== undefined) { updates.push('emoji = ?'); values.push(emoji) }
      if (color !== undefined) { updates.push('color = ?'); values.push(color) }
      if (sortOrder !== undefined) { updates.push('sort_order = ?'); values.push(sortOrder) }
      
      if (updates.length > 0) {
        values.push(id)
        db.prepare(`UPDATE agent_groups SET ${updates.join(', ')} WHERE id = ?`).run(...values)
      }
    }

    // Update members if provided
    if (agentIds !== undefined && Array.isArray(agentIds)) {
      // Remove all existing members
      db.prepare('DELETE FROM agent_group_members WHERE group_id = ?').run(id)
      // Add new members
      const insertMember = db.prepare('INSERT INTO agent_group_members (group_id, agent_id) VALUES (?, ?)')
      for (const agentId of agentIds) {
        insertMember.run(id, agentId)
      }
    }

    const updatedGroup = db.prepare('SELECT * FROM agent_groups WHERE id = ?').get(id) as any
    const members = db.prepare('SELECT agent_id FROM agent_group_members WHERE group_id = ?').all(id) as any[]
    
    return NextResponse.json({
      ...updatedGroup,
      agentIds: members.map(m => m.agent_id)
    })
  } catch (error) {
    console.error('Failed to update agent group:', error)
    return NextResponse.json({ error: '更新分组失败' }, { status: 500 })
  }
}

// DELETE /api/agent-groups - Delete a group
export async function DELETE(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: '分组ID不能为空' }, { status: 400 })
    }

    // Delete group (members will be cascade deleted)
    db.prepare('DELETE FROM agent_groups WHERE id = ?').run(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete agent group:', error)
    return NextResponse.json({ error: '删除分组失败' }, { status: 500 })
  }
}
