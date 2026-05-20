import 'dotenv/config';
import pg from 'pg';

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const r = await pool.query(`SELECT id, email, role, actif FROM "User" LIMIT 5`);
    console.log('Users:', r.rows);
  } finally { await pool.end(); }
}
main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
