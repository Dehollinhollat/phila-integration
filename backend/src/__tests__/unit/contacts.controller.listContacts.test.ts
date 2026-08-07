// Tests pour listContacts — le filtre ?mesContacts=true restreint la page
// "Contacts" aux contacts assignes au referent_integration appelant, sans
// affecter les autres roles ni le Tableau de bord (qui n'envoie pas ce filtre).

import { listContacts } from '../../controllers/contacts.controller';
import prisma from '../../lib/prisma';
import { cache } from '../../lib/cache';

function mockRes() {
  const jsonMock = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return { res: { status: statusMock, json: jsonMock } as never, statusMock, jsonMock };
}

describe('listContacts - filtre mesContacts', () => {
  beforeEach(() => {
    cache.flushAll();
    (prisma.contact.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.contact.count as jest.Mock).mockResolvedValue(0);
  });

  it('referent_integration + mesContacts=true : filtre par referent_integration_id', async () => {
    const { res } = mockRes();
    const req = {
      query: { mesContacts: 'true' },
      user: { id: 'ref-1', role: 'referent_integration', campus: ['paris'] },
    } as never;

    await listContacts(req, res);

    expect(prisma.contact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ referent_integration_id: 'ref-1' }),
    }));
  });

  it('referent_integration sans mesContacts (Tableau de bord) : voit tout le campus', async () => {
    const { res } = mockRes();
    const req = {
      query: {},
      user: { id: 'ref-1', role: 'referent_integration', campus: ['paris'] },
    } as never;

    await listContacts(req, res);

    expect(prisma.contact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { campus: { in: ['paris'] } },
    }));
  });

  it('mesContacts=true est sans effet pour admin_campus', async () => {
    const { res } = mockRes();
    const req = {
      query: { mesContacts: 'true' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
    } as never;

    await listContacts(req, res);

    expect(prisma.contact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { campus: { in: ['paris'] } },
    }));
  });
});
