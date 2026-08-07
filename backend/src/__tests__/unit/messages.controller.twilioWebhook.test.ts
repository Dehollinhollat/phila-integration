// Tests pour la validation de signature Twilio sur le webhook de statut
// (POST /api/messages/webhook/twilio). Route publique — sans cette
// verification, n'importe qui connaissant un twilio_sid peut falsifier le
// statut de livraison d'un message.

jest.mock('twilio', () => ({
  __esModule: true,
  default: { validateRequest: jest.fn() },
}));

import twilio from 'twilio';
import { twilioWebhook } from '../../controllers/messages.controller';
import prisma from '../../lib/prisma';

const mockValidateRequest = (twilio as unknown as { validateRequest: jest.Mock }).validateRequest;

function mockRes() {
  const sendStatusMock = jest.fn();
  return { res: { sendStatus: sendStatusMock } as never, sendStatusMock };
}

const ORIGINAL_ENV = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_ENV;
  jest.clearAllMocks();
});

describe('twilioWebhook - validation de signature', () => {
  it('en production, refuse (403) une signature invalide et ne touche pas la base', async () => {
    process.env.NODE_ENV = 'production';
    mockValidateRequest.mockReturnValue(false);
    const { res, sendStatusMock } = mockRes();
    const req = {
      headers: { 'x-twilio-signature': 'fausse-signature' },
      body: { MessageSid: 'SM123', MessageStatus: 'delivered' },
    } as never;

    await twilioWebhook(req, res);

    expect(sendStatusMock).toHaveBeenCalledWith(403);
    expect(prisma.message.updateMany).not.toHaveBeenCalled();
  });

  it('en production, accepte une signature valide et met a jour le statut', async () => {
    process.env.NODE_ENV = 'production';
    mockValidateRequest.mockReturnValue(true);
    (prisma.message.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    const { res, sendStatusMock } = mockRes();
    const req = {
      headers: { 'x-twilio-signature': 'vraie-signature' },
      body: { MessageSid: 'SM123', MessageStatus: 'delivered' },
    } as never;

    await twilioWebhook(req, res);

    expect(prisma.message.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { twilio_sid: 'SM123' },
    }));
    expect(sendStatusMock).toHaveBeenCalledWith(204);
  });

  it("hors production (test/dev), n'exige pas de signature", async () => {
    process.env.NODE_ENV = 'test';
    (prisma.message.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    const { res, sendStatusMock } = mockRes();
    const req = {
      headers: {},
      body: { MessageSid: 'SM456', MessageStatus: 'sent' },
    } as never;

    await twilioWebhook(req, res);

    expect(mockValidateRequest).not.toHaveBeenCalled();
    expect(prisma.message.updateMany).toHaveBeenCalled();
    expect(sendStatusMock).toHaveBeenCalledWith(204);
  });
});
