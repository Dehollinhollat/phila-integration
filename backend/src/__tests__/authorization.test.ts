// authorization.test.ts
// Tests unitaires pour les helpers IDOR — peutAccederContact et filtreContactsParRole.
// Prisma est mocké via moduleNameMapper (jest.config.ts) : aucune connexion DB réelle.

import { peutAccederContact, filtreContactsParRole } from '../lib/authorization';
import prisma from '../lib/prisma';

const mockFindUnique = prisma.contact.findUnique as jest.Mock;

describe('peutAccederContact', () => {
  it('super_admin peut acceder a tout sans requete DB', async () => {
    const user = { id: 'admin-1', role: 'super_admin', campus: [] };
    const result = await peutAccederContact(user, 'contact-xyz');
    expect(result).toBe(true);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('retourne false si le contact est introuvable en DB', async () => {
    mockFindUnique.mockResolvedValue(null);
    const user = { id: 'user-1', role: 'admin_campus', campus: ['paris'] };
    const result = await peutAccederContact(user, 'contact-inexistant');
    expect(result).toBe(false);
  });

  it('referent_eglise ne peut pas acceder a un contact non assigne', async () => {
    mockFindUnique.mockResolvedValue({ campus: 'paris', referent_eglise_id: 'autre-user' });
    const user = { id: 'user-1', role: 'referent_eglise', campus: ['paris'] };
    const result = await peutAccederContact(user, 'contact-1');
    expect(result).toBe(false);
  });

  it('referent_eglise peut acceder au contact dont il est le referent_eglise_id sur son campus', async () => {
    mockFindUnique.mockResolvedValue({ campus: 'paris', referent_eglise_id: 'user-1' });
    const user = { id: 'user-1', role: 'referent_eglise', campus: ['paris'] };
    const result = await peutAccederContact(user, 'contact-1');
    expect(result).toBe(true);
  });

  it('referent_eglise ne peut pas acceder a un contact sur un autre campus meme assigne', async () => {
    mockFindUnique.mockResolvedValue({ campus: 'paris_nord', referent_eglise_id: 'user-1' });
    const user = { id: 'user-1', role: 'referent_eglise', campus: ['paris'] };
    const result = await peutAccederContact(user, 'contact-1');
    expect(result).toBe(false);
  });

  it('referent_integration peut acceder a tous les contacts de son campus', async () => {
    mockFindUnique.mockResolvedValue({ campus: 'paris', referent_eglise_id: null });
    const user = { id: 'user-2', role: 'referent_integration', campus: ['paris'] };
    const result = await peutAccederContact(user, 'contact-2');
    expect(result).toBe(true);
  });

  it('referent_integration ne peut pas acceder a un contact sur un autre campus', async () => {
    mockFindUnique.mockResolvedValue({ campus: 'paris_nord', referent_eglise_id: null });
    const user = { id: 'user-2', role: 'referent_integration', campus: ['paris'] };
    const result = await peutAccederContact(user, 'contact-2');
    expect(result).toBe(false);
  });

  it('lecteur peut lire les contacts de son campus', async () => {
    mockFindUnique.mockResolvedValue({ campus: 'paris_nord', referent_eglise_id: null });
    const user = { id: 'user-3', role: 'lecteur', campus: ['paris_nord'] };
    const result = await peutAccederContact(user, 'contact-3');
    expect(result).toBe(true);
  });

  it('role inconnu est toujours refuse', async () => {
    mockFindUnique.mockResolvedValue({ campus: 'paris', referent_eglise_id: null });
    const user = { id: 'user-x', role: 'inconnu', campus: ['paris'] };
    const result = await peutAccederContact(user, 'contact-x');
    expect(result).toBe(false);
  });
});

describe('filtreContactsParRole', () => {
  it('super_admin retourne un filtre vide (tous les contacts)', () => {
    const user = { id: 'a', role: 'super_admin', campus: ['paris'] };
    expect(filtreContactsParRole(user)).toEqual({});
  });

  it('admin_campus filtre par campus', () => {
    const user = { id: 'a', role: 'admin_campus', campus: ['paris', 'paris_nord'] };
    expect(filtreContactsParRole(user)).toEqual({ campus: { in: ['paris', 'paris_nord'] } });
  });

  it('referent_integration filtre par campus', () => {
    const user = { id: 'a', role: 'referent_integration', campus: ['paris'] };
    expect(filtreContactsParRole(user)).toEqual({ campus: { in: ['paris'] } });
  });

  it('referent_eglise filtre par son id ET son campus', () => {
    const user = { id: 'user-e', role: 'referent_eglise', campus: ['paris'] };
    expect(filtreContactsParRole(user)).toEqual({
      referent_eglise_id: 'user-e',
      campus: { in: ['paris'] },
    });
  });

  it('role inconnu retourne un filtre impossible', () => {
    const user = { id: 'x', role: 'inconnu', campus: [] };
    expect(filtreContactsParRole(user)).toEqual({ id: 'impossible' });
  });
});
