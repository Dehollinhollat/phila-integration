// referents.controller.test.ts
// Aucun de ces endpoints (assignation individuelle + reassignation en masse) ne
// verifiait le perimetre campus — trouve lors d'un audit de securite. Un
// admin_campus pouvait assigner/reassigner des contacts d'un AUTRE campus, ou
// leur assigner un referent d'un autre campus.

import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import {
  assignReferentIntegration, removeReferentIntegration,
  assignReferentEglise, removeReferentEglise,
  reassignerContacts,
} from '../../controllers/referents.controller';

function mockRes(): { res: Partial<Response>; jsonMock: jest.Mock; statusMock: jest.Mock } {
  const jsonMock   = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return { res: { json: jsonMock, status: statusMock as never }, jsonMock, statusMock };
}

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    params: { contactId: 'c1' },
    user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
    body: {},
    ...overrides,
  } as unknown as Request;
}

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.notification.create as jest.Mock).mockResolvedValue({});
  (prisma.$transaction as jest.Mock).mockImplementation((ops: unknown[]) => Promise.all(ops));
});

describe('assignReferentIntegration - perimetre', () => {
  it('403 si le contact est hors du perimetre', async () => {
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue({ campus: 'orleans', referent_eglise_id: null });
    const { res, statusMock } = mockRes();
    await assignReferentIntegration(mockReq({ body: { referentId: 'r1' } } as Partial<Request>), res as Response);
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(prisma.contact.update).not.toHaveBeenCalled();
  });

  it('403 si le referent est hors du perimetre (contact ok, referent autre campus)', async () => {
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue({
      id: 'c1', campus: 'paris', referent_eglise_id: null, prenom: 'A', nom: 'B', date_attribution_referent: null,
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'r1', actif: true, campus: ['orleans'] });
    const { res, statusMock } = mockRes();
    await assignReferentIntegration(mockReq({ body: { referentId: 'r1' } } as Partial<Request>), res as Response);
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(prisma.contact.update).not.toHaveBeenCalled();
  });

  it('autorise quand contact et referent sont tous deux dans le perimetre', async () => {
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue({
      id: 'c1', campus: 'paris', referent_eglise_id: null, prenom: 'A', nom: 'B', date_attribution_referent: null,
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'r1', actif: true, campus: ['paris'] });
    (prisma.contact.update as jest.Mock).mockResolvedValue({ id: 'c1' });
    const { res, statusMock } = mockRes();
    await assignReferentIntegration(mockReq({ body: { referentId: 'r1' } } as Partial<Request>), res as Response);
    expect(statusMock).not.toHaveBeenCalledWith(403);
    expect(prisma.contact.update).toHaveBeenCalled();
  });

  it('super_admin peut assigner un referent de n\'importe quel campus', async () => {
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue({
      id: 'c1', campus: 'orleans', referent_eglise_id: null, prenom: 'A', nom: 'B', date_attribution_referent: null,
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'r1', actif: true, campus: ['montpellier'] });
    (prisma.contact.update as jest.Mock).mockResolvedValue({ id: 'c1' });
    const { res, statusMock } = mockRes();
    await assignReferentIntegration(
      mockReq({ body: { referentId: 'r1' }, user: { id: 'sa', role: 'super_admin', campus: [] } } as unknown as Partial<Request>),
      res as Response,
    );
    expect(statusMock).not.toHaveBeenCalledWith(403);
  });
});

describe('removeReferentIntegration / removeReferentEglise - perimetre', () => {
  it('removeReferentIntegration : 404 si le contact est hors du perimetre', async () => {
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue({ campus: 'orleans', referent_eglise_id: null });
    const { res, statusMock } = mockRes();
    await removeReferentIntegration(mockReq(), res as Response);
    expect(statusMock).toHaveBeenCalledWith(404);
    expect(prisma.contact.update).not.toHaveBeenCalled();
  });

  it('removeReferentEglise : 404 si le contact est hors du perimetre', async () => {
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue({ campus: 'orleans', referent_eglise_id: null });
    const { res, statusMock } = mockRes();
    await removeReferentEglise(mockReq(), res as Response);
    expect(statusMock).toHaveBeenCalledWith(404);
    expect(prisma.contact.update).not.toHaveBeenCalled();
  });

  it('removeReferentIntegration : autorise dans le perimetre', async () => {
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue({ campus: 'paris', referent_eglise_id: null });
    (prisma.contact.update as jest.Mock).mockResolvedValue({ id: 'c1' });
    const { res, statusMock } = mockRes();
    await removeReferentIntegration(mockReq(), res as Response);
    expect(statusMock).not.toHaveBeenCalledWith(404);
    expect(prisma.contact.update).toHaveBeenCalled();
  });
});

describe('assignReferentEglise - perimetre', () => {
  it('403 si le referent est hors du perimetre', async () => {
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue({ id: 'c1', campus: 'paris', referent_eglise_id: null });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'r1', actif: true, campus: ['orleans'] });
    const { res, statusMock } = mockRes();
    await assignReferentEglise(mockReq({ body: { referentId: 'r1' } } as Partial<Request>), res as Response);
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(prisma.contact.update).not.toHaveBeenCalled();
  });
});

describe('reassignerContacts - perimetre (reassignation en masse)', () => {
  it('403 si le nouveau referent est hors du perimetre', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'r1', actif: true, campus: ['orleans'] });
    const { res, statusMock } = mockRes();
    await reassignerContacts(
      mockReq({ body: { contact_ids: ['c1', 'c2'], nouveau_referent_id: 'r1', type: 'integration' } } as Partial<Request>),
      res as Response,
    );
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(prisma.contact.updateMany).not.toHaveBeenCalled();
  });

  it('403 si un des contacts est hors du perimetre, meme si le referent est valide', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'r1', actif: true, campus: ['paris'] });
    (prisma.contact.count as jest.Mock).mockResolvedValue(1); // 1 contact hors perimetre
    const { res, statusMock } = mockRes();
    await reassignerContacts(
      mockReq({ body: { contact_ids: ['c1', 'c2'], nouveau_referent_id: 'r1', type: 'integration' } } as Partial<Request>),
      res as Response,
    );
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(prisma.contact.updateMany).not.toHaveBeenCalled();
  });

  it('autorise et reassigne quand tout est dans le perimetre', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'r1', actif: true, campus: ['paris'] });
    (prisma.contact.count as jest.Mock).mockResolvedValue(0);
    (prisma.contact.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
    const { res, statusMock, jsonMock } = mockRes();
    await reassignerContacts(
      mockReq({ body: { contact_ids: ['c1', 'c2'], nouveau_referent_id: 'r1', type: 'integration' } } as Partial<Request>),
      res as Response,
    );
    expect(statusMock).not.toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith({ reassigned: 2 });
  });

  it('super_admin peut reassigner sans verification de perimetre sur les contacts', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'r1', actif: true, campus: ['orleans'] });
    (prisma.contact.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
    const { res, statusMock } = mockRes();
    await reassignerContacts(
      mockReq({
        body: { contact_ids: ['c1', 'c2'], nouveau_referent_id: 'r1', type: 'integration' },
        user: { id: 'sa', role: 'super_admin', campus: [] },
      } as unknown as Partial<Request>),
      res as Response,
    );
    expect(statusMock).not.toHaveBeenCalledWith(403);
    expect(prisma.contact.count).not.toHaveBeenCalled();
  });
});
