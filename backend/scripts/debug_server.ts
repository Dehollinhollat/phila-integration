import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  // Test the exact same invocation as listContacts
  const [items, total] = await Promise.all([
    prisma.contact.findMany({
      where: {},
      skip: 0,
      take: 10,
      orderBy: { date_inscription: 'desc' },
      select: {
        id: true, genre: true, prenom: true, nom: true,
        telephone: true, ville: true, profil: true, statut: true,
        campus: true, canal: true, date_inscription: true,
        referent_integration: { select: { id: true, prenom: true, nom: true } },
        referent_eglise: { select: { id: true, prenom: true, nom: true } },
        derniere_interaction: true,
      },
    }),
    prisma.contact.count({ where: {} }),
  ]);
  console.log('SUCCESS! Total:', total, 'Items:', items.map(c => ({ id: c.id, profil: c.profil })));
}

main()
  .catch(err => { console.error('ERROR:', err.message); process.exit(1); })
  .finally(() => { prisma.$disconnect(); pool.end(); });
