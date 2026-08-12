// Tests pour updateContact — la liste blanche explicite empeche un referent_integration
// (role minimum requis par cette route) de rediriger le contact vers un autre referent,
// de le deplacer vers un autre campus, ou de forcer son statut via le PATCH generique,
// en contournant les routes dediees (patchReferents, updateStatut) reservees a un role
// superieur ou porteuses d'effets de bord (historique, audit, notifications).

import { updateContact } from '../../controllers/contacts.controller';
import prisma from '../../lib/prisma';

function mockRes() {
  const jsonMock = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return { res: { status: statusMock, json: jsonMock } as never, statusMock, jsonMock };
}

const REFERENT = { id: 'ref-1', role: 'referent_integration', campus: ['paris'] };
const CONTACT_EXISTANT = {
  id: 'c1', campus: 'paris', statut: 'nouveau', statut_phila: 'non', autre_eglise: false,
  referent_integration_id: null, referent_eglise_id: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.contact.findUnique as jest.Mock).mockResolvedValue({ campus: 'paris' });
  (prisma.contact.findFirst as jest.Mock).mockResolvedValue(CONTACT_EXISTANT);
  (prisma.contact.update as jest.Mock).mockResolvedValue({ ...CONTACT_EXISTANT });
});

describe('updateContact - liste blanche des champs modifiables', () => {
  it('un champ de profil legitime (intention) passe normalement', async () => {
    const { res } = mockRes();
    const req = { params: { id: 'c1' }, user: REFERENT, body: { intention: 'ne_souhaite_pas_integrer' } } as never;

    await updateContact(req, res);

    expect(prisma.contact.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { intention: 'ne_souhaite_pas_integrer' },
    });
  });

  it('referent_integration_id dans le body est ignore (reserve a PATCH /api/referents/*)', async () => {
    const { res } = mockRes();
    const req = {
      params: { id: 'c1' }, user: REFERENT,
      body: { referent_integration_id: 'ref-1', intention: 'souhaite_integrer' },
    } as never;

    await updateContact(req, res);

    const dataEnvoyee = (prisma.contact.update as jest.Mock).mock.calls[0][0].data;
    expect(dataEnvoyee).not.toHaveProperty('referent_integration_id');
  });

  it('referent_eglise_id dans le body est ignore', async () => {
    const { res } = mockRes();
    const req = { params: { id: 'c1' }, user: REFERENT, body: { referent_eglise_id: 'ref-2' } } as never;

    await updateContact(req, res);

    const dataEnvoyee = (prisma.contact.update as jest.Mock).mock.calls[0][0].data;
    expect(dataEnvoyee).not.toHaveProperty('referent_eglise_id');
  });

  it('campus dans le body est ignore (pas de verification de perimetre sur la destination)', async () => {
    const { res } = mockRes();
    const req = { params: { id: 'c1' }, user: REFERENT, body: { campus: 'orleans' } } as never;

    await updateContact(req, res);

    const dataEnvoyee = (prisma.contact.update as jest.Mock).mock.calls[0][0].data;
    expect(dataEnvoyee).not.toHaveProperty('campus');
  });

  it('statut dans le body est ignore (reserve a PATCH /:id/statut, avec historique)', async () => {
    const { res } = mockRes();
    const req = { params: { id: 'c1' }, user: REFERENT, body: { statut: 'integre' } } as never;

    await updateContact(req, res);

    const dataEnvoyee = (prisma.contact.update as jest.Mock).mock.calls[0][0].data;
    expect(dataEnvoyee).not.toHaveProperty('statut');
  });

  it('telephone dans le body est ignore (pas de controle de doublon ici, voir updateContactFull)', async () => {
    const { res } = mockRes();
    const req = { params: { id: 'c1' }, user: REFERENT, body: { telephone: '+33600000000' } } as never;

    await updateContact(req, res);

    const dataEnvoyee = (prisma.contact.update as jest.Mock).mock.calls[0][0].data;
    expect(dataEnvoyee).not.toHaveProperty('telephone');
  });

  it('id/created_at/updated_at dans le body sont ignores', async () => {
    const { res } = mockRes();
    const req = {
      params: { id: 'c1' }, user: REFERENT,
      body: { id: 'autre-id', created_at: '2020-01-01', updated_at: '2020-01-01' },
    } as never;

    await updateContact(req, res);

    const dataEnvoyee = (prisma.contact.update as jest.Mock).mock.calls[0][0].data;
    expect(dataEnvoyee).toEqual({});
  });

  it('recalcule le profil quand statut_phila change, comme avant la liste blanche', async () => {
    const { res } = mockRes();
    const req = { params: { id: 'c1' }, user: REFERENT, body: { statut_phila: 'oui' } } as never;

    await updateContact(req, res);

    const dataEnvoyee = (prisma.contact.update as jest.Mock).mock.calls[0][0].data;
    expect(dataEnvoyee.profil).toBe('membre_phila');
  });
});
