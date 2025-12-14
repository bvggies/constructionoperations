import pool from '../config/database';
import { hashPassword } from '../utils/password';

async function createAdmin() {
  try {
    const username = process.argv[2] || 'admin';
    const email = process.argv[3] || 'admin@example.com';
    const password = process.argv[4] || 'admin123';
    const fullName = process.argv[5] || 'Administrator';

    // Check if admin already exists
    const existing = await pool.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
    
    if (existing.rows.length > 0) {
      console.log('Admin user already exists!');
      process.exit(0);
    }

    const passwordHash = await hashPassword(password);

    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, role, full_name)
       VALUES ($1, $2, $3, 'admin', $4)
       RETURNING id, username, email, role, full_name`,
      [username, email, passwordHash, fullName]
    );

    console.log('Admin user created successfully!');
    console.log('Username:', result.rows[0].username);
    console.log('Email:', result.rows[0].email);
    console.log('Role:', result.rows[0].role);
    console.log('\nYou can now login with these credentials.');

    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
}

createAdmin();

