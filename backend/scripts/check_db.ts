import 'dotenv/config';
import pg from 'pg';

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    const enumResult = await pool.query(`
      SELECT enumlabel FROM pg_enum 
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
      WHERE pg_type.typname = 'Profil'
      ORDER BY enumsortorder
    `);
    console.log('Profil enum values in DB:', enumResult.rows.map(r => r.enumlabel));
    
    const countResult = await pool.query(`
      SELECT profil::text, COUNT(*) FROM "Contact" GROUP BY profil::text
    `);
    console.log('Contact profil distribution:', countResult.rows);
    
    const destResult = await pool.query(`
      SELECT enumlabel FROM pg_enum 
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
      WHERE pg_type.typname = 'DestinataireEvenement'
      ORDER BY enumsortorder
    `);
    console.log('DestinataireEvenement enum values:', destResult.rows.map(r => r.enumlabel));
    
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
