// evenements.controller.test.ts
// Test unitaire cible sur envoyerEvenement : verifie que [Adresse] est bien
// substitue (bug pre-existant : le placeholder n'etait jamais remplace, les
// destinataires recevaient le texte litteral "[Adresse]") et que chaque contact
// recoit l'adresse de SON PROPRE campus, jamais une valeur unique/partagee
// (un evenement peut cibler plusieurs campus a la fois).

import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { sendWhatsApp } from '../../lib/twilio';
import { envoyerEvenement } from '../../controllers/evenements.controller';

function mockRes(): { res: Partial<Response>; jsonMock: jest.Mock; statusMock: jest.Mock } {
  const jsonMock   = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return { res: { json: jsonMock, status: statusMock as never }, jsonMock, statusMock };
}

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    params: { id: 'ev-1' },
    user: { id: 'admin-1', role: 'super_admin', campus: ['paris'] },
    ...overrides,
  } as unknown as Request;
}

describe('envoyerEvenement - substitution [Adresse] par campus du destinataire', () => {
  beforeEach(() => {
    (prisma.message.createMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.evenement.update as jest.Mock).mockResolvedValue({ id: 'ev-1', statut: 'envoye' });
  });

  it('remplace [Adresse] par une vraie adresse (plus le texte litteral du placeholder)', async () => {
    (prisma.evenement.findUnique as jest.Mock).mockResolvedValue({
      id: 'ev-1',
      statut: 'planifie',
      destinataires: 'tous',
      campus: 'orleans',
      filtres_json: null,
      date_evenement: new Date('2026-09-01'),
      message_template: 'Bonjour [Prénom] ! RDV [Campus] le [Date] a [Adresse]',
    });

    (prisma.contact.findMany as jest.Mock).mockResolvedValue([
      { id: 'c1', prenom: 'Alice', nom: 'Martin', telephone: '+33600000001', campus: 'orleans' },
    ]);

    (prisma.campusSettings.findMany as jest.Mock).mockResolvedValue([
      { campus: 'orleans', key: 'adresse_eglise', value: '1 rue de la Loire' },
    ]);

    (sendWhatsApp as jest.Mock).mockResolvedValue({ sid: 'SM_1' });

    const { res } = mockRes();
    await envoyerEvenement(mockReq(), res as Response);

    expect(sendWhatsApp).toHaveBeenCalledTimes(1);
    const [, body] = (sendWhatsApp as jest.Mock).mock.calls[0];
    expect(body).toContain('1 rue de la Loire');
    expect(body).not.toContain('[Adresse]');
  });

  it("envoie a chaque contact l'adresse de SON PROPRE campus quand l'evenement cible plusieurs campus", async () => {
    (prisma.evenement.findUnique as jest.Mock).mockResolvedValue({
      id: 'ev-1',
      statut: 'planifie',
      destinataires: 'tous',
      campus: null, // evenement multi-campus
      filtres_json: null,
      date_evenement: new Date('2026-09-01'),
      message_template: 'Bonjour [Prénom] ! RDV le [Date] a [Adresse]',
    });

    (prisma.contact.findMany as jest.Mock).mockResolvedValue([
      { id: 'c1', prenom: 'Alice', nom: 'Martin',  telephone: '+33600000001', campus: 'orleans' },
      { id: 'c2', prenom: 'Bob',   nom: 'Durand',  telephone: '+33600000002', campus: 'montpellier' },
    ]);

    (prisma.campusSettings.findMany as jest.Mock).mockImplementation(
      async ({ where }: { where: { campus: { in: string[] } } }) => {
        const rows: Array<{ campus: string; key: string; value: string }> = [];
        if (where.campus.in.includes('orleans')) {
          rows.push({ campus: 'orleans', key: 'adresse_eglise', value: '1 rue de la Loire' });
        }
        if (where.campus.in.includes('montpellier')) {
          rows.push({ campus: 'montpellier', key: 'adresse_eglise', value: '2 rue de Montpellier' });
        }
        return rows;
      }
    );

    (sendWhatsApp as jest.Mock).mockResolvedValue({ sid: 'SM_ok' });

    const { res } = mockRes();
    await envoyerEvenement(mockReq(), res as Response);

    expect(sendWhatsApp).toHaveBeenCalledTimes(2);
    const calls = (sendWhatsApp as jest.Mock).mock.calls;

    const bodyForOrleansContact     = calls.find(([to]) => to === '+33600000001')![1];
    const bodyForMontpellierContact = calls.find(([to]) => to === '+33600000002')![1];

    // Le contact d'Orleans recoit l'adresse d'Orleans, jamais celle de Montpellier.
    expect(bodyForOrleansContact).toContain('1 rue de la Loire');
    expect(bodyForOrleansContact).not.toContain('2 rue de Montpellier');

    // Le contact de Montpellier recoit l'adresse de Montpellier, jamais celle d'Orleans.
    expect(bodyForMontpellierContact).toContain('2 rue de Montpellier');
    expect(bodyForMontpellierContact).not.toContain('1 rue de la Loire');
  });
});
