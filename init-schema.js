const mysql = require('mysql2/promise');

async function init() {
  const conn = await mysql.createConnection({
    host: 'op.bullrom.cn',
    port: 3306,
    user: 'root',
    password: 'My*19940903',
    database: 'mission_control'
  });

  console.log('Connected');

  // Projects table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      emoji VARCHAR(10) DEFAULT '📁',
      progress INT DEFAULT 0,
      status ENUM('active', 'completed', 'on-hold') DEFAULT 'active',
      agent_id VARCHAR(50),
      agent_name VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log('Projects table ready');

  // Tasks table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      status ENUM('backlog', 'todo', 'in-progress', 'in-review', 'done') DEFAULT 'backlog',
      priority ENUM('urgent', 'high', 'medium', 'low') DEFAULT 'medium',
      assignee_type ENUM('ai', 'human') DEFAULT 'ai',
      assignee_id VARCHAR(50),
      assignee_name VARCHAR(100),
      due_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log('Tasks table ready');

  // Calendar events table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      date DATE NOT NULL,
      time TIME NOT NULL,
      type ENUM('cron', 'one-time') DEFAULT 'one-time',
      status ENUM('scheduled', 'running', 'completed', 'failed') DEFAULT 'scheduled',
      agent_id VARCHAR(50),
      agent_name VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Calendar events table ready');

  // Insert sample projects with real agents
  const agents = [
    { id: 'main', name: '小七' },
    { id: 'worker', name: '壹号牛马' }
  ];

  // Check if projects exist
  const [rows] = await conn.query('SELECT COUNT(*) as cnt FROM projects');
  if (rows[0].cnt === 0) {
    await conn.query(`
      INSERT INTO projects (name, description, emoji, progress, status, agent_id, agent_name) VALUES
      ('OpenClaw 配置优化', '优化 OpenClaw 配置，提升响应速度', '⚙️', 75, 'active', 'main', '小七'),
      ('飞书机器人开发', '开发飞书渠道的智能助手功能', '💬', 60, 'active', 'main', '小七'),
      ('自动化工作流', '建立日常任务的自动化流程', '🔄', 40, 'active', 'worker', '壹号牛马'),
      ('知识库整理', '整理和管理团队知识库', '📚', 90, 'active', 'main', '小七')
    `);
    console.log('Sample projects inserted');
  }

  // Check if tasks exist
  const [taskRows] = await conn.query('SELECT COUNT(*) as cnt FROM tasks');
  if (taskRows[0].cnt === 0) {
    await conn.query(`
      INSERT INTO tasks (title, description, status, priority, assignee_type, assignee_id, assignee_name, due_date) VALUES
      ('完成周报撰写', '整理本周工作内容，生成周报文档', 'in-progress', 'high', 'ai', 'main', '小七', '2026-03-30'),
      ('调研竞品动态', '分析竞品最新功能和定价策略', 'todo', 'medium', 'ai', 'main', '小七', '2026-03-28'),
      ('审核推文内容', '检查推文内容是否符合品牌调性', 'in-review', 'high', 'ai', 'main', '小七', '2026-03-29'),
      ('订下周机票', '预订下周出差机票', 'backlog', 'urgent', 'human', 'human', '张扬', '2026-04-01'),
      ('审查 PR #42', '审查新功能的 Pull Request', 'in-progress', 'high', 'ai', 'worker', '壹号牛马', '2026-03-29'),
      ('更新API文档', '更新 REST API 接口文档', 'backlog', 'low', 'ai', 'worker', '壹号牛马', '2026-04-05')
    `);
    console.log('Sample tasks inserted');
  }

  await conn.end();
  console.log('Done!');
}

init().catch(console.error);
