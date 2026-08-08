// messages.controller.sendBienvenue.test.ts
// sendBienvenue (envoi manuel du message de bienvenue) n'avait aucun test —
// couvre le perimetre, les validations metier, et les deux issues (succes/echec
// Twilio) de l'envoi.

import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { sendWhatsApp } from '../../lib/twilio';
import { sendBienvenue } from '../../controllers/messages.controller';

function mockRes(): { res: Partial<Response>; jsonMock: jest.Mock; statusMock: jest.Mock } {
  const jsonMock   = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return { res: { json: jsonMock, status: statusMock as never }, jsonMock, statusMock };
}

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    params: { contactId: 'c1' },
    user: { id: 'admin-1', role: 'super_admin', campus: ['paris'] },
    ...overrides,
  } as unknown as Request;
}

const CONTACT_BASE = {
  id: 'c1', prenom: 'Alice', telephone: '+33600000001', campus: 'paris',
  referent_integration_id: 'ref-1',
};

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.campusSettings.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.user.findUnique as jest.Mock).mockResolvedValue({ prenom: 'Jean', nom: 'Martin', telephone: '+33600000099' });
  (prisma.message.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.message.create as jest.Mock).mockResolvedValue({ id: 'm1' });
  (prisma.contact.update as jest.Mock).mockResolvedValue({});
});

describe('sendBienvenue - perimetre et validations', () => {
  it('403 si le contact est hors du perimetre de l\'appelant', async () => {
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue({ campus: 'orleans', referent_eglise_id: null });
    const { res, statusMock } = mockRes();
    await sendBienvenue(
      mockReq({ user: { id: 'a1', role: 'admin_campus', campus: ['paris'] } } as Partial<Request>),
      res as Response,
    );
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(sendWhatsApp).not.toHaveBeenCalled();
  });

  it('404 si le contact est introuvable', async () => {
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue(null);
    const { res, statusMock } = mockRes();
    await sendBienvenue(mockReq(), res as Response);
    expect(statusMock).toHaveBeenCalledWith(404);
  });

  it("400 si aucun referent integration n'est assigne", async () => {
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue({ ...CONTACT_BASE, referent_integration_id: null });
    const { res, statusMock } = mockRes();
    await sendBienvenue(mockReq(), res as Response);
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(sendWhatsApp).not.toHaveBeenCalled();
  });

  it('409 si un message de bienvenue existe deja', async () => {
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue(CONTACT_BASE);
    (prisma.message.findFirst as jest.Mock).mockResolvedValue({ id: 'm-existant' });
    const { res, statusMock } = mockRes();
    await sendBienvenue(mockReq(), res as Response);
    expect(statusMock).toHaveBeenCalledWith(409);
    expect(sendWhatsApp).not.toHaveBeenCalled();
  });

  it('envoi reussi : cree le message envoye et met a jour derniere_interaction', async () => {
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue(CONTACT_BASE);
    (sendWhatsApp as jest.Mock).mockResolvedValue({ sid: 'SM_ok' });
    const { res, statusMock } = mockRes();

    await sendBienvenue(mockReq(), res as Response);

    expect(prisma.message.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ contact_id: 'c1', type: 'bienvenue', statut: 'envoye', twilio_sid: 'SM_ok' }),
    }));
    expect(prisma.contact.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data:  expect.objectContaining({ derniere_interaction: expect.any(Date) }),
    });
    expect(statusMock).toHaveBeenCalledWith(201);
  });

  it("echec Twilio : cree le message en echec, ne met PAS a jour derniere_interaction", async () => {
    (prisma.contact.findUnique as jest.Mock).mockResolvedValue(CONTACT_BASE);
    (sendWhatsApp as jest.Mock).mockResolvedValue({ error: 'Numero invalide' });
    const { res } = mockRes();

    await sendBienvenue(mockReq(), res as Response);

    expect(prisma.message.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ statut: 'echoue', twilio_sid: null, envoye_le: null }),
    }));
    expect(prisma.contact.update).not.toHaveBeenCalled();
  });
});
