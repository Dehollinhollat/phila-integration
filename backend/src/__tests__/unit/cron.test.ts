// cron.test.ts
// Test unitaire cible sur la Tache 2 de cron.ts (envois groupes planifies) : verifie
// que chaque destinataire recoit l'adresse de SON PROPRE campus, meme quand un seul
// evenement multi-campus (campus: null / filtres sans campus precis) est envoye.
//
// Technique de capture du callback : le mock global de node-cron (jest.fn() dans
// __tests__/setup.ts) enregistre bel et bien chaque appel a cron.schedule(pattern, callback),
// callback inclus. On appelle startCronJobs() pour declencher tous les enregistrements,
// puis on recupere le callback de la Tache 2 via getTache2Callback(), qui recherche
// l'appel cron.schedule(...) dont le pattern est '* * * * *' (au lieu d'indexer le
// tableau des appels) : ainsi la recuperation reste correcte meme si cron.ts change
// l'ordre d'enregistrement des taches ou en ajoute d'autres, et echoue bruyamment
// (via expect) si aucun appel ne correspond au lieu de recuperer silencieusement le
// mauvais callback.

import cron from 'node-cron';
import prisma from '../../lib/prisma';
import { sendWhatsApp } from '../../lib/twilio';
import { startCronJobs } from '../../lib/cron';

/**
 * Recupere le callback enregistre pour la Tache 2 ('* * * * *' — envois planifies)
 * en recherchant par pattern cron plutot que par index de tableau. Auto-verifiante :
 * echoue avec un message clair si aucun appel cron.schedule(...) ne correspond, plutot
 * que de risquer de renvoyer silencieusement le callback d'une autre tache.
 */
function getTache2Callback(scheduleMock: jest.Mock): () => Promise<void> {
  const calls = scheduleMock.mock.calls;
  const tache2Call = calls.find((c) => c[0] === '* * * * *');
  expect(tache2Call).toBeDefined();
  return tache2Call![1];
}

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

  it('enregistre bel et bien la Tache 1 (bienvenue J+3) et la Tache 2 (envois planifies)', () => {
    startCronJobs();

    const scheduleMock = cron.schedule as jest.Mock;
    // Sanity check independante de l'ordre : les deux patterns attendus sont bien
    // enregistres, quel que soit l'ordre dans lequel cron.ts les declare.
    expect(scheduleMock.mock.calls.some((c) => c[0] === '0 9 * * *')).toBe(true);
    expect(typeof getTache2Callback(scheduleMock)).toBe('function');
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
        createur:        { role: 'super_admin' },
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
    const tache2Callback = getTache2Callback(scheduleMock);

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

describe('Tache 2 - un evenement multi-campus n\'est envoye que si son createur est TOUJOURS super_admin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.message.createMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.evenement.update as jest.Mock).mockResolvedValue({ id: 'ev-1' });
  });

  it("n'envoie pas et repasse en brouillon si le createur n'est plus super_admin", async () => {
    // Cas historique : un evenement campus=null cree avant le controle de perimetre
    // (ou par un compte depuis retrograde) ne doit jamais partir sans verification —
    // le cron n'a aucun contexte utilisateur pour re-verifier un perimetre lui-meme.
    (prisma.evenement.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'ev-1', titre: 'Ancien evenement', message_template: 'Bonjour',
        destinataires: 'tous', campus: null, filtres_json: null,
        date_evenement: new Date('2026-09-01'), planifie_le: new Date('2026-08-01T09:00:00Z'),
        statut: 'planifie', created_by: 'admin-demote',
        createur: { role: 'admin_campus' }, // retrograde depuis la creation
      },
    ]);

    const { startCronJobs } = await import('../../lib/cron');
    startCronJobs();
    const scheduleMock = cron.schedule as jest.Mock;
    const tache2Callback = getTache2Callback(scheduleMock);

    await tache2Callback();

    expect(sendWhatsApp).not.toHaveBeenCalled();
    expect(prisma.contact.findMany).not.toHaveBeenCalled();
    expect(prisma.evenement.update).toHaveBeenCalledWith({
      where: { id: 'ev-1' },
      data:  { statut: 'brouillon', planifie_le: null },
    });
  });
});

describe("Tache 2 - dest_type/filtres_ouvriers persistes, l'audience ouvriers est bien envoyee", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCampusSettingsFindMany();
    (prisma.message.createMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.evenement.update as jest.Mock).mockResolvedValue({ id: 'ev-1' });
    (prisma.contact.findMany as jest.Mock).mockResolvedValue([]);
  });

  it("dest_type='ouvriers' : interroge prisma.ouvrier et envoie aux ouvriers trouves", async () => {
    (prisma.evenement.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'ev-ouv', titre: 'Reunion ouvriers', message_template: 'Bonjour [Prenom]',
        destinataires: 'tous', campus: 'paris', filtres_json: null,
        dest_type: 'ouvriers', filtres_ouvriers: JSON.stringify({ campus: 'paris' }),
        date_evenement: new Date('2026-09-01'), planifie_le: new Date('2026-08-01T09:00:00Z'),
        statut: 'planifie', created_by: 'admin-1', createur: { role: 'admin_campus' },
      },
    ]);
    (prisma.ouvrier.findMany as jest.Mock).mockResolvedValue([
      { id: 'o1', prenom: 'Marc', telephone: '+33600000009', campus: 'paris' },
    ]);
    (sendWhatsApp as jest.Mock).mockResolvedValue({ sid: 'SM_o1' });

    const { startCronJobs } = await import('../../lib/cron');
    startCronJobs();
    const tache2Callback = getTache2Callback(cron.schedule as jest.Mock);

    await tache2Callback();

    expect(prisma.ouvrier.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ statut: true, campus: 'paris' }),
    }));
    expect(sendWhatsApp).toHaveBeenCalledWith('+33600000009', expect.stringContaining('Marc'));
    expect(prisma.message.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([expect.objectContaining({ contact_id: null, evenement_id: 'ev-ouv' })]),
    }));
    expect(prisma.evenement.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ev-ouv' },
      data:  expect.objectContaining({ statut: 'envoye' }),
    }));
  });

  it("dest_type='contacts' (ou absent) : n'interroge jamais prisma.ouvrier", async () => {
    (prisma.evenement.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'ev-c', titre: 'Actu', message_template: 'Bonjour',
        destinataires: 'tous', campus: 'paris', filtres_json: null,
        dest_type: null, filtres_ouvriers: null,
        date_evenement: new Date('2026-09-01'), planifie_le: new Date('2026-08-01T09:00:00Z'),
        statut: 'planifie', created_by: 'admin-1', createur: { role: 'admin_campus' },
      },
    ]);

    const { startCronJobs } = await import('../../lib/cron');
    startCronJobs();
    const tache2Callback = getTache2Callback(cron.schedule as jest.Mock);

    await tache2Callback();

    expect(prisma.ouvrier.findMany).not.toHaveBeenCalled();
  });
});
