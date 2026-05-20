// src/schemas/contacts.schema.ts
// Schéma Zod pour la création d'un contact via les formulaires publics.
// Valide les champs obligatoires ; les champs optionnels de branche A/B
// passent en .passthrough() pour ne pas bloquer les soumissions valides.

import { z } from 'zod';

const GENRES       = ['homme', 'femme'] as const;
const ETATS_CIVILS = ['celibataire', 'fiance', 'marie', 'divorce', 'veuf'] as const;
const STATUTS      = ['oui', 'non', 'premiere_visite'] as const;
const CANAUX       = ['presentiel', 'en_ligne'] as const;

export const createContactSchema = z.object({
  // Identité
  genre:  z.enum(GENRES),
  prenom: z.string().min(1, 'Prénom requis').max(100).trim(),
  nom:    z.string().min(1, 'Nom requis').max(100).trim(),
  telephone: z.string().regex(
    /^\+[1-9]\d{6,14}$/,
    'Numéro de téléphone invalide (format E.164 attendu : +33612345678)'
  ),
  email: z.string().email('Email invalide').max(255).optional().nullable(),

  // Localisation
  ville:       z.string().min(1, 'Ville requise').max(100).trim(),
  code_postal: z.string().max(20).optional().nullable(),

  // Statut
  etat_civil:   z.enum(ETATS_CIVILS),
  statut_phila: z.enum(STATUTS),
  canal:        z.enum(CANAUX),

  // RGPD — doit obligatoirement être true
  consentement_rgpd: z.boolean().refine(v => v === true, {
    message: 'Le consentement RGPD est obligatoire',
  }),

  // Anti-bot
  turnstile_token: z.string().min(1, 'Token Turnstile manquant'),
  website:         z.string().max(0, 'Honeypot non vide').optional().default(''),
}).passthrough(); // conserve les champs optionnels de branche A/B

export type CreateContactInput = z.infer<typeof createContactSchema>;
