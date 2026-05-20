// src/middlewares/rateLimit.middleware.ts
// Deux rate limiters Express :
//   formRateLimit   — pour les routes publiques de soumission (POST /contacts, POST /ouvriers/candidature)
//                     Max 5 soumissions par IP par heure → protège contre les soumissions automatisées.
//   globalRateLimit — appliqué sur toutes les routes dans server.ts
//                     Max 100 requêtes par IP par 15 minutes → protection générale.

import rateLimit from 'express-rate-limit';

// Limiteur strict pour les formulaires publics
export const formRateLimit = rateLimit({
  windowMs:       60 * 60 * 1000, // 1 heure
  max:            5,               // max 5 soumissions par IP
  message:        { error: 'Trop de soumissions. Veuillez réessayer dans une heure.' },
  standardHeaders: true,           // retourne Retry-After dans les headers
  legacyHeaders:   false,
});

// Limiteur spécifique au login — protège contre le brute force
// 10 tentatives max par IP sur 15 minutes
export const loginRateLimit = rateLimit({
  windowMs:        15 * 60 * 1000, // 15 minutes
  max:             10,              // max 10 tentatives par IP
  message:         { error: 'Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders:   false,
  skipSuccessfulRequests: true,     // ne compte pas les connexions réussies
});

// Limiteur global permissif (toutes les routes)
export const globalRateLimit = rateLimit({
  windowMs:       15 * 60 * 1000, // 15 minutes
  max:            100,             // max 100 requêtes par IP
  message:        { error: 'Trop de requêtes. Veuillez réessayer dans quelques minutes.' },
  standardHeaders: true,
  legacyHeaders:   false,
});
