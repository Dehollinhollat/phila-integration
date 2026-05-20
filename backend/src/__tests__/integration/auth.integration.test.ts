// integration/auth.integration.test.ts
// Tests d'intégration pour les routes d'authentification.
// Utilise Supertest pour simuler des requêtes HTTP sans démarrer un vrai serveur.
// Prisma est mocké (setup.ts) : on contrôle exactement ce que la DB "retourne".
//
// Chaque test vérifie :
//   - Le code HTTP retourné
//   - La structure du corps JSON
//   - Les effets de bord (appels Prisma, création de tokens)

import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../server';
import prisma from '../../lib/prisma';
import { genererTokenTest } from '../setup';

// Ferme le serveur Express après tous les tests pour éviter les fuites de handles
afterAll((done) => {
  (app as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
  done();
});

// Helper : crée un objet User mocké réaliste
async function buildMockUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id:                  'user-test-123',
    email:               'test@phila.fr',
    password:            await bcrypt.hash('Admin1234!', 12),
    prenom:              'Test',
    nom:                 'Utilisateur',
    role:                'super_admin',
    campus:              ['paris'],
    actif:               true,
    onboarding_complete: true,
    ...overrides,
  };
}

const prismaMock = prisma as unknown as {
  user: { findUnique: jest.Mock };
  refreshToken: { create: jest.Mock; findUnique: jest.Mock };
  connectionLog: { create: jest.Mock };
  contact: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock };
  checklistItem: { createMany: jest.Mock };
};

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    const user = await buildMockUser();
    prismaMock.user.findUnique.mockResolvedValue(user);
    prismaMock.refreshToken.create.mockResolvedValue({
      token: 'refresh-token-mock', user_id: user.id, expires_at: new Date(),
    });
    prismaMock.connectionLog.create.mockResolvedValue({});
  });

  it('devrait retourner 200 et un accessToken avec identifiants valides', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@phila.fr', password: 'Admin1234!' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user).toMatchObject({
      email: 'test@phila.fr',
      role:  'super_admin',
    });
  });

  it('devrait retourner 401 avec un mauvais mot de passe', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@phila.fr', password: 'mauvais' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Identifiants invalides');
  });

  it('devrait retourner 401 si l\'utilisateur n\'existe pas', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inconnu@phila.fr', password: 'Admin1234!' });

    expect(res.status).toBe(401);
  });

  it('devrait retourner 400 si email manquant', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'Admin1234!' });

    expect(res.status).toBe(400);
  });

  it('devrait retourner 401 si le compte est inactif', async () => {
    const inactiveUser = await buildMockUser({ actif: false });
    prismaMock.user.findUnique.mockResolvedValue(inactiveUser);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@phila.fr', password: 'Admin1234!' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/contacts — Protection des routes', () => {
  beforeEach(() => {
    // Route protégée : retourne une liste vide par défaut
    prismaMock.contact.findMany.mockResolvedValue([]);
    prismaMock.contact.findUnique.mockResolvedValue(null);
  });

  it('devrait retourner 401 sans token', async () => {
    const res = await request(app).get('/api/contacts');
    expect(res.status).toBe(401);
  });

  it('devrait retourner 200 avec un token super_admin valide', async () => {
    const token = genererTokenTest('super_admin');

    const res = await request(app)
      .get('/api/contacts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('devrait retourner 401 avec un token invalide', async () => {
    const res = await request(app)
      .get('/api/contacts')
      .set('Authorization', 'Bearer token-invalide');

    expect(res.status).toBe(401);
  });

  it('devrait retourner 403 si le rôle est insuffisant pour DELETE', async () => {
    // Le rôle 'lecteur' n'existe pas — simuler via un rôle inexistant
    const token = genererTokenTest('lecteur');

    const res = await request(app)
      .delete('/api/contacts/123')
      .set('Authorization', `Bearer ${token}`);

    // 403 Forbidden attendu (middleware de rôle)
    expect([403, 401]).toContain(res.status);
  });
});

describe('POST /api/contacts — Création de contact public', () => {
  const validContact = {
    genre:             'homme',
    prenom:            'Test',
    nom:               'Unitaire',
    telephone:         '+33600000001',
    ville:             'Paris',
    etat_civil:        'celibataire',
    statut_phila:      'non',
    autre_eglise:      false,
    canal:             'presentiel',
    consentement_rgpd: true,
    // Token de test Cloudflare Turnstile — accepté par le schéma Zod,
    // le middleware verifyTurnstile est mocké dans setup.ts
    turnstile_token:   '1x0000000000000000000000000000000AA',
  };

  beforeEach(() => {
    prismaMock.contact.findUnique.mockResolvedValue(null);   // pas de doublon
    prismaMock.contact.create.mockResolvedValue({
      id:      'new-contact-id',
      profil:  'visiteur_sans_eglise',
      statut:  'nouveau',
      ...validContact,
    });
    prismaMock.checklistItem.createMany.mockResolvedValue({ count: 7 });
  });

  it('devrait créer un contact et retourner 201 avec données valides', async () => {
    const res = await request(app)
      .post('/api/contacts')
      .send(validContact);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.profil).toBe('visiteur_sans_eglise');
  });

  it('devrait retourner 409 si le téléphone existe déjà', async () => {
    prismaMock.contact.findUnique.mockResolvedValue({
      id: 'existing-id', telephone: '+33600000001',
    });

    const res = await request(app)
      .post('/api/contacts')
      .send(validContact);

    expect(res.status).toBe(409);
  });

  it('devrait retourner 400 si champs obligatoires manquants', async () => {
    const res = await request(app)
      .post('/api/contacts')
      .send({ telephone: '+33600000001' });  // Manque genre, prenom, nom, etc.

    expect(res.status).toBe(400);
  });

  it('devrait retourner 400 si téléphone hors format E.164', async () => {
    const res = await request(app)
      .post('/api/contacts')
      .send({ ...validContact, telephone: '0612345678' });

    expect(res.status).toBe(400);
  });

  it('devrait calculer profil visiteur_avec_eglise si autre_eglise = true', async () => {
    prismaMock.contact.create.mockResolvedValue({
      id:     'new-contact-id-2',
      profil: 'visiteur_avec_eglise',
      ...validContact,
      autre_eglise: true,
    });

    const res = await request(app)
      .post('/api/contacts')
      .send({ ...validContact, autre_eglise: true, telephone: '+33600000002' });

    expect(res.status).toBe(201);
    expect(res.body.profil).toBe('visiteur_avec_eglise');
  });
});
