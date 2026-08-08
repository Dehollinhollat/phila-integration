// messages.controller.listMessages.test.ts
// listMessages n'avait aucun test — couvre le scoping par role/campus, les
// filtres type/statut, et la pagination.

import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { listMessages } from '../../controllers/messages.controller';

function mockRes(): { res: Partial<Response>; jsonMock: jest.Mock } {
  const jsonMock = jest.fn();
  return { res: { json: jsonMock } as never, jsonMock };
}

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.message.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.message.count as jest.Mock).mockResolvedValue(0);
});

describe('listMessages - scoping par role', () => {
  it('non super_admin : toujours filtre a son propre campus, meme sans ?campus=', async () => {
    const { res } = mockRes();
    const req = { query: {}, user: { id: 'a1', role: 'admin_campus', campus: ['paris'] } } as unknown as Request;
    await listMessages(req, res as Response);
    const where = (prisma.message.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.contact).toEqual({ campus: { in: ['paris'] } });
  });

  it('super_admin sans ?campus= ne filtre pas par contact', async () => {
    const { res } = mockRes();
    const req = { query: {}, user: { id: 'a1', role: 'super_admin', campus: [] } } as unknown as Request;
    await listMessages(req, res as Response);
    const where = (prisma.message.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.contact).toBeUndefined();
  });

  it('super_admin avec ?campus= filtre sur ce campus precis', async () => {
    const { res } = mockRes();
    const req = { query: { campus: 'orleans' }, user: { id: 'a1', role: 'super_admin', campus: [] } } as unknown as Request;
    await listMessages(req, res as Response);
    const where = (prisma.message.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.contact).toEqual({ campus: 'orleans' });
  });
});

describe('listMessages - filtres type/statut et pagination', () => {
  it('applique type et statut au where', async () => {
    const { res } = mockRes();
    const req = {
      query: { type: 'bienvenue', statut: 'envoye' },
      user: { id: 'a1', role: 'super_admin', campus: [] },
    } as unknown as Request;
    await listMessages(req, res as Response);
    const where = (prisma.message.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.type).toBe('bienvenue');
    expect(where.statut).toBe('envoye');
  });

  it('page/limit se traduisent en skip/take corrects', async () => {
    const { res } = mockRes();
    const req = {
      query: { page: '3', limit: '20' },
      user: { id: 'a1', role: 'super_admin', campus: [] },
    } as unknown as Request;
    await listMessages(req, res as Response);
    const call = (prisma.message.findMany as jest.Mock).mock.calls[0][0];
    expect(call.skip).toBe(40); // (3-1) * 20
    expect(call.take).toBe(20);
  });

  it('retourne { messages, total } depuis la reponse', async () => {
    (prisma.message.findMany as jest.Mock).mockResolvedValue([{ id: 'm1' }]);
    (prisma.message.count as jest.Mock).mockResolvedValue(1);
    const { res, jsonMock } = mockRes();
    const req = { query: {}, user: { id: 'a1', role: 'super_admin', campus: [] } } as unknown as Request;
    await listMessages(req, res as Response);
    expect(jsonMock).toHaveBeenCalledWith({ messages: [{ id: 'm1' }], total: 1 });
  });
});
