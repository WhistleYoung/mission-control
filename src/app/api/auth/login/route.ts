import { NextResponse } from 'next/server'
import { validateCredentials, db } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()
    
    if (!username || !password) {
      return NextResponse.json(
        { error: '用户名和密码不能为空' },
        { status: 400 }
      )
    }
    
    const user = await validateCredentials(username, password)
    
    if (!user) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      )
    }
    
    // Get project name from settings
    let projectName = 'Mission Control'
    try {
      const row = db.prepare('SELECT project_name FROM settings WHERE id = 1').get() as any
      if (row?.project_name) {
        projectName = row.project_name
      }
    } catch (e) {
      console.error('Failed to get project name:', e)
    }
    
    // Return success with user info and project name
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name
      },
      projectName
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}
