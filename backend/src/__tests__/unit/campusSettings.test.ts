// campusSettings.test.ts
// Tests unitaires pour le helper de lecture des paramètres de messagerie par campus.
// Vérifie l'isolation entre campus (pas de fuite) et l'application des valeurs de repli.

import prisma from '../../lib/prisma';
import {
  getCampusSettingsWithDefaults,
  getCampusSettingsForMany,
  DEFAULT_CAMPUS_SETTINGS,
} from '../../lib/campusSettings';

const mockFindMany = prisma.campusSettings.findMany as jest.Mock;

describe('getCampusSettingsWithDefaults', () => {
  it('retourne la valeur stockee quand elle existe', async () => {
    mockFindMany.mockResolvedValue([{ campus: 'orleans', key: 'adresse_eglise', value: '1 rue de la Loire' }]);
    const result = await getCampusSettingsWithDefaults('orleans', ['adresse_eglise']);
    expect(result.adresse_eglise).toBe('1 rue de la Loire');
  });

  it('applique la valeur de repli quand la ligne est absente', async () => {
    mockFindMany.mockResolvedValue([]);
    const result = await getCampusSettingsWithDefaults('montpellier', ['certificat_verset']);
    expect(result.certificat_verset).toBe(DEFAULT_CAMPUS_SETTINGS.certificat_verset);
  });
});

describe('getCampusSettingsForMany', () => {
  it('isole les valeurs par campus - pas de fuite entre campus', async () => {
    mockFindMany.mockResolvedValue([
      { campus: 'paris',   key: 'message_bienvenue', value: 'Bienvenue a Paris [Prenom]' },
      { campus: 'orleans', key: 'message_bienvenue', value: 'Bienvenue a Orleans [Prenom]' },
    ]);
    const result = await getCampusSettingsForMany(['paris', 'orleans'], ['message_bienvenue']);
    expect(result.get('paris')!.message_bienvenue).toBe('Bienvenue a Paris [Prenom]');
    expect(result.get('orleans')!.message_bienvenue).toBe('Bienvenue a Orleans [Prenom]');
  });

  it('applique la valeur de repli pour un campus sans aucune ligne en base', async () => {
    mockFindMany.mockResolvedValue([]);
    const result = await getCampusSettingsForMany(['montpellier'], ['message_bienvenue']);
    expect(result.get('montpellier')!.message_bienvenue).toBe(DEFAULT_CAMPUS_SETTINGS.message_bienvenue);
  });

  it('deduplique les campus en double dans l\'entree', async () => {
    mockFindMany.mockResolvedValue([]);
    await getCampusSettingsForMany(['paris', 'paris', 'paris'], ['adresse_eglise']);
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.campus.in).toEqual(['paris']);
  });
});
