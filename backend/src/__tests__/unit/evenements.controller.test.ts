// evenements.controller.test.ts
// Test unitaire cible sur envoyerEvenement : verifie que [Adresse] est bien
// substitue (bug pre-existant : le placeholder n'etait jamais remplace, les
// destinataires recevaient le texte litteral "[Adresse]") et que chaque contact
// recoit l'adresse de SON PROPRE campus, jamais une valeur unique/partagee
// (un evenement peut cibler plusieurs campus a la fois).

import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { sendWhatsApp } from '../../lib/twilio';
import {
  envoyerEvenement, createEvenement, updateEvenement,
  listEvenements, getEvenement, deleteEvenement, planifierEvenement,
} from '../../controllers/evenements.controller';

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

// ─── Périmètre campus ────────────────────────────────────────────────────────
// Un admin_campus ne doit pouvoir agir que sur les événements de SON périmètre.
// Faille pré-existante : aucun de ces endpoints ne vérifiait le campus, un admin
// scopé sur un campus pouvait envoyer un WhatsApp à tous les autres campus.

describe('périmètre campus', () => {
  beforeEach(() => {
    (prisma.message.createMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.evenement.update as jest.Mock).mockResolvedValue({ id: 'ev-1', statut: 'envoye' });
  });

  it('envoyerEvenement refuse un événement rattaché à un autre campus', async () => {
    (prisma.evenement.findUnique as jest.Mock).mockResolvedValue({
      id: 'ev-1', statut: 'planifie', destinataires: 'tous', campus: 'orleans',
      filtres_json: null, date_evenement: new Date('2026-09-01'),
      message_template: 'Bonjour [Prénom]',
    });

    const { res, statusMock } = mockRes();
    await envoyerEvenement(
      mockReq({ user: { id: 'a1', role: 'admin_campus', campus: ['paris'] } } as Partial<Request>),
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(sendWhatsApp).not.toHaveBeenCalled();
    expect(prisma.evenement.update).not.toHaveBeenCalled();
  });

  it('envoyerEvenement refuse un événement multi-campus (campus null)', async () => {
    (prisma.evenement.findUnique as jest.Mock).mockResolvedValue({
      id: 'ev-1', statut: 'planifie', destinataires: 'tous', campus: null,
      filtres_json: null, date_evenement: new Date('2026-09-01'),
      message_template: 'Bonjour [Prénom]',
    });

    const { res, statusMock } = mockRes();
    await envoyerEvenement(
      mockReq({ user: { id: 'a1', role: 'admin_campus', campus: ['paris'] } } as Partial<Request>),
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(sendWhatsApp).not.toHaveBeenCalled();
  });

  it('createEvenement refuse un campus hors périmètre', async () => {
    const { res, statusMock } = mockRes();
    await createEvenement(
      mockReq({
        user: { id: 'a1', role: 'admin_campus', campus: ['paris'] },
        body: {
          titre: 'Culte', date_evenement: '2026-09-01',
          message_template: 'Bonjour', destinataires: 'tous', campus: 'orleans',
        },
      } as Partial<Request>),
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(prisma.evenement.create).not.toHaveBeenCalled();
  });

  it('createEvenement complète implicitement le campus d\'un admin mono-campus', async () => {
    (prisma.evenement.create as jest.Mock).mockResolvedValue({ id: 'ev-2' });

    const { res } = mockRes();
    await createEvenement(
      mockReq({
        user: { id: 'a1', role: 'admin_campus', campus: ['paris'] },
        body: {
          titre: 'Culte', date_evenement: '2026-09-01',
          message_template: 'Bonjour', destinataires: 'tous',
        },
      } as Partial<Request>),
      res as Response,
    );

    // Sans campus explicite, l'événement doit être rattaché au seul campus de l'appelant —
    // sinon il serait stocké avec campus null et son créateur ne pourrait plus le gérer.
    const dataCreee = (prisma.evenement.create as jest.Mock).mock.calls[0][0].data;
    expect(dataCreee.campus).toBe('paris');
  });

  it('createEvenement exige un campus explicite pour un admin multi-campus', async () => {
    const { res, statusMock } = mockRes();
    await createEvenement(
      mockReq({
        user: { id: 'a1', role: 'admin_campus', campus: ['paris', 'orleans'] },
        body: {
          titre: 'Culte', date_evenement: '2026-09-01',
          message_template: 'Bonjour', destinataires: 'tous',
        },
      } as Partial<Request>),
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(prisma.evenement.create).not.toHaveBeenCalled();
  });

  it('createEvenement laisse un super_admin cibler tous les campus', async () => {
    (prisma.evenement.create as jest.Mock).mockResolvedValue({ id: 'ev-3' });

    const { res } = mockRes();
    await createEvenement(
      mockReq({
        user: { id: 'sa', role: 'super_admin', campus: ['paris'] },
        body: {
          titre: 'Culte', date_evenement: '2026-09-01',
          message_template: 'Bonjour', destinataires: 'tous',
        },
      } as Partial<Request>),
      res as Response,
    );

    const dataCreee = (prisma.evenement.create as jest.Mock).mock.calls[0][0].data;
    expect(dataCreee.campus).toBeNull();
  });
});

// ─── Chemin différé (brouillon / planifié) ───────────────────────────────────
// Le controle de perimetre n'autorise que « qui peut declencher l'envoi ». Il faut en
// plus borner QUI RECOIT : filtres_json vient du client et `destinataires` peut cibler
// un autre campus. Sans cela, il suffisait de creer l'evenement sans l'envoyer, puis de
// l'envoyer dans un second temps, pour diffuser hors perimetre.

describe('envoyerEvenement - le campus de l\'evenement borne toujours les destinataires', () => {
  beforeEach(() => {
    (prisma.message.createMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.evenement.update as jest.Mock).mockResolvedValue({ id: 'ev-1', statut: 'envoye' });
    (prisma.contact.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.campusSettings.findMany as jest.Mock).mockResolvedValue([]);
  });

  it('ajoute le campus au filtre meme si filtres_json n\'en contient aucun', async () => {
    (prisma.evenement.findUnique as jest.Mock).mockResolvedValue({
      id: 'ev-1', statut: 'brouillon', destinataires: 'tous', campus: 'paris',
      filtres_json: JSON.stringify({ profil: 'membre_phila' }), // aucun campus
      date_evenement: new Date('2026-09-01'), message_template: 'Bonjour',
    });

    const { res } = mockRes();
    await envoyerEvenement(mockReq(), res as Response);

    const where = (prisma.contact.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.profil).toBe('membre_phila');
    expect(where.campus).toBe('paris');
  });

  it('ecrase un campus contradictoire venant de filtres_json', async () => {
    (prisma.evenement.findUnique as jest.Mock).mockResolvedValue({
      id: 'ev-1', statut: 'brouillon', destinataires: 'tous', campus: 'paris',
      filtres_json: JSON.stringify({ campus: 'orleans' }),
      date_evenement: new Date('2026-09-01'), message_template: 'Bonjour',
    });

    const { res } = mockRes();
    await envoyerEvenement(mockReq(), res as Response);

    const where = (prisma.contact.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.campus).toBe('paris');
  });

  it('neutralise un champ destinataires ciblant un autre campus', async () => {
    (prisma.evenement.findUnique as jest.Mock).mockResolvedValue({
      id: 'ev-1', statut: 'brouillon', destinataires: 'campus_orleans', campus: 'paris',
      filtres_json: null,
      date_evenement: new Date('2026-09-01'), message_template: 'Bonjour',
    });

    const { res } = mockRes();
    await envoyerEvenement(mockReq(), res as Response);

    const where = (prisma.contact.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.campus).toBe('paris');
  });

  it('laisse un evenement multi-campus du super_admin sans filtre campus', async () => {
    (prisma.evenement.findUnique as jest.Mock).mockResolvedValue({
      id: 'ev-1', statut: 'brouillon', destinataires: 'tous', campus: null,
      filtres_json: JSON.stringify({ profil: 'membre_phila' }),
      date_evenement: new Date('2026-09-01'), message_template: 'Bonjour',
    });

    const { res } = mockRes();
    await envoyerEvenement(mockReq(), res as Response);

    const where = (prisma.contact.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.campus).toBeUndefined();
  });
});

describe('updateEvenement - liste blanche des champs modifiables', () => {
  it('ignore filtres_json, destinataires et statut envoyes dans le corps', async () => {
    (prisma.evenement.findUnique as jest.Mock).mockResolvedValue({
      id: 'ev-1', statut: 'brouillon', campus: 'paris',
    });
    (prisma.evenement.update as jest.Mock).mockResolvedValue({ id: 'ev-1' });

    const { res } = mockRes();
    await updateEvenement(
      mockReq({
        user: { id: 'a1', role: 'admin_campus', campus: ['paris'] },
        body: {
          titre: 'Nouveau titre',
          // Tentative de redefinir QUI recoit, en contournant les controles de creation.
          filtres_json:  JSON.stringify({ profil: 'membre_phila' }),
          destinataires: 'campus_orleans',
          statut:        'brouillon',
          envoye_le:     null,
          created_by:    'quelqu-un-dautre',
        },
      } as Partial<Request>),
      res as Response,
    );

    const data = (prisma.evenement.update as jest.Mock).mock.calls[0][0].data;
    expect(data.titre).toBe('Nouveau titre');
    expect(data).not.toHaveProperty('filtres_json');
    expect(data).not.toHaveProperty('destinataires');
    expect(data).not.toHaveProperty('statut');
    expect(data).not.toHaveProperty('envoye_le');
    expect(data).not.toHaveProperty('created_by');
  });

  it('ignore aussi dest_type et filtres_ouvriers (memes raisons : redefinissent QUI recoit)', async () => {
    (prisma.evenement.findUnique as jest.Mock).mockResolvedValue({
      id: 'ev-1', statut: 'brouillon', campus: 'paris',
    });
    (prisma.evenement.update as jest.Mock).mockResolvedValue({ id: 'ev-1' });

    const { res } = mockRes();
    await updateEvenement(
      mockReq({
        user: { id: 'a1', role: 'admin_campus', campus: ['paris'] },
        body: {
          titre:            'Nouveau titre',
          dest_type:        'ouvriers',
          filtres_ouvriers: JSON.stringify({ campus: 'orleans' }),
        },
      } as Partial<Request>),
      res as Response,
    );

    const data = (prisma.evenement.update as jest.Mock).mock.calls[0][0].data;
    expect(data).not.toHaveProperty('dest_type');
    expect(data).not.toHaveProperty('filtres_ouvriers');
  });
});

describe('envoyerEvenement - audience ouvriers (dest_type persiste)', () => {
  beforeEach(() => {
    (prisma.message.createMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.evenement.update as jest.Mock).mockResolvedValue({ id: 'ev-1', statut: 'envoye' });
    (prisma.campusSettings.findMany as jest.Mock).mockResolvedValue([
      { campus: 'paris', key: 'adresse_eglise', value: '1 rue de Paris' },
    ]);
  });

  it("dest_type='ouvriers' : interroge prisma.ouvrier, jamais prisma.contact, et envoie aux ouvriers", async () => {
    (prisma.evenement.findUnique as jest.Mock).mockResolvedValue({
      id: 'ev-1', statut: 'planifie', destinataires: 'tous', campus: 'paris',
      filtres_json: null, dest_type: 'ouvriers', filtres_ouvriers: JSON.stringify({ campus: 'paris' }),
      date_evenement: new Date('2026-09-01'), message_template: 'Bonjour [Prénom]',
    });
    (prisma.ouvrier.findMany as jest.Mock).mockResolvedValue([
      { id: 'o1', prenom: 'Marc', telephone: '+33600000009', campus: 'paris' },
    ]);
    (sendWhatsApp as jest.Mock).mockResolvedValue({ sid: 'SM_o1' });

    const { res, jsonMock } = mockRes();
    await envoyerEvenement(mockReq(), res as Response);

    expect(prisma.contact.findMany).not.toHaveBeenCalled();
    expect(prisma.ouvrier.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ statut: true, campus: 'paris' }),
    }));
    expect(sendWhatsApp).toHaveBeenCalledWith('+33600000009', expect.stringContaining('Marc'));
    expect(prisma.message.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([expect.objectContaining({ contact_id: null })]),
    }));
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ sent: 1, failed: 0, total: 1 }));
  });

  it("dest_type='tous' : envoie a la fois aux contacts et aux ouvriers", async () => {
    (prisma.evenement.findUnique as jest.Mock).mockResolvedValue({
      id: 'ev-1', statut: 'planifie', destinataires: 'tous', campus: 'paris',
      filtres_json: null, dest_type: 'tous', filtres_ouvriers: JSON.stringify({ campus: 'paris' }),
      date_evenement: new Date('2026-09-01'), message_template: 'Bonjour [Prénom]',
    });
    (prisma.contact.findMany as jest.Mock).mockResolvedValue([
      { id: 'c1', prenom: 'Alice', nom: 'Martin', telephone: '+33600000001', campus: 'paris' },
    ]);
    (prisma.ouvrier.findMany as jest.Mock).mockResolvedValue([
      { id: 'o1', prenom: 'Marc', telephone: '+33600000009', campus: 'paris' },
    ]);
    (sendWhatsApp as jest.Mock).mockResolvedValue({ sid: 'SM_ok' });

    const { res, jsonMock } = mockRes();
    await envoyerEvenement(mockReq(), res as Response);

    expect(sendWhatsApp).toHaveBeenCalledTimes(2);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ sent: 2, failed: 0, total: 2 }));
  });

  it("dest_type absent (evenement cree avant ce champ) : se comporte comme 'contacts', jamais prisma.ouvrier", async () => {
    (prisma.evenement.findUnique as jest.Mock).mockResolvedValue({
      id: 'ev-1', statut: 'planifie', destinataires: 'tous', campus: 'paris',
      filtres_json: null, dest_type: null, filtres_ouvriers: null,
      date_evenement: new Date('2026-09-01'), message_template: 'Bonjour [Prénom]',
    });
    (prisma.contact.findMany as jest.Mock).mockResolvedValue([
      { id: 'c1', prenom: 'Alice', nom: 'Martin', telephone: '+33600000001', campus: 'paris' },
    ]);
    (sendWhatsApp as jest.Mock).mockResolvedValue({ sid: 'SM_ok' });

    const { res } = mockRes();
    await envoyerEvenement(mockReq(), res as Response);

    expect(prisma.ouvrier.findMany).not.toHaveBeenCalled();
    expect(sendWhatsApp).toHaveBeenCalledTimes(1);
  });
});

