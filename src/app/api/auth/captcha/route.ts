import { NextResponse } from 'next/server'

// Simple in-memory store (resets on server restart)
// For production, use Redis or similar
const captchas = new Map<string, { answer: number; expires: number }>()

export async function GET() {
  // Generate unique ID and captcha
  const id = Math.random().toString(36).substring(2, 15)
  const num1 = Math.floor(Math.random() * 10) + 1
  const num2 = Math.floor(Math.random() * 10) + 1
  const operators = ['+', '-', '*']
  const operator = operators[Math.floor(Math.random() * operators.length)]
  
  let answer: number
  let question: string
  
  switch (operator) {
    case '+':
      answer = num1 + num2
      question = `${num1} + ${num2}`
      break
    case '-':
      // Ensure no negative results
      answer = Math.max(num1, num2) - Math.min(num1, num2)
      question = `${Math.max(num1, num2)} - ${Math.min(num1, num2)}`
      break
    case '*':
      answer = num1 * num2
      question = `${num1} × ${num2}`
      break
    default:
      answer = num1 + num2
      question = `${num1} + ${num2}`
  }
  
  // Store with 5 minute expiry
  captchas.set(id, { answer, expires: Date.now() + 5 * 60 * 1000 })
  
  return NextResponse.json({ id, question })
}

export async function POST(request: Request) {
  try {
    const { id, answer } = await request.json()
    
    if (!id || answer === undefined) {
      return NextResponse.json({ valid: false, error: 'Missing parameters' })
    }
    
    const stored = captchas.get(id)
    
    if (!stored) {
      return NextResponse.json({ valid: false, error: 'Captcha not found' })
    }
    
    // Check expiry
    if (Date.now() > stored.expires) {
      captchas.delete(id)
      return NextResponse.json({ valid: false, error: 'Captcha expired' })
    }
    
    // Check answer
    if (parseInt(answer) === stored.answer) {
      captchas.delete(id) // One-time use
      return NextResponse.json({ valid: true })
    }
    
    return NextResponse.json({ valid: false, error: 'Wrong answer' })
  } catch {
    return NextResponse.json({ valid: false, error: 'Invalid request' })
  }
}
