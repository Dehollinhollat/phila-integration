// backend/scripts/reset-checklist.ts
// Supprime toutes les lignes de la table ChecklistItem en base.
//
// À utiliser avant un reset d'enum (prisma db push) pour éviter les erreurs
// de contrainte d'intégrité sur les valeurs d'étapes obsolètes.
//
// Usage :
//   npm run reset-checklist
//
// Variable d'environnement requise (lue depuis .env) :
//   DATABASE_URL — chaîne de connexion PostgreSQL Neon.tech (sslmode=require)

import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// ─── Initialisation du client Prisma ────────────────────────────────────────

const pool    = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter } as any);

// ─── Script principal ────────────────────────────────────────────────────────

async function resetChecklist(): Promise<void> {
  console.log('🗑️   Suppression de toutes les lignes ChecklistItem...\n');

  const result = await prisma.checklistItem.deleteMany({});

  console.log(`✅  ${result.count} ligne(s) supprimée(s).\n`);
}

// ─── Exécution ───────────────────────────────────────────────────────────────

resetChecklist()
  .catch((err: unknown) => {
    console.error('❌  Erreur lors du reset :', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