describe('listEvenements - perimetre campus', () => {
  it('admin_campus voit son campus ET les evenements multi-campus (campus: null)', async () => {
    (prisma.evenement.findMany as jest.Mock).mockResolvedValue([]);
    const { res } = mockRes();
    await listEvenements(
      mockReq({ query: {}, user: { id: 'a1', role: 'admin_campus', campus: ['paris'] } } as Partial<Request>),
      res as Response,
    );
    const where = (prisma.evenement.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.OR).toEqual([{ campus: { in: ['paris'] } }, { campus: null }]);
  });

  it('super_admin sans filtre campus ne restreint rien', async () => {
    (prisma.evenement.findMany as jest.Mock).mockResolvedValue([]);
    const { res } = mockRes();
    await listEvenements(mockReq({ query: {} } as Partial<Request>), res as Response);
    const where = (prisma.evenement.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.campus).toBeUndefined();
    expect(where.OR).toBeUndefined();
  });

  it('super_admin avec ?campus= filtre sur ce campus precis', async () => {
    (prisma.evenement.findMany as jest.Mock).mockResolvedValue([]);
    const { res } = mockRes();
    await listEvenements(mockReq({ query: { campus: 'orleans' } } as Partial<Request>), res as Response);
    const where = (prisma.evenement.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.campus).toBe('orleans');
  });
});

