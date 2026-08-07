// roles.middleware.test.ts
// Tests unitaires pour requireCampusAccess — lit req.params.campus et vérifie
// que l'utilisateur a accès à ce campus (ou est super_admin).

import { Request, Response, NextFunction } from 'express';
import { requireCampusAccess } from '../../middlewares/roles.middleware';

function mockReq(user: { role: string; campus: string[] } | undefined, campusParam: string): Partial<Request> {
  return {
    user: user as never,
    params: { campus: campusParam },
  };
}

function mockRes(): { res: Partial<Response>; statusMock: jest.Mock; jsonMock: jest.Mock } {
  const jsonMock   = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return { res: { status: statusMock as never }, statusMock, jsonMock };
}

describe('requireCampusAccess', () => {
  it('refuse si non authentifie', () => {
    const req = mockReq(undefined, 'paris');
    const { res, statusMock } = mockRes();
    const next = jest.fn();
    requireCampusAccess(req as Request, res as Response, next as NextFunction);
    expect(statusMock).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('autorise super_admin sur nimporte quel campus', () => {
    const req = mockReq({ role: 'super_admin', campus: [] }, 'montpellier');
    const { res } = mockRes();
    const next = jest.fn();
    requireCampusAccess(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalled();
  });

  it('autorise admin_campus dont le campus figure dans user.campus', () => {
    const req = mockReq({ role: 'admin_campus', campus: ['orleans'] }, 'orleans');
    const { res } = mockRes();
    const next = jest.fn();
    requireCampusAccess(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalled();
  });

  it('refuse admin_campus sur un campus hors de user.campus', () => {
    const req = mockReq({ role: 'admin_campus', campus: ['paris'] }, 'orleans');
    const { res, statusMock } = mockRes();
    const next = jest.fn();
    requireCampusAccess(req as Request, res as Response, next as NextFunction);
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
