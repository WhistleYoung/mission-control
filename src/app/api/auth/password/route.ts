import { NextResponse } from 'next/server'
import { pool, verifyPassword } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { verifyAuth, createAuthResponse } from '@/lib/auth'
import type { NextRequest } from 'next/server'

export async function PUT(request: NextRequest) {
  const auth = verifyAuth(request)
  const errorResponse = createAuthResponse(auth.authorized, '请先登录')
  if (errorResponse) return errorResponse

  try {
    const { username, oldPassword, newPassword } = await request.json()
    
    if (!username || !oldPassword || !newPassword) {
      return NextResponse.json({ error: '参数不完整' }, { status: 400 })
    }
    
    // Get user
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username])
    const users = rows as any[]
    
    if (users.length === 0) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }
    
    const user = users[0]
    
    // Verify old password
    const isValid = await verifyPassword(oldPassword, user.password_hash)
    if (!isValid) {
      return NextResponse.json({ error: '原密码错误' }, { status: 401 })
    }
    
    // Hash new password
    const newHash = await bcrypt.hash(newPassword, 10)
    
    // Update password
    await pool.query('UPDATE users SET password_hash = ? WHERE username = ?', [newHash, username])
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to change password:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
