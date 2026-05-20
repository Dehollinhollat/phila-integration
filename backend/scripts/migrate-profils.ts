// scripts/migrate-profils.ts
// Migre les valeurs A/B de l'enum Profil vers les trois nouvelles valeurs :
//   A → membre_phila
//   B + autre_eglise = true  → visiteur_avec_eglise
//   B + autre_eglise = false/null → visiteur_sans_eglise
//
// Migre aussi DestinataireEvenement :
//   profil_a → profil_membre_phila
//   profil_b → profil_visiteur
//
// Ordre d'exécution obligatoire :
//   1. npx tsx scripts/migrate-profils.ts   (données d'abord)
//   2. npx prisma db push --accept-data-loss (schéma ensuite)

import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool    = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter } as any);

async function main() {
  console.log('== Migration Profils A/B → trois profils ==\n');

  // ─── Étape 1 : ajouter les nouvelles valeurs à l'enum existant ───────────────
  // PostgreSQL supporte ADD VALUE sans récréer le type.
  // Ces commandes sont idempotentes grâce à IF NOT EXISTS.
  console.log('1. Ajout des nouvelles valeurs Profil...');
  await prisma.$executeRawUnsafe(`ALTER TYPE "Profil" ADD VALUE IF NOT EXISTS 'membre_phila'`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "Profil" ADD VALUE IF NOT EXISTS 'visiteur_sans_eglise'`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "Profil" ADD VALUE IF NOT EXISTS 'visiteur_avec_eglise'`);
  console.log('   OK : membre_phila, visiteur_sans_eglise, visiteur_avec_eglise');

  console.log('2. Ajout des nouvelles valeurs DestinataireEvenement...');
  await prisma.$executeRawUnsafe(`ALTER TYPE "DestinataireEvenement" ADD VALUE IF NOT EXISTS 'profil_membre_phila'`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "DestinataireEvenement" ADD VALUE IF NOT EXISTS 'profil_visiteur'`);
  console.log('   OK : profil_membre_phila, profil_visiteur');

  // ─── Étape 2 : compter avant migration ───────────────────────────────────────
  console.log('\n3. Migration des contacts...');

  const [{ count: nA }] = await prisma.$queryRawUnsafe<[{ count: string }]>(
    `SELECT COUNT(*)::text FROM "Contact" WHERE profil::text = 'A'`
  );
  const [{ count: nBs }] = await prisma.$queryRawUnsafe<[{ count: string }]>(
    `SELECT COUNT(*)::text FROM "Contact" WHERE profil::text = 'B' AND (autre_eglise IS NULL OR autre_eglise = false)`
  );
  const [{ count: nBa }] = await prisma.$queryRawUnsafe<[{ count: string }]>(
    `SELECT COUNT(*)::text FROM "Contact" WHERE profil::text = 'B' AND autre_eglise = true`
  );

  console.log(`   A          → membre_phila         : ${nA}`);
  console.log(`   B sans é.  → visiteur_sans_eglise : ${nBs}`);
  console.log(`   B avec é.  → visiteur_avec_eglise : ${nBa}`);

  await prisma.$executeRawUnsafe(
    `UPDATE "Contact" SET profil = 'membre_phila'::"Profil" WHERE profil::text = 'A'`
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "Contact" SET profil = 'visiteur_sans_eglise'::"Profil" WHERE profil::text = 'B' AND (autre_eglise IS NULL OR autre_eglise = false)`
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "Contact" SET profil = 'visiteur_avec_eglise'::"Profil" WHERE profil::text = 'B' AND autre_eglise = true`
  );
  console.log('   OK : contacts migrés');

  // ─── Étape 3 : migrer les événements ─────────────────────────────────────────
  // ::text cast on the WHERE side bypasses Prisma's client-side enum validation
  // (the new schema no longer has 'profil_a'/'profil_b', but the DB still does).
  console.log('\n4. Migration des événements (DestinataireEvenement)...');
  await prisma.$executeRawUnsafe(
    `UPDATE "Evenement" SET destinataires = 'profil_membre_phila'::"DestinataireEvenement" WHERE destinataires::text = 'profil_a'`
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "Evenement" SET destinataires = 'profil_visiteur'::"DestinataireEvenement" WHERE destinataires::text = 'profil_b'`
  );
  console.log('   OK : événements migrés');

  console.log('\n== Migration terminée ==');
  console.log('Lancez maintenant : npx prisma db push --accept-data-loss');
}

main()
  .catch(err => { console.error('ERREUR :', err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