describe('getEvenement - perimetre campus', () => {
  it('404 si introuvable', async () => {
    (prisma.evenement.findUnique as jest.Mock).mockResolvedValue(null);
    const { res, statusMock } = mockRes();
    await getEvenement(mockReq(), res as Response);
    expect(statusMock).toHaveBeenCalledWith(404);
  });

  it('403 si rattache a un autre campus (pas null) hors du perimetre', async () => {
    (prisma.evenement.findUnique as jest.Mock).mockResolvedValue({ id: 'ev-1', campus: 'orleans' });
    const { res, statusMock } = mockRes();
    await getEvenement(
      mockReq({ user: { id: 'a1', role: 'admin_campus', campus: ['paris'] } } as Partial<Request>),
      res as Response,
    );
    expect(statusMock).toHaveBeenCalledWith(403);
  });

  it('un evenement multi-campus (campus: null) reste visible a un admin_campus', async () => {
    (prisma.evenement.findUnique as jest.Mock).mockResolvedValue({ id: 'ev-1', campus: null, messages: [] });
    const { res, statusMock } = mockRes();
    await getEvenement(
      mockReq({ user: { id: 'a1', role: 'admin_campus', campus: ['paris'] } } as Partial<Request>),
      res as Response,
    );
    expect(statusMock).not.toHaveBeenCalledWith(403);
  });

  it('les messages inclus sont filtres par campus pour un non-super_admin', async () => {
    (prisma.evenement.findUnique as jest.Mock).mockResolvedValue({ id: 'ev-1', campus: null, messages: [] });
    const { res } = mockRes();
    await getEvenement(
      mockReq({ user: { id: 'a1', role: 'admin_campus', campus: ['paris'] } } as Partial<Request>),
      res as Response,
    );
    const include = (prisma.evenement.findUnique as jest.Mock).mock.calls[0][0].include;
    expect(include.messages.where).toEqual({ contact: { campus: { in: ['paris'] } } });
  });

  it('super_admin voit tous les messages, sans filtre campus', async () => {
    (prisma.evenement.findUnique as jest.Mock).mockResolvedValue({ id: 'ev-1', campus: 'paris', messages: [] });
    const { res } = mockRes();
    await getEvenement(mockReq(), res as Response);
    const include = (prisma.evenement.findUnique as jest.Mock).mock.calls[0][0].include;
    expect(include.messages.where).toBeUndefined();
  });
});

