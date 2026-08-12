// checklist.controller.test.ts
// listChecklist et updateChecklistItem n'avaient aucun controle de perimetre —
// trouve lors d'un audit de securite. N'importe quel referent_integration
// pouvait lire/cocher la checklist de n'importe quel contact, y compris
// declencher le passage automatique au statut "integre".

import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { listChecklist, updateChecklistItem } from '../../controllers/checklist.controller';

function mockRes(): { res: Partial<Response>; jsonMock: jest.Mock; statusMock: jest.Mock } {
  const jsonMock   = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return { res: { json: jsonMock, status: statusMock as never }, jsonMock, statusMock };
}

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    params: {},
    body: {},
    user: { id: 'ref-1', role: 'referent_integration', campus: ['paris'] },
    ...overrides,
  } as unknown as Request;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('listChecklist - perimetre', () => {
  it('404 si le contact est hors du perimetre (campus different)', async () => {
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue({ campus: 'orleans', referent_eglise_id: null });
    const { res, statusMock } = mockRes();
    await listChecklist(mockReq({ params: { contactId: 'c1' } } as Partial<Request>), res as Response);
    expect(statusMock).toHaveBeenCalledWith(404);
    expect(prisma.checklistItem.findMany).not.toHaveBeenCalled();
  });

  it('autorise dans le perimetre', async () => {
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue({ campus: 'paris', referent_eglise_id: null });
    (prisma.checklistItem.findMany as jest.Mock).mockResolvedValue([]);
    const { res, statusMock } = mockRes();
    await listChecklist(mockReq({ params: { contactId: 'c1' } } as Partial<Request>), res as Response);
    expect(statusMock).not.toHaveBeenCalledWith(404);
    expect(prisma.checklistItem.findMany).toHaveBeenCalled();
  });
});

describe('updateChecklistItem - perimetre', () => {
  it("403 si le contact de l'etape est hors du perimetre", async () => {
    (prisma.checklistItem.findUnique as jest.Mock).mockResolvedValue({
      id: 'item-1', contact_id: 'c1', commentaire: null, etape: 'premier_appel_effectue',
    });
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue({ campus: 'orleans', referent_eglise_id: null });
    const { res, statusMock } = mockRes();
    await updateChecklistItem(
      mockReq({ params: { id: 'item-1' }, body: { complete: true } } as Partial<Request>),
      res as Response,
    );
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(prisma.checklistItem.update).not.toHaveBeenCalled();
  });

  it('autorise et coche une etape normale (hors integration_confirmee) dans le perimetre', async () => {
    (prisma.checklistItem.findUnique as jest.Mock).mockResolvedValue({
      id: 'item-1', contact_id: 'c1', commentaire: null, etape: 'premier_appel_effectue',
    });
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue({ campus: 'paris', referent_eglise_id: null });
    (prisma.checklistItem.update as jest.Mock).mockResolvedValue({ id: 'item-1', complete: true });
    const { res, statusMock } = mockRes();
    await updateChecklistItem(
      mockReq({ params: { id: 'item-1' }, body: { complete: true } } as Partial<Request>),
      res as Response,
    );
    expect(statusMock).not.toHaveBeenCalledWith(403);
    expect(prisma.checklistItem.update).toHaveBeenCalled();
  });

  it("404 si l'etape elle-meme n'existe pas (verifie avant le controle de perimetre)", async () => {
    (prisma.checklistItem.findUnique as jest.Mock).mockResolvedValue(null);
    const { res, statusMock } = mockRes();
    await updateChecklistItem(
      mockReq({ params: { id: 'item-inconnu' }, body: { complete: true } } as Partial<Request>),
      res as Response,
    );
    expect(statusMock).toHaveBeenCalledWith(404);
    expect(prisma.contact.findUnique).not.toHaveBeenCalled();
  });
});
