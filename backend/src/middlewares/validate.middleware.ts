// src/middlewares/validate.middleware.ts
// Middleware générique de validation des corps de requête avec Zod.
// Usage : router.post('/', validate(monSchema), monController)
// En cas d'échec, retourne 400 avec le détail des erreurs de validation.
// req.body est remplacé par la valeur parsée par Zod (typée et nettoyée).

import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'Données invalides',
        details: result.error.flatten(),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
