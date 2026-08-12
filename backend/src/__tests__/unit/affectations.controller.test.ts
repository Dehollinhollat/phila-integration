// affectations.controller.test.ts
// respondToAffectation etait ouvert a tout utilisateur connecte SANS jamais
// verifier qu'il etait bien l'ouvrier concerne (IDOR pur) ; listAffectations/
// createAffectation/deleteAffectation n'avaient aucun controle de perimetre
// campus. Trouve lors d'un audit de securite.

import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import {
  listAffectations, createAffectation, respondToAffectation, deleteAffectation,
} from '../../controllers/affectations.controller';

function mockRes(): { res: Partial<Response>; jsonMock: jest.Mock; statusMock: jest.Mock } {
  const jsonMock   = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return { res: { json: jsonMock, status: statusMock as never }, jsonMock, statusMock };
}

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    params: {}, query: {}, body: {},
    user: { id: 'u1', role: 'lecteur', campus: ['paris'], email: 'moi@test.fr' },
    ...overrides,
  } as unknown as Request;
}

beforeEach(() => jest.clearAllMocks());

describe('listAffectations - perimetre', () => {
  it('403 si le planning est hors du perimetre', async () => {
    (prisma.planningService.findUnique as jest.Mock).mockResolvedValue({ id: 'pl1', campus: 'orleans' });
    const { res, statusMock } = mockRes();
    await listAffectations(mockReq({ query: { planning_id: 'pl1' } } as Partial<Request>), res as Response);
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(prisma.affectationPlanning.findMany).not.toHaveBeenCalled();
  });

  it('autorise dans le perimetre', async () => {
    (prisma.planningService.findUnique as jest.Mock).mockResolvedValue({ id: 'pl1', campus: 'paris' });
    (prisma.affectationPlanning.findMany as jest.Mock).mockResolvedValue([]);
    const { res, statusMock } = mockRes();
    await listAffectations(mockReq({ query: { planning_id: 'pl1' } } as Partial<Request>), res as Response);
    expect(statusMock).not.toHaveBeenCalledWith(403);
  });
});

describe('createAffectation - perimetre', () => {
  it('403 si le planning est hors du perimetre', async () => {
    (prisma.planningService.findUnique as jest.Mock).mockResolvedValue({ id: 'pl1', campus: 'orleans' });
    (prisma.ouvrier.findUnique as jest.Mock).mockResolvedValue({ id: 'o1', statut: true });
    const { res, statusMock } = mockRes();
    await createAffectation(
      mockReq({
        user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
        body: { planning_id: 'pl1', ouvrier_id: 'o1', role_service: 'service_salle' },
      } as Partial<Request>),
      res as Response,
    );
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(prisma.affectationPlanning.create).not.toHaveBeenCalled();
  });
});

describe('respondToAffectation - IDOR', () => {
  it("403 si l'appelant n'est ni l'ouvrier concerne ni un admin de son perimetre", async () => {
    (prisma.affectationPlanning.findUnique as jest.Mock).mockResolvedValue({
      id: 'aff1',
      ouvrier: { email: 'ouvrier-concerne@test.fr' },
      planning: { campus: 'paris' },
    });
    const { res, statusMock } = mockRes();
    // Appelant : simple lecteur, email different, meme campus que le planning
    await respondToAffectation(
      mockReq({ params: { id: 'aff1' }, body: { statut: 'decline' } } as Partial<Request>),
      res as Response,
    );
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(prisma.affectationPlanning.update).not.toHaveBeenCalled();
  });

  it("autorise l'ouvrier concerne (email correspondant)", async () => {
    (prisma.affectationPlanning.findUnique as jest.Mock).mockResolvedValue({
      id: 'aff1',
      ouvrier: { email: 'moi@test.fr' },
      planning: { campus: 'paris' },
    });
    (prisma.affectationPlanning.update as jest.Mock).mockResolvedValue({ id: 'aff1' });
    const { res, statusMock } = mockRes();
    await respondToAffectation(
      mockReq({ params: { id: 'aff1' }, body: { statut: 'accepte' } } as Partial<Request>),
      res as Response,
    );
    expect(statusMock).not.toHaveBeenCalledWith(403);
    expect(prisma.affectationPlanning.update).toHaveBeenCalled();
  });

  it('autorise un admin_campus dans le perimetre du planning, meme sans etre l\'ouvrier', async () => {
    (prisma.affectationPlanning.findUnique as jest.Mock).mockResolvedValue({
      id: 'aff1',
      ouvrier: { email: 'autre-personne@test.fr' },
      planning: { campus: 'paris' },
    });
    (prisma.affectationPlanning.update as jest.Mock).mockResolvedValue({ id: 'aff1' });
    const { res, statusMock } = mockRes();
    await respondToAffectation(
      mockReq({
        params: { id: 'aff1' },
        body: { statut: 'accepte' },
        user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'], email: 'admin@test.fr' },
      } as Partial<Request>),
      res as Response,
    );
    expect(statusMock).not.toHaveBeenCalledWith(403);
  });

  it("refuse un admin_campus d'un AUTRE campus que celui du planning", async () => {
    (prisma.affectationPlanning.findUnique as jest.Mock).mockResolvedValue({
      id: 'aff1',
      ouvrier: { email: 'autre-personne@test.fr' },
      planning: { campus: 'orleans' },
    });
    const { res, statusMock } = mockRes();
    await respondToAffectation(
      mockReq({
        params: { id: 'aff1' },
        body: { statut: 'accepte' },
        user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'], email: 'admin@test.fr' },
      } as Partial<Request>),
      res as Response,
    );
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(prisma.affectationPlanning.update).not.toHaveBeenCalled();
  });
});

describe('deleteAffectation - perimetre', () => {
  it('403 si hors du perimetre', async () => {
    (prisma.affectationPlanning.findUnique as jest.Mock).mockResolvedValue({
      id: 'aff1', planning: { campus: 'orleans' },
    });
    const { res, statusMock } = mockRes();
    await deleteAffectation(
      mockReq({ params: { id: 'aff1' }, user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] } } as unknown as Partial<Request>),
      res as Response,
    );
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(prisma.affectationPlanning.delete).not.toHaveBeenCalled();
  });

  it('supprime dans le perimetre', async () => {
    (prisma.affectationPlanning.findUnique as jest.Mock).mockResolvedValue({
      id: 'aff1', planning: { campus: 'paris' },
    });
    (prisma.affectationPlanning.delete as jest.Mock).mockResolvedValue({});
    const { res, statusMock } = mockRes();
    await deleteAffectation(
      mockReq({ params: { id: 'aff1' }, user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] } } as unknown as Partial<Request>),
      res as Response,
    );
    expect(statusMock).not.toHaveBeenCalledWith(403);
    expect(prisma.affectationPlanning.delete).toHaveBeenCalled();
  });
});
