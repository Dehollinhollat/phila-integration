// messages.controller.test.ts
// Test unitaire ciblé sur un bug de fuite de campus dans createEvenement (Task D8).
// Quand dest_type='tous', filtres.campus (contacts) et filtres_ouvriers.campus (ouvriers)
// peuvent cibler des campus DIFFERENTS dans un seul envoi. Le message envoyé à chaque
// audience doit utiliser l'adresse de SON propre campus, jamais celle de l'autre.

import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { sendWhatsAppBulk } from '../../lib/twilio';
import { createEvenement } from '../../controllers/messages.controller';

function mockRes(): { res: Partial<Response>; jsonMock: jest.Mock; statusMock: jest.Mock } {
  const jsonMock   = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return { res: { json: jsonMock, status: statusMock as never }, jsonMock, statusMock };
}

describe('createEvenement - resolution independante du campus (contacts vs ouvriers)', () => {
  it("n'envoie pas l'adresse d'un campus aux destinataires de l'autre quand dest_type='tous'", async () => {
    (prisma.evenement.create as jest.Mock).mockResolvedValue({ id: 'ev-1' });

    // Adresses distinctes par campus — simule prisma.campusSettings.findMany
    // (getCampusSettingsWithDefaults lit via ce mock).
    (prisma.campusSettings.findMany as jest.Mock).mockImplementation(
      async ({ where }: { where: { campus: string } }) => {
        if (where.campus === 'orleans') {
          return [{ campus: 'orleans', key: 'adresse_eglise', value: '1 rue de la Loire' }];
        }
        if (where.campus === 'montpellier') {
          return [{ campus: 'montpellier', key: 'adresse_eglise', value: '2 rue de Montpellier' }];
        }
        return [];
      }
    );

    (prisma.contact.findMany as jest.Mock).mockResolvedValue([
      { id: 'c1', prenom: 'Alice', telephone: '+33600000001' },
    ]);
    (prisma.ouvrier.findMany as jest.Mock).mockResolvedValue([
      { id: 'o1', prenom: 'Bob', telephone: '+33600000002' },
    ]);

    (sendWhatsAppBulk as jest.Mock)
      .mockResolvedValueOnce([{ id: 'c1', sid: 'SM_contacts' }])
      .mockResolvedValueOnce([{ id: 'o1', sid: 'SM_ouvriers' }]);

    (prisma.message.createMany as jest.Mock).mockResolvedValue({ count: 1 });

    const { res } = mockRes();
    const req = {
      user: { id: 'admin-1', role: 'super_admin', campus: ['paris'] },
      body: {
        titre:              'Reunion speciale',
        message_template:   'Rendez-vous [Campus] a [Adresse] le [Date]',
        date_evenement:     '2026-09-01',
        envoyer_maintenant: true,
        dest_type:          'tous',
        filtres:            { campus: 'orleans' },
        filtres_ouvriers:   { campus: 'montpellier' },
      },
    } as unknown as Request;

    await createEvenement(req, res as Response);

    expect(sendWhatsAppBulk).toHaveBeenCalledTimes(2);

    const [contactsCallArgs, ouvriersCallArgs] = (sendWhatsAppBulk as jest.Mock).mock.calls;
    const [, msgTextContacts] = contactsCallArgs;
    const [, msgTextOuvriers] = ouvriersCallArgs;

    // Le message pour les contacts (campus 'orleans') doit contenir l'adresse d'Orléans,
    // et surtout PAS celle de Montpellier (fuite inter-campus).
    expect(msgTextContacts).toContain('1 rue de la Loire');
    expect(msgTextContacts).not.toContain('2 rue de Montpellier');

    // Le message pour les ouvriers (campus 'montpellier') doit contenir l'adresse de
    // Montpellier, et surtout PAS celle d'Orléans.
    expect(msgTextOuvriers).toContain('2 rue de Montpellier');
    expect(msgTextOuvriers).not.toContain('1 rue de la Loire');
  });
});
