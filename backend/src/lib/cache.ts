// src/lib/cache.ts
// Cache en mémoire partagé - TTL 5 minutes par défaut.
// Utilisé pour les listes lourdes (contacts, dashboard) afin d'éviter les
// requêtes Prisma répétées entre les mutations.
// Invalider via cache.flushAll() ou cache.del(key) après toute mutation.

import NodeCache from 'node-cache';

export const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

export async function withCache<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>,
): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== undefined) return cached;
  const result = await fn();
  cache.set(key, result, ttl);
  return result;
}
