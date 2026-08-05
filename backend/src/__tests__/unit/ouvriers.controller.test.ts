// Tests pour la verification du perimetre campus d'un admin_campus sur
// createOuvrier/updateOuvrier/toggleStatut/deactivateOuvrier/deleteOuvrier (Task B5bis).

import { createOuvrier, updateOuvrier, toggleStatut, deactivateOuvrier, deleteOuvrier, getOuvrier, candidatureOuvrier } from '../../controllers/ouvriers.controller';
import prisma from '../../lib/prisma';

function mockRes() {
  const jsonMock = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return { res: { status: statusMock, json: jsonMock } as never, statusMock, jsonMock };
}

describe('createOuvrier - perimetre campus admin_campus', () => {
  it('refuse la creation directe si le campus demande est hors du perimetre', async () => {
    const { res, statusMock } = mockRes();
    const req = {
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
      body: { prenom: 'Jean', nom: 'Dupont', telephone: '+33612345678', campus: 'orleans', inscription_directe: true },
    } as never;
    await createOuvrier(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
  });
});

describe('updateOuvrier - perimetre campus admin_campus', () => {
  it('refuse la modification si le campus actuel de l\'ouvrier est hors du perimetre', async () => {
    (prisma.ouvrier.findUnique as jest.Mock).mockResolvedValue({ id: 'o1', campus: 'montpellier' });
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'o1' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
      body: { prenom: 'Nouveau nom' },
    } as never;
    await updateOuvrier(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
  });

  it('refuse de deplacer un ouvrier vers un campus hors du perimetre', async () => {
    (prisma.ouvrier.findUnique as jest.Mock).mockResolvedValue({ id: 'o1', campus: 'paris' });
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'o1' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
      body: { campus: 'orleans' },
    } as never;
    await updateOuvrier(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
  });
});

describe('toggleStatut - perimetre campus admin_campus', () => {
  it('refuse le changement de statut sur un ouvrier hors du perimetre', async () => {
    (prisma.ouvrier.findUnique as jest.Mock).mockResolvedValue({ id: 'o1', campus: 'orleans', statut: true });
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'o1' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
      body: {},
    } as never;
    await toggleStatut(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
  });
});

describe('deactivateOuvrier - perimetre campus admin_campus', () => {
  it('refuse la desactivation sur un ouvrier hors du perimetre', async () => {
    (prisma.ouvrier.findUnique as jest.Mock).mockResolvedValue({ id: 'o1', campus: 'montpellier' });
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'o1' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
    } as never;
    await deactivateOuvrier(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
  });
});

describe('deleteOuvrier - perimetre campus admin_campus', () => {
  it('refuse la suppression sur un ouvrier hors du perimetre', async () => {
    (prisma.ouvrier.findUnique as jest.Mock).mockResolvedValue({ id: 'o1', campus: 'orleans' });
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'o1' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
    } as never;
    await deleteOuvrier(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
  });
});

describe('getOuvrier - perimetre campus admin_campus', () => {
  it('refuse la consultation d\'un ouvrier hors du perimetre', async () => {
    (prisma.ouvrier.findUnique as jest.Mock).mockResolvedValue({ id: 'o1', campus: 'montpellier' });
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'o1' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
    } as never;
    await getOuvrier(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
  });
});

describe('updateOuvrier - chemin autorise', () => {
  it('autorise une modification sans toucher au campus, meme si le body ne contient pas campus', async () => {
    (prisma.ouvrier.findUnique as jest.Mock).mockResolvedValue({ id: 'o1', campus: 'paris' });
    (prisma.ouvrier.update as jest.Mock).mockResolvedValue({ id: 'o1', prenom: 'Nouveau', campus: 'paris' });
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'o1' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
      body: { prenom: 'Nouveau' },
    } as never;
    await updateOuvrier(req, res);
    expect(statusMock).not.toHaveBeenCalledWith(403);
    expect(prisma.ouvrier.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { prenom: 'Nouveau' } });
  });
});

describe('super_admin - jamais restreint', () => {
  it('autorise un super_admin a modifier un ouvrier de nimporte quel campus', async () => {
    (prisma.ouvrier.findUnique as jest.Mock).mockResolvedValue({ id: 'o1', campus: 'montpellier' });
    (prisma.ouvrier.update as jest.Mock).mockResolvedValue({ id: 'o1', campus: 'orleans' });
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'o1' },
      user: { id: 'super-1', role: 'super_admin', campus: [] },
      body: { campus: 'orleans' },
    } as never;
    await updateOuvrier(req, res);
    expect(statusMock).not.toHaveBeenCalledWith(403);
  });
});

describe('getOuvrier - perimetre pour les roles non-admin_campus aussi', () => {
  it('refuse un lecteur consultant un ouvrier hors de son perimetre', async () => {
    (prisma.ouvrier.findUnique as jest.Mock).mockResolvedValue({ id: 'o1', campus: 'montpellier' });
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'o1' },
      user: { id: 'lecteur-1', role: 'lecteur', campus: ['paris'] },
    } as never;
    await getOuvrier(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
  });
});

describe('createOuvrier - branche promotion (contact_id)', () => {
  it('refuse la promotion si le campus du contact est hors du perimetre', async () => {
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue({ id: 'c1', campus: 'orleans', statut: 'nouveau' });
    const { res, statusMock } = mockRes();
    const req = {
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
      body: { contact_id: 'c1', prenom: 'Jean', nom: 'Dupont', telephone: '+33612345678', campus: 'orleans' },
    } as never;
    await createOuvrier(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(prisma.ouvrier.findUnique).not.toHaveBeenCalled();
  });
});

describe('candidatureOuvrier - validation du campus', () => {
  it('refuse une candidature avec un campus invalide', async () => {
    const { res, statusMock } = mockRes();
    const req = {
      body: {
        prenom: 'Jean', nom: 'Dupont', telephone: '+33612345678',
        campus: 'lyon', consentement_rgpd: true,
      },
    } as never;
    await candidatureOuvrier(req, res);
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(prisma.ouvrier.findFirst).not.toHaveBeenCalled();
  });

  it('accepte une candidature avec un campus valide (orleans)', async () => {
    (prisma.ouvrier.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.ouvrier.create as jest.Mock).mockResolvedValue({ id: 'o1', campus: 'orleans' });
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
    const { res, statusMock } = mockRes();
    const req = {
      body: {
        prenom: 'Jean', nom: 'Dupont', telephone: '+33612345679',
        campus: 'orleans', consentement_rgpd: true,
      },
    } as never;
    await candidatureOuvrier(req, res);
    expect(statusMock).toHaveBeenCalledWith(201);
    expect(prisma.ouvrier.create).toHaveBeenCalled();
  });
});
