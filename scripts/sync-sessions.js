#!/usr/bin/env node
/**
 * Sync OpenClaw Sessions to Mission Control Database
 * 
 * This script reads recent OpenClaw session files and saves conversation
 * summaries to the conversations table in Mission Control.
 * 
 * Usage: node sync-sessions.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const SESSION_DIR = '/home/bullrom/.openclaw/agents';
const DB_CONFIG = {
  host: process.env.MYSQL_HOST || 'op.bullrom.cn',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'My*19940903',
  database: process.env.MYSQL_DATABASE || 'mission_control',
};

// Simple JSONL parser (one JSON object per line)
function readJsonl(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    return lines.map(line => JSON.parse(line));
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return [];
  }
}

// Extract actual user text from message, removing metadata blocks
function extractUserText(text) {
  if (!text) return ''
  
  // Strategy: Split by ``` markers and take non-empty parts
  // This handles both ```json...``` and ```...```
  const parts = text.split(/```[a-z]*\n?/).filter(p => p.trim())
  
  if (parts.length === 0) return ''
  
  // The last non-empty part should be the actual message
  // (because metadata comes first)
  let lastPart = parts[parts.length - 1].trim()
  
  // If the last part starts with known metadata patterns, use the second-to-last
  if (lastPart.match(/^(json|untrusted)/i) && parts.length > 1) {
    lastPart = parts[parts.length - 2].trim()
  }
  
  // Remove any remaining metadata patterns at the start
  lastPart = lastPart.replace(/^Conversation info[\s\S]*?^}/gm, '')
                     .replace(/^Sender[\s\S]*?^}/gm, '')
                     .replace(/^\{[\s\S]*?^\}/gm, '')
                     .replace(/^\[message_id:.*$/gm, '')
                     .replace(/^\[.*?\]:.*$/gm, '')
  
  return lastPart.trim()
}

// Check if message is a real user conversation (not system/heartbeat)
function isRealUserMessage(msg) {
  if (!msg || msg.message.role !== 'user') return false
  const content = msg.message.content
  if (!Array.isArray(content)) return false
  
  const text = content.find(c => c.type === 'text')?.text || ''
  if (!text || text.length < 3) return false
  
  // Extract actual user text after removing metadata
  const userText = extractUserText(text)
  
  // Skip if no real content after cleaning
  if (!userText || userText.length < 2) return false
  
  // Skip specific system messages (English patterns only)
  const skipPatterns = [
    /^Read HEARTBEAT/m,
    /^A new session/m,
    /^System:/im,
    /^[a-z_]+=/m,
  ]
  
  for (const pattern of skipPatterns) {
    if (pattern.test(userText)) return false
  }
  
  return true
}

// Extract conversation summary from JSONL events
function extractConversation(events) {
  // Filter to only actual user-ai conversation pairs
  const messages = events.filter(e => {
    if (e.type !== 'message' || !e.message) return false
    // Only user and assistant roles
    if (!['user', 'assistant'].includes(e.message.role)) return false
    const content = e.message.content
    if (Array.isArray(content)) {
      // Must have text content
      const hasText = content.some(c => c.type === 'text')
      if (!hasText) return false
    }
    return true
  });
  
  // Skip cron job sessions entirely (they're system sessions, not real conversations)
  const sessionKey = events[0]?.sessionKey || ''
  if (sessionKey.includes(':cron:') || sessionKey.includes('cron:')) {
    return null
  }
  
  // Need at least one real user message to be considered a conversation
  const hasRealUserMessage = messages.some(m => isRealUserMessage(m))
  if (!hasRealUserMessage) {
    return null // Signal to skip this session
  }
  
  // Get first real user message as title
  let title = '新对话';
  for (const msg of messages) {
    if (msg.message.role === 'user' && isRealUserMessage(msg)) {
      const content = msg.message.content;
      if (Array.isArray(content)) {
        const text = content.find(c => c.type === 'text')?.text || '';
        if (text) {
          const userText = extractUserText(text)
          if (userText && userText.length >= 2) {
            // Use actual Chinese text
            title = userText.substring(0, 100).replace(/\n/g, ' ').trim();
            break;
          }
        }
      }
    }
  }
  
  // Get last assistant message as summary (skip thinking)
  let summary = '';
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].message.role === 'assistant') {
      const content = messages[i].message.content;
      if (Array.isArray(content)) {
        const text = content.find(c => c.type === 'text')?.text || '';
        if (text && text.trim().length > 0) {
          // Skip if looks like thinking/reasoning
          if (!text.includes('```') && text.length < 500) {
            summary = text.substring(0, 200).replace(/\n/g, ' ').trim();
            break;
          }
        }
      }
    }
  }
  
  return {
    title,
    summary,
    messageCount: messages.length
  };
}

// Get all session files from all agents
function getAllSessions() {
  const sessions = [];
  
  if (!fs.existsSync(SESSION_DIR)) {
    console.log('Session directory not found:', SESSION_DIR);
    return sessions;
  }
  
  const agents = fs.readdirSync(SESSION_DIR);
  
  for (const agent of agents) {
    const sessionsPath = path.join(SESSION_DIR, agent, 'sessions');
    if (!fs.existsSync(sessionsPath)) continue;
    
    // Read sessions.json to get session metadata
    const sessionsFile = path.join(sessionsPath, 'sessions.json');
    if (fs.existsSync(sessionsFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(sessionsFile, 'utf-8'));
        
        for (const [key, session] of Object.entries(data)) {
          const sessionData = session;
          
          // Get session file path
          const sessionFile = sessionData.sessionFile || 
            path.join(sessionsPath, `${sessionData.sessionId}.jsonl`);
          
          sessions.push({
            key,
            agentId: agent,
            sessionId: sessionData.sessionId,
            sessionFile,
            updatedAt: sessionData.updatedAt,
            model: sessionData.model,
            kind: sessionData.kind,
            deliveryContext: sessionData.deliveryContext,
            lastChannel: sessionData.lastChannel,
            lastTo: sessionData.lastTo,
          });
        }
      } catch (error) {
        console.error(`Error reading sessions.json for ${agent}:`, error.message);
      }
    }
  }
  
  return sessions;
}

// Ensure conversations table exists
async function ensureTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INT PRIMARY KEY AUTO_INCREMENT,
      project_id INT NULL,
      agent_id VARCHAR(50) NOT NULL,
      session_key VARCHAR(255) UNIQUE,
      session_id VARCHAR(100),
      title VARCHAR(255),
      summary TEXT,
      message_count INT DEFAULT 0,
      channel VARCHAR(50),
      last_to VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL,
      INDEX idx_project_id (project_id),
      INDEX idx_agent_id (agent_id),
      INDEX idx_session_key (session_key)
    )
  `);
}

// Check if conversation already exists
async function conversationExists(pool, sessionKey) {
  const [rows] = await pool.query(
    'SELECT id, project_id FROM conversations WHERE session_key = ?',
    [sessionKey]
  );
  return rows.length > 0 ? rows[0] : null;
}

// Auto-classify conversation based on keywords
async function autoClassify(pool, title, summary) {
  // Get all projects
  const [projects] = await pool.query('SELECT id, name, emoji FROM projects');
  
  const text = `${title} ${summary}`.toLowerCase();
  
  for (const project of projects) {
    const keywords = project.name.toLowerCase().split(/[\s,.，、]+/);
    for (const keyword of keywords) {
      if (keyword.length >= 2 && text.includes(keyword)) {
        console.log(`  Auto-classified to: ${project.emoji} ${project.name}`);
        return project.id;
      }
    }
  }
  return null;
}

// Save or update conversation
async function saveConversation(pool, session) {
  const { key, agentId, sessionId, sessionFile, updatedAt, model, channel, lastTo } = session;
  
  // Read session file
  const events = readJsonl(sessionFile);
  const result = extractConversation(events);
  
  // Skip if not a real conversation (no meaningful user messages)
  if (!result) {
    console.log(`Skipped: No meaningful conversation (${key})`);
    return;
  }
  
  const { title, summary, messageCount } = result;
  
  // Check if exists
  const existing = await conversationExists(pool, key);
  
  if (existing) {
    // Update existing (only if not already classified)
    if (!existing.project_id) {
      const projectId = await autoClassify(pool, title, summary);
      await pool.query(`
        UPDATE conversations SET 
          title = ?, summary = ?, message_count = ?, project_id = ?, updated_at = NOW()
        WHERE session_key = ?
      `, [title, summary, messageCount, projectId, key]);
    } else {
      await pool.query(`
        UPDATE conversations SET 
          title = ?, summary = ?, message_count = ?, updated_at = NOW()
        WHERE session_key = ?
      `, [title, summary, messageCount, key]);
    }
    console.log(`Updated: ${title.substring(0, 50)} (${key})`);
  } else {
    // Auto-classify new conversation
    const projectId = await autoClassify(pool, title, summary);
    await pool.query(`
      INSERT INTO conversations (project_id, agent_id, session_key, session_id, title, summary, message_count, channel, last_to)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [projectId, agentId, key, sessionId, title, summary, messageCount, channel || '', lastTo || '']);
    console.log(`Created: ${title.substring(0, 50)} (${key})`);
  }
}

// Main sync function
async function main() {
  const dryRun = process.argv.includes('--dry-run');
  
  console.log('=== OpenClaw Session Sync ===');
  console.log('Mode:', dryRun ? 'DRY RUN' : 'LIVE');
  console.log('');
  
  // Get all sessions
  const sessions = getAllSessions();
  console.log(`Found ${sessions.length} sessions`);
  
  if (sessions.length === 0) {
    console.log('No sessions to sync');
    return;
  }
  
  // Filter to recent sessions (last 24 hours)
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  const recentSessions = sessions.filter(s => s.updatedAt > oneDayAgo);
  console.log(`Recent sessions (24h): ${recentSessions.length}`);
  
  if (dryRun) {
    console.log('\nDry run - would sync:');
    for (const session of recentSessions) {
      const events = readJsonl(session.sessionFile);
      const { title } = extractConversation(events);
      console.log(`  [${session.agentId}] ${title}`);
    }
    return;
  }
  
  // Connect to database
  const pool = mysql.createPool(DB_CONFIG);
  
  try {
    await ensureTable(pool);
    
    // Sync recent sessions
    for (const session of recentSessions) {
      try {
        await saveConversation(pool, session);
      } catch (error) {
        console.error(`Error saving session ${session.key}:`, error.message);
      }
    }
    
    console.log('\nSync completed!');
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
