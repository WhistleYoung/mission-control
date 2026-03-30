import { NextRequest } from 'next/server'

export function verifyAuth(request: NextRequest): { authorized: boolean; user?: any } {
  // Check for auth cookie
  const authCookie = request.cookies.get('mc-auth')
  const userCookie = request.cookies.get('mc-user')
  
  if (!authCookie || authCookie.value !== 'true') {
    return { authorized: false }
  }
  
  if (!userCookie) {
    return { authorized: false }
  }
  
  try {
    const user = JSON.parse(decodeURIComponent(userCookie.value))
    return { authorized: true, user }
  } catch {
    return { authorized: false }
  }
}

export function createAuthResponse(authorized: boolean, error?: string) {
  if (!authorized) {
    return new Response(JSON.stringify({ error: error || 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  return null
}
