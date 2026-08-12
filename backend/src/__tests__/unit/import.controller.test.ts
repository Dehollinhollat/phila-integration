// import.controller.test.ts
// importContacts lisait le campus directement depuis la colonne CAMPUS du
// fichier uploade, sans jamais verifier qu'il appartient au perimetre de
// l'admin_campus qui importe — trouve lors d'un audit de securite.

import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import prisma from '../../lib/prisma';
import { importContacts } from '../../controllers/import.controller';

function mockRes(): { res: Partial<Response>; jsonMock: jest.Mock } {
  const jsonMock = jest.fn();
  return { res: { json: jsonMock } as never, jsonMock };
}

function buildXlsxBuffer(rows: Record<string, string>[]): Buffer {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Contacts');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function mockReq(rows: Record<string, string>[], overrides: Partial<Request> = {}): Request {
  return {
    file: { buffer: buildXlsxBuffer(rows) },
    user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
    ...overrides,
  } as unknown as Request;
}

const ROW_PARIS = {
  CIVILITE: 'Monsieur', PRENOM: 'Jean', NOM: 'Dupont', CONTACT: '+33600000001', CAMPUS: 'Paris',
};
const ROW_ORLEANS = {
  CIVILITE: 'Madame', PRENOM: 'Alice', NOM: 'Martin', CONTACT: '+33600000002', CAMPUS: 'Orléans',
};

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.contact.findUnique as jest.Mock).mockResolvedValue(null); // pas de doublon
  (prisma.contact.create as jest.Mock).mockResolvedValue({ id: 'c-new' });
});

describe('importContacts - perimetre campus', () => {
  it("admin_campus : une ligne hors de son perimetre est rejetee (pas creee), les autres passent", async () => {
    const { res, jsonMock } = mockRes();
    await importContacts(mockReq([ROW_PARIS, ROW_ORLEANS]), res as Response);

    expect(prisma.contact.create).toHaveBeenCalledTimes(1);
    expect(prisma.contact.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ campus: 'paris' }),
    }));
    const result = jsonMock.mock.calls[0][0];
    expect(result.importes).toBe(1);
    expect(result.erreurs).toEqual([
      expect.objectContaining({ raison: expect.stringContaining('hors de votre périmètre') }),
    ]);
  });

  it('super_admin : toutes les lignes passent, quel que soit leur campus', async () => {
    const { res, jsonMock } = mockRes();
    await importContacts(
      mockReq([ROW_PARIS, ROW_ORLEANS], { user: { id: 'sa', role: 'super_admin', campus: [] } } as unknown as Partial<Request>),
      res as Response,
    );

    expect(prisma.contact.create).toHaveBeenCalledTimes(2);
    const result = jsonMock.mock.calls[0][0];
    expect(result.importes).toBe(2);
    expect(result.erreurs).toEqual([]);
  });
});
