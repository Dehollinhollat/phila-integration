// cron.test.ts
// Test unitaire cible sur la Tache 2 de cron.ts (envois groupes planifies) : verifie
// que chaque destinataire recoit l'adresse de SON PROPRE campus, meme quand un seul
// evenement multi-campus (campus: null / filtres sans campus precis) est envoye.
//
// Technique de capture du callback : le mock global de node-cron (jest.fn() dans
// __tests__/setup.ts) enregistre bel et bien chaque appel a cron.schedule(pattern, callback),
// callback inclus. On appelle startCronJobs() pour declencher tous les enregistrements,
// puis on recupere le callback de la Tache 2 via mock.calls[1][1] (Tache 2 est le
// DEUXIEME appel cron.schedule(...) dans l'ordre d'enregistrement de cron.ts — voir
// le commentaire d'en-tete de cron.ts : Tache 1 = '0 9 * * *' bienvenue J+3,
// Tache 2 = '* * * * *' envois planifies) et on l'invoque directement.

import cron from 'node-cron';
import prisma from '../../lib/prisma';
import { sendWhatsApp } from '../../lib/twilio';
import { startCronJobs } from '../../lib/cron';

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

describe('cron.ts - Tache 2 (envois groupes planifies) - resolution par destinataire', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('capture bel et bien le callback de la Tache 2 via le mock node-cron', () => {
    startCronJobs();

    const scheduleMock = cron.schedule as jest.Mock;
    // Verifie l'hypothese de l'ordre d'enregistrement avant de s'appuyer dessus :
    // Tache 1 = '0 9 * * *' (bienvenue J+3), Tache 2 = '* * * * *' (envois planifies).
    expect(scheduleMock.mock.calls[0][0]).toBe('0 9 * * *');
    expect(scheduleMock.mock.calls[1][0]).toBe('* * * * *');
    expect(typeof scheduleMock.mock.calls[1][1]).toBe('function');
  });

  it("chaque contact recoit l'adresse de SON PROPRE campus pour un evenement planifie multi-campus", async () => {
    mockCampusSettingsFindMany();

    (prisma.evenement.findMany as jest.Mock).mockResolvedValue([
      {
        id:              'ev-1',
        titre:           'Culte special',
        message_template: 'Rendez-vous [Campus] a [Adresse] le [Date]',
        destinataires:   'tous',
        campus:          null, // multi-campus : aucun campus unique cible sur l'evenement
        filtres_json:    null,
        date_evenement:  new Date('2026-09-01'),
        planifie_le:     new Date('2026-08-01T09:00:00Z'),
        statut:          'planifie',
        created_by:      'admin-1',
      },
    ]);

    (prisma.contact.findMany as jest.Mock).mockResolvedValue([
      { id: 'c1', prenom: 'Alice', nom: 'A', telephone: '+33600000001', campus: 'orleans' },
      { id: 'c2', prenom: 'Chloe', nom: 'C', telephone: '+33600000002', campus: 'montpellier' },
    ]);

    (sendWhatsApp as jest.Mock)
      .mockResolvedValueOnce({ sid: 'SM_c1' })
      .mockResolvedValueOnce({ sid: 'SM_c2' });

    (prisma.message.createMany as jest.Mock).mockResolvedValue({ count: 2 });
    (prisma.evenement.update as jest.Mock).mockResolvedValue({});

    startCronJobs();

    const scheduleMock = cron.schedule as jest.Mock;
    const tache2Callback = scheduleMock.mock.calls[1][1] as () => Promise<void>;

    await tache2Callback();

    expect(sendWhatsApp).toHaveBeenCalledTimes(2);

    const [telC1, msgC1] = (sendWhatsApp as jest.Mock).mock.calls[0];
    const [telC2, msgC2] = (sendWhatsApp as jest.Mock).mock.calls[1];

    // Alice (orleans) doit recevoir l'adresse d'Orleans, jamais celle de Montpellier.
    expect(telC1).toBe('+33600000001');
    expect(msgC1).toContain('1 rue de la Loire');
    expect(msgC1).not.toContain('2 rue de Montpellier');

    // Chloe (montpellier), dans le MEME evenement multi-campus, doit recevoir l'adresse
    // de Montpellier, jamais celle d'Orleans.
    expect(telC2).toBe('+33600000002');
    expect(msgC2).toContain('2 rue de Montpellier');
    expect(msgC2).not.toContain('1 rue de la Loire');

    expect(prisma.evenement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ev-1' },
        data:  expect.objectContaining({ statut: 'envoye' }),
      })
    );
  });
});
