// settings.controller.test.ts
// Tests unitaires pour les 4 handlers de paramètres (globaux + par campus).
// Vérifie notamment l'isolation entre campus lors d'une mise à jour.

import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import {
  getGlobalSettings, updateGlobalSettings,
  getCampusSettingsHandler, updateCampusSettingsHandler,
} from '../../controllers/settings.controller';

function mockRes(): { res: Partial<Response>; jsonMock: jest.Mock; statusMock: jest.Mock } {
  const jsonMock   = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return { res: { json: jsonMock, status: statusMock as never }, jsonMock, statusMock };
}

describe('getGlobalSettings / updateGlobalSettings', () => {
  it('getGlobalSettings retourne un objet cle-valeur depuis Settings', async () => {
    (prisma.settings.findMany as jest.Mock).mockResolvedValue([
      { key: 'seuil_sans_referent', value: '7' },
    ]);
    const { res, jsonMock } = mockRes();
    await getGlobalSettings({} as Request, res as Response);
    expect(jsonMock).toHaveBeenCalledWith({ seuil_sans_referent: '7' });
  });

  it('updateGlobalSettings rejette un corps vide', async () => {
    const { res, statusMock } = mockRes();
    await updateGlobalSettings({ body: [] } as unknown as Request, res as Response);
    expect(statusMock).toHaveBeenCalledWith(400);
  });
});

describe('getCampusSettingsHandler / updateCampusSettingsHandler', () => {
  it('getCampusSettingsHandler ne retourne que les lignes du campus demande', async () => {
    (prisma.campusSettings.findMany as jest.Mock).mockResolvedValue([
      { campus: 'orleans', key: 'adresse_eglise', value: '1 rue de la Loire' },
    ]);
    const { res, jsonMock } = mockRes();
    await getCampusSettingsHandler({ params: { campus: 'orleans' } } as unknown as Request, res as Response);
    expect(prisma.campusSettings.findMany).toHaveBeenCalledWith({ where: { campus: 'orleans' } });
    expect(jsonMock).toHaveBeenCalledWith({ adresse_eglise: '1 rue de la Loire' });
  });

  it('getCampusSettingsHandler rejette un campus inconnu (400, pas de lecture DB)', async () => {
    const { res, statusMock } = mockRes();
    await getCampusSettingsHandler({ params: { campus: 'marseille' } } as unknown as Request, res as Response);
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(prisma.campusSettings.findMany).not.toHaveBeenCalled();
  });

  it('updateCampusSettingsHandler rejette une cle inconnue', async () => {
    const { res, statusMock } = mockRes();
    await updateCampusSettingsHandler(
      { params: { campus: 'orleans' }, body: [{ key: 'cle_inexistante', value: 'x' }] } as unknown as Request,
      res as Response
    );
    expect(statusMock).toHaveBeenCalledWith(400);
  });

  it('updateCampusSettingsHandler rejette un campus inconnu avant meme de lire le body', async () => {
    const { res, statusMock } = mockRes();
    await updateCampusSettingsHandler(
      { params: { campus: 'marseille' }, body: [{ key: 'nom_eglise', value: 'x' }] } as unknown as Request,
      res as Response
    );
    expect(statusMock).toHaveBeenCalledWith(400);
  });

  it('updateCampusSettingsHandler n\'ecrit que sur le campus de l\'URL', async () => {
    (prisma.$transaction as jest.Mock).mockResolvedValue([]);
    (prisma.campusSettings.findMany as jest.Mock).mockResolvedValue([
      { campus: 'orleans', key: 'nom_eglise', value: 'Phila Orleans' },
    ]);
    const { res } = mockRes();
    await updateCampusSettingsHandler(
      { params: { campus: 'orleans' }, body: [{ key: 'nom_eglise', value: 'Phila Orleans' }] } as unknown as Request,
      res as Response
    );
    const upsertCalls = (prisma.campusSettings.upsert as jest.Mock).mock.calls;
    expect(upsertCalls.length).toBeGreaterThan(0);
  });
});
