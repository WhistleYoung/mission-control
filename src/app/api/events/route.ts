import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import { getAgentNames } from '@/lib/agent-config'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const [customEvents] = await pool.query('SELECT * FROM calendar_events ORDER BY date ASC, time ASC')
    
    const now = new Date()
    const agentNames = getAgentNames()
    const cronJobs = [
      {
        id: 'cron-1',
        title: '每日健康检查',
        date: now.toISOString().split('T')[0],
        time: '08:00:00',
        type: 'cron',
        status: 'completed',
        agent_id: 'main',
        agent_name: agentNames['main'] || '小七',
      },
      {
        id: 'cron-2',
        title: '周报生成',
        date: now.toISOString().split('T')[0],
        time: '09:00:00',
        type: 'cron',
        status: 'scheduled',
        agent_id: 'main',
        agent_name: agentNames['main'] || '小七',
      },
      {
        id: 'cron-3',
        title: '数据备份',
        date: new Date(now.getTime() + 86400000).toISOString().split('T')[0],
        time: '02:00:00',
        type: 'cron',
        status: 'scheduled',
        agent_id: 'worker',
        agent_name: agentNames['worker'] || '壹号牛马',
      },
    ]
    
    return NextResponse.json({
      custom: customEvents,
      cron: cronJobs,
    })
  } catch (error) {
    console.error('Failed to fetch events:', error)
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { title, date, time, type, agent_id, agent_name } = await request.json()
    
    const [result]: any = await pool.query(
      'INSERT INTO calendar_events (title, date, time, type, agent_id, agent_name) VALUES (?, ?, ?, ?, ?, ?)',
      [title, date, time, type || 'one-time', agent_id, agent_name]
    )
    
    return NextResponse.json({ success: true, id: result.insertId })
  } catch (error) {
    console.error('Failed to create event:', error)
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { id } = await request.json()
    await pool.query('DELETE FROM calendar_events WHERE id = ?', [id])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete event:', error)
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 })
  }
}
