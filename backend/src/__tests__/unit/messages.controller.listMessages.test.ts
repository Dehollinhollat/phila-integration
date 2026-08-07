// Tests pour listMessages — un referent_integration ne doit voir que les
// messages lies a sa propre liste de contacts assignes, pas tout le campus
// (cf. authorization.ts::filtreContactsParRole).

import { listMessages } from '../../controllers/messages.controller';
import prisma from '../../lib/prisma';

function mockRes() {
  const jsonMock = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return { res: { status: statusMock, json: jsonMock } as never, statusMock, jsonMock };
}

describe('listMessages - perimetre par role', () => {
  beforeEach(() => {
    (prisma.message.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.message.count as jest.Mock).mockResolvedValue(0);
  });

  it('referent_integration ne voit que les messages de ses propres contacts assignes', async () => {
    const { res } = mockRes();
    const req = {
      query: {},
      user: { id: 'ref-1', role: 'referent_integration', campus: ['paris'] },
    } as never;

    await listMessages(req, res);

    expect(prisma.message.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { contact: { referent_integration_id: 'ref-1', campus: { in: ['paris'] } } },
    }));
  });

  it('admin_campus voit tous les messages de son campus (pas de filtre par referent)', async () => {
    const { res } = mockRes();
    const req = {
      query: {},
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
    } as never;

    await listMessages(req, res);

    expect(prisma.message.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { contact: { campus: { in: ['paris'] } } },
    }));
  });
});