describe('deleteEvenement - perimetre et statut', () => {
  it('404 si introuvable', async () => {
    (prisma.evenement.findUnique as jest.Mock).mockResolvedValue(null);
    const { res, statusMock } = mockRes();
    await deleteEvenement(mockReq(), res as Response);
    expect(statusMock).toHaveBeenCalledWith(404);
    expect(prisma.evenement.delete).not.toHaveBeenCalled();
  });

  it('403 si hors du perimetre (y compris un evenement multi-campus)', async () => {
    (prisma.evenement.findUnique as jest.Mock).mockResolvedValue({ id: 'ev-1', campus: null, statut: 'brouillon' });
    const { res, statusMock } = mockRes();
    await deleteEvenement(
      mockReq({ user: { id: 'a1', role: 'admin_campus', campus: ['paris'] } } as Partial<Request>),
      res as Response,
    );
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(prisma.evenement.delete).not.toHaveBeenCalled();
  });

  it('400 si deja envoye', async () => {
    (prisma.evenement.findUnique as jest.Mock).mockResolvedValue({ id: 'ev-1', campus: 'paris', statut: 'envoye' });
    const { res, statusMock } = mockRes();
    await deleteEvenement(mockReq(), res as Response);
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(prisma.evenement.delete).not.toHaveBeenCalled();
  });

  it('supprime un brouillon dans le perimetre', async () => {
    (prisma.evenement.findUnique as jest.Mock).mockResolvedValue({ id: 'ev-1', campus: 'paris', statut: 'brouillon' });
    (prisma.evenement.delete as jest.Mock).mockResolvedValue({});
    const { res, statusMock } = mockRes();
    await deleteEvenement(mockReq(), res as Response);
    expect(statusMock).not.toHaveBeenCalledWith(403);
    expect(prisma.evenement.delete).toHaveBeenCalledWith({ where: { id: 'ev-1' } });
  });
});

