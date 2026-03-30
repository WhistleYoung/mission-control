const mysql = require('mysql2/promise');

async function initDatabase() {
  const connection = await mysql.createConnection({
    host: 'op.bullrom.cn',
    port: 3306,
    user: 'MissionControl',
    password: 'Mc*19940903',
    family: 4, // Force IPv4
  });

  console.log('Connected to MySQL');

  // Create database
  await connection.query('CREATE DATABASE IF NOT EXISTS mission_control');
  console.log('Database created/verified');

  // Use database
  await connection.query('USE mission_control');

  // Create users table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(100) DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log('Users table created/verified');

  // Hash password using bcrypt (we'll use bcryptjs on frontend)
  const bcrypt = require('bcryptjs');
  const passwordHash = await bcrypt.hash('Mc*19940903', 10);
  
  // Insert default admin user
  try {
    await connection.query(
      'INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)',
      ['admin', passwordHash, '管理员']
    );
    console.log('Admin user created');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      console.log('Admin user already exists');
    } else {
      throw err;
    }
  }

  await connection.end();
  console.log('Done!');
}

initDatabase().catch(console.error);
