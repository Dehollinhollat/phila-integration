// Tests pour listCommentaires — un referent_integration voit les commentaires
// de tous les referents integration sur un contact (pas seulement les siens),
// pour pouvoir prendre le relais/aider un collegue. L'acces au contact suit le
// meme perimetre que la fiche contact elle-meme (tout le campus).

import { listCommentaires } from '../../controllers/contacts.controller';
import prisma from '../../lib/prisma';

function mockRes() {
  const jsonMock = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return { res: { status: statusMock, json: jsonMock } as never, statusMock, jsonMock };
}

describe('listCommentaires - visibilite des commentaires par role', () => {
  it('referent_integration recoit les commentaires de tous les referents integration (pas que les siens)', async () => {
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue({ campus: 'paris', referent_eglise_id: null });
    (prisma.commentaire.findMany as jest.Mock).mockResolvedValue([]);
    const { res, jsonMock } = mockRes();
    const req = {
      params: { id: 'c1' },
      user: { id: 'ref-1', role: 'referent_integration', campus: ['paris'] },
    } as never;

    await listCommentaires(req, res);

    expect(prisma.commentaire.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { contact_id: 'c1', role_auteur: 'referent_integration' },
    }));
    expect(jsonMock).toHaveBeenCalledWith([]);
  });

  it('referent_integration peut consulter les commentaires d\'un contact de son campus non assigne a lui', async () => {
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue({ campus: 'paris', referent_eglise_id: null });
    (prisma.commentaire.findMany as jest.Mock).mockResolvedValue([]);
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'c1' },
      user: { id: 'ref-1', role: 'referent_integration', campus: ['paris'] },
    } as never;

    await listCommentaires(req, res);

    expect(statusMock).not.toHaveBeenCalledWith(404);
  });

  it('referent_eglise recoit tous les commentaires du contact (pas de filtre par role)', async () => {
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue({ campus: 'paris', referent_eglise_id: 'ref-eglise-1' });
    (prisma.commentaire.findMany as jest.Mock).mockResolvedValue([]);
    const { res } = mockRes();
    const req = {
      params: { id: 'c1' },
      user: { id: 'ref-eglise-1', role: 'referent_eglise', campus: ['paris'] },
    } as never;

    await listCommentaires(req, res);

    expect(prisma.commentaire.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { contact_id: 'c1' },
    }));
  });

  it("refuse (404) si le contact n'est pas dans le perimetre campus de l'appelant", async () => {
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue({ campus: 'orleans', referent_eglise_id: null });
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'c1' },
      user: { id: 'ref-1', role: 'referent_integration', campus: ['paris'] },
    } as never;

    await listCommentaires(req, res);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(prisma.commentaire.findMany).not.toHaveBeenCalled();
  });
});
