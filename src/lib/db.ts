import mysql from 'mysql2/promise'

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'op.bullrom.cn',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'My*19940903',
  database: process.env.MYSQL_DATABASE || 'mission_control',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

export interface User {
  id: number
  username: string
  password_hash: string
  display_name: string
  created_at: Date
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username])
  const users = rows as User[]
  return users.length > 0 ? users[0] : null
}

export async function verifyPassword(inputPassword: string, storedHash: string): Promise<boolean> {
  const bcrypt = require('bcryptjs')
  return bcrypt.compare(inputPassword, storedHash)
}

export async function validateCredentials(username: string, password: string): Promise<User | null> {
  const user = await findUserByUsername(username)
  if (!user) return null
  
  const isValid = await verifyPassword(password, user.password_hash)
  if (!isValid) return null
  
  return user
}

export { pool }
