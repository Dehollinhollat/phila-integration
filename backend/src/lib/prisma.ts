// src/lib/prisma.ts
// Client Prisma 7 — singleton pour toute l'application.
//
// ⚠️  Prisma 7 avec provider = "prisma-client" utilise un moteur TypeScript pur
//     (pas le binaire Rust). Ce moteur ne gère pas la connexion lui-même :
//     un adaptateur de base de données doit être fourni au constructeur.
//     On utilise @prisma/adapter-pg avec un Pool pg standard.
//
// Pattern singleton : évite la multiplication des connexions et des pools
//     lors des rechargements à chaud avec tsx --watch.
//
// Variables d'environnement requises :
//   DATABASE_URL — chaîne de connexion PostgreSQL Neon.tech (sslmode=require)

import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

type GlobalWithPrisma = typeof globalThis & { _prisma?: PrismaClient };

const g = globalThis as GlobalWithPrisma;

function createClient(): PrismaClient {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

const prisma: PrismaClient = g._prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  g._prisma = prisma;
}

export default prisma;
