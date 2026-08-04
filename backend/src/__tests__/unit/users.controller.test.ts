// Tests pour la verification du perimetre campus d'un admin_campus sur
// createUser/updateUser (Task B3bis).

import { createUser, updateUser, resetPassword, toggleStatut } from '../../controllers/users.controller';
import prisma from '../../lib/prisma';

function mockRes() {
  const jsonMock = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return { res: { status: statusMock, json: jsonMock } as never, statusMock, jsonMock };
}

describe('createUser - perimetre campus admin_campus', () => {
  it('refuse la creation si un campus demande est hors du perimetre de l\'admin_campus', async () => {
    const { res, statusMock } = mockRes();
    const req = {
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
      body: { prenom: 'Jean', nom: 'Dupont', email: 'jean@test.fr', role: 'lecteur', campus: ['paris', 'orleans'] },
    } as never;
    await createUser(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
  });

  it('autorise la creation si tous les campus demandes sont dans le perimetre', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue({ id: 'u1', email: 'jean@test.fr', prenom: 'Jean', role: 'lecteur' });
    const { res, statusMock } = mockRes();
    const req = {
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris', 'paris_nord'] },
      body: { prenom: 'Jean', nom: 'Dupont', email: 'jean@test.fr', role: 'lecteur', campus: ['paris'] },
    } as never;
    await createUser(req, res);
    expect(statusMock).not.toHaveBeenCalledWith(403);
  });
});

describe('updateUser - perimetre campus admin_campus', () => {
  it('refuse la modification si un campus demande est hors du perimetre', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'lecteur', campus: ['paris'] });
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'u1' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
      body: { campus: ['montpellier'] },
    } as never;
    await updateUser(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
  });

  it('autorise la resauvegarde d\'un tableau de campus inchange meme s\'il contient un campus hors du perimetre', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'lecteur', campus: ['paris', 'montpellier'] });
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'u1', email: 'jean@test.fr', prenom: 'Jean', role: 'lecteur', campus: ['paris', 'montpellier'] });
    (prisma.auditLog.create as jest.Mock).mockResolvedValue({});
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'u1' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
      body: { campus: ['paris', 'montpellier'] },
    } as never;
    await updateUser(req, res);
    expect(statusMock).not.toHaveBeenCalledWith(403);
  });

  it('refuse le retrait d\'un campus hors du perimetre de l\'admin_campus', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'lecteur', campus: ['paris', 'montpellier'] });
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'u1' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
      body: { campus: ['paris'] },
    } as never;
    await updateUser(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
  });

  it('refuse la modification d\'un compte hors du perimetre meme sans champ campus/role dans le body', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'lecteur', campus: ['orleans'] });
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'u1' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
      body: { prenom: 'Hacked' },
    } as never;
    await updateUser(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('resetPassword - perimetre admin_campus', () => {
  it('refuse la reinitialisation sur un super_admin cible', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'super_admin', campus: ['paris'] });
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'target-1' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
      body: { password: 'motdepasse123' },
    } as never;
    await resetPassword(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
  });

  it('refuse la reinitialisation sur un compte hors du perimetre campus', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'lecteur', campus: ['orleans'] });
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'target-1' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
      body: { password: 'motdepasse123' },
    } as never;
    await resetPassword(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
  });

  it('autorise la reinitialisation sur un compte du meme perimetre', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'lecteur', campus: ['paris'] });
    (prisma.user.update as jest.Mock).mockResolvedValue({});
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'target-1' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
      body: { password: 'motdepasse123' },
    } as never;
    await resetPassword(req, res);
    expect(statusMock).not.toHaveBeenCalledWith(403);
  });
});

describe('toggleStatut - perimetre admin_campus', () => {
  it('refuse le changement de statut sur un compte hors du perimetre campus', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ actif: true, role: 'lecteur', campus: ['montpellier'] });
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'target-1' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
    } as never;
    await toggleStatut(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
  });

  it('autorise le changement de statut sur un compte du meme perimetre', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ actif: true, role: 'lecteur', campus: ['paris'] });
    (prisma.user.update as jest.Mock).mockResolvedValue({});
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'target-1' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
    } as never;
    await toggleStatut(req, res);
    expect(statusMock).not.toHaveBeenCalledWith(403);
  });
});
