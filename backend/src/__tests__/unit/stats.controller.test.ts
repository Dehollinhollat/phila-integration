// Tests pour la faille de contournement de perimetre campus sur les
// endpoints de stats (inscriptionsParMois, profilsStats, statutsStats) :
// un role non super_admin pouvait lire les stats d'un campus hors de son
// perimetre en passant ?campus=xxx explicitement (le filtre par
// req.user.campus n'etait applique que si AUCUN campus n'etait fourni).

import { inscriptionsParMois, profilsStats, statutsStats } from '../../controllers/stats.controller';
import prisma from '../../lib/prisma';

function mockRes() {
  const jsonMock = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return { res: { status: statusMock, json: jsonMock } as never, statusMock, jsonMock };
}

beforeEach(() => {
  (prisma.contact.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.contact.count as jest.Mock).mockResolvedValue(0);
});

describe('inscriptionsParMois - perimetre campus', () => {
  it('refuse un campus hors du perimetre de l\'appelant', async () => {
    const { res, statusMock } = mockRes();
    const req = {
      query: { campus: 'orleans' },
      user: { id: 'ref-1', role: 'referent_integration', campus: ['paris'] },
    } as never;
    await inscriptionsParMois(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(prisma.contact.findMany).not.toHaveBeenCalled();
  });

  it('autorise un campus dans le perimetre de l\'appelant', async () => {
    const { res, statusMock } = mockRes();
    const req = {
      query: { campus: 'paris' },
      user: { id: 'ref-1', role: 'referent_integration', campus: ['paris'] },
    } as never;
    await inscriptionsParMois(req, res);
    expect(statusMock).not.toHaveBeenCalledWith(403);
    expect(prisma.contact.findMany).toHaveBeenCalled();
  });

  it('super_admin peut demander n\'importe quel campus', async () => {
    const { res, statusMock } = mockRes();
    const req = {
      query: { campus: 'orleans' },
      user: { id: 'admin-1', role: 'super_admin', campus: [] },
    } as never;
    await inscriptionsParMois(req, res);
    expect(statusMock).not.toHaveBeenCalledWith(403);
  });
});

describe('profilsStats - perimetre campus', () => {
  it('refuse un campus hors du perimetre de l\'appelant', async () => {
    const { res, statusMock } = mockRes();
    const req = {
      query: { campus: 'montpellier' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
    } as never;
    await profilsStats(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(prisma.contact.count).not.toHaveBeenCalled();
  });

  it('autorise un campus dans le perimetre de l\'appelant', async () => {
    const { res, statusMock } = mockRes();
    const req = {
      query: { campus: 'paris' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
    } as never;
    await profilsStats(req, res);
    expect(statusMock).not.toHaveBeenCalledWith(403);
  });
});

describe('statutsStats - perimetre campus', () => {
  it('refuse un campus hors du perimetre de l\'appelant', async () => {
    const { res, statusMock } = mockRes();
    const req = {
      query: { campus: 'orleans' },
      user: { id: 'ref-1', role: 'referent_integration', campus: ['paris', 'paris_nord'] },
    } as never;
    await statutsStats(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(prisma.contact.count).not.toHaveBeenCalled();
  });

  it('autorise un campus dans le perimetre de l\'appelant', async () => {
    const { res, statusMock } = mockRes();
    const req = {
      query: { campus: 'paris_nord' },
      user: { id: 'ref-1', role: 'referent_integration', campus: ['paris', 'paris_nord'] },
    } as never;
    await statutsStats(req, res);
    expect(statusMock).not.toHaveBeenCalledWith(403);
  });
});
