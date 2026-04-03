import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import bcrypt from 'bcryptjs'

// Database file path
const DATA_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'mission-control.db')

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// Initialize database
const db = new Database(DB_PATH)

// Enable foreign keys
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Initialize tables
function initializeDatabase() {
  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tasks table
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'backlog',
      priority TEXT DEFAULT 'medium',
      assignee_type TEXT DEFAULT 'ai',
      assignee_id TEXT,
      assignee_name TEXT,
      due_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Projects table
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      emoji TEXT DEFAULT '📁',
      agent_id TEXT,
      agent_name TEXT,
      progress INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Project history table
    CREATE TABLE IF NOT EXISTS project_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      description TEXT,
      actor_type TEXT DEFAULT 'system',
      actor_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- Conversations table
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      agent_id TEXT,
      title TEXT,
      summary TEXT,
      message_count INTEGER DEFAULT 0,
      session_id TEXT,
      custom_tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    -- Agent groups table
    CREATE TABLE IF NOT EXISTS agent_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      emoji TEXT DEFAULT '📁',
      color TEXT DEFAULT '#6366f1',
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Agent group members table
    CREATE TABLE IF NOT EXISTS agent_group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      agent_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES agent_groups(id) ON DELETE CASCADE,
      UNIQUE(group_id, agent_id)
    );

    -- Approval history table
    CREATE TABLE IF NOT EXISTS approval_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      approval_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      request_type TEXT,
      command TEXT,
      agent_id TEXT,
      session_key TEXT,
      decision TEXT NOT NULL,
      resolved_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Calendar events table
    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date DATE NOT NULL,
      time TIME,
      type TEXT DEFAULT 'one-time',
      agent_id TEXT,
      agent_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  // Create default admin user if not exists
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin')
  if (!existingUser) {
    const passwordHash = bcrypt.hashSync('admin123', 10)
    db.prepare('INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)').run(
      'admin',
      passwordHash,
      '管理员'
    )
  }
}

initializeDatabase()

// Wrapper to match mysql2/promise interface: [rows, fields]
function query<T>(sql: string, params: any[] = []): [T[], any] {
  const stmt = db.prepare(sql)
  if (sql.trim().toUpperCase().startsWith('SELECT')) {
    const rows = stmt.all(...params) as T[]
    return [rows, undefined as any]
  } else {
    const result = stmt.run(...params)
    return [undefined as any, { insertId: result.lastInsertRowid, affectedRows: result.changes }]
  }
}

// SQL builders for common operations
export const sql = {
  // Insert helper - returns insertId
  insert(table: string, data: Record<string, any>): number {
    const keys = Object.keys(data)
    const values = Object.values(data)
    const placeholders = keys.map(() => '?').join(', ')
    const result = db.prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`).run(...values)
    return result.lastInsertRowid as number
  },

  // Update helper - returns affected rows
  update(table: string, data: Record<string, any>, where: string, whereParams: any[]): number {
    const keys = Object.keys(data)
    const values = Object.values(data)
    const setClause = keys.map(k => `${k} = ?`).join(', ')
    const result = db.prepare(`UPDATE ${table} SET ${setClause} WHERE ${where}`).run(...values, ...whereParams)
    return result.changes
  },

  // Delete helper
  delete(table: string, where: string, whereParams: any[]): number {
    const result = db.prepare(`DELETE FROM ${table} WHERE ${where}`).run(...whereParams)
    return result.changes
  }
}

export interface User {
  id: number
  username: string
  password_hash: string
  display_name: string
  created_at: Date
}

// Re-export pool as db for compatibility with existing code
export const pool = {
  query,
  // For direct statement execution when needed
  exec(sql: string) {
    return db.exec(sql)
  },
  prepare(sql: string) {
    return db.prepare(sql)
  }
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const [rows] = query<User>('SELECT * FROM users WHERE username = ?', [username])
  return rows.length > 0 ? rows[0] : null
}

export async function verifyPassword(inputPassword: string, storedHash: string): Promise<boolean> {
  return bcrypt.compare(inputPassword, storedHash)
}

export async function validateCredentials(username: string, password: string): Promise<User | null> {
  const user = await findUserByUsername(username)
  if (!user) return null
  
  const isValid = await verifyPassword(password, user.password_hash)
  if (!isValid) return null
  
  return user
}

export { db }
