// Tests pour listCommentaires — un referent_integration ne doit voir que ses
// propres commentaires, pas ceux des autres referents integration sur le meme
// contact (cf. commentaire dans schema.prisma sur le modele Commentaire).

import { listCommentaires } from '../../controllers/contacts.controller';
import prisma from '../../lib/prisma';

function mockRes() {
  const jsonMock = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return { res: { status: statusMock, json: jsonMock } as never, statusMock, jsonMock };
}

describe('listCommentaires - visibilite des commentaires par role', () => {
  it('referent_integration ne recoit que ses propres commentaires (auteur_id = lui-meme)', async () => {
    (prisma.contact.findFirst as jest.Mock).mockResolvedValue({ id: 'c1' });
    (prisma.commentaire.findMany as jest.Mock).mockResolvedValue([]);
    const { res, jsonMock } = mockRes();
    const req = {
      params: { id: 'c1' },
      user: { id: 'ref-1', role: 'referent_integration', campus: ['paris'] },
    } as never;

    await listCommentaires(req, res);

    expect(prisma.commentaire.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { contact_id: 'c1', auteur_id: 'ref-1' },
    }));
    expect(jsonMock).toHaveBeenCalledWith([]);
  });

  it('referent_eglise recoit tous les commentaires du contact (pas de filtre auteur)', async () => {
    (prisma.contact.findFirst as jest.Mock).mockResolvedValue({ id: 'c1' });
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

  it("refuse (404) si le contact n'est pas dans le perimetre de l'appelant", async () => {
    (prisma.contact.findFirst as jest.Mock).mockResolvedValue(null);
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
