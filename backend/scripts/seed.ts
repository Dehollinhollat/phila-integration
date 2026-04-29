// backend/scripts/seed.ts
// Script d'initialisation — crée le premier compte super_admin en base.
//
// À exécuter une seule fois après la migration initiale :
//   npm run seed
//
// Le script est idempotent : si un compte avec cet email existe déjà,
// il affiche un avertissement et ne crée pas de doublon.
//
// Prérequis :
//   npx prisma migrate dev --name init   (applique le schema à Neon.tech)
//   npm run seed                         (crée le super_admin)
//
// Variable d'environnement requise (lue depuis .env) :
//   DATABASE_URL — chaîne de connexion PostgreSQL Neon.tech (sslmode=require)

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// ─── Configuration du compte à créer ────────────────────────────────────────

const SUPER_ADMIN = {
  prenom:   'Admin',
  nom:      'Phila',
  email:    'deohmagique@gmail.com',
  password: 'Admin1234!',
  role:     'super_admin'  as const,
  campus:   ['paris', 'paris_nord'] as ('paris' | 'paris_nord')[],
  actif:    true,
};

// ─── Initialisation du client Prisma ────────────────────────────────────────
// Prisma 7 (provider "prisma-client") requiert un adaptateur explicite.
// Même pattern que src/lib/prisma.ts.

const pool    = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter } as any);

// ─── Script principal ────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  console.log('🌱  Démarrage du seed...\n');

  // Vérifie si le compte existe déjà (clé unique : email)
  const existing = await prisma.user.findUnique({
    where: { email: SUPER_ADMIN.email },
  });

  if (existing) {
    console.warn(`⚠️  Un compte existe déjà pour "${SUPER_ADMIN.email}" (id: ${existing.id}).`);
    console.warn('   Aucune modification effectuée.\n');
    return;
  }

  // Hash du mot de passe — facteur de coût 12 (recommandé pour la production)
  const hashedPassword = await bcrypt.hash(SUPER_ADMIN.password, 12);

  const user = await prisma.user.create({
    data: {
      prenom:   SUPER_ADMIN.prenom,
      nom:      SUPER_ADMIN.nom,
      email:    SUPER_ADMIN.email,
      password: hashedPassword,
      role:     SUPER_ADMIN.role,
      campus:   SUPER_ADMIN.campus,
      actif:    SUPER_ADMIN.actif,
    },
    select: {
      id:     true,
      prenom: true,
      nom:    true,
      email:  true,
      role:   true,
      campus: true,
    },
  });

  console.log('✅  Super admin créé avec succès :');
  console.log(`    id     : ${user.id}`);
  console.log(`    nom    : ${user.prenom} ${user.nom}`);
  console.log(`    email  : ${user.email}`);
  console.log(`    rôle   : ${user.role}`);
  console.log(`    campus : ${(user.campus as string[]).join(', ')}\n`);
  console.log('⚠️  Pensez à changer le mot de passe après la première connexion.');
}

// ─── Exécution ───────────────────────────────────────────────────────────────

seed()
  .catch((err: unknown) => {
    console.error('❌  Erreur lors du seed :', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
