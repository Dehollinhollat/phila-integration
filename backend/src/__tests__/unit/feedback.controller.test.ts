// Tests pour getFeedbacks — le perimetre campus doit filtrer les feedbacks comme
// pour stats/messages/evenements : un admin_campus/referent ne doit voir que les
// reponses des contacts de son propre campus, jamais celles des autres.

import { getFeedbacks } from '../../controllers/feedback.controller';
import prisma from '../../lib/prisma';

function mockRes() {
  const jsonMock = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return { res: { status: statusMock, json: jsonMock } as never, statusMock, jsonMock };
}

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.feedback.findMany as jest.Mock).mockResolvedValue([]);
});

describe('getFeedbacks - perimetre campus', () => {
  it('super_admin recoit les feedbacks sans filtre de perimetre', async () => {
    const { res } = mockRes();
    const req = { user: { id: 'u1', role: 'super_admin', campus: [] } } as never;

    await getFeedbacks(req, res);

    expect(prisma.contact.findMany).not.toHaveBeenCalled();
    expect(prisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('admin_campus ne recoit que les feedbacks des contacts de son campus', async () => {
    (prisma.contact.findMany as jest.Mock).mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
    const { res } = mockRes();
    const req = { user: { id: 'u1', role: 'admin_campus', campus: ['paris'] } } as never;

    await getFeedbacks(req, res);

    expect(prisma.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { campus: { in: ['paris'] } } }),
    );
    expect(prisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { contact_id: { in: ['c1', 'c2'] } } }),
    );
  });

  it('referent_integration est aussi limite a son campus', async () => {
    (prisma.contact.findMany as jest.Mock).mockResolvedValue([{ id: 'c1' }]);
    const { res } = mockRes();
    const req = { user: { id: 'u1', role: 'referent_integration', campus: ['orleans'] } } as never;

    await getFeedbacks(req, res);

    expect(prisma.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { campus: { in: ['orleans'] } } }),
    );
  });
});
