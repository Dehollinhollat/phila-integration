// messages.controller.test.ts
// Test unitaire ciblé sur un bug de fuite de campus dans createEvenement (Task D8).
// Quand dest_type='tous', filtres.campus (contacts) et filtres_ouvriers.campus (ouvriers)
// peuvent cibler des campus DIFFERENTS dans un seul envoi. Le message envoyé à chaque
// audience doit utiliser l'adresse de SON propre campus, jamais celle de l'autre.
//
// Un second test couvre le bug WITHIN-group : un seul groupe (ex. contacts) peut lui-même
// couvrir plusieurs campus dès que filtres.campus n'est pas précisé — chaque destinataire
// doit alors recevoir l'adresse de SON propre campus, pas une valeur unique pour le groupe.

import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { sendWhatsApp } from '../../lib/twilio';
import { createEvenement } from '../../controllers/messages.controller';

function mockRes(): { res: Partial<Response>; jsonMock: jest.Mock; statusMock: jest.Mock } {
  const jsonMock   = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return { res: { json: jsonMock, status: statusMock as never }, jsonMock, statusMock };
}

// Adresses distinctes par campus — simule prisma.campusSettings.findMany.
// getCampusSettingsForMany interroge avec where.campus = { in: [...] }, donc ce mock
// gère aussi bien une string qu'un objet { in: [...] } pour rester compatible avec les
// deux helpers (getCampusSettingsWithDefaults / getCampusSettingsForMany).
const ADRESSES_PAR_CAMPUS: Record<string, string> = {
  orleans:     '1 rue de la Loire',
  montpellier: '2 rue de Montpellier',
};

function mockCampusSettingsFindMany(): void {
  (prisma.campusSettings.findMany as jest.Mock).mockImplementation(
    async ({ where }: { where: { campus: string | { in: string[] } } }) => {
      const campuses = typeof where.campus === 'string' ? [where.campus] : where.campus.in;
      return campuses
        .filter((c) => ADRESSES_PAR_CAMPUS[c])
        .map((c) => ({ campus: c, key: 'adresse_eglise', value: ADRESSES_PAR_CAMPUS[c] }));
    }
  );
}

describe('createEvenement - resolution independante du campus (contacts vs ouvriers)', () => {
  it("n'envoie pas l'adresse d'un campus aux destinataires de l'autre quand dest_type='tous'", async () => {
    (prisma.evenement.create as jest.Mock).mockResolvedValue({ id: 'ev-1' });

    mockCampusSettingsFindMany();

    (prisma.contact.findMany as jest.Mock).mockResolvedValue([
      { id: 'c1', prenom: 'Alice', telephone: '+33600000001', campus: 'orleans' },
    ]);
    (prisma.ouvrier.findMany as jest.Mock).mockResolvedValue([
      { id: 'o1', prenom: 'Bob', telephone: '+33600000002', campus: 'montpellier' },
    ]);

    (sendWhatsApp as jest.Mock)
      .mockResolvedValueOnce({ sid: 'SM_contacts' })
      .mockResolvedValueOnce({ sid: 'SM_ouvriers' });

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

    expect(sendWhatsApp).toHaveBeenCalledTimes(2);

    const [, msgTextContacts] = (sendWhatsApp as jest.Mock).mock.calls[0];
    const [, msgTextOuvriers] = (sendWhatsApp as jest.Mock).mock.calls[1];

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

describe('createEvenement - resolution par destinataire (WITHIN un seul groupe multi-campus)', () => {
  it("chaque contact recoit l'adresse de SON PROPRE campus quand filtres.campus n'est pas precise (groupe multi-campus)", async () => {
    (prisma.evenement.create as jest.Mock).mockResolvedValue({ id: 'ev-2' });

    mockCampusSettingsFindMany();

    // Un seul groupe (contacts), mais filtres.campus est absent (optionnel) : le filtre
    // matche donc des contacts de campus DIFFERENTS dans le même envoi.
    (prisma.contact.findMany as jest.Mock).mockResolvedValue([
      { id: 'c1', prenom: 'Alice', telephone: '+33600000001', campus: 'orleans' },
      { id: 'c2', prenom: 'Chloe', telephone: '+33600000002', campus: 'montpellier' },
    ]);

    (sendWhatsApp as jest.Mock)
      .mockResolvedValueOnce({ sid: 'SM_c1' })
      .mockResolvedValueOnce({ sid: 'SM_c2' });

    (prisma.message.createMany as jest.Mock).mockResolvedValue({ count: 2 });

    const { res } = mockRes();
    const req = {
      user: { id: 'admin-1', role: 'super_admin', campus: ['paris'] },
      body: {
        titre:              'Reunion generale',
        message_template:   'Rendez-vous [Campus] a [Adresse] le [Date]',
        date_evenement:     '2026-09-01',
        envoyer_maintenant: true,
        dest_type:          'contacts',
        filtres:            {}, // aucun campus ciblé — groupe multi-campus
      },
    } as unknown as Request;

    await createEvenement(req, res as Response);

    expect(sendWhatsApp).toHaveBeenCalledTimes(2);

    const [telC1, msgC1] = (sendWhatsApp as jest.Mock).mock.calls[0];
    const [telC2, msgC2] = (sendWhatsApp as jest.Mock).mock.calls[1];

    // Alice (orleans) doit recevoir l'adresse d'Orléans, jamais celle de Montpellier.
    expect(telC1).toBe('+33600000001');
    expect(msgC1).toContain('1 rue de la Loire');
    expect(msgC1).not.toContain('2 rue de Montpellier');

    // Chloé (montpellier), dans le MÊME groupe/envoi, doit recevoir l'adresse de
    // Montpellier, jamais celle d'Orléans — c'est le bug WITHIN-group corrigé.
    expect(telC2).toBe('+33600000002');
    expect(msgC2).toContain('2 rue de Montpellier');
    expect(msgC2).not.toContain('1 rue de la Loire');
  });
});
