// planning.controller.test.ts
// getPlanning/createPlanning/updatePlanning/deletePlanning n'avaient aucun
// controle de perimetre campus, et updatePlanning appliquait { ...req.body }
// sans liste blanche (meme faille que celle deja corrigee sur updateEvenement)
// — trouve lors d'un audit de securite.

import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { getPlanning, createPlanning, updatePlanning, deletePlanning } from '../../controllers/planning.controller';

function mockRes(): { res: Partial<Response>; jsonMock: jest.Mock; statusMock: jest.Mock } {
  const jsonMock   = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return { res: { json: jsonMock, status: statusMock as never }, jsonMock, statusMock };
}

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    params: { id: 'p1' },
    body: {},
    user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
    ...overrides,
  } as unknown as Request;
}

beforeEach(() => jest.clearAllMocks());

describe('getPlanning - perimetre', () => {
  it('403 si le planning appartient a un autre campus', async () => {
    (prisma.planningService.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', campus: 'orleans' });
    const { res, statusMock } = mockRes();
    await getPlanning(mockReq(), res as Response);
    expect(statusMock).toHaveBeenCalledWith(403);
  });

  it('autorise dans le perimetre', async () => {
    (prisma.planningService.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', campus: 'paris' });
    const { res, statusMock } = mockRes();
    await getPlanning(mockReq(), res as Response);
    expect(statusMock).not.toHaveBeenCalledWith(403);
  });
});

describe('createPlanning - perimetre', () => {
  it("403 si le campus demande n'est pas dans le perimetre", async () => {
    const { res, statusMock } = mockRes();
    await createPlanning(
      mockReq({ body: { date_dimanche: '2026-08-16', campus: 'orleans' } } as Partial<Request>),
      res as Response,
    );
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(prisma.planningService.create).not.toHaveBeenCalled();
  });

  it('cree dans le perimetre', async () => {
    (prisma.planningService.create as jest.Mock).mockResolvedValue({ id: 'p-new', campus: 'paris' });
    const { res, statusMock } = mockRes();
    await createPlanning(
      mockReq({ body: { date_dimanche: '2026-08-16', campus: 'paris' } } as Partial<Request>),
      res as Response,
    );
    expect(statusMock).not.toHaveBeenCalledWith(403);
    expect(prisma.planningService.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ campus: 'paris' }),
    }));
  });
});

describe('updatePlanning - perimetre et liste blanche', () => {
  it('404 si introuvable', async () => {
    (prisma.planningService.findUnique as jest.Mock).mockResolvedValue(null);
    const { res, statusMock } = mockRes();
    await updatePlanning(mockReq({ body: { nouveaux_membres: 'x' } } as Partial<Request>), res as Response);
    expect(statusMock).toHaveBeenCalledWith(404);
  });

  it('403 si hors du perimetre', async () => {
    (prisma.planningService.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', campus: 'orleans' });
    const { res, statusMock } = mockRes();
    await updatePlanning(mockReq({ body: { nouveaux_membres: 'x' } } as Partial<Request>), res as Response);
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(prisma.planningService.update).not.toHaveBeenCalled();
  });

  it('ignore campus et created_by envoyes dans le body (liste blanche)', async () => {
    (prisma.planningService.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', campus: 'paris' });
    (prisma.planningService.update as jest.Mock).mockResolvedValue({ id: 'p1' });
    const { res } = mockRes();
    await updatePlanning(
      mockReq({
        body: { nouveaux_membres: 'Jean', campus: 'orleans', created_by: 'quelqu-un-dautre' },
      } as Partial<Request>),
      res as Response,
    );
    const data = (prisma.planningService.update as jest.Mock).mock.calls[0][0].data;
    expect(data.nouveaux_membres).toBe('Jean');
    expect(data).not.toHaveProperty('campus');
    expect(data).not.toHaveProperty('created_by');
  });
});

describe('deletePlanning - perimetre', () => {
  it('403 si hors du perimetre', async () => {
    (prisma.planningService.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', campus: 'orleans' });
    const { res, statusMock } = mockRes();
    await deletePlanning(mockReq(), res as Response);
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(prisma.planningService.delete).not.toHaveBeenCalled();
  });

  it('supprime dans le perimetre', async () => {
    (prisma.planningService.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', campus: 'paris' });
    (prisma.planningService.delete as jest.Mock).mockResolvedValue({});
    const { res, statusMock } = mockRes();
    await deletePlanning(mockReq(), res as Response);
    expect(statusMock).not.toHaveBeenCalledWith(403);
    expect(prisma.planningService.delete).toHaveBeenCalled();
  });
});
