import { NextResponse } from 'next/server'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import type { NextRequest } from 'next/server'

// Helper to run openclaw cron commands
async function runCronCommand(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  const { execSync } = require('child_process')
  try {
    const stdout = execSync(`openclaw cron ${args.join(' ')} --json`, { encoding: 'utf-8', timeout: 10000 })
    return { stdout, stderr: '', code: 0 }
  } catch (error: any) {
    return { stdout: error.stdout || '', stderr: error.stderr || error.message, code: error.status || 1 }
  }
}

export async function GET(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { stdout } = await runCronCommand(['list'])
    const data = JSON.parse(stdout)
    
    // Transform to more frontend-friendly format
    const jobs = (data.jobs || []).map((job: any) => ({
      id: job.id,
      name: job.name,
      enabled: job.enabled,
      schedule: job.schedule?.expr || '',
      scheduleKind: job.schedule?.kind || 'cron',
      nextRunAt: job.state?.nextRunAtMs ? new Date(job.state.nextRunAtMs).toISOString() : null,
      createdAt: new Date(job.createdAtMs).toISOString(),
      updatedAt: new Date(job.updatedAtMs).toISOString(),
      sessionTarget: job.sessionTarget,
      wakeMode: job.wakeMode,
      message: job.payload?.message || '',
      deliverMode: job.delivery?.mode || 'none',
      deliverChannel: job.delivery?.channel || 'last',
    }))

    return NextResponse.json({ jobs, total: data.total })
  } catch (error: any) {
    console.error('Failed to fetch cron jobs:', error)
    return NextResponse.json({ error: '获取定时任务失败', jobs: [], total: 0 }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const { name, cron, message, agent, sessionTarget, deliverMode, deliverChannel, disabled } = body

    if (!name || !cron) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
    }

    const args = ['add']
    if (name) args.push('--name', name)
    if (cron) args.push('--cron', cron)
    if (message) args.push('--message', message)
    if (agent) args.push('--agent', agent)
    if (sessionTarget) args.push('--session', sessionTarget)
    if (deliverMode) args.push('--' + deliverMode === 'announce' ? 'announce' : 'no-deliver')
    if (deliverChannel) args.push('--channel', deliverChannel)
    if (disabled) args.push('--disabled')

    const { stdout, code, stderr } = await runCronCommand(args)
    
    if (code !== 0) {
      console.error('Cron add failed:', stderr)
      return NextResponse.json({ error: '创建定时任务失败' }, { status: 500 })
    }

    const data = JSON.parse(stdout)
    return NextResponse.json({ success: true, job: data })
  } catch (error: any) {
    console.error('Failed to create cron job:', error)
    return NextResponse.json({ error: '创建定时任务失败' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('id')

    if (!jobId) {
      return NextResponse.json({ error: '缺少任务ID' }, { status: 400 })
    }

    const { code, stderr } = await runCronCommand(['rm', jobId])
    
    if (code !== 0) {
      console.error('Cron rm failed:', stderr)
      return NextResponse.json({ error: '删除定时任务失败' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete cron job:', error)
    return NextResponse.json({ error: '删除定时任务失败' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const { id, enabled, name, cron, message } = body

    if (!id) {
      return NextResponse.json({ error: '缺少任务ID' }, { status: 400 })
    }

    const args = ['edit', id]
    if (enabled !== undefined) args.push(enabled ? '--enable' : '--disable')
    if (name) args.push('--name', name)
    if (cron) args.push('--cron', cron)
    if (message !== undefined) args.push('--message', message)

    const { code, stderr } = await runCronCommand(args)
    
    if (code !== 0) {
      console.error('Cron edit failed:', stderr)
      return NextResponse.json({ error: '更新定时任务失败' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to update cron job:', error)
    return NextResponse.json({ error: '更新定时任务失败' }, { status: 500 })
  }
}