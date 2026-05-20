// unit/auth.test.ts
// Teste les primitives cryptographiques d'authentification :
//   - Hachage bcrypt des mots de passe (comparaison correcte / rejet mauvais mdp)
//   - Génération et vérification de tokens JWT
//   - Rejet des tokens expirés
//
// Ces tests sont purement unitaires : aucune DB, aucun HTTP, aucun Prisma.
// Ils valident que la couche sécurité de base fonctionne correctement en isolation.

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

describe('Auth — Hachage bcrypt', () => {
  it('devrait hasher le mot de passe et le comparer correctement', async () => {
    const hash = await bcrypt.hash('Admin1234!', 12);
    // Le hash bcrypt doit correspondre au mot de passe original
    expect(await bcrypt.compare('Admin1234!', hash)).toBe(true);
  });

  it('devrait rejeter un mauvais mot de passe', async () => {
    const hash = await bcrypt.hash('Admin1234!', 12);
    expect(await bcrypt.compare('mauvais', hash)).toBe(false);
  });

  it('devrait produire des hashes différents pour le même mot de passe (salt aléatoire)', async () => {
    const hash1 = await bcrypt.hash('Admin1234!', 12);
    const hash2 = await bcrypt.hash('Admin1234!', 12);
    // Deux hashes du même mdp doivent être différents (salt unique)
    expect(hash1).not.toBe(hash2);
  });
});

describe('Auth — Tokens JWT', () => {
  const secret = process.env.JWT_SECRET!;

  it('devrait générer et vérifier un token valide', () => {
    const token = jwt.sign(
      { userId: '123', role: 'super_admin' },
      secret,
      { expiresIn: '8h', algorithm: 'HS256' },
    );
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as Record<string, unknown>;
    expect(decoded.userId).toBe('123');
    expect(decoded.role).toBe('super_admin');
  });

  it('devrait inclure toutes les claims dans le payload', () => {
    const token = jwt.sign(
      { userId: 'abc', role: 'admin_campus', campus: ['paris'] },
      secret,
      { expiresIn: '8h' },
    );
    const decoded = jwt.verify(token, secret) as Record<string, unknown>;
    expect(decoded.campus).toEqual(['paris']);
  });

  it('devrait rejeter un token expiré', () => {
    const token = jwt.sign({ userId: '123' }, secret, { expiresIn: '-1s' });
    // jwt.verify doit lancer TokenExpiredError
    expect(() => jwt.verify(token, secret)).toThrow('jwt expired');
  });

  it('devrait rejeter un token signé avec le mauvais secret', () => {
    const token = jwt.sign({ userId: '123' }, 'mauvais-secret', { expiresIn: '8h' });
    expect(() => jwt.verify(token, secret)).toThrow();
  });

  it('devrait rejeter un token malformé', () => {
    expect(() => jwt.verify('pas-un-token', secret)).toThrow();
  });
});