describe('planifierEvenement - validations et perimetre', () => {
  it('400 si planifie_le absent', async () => {
    const { res, statusMock } = mockRes();
    await planifierEvenement(mockReq({ body: {} } as Partial<Request>), res as Response);
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(prisma.evenement.findUnique).not.toHaveBeenCalled();
  });

  it('400 si la date est dans le passe', async () => {
    const { res, statusMock } = mockRes();
    await planifierEvenement(
      mockReq({ body: { planifie_le: '2020-01-01T00:00:00Z' } } as Partial<Request>),
      res as Response,
    );
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(prisma.evenement.findUnique).not.toHaveBeenCalled();
  });

  it('404 si introuvable', async () => {
    (prisma.evenement.findUnique as jest.Mock).mockResolvedValue(null);
    const { res, statusMock } = mockRes();
    await planifierEvenement(
      mockReq({ body: { planifie_le: '2099-01-01T00:00:00Z' } } as Partial<Request>),
      res as Response,
    );
    expect(statusMock).toHaveBeenCalledWith(404);
  });

  it('403 si hors du perimetre', async () => {
    (prisma.evenement.findUnique as jest.Mock).mockResolvedValue({ id: 'ev-1', campus: 'orleans', statut: 'brouillon' });
    const { res, statusMock } = mockRes();
    await planifierEvenement(
      mockReq({
        body: { planifie_le: '2099-01-01T00:00:00Z' },
        user: { id: 'a1', role: 'admin_campus', campus: ['paris'] },
      } as Partial<Request>),
      res as Response,
    );
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(prisma.evenement.update).not.toHaveBeenCalled();
  });

  it('400 si deja envoye', async () => {
    (prisma.evenement.findUnique as jest.Mock).mockResolvedValue({ id: 'ev-1', campus: 'paris', statut: 'envoye' });
    const { res, statusMock } = mockRes();
    await planifierEvenement(
      mockReq({ body: { planifie_le: '2099-01-01T00:00:00Z' } } as Partial<Request>),
      res as Response,
    );
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(prisma.evenement.update).not.toHaveBeenCalled();
  });

  it('planifie un brouillon dans le perimetre', async () => {
    (prisma.evenement.findUnique as jest.Mock).mockResolvedValue({ id: 'ev-1', campus: 'paris', statut: 'brouillon' });
    (prisma.evenement.update as jest.Mock).mockResolvedValue({ id: 'ev-1', statut: 'planifie' });
    const { res, statusMock } = mockRes();
    await planifierEvenement(
      mockReq({ body: { planifie_le: '2099-01-01T00:00:00Z' } } as Partial<Request>),
      res as Response,
    );
    expect(statusMock).not.toHaveBeenCalledWith(403);
    expect(prisma.evenement.update).toHaveBeenCalledWith({
      where: { id: 'ev-1' },
      data:  { statut: 'planifie', planifie_le: new Date('2099-01-01T00:00:00Z') },
    });
  });
});
