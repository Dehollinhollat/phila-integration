# Multi-campus (Montpellier, Orléans) + paramètres par campus — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter Montpellier et Orléans comme campus de suivi, scoper les paramètres de messagerie (templates, infos église, verset) par campus avec permissions `admin_campus`, ouvrir les 3 formulaires publics au choix du campus, et corriger tous les endroits de l'app codés en dur pour 2 campus (trouvés lors d'un balayage complet — voir addendum de la spec).

**Architecture:** Le `Campus` de suivi (enum Prisma) passe de 2 à 4 valeurs — répercuté partout où il est référencé en dur. Les paramètres de messagerie migrent d'une table `Settings` globale vers une nouvelle table `CampusSettings` (une ligne par `[campus, key]`), via un nouveau helper `backend/src/lib/campusSettings.ts` réutilisé par `cron.ts`, `messages.controller.ts` et `contacts.controller.ts`. Les seuils d'alerte restent globaux dans `Settings`. Le frontend consolide tous ses libellés de campus dupliqués vers `frontend/src/utils/constants.ts` (`CAMPUS_LABELS`/`CAMPUS_OPTIONS`), ce qui règle mécaniquement la plupart des ~15 fichiers concernés.

**Tech Stack:** Node.js 20, Express, Prisma (PostgreSQL, `db push` — pas de dossier migrations), TypeScript strict, React 19, Jest (backend), Playwright (e2e frontend).

**Spec de référence :** `docs/superpowers/specs/2026-08-04-multi-campus-settings-design.md`

---

## Fichiers touchés (vue d'ensemble)

| Fichier | Action |
|---|---|
| `backend/prisma/schema.prisma` | Modifier — enums `Campus`, `DestinataireEvenement` ; nouveau modèle `CampusSettings` |
| `backend/src/middlewares/auth.middleware.ts` | Modifier — `CampusValue` |
| `backend/src/middlewares/roles.middleware.ts` | Modifier — `requireCampusAccess` redevient un middleware direct lisant `req.params.campus` |
| `backend/src/schemas/auth.schema.ts` | Modifier — `VALID_CAMPUS` |
| `backend/src/controllers/import.controller.ts` | Modifier — `mapCampus()` |
| `backend/src/controllers/stats.controller.ts` | Modifier — fallback `tauxConversion` |
| `backend/src/controllers/messages.controller.ts` | Modifier — `buildDestinataireWhere`, `sendBienvenue`, `createEvenement` |
| `backend/src/lib/campusSettings.ts` | Créer — helper de lecture des paramètres par campus |
| `backend/src/lib/cron.ts` | Modifier — tâches bienvenue J+3, événements, anniversaire, Nouvel An |
| `backend/src/controllers/settings.controller.ts` | Réécrire — 4 handlers (global + campus) |
| `backend/src/routes/settings.routes.ts` | Réécrire — nouvelles routes |
| `backend/src/controllers/contacts.controller.ts` | Modifier — verset certificat par campus |
| `backend/scripts/migrate-campus-settings.ts` | Créer — migration one-shot |
| `backend/src/__tests__/__mocks__/prisma.ts` | Modifier — mock `campusSettings` |
| `backend/src/__tests__/unit/campusSettings.test.ts` | Créer |
| `backend/src/__tests__/unit/settings.controller.test.ts` | Créer |
| `backend/src/__tests__/unit/roles.middleware.test.ts` | Créer |
| `frontend/src/types/index.ts` | Modifier — `Campus`, `DestinataireEvenement` |
| `frontend/src/utils/constants.ts` | Modifier — `CAMPUS_LABELS` + nouveau `DESTINATAIRE_LABELS` |
| `frontend/src/services/endpoints.ts` | Modifier — `settingsEndpoints` |
| `frontend/src/features/admin/Settings.tsx` | Réécrire — onglets campus + accès `admin_campus` |
| `frontend/src/layout/Sidebar.tsx` | Modifier — `minRole` Paramètres |
| `frontend/src/features/messages/EventScheduler.tsx` | Modifier |
| `frontend/src/pages/StatistiquesAvancees.tsx` | Modifier |
| `frontend/src/features/admin/UserManagement.tsx` | Modifier |
| `frontend/src/features/ouvriers/OuvrierList.tsx` | Modifier — labels + KPI dynamiques + filtre |
| `frontend/src/features/ouvriers/OuvrierForm.tsx` | Modifier |
| `frontend/src/pages/Dashboard.tsx` | Modifier — KPI par campus restructurés |
| `frontend/src/features/planning/PlanningTable.tsx` | Modifier |
| `frontend/src/features/planning/PlanningDetail.tsx` | Modifier |
| `frontend/src/features/planning/MesPlannings.tsx` | Modifier |
| `frontend/src/features/messages/MessageCompose.tsx` | Modifier |
| `frontend/src/features/messages/MessageHistory.tsx` | Modifier |
| `frontend/src/features/referents/ReferentList.tsx` | Modifier |
| `frontend/src/features/contacts/ContactList.tsx` | Modifier |
| `frontend/src/features/contacts/ContactDetail.tsx` | Modifier |
| `frontend/src/pages/FormPresentiel.tsx` | Modifier — champ campus |
| `frontend/src/pages/FormEnLigne.tsx` | Modifier — champ campus |
| `frontend/src/pages/FormOuvrier.tsx` | Modifier — 4 options |
| `frontend/e2e/formulaire.spec.ts` | Modifier |

---

## Ordre d'exécution

Les parties sont séquentielles (chacune dépend de la précédente) ; les tâches à l'intérieur d'une même partie sont indépendantes entre elles.

1. **Partie A** — Fondations backend (enum Campus, types, permissions)
2. **Partie B** — Balayage frontend (tous les fichiers "2 campus" codés en dur)
3. **Partie C** — Formulaires publics
4. **Partie D** — Backend : `CampusSettings` (modèle, helper, migration, controllers, cron)
5. **Partie E** — Frontend : UI des paramètres par campus

---

## Partie A — Fondations backend

### Task A1 : Étendre l'enum Campus et DestinataireEvenement dans Prisma

**Fichiers:**
- Modify: `backend/prisma/schema.prisma:116-119` et `:204-210`

- [ ] **Étape 1 : Étendre l'enum Campus**

Dans `backend/prisma/schema.prisma`, remplacer :

```prisma
enum Campus {
  paris
  paris_nord
}
```

Par :

```prisma
enum Campus {
  paris
  paris_nord
  orleans
  montpellier
}
```

- [ ] **Étape 2 : Étendre l'enum DestinataireEvenement**

Remplacer :

```prisma
enum DestinataireEvenement {
  tous                    // tous les contacts inscrits, tous campus
  profil_membre_phila     // uniquement les membres Phila
  profil_visiteur         // visiteurs_sans_eglise + visiteur_avec_eglise
  campus_paris            // uniquement le campus Paris
  campus_paris_nord       // uniquement le campus Paris Nord
}
```

Par :

```prisma
enum DestinataireEvenement {
  tous                    // tous les contacts inscrits, tous campus
  profil_membre_phila     // uniquement les membres Phila
  profil_visiteur         // visiteurs_sans_eglise + visiteur_avec_eglise
  campus_paris            // uniquement le campus Paris
  campus_paris_nord       // uniquement le campus Paris Nord
  campus_orleans          // uniquement le campus Orléans
  campus_montpellier      // uniquement le campus Montpellier
}
```

- [ ] **Étape 3 : Pousser le schéma et régénérer le client**

Run (depuis `backend/`) :
```bash
npx prisma db push
npx prisma generate
```
Expected: `Your database is now in sync with your Prisma schema.` puis génération du client sans erreur.

- [ ] **Étape 4 : Vérifier que le backend compile toujours**

Run : `npm run typecheck` (depuis `backend/`)
Expected: aucune erreur (les usages existants de `Campus` sont des unions structurelles compatibles).

- [ ] **Étape 5 : Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(campus): etendre Campus et DestinataireEvenement a Orleans et Montpellier

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task A2 : Généraliser `CampusValue` et `VALID_CAMPUS`

**Fichiers:**
- Modify: `backend/src/middlewares/auth.middleware.ts:14`
- Modify: `backend/src/schemas/auth.schema.ts:12`

- [ ] **Étape 1 : Étendre CampusValue**

Dans `backend/src/middlewares/auth.middleware.ts`, remplacer :

```ts
export type CampusValue = 'paris' | 'paris_nord';
```

Par :

```ts
export type CampusValue = 'paris' | 'paris_nord' | 'orleans' | 'montpellier';
```

- [ ] **Étape 2 : Étendre VALID_CAMPUS**

Dans `backend/src/schemas/auth.schema.ts`, remplacer :

```ts
const VALID_CAMPUS = ['paris', 'paris_nord'] as const;
```

Par :

```ts
const VALID_CAMPUS = ['paris', 'paris_nord', 'orleans', 'montpellier'] as const;
```

- [ ] **Étape 3 : Vérifier**

Run : `npm run typecheck` (depuis `backend/`)
Expected: aucune erreur.

- [ ] **Étape 4 : Commit**

```bash
git add backend/src/middlewares/auth.middleware.ts backend/src/schemas/auth.schema.ts
git commit -m "feat(campus): etendre CampusValue et VALID_CAMPUS a 4 campus

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task A3 : Redesigner `requireCampusAccess` en middleware direct

Le helper existant n'a jamais été utilisé nulle part (0 appelant dans le code) et sa signature (`campusParam` fixe passé au moment de la déclaration de route) ne convient pas à une route dynamique `/settings/campus/:campus`. On le transforme en middleware direct qui lit `req.params.campus`.

**Fichiers:**
- Modify: `backend/src/middlewares/roles.middleware.ts:53-73`
- Test: `backend/src/__tests__/unit/roles.middleware.test.ts`

- [ ] **Étape 1 : Écrire le test qui échoue**

Créer `backend/src/__tests__/unit/roles.middleware.test.ts` :

```ts
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
```

- [ ] **Étape 2 : Lancer le test pour vérifier qu'il échoue**

Run : `npm test -- roles.middleware.test.ts` (depuis `backend/`)
Expected: FAIL — `requireCampusAccess` prend actuellement un argument `campusParam` et retourne une fonction, pas un middleware direct ; les tests appellent la mauvaise signature.

- [ ] **Étape 3 : Réécrire requireCampusAccess**

Dans `backend/src/middlewares/roles.middleware.ts`, remplacer :

```ts
/**
 * Vérifie que l'utilisateur a accès au campus du contact demandé.
 * Le super_admin a accès à tous les campus.
 */
export function requireCampusAccess(campusParam: 'paris' | 'paris_nord') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Non authentifié' });
      return;
    }
    if (req.user.role === 'super_admin') {
      next();
      return;
    }
    if (!req.user.campus.includes(campusParam)) {
      res.status(403).json({ message: 'Accès refusé — campus non autorisé' });
      return;
    }
    next();
  };
}
```

Par :

```ts
/**
 * Vérifie que l'utilisateur a accès au campus passé en paramètre de route (:campus).
 * Le super_admin a accès à tous les campus. Utilisé par les routes /settings/campus/:campus.
 */
export function requireCampusAccess(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ message: 'Non authentifié' });
    return;
  }
  if (req.user.role === 'super_admin') {
    next();
    return;
  }
  const campusParam = req.params.campus;
  if (!req.user.campus.includes(campusParam as never)) {
    res.status(403).json({ message: 'Accès refusé — campus non autorisé' });
    return;
  }
  next();
}
```

- [ ] **Étape 4 : Lancer le test pour vérifier qu'il passe**

Run : `npm test -- roles.middleware.test.ts` (depuis `backend/`)
Expected: PASS (4/4).

- [ ] **Étape 5 : Commit**

```bash
git add backend/src/middlewares/roles.middleware.ts backend/src/__tests__/unit/roles.middleware.test.ts
git commit -m "feat(campus): requireCampusAccess devient un middleware direct sur req.params.campus

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task A4 : Étendre `mapCampus` (import Excel/CSV)

**Fichiers:**
- Modify: `backend/src/controllers/import.controller.ts:62-67`

- [ ] **Étape 1 : Étendre la reconnaissance de campus**

Remplacer :

```ts
function mapCampus(raw: string): 'paris' | 'paris_nord' | null {
  const v = (raw ?? '').toString().trim().toLowerCase().replace(/\s+/g, '');
  if (v === 'paris' || v === 'p') return 'paris';
  if (v.includes('nord') || v === 'pn' || v === 'parisnord') return 'paris_nord';
  return null;
}
```

Par :

```ts
function mapCampus(raw: string): 'paris' | 'paris_nord' | 'orleans' | 'montpellier' | null {
  const v = (raw ?? '').toString().trim().toLowerCase().replace(/\s+/g, '');
  if (v.includes('nord') || v === 'pn' || v === 'parisnord') return 'paris_nord';
  if (v === 'paris' || v === 'p') return 'paris';
  if (v.includes('orlean')) return 'orleans';
  if (v.includes('montpellier') || v === 'mtp') return 'montpellier';
  return null;
}
```

Note : le test `v.includes('nord')` reste évalué en premier pour continuer à distinguer "Paris Nord" de "Paris" avant le test générique `v === 'paris'`.

- [ ] **Étape 2 : Vérifier**

Run : `npm run typecheck` (depuis `backend/`)
Expected: aucune erreur.

- [ ] **Étape 3 : Commit**

```bash
git add backend/src/controllers/import.controller.ts
git commit -m "feat(campus): reconnaitre Orleans et Montpellier dans l'import Excel/CSV

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task A5 : `stats.controller.ts` — fallback tauxConversion

**Fichiers:**
- Modify: `backend/src/controllers/stats.controller.ts:1-15` (imports), `:194-198`

- [ ] **Étape 1 : Importer l'enum Campus généré par Prisma**

En haut de `backend/src/controllers/stats.controller.ts`, ajouter (à côté des imports existants) :

```ts
import { Campus } from '../../generated/prisma/client';
```

- [ ] **Étape 2 : Remplacer le fallback en dur**

Remplacer :

```ts
    const campuses = req.user!.role === 'super_admin'
      ? ['paris', 'paris_nord']
      : (req.user!.campus as string[]);
```

Par :

```ts
    const campuses = req.user!.role === 'super_admin'
      ? Object.values(Campus)
      : (req.user!.campus as string[]);
```

- [ ] **Étape 3 : Vérifier**

Run : `npm run typecheck` (depuis `backend/`)
Expected: aucune erreur.

- [ ] **Étape 4 : Commit**

```bash
git add backend/src/controllers/stats.controller.ts
git commit -m "feat(campus): tauxConversion utilise l'enum Campus complet pour super_admin

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task A6 : `messages.controller.ts` — nouveaux cas de ciblage par campus

**Fichiers:**
- Modify: `backend/src/controllers/messages.controller.ts:60-73`

- [ ] **Étape 1 : Ajouter les 2 nouveaux cas**

Remplacer :

```ts
export function buildDestinataireWhere(
  destinataires: string,
  campus: string | null
): Record<string, unknown> {
  switch (destinataires) {
    case 'profil_membre_phila':   return { profil: 'membre_phila' };
    case 'profil_visiteur':       return { profil: { in: ['visiteur_sans_eglise', 'visiteur_avec_eglise'] } };
    case 'campus_paris':          return { campus: 'paris' };
    case 'campus_paris_nord':     return { campus: 'paris_nord' };
    case 'tous':
    default:
      return campus ? { campus } : {};
  }
}
```

Par :

```ts
export function buildDestinataireWhere(
  destinataires: string,
  campus: string | null
): Record<string, unknown> {
  switch (destinataires) {
    case 'profil_membre_phila':   return { profil: 'membre_phila' };
    case 'profil_visiteur':       return { profil: { in: ['visiteur_sans_eglise', 'visiteur_avec_eglise'] } };
    case 'campus_paris':          return { campus: 'paris' };
    case 'campus_paris_nord':     return { campus: 'paris_nord' };
    case 'campus_orleans':        return { campus: 'orleans' };
    case 'campus_montpellier':    return { campus: 'montpellier' };
    case 'tous':
    default:
      return campus ? { campus } : {};
  }
}
```

- [ ] **Étape 2 : Vérifier**

Run : `npm run typecheck` (depuis `backend/`)
Expected: aucune erreur.

- [ ] **Étape 3 : Commit**

```bash
git add backend/src/controllers/messages.controller.ts
git commit -m "feat(campus): buildDestinataireWhere gere campus_orleans et campus_montpellier

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task A7 : `frontend/src/types/index.ts` — étendre Campus et DestinataireEvenement

**Fichiers:**
- Modify: `frontend/src/types/index.ts:33`, `:85-90`

- [ ] **Étape 1 : Étendre Campus**

Remplacer :

```ts
export type Campus = 'paris' | 'paris_nord';
```

Par :

```ts
export type Campus = 'paris' | 'paris_nord' | 'orleans' | 'montpellier';
```

- [ ] **Étape 2 : Étendre DestinataireEvenement**

Remplacer :

```ts
export type DestinataireEvenement =
  | 'tous'
  | 'profil_membre_phila'
  | 'profil_visiteur'
  | 'campus_paris'
  | 'campus_paris_nord';
```

Par :

```ts
export type DestinataireEvenement =
  | 'tous'
  | 'profil_membre_phila'
  | 'profil_visiteur'
  | 'campus_paris'
  | 'campus_paris_nord'
  | 'campus_orleans'
  | 'campus_montpellier';
```

- [ ] **Étape 3 : Commit (groupé avec Task A8, voir ci-dessous — laisser non commité pour l'instant)**

Ce fichier est commité à la fin de Task A8 (même unité logique : la source de vérité des types + labels).

---

### Task A8 : `frontend/src/utils/constants.ts` — CAMPUS_LABELS + DESTINATAIRE_LABELS

**Fichiers:**
- Modify: `frontend/src/utils/constants.ts:1-24`

- [ ] **Étape 1 : Étendre CAMPUS_LABELS**

Remplacer :

```ts
export const CAMPUS_LABELS: Record<Campus, string> = {
  paris:      'Paris',
  paris_nord: 'Paris Nord',
};
```

Par :

```ts
export const CAMPUS_LABELS: Record<Campus, string> = {
  paris:       'Paris',
  paris_nord:  'Paris Nord',
  orleans:     'Orléans',
  montpellier: 'Montpellier',
};
```

- [ ] **Étape 2 : Ajouter DESTINATAIRE_LABELS (nouveau, pour déduplication d'EventScheduler.tsx)**

Dans `frontend/src/utils/constants.ts`, ajouter l'import du type et le nouvel export. Remplacer la ligne d'import en tête de fichier :

```ts
import type {
  Campus, Role, StatutContact, Profil,
  Canal, EtatCivil, StatutPhila, Genre,
  Souhait, BesoinSpirituel, InteretCellule,
  DisponibiliteSuivi, Extension,
  StatutMessage, TypeMessage, StatutEvenement,
  Intention,
} from '../types';
```

Par :

```ts
import type {
  Campus, Role, StatutContact, Profil,
  Canal, EtatCivil, StatutPhila, Genre,
  Souhait, BesoinSpirituel, InteretCellule,
  DisponibiliteSuivi, Extension,
  StatutMessage, TypeMessage, StatutEvenement,
  Intention, DestinataireEvenement,
} from '../types';
```

Puis, juste après le bloc `CAMPUS_OPTIONS` (après la ligne `export const CAMPUS_OPTIONS = Object.entries(CAMPUS_LABELS).map(...)`), ajouter :

```ts

export const DESTINATAIRE_LABELS: Record<DestinataireEvenement, string> = {
  tous:                  'Tous',
  profil_membre_phila:   'Membres Phila',
  profil_visiteur:       'Visiteurs',
  campus_paris:          'Paris',
  campus_paris_nord:     'Paris Nord',
  campus_orleans:        'Orléans',
  campus_montpellier:    'Montpellier',
};
```

- [ ] **Étape 3 : Vérifier**

Run : `npm run build` (depuis `frontend/`)
Expected: build réussi, aucune erreur TypeScript.

- [ ] **Étape 4 : Commit (inclut Task A7)**

```bash
git add frontend/src/types/index.ts frontend/src/utils/constants.ts
git commit -m "feat(campus): etendre Campus/DestinataireEvenement et ajouter DESTINATAIRE_LABELS

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Partie B — Balayage frontend (fichiers codés en dur pour 2 campus)

Chaque tâche suit le même schéma : édition → `npm run build` (depuis `frontend/`) pour vérifier → commit. Pas de tests unitaires ajoutés ici (aucun fichier de ce groupe n'a de précédent de test dans le repo — cohérent avec l'existant).

### Task B1 : `EventScheduler.tsx`

**Fichiers:**
- Modify: `frontend/src/features/messages/EventScheduler.tsx:1-30`

- [ ] **Étape 1 : Importer les labels partagés et supprimer les définitions locales**

Remplacer :

```ts
import { evenementsEndpoints } from '../../services/endpoints';
import { useAuth } from '../../context/AuthContext';
import type { Evenement, Campus, StatutEvenement, DestinataireEvenement } from '../../types';

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUT_CFG: Record<StatutEvenement, { label: string; bg: string; text: string }> = {
  brouillon: { label: 'Brouillon', bg: 'var(--bg-secondary)',   text: 'var(--text-secondary)' },
  planifie:  { label: 'Planifié',  bg: '#fef3c7',               text: '#b45309' },
  envoye:    { label: 'Envoyé',    bg: '#dcfce7',               text: '#15803d' },
};

const DESTINATAIRE_LABELS: Record<DestinataireEvenement, string> = {
  tous:                  'Tous',
  profil_membre_phila:   'Membres Phila',
  profil_visiteur:       'Visiteurs',
  campus_paris:          'Paris',
  campus_paris_nord:     'Paris Nord',
};

const CAMPUS_LABELS: Record<string, string> = {
  paris:      'Paris',
  paris_nord: 'Paris Nord',
};
```

Par :

```ts
import { evenementsEndpoints } from '../../services/endpoints';
import { useAuth } from '../../context/AuthContext';
import { CAMPUS_LABELS, DESTINATAIRE_LABELS } from '../../utils/constants';
import type { Evenement, StatutEvenement } from '../../types';

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUT_CFG: Record<StatutEvenement, { label: string; bg: string; text: string }> = {
  brouillon: { label: 'Brouillon', bg: 'var(--bg-secondary)',   text: 'var(--text-secondary)' },
  planifie:  { label: 'Planifié',  bg: '#fef3c7',               text: '#b45309' },
  envoye:    { label: 'Envoyé',    bg: '#dcfce7',               text: '#15803d' },
};
```

Note : `Campus` et `DestinataireEvenement` ne sont plus importés directement ici — ils ne sont plus référencés comme types après suppression des objets locaux (vérifié par le build à l'étape 2 ; si le build signale un usage résiduel de l'un de ces deux types ailleurs dans le fichier, le réimporter depuis `../../types`).

- [ ] **Étape 2 : Vérifier**

Run : `npm run build` (depuis `frontend/`)
Expected: build réussi.

- [ ] **Étape 3 : Commit**

```bash
git add frontend/src/features/messages/EventScheduler.tsx
git commit -m "refactor(campus): EventScheduler utilise CAMPUS_LABELS/DESTINATAIRE_LABELS partages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task B2 : `StatistiquesAvancees.tsx`

**Fichiers:**
- Modify: `frontend/src/pages/StatistiquesAvancees.tsx:23-33`

- [ ] **Étape 1 : Remplacer la définition locale par l'import partagé**

Remplacer :

```ts
import type {
  TauxConversionData,
  TempsIntegrationData,
  PerformanceReferentData,
  EvolutionHebdomadaireData,
} from '../types';

const CAMPUS_LABELS: Record<string, string> = {
  paris:      'Paris',
  paris_nord: 'Paris Nord',
};
```

Par :

```ts
import type {
  TauxConversionData,
  TempsIntegrationData,
  PerformanceReferentData,
  EvolutionHebdomadaireData,
} from '../types';
import { CAMPUS_LABELS } from '../utils/constants';
```

- [ ] **Étape 2 : Vérifier**

Run : `npm run build` (depuis `frontend/`)
Expected: build réussi.

- [ ] **Étape 3 : Commit**

```bash
git add frontend/src/pages/StatistiquesAvancees.tsx
git commit -m "refactor(campus): StatistiquesAvancees utilise CAMPUS_LABELS partage

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task B3 : `UserManagement.tsx`

**Fichiers:**
- Modify: `frontend/src/features/admin/UserManagement.tsx:1-28`, `:384`, `:541`

- [ ] **Étape 1 : Importer CAMPUS_LABELS/CAMPUS_OPTIONS, supprimer les définitions locales**

Remplacer :

```ts
import { usersAdminEndpoints } from '../../services/endpoints';
import type { DeleteConflict } from '../../services/endpoints';
import { useAuth } from '../../context/AuthContext';
import type { User, Role, Campus, ConnectionLog } from '../../types';

// ─── Config ───────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<Role, { label: string; bg: string; text: string; desc: string }> = {
  super_admin:           { label: 'Super Admin',    bg: 'var(--badge-integre-bg)',   text: 'var(--badge-integre-text)',   desc: 'Accès total, tous campus, configuration système' },
  admin_campus:          { label: 'Admin Campus',   bg: 'var(--badge-contacte-bg)',  text: 'var(--badge-contacte-text)',  desc: 'Gestion complète de son campus' },
  referent_eglise:       { label: 'Réf. Église',    bg: 'var(--badge-ensuivi-bg)',   text: 'var(--badge-ensuivi-text)',   desc: 'Suivi pastoral approfondi' },
  referent_integration:  { label: 'Réf. Intégration',bg: 'var(--badge-nouveau-bg)', text: 'var(--badge-nouveau-text)',   desc: 'Premier suivi des nouveaux' },
  lecteur:               { label: 'Lecteur',         bg: 'var(--badge-inactif-bg)',  text: 'var(--badge-inactif-text)',   desc: 'Consultation uniquement' },
};

const CAMPUS_LABELS: Record<Campus, string> = {
  paris:      'Paris',
  paris_nord: 'Paris Nord',
};

const ALL_CAMPUS: Campus[] = ['paris', 'paris_nord'];
```

Par :

```ts
import { usersAdminEndpoints } from '../../services/endpoints';
import type { DeleteConflict } from '../../services/endpoints';
import { useAuth } from '../../context/AuthContext';
import { CAMPUS_LABELS, CAMPUS_OPTIONS } from '../../utils/constants';
import type { User, Role, Campus, ConnectionLog } from '../../types';

// ─── Config ───────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<Role, { label: string; bg: string; text: string; desc: string }> = {
  super_admin:           { label: 'Super Admin',    bg: 'var(--badge-integre-bg)',   text: 'var(--badge-integre-text)',   desc: 'Accès total, tous campus, configuration système' },
  admin_campus:          { label: 'Admin Campus',   bg: 'var(--badge-contacte-bg)',  text: 'var(--badge-contacte-text)',  desc: 'Gestion complète de son campus' },
  referent_eglise:       { label: 'Réf. Église',    bg: 'var(--badge-ensuivi-bg)',   text: 'var(--badge-ensuivi-text)',   desc: 'Suivi pastoral approfondi' },
  referent_integration:  { label: 'Réf. Intégration',bg: 'var(--badge-nouveau-bg)', text: 'var(--badge-nouveau-text)',   desc: 'Premier suivi des nouveaux' },
  lecteur:               { label: 'Lecteur',         bg: 'var(--badge-inactif-bg)',  text: 'var(--badge-inactif-text)',   desc: 'Consultation uniquement' },
};

const ALL_CAMPUS: Campus[] = CAMPUS_OPTIONS.map(o => o.value);
```

- [ ] **Étape 2 : Vérifier que les 2 usages existants de ALL_CAMPUS (lignes 384 et 541 avant édition) fonctionnent sans changement**

Aucune édition nécessaire à ces lignes : `ALL_CAMPUS.map(c => <option key={c} value={c}>{CAMPUS_LABELS[c]}</option>)` continue de fonctionner tel quel, `CAMPUS_LABELS` étant maintenant importé.

- [ ] **Étape 3 : Vérifier**

Run : `npm run build` (depuis `frontend/`)
Expected: build réussi.

- [ ] **Étape 4 : Commit**

```bash
git add frontend/src/features/admin/UserManagement.tsx
git commit -m "refactor(campus): UserManagement derive ALL_CAMPUS de CAMPUS_OPTIONS partage

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task B3bis : Scoper `admin_campus` à ses propres campus dans la gestion utilisateurs

Trouvé pendant la revue qualité de B3 : un `admin_campus` peut, dans « Gestion utilisateurs », cocher n'importe quel campus (y compris ceux hors de son périmètre) pour un nouvel utilisateur ou une modification — côté formulaire ET côté API, sans aucune vérification serveur. Le trou est préexistant (déjà vrai avec 2 campus) mais s'aggrave avec 4 campus. Décidé avec l'utilisateur : corrigé maintenant plutôt que reporté.

**Fichiers:**
- Modify: `backend/src/controllers/users.controller.ts:131-169` (createUser), `:171-217` (updateUser)
- Modify: `frontend/src/features/admin/UserManagement.tsx:535-544`

- [ ] **Étape 1 : Backend — `createUser` refuse un campus hors du périmètre de l'admin_campus appelant**

Remplacer :

```ts
  // Un admin_campus ne peut pas créer un super_admin
  if (req.user!.role === 'admin_campus' && role === 'super_admin') {
    res.status(403).json({ message: 'Non autorisé à créer un Super Administrateur' });
    return;
  }

  const exists = await prisma.user.findUnique({ where: { email } });
```

Par :

```ts
  // Un admin_campus ne peut pas créer un super_admin
  if (req.user!.role === 'admin_campus' && role === 'super_admin') {
    res.status(403).json({ message: 'Non autorisé à créer un Super Administrateur' });
    return;
  }

  // Un admin_campus ne peut assigner que ses propres campus, jamais un campus hors de son périmètre
  if (req.user!.role === 'admin_campus') {
    const campusHorsPerimetre = (campus ?? []).some(c => !req.user!.campus.includes(c as never));
    if (campusHorsPerimetre) {
      res.status(403).json({ message: 'Non autorisé à assigner un campus hors de votre périmètre' });
      return;
    }
  }

  const exists = await prisma.user.findUnique({ where: { email } });
```

- [ ] **Étape 2 : Backend — `updateUser` applique la même règle**

Remplacer :

```ts
  // Un admin_campus ne peut pas modifier un super_admin ni lui attribuer ce rôle
  if (req.user!.role === 'admin_campus') {
    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (target?.role === 'super_admin') {
      res.status(403).json({ message: 'Non autorisé à modifier un Super Administrateur' });
      return;
    }
    if (role === 'super_admin') {
      res.status(403).json({ message: 'Non autorisé à attribuer le rôle Super Administrateur' });
      return;
    }
  }
```

Par :

```ts
  // Un admin_campus ne peut pas modifier un super_admin ni lui attribuer ce rôle
  if (req.user!.role === 'admin_campus') {
    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (target?.role === 'super_admin') {
      res.status(403).json({ message: 'Non autorisé à modifier un Super Administrateur' });
      return;
    }
    if (role === 'super_admin') {
      res.status(403).json({ message: 'Non autorisé à attribuer le rôle Super Administrateur' });
      return;
    }
    // Un admin_campus ne peut assigner que ses propres campus, jamais un campus hors de son périmètre
    if (campus !== undefined) {
      const campusHorsPerimetre = campus.some(c => !req.user!.campus.includes(c as never));
      if (campusHorsPerimetre) {
        res.status(403).json({ message: 'Non autorisé à assigner un campus hors de votre périmètre' });
        return;
      }
    }
  }
```

- [ ] **Étape 3 : Frontend — la liste de cases à cocher se limite aux campus de l'admin_campus connecté**

Remplacer :

```tsx
              <Field label="Campus" style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  {ALL_CAMPUS.map(c => (
                    <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={form.campus.includes(c)} onChange={() => toggleCampus(c)} />
                      {CAMPUS_LABELS[c]}
                    </label>
                  ))}
                </div>
              </Field>
```

Par :

```tsx
              <Field label="Campus" style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  {(isAdminCampus ? ALL_CAMPUS.filter(c => currentUser?.campus.includes(c)) : ALL_CAMPUS).map(c => (
                    <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={form.campus.includes(c)} onChange={() => toggleCampus(c)} />
                      {CAMPUS_LABELS[c]}
                    </label>
                  ))}
                </div>
              </Field>
```

- [ ] **Étape 4 : Tests backend (TDD)**

Créer/étendre `backend/src/__tests__/unit/users.controller.test.ts` (créer le fichier s'il n'existe pas déjà — vérifier d'abord) avec au minimum :

```ts
// Ajout aux tests existants de users.controller.ts, ou nouveau fichier si aucun n'existe.
// Vérifie qu'un admin_campus ne peut pas assigner un campus hors de son perimetre.

import { createUser, updateUser } from '../../controllers/users.controller';
import prisma from '../../lib/prisma';

function mockRes() {
  const jsonMock = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return { res: { status: statusMock, json: jsonMock } as never, statusMock, jsonMock };
}

describe('createUser - perimetre campus admin_campus', () => {
  it('refuse la creation si un campus demande est hors du perimetre de l\'admin_campus', async () => {
    const { res, statusMock } = mockRes();
    const req = {
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
      body: { prenom: 'Jean', nom: 'Dupont', email: 'jean@test.fr', role: 'lecteur', campus: ['paris', 'orleans'] },
    } as never;
    await createUser(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
  });

  it('autorise la creation si tous les campus demandes sont dans le perimetre', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue({ id: 'u1', email: 'jean@test.fr', prenom: 'Jean', role: 'lecteur' });
    const { res, statusMock } = mockRes();
    const req = {
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris', 'paris_nord'] },
      body: { prenom: 'Jean', nom: 'Dupont', email: 'jean@test.fr', role: 'lecteur', campus: ['paris'] },
    } as never;
    await createUser(req, res);
    expect(statusMock).not.toHaveBeenCalledWith(403);
  });
});

describe('updateUser - perimetre campus admin_campus', () => {
  it('refuse la modification si un campus demande est hors du perimetre', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'lecteur' });
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'u1' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
      body: { campus: ['montpellier'] },
    } as never;
    await updateUser(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
  });
});
```

Note : si `backend/src/__tests__/unit/users.controller.test.ts` existe déjà avec un mock `prisma.user` différent, adapter les mocks ci-dessus au pattern déjà en place dans ce fichier plutôt que de le dupliquer — vérifier d'abord avec `Read`/`Glob`.

Run : `npm test -- users.controller.test.ts` (depuis `backend/`) → doit passer.

- [ ] **Étape 5 : Vérifier**

Run (depuis `backend/`) : `npm run typecheck && npm test`
Run (depuis `frontend/`) : `npm run build`
Expected : aucune erreur, suite verte.

- [ ] **Étape 6 : Commit**

```bash
git add backend/src/controllers/users.controller.ts frontend/src/features/admin/UserManagement.tsx backend/src/__tests__/unit/users.controller.test.ts
git commit -m "fix(security): admin_campus ne peut plus assigner un campus hors de son perimetre

Trouve pendant la revue qualite de Task B3. Cote backend (createUser/updateUser)
et frontend (case a cocher campus), un admin_campus pouvait jusqu'ici assigner
n'importe quel campus a un compte, pas seulement les siens.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task B3ter : `resetPassword` — combler l'absence totale de garde-fou (Critical)

Trouvé pendant la revue qualité de B3bis : `resetPassword` (PATCH /api/users/:id/password) n'a **aucune** vérification — ni de rôle cible, ni de campus. Un `admin_campus` peut réinitialiser le mot de passe de n'importe quel compte, y compris un `super_admin`, et donc se connecter à sa place. `toggleStatut` a déjà la vérification de rôle (bloque un `admin_campus` sur une cible `super_admin`) mais pas la vérification de campus. Décidé avec l'utilisateur : corrigé dans ce même chantier.

**Fichiers:**
- Modify: `backend/src/controllers/users.controller.ts` (nouvel helper + `resetPassword` + `toggleStatut`)
- Modify: `backend/src/__tests__/unit/users.controller.test.ts` (tests ajoutés)

- [ ] **Étape 1 : Ajouter un helper partagé**

Ajouter, avant `export async function createUser` (avec les autres helpers en haut du fichier, après `genererMotDePasseProvisoire`) :

```ts
// Vérifie qu'un admin_campus a le droit d'agir sur le compte cible : ni un super_admin,
// ni un compte hors de son propre périmètre de campus. Retourne un message d'erreur si
// refusé, ou null si autorisé. Le super_admin (appelant) n'est jamais restreint.
// La cible introuvable (404) reste gérée séparément par chaque appelant.
async function verifierPerimetreCible(req: Request, targetId: string): Promise<string | null> {
  if (req.user!.role !== 'admin_campus') return null;

  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { role: true, campus: true } });
  if (!target) return null;

  if (target.role === 'super_admin') {
    return 'Non autorisé à agir sur un Super Administrateur';
  }
  const horsPerimetre = !target.campus.some(c => req.user!.campus.includes(c as never));
  if (horsPerimetre) {
    return 'Non autorisé à agir sur un compte hors de votre périmètre';
  }
  return null;
}
```

- [ ] **Étape 2 : `resetPassword` utilise le helper**

Remplacer :

```ts
// PATCH /api/users/:id/password
export async function resetPassword(req: Request, res: Response): Promise<void> {
  const id = req.params['id'] as string;
  const { password } = req.body as { password: string };

  if (!password || password.length < 8) {
    res.status(400).json({ message: 'Le mot de passe doit contenir au moins 8 caractères' });
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id }, data: { password: hashed } });
  res.json({ message: 'Mot de passe réinitialisé' });
}
```

Par :

```ts
// PATCH /api/users/:id/password
export async function resetPassword(req: Request, res: Response): Promise<void> {
  const id = req.params['id'] as string;
  const { password } = req.body as { password: string };

  if (!password || password.length < 8) {
    res.status(400).json({ message: 'Le mot de passe doit contenir au moins 8 caractères' });
    return;
  }

  const refus = await verifierPerimetreCible(req, id);
  if (refus) {
    res.status(403).json({ message: refus });
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id }, data: { password: hashed } });
  res.json({ message: 'Mot de passe réinitialisé' });
}
```

- [ ] **Étape 3 : `toggleStatut` — ajouter la vérification de campus manquante (le rôle est déjà vérifié)**

Remplacer :

```ts
  const current = await prisma.user.findUnique({ where: { id }, select: { actif: true, role: true } });
  if (!current) {
    res.status(404).json({ message: 'Utilisateur introuvable' });
    return;
  }

  // Un admin_campus ne peut pas désactiver un super_admin
  if (req.user!.role === 'admin_campus' && current.role === 'super_admin') {
    res.status(403).json({ message: 'Non autorisé à modifier le statut d\'un Super Administrateur' });
    return;
  }
```

Par :

```ts
  const current = await prisma.user.findUnique({ where: { id }, select: { actif: true, role: true, campus: true } });
  if (!current) {
    res.status(404).json({ message: 'Utilisateur introuvable' });
    return;
  }

  // Un admin_campus ne peut pas désactiver un super_admin, ni un compte hors de son périmètre
  if (req.user!.role === 'admin_campus') {
    if (current.role === 'super_admin') {
      res.status(403).json({ message: 'Non autorisé à modifier le statut d\'un Super Administrateur' });
      return;
    }
    const horsPerimetre = !current.campus.some(c => req.user!.campus.includes(c as never));
    if (horsPerimetre) {
      res.status(403).json({ message: 'Non autorisé à modifier le statut d\'un compte hors de votre périmètre' });
      return;
    }
  }
```

- [ ] **Étape 4 : Tests**

Ajouter à `backend/src/__tests__/unit/users.controller.test.ts` :

```ts
import { resetPassword, toggleStatut } from '../../controllers/users.controller';

describe('resetPassword - perimetre admin_campus', () => {
  it('refuse la reinitialisation sur un super_admin cible', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'super_admin', campus: ['paris'] });
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'target-1' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
      body: { password: 'motdepasse123' },
    } as never;
    await resetPassword(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
  });

  it('refuse la reinitialisation sur un compte hors du perimetre campus', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'lecteur', campus: ['orleans'] });
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'target-1' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
      body: { password: 'motdepasse123' },
    } as never;
    await resetPassword(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
  });

  it('autorise la reinitialisation sur un compte du meme perimetre', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'lecteur', campus: ['paris'] });
    (prisma.user.update as jest.Mock).mockResolvedValue({});
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'target-1' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
      body: { password: 'motdepasse123' },
    } as never;
    await resetPassword(req, res);
    expect(statusMock).not.toHaveBeenCalledWith(403);
  });
});

describe('toggleStatut - perimetre admin_campus', () => {
  it('refuse le changement de statut sur un compte hors du perimetre campus', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ actif: true, role: 'lecteur', campus: ['montpellier'] });
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'target-1' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
    } as never;
    await toggleStatut(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
  });
});
```

Note : si `mockRes` est déjà défini en haut du fichier de test (créé dans Task B3bis), le réutiliser tel quel plutôt que de le redéfinir.

Run : `npm test -- users.controller.test.ts` (depuis `backend/`) → doit passer.

- [ ] **Étape 5 : Vérifier**

Run (depuis `backend/`) : `npm run typecheck && npm test`
Expected : aucune erreur, suite verte.

- [ ] **Étape 6 : Commit**

```bash
git add backend/src/controllers/users.controller.ts backend/src/__tests__/unit/users.controller.test.ts
git commit -m "fix(security): resetPassword et toggleStatut verifient desormais le perimetre admin_campus

resetPassword n'avait aucune verification (ni role cible, ni campus) - un
admin_campus pouvait reinitialiser le mot de passe de n'importe quel compte,
y compris un super_admin. toggleStatut verifiait deja le role mais pas le
campus. Trouve pendant la revue qualite de Task B3bis.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task B3quater : `listConnexions` — dernier correctif de la série sécurité users.controller.ts

Trouvé pendant la revue qualité de B3ter : `listConnexions` (lecture seule) n'a aucune vérification — un `admin_campus` peut consulter l'historique de connexion (IP, user-agent, échecs) de n'importe quel compte, y compris hors de son campus ou un `super_admin`. Dernier correctif de cette série avant de reprendre le plan multi-campus.

**Fichiers:**
- Modify: `backend/src/controllers/users.controller.ts` (fonction `listConnexions` uniquement)
- Modify: `backend/src/__tests__/unit/users.controller.test.ts`

- [ ] **Étape 1 : `listConnexions` réutilise le helper existant**

Remplacer :

```ts
export async function listConnexions(req: Request, res: Response): Promise<void> {
  const id = req.params['id'] as string;
  const logs = await prisma.connectionLog.findMany({
    where:   { user_id: id },
    orderBy: { created_at: 'desc' },
    take:    20,
    select: { id: true, ip: true, user_agent: true, succes: true, raison: true, created_at: true },
  });
  res.json(logs);
}
```

Par :

```ts
export async function listConnexions(req: Request, res: Response): Promise<void> {
  const id = req.params['id'] as string;

  const refus = await verifierPerimetreCible(req, id);
  if (refus) {
    res.status(403).json({ message: refus });
    return;
  }

  const logs = await prisma.connectionLog.findMany({
    where:   { user_id: id },
    orderBy: { created_at: 'desc' },
    take:    20,
    select: { id: true, ip: true, user_agent: true, succes: true, raison: true, created_at: true },
  });
  res.json(logs);
}
```

- [ ] **Étape 2 : Test**

Ajouter à `backend/src/__tests__/unit/users.controller.test.ts` (import `listConnexions` en plus des fonctions déjà importées) :

```ts
describe('listConnexions - perimetre admin_campus', () => {
  it('refuse la consultation de l\'historique sur un compte hors du perimetre', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'lecteur', campus: ['orleans'] });
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'target-1' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
    } as never;
    await listConnexions(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
  });
});
```

- [ ] **Étape 3 : Vérifier**

Run (depuis `backend/`) : `npm run typecheck && npm test`
Expected : aucune erreur, suite verte.

- [ ] **Étape 4 : Commit**

```bash
git add backend/src/controllers/users.controller.ts backend/src/__tests__/unit/users.controller.test.ts
git commit -m "fix(security): listConnexions verifie desormais le perimetre admin_campus

Dernier correctif de la serie users.controller.ts (B3 -> B3bis -> B3ter ->
B3quater). Un admin_campus pouvait consulter l'historique de connexion
(IP, user-agent, echecs) de n'importe quel compte.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

Cette tâche clôt définitivement le volet sécurité de `users.controller.ts` — la suite du plan (Task B4 et après) reprend le balayage "2 campus codés en dur" sur le reste du frontend.

---

### Task B4 : `OuvrierList.tsx` — labels, KPI dynamiques par campus, filtre

Demande explicite de l'utilisateur : total et filtre par campus sur l'écran Ouvriers. Le filtre existe déjà structurellement (état `campus`, appel API) mais le `<select>` et les cartes KPI sont figés à 2 campus.

**Fichiers:**
- Modify: `frontend/src/features/ouvriers/OuvrierList.tsx:11-42`, `:183-187`, `:236-239`, `:265-269`

- [ ] **Étape 1 : Importer CAMPUS_LABELS/CAMPUS_OPTIONS, supprimer la définition locale**

Remplacer :

```ts
import { ouvriersEndpoints } from '../../services/endpoints';
import { useAuth } from '../../context/AuthContext';
import { ROLE_RANK } from '../../utils/constants';
import type { Ouvrier } from '../../types';
```

Par :

```ts
import { ouvriersEndpoints } from '../../services/endpoints';
import { useAuth } from '../../context/AuthContext';
import { ROLE_RANK, CAMPUS_LABELS, CAMPUS_OPTIONS } from '../../utils/constants';
import type { Ouvrier } from '../../types';
```

Puis remplacer :

```ts
const CAMPUS_LABELS: Record<string, string> = { paris: 'Paris', paris_nord: 'Paris Nord' };
```

Par (supprimé — plus rien à cet endroit, la ligne est retirée).

- [ ] **Étape 2 : Rendre les stats par campus dynamiques**

Remplacer :

```ts
  // ── Stats calculées depuis les données ───────────────────────────────────
  const actifs       = ouvriers.filter(o => o.statut);
  const totalActifs  = actifs.length;
  const campusParis  = actifs.filter(o => o.campus === 'paris').length;
  const campusNord   = actifs.filter(o => o.campus === 'paris_nord').length;
```

Par :

```ts
  // ── Stats calculées depuis les données ───────────────────────────────────
  const actifs       = ouvriers.filter(o => o.statut);
  const totalActifs  = actifs.length;
  const parCampus    = CAMPUS_OPTIONS.map(({ value, label }) => ({
    label,
    count: actifs.filter(o => o.campus === value).length,
  }));
```

- [ ] **Étape 3 : Rendre les cartes KPI dynamiques**

Remplacer :

```tsx
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <KpiCard value={totalActifs}  label="Ouvriers actifs" />
        <KpiCard value={campusParis}  label="Paris" />
        <KpiCard value={campusNord}   label="Paris Nord" />
        {topService && (
```

Par :

```tsx
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <KpiCard value={totalActifs} label="Ouvriers actifs" />
        {parCampus.map(pc => (
          <KpiCard key={pc.label} value={pc.count} label={pc.label} />
        ))}
        {topService && (
```

- [ ] **Étape 4 : Étendre le filtre campus**

Remplacer :

```tsx
        <select value={campus} onChange={e => setCampus(e.target.value)} style={selectStyle}>
          <option value="">Tous les campus</option>
          <option value="paris">Paris</option>
          <option value="paris_nord">Paris Nord</option>
        </select>
```

Par :

```tsx
        <select value={campus} onChange={e => setCampus(e.target.value)} style={selectStyle}>
          <option value="">Tous les campus</option>
          {CAMPUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
```

- [ ] **Étape 5 : Vérifier**

Run : `npm run build` (depuis `frontend/`)
Expected: build réussi.

- [ ] **Étape 6 : Commit**

```bash
git add frontend/src/features/ouvriers/OuvrierList.tsx
git commit -m "feat(campus): OuvrierList - KPI et filtre dynamiques sur les 4 campus

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task B5 : `OuvrierForm.tsx`

**Fichiers:**
- Modify: `frontend/src/features/ouvriers/OuvrierForm.tsx` (imports en tête, ligne ~224, lignes ~356-362)

- [ ] **Étape 1 : Importer CAMPUS_OPTIONS**

Dans le bloc d'imports en tête de fichier, ajouter (à côté des imports `services`/`context` existants) :

```ts
import { CAMPUS_OPTIONS } from '../../utils/constants';
```

- [ ] **Étape 2 : Retirer le cast à 2 valeurs**

Remplacer :

```ts
          campus:              campus as 'paris' | 'paris_nord',
```

Par :

```ts
          campus:              campus as Campus,
```

Ajouter `Campus` à l'import de types en tête de fichier s'il n'y est pas déjà (vérifier l'import `from '../../types'` existant et y ajouter `Campus` s'il manque).

- [ ] **Étape 3 : Étendre le sélecteur à 4 options**

Remplacer :

```tsx
            <Select value={campus} onChange={e => setCampus(e.target.value)}>
              <option value="paris">Paris</option>
              <option value="paris_nord">Paris Nord</option>
            </Select>
```

Par :

```tsx
            <Select value={campus} onChange={e => setCampus(e.target.value)}>
              {CAMPUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
```

- [ ] **Étape 4 : Vérifier**

Run : `npm run build` (depuis `frontend/`)
Expected: build réussi.

- [ ] **Étape 5 : Commit**

```bash
git add frontend/src/features/ouvriers/OuvrierForm.tsx
git commit -m "feat(campus): OuvrierForm propose les 4 campus a la creation/edition

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task B5bis : `ouvriers.controller.ts` — même faille de périmètre que users.controller.ts

Trouvé pendant la revue qualité de B5 : `createOuvrier`, `updateOuvrier`, `toggleStatut`, `deactivateOuvrier`, `deleteOuvrier` n'ont aucune vérification de périmètre campus pour un `admin_campus` — exactement la même classe de faille que celle corrigée sur `users.controller.ts` (B3bis → B3quater). Décidé avec l'utilisateur : corrigé ici, sans étendre l'audit à d'autres controllers (contacts, planning) dans ce chantier.

**Fichiers:**
- Modify: `backend/src/controllers/ouvriers.controller.ts`
- Create: `backend/src/__tests__/unit/ouvriers.controller.test.ts` (n'existe pas encore)
- Modify: `frontend/src/features/ouvriers/OuvrierForm.tsx`

- [ ] **Étape 1 : Ajouter un helper de périmètre**

Ajouter, juste après les imports en tête de `backend/src/controllers/ouvriers.controller.ts` :

```ts
// Vérifie qu'un admin_campus a le droit d'agir sur un ouvrier de ce campus.
// Retourne true si refusé (hors périmètre). Le super_admin n'est jamais restreint.
// Les ouvriers n'ont pas de rôle (contrairement à User) — seule la vérification
// de campus s'applique ici.
function horsPerimetreCampus(req: Request, campusCible: string): boolean {
  return req.user!.role === 'admin_campus' && !req.user!.campus.includes(campusCible as never);
}
```

- [ ] **Étape 2 : `createOuvrier` — vérifier le campus dans les deux branches (promotion et inscription directe)**

Dans la branche promotion (après le `if (!contact) { ... }`), remplacer :

```ts
      const alreadyOuvrier = await prisma.ouvrier.findUnique({ where: { contact_id } });
      if (alreadyOuvrier) {
        res.status(409).json({ message: 'Ce contact est déjà ouvrier' });
        return;
      }
```

Par :

```ts
      if (horsPerimetreCampus(req, contact.campus)) {
        res.status(403).json({ message: 'Non autorisé à créer un ouvrier hors de votre périmètre' });
        return;
      }

      const alreadyOuvrier = await prisma.ouvrier.findUnique({ where: { contact_id } });
      if (alreadyOuvrier) {
        res.status(409).json({ message: 'Ce contact est déjà ouvrier' });
        return;
      }
```

Dans la branche inscription directe, remplacer :

```ts
    // ── Mode inscription directe ─────────────────────────────────────────────
    const ouvrier = await prisma.ouvrier.create({
```

Par :

```ts
    // ── Mode inscription directe ─────────────────────────────────────────────
    if (horsPerimetreCampus(req, campus)) {
      res.status(403).json({ message: 'Non autorisé à créer un ouvrier hors de votre périmètre' });
      return;
    }

    const ouvrier = await prisma.ouvrier.create({
```

- [ ] **Étape 3 : `updateOuvrier` — vérifier le campus actuel ET le nouveau campus demandé**

Remplacer :

```ts
    const exists = await prisma.ouvrier.findUnique({ where: { id } });
    if (!exists) {
      res.status(404).json({ message: 'Ouvrier introuvable' });
      return;
    }

    const data: Record<string, unknown> = {};
```

Par :

```ts
    const exists = await prisma.ouvrier.findUnique({ where: { id } });
    if (!exists) {
      res.status(404).json({ message: 'Ouvrier introuvable' });
      return;
    }
    // Le campus ACTUEL de l'ouvrier doit être dans le périmètre de l'admin (sinon il ne
    // peut même pas éditer cette fiche), et s'il change de campus, le NOUVEAU campus
    // demandé doit aussi être dans son périmètre (sinon il pourrait "voler" un ouvrier
    // vers un campus qu'il ne gère pas).
    if (horsPerimetreCampus(req, exists.campus)) {
      res.status(403).json({ message: 'Non autorisé à modifier un ouvrier hors de votre périmètre' });
      return;
    }
    if (campus !== undefined && horsPerimetreCampus(req, campus)) {
      res.status(403).json({ message: 'Non autorisé à déplacer un ouvrier vers un campus hors de votre périmètre' });
      return;
    }

    const data: Record<string, unknown> = {};
```

- [ ] **Étape 4 : `toggleStatut` — vérifier le campus**

Remplacer :

```ts
    const ouvrier = await prisma.ouvrier.findUnique({ where: { id } });
    if (!ouvrier) {
      res.status(404).json({ message: 'Ouvrier introuvable' });
      return;
    }

    // Si statut fourni → forcer ; sinon toggle
```

Par :

```ts
    const ouvrier = await prisma.ouvrier.findUnique({ where: { id } });
    if (!ouvrier) {
      res.status(404).json({ message: 'Ouvrier introuvable' });
      return;
    }
    if (horsPerimetreCampus(req, ouvrier.campus)) {
      res.status(403).json({ message: 'Non autorisé à modifier le statut d\'un ouvrier hors de votre périmètre' });
      return;
    }

    // Si statut fourni → forcer ; sinon toggle
```

- [ ] **Étape 5 : `deactivateOuvrier` — ajouter la lecture préalable + vérification (n'existait pas du tout)**

Remplacer :

```ts
export async function deactivateOuvrier(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params['id'] as string;
    await prisma.ouvrier.update({ where: { id }, data: { statut: false } });
    res.json({ message: 'Ouvrier désactivé' });
  } catch (err) {
    console.error('[deactivateOuvrier]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}
```

Par :

```ts
export async function deactivateOuvrier(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params['id'] as string;
    const ouvrier = await prisma.ouvrier.findUnique({ where: { id } });
    if (!ouvrier) {
      res.status(404).json({ message: 'Ouvrier introuvable' });
      return;
    }
    if (horsPerimetreCampus(req, ouvrier.campus)) {
      res.status(403).json({ message: 'Non autorisé à désactiver un ouvrier hors de votre périmètre' });
      return;
    }
    await prisma.ouvrier.update({ where: { id }, data: { statut: false } });
    res.json({ message: 'Ouvrier désactivé' });
  } catch (err) {
    console.error('[deactivateOuvrier]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}
```

- [ ] **Étape 6 : `deleteOuvrier` — vérifier le campus (l'ouvrier est déjà chargé)**

Remplacer :

```ts
    const ouvrier = await prisma.ouvrier.findUnique({ where: { id } });
    if (!ouvrier) {
      res.status(404).json({ message: 'Ouvrier introuvable' });
      return;
    }
    await prisma.$transaction([
```

Par :

```ts
    const ouvrier = await prisma.ouvrier.findUnique({ where: { id } });
    if (!ouvrier) {
      res.status(404).json({ message: 'Ouvrier introuvable' });
      return;
    }
    if (horsPerimetreCampus(req, ouvrier.campus)) {
      res.status(403).json({ message: 'Non autorisé à supprimer un ouvrier hors de votre périmètre' });
      return;
    }
    await prisma.$transaction([
```

- [ ] **Étape 7 : Frontend — filtrer les campus proposés dans `OuvrierForm.tsx` pour un admin_campus**

En tête de fichier, ajouter l'import du hook d'auth (le fichier ne l'utilise pas encore) :

```ts
import { useAuth } from '../../context/AuthContext';
```

Dans le composant, ajouter (juste après les autres `useState`/hooks existants en haut de la fonction du composant) :

```ts
  const { user } = useAuth();
  const isAdminCampus = user?.role === 'admin_campus';
  const campusOptions = isAdminCampus
    ? CAMPUS_OPTIONS.filter(o => user?.campus.includes(o.value))
    : CAMPUS_OPTIONS;
```

Remplacer :

```tsx
            <Select value={campus} onChange={e => setCampus(e.target.value)}>
              {CAMPUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
```

Par :

```tsx
            <Select value={campus} onChange={e => setCampus(e.target.value)}>
              {campusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
```

- [ ] **Étape 8 : Tests backend (TDD)**

Créer `backend/src/__tests__/unit/ouvriers.controller.test.ts` :

```ts
// Tests pour la verification du perimetre campus d'un admin_campus sur
// createOuvrier/updateOuvrier/toggleStatut/deactivateOuvrier/deleteOuvrier (Task B5bis).

import { createOuvrier, updateOuvrier, toggleStatut, deactivateOuvrier, deleteOuvrier } from '../../controllers/ouvriers.controller';
import prisma from '../../lib/prisma';

function mockRes() {
  const jsonMock = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return { res: { status: statusMock, json: jsonMock } as never, statusMock, jsonMock };
}

describe('createOuvrier - perimetre campus admin_campus', () => {
  it('refuse la creation directe si le campus demande est hors du perimetre', async () => {
    const { res, statusMock } = mockRes();
    const req = {
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
      body: { prenom: 'Jean', nom: 'Dupont', telephone: '+33612345678', campus: 'orleans', inscription_directe: true },
    } as never;
    await createOuvrier(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
  });
});

describe('updateOuvrier - perimetre campus admin_campus', () => {
  it('refuse la modification si le campus actuel de l\'ouvrier est hors du perimetre', async () => {
    (prisma.ouvrier.findUnique as jest.Mock).mockResolvedValue({ id: 'o1', campus: 'montpellier' });
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'o1' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
      body: { prenom: 'Nouveau nom' },
    } as never;
    await updateOuvrier(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
  });

  it('refuse de deplacer un ouvrier vers un campus hors du perimetre', async () => {
    (prisma.ouvrier.findUnique as jest.Mock).mockResolvedValue({ id: 'o1', campus: 'paris' });
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'o1' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
      body: { campus: 'orleans' },
    } as never;
    await updateOuvrier(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
  });
});

describe('toggleStatut - perimetre campus admin_campus', () => {
  it('refuse le changement de statut sur un ouvrier hors du perimetre', async () => {
    (prisma.ouvrier.findUnique as jest.Mock).mockResolvedValue({ id: 'o1', campus: 'orleans', statut: true });
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'o1' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
      body: {},
    } as never;
    await toggleStatut(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
  });
});

describe('deactivateOuvrier - perimetre campus admin_campus', () => {
  it('refuse la desactivation sur un ouvrier hors du perimetre', async () => {
    (prisma.ouvrier.findUnique as jest.Mock).mockResolvedValue({ id: 'o1', campus: 'montpellier' });
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'o1' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
    } as never;
    await deactivateOuvrier(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
  });
});

describe('deleteOuvrier - perimetre campus admin_campus', () => {
  it('refuse la suppression sur un ouvrier hors du perimetre', async () => {
    (prisma.ouvrier.findUnique as jest.Mock).mockResolvedValue({ id: 'o1', campus: 'orleans' });
    const { res, statusMock } = mockRes();
    const req = {
      params: { id: 'o1' },
      user: { id: 'admin-1', role: 'admin_campus', campus: ['paris'] },
    } as never;
    await deleteOuvrier(req, res);
    expect(statusMock).toHaveBeenCalledWith(403);
  });
});
```

Note : vérifier d'abord le mock Prisma existant (`backend/src/__tests__/__mocks__/prisma.ts`) — `ouvrier` y est déjà défini avec `findUnique`/`create`/`update` (utilisé par d'autres tests du projet). Si `$transaction` doit être mocké pour la branche promotion de `createOuvrier`, réutiliser le mock générique déjà en place.

Run : `npm test -- ouvriers.controller.test.ts` (depuis `backend/`) → doit passer.

- [ ] **Étape 9 : Vérifier**

Run (depuis `backend/`) : `npm run typecheck && npm test`
Run (depuis `frontend/`) : `npm run build`
Expected : aucune erreur, suite verte.

- [ ] **Étape 10 : Commit**

```bash
git add backend/src/controllers/ouvriers.controller.ts backend/src/__tests__/unit/ouvriers.controller.test.ts frontend/src/features/ouvriers/OuvrierForm.tsx
git commit -m "fix(security): ouvriers.controller.ts verifie desormais le perimetre admin_campus

Meme classe de faille que celle corrigee sur users.controller.ts (B3bis a
B3quater) : createOuvrier, updateOuvrier, toggleStatut, deactivateOuvrier
et deleteOuvrier ne verifiaient pas que l'ouvrier cible appartient au
perimetre campus de l'admin_campus appelant. Trouve pendant la revue
qualite de Task B5. Le formulaire cote frontend limite aussi les campus
proposes a un admin_campus a son propre perimetre.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

Décidé avec l'utilisateur : l'audit ne s'étend pas à d'autres controllers (contacts, planning) dans ce chantier — signalé comme risque à vérifier séparément si le même schéma s'y répète.

---

### Task B6 : `Dashboard.tsx` — KPI par campus restructurés

Le cas le plus lourd du balayage : `kpi.paris`/`kpi.parisNord`/etc. sont des variables nommées en dur, utilisées uniquement dans le tableau "Répartition par campus" du rapport PDF annuel (pas de cartes à l'écran pour ces valeurs — vérifié, seul le PDF les consomme). Restructuré en une liste indexée par campus.

**Fichiers:**
- Modify: `frontend/src/pages/Dashboard.tsx:744-768` (calcul KPI), `:868` (ternaire PDF mensuel), `:933-941` (tableau PDF annuel), `:963` (ternaire PDF annuel), `:994-998` (options de filtre)

- [ ] **Étape 1 : Restructurer le calcul KPI par campus**

Remplacer :

```ts
    const paris                = filteredContacts.filter(c => c.campus === 'paris').length;
    const parisNord            = filteredContacts.filter(c => c.campus === 'paris_nord').length;
    const parisIntegre         = filteredContacts.filter(c => c.campus === 'paris' && c.statut === 'integre').length;
    const parisMembrePhila     = filteredContacts.filter(c => c.campus === 'paris' && c.profil === 'membre_phila').length;
    const parisNordIntegre     = filteredContacts.filter(c => c.campus === 'paris_nord' && c.statut === 'integre').length;
    const parisNordMembrePhila = filteredContacts.filter(c => c.campus === 'paris_nord' && c.profil === 'membre_phila').length;
    const byStatut: Record<string, number> = {};
    for (const c of filteredContacts) {
      byStatut[c.statut] = (byStatut[c.statut] ?? 0) + 1;
    }
    return {
      total, membrePhila, visiteurSansEglise, visiteurAvecEglise, sansRef, enLigne, presentiel, byStatut,
      integre, ouvrier, paris, parisNord, parisIntegre, parisMembrePhila, parisNordIntegre, parisNordMembrePhila,
    };
  }, [filteredContacts]);
```

Par :

```ts
    const parCampus = CAMPUS_OPTIONS.map(({ value, label }) => ({
      campus:      value,
      label,
      total:       filteredContacts.filter(c => c.campus === value).length,
      integre:     filteredContacts.filter(c => c.campus === value && c.statut === 'integre').length,
      membrePhila: filteredContacts.filter(c => c.campus === value && c.profil === 'membre_phila').length,
    }));
    const byStatut: Record<string, number> = {};
    for (const c of filteredContacts) {
      byStatut[c.statut] = (byStatut[c.statut] ?? 0) + 1;
    }
    return {
      total, membrePhila, visiteurSansEglise, visiteurAvecEglise, sansRef, enLigne, presentiel, byStatut,
      integre, ouvrier, parCampus,
    };
  }, [filteredContacts]);
```

Ajouter `CAMPUS_OPTIONS` à l'import de `../utils/constants` en tête de fichier (le fichier importe déjà `CAMPUS_LABELS` depuis ce module — ajouter `CAMPUS_OPTIONS` à côté).

- [ ] **Étape 2 : Corriger le ternaire du rapport PDF mensuel**

Remplacer :

```ts
        c.campus === 'paris' ? 'Paris' : 'Paris Nord',
        new Date(c.date_inscription).toLocaleDateString('fr-FR'),
      ]),
      styles:              { fontSize: 9, cellPadding: 3 },
      headStyles:          { fillColor: [26, 86, 176], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles:  { fillColor: [245, 247, 250] },
      margin:              { left: 20, right: 20 },
    });

    // ── Pied de page ────────────────────────────────────────────────────────
```

Par :

```ts
        CAMPUS_LABELS[c.campus] ?? c.campus,
        new Date(c.date_inscription).toLocaleDateString('fr-FR'),
      ]),
      styles:              { fontSize: 9, cellPadding: 3 },
      headStyles:          { fillColor: [26, 86, 176], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles:  { fillColor: [245, 247, 250] },
      margin:              { left: 20, right: 20 },
    });

    // ── Pied de page ────────────────────────────────────────────────────────
```

- [ ] **Étape 3 : Restructurer le tableau "Répartition par campus" du rapport PDF annuel**

Remplacer :

```ts
    autoTable(doc, {
      startY: 125,
      head: [['Campus', 'Total', 'Integres', 'Membres Phila']],
      body: [
        ['Paris',      String(kpi.paris),      String(kpi.parisIntegre),     String(kpi.parisMembrePhila)    ],
        ['Paris Nord', String(kpi.parisNord),  String(kpi.parisNordIntegre), String(kpi.parisNordMembrePhila)],
      ],
      styles:             { fontSize: 9, cellPadding: 3 },
      headStyles:         { fillColor: [26, 86, 176], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin:             { left: 20, right: 20 },
    });
```

Par :

```ts
    autoTable(doc, {
      startY: 125,
      head: [['Campus', 'Total', 'Integres', 'Membres Phila']],
      body: kpi.parCampus.map(pc => [pc.label, String(pc.total), String(pc.integre), String(pc.membrePhila)]),
      styles:             { fontSize: 9, cellPadding: 3 },
      headStyles:         { fillColor: [26, 86, 176], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin:             { left: 20, right: 20 },
    });
```

- [ ] **Étape 4 : Corriger le ternaire du rapport PDF annuel (liste complète des contacts)**

Remplacer :

```ts
        c.campus === 'paris' ? 'Paris' : 'Paris Nord',
        new Date(c.date_inscription).toLocaleDateString('fr-FR'),
      ]),
      styles:             { fontSize: 8, cellPadding: 2 },
```

Par :

```ts
        CAMPUS_LABELS[c.campus] ?? c.campus,
        new Date(c.date_inscription).toLocaleDateString('fr-FR'),
      ]),
      styles:             { fontSize: 8, cellPadding: 2 },
```

- [ ] **Étape 5 : Étendre les options du filtre campus à l'écran**

Remplacer :

```ts
  const campusOpts: Array<{ value: CampusFilter; label: string }> = [
    { value: 'all',       label: 'Tous les campus' },
    { value: 'paris',     label: 'Paris' },
    { value: 'paris_nord',label: 'Paris Nord' },
  ];
```

Par :

```ts
  const campusOpts: Array<{ value: CampusFilter; label: string }> = [
    { value: 'all', label: 'Tous les campus' },
    ...CAMPUS_OPTIONS,
  ];
```

- [ ] **Étape 6 : Vérifier**

Run : `npm run build` (depuis `frontend/`)
Expected: build réussi. `CampusFilter = Campus | 'all'` s'élargit automatiquement puisqu'il dérive du type `Campus` (déjà étendu en Task A7) — aucune autre édition nécessaire pour ce type.

- [ ] **Étape 7 : Commit**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "feat(campus): Dashboard - KPI et rapports PDF restructures sur 4 campus

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task B7 : `PlanningTable.tsx`

**Fichiers:**
- Modify: `frontend/src/features/planning/PlanningTable.tsx:12-27` (imports), `:167`, `:299-313`

- [ ] **Étape 1 : Importer CAMPUS_LABELS/CAMPUS_OPTIONS**

Dans le bloc d'imports, remplacer :

```ts
import { ROLE_RANK } from '../../utils/constants';
```

Par :

```ts
import { ROLE_RANK, CAMPUS_LABELS, CAMPUS_OPTIONS } from '../../utils/constants';
```

- [ ] **Étape 2 : Corriger le ternaire d'export PDF**

Remplacer :

```ts
    const campusLabel = campus === 'paris' ? 'Paris' : 'Paris Nord';
```

Par :

```ts
    const campusLabel = CAMPUS_LABELS[campus] ?? campus;
```

- [ ] **Étape 3 : Étendre le sélecteur de campus (visible pour super_admin)**

Remplacer :

```tsx
              <option value="paris">Paris</option>
              <option value="paris_nord">Paris Nord</option>
```

Par :

```tsx
              {CAMPUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
```

- [ ] **Étape 4 : Vérifier**

Run : `npm run build` (depuis `frontend/`)
Expected: build réussi.

- [ ] **Étape 5 : Commit**

```bash
git add frontend/src/features/planning/PlanningTable.tsx
git commit -m "refactor(campus): PlanningTable utilise CAMPUS_LABELS/CAMPUS_OPTIONS partages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task B8 : `PlanningDetail.tsx`

**Fichiers:**
- Modify: `frontend/src/features/planning/PlanningDetail.tsx:14` (imports), `:152`, `:286`

- [ ] **Étape 1 : Importer CAMPUS_LABELS**

Remplacer :

```ts
import { ROLE_RANK } from '../../utils/constants';
```

Par :

```ts
import { ROLE_RANK, CAMPUS_LABELS } from '../../utils/constants';
```

- [ ] **Étape 2 : Corriger les 2 ternaires**

Remplacer (occurrence export PDF) :

```ts
    const campusLabel = planning.campus === 'paris' ? 'Paris' : 'Paris Nord';
```

Par :

```ts
    const campusLabel = CAMPUS_LABELS[planning.campus] ?? planning.campus;
```

Remplacer (occurrence badge à l'écran) :

```tsx
              {planning.campus === 'paris' ? 'Paris' : 'Paris Nord'}
```

Par :

```tsx
              {CAMPUS_LABELS[planning.campus] ?? planning.campus}
```

- [ ] **Étape 3 : Vérifier**

Run : `npm run build` (depuis `frontend/`)
Expected: build réussi.

- [ ] **Étape 4 : Commit**

```bash
git add frontend/src/features/planning/PlanningDetail.tsx
git commit -m "refactor(campus): PlanningDetail utilise CAMPUS_LABELS partage

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task B9 : `MesPlannings.tsx`

**Fichiers:**
- Modify: `frontend/src/features/planning/MesPlannings.tsx:6-8` (imports), `:79`

- [ ] **Étape 1 : Importer CAMPUS_LABELS**

Remplacer :

```ts
import { useState, useEffect } from 'react';
import { affectationsEndpoints } from '../../services/endpoints';
import type { AffectationPlanning, StatutAffectation } from '../../types';
```

Par :

```ts
import { useState, useEffect } from 'react';
import { affectationsEndpoints } from '../../services/endpoints';
import { CAMPUS_LABELS } from '../../utils/constants';
import type { AffectationPlanning, StatutAffectation } from '../../types';
```

- [ ] **Étape 2 : Corriger le ternaire**

Remplacer :

```ts
    const campusLabel = aff.planning?.campus === 'paris_nord' ? 'Paris Nord' : 'Paris';
```

Par :

```ts
    const campusLabel = aff.planning?.campus ? (CAMPUS_LABELS[aff.planning.campus] ?? aff.planning.campus) : 'Paris';
```

- [ ] **Étape 3 : Vérifier**

Run : `npm run build` (depuis `frontend/`)
Expected: build réussi.

- [ ] **Étape 4 : Commit**

```bash
git add frontend/src/features/planning/MesPlannings.tsx
git commit -m "refactor(campus): MesPlannings utilise CAMPUS_LABELS partage

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task B10 : `MessageCompose.tsx`

**Fichiers:**
- Modify: `frontend/src/features/messages/MessageCompose.tsx:10-15` (imports), `:384-388`, `:507-511`

- [ ] **Étape 1 : Importer CAMPUS_OPTIONS**

Remplacer :

```ts
import { ROLE_RANK } from '../../utils/constants';
```

Par :

```ts
import { ROLE_RANK, CAMPUS_OPTIONS } from '../../utils/constants';
```

- [ ] **Étape 2 : Étendre le filtre campus des contacts**

Remplacer :

```tsx
                  <select value={fCampus} onChange={(e) => setFCampus(e.target.value)} style={inputStyle}>
                    <option value="">Tous les campus</option>
                    <option value="paris">Paris uniquement</option>
                    <option value="paris_nord">Paris Nord uniquement</option>
                  </select>
```

Par :

```tsx
                  <select value={fCampus} onChange={(e) => setFCampus(e.target.value)} style={inputStyle}>
                    <option value="">Tous les campus</option>
                    {CAMPUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label} uniquement</option>)}
                  </select>
```

- [ ] **Étape 3 : Étendre le filtre campus des ouvriers**

Remplacer :

```tsx
                  <select value={fOuvrierCampus} onChange={(e) => setFOuvrierCampus(e.target.value)} style={inputStyle}>
                    <option value="">Tous les campus</option>
                    <option value="paris">Paris</option>
                    <option value="paris_nord">Paris Nord</option>
                  </select>
```

Par :

```tsx
                  <select value={fOuvrierCampus} onChange={(e) => setFOuvrierCampus(e.target.value)} style={inputStyle}>
                    <option value="">Tous les campus</option>
                    {CAMPUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
```

- [ ] **Étape 4 : Vérifier**

Run : `npm run build` (depuis `frontend/`)
Expected: build réussi.

- [ ] **Étape 5 : Commit**

```bash
git add frontend/src/features/messages/MessageCompose.tsx
git commit -m "feat(campus): MessageCompose propose les 4 campus dans les filtres de ciblage

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task B11 : `MessageHistory.tsx`

**Fichiers:**
- Modify: `frontend/src/features/messages/MessageHistory.tsx:11` (imports), `:334-341`

- [ ] **Étape 1 : Importer CAMPUS_OPTIONS**

Remplacer :

```ts
import { ROLE_RANK } from '../../utils/constants';
```

Par :

```ts
import { ROLE_RANK, CAMPUS_OPTIONS } from '../../utils/constants';
```

- [ ] **Étape 2 : Étendre le filtre campus**

Remplacer :

```tsx
            <option value="">Tous les campus</option>
            <option value="paris">Paris</option>
            <option value="paris_nord">Paris Nord</option>
          </select>
```

Par :

```tsx
            <option value="">Tous les campus</option>
            {CAMPUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
```

- [ ] **Étape 3 : Vérifier**

Run : `npm run build` (depuis `frontend/`)
Expected: build réussi.

- [ ] **Étape 4 : Commit**

```bash
git add frontend/src/features/messages/MessageHistory.tsx
git commit -m "feat(campus): MessageHistory propose les 4 campus dans le filtre

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task B12 : `ReferentList.tsx`

**Fichiers:**
- Modify: `frontend/src/features/referents/ReferentList.tsx:9-11` (imports), `:322`

- [ ] **Étape 1 : Importer CAMPUS_LABELS**

Remplacer :

```ts
import { referentsEndpoints } from '../../services/endpoints';
import type { ChargeReferent } from '../../services/endpoints';
import type { StatutContact } from '../../types';
```

Par :

```ts
import { referentsEndpoints } from '../../services/endpoints';
import type { ChargeReferent } from '../../services/endpoints';
import { CAMPUS_LABELS } from '../../utils/constants';
import type { StatutContact } from '../../types';
```

- [ ] **Étape 2 : Corriger le ternaire**

Remplacer :

```tsx
                    {ref.campus.map(c => c === 'paris' ? 'Paris' : 'Paris Nord').join(', ') || '-'}
```

Par :

```tsx
                    {ref.campus.map(c => CAMPUS_LABELS[c] ?? c).join(', ') || '-'}
```

- [ ] **Étape 3 : Vérifier**

Run : `npm run build` (depuis `frontend/`)
Expected: build réussi.

- [ ] **Étape 4 : Commit**

```bash
git add frontend/src/features/referents/ReferentList.tsx
git commit -m "refactor(campus): ReferentList utilise CAMPUS_LABELS partage

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task B13 : `ContactList.tsx`

**Fichiers:**
- Modify: `frontend/src/features/contacts/ContactList.tsx:13-17` (imports), `:541-545`

- [ ] **Étape 1 : Ajouter CAMPUS_OPTIONS à l'import existant**

Remplacer :

```ts
import {
  CAMPUS_LABELS, STATUT_LABELS, STATUT_COLORS,
  CANAL_LABELS, CANAL_BADGE, PROFIL_BADGE, PROFIL_LABELS, ROLE_RANK,
  INTENTION_LABELS, INTENTION_COLORS,
} from '../../utils/constants';
```

Par :

```ts
import {
  CAMPUS_LABELS, CAMPUS_OPTIONS, STATUT_LABELS, STATUT_COLORS,
  CANAL_LABELS, CANAL_BADGE, PROFIL_BADGE, PROFIL_LABELS, ROLE_RANK,
  INTENTION_LABELS, INTENTION_COLORS,
} from '../../utils/constants';
```

- [ ] **Étape 2 : Étendre le filtre campus**

Remplacer :

```tsx
        <select value={filterCampus} onChange={(e) => { setCampus(e.target.value as Campus | ''); setPage(1); }} style={S.sel}>
          <option value="">Tous les campus</option>
          <option value="paris">Paris</option>
          <option value="paris_nord">Paris Nord</option>
        </select>
```

Par :

```tsx
        <select value={filterCampus} onChange={(e) => { setCampus(e.target.value as Campus | ''); setPage(1); }} style={S.sel}>
          <option value="">Tous les campus</option>
          {CAMPUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
```

- [ ] **Étape 3 : Vérifier**

Run : `npm run build` (depuis `frontend/`)
Expected: build réussi.

- [ ] **Étape 4 : Commit**

```bash
git add frontend/src/features/contacts/ContactList.tsx
git commit -m "feat(campus): ContactList propose les 4 campus dans le filtre

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task B14 : `ContactDetail.tsx`

**Fichiers:**
- Modify: `frontend/src/features/contacts/ContactDetail.tsx:15-32` (imports), `:1072-1084`

- [ ] **Étape 1 : Ajouter CAMPUS_OPTIONS à l'import existant**

Remplacer :

```ts
import {
  ROLE_RANK,
  STATUT_LABELS, STATUT_COLORS,
  ROLE_LABELS,
  PROFIL_BADGE, PROFIL_LABELS,
  CANAL_LABELS, CANAL_BADGE,
  CAMPUS_LABELS,
  STATUT_OPTIONS,
```

Par :

```ts
import {
  ROLE_RANK,
  STATUT_LABELS, STATUT_COLORS,
  ROLE_LABELS,
  PROFIL_BADGE, PROFIL_LABELS,
  CANAL_LABELS, CANAL_BADGE,
  CAMPUS_LABELS, CAMPUS_OPTIONS,
  STATUT_OPTIONS,
```

- [ ] **Étape 2 : Étendre le sélecteur "Promouvoir en ouvrier"**

Remplacer :

```tsx
                <select
                  value={promoteCampus}
                  onChange={e => setPromoteCampus(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 6,
                    border: '1px solid var(--bg-card-border)',
                    background: 'var(--bg-card)', color: 'var(--text-primary)',
                    fontSize: 14,
                  }}
                >
                  <option value="paris">Paris</option>
                  <option value="paris_nord">Paris Nord</option>
                </select>
```

Par :

```tsx
                <select
                  value={promoteCampus}
                  onChange={e => setPromoteCampus(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 6,
                    border: '1px solid var(--bg-card-border)',
                    background: 'var(--bg-card)', color: 'var(--text-primary)',
                    fontSize: 14,
                  }}
                >
                  {CAMPUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
```

- [ ] **Étape 3 : Vérifier**

Run : `npm run build` (depuis `frontend/`)
Expected: build réussi.

- [ ] **Étape 4 : Commit**

```bash
git add frontend/src/features/contacts/ContactDetail.tsx
git commit -m "feat(campus): ContactDetail propose les 4 campus a la promotion en ouvrier

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task B14bis : `ContactDetail.tsx` — le sélecteur "Promouvoir en ouvrier" est décoratif, le rendre lecture seule

Trouvé pendant la revue qualité de B14 : le sélecteur de campus dans la fenêtre « Promouvoir en ouvrier » n'a jamais eu d'effet réel — `createOuvrier` (branche promotion, `backend/src/controllers/ouvriers.controller.ts`) crée toujours l'ouvrier avec `contact.campus`, jamais avec le `campus` soumis dans le corps de la requête. Ce n'est pas une régression de B14 (déjà vrai avec 2 campus), juste rendu plus visible avec 4 options. Décidé avec l'utilisateur : rendre le champ lecture seule plutôt que de faire fonctionner la réassignation (pas de changement backend nécessaire).

**Fichiers:**
- Modify: `frontend/src/features/contacts/ContactDetail.tsx`

- [ ] **Étape 1 : Retirer `CAMPUS_OPTIONS` de l'import (redevient inutilisé après cette tâche) et ajouter le type `Campus`**

Remplacer :

```ts
import type {
  Contact, Commentaire, HistoriqueStatut, Message,
  ChecklistItem, EtapeIntegration, StatutContact, User, AuditLog, AuditAction, SuggestionReferent, Intention,
} from '../../types';
```

Par :

```ts
import type {
  Contact, Commentaire, HistoriqueStatut, Message,
  ChecklistItem, EtapeIntegration, StatutContact, User, AuditLog, AuditAction, SuggestionReferent, Intention, Campus,
} from '../../types';
```

Remplacer :

```ts
  CAMPUS_LABELS, CAMPUS_OPTIONS,
```

Par :

```ts
  CAMPUS_LABELS,
```

- [ ] **Étape 2 : Remplacer le `<select>` par un affichage lecture seule**

Remplacer :

```tsx
                <select
                  value={promoteCampus}
                  onChange={e => setPromoteCampus(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 6,
                    border: '1px solid var(--bg-card-border)',
                    background: 'var(--bg-card)', color: 'var(--text-primary)',
                    fontSize: 14,
                  }}
                >
                  {CAMPUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
```

Par :

```tsx
                <div style={{
                  width: '100%', padding: '8px 10px', borderRadius: 6,
                  border: '1px solid var(--bg-card-border)',
                  background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                  fontSize: 14,
                }}>
                  {CAMPUS_LABELS[promoteCampus as Campus] ?? promoteCampus}
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
                  L'ouvrier est créé sur le campus actuel du contact.
                </p>
```

Note : `promoteCampus`/`setPromoteCampus` restent inchangés ailleurs dans le fichier (l'état est toujours peuplé depuis `contact.campus` au chargement et toujours envoyé dans le payload de création — seul le contrôle devient non-éditable).

- [ ] **Étape 3 : Vérifier**

Run : `npm run build` (depuis `frontend/`)
Expected: build réussi. Confirmer qu'aucun import ne devient inutilisé (`CAMPUS_OPTIONS` retiré proprement, `Campus` bien utilisé).

- [ ] **Étape 4 : Commit**

```bash
git add frontend/src/features/contacts/ContactDetail.tsx
git commit -m "fix(campus): champ campus en lecture seule a la promotion en ouvrier

Le selecteur n'avait jamais d'effet reel - createOuvrier (branche promotion)
utilise toujours le campus du contact d'origine, jamais une valeur soumise.
Trouve pendant la revue qualite de Task B14.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Partie C — Formulaires publics

### Task C1 : `FormPresentiel.tsx` — champ Campus dans l'étape Localisation

**Fichiers:**
- Modify: `frontend/src/pages/FormPresentiel.tsx:107-144` (état/init), `:299-302` (validation), `:346-364` (payload), `:521-570` (étape 2)

- [ ] **Étape 1 : Ajouter le champ à FormState et à l'état initial**

Remplacer :

```ts
interface FormState {
  genre:        Genre | '';
  prenom:       string;
  nom:          string;
  prefix:       string;
  phone:        string;
  email:           string;
  date_naissance:  string;
  ville:           string;
  code_postal:     string;
  etat_civil:   EtatCivil | '';
```

Par :

```ts
interface FormState {
  genre:        Genre | '';
  prenom:       string;
  nom:          string;
  prefix:       string;
  phone:        string;
  email:           string;
  date_naissance:  string;
  ville:           string;
  code_postal:     string;
  campus:          ExtensionPhila | '';
  etat_civil:   EtatCivil | '';
```

Remplacer :

```ts
const INIT: FormState = {
  genre: '', prenom: '', nom: '', prefix: '+33', phone: '', email: '',
  date_naissance: '',
  ville: '', code_postal: '', etat_civil: '',
```

Par :

```ts
const INIT: FormState = {
  genre: '', prenom: '', nom: '', prefix: '+33', phone: '', email: '',
  date_naissance: '',
  ville: '', code_postal: '', campus: '', etat_civil: '',
```

- [ ] **Étape 2 : Valider le champ à l'étape 2**

Remplacer :

```ts
    if (s === 2) {
      if (!form.ville.trim()) e.ville     = 'La ville est obligatoire.';
      if (!form.etat_civil)   e.etat_civil = "L'état civil est obligatoire.";
    }
```

Par :

```ts
    if (s === 2) {
      if (!form.ville.trim()) e.ville     = 'La ville est obligatoire.';
      if (!form.campus)       e.campus    = 'Le campus est obligatoire.';
      if (!form.etat_civil)   e.etat_civil = "L'état civil est obligatoire.";
    }
```

- [ ] **Étape 3 : Envoyer le campus choisi dans le payload**

Remplacer :

```ts
      canal:             'presentiel',
      saisi_par_membre:  false,
      campus:            'paris', // défaut - mis à jour par l'admin après inscription
    };
```

Par :

```ts
      canal:             'presentiel',
      saisi_par_membre:  false,
      campus:            form.campus,
    };
```

- [ ] **Étape 4 : Ajouter le sélecteur dans l'étape 2 (Localisation)**

Remplacer :

```tsx
        <Field label="Code postal" hint="Facultatif">
          <TxtInput value={form.code_postal} onChange={v => set('code_postal', v)} placeholder="75001" />
        </Field>

        <Field label="Date de naissance" hint="Facultatif - utilisée pour vous souhaiter un joyeux anniversaire">
```

Par :

```tsx
        <Field label="Code postal" hint="Facultatif">
          <TxtInput value={form.code_postal} onChange={v => set('code_postal', v)} placeholder="75001" />
        </Field>

        <Field label="Campus" required error={errors.campus}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <OptionBtn selected={form.campus === 'paris'}       onClick={() => set('campus', 'paris')}>Paris</OptionBtn>
            <OptionBtn selected={form.campus === 'paris_nord'}  onClick={() => set('campus', 'paris_nord')}>Paris Nord</OptionBtn>
            <OptionBtn selected={form.campus === 'orleans'}     onClick={() => set('campus', 'orleans')}>Orléans</OptionBtn>
            <OptionBtn selected={form.campus === 'montpellier'} onClick={() => set('campus', 'montpellier')}>Montpellier</OptionBtn>
          </div>
        </Field>

        <Field label="Date de naissance" hint="Facultatif - utilisée pour vous souhaiter un joyeux anniversaire">
```

- [ ] **Étape 5 : Vérifier**

Run : `npm run build` (depuis `frontend/`)
Expected: build réussi.

- [ ] **Étape 6 : Commit**

```bash
git add frontend/src/pages/FormPresentiel.tsx
git commit -m "feat(campus): FormPresentiel demande le campus a l'inscription

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task C1bis : Backend — valider `campus` sur la création publique de contact (Critical)

Trouvé pendant la revue qualité de C1 : `POST /api/contacts` (endpoint public, non authentifié) ne valide jamais `campus` — ni dans le schéma Zod (`createContactSchema`, `.passthrough()` laisse passer n'importe quoi), ni dans la liste `required` vérifiée manuellement dans le contrôleur. Conséquence concrète : le champ ajouté en C1 peut être contourné par n'importe quel appel direct à l'API (pas seulement via le formulaire) — une requête sans `campus` retombe silencieusement sur `'paris'` (exactement le problème que C1 est censé résoudre), et une requête avec un `campus` invalide fait planter `prisma.contact.create` et renvoie une erreur 500 avec le détail Prisma brut à un appelant non authentifié. Corrigé avant de continuer sur C2 (qui a exactement le même point d'entrée).

**Fichiers:**
- Modify: `backend/src/schemas/contacts.schema.ts`
- Modify: `backend/src/controllers/contacts.controller.ts:199` (liste `required`), `:226` (fallback)

- [ ] **Étape 1 : Valider `campus` dans le schéma Zod**

Remplacer :

```ts
const GENRES       = ['homme', 'femme'] as const;
const ETATS_CIVILS = ['celibataire', 'fiance', 'marie', 'divorce', 'veuf'] as const;
const STATUTS      = ['oui', 'non', 'premiere_visite'] as const;
const CANAUX       = ['presentiel', 'en_ligne'] as const;
```

Par :

```ts
const GENRES       = ['homme', 'femme'] as const;
const ETATS_CIVILS = ['celibataire', 'fiance', 'marie', 'divorce', 'veuf'] as const;
const STATUTS      = ['oui', 'non', 'premiere_visite'] as const;
const CANAUX       = ['presentiel', 'en_ligne'] as const;
const CAMPUS_VALUES = ['paris', 'paris_nord', 'orleans', 'montpellier'] as const;
```

Puis remplacer :

```ts
  // Localisation
  ville:       z.string().min(1, 'Ville requise').max(100).trim(),
  code_postal: z.string().max(20).optional().nullable(),
```

Par :

```ts
  // Localisation
  ville:       z.string().min(1, 'Ville requise').max(100).trim(),
  code_postal: z.string().max(20).optional().nullable(),
  campus:      z.enum(CAMPUS_VALUES),
```

- [ ] **Étape 2 : Contrôleur — ajouter `campus` à la liste des champs obligatoires vérifiés manuellement**

Remplacer :

```ts
    const required = ['genre', 'prenom', 'nom', 'telephone', 'ville', 'etat_civil', 'statut_phila', 'canal'];
```

Par :

```ts
    const required = ['genre', 'prenom', 'nom', 'telephone', 'ville', 'campus', 'etat_civil', 'statut_phila', 'canal'];
```

- [ ] **Étape 3 : Retirer le fallback devenu inutile (campus est maintenant garanti présent et valide en amont)**

Remplacer :

```ts
      campus:           b.campus          ?? 'paris',
```

Par :

```ts
      campus:           b.campus,
```

- [ ] **Étape 4 : Vérifier**

Run (depuis `backend/`) : `npm run typecheck && npm test`
Expected : aucune erreur, suite verte (vérifier en particulier qu'aucun test existant ne postait un contact sans `campus` — si un test casse pour cette raison, lui ajouter `campus: 'paris'` dans son payload plutôt que d'affaiblir la validation).

- [ ] **Étape 5 : Commit**

```bash
git add backend/src/schemas/contacts.schema.ts backend/src/controllers/contacts.controller.ts
git commit -m "fix(security): valider le champ campus sur la creation publique de contact

POST /api/contacts (endpoint public non authentifie) ne validait jamais
campus - une requete sans ce champ retombait silencieusement sur 'paris',
une requete avec une valeur invalide provoquait une 500 avec detail Prisma
brut. Trouve pendant la revue qualite de Task C1.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task C2 : `FormEnLigne.tsx` — champ Campus dans l'étape Localisation

**Fichiers:**
- Modify: `frontend/src/pages/FormEnLigne.tsx:126-165` (état/init), `:320-323` (validation), `:370-390` (payload), `:534-583` (étape 2)

- [ ] **Étape 1 : Ajouter le champ à FormState et à l'état initial**

Remplacer :

```ts
interface FormState {
  genre:               Genre | '';
  prenom:              string;
  nom:                 string;
  prefix:              string;
  phone:               string;
  email:               string;
  date_naissance:      string;
  ville:               string;
  code_postal:         string;
  etat_civil:          EtatCivil | '';
```

Par :

```ts
interface FormState {
  genre:               Genre | '';
  prenom:              string;
  nom:                 string;
  prefix:              string;
  phone:               string;
  email:               string;
  date_naissance:      string;
  ville:               string;
  code_postal:         string;
  campus:              ExtensionPhila | '';
  etat_civil:          EtatCivil | '';
```

Remplacer :

```ts
const INIT: FormState = {
  genre: '', prenom: '', nom: '', prefix: '+33', phone: '', email: '',
  date_naissance: '',
  ville: '', code_postal: '', etat_civil: '',
```

Par :

```ts
const INIT: FormState = {
  genre: '', prenom: '', nom: '', prefix: '+33', phone: '', email: '',
  date_naissance: '',
  ville: '', code_postal: '', campus: '', etat_civil: '',
```

- [ ] **Étape 2 : Valider le champ à l'étape 2**

Remplacer :

```ts
    if (s === 2) {
      if (!form.ville.trim()) e.ville     = 'La ville est obligatoire.';
      if (!form.etat_civil)   e.etat_civil = "L'état civil est obligatoire.";
    }
```

Par :

```ts
    if (s === 2) {
      if (!form.ville.trim()) e.ville     = 'La ville est obligatoire.';
      if (!form.campus)       e.campus    = 'Le campus est obligatoire.';
      if (!form.etat_civil)   e.etat_civil = "L'état civil est obligatoire.";
    }
```

- [ ] **Étape 3 : Envoyer le campus choisi dans le payload**

Remplacer :

```ts
      canal:               'en_ligne',
      saisi_par_membre:    false,
      // campus non envoyé : le backend applique la valeur par défaut 'paris',
      // mise à jour par un admin après vérification du campus du contact
    };
```

Par :

```ts
      canal:               'en_ligne',
      saisi_par_membre:    false,
      campus:              form.campus,
    };
```

- [ ] **Étape 4 : Ajouter le sélecteur dans l'étape 2 (Localisation)**

Remplacer :

```tsx
        <Field label="Code postal" hint="Facultatif">
          <TxtInput value={form.code_postal} onChange={v => set('code_postal', v)} placeholder="75001" />
        </Field>

        <Field label="Date de naissance" hint="Facultatif - utilisée pour vous souhaiter un joyeux anniversaire">
```

Par :

```tsx
        <Field label="Code postal" hint="Facultatif">
          <TxtInput value={form.code_postal} onChange={v => set('code_postal', v)} placeholder="75001" />
        </Field>

        <Field label="Campus" required error={errors.campus}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <OptionBtn selected={form.campus === 'paris'}       onClick={() => set('campus', 'paris')}>Paris</OptionBtn>
            <OptionBtn selected={form.campus === 'paris_nord'}  onClick={() => set('campus', 'paris_nord')}>Paris Nord</OptionBtn>
            <OptionBtn selected={form.campus === 'orleans'}     onClick={() => set('campus', 'orleans')}>Orléans</OptionBtn>
            <OptionBtn selected={form.campus === 'montpellier'} onClick={() => set('campus', 'montpellier')}>Montpellier</OptionBtn>
          </div>
        </Field>

        <Field label="Date de naissance" hint="Facultatif - utilisée pour vous souhaiter un joyeux anniversaire">
```

- [ ] **Étape 5 : Mettre à jour le commentaire d'en-tête du fichier**

Remplacer la ligne de commentaire (ligne 10) :

```ts
//   - Pas de champ campus dans le formulaire (assigné par un admin après inscription)
```

Par :

```ts
//   - Champ campus dans l'étape Localisation (étape 2), comme FormPresentiel
```

- [ ] **Étape 6 : Vérifier**

Run : `npm run build` (depuis `frontend/`)
Expected: build réussi.

- [ ] **Étape 7 : Commit**

```bash
git add frontend/src/pages/FormEnLigne.tsx
git commit -m "feat(campus): FormEnLigne demande le campus a l'inscription

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task C3 : `FormOuvrier.tsx` — sélecteur à 4 options

**Fichiers:**
- Modify: `frontend/src/pages/FormOuvrier.tsx:515-523`, `:628`

- [ ] **Étape 1 : Étendre le sélecteur de campus**

Remplacer :

```tsx
        <Field label="Campus" required error={errors.campus}>
          <div style={{ display: 'flex', gap: 8 }}>
            <OptionBtn selected={form.campus === 'paris'} onClick={() => set('campus', 'paris')}>
              Paris
            </OptionBtn>
            <OptionBtn selected={form.campus === 'paris_nord'} onClick={() => set('campus', 'paris_nord')}>
              Paris Nord
            </OptionBtn>
          </div>
        </Field>
```

Par :

```tsx
        <Field label="Campus" required error={errors.campus}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <OptionBtn selected={form.campus === 'paris'} onClick={() => set('campus', 'paris')}>
              Paris
            </OptionBtn>
            <OptionBtn selected={form.campus === 'paris_nord'} onClick={() => set('campus', 'paris_nord')}>
              Paris Nord
            </OptionBtn>
            <OptionBtn selected={form.campus === 'orleans'} onClick={() => set('campus', 'orleans')}>
              Orléans
            </OptionBtn>
            <OptionBtn selected={form.campus === 'montpellier'} onClick={() => set('campus', 'montpellier')}>
              Montpellier
            </OptionBtn>
          </div>
        </Field>
```

- [ ] **Étape 2 : Corriger le récapitulatif**

Remplacer :

```tsx
            <div><strong>Campus :</strong> {form.campus === 'paris' ? 'Paris' : 'Paris Nord'}</div>
```

Par :

```tsx
            <div><strong>Campus :</strong> {CAMPUS_LABELS[form.campus] ?? form.campus}</div>
```

Ajouter l'import en tête de fichier (à côté des imports `services`/`utils` existants) :

```ts
import { CAMPUS_LABELS } from '../utils/constants';
```

- [ ] **Étape 3 : Vérifier**

Run : `npm run build` (depuis `frontend/`)
Expected: build réussi.

- [ ] **Étape 4 : Commit**

```bash
git add frontend/src/pages/FormOuvrier.tsx
git commit -m "feat(campus): FormOuvrier propose les 4 campus

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task C3bis : Backend — valider `campus` sur la candidature ouvrier publique (Important)

Trouvé pendant la revue qualité de C3 : `POST /api/ouvriers/candidature` (endpoint public, non authentifié) a la même faille que celle corrigée en C1bis pour `/api/contacts`, jamais déclenchée jusqu'ici mais préexistante — `candidatureOuvrier` ne vérifie que `!campus` (non-vide), pas que la valeur fait partie des 4 campus valides. Un `campus` invalide fait planter `prisma.ouvrier.create` et renvoie une 500 avec le détail Prisma brut à un appelant non authentifié. Ce contrôleur n'utilise pas Zod (contrairement à `contacts.controller.ts`) — correctif en style cohérent avec le reste de la fonction (vérification manuelle), pas d'introduction d'un nouveau schéma Zod pour une seule fonction.

**Fichiers:**
- Modify: `backend/src/controllers/ouvriers.controller.ts` (fonction `candidatureOuvrier` uniquement)
- Modify: `backend/src/__tests__/unit/ouvriers.controller.test.ts`

- [ ] **Étape 1 : Ajouter la vérification du campus**

Remplacer :

```ts
    if (!prenom || !nom || !telephone || !campus) {
      res.status(400).json({ message: 'Champs obligatoires manquants : prenom, nom, telephone, campus' });
      return;
    }
    if (!consentement_rgpd) {
      res.status(400).json({ message: 'Le consentement RGPD est obligatoire.' });
      return;
    }
```

Par :

```ts
    if (!prenom || !nom || !telephone || !campus) {
      res.status(400).json({ message: 'Champs obligatoires manquants : prenom, nom, telephone, campus' });
      return;
    }
    const CAMPUS_VALIDES = ['paris', 'paris_nord', 'orleans', 'montpellier'];
    if (!CAMPUS_VALIDES.includes(campus)) {
      res.status(400).json({ message: 'Campus invalide' });
      return;
    }
    if (!consentement_rgpd) {
      res.status(400).json({ message: 'Le consentement RGPD est obligatoire.' });
      return;
    }
```

- [ ] **Étape 2 : Test**

Ajouter à `backend/src/__tests__/unit/ouvriers.controller.test.ts` (importer `candidatureOuvrier` en plus des fonctions déjà importées) :

```ts
describe('candidatureOuvrier - validation du campus', () => {
  it('refuse une candidature avec un campus invalide', async () => {
    const { res, statusMock } = mockRes();
    const req = {
      body: {
        prenom: 'Jean', nom: 'Dupont', telephone: '+33612345678',
        campus: 'lyon', consentement_rgpd: true,
      },
    } as never;
    await candidatureOuvrier(req, res);
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(prisma.ouvrier.findFirst).not.toHaveBeenCalled();
  });

  it('accepte une candidature avec un campus valide (orleans)', async () => {
    (prisma.ouvrier.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.ouvrier.create as jest.Mock).mockResolvedValue({ id: 'o1', campus: 'orleans' });
    const { res, statusMock } = mockRes();
    const req = {
      body: {
        prenom: 'Jean', nom: 'Dupont', telephone: '+33612345679',
        campus: 'orleans', consentement_rgpd: true,
      },
    } as never;
    await candidatureOuvrier(req, res);
    expect(statusMock).not.toHaveBeenCalledWith(400);
  });
});
```

Note : si `mockRes` n'est pas déjà défini dans ce fichier de test (créé en Task B5bis), le réutiliser tel quel — il devrait déjà exister.

Run : `npm test -- ouvriers.controller.test.ts` (depuis `backend/`) → doit passer.

- [ ] **Étape 3 : Vérifier**

Run (depuis `backend/`) : `npm run typecheck && npm test`
Expected : aucune erreur, suite verte.

- [ ] **Étape 4 : Commit**

```bash
git add backend/src/controllers/ouvriers.controller.ts backend/src/__tests__/unit/ouvriers.controller.test.ts
git commit -m "fix(security): candidatureOuvrier valide desormais le campus

Meme classe de faille que celle corrigee en C1bis pour /api/contacts.
candidatureOuvrier (endpoint public) ne verifiait que la presence du
champ campus, pas sa validite - une valeur invalide provoquait une 500
avec detail Prisma brut. Trouve pendant la revue qualite de Task C3.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task C4 : `e2e/formulaire.spec.ts` — cas de validation Campus

**Fichiers:**
- Modify: `frontend/e2e/formulaire.spec.ts:41-65`

- [ ] **Étape 1 : Ajouter un test de validation du nouveau champ obligatoire**

Après le test `'navigation étape 1 → étape 2'` existant (juste avant le test `'détection doublon téléphone'`), insérer :

```ts
  test('validation étape 2 — bouton Suivant bloqué sans campus', async ({ page }) => {
    // Étape 1 : remplir le minimum requis pour avancer
    await page.click('text=Homme');
    await page.fill('input[placeholder="Votre prénom"]', 'Test');
    await page.fill('input[placeholder="Votre nom de famille"]', 'Playwright');
    await page.selectOption('select[aria-label="Indicatif téléphonique du pays"]', '+33');
    await page.fill('input[placeholder="0612345678"]', '0612345678');
    await page.click('button:has-text("Suivant")');
    await expect(page.getByText(/[ÉE]tape 2/)).toBeVisible({ timeout: 8_000 });

    // Étape 2 : remplir la ville mais pas le campus, puis tenter de continuer
    await page.fill('input[placeholder="Ex : Paris"]', 'Paris');
    await page.click('button:has-text("Suivant")');

    // Doit rester sur étape 2 — erreur "campus obligatoire" visible
    await expect(page.getByText('Le campus est obligatoire.')).toBeVisible();
  });

```

- [ ] **Étape 2 : Lancer le test**

Run : `npm run test:e2e -- formulaire.spec.ts` (depuis `frontend/`)
Expected: PASS. Nécessite que le backend de dev tourne (`npm run dev` dans `backend/`) et le frontend aussi, selon la config `playwright.config.ts` existante — suivre la même procédure que pour les tests e2e déjà en place dans le repo.

- [ ] **Étape 3 : Commit**

```bash
git add frontend/e2e/formulaire.spec.ts
git commit -m "test(campus): validation du champ campus obligatoire sur formulaire presentiel

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task C4bis : `e2e/formulaire.spec.ts` — même cas de validation Campus pour le formulaire en ligne

**Contexte :** ajoutée suite à la revue qualité de C4, qui a signalé que `FormEnLigne.tsx` a reçu exactement la même validation `if (!form.campus) e.campus = 'Le campus est obligatoire.'` que `FormPresentiel.tsx` (étape 2, ajoutée en Task C2), mais qu'aucun test e2e ne la couvre — seul un test de chargement de page existe pour `/form/en-ligne`. La validation serveur (C1bis) reste un filet de sécurité, mais sans ce test une régression du gating côté client (mauvais index d'étape, faute de frappe dans le nom de champ, payload qui perd `campus`) ne serait détectée qu'en production sous forme de 400.

**Fichiers:**
- Modify: `frontend/e2e/formulaire.spec.ts:101-106` (describe `'Formulaire en ligne'`)

- [ ] **Étape 1 : Ajouter le test de validation**

Dans le describe `'Formulaire en ligne'`, après le test `'chargement de la page formulaire en ligne'`, insérer :

```ts
  test('validation étape 2 — bouton Suivant bloqué sans campus', async ({ page }) => {
    await page.goto('/form/en-ligne');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5_000 });

    // Étape 1 : remplir le minimum requis pour avancer (genre, prénom, nom, téléphone)
    await page.click('text=Homme');
    await page.fill('input[placeholder="Votre prénom"]', 'Test');
    await page.fill('input[placeholder="Votre nom de famille"]', 'Playwright');
    await page.selectOption('select[aria-label="Indicatif téléphonique du pays"]', '+33');
    await page.fill('input[placeholder="0612345678"]', '0612345678');
    await page.click('button:has-text("Suivant")');
    await expect(page.getByText(/[ÉE]tape 2/)).toBeVisible({ timeout: 8_000 });

    // Étape 2 : remplir la ville et l'état civil (tous deux requis) mais pas le campus
    await page.fill('input[placeholder="Ex : Paris"]', 'Paris');
    await page.click('text=Célibataire');
    await page.click('button:has-text("Suivant")');

    // Doit rester sur étape 2 — erreur "campus obligatoire" visible
    await expect(page.getByText('Le campus est obligatoire.')).toBeVisible();
  });

```

Note : contrairement au describe `'Formulaire présentiel'`, ce describe n'a pas de `beforeEach` qui navigue vers la page — chaque test fait son propre `page.goto('/form/en-ligne')`. Suivre ce pattern existant (ne pas ajouter de `beforeEach`).

- [ ] **Étape 2 : Lancer le test**

Run : `npm run test:e2e -- formulaire.spec.ts` (depuis `frontend/`)
Expected: PASS (9/9 tests au total dans le fichier). Nécessite que le backend et le frontend de dev tournent, comme pour C4.

- [ ] **Étape 3 : Commit**

```bash
git add frontend/e2e/formulaire.spec.ts
git commit -m "test(campus): validation du champ campus obligatoire sur formulaire en ligne

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Partie D — Backend : CampusSettings (modèle, helper, migration, controllers, cron)

### Task D1 : Modèle Prisma `CampusSettings`

**Fichiers:**
- Modify: `backend/prisma/schema.prisma` (juste après le modèle `Settings`, ligne ~596)

- [ ] **Étape 1 : Ajouter le modèle**

Dans `backend/prisma/schema.prisma`, juste après la fermeture du modèle `Settings` (après la ligne `}` qui suit `updated_at DateTime @updatedAt` du modèle `Settings`, avant le commentaire `// CONNECTION LOG`), insérer :

```prisma

// ─────────────────────────────────────────
// CAMPUS SETTINGS
// Paramètres de messagerie scopés par campus (templates WhatsApp, infos église,
// verset du certificat). Une ligne par [campus, key]. Contrairement à Settings
// (globale, seuils d'alerte uniquement), chaque campus a ses propres valeurs —
// un admin_campus ne peut modifier que les lignes de son propre campus.
// ─────────────────────────────────────────

model CampusSettings {
  id         String   @id @default(cuid())
  campus     Campus
  key        String
  value      String
  updated_at DateTime @updatedAt

  @@unique([campus, key])
}
```

- [ ] **Étape 2 : Pousser le schéma et régénérer le client**

Run (depuis `backend/`) :
```bash
npx prisma db push
npx prisma generate
```
Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Étape 3 : Vérifier**

Run : `npm run typecheck` (depuis `backend/`)
Expected: aucune erreur.

- [ ] **Étape 4 : Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(campus-settings): ajouter le modele CampusSettings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task D2 : Mock Prisma — ajouter `campusSettings`

**Fichiers:**
- Modify: `backend/src/__tests__/__mocks__/prisma.ts`

- [ ] **Étape 1 : Ajouter le modèle mocké**

Remplacer :

```ts
  settings: {
    findUnique:  jest.fn(),
    findMany:    jest.fn(),
    upsert:      jest.fn(),
  },
```

Par :

```ts
  settings: {
    findUnique:  jest.fn(),
    findMany:    jest.fn(),
    upsert:      jest.fn(),
    deleteMany:  jest.fn(),
  },
  campusSettings: {
    findUnique:  jest.fn(),
    findMany:    jest.fn(),
    upsert:      jest.fn(),
  },
```

- [ ] **Étape 2 : Vérifier**

Run : `npm run typecheck` (depuis `backend/`)
Expected: aucune erreur.

- [ ] **Étape 3 : Commit**

```bash
git add backend/src/__tests__/__mocks__/prisma.ts
git commit -m "test(campus-settings): mock prisma.campusSettings et prisma.settings.deleteMany

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task D3 : `backend/src/lib/campusSettings.ts` — helper de lecture

**Fichiers:**
- Create: `backend/src/lib/campusSettings.ts`
- Modify: `backend/src/controllers/messages.controller.ts:404-413` (déplacer DEFAULT_BIENVENUE_TEMPLATE)
- Test: `backend/src/__tests__/unit/campusSettings.test.ts`

- [ ] **Étape 1 : Écrire le test qui échoue**

Créer `backend/src/__tests__/unit/campusSettings.test.ts` :

```ts
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
```

- [ ] **Étape 2 : Lancer le test pour vérifier qu'il échoue**

Run : `npm test -- campusSettings.test.ts` (depuis `backend/`)
Expected: FAIL — le module `../../lib/campusSettings` n'existe pas encore.

- [ ] **Étape 3 : Créer le helper**

Créer `backend/src/lib/campusSettings.ts` :

```ts
// src/lib/campusSettings.ts
// Paramètres de messagerie scopés par campus (templates WhatsApp, infos église,
// verset certificat). Remplace l'ancienne table Settings globale pour ces 9 clés —
// voir scripts/migrate-campus-settings.ts. Les seuils d'alerte restent dans
// Settings (globaux, super_admin uniquement).

import prisma from './prisma';

// Les 9 clés scopées par campus — toute nouvelle clé de messagerie par campus doit être ajoutée ici.
export const CAMPUS_SETTINGS_KEYS = [
  'message_bienvenue',
  'template_anniversaire',
  'template_nouvel_an',
  'template_evenement',
  'message_evenement_default',
  'nom_eglise',
  'adresse_eglise',
  'telephone_eglise',
  'certificat_verset',
] as const;

export type CampusSettingKey = typeof CAMPUS_SETTINGS_KEYS[number];

// Template par défaut utilisé si la clé 'message_bienvenue' n'est pas encore configurée.
// Déplacé ici depuis messages.controller.ts (qui le ré-exporte pour compatibilité).
export const DEFAULT_BIENVENUE_TEMPLATE =
  `Bonjour [Prenom], en espérant que votre semaine se passe très bien par la grâce de Dieu. ` +
  `L'église Phila Cité des Adorateurs est ravie de vous compter parmi ses fidèles ! ` +
  `Je suis [Referent], votre référent d'intégration. ` +
  `N'hésitez pas à me contacter au [Telephone_Referent]. ` +
  `Vous pouvez aussi joindre l'église au [Telephone_Eglise]. ` +
  `Nous allons prier pour vous. Avez-vous des sujets particuliers de prière ?`;

// Valeur de repli si une clé n'a pas encore de ligne CampusSettings pour un campus donné.
export const DEFAULT_CAMPUS_SETTINGS: Record<CampusSettingKey, string> = {
  message_bienvenue:          DEFAULT_BIENVENUE_TEMPLATE,
  template_anniversaire:      'Joyeux anniversaire [Prenom] ! 🎂 Toute l\'équipe Phila vous souhaite une excellente journée. Que Dieu vous bénisse abondamment.',
  template_nouvel_an:         "Bonne année [Prenom] ! 🎉 Toute l'équipe de Phila Cité des Adorateurs vous souhaite une excellente année, pleine de grâce, de santé et de victoires. Que Dieu vous comble de Ses bénédictions en cette nouvelle année !",
  template_evenement:         "Bonjour [Prenom] ! 👋\n\nNous avons le plaisir de vous inviter à notre prochain événement à l'église Phila Cité des Adorateurs.\n\n📅 Date : [Date]\n🎯 Thème : [Theme]\n📍 Adresse : [Adresse]\n\nNous serions ravis de vous y retrouver. Votre présence sera une bénédiction pour toute la communauté.\n\nPour toute information, contactez-nous au [Telephone_Eglise].\n\nQue Dieu vous bénisse ! 🙏\nL'équipe Phila Cité des Adorateurs",
  message_evenement_default:  'Bonjour {prenom}, nous vous invitons à notre événement "{titre_evenement}" le {date_evenement}.',
  nom_eglise:                 'Cité des Adorateurs',
  adresse_eglise:             '',
  telephone_eglise:           '',
  certificat_verset:          "\"Car je connais les projets que j'ai formés sur vous, dit l'Éternel, projets de paix et non de malheur, afin de vous donner un avenir et de l'espérance.\" - Jérémie 29:11",
};

// Charge un sous-ensemble de clés pour UN campus, avec repli sur DEFAULT_CAMPUS_SETTINGS
// pour toute clé sans ligne en base.
export async function getCampusSettingsWithDefaults(
  campus: string,
  keys: readonly CampusSettingKey[] = CAMPUS_SETTINGS_KEYS
): Promise<Record<CampusSettingKey, string>> {
  const rows = await prisma.campusSettings.findMany({
    where: { campus: campus as never, key: { in: keys as string[] } },
  });
  const found: Record<string, string> = {};
  for (const row of rows) found[row.key] = row.value;

  const result = {} as Record<CampusSettingKey, string>;
  for (const key of keys) result[key] = found[key] ?? DEFAULT_CAMPUS_SETTINGS[key];
  return result;
}

// Charge les mêmes clés pour plusieurs campus en un seul aller-retour DB — utilisé par
// le cron pour traiter un lot de contacts multi-campus sans recharger les réglages à
// chaque contact. Chaque campus du tableau obtient une entrée dans la Map (repli déjà
// appliqué), même s'il n'a aucune ligne en base. Les campus en double sont dédupliqués
// avant la requête DB.
export async function getCampusSettingsForMany(
  campuses: readonly string[],
  keys: readonly CampusSettingKey[] = CAMPUS_SETTINGS_KEYS
): Promise<Map<string, Record<CampusSettingKey, string>>> {
  const uniqueCampuses = [...new Set(campuses)];
  const rows = await prisma.campusSettings.findMany({
    where: { campus: { in: uniqueCampuses as never[] }, key: { in: keys as string[] } },
  });

  const byCampus = new Map<string, Record<string, string>>();
  for (const c of uniqueCampuses) byCampus.set(c, {});
  for (const row of rows) byCampus.get(row.campus)![row.key] = row.value;

  const result = new Map<string, Record<CampusSettingKey, string>>();
  for (const c of uniqueCampuses) {
    const found = byCampus.get(c)!;
    const withDefaults = {} as Record<CampusSettingKey, string>;
    for (const key of keys) withDefaults[key] = found[key] ?? DEFAULT_CAMPUS_SETTINGS[key];
    result.set(c, withDefaults);
  }
  return result;
}
```

- [ ] **Étape 4 : Ré-exporter DEFAULT_BIENVENUE_TEMPLATE depuis messages.controller.ts pour compatibilité**

Dans `backend/src/controllers/messages.controller.ts`, remplacer :

```ts
// ─── Helpers ─────────────────────────────────────────────────────────────────

// Template par défaut utilisé si la clé 'message_bienvenue' n'est pas encore configurée en BDD.
export const DEFAULT_BIENVENUE_TEMPLATE =
  `Bonjour [Prenom], en espérant que votre semaine se passe très bien par la grâce de Dieu. ` +
  `L'église Phila Cité des Adorateurs est ravie de vous compter parmi ses fidèles ! ` +
  `Je suis [Referent], votre référent d'intégration. ` +
  `N'hésitez pas à me contacter au [Telephone_Referent]. ` +
  `Vous pouvez aussi joindre l'église au [Telephone_Eglise]. ` +
  `Nous allons prier pour vous. Avez-vous des sujets particuliers de prière ?`;
```

Par :

```ts
// ─── Helpers ─────────────────────────────────────────────────────────────────

// Déplacé vers lib/campusSettings.ts (source de vérité, avec DEFAULT_CAMPUS_SETTINGS).
// Ré-exporté ici pour ne pas casser les imports existants (cron.ts notamment).
export { DEFAULT_BIENVENUE_TEMPLATE } from '../lib/campusSettings';
```

- [ ] **Étape 5 : Lancer le test pour vérifier qu'il passe**

Run : `npm test -- campusSettings.test.ts` (depuis `backend/`)
Expected: PASS (5/5).

- [ ] **Étape 6 : Vérifier que le reste du backend compile toujours**

Run : `npm run typecheck` (depuis `backend/`)
Expected: aucune erreur.

- [ ] **Étape 7 : Commit**

```bash
git add backend/src/lib/campusSettings.ts backend/src/controllers/messages.controller.ts backend/src/__tests__/unit/campusSettings.test.ts
git commit -m "feat(campus-settings): helper getCampusSettingsWithDefaults/getCampusSettingsForMany

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task D4 : Script de migration one-shot

**Fichiers:**
- Create: `backend/scripts/migrate-campus-settings.ts`
- Modify: `backend/package.json` (nouveau script npm)

- [ ] **Étape 1 : Créer le script**

Créer `backend/scripts/migrate-campus-settings.ts` :

```ts
// scripts/migrate-campus-settings.ts
// Migration one-shot : copie les 9 clés de messagerie de Settings (global) vers
// CampusSettings (par campus), pour les 4 campus. Paris et Paris Nord repartent de
// la valeur globale actuelle (rien ne change pour eux) ; Orléans et Montpellier
// démarrent avec la même copie, à adapter par leur admin. Supprime ensuite les
// lignes Settings devenues obsolètes.
//
// Rejouable sans danger : n'écrase pas une ligne CampusSettings déjà migrée.
//
// Usage : npx tsx scripts/migrate-campus-settings.ts

import prisma from '../src/lib/prisma';
import { CAMPUS_SETTINGS_KEYS, DEFAULT_CAMPUS_SETTINGS } from '../src/lib/campusSettings';

const CAMPUSES = ['paris', 'paris_nord', 'orleans', 'montpellier'] as const;

async function main() {
  const existing = await prisma.settings.findMany({
    where: { key: { in: CAMPUS_SETTINGS_KEYS as unknown as string[] } },
  });
  const currentValues: Record<string, string> = {};
  for (const row of existing) currentValues[row.key] = row.value;

  let upserted = 0;
  for (const key of CAMPUS_SETTINGS_KEYS) {
    const value = currentValues[key] ?? DEFAULT_CAMPUS_SETTINGS[key];
    for (const campus of CAMPUSES) {
      await prisma.campusSettings.upsert({
        where:  { campus_key: { campus, key } },
        update: {},                          // ne pas écraser si déjà migré
        create: { campus, key, value },
      });
      upserted++;
    }
  }
  console.log(`[migrate-campus-settings] ${upserted} ligne(s) CampusSettings créée(s)/vérifiée(s).`);

  const deleted = await prisma.settings.deleteMany({
    where: { key: { in: CAMPUS_SETTINGS_KEYS as unknown as string[] } },
  });
  console.log(`[migrate-campus-settings] ${deleted.count} ancienne(s) ligne(s) Settings supprimée(s).`);
}

main()
  .catch(err => { console.error('[migrate-campus-settings] Erreur :', err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
```

- [ ] **Étape 2 : Ajouter le script npm**

Dans `backend/package.json`, dans le bloc `"scripts"`, ajouter une ligne après `"seed": "tsx scripts/seed.ts",` :

```json
    "migrate-campus-settings": "tsx scripts/migrate-campus-settings.ts",
```

- [ ] **Étape 3 : Exécuter la migration sur la base de développement locale**

Run (depuis `backend/`, avec `DATABASE_URL` pointé sur la base de dev — jamais sur Neon.tech production à ce stade) :
```bash
npm run migrate-campus-settings
```
Expected: logs `[migrate-campus-settings] 36 ligne(s) CampusSettings créée(s)/vérifiée(s).` (9 clés × 4 campus) et `[migrate-campus-settings] N ancienne(s) ligne(s) Settings supprimée(s).` (N = nombre de ces 9 clés qui existaient déjà en base, entre 0 et 9 selon l'état de la base de dev).

- [ ] **Étape 4 : Vérifier**

Run : `npm run typecheck` (depuis `backend/`)
Expected: aucune erreur.

- [ ] **Étape 5 : Commit**

```bash
git add backend/scripts/migrate-campus-settings.ts backend/package.json
git commit -m "feat(campus-settings): script de migration one-shot Settings -> CampusSettings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

Note pour la mise en production : ce script doit être exécuté une fois manuellement contre `DATABASE_URL` de Neon.tech après le déploiement du nouveau schéma (`prisma db push` en production), avant que les utilisateurs ne commencent à éditer les paramètres par campus.

---

### Task D5 : Réécrire `settings.controller.ts`

**Fichiers:**
- Modify: `backend/src/controllers/settings.controller.ts` (réécriture complète)
- Test: `backend/src/__tests__/unit/settings.controller.test.ts`

- [ ] **Étape 1 : Écrire les tests qui échouent**

Créer `backend/src/__tests__/unit/settings.controller.test.ts` :

```ts
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
    // $transaction est mocke pour executer le tableau de promesses passe — on verifie
    // que chaque upsert cible bien 'orleans', jamais un autre campus.
    expect(upsertCalls.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Étape 2 : Lancer les tests pour vérifier qu'ils échouent**

Run : `npm test -- settings.controller.test.ts` (depuis `backend/`)
Expected: FAIL — les fonctions `getGlobalSettings`, `updateGlobalSettings`, `getCampusSettingsHandler`, `updateCampusSettingsHandler` n'existent pas encore (seuls `getSettings`/`updateSettings` existent).

- [ ] **Étape 3 : Réécrire le contrôleur**

Remplacer tout le contenu de `backend/src/controllers/settings.controller.ts` par :

```ts
// src/controllers/settings.controller.ts
// Paramètres système.
// - global*  : seuils d'alerte, stockés dans Settings — super_admin uniquement (route).
// - campus*  : templates messages + infos église + verset certificat, stockés dans
//   CampusSettings, un campus à la fois — accès vérifié par requireCampusAccess (route).

import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { Campus } from '../../generated/prisma/client';
import { CAMPUS_SETTINGS_KEYS, type CampusSettingKey } from '../lib/campusSettings';

// GET /api/settings/global
export async function getGlobalSettings(_req: Request, res: Response): Promise<void> {
  const rows = await prisma.settings.findMany();
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  res.json(result);
}

// PUT /api/settings/global — body: [{key, value}, ...]
export async function updateGlobalSettings(req: Request, res: Response): Promise<void> {
  const entries = req.body as { key: string; value: string }[];

  if (!Array.isArray(entries) || entries.length === 0) {
    res.status(400).json({ message: 'Corps attendu : tableau non vide [{key, value}]' });
    return;
  }

  await prisma.$transaction(
    entries.map(({ key, value }) =>
      prisma.settings.upsert({
        where:  { key },
        update: { value },
        create: { key, value },
      })
    )
  );

  const rows = await prisma.settings.findMany();
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  res.json(result);
}

// GET /api/settings/campus/:campus
export async function getCampusSettingsHandler(req: Request, res: Response): Promise<void> {
  const campus = String(req.params.campus);
  if (!Object.values(Campus).includes(campus as Campus)) {
    res.status(400).json({ message: `Campus inconnu : ${campus}` });
    return;
  }
  const rows = await prisma.campusSettings.findMany({ where: { campus: campus as never } });
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  res.json(result);
}

// PUT /api/settings/campus/:campus — body: [{key, value}, ...]
// N'écrit que sur le campus de l'URL — impossible d'impacter un autre campus depuis cette route.
export async function updateCampusSettingsHandler(req: Request, res: Response): Promise<void> {
  const campus = String(req.params.campus);
  if (!Object.values(Campus).includes(campus as Campus)) {
    res.status(400).json({ message: `Campus inconnu : ${campus}` });
    return;
  }
  const entries = req.body as { key: string; value: string }[];

  if (!Array.isArray(entries) || entries.length === 0) {
    res.status(400).json({ message: 'Corps attendu : tableau non vide [{key, value}]' });
    return;
  }

  const invalidEntry = entries.find(e => !CAMPUS_SETTINGS_KEYS.includes(e.key as CampusSettingKey));
  if (invalidEntry) {
    res.status(400).json({ message: `Clé de paramètre inconnue : ${invalidEntry.key}` });
    return;
  }

  await prisma.$transaction(
    entries.map(({ key, value }) =>
      prisma.campusSettings.upsert({
        where:  { campus_key: { campus: campus as never, key } },
        update: { value },
        create: { campus: campus as never, key, value },
      })
    )
  );

  const rows = await prisma.campusSettings.findMany({ where: { campus: campus as never } });
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  res.json(result);
}
```

- [ ] **Étape 4 : Lancer les tests pour vérifier qu'ils passent**

Run : `npm test -- settings.controller.test.ts` (depuis `backend/`)
Expected: PASS (5/5).

- [ ] **Étape 5 : Vérifier l'ensemble du backend**

Run : `npm run typecheck && npm test` (depuis `backend/`)
Expected: aucune erreur ; suite complète verte (les anciens tests ne référençaient pas `getSettings`/`updateSettings` par leur nom — vérifié par grep préalable, aucune régression attendue).

- [ ] **Étape 6 : Commit**

```bash
git add backend/src/controllers/settings.controller.ts backend/src/__tests__/unit/settings.controller.test.ts
git commit -m "feat(campus-settings): reecrire settings.controller en handlers global/campus

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task D6 : Réécrire `settings.routes.ts`

**Fichiers:**
- Modify: `backend/src/routes/settings.routes.ts` (réécriture complète)

- [ ] **Étape 1 : Réécrire les routes**

Remplacer tout le contenu de `backend/src/routes/settings.routes.ts` par :

```ts
// src/routes/settings.routes.ts
// Paramètres système.
// - /global          : seuils d'alerte — super_admin uniquement.
// - /campus/:campus  : templates messages + infos église — super_admin (tous campus)
//   ou admin_campus (uniquement les campus de son user.campus[]).
//
// requireCampusAccess seul ne vérifie QUE l'appartenance au campus, pas le rôle
// (un lecteur/referent_integration scopé sur ce campus passerait aussi) — d'où le
// requireMinRole('admin_campus') systématiquement chaîné avant lui sur ces 2 routes.

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole, requireMinRole, requireCampusAccess } from '../middlewares/roles.middleware';
import {
  getGlobalSettings, updateGlobalSettings,
  getCampusSettingsHandler, updateCampusSettingsHandler,
} from '../controllers/settings.controller';

const router = Router();

router.use(authenticate);

router.get('/global', requireRole('super_admin'), getGlobalSettings);
router.put('/global', requireRole('super_admin'), updateGlobalSettings);

router.get('/campus/:campus', requireMinRole('admin_campus'), requireCampusAccess, getCampusSettingsHandler);
router.put('/campus/:campus', requireMinRole('admin_campus'), requireCampusAccess, updateCampusSettingsHandler);

export default router;
```

- [ ] **Étape 1bis : Note sur les tests**

`requireMinRole` est une fonction existante, déjà utilisée ailleurs dans le backend avant ce plan — son comportement (bloquer les rôles sous le seuil) n'est pas nouveau, seule sa composition avec `requireCampusAccess` sur ces 2 routes l'est. Aucun fichier `*.routes.ts` n'a de test dédié dans ce repo (vérifié pendant le brainstorming) — cohérent avec l'existant, pas de nouveau test de routing ajouté ici. Si `requireMinRole` n'a pas déjà de couverture unitaire directe, ce n'est pas la responsabilité de cette tâche de l'ajouter (elle est réutilisée telle quelle, sans modification).

- [ ] **Étape 2 : Vérifier**

Run : `npm run typecheck` (depuis `backend/`)
Expected: aucune erreur.

- [ ] **Étape 3 : Commit**

```bash
git add backend/src/routes/settings.routes.ts
git commit -m "feat(campus-settings): routes /settings/global et /settings/campus/:campus

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task D7 : `cron.ts` — rendre les tâches de messagerie campus-aware

Actuellement, chaque tâche charge le template UNE fois pour tout le lot de contacts, tous campus confondus, puis applique la même valeur à tout le monde. On regroupe désormais les destinataires par campus et on charge les réglages de chaque campus rencontré une seule fois.

**Fichiers:**
- Modify: `backend/src/lib/cron.ts:17-22` (imports), `:55-73` (Tâche 1), `:113` (Tâche 2), `:307-351` (bloc Initialisation, supprimé), `:373-421` (Tâche 5), `:556-599` (Tâche 10)

- [ ] **Étape 1 : Mettre à jour les imports**

Remplacer :

```ts
import cron from 'node-cron';
import prisma from './prisma';
import { sendWhatsApp, sendWhatsAppBulk } from './twilio';
import { sendRapportHebdomadaire } from './email';
import { applyVariables, DEFAULT_BIENVENUE_TEMPLATE, buildDestinataireWhere, buildFiltresWhere } from '../controllers/messages.controller';
import crypto from 'crypto';
```

Par :

```ts
import cron from 'node-cron';
import prisma from './prisma';
import { sendWhatsApp, sendWhatsAppBulk } from './twilio';
import { sendRapportHebdomadaire } from './email';
import { applyVariables, buildDestinataireWhere, buildFiltresWhere } from '../controllers/messages.controller';
import { getCampusSettingsForMany, getCampusSettingsWithDefaults } from './campusSettings';
import crypto from 'crypto';
```

- [ ] **Étape 2 : Tâche 1 (bienvenue J+3) — grouper par campus**

Remplacer :

```ts
    // Charge le template et les settings de l'église une seule fois pour tous les contacts du batch
    const [settingTemplate, settingTelEglise, settingAdresse] = await Promise.all([
      prisma.settings.findUnique({ where: { key: 'message_bienvenue' } }),
      prisma.settings.findUnique({ where: { key: 'telephone_eglise' } }),
      prisma.settings.findUnique({ where: { key: 'adresse_eglise' } }),
    ]);
    const bienvenueTemplate = settingTemplate?.value ?? DEFAULT_BIENVENUE_TEMPLATE;
    const telephoneEglise   = settingTelEglise?.value ?? '';
    const adresseEglise     = settingAdresse?.value   ?? '';

    for (const contact of contacts) {
      const ref = contact.referent_integration;
      const contenu = applyVariables(bienvenueTemplate, {
        prenom:            contact.prenom,
        referentNom:       ref ? `${ref.prenom} ${ref.nom}` : '',
        referentTelephone: ref?.telephone ?? '',
        telephoneEglise,
        adresseEglise,
      });
```

Par :

```ts
    // Charge les réglages de chaque campus présent dans le lot en un seul aller-retour DB —
    // chaque contact reçoit le template/les infos de SON campus, pas une valeur unique pour tous.
    const settingsByCampus = await getCampusSettingsForMany(
      contacts.map(c => c.campus),
      ['message_bienvenue', 'telephone_eglise', 'adresse_eglise']
    );

    for (const contact of contacts) {
      const ref = contact.referent_integration;
      const s   = settingsByCampus.get(contact.campus)!;
      const contenu = applyVariables(s.message_bienvenue, {
        prenom:            contact.prenom,
        referentNom:       ref ? `${ref.prenom} ${ref.nom}` : '',
        referentTelephone: ref?.telephone ?? '',
        telephoneEglise:   s.telephone_eglise,
        adresseEglise:     s.adresse_eglise,
      });
```

- [ ] **Étape 3 : Tâche 2 (envois groupés planifiés) — adresse église par campus de l'événement**

Remplacer :

```ts
    if (evenements.length === 0) return;

    const adresseEglise = (await prisma.settings.findUnique({ where: { key: 'adresse_eglise' } }))?.value ?? '';

    for (const ev of evenements) {
      console.log(`[Cron] Envoi événement: ${ev.titre}`);
```

Par :

```ts
    if (evenements.length === 0) return;

    for (const ev of evenements) {
      console.log(`[Cron] Envoi événement: ${ev.titre}`);

      // 'paris' = maison mère, utilisée si l'événement cible plusieurs/tous les campus (ev.campus null)
      const templateCampus = (ev.campus as string | null) ?? 'paris';
      const { adresse_eglise: adresseEglise } = await getCampusSettingsWithDefaults(templateCampus, ['adresse_eglise']);
```

- [ ] **Étape 4 : Supprimer le bloc d'initialisation des settings globales (obsolète)**

Supprimer entièrement le bloc (de `// ── Initialisation : créer les settings par défaut s'ils n'existent pas ─────` jusqu'à `.catch(() => {/* ignore si settings non disponibles au démarrage */});` inclus) :

```ts
  // ── Initialisation : créer les settings par défaut s'ils n'existent pas ─────
  Promise.all([
    prisma.settings.upsert({
      where:  { key: 'template_anniversaire' },
      create: {
        key:   'template_anniversaire',
        value: 'Joyeux anniversaire [Prenom] ! 🎂 Toute l\'équipe Phila vous souhaite une excellente journée. Que Dieu vous bénisse abondamment.',
      },
      update: {},
    }),
    prisma.settings.upsert({
      where:  { key: 'message_bienvenue' },
      create: { key: 'message_bienvenue', value: DEFAULT_BIENVENUE_TEMPLATE },
      update: {},
    }),
    prisma.settings.upsert({
      where:  { key: 'telephone_eglise' },
      create: { key: 'telephone_eglise', value: '' },
      update: {},
    }),
    prisma.settings.upsert({
      where:  { key: 'template_nouvel_an' },
      create: {
        key:   'template_nouvel_an',
        value: "Bonne année [Prenom] ! 🎉 Toute l'équipe de Phila Cité des Adorateurs vous souhaite une excellente année, pleine de grâce, de santé et de victoires. Que Dieu vous comble de Ses bénédictions en cette nouvelle année !",
      },
      update: {},
    }),
    prisma.settings.upsert({
      where:  { key: 'template_evenement' },
      create: {
        key:   'template_evenement',
        value: "Bonjour [Prenom] ! 👋\n\nNous avons le plaisir de vous inviter à notre prochain événement à l'église Phila Cité des Adorateurs.\n\n📅 Date : [Date]\n🎯 Thème : [Theme]\n📍 Adresse : [Adresse]\n\nNous serions ravis de vous y retrouver. Votre présence sera une bénédiction pour toute la communauté.\n\nPour toute information, contactez-nous au [Telephone_Eglise].\n\nQue Dieu vous bénisse ! 🙏\nL'équipe Phila Cité des Adorateurs",
      },
      update: {},
    }),
    prisma.settings.upsert({
      where:  { key: 'certificat_verset' },
      update: {},
      create: {
        key:   'certificat_verset',
        value: "\"Car je connais les projets que j'ai formés sur vous, dit l'Éternel, projets de paix et non de malheur, afin de vous donner un avenir et de l'espérance.\" - Jérémie 29:11",
      },
    }),
  ]).catch(() => {/* ignore si settings non disponibles au démarrage */});

  // ── Tâche 5 : Messages d'anniversaire (tous les jours à 09h00) ──────────────
```

Par (ne garder que le commentaire de tâche, sans le bloc d'initialisation) :

```ts
  // ── Tâche 5 : Messages d'anniversaire (tous les jours à 09h00) ──────────────
```

- [ ] **Étape 5a : Tâche 5 (anniversaire) — ajouter campus au select des contacts**

`contact.campus` est utilisé plus bas dans cette tâche (étape 5b) mais le `select` actuel ne le charge pas. Remplacer :

```ts
    const contacts = await prisma.contact.findMany({
      where:  { date_naissance: { not: null } },
      select: { id: true, prenom: true, telephone: true, date_naissance: true },
    });
```

Par :

```ts
    const contacts = await prisma.contact.findMany({
      where:  { date_naissance: { not: null } },
      select: { id: true, prenom: true, telephone: true, date_naissance: true, campus: true },
    });
```

- [ ] **Étape 5b : Tâche 5 (anniversaire) — grouper par campus, contacts et ouvriers**

Remplacer :

```ts
    const [setting, settingAdresse] = await Promise.all([
      prisma.settings.findUnique({ where: { key: 'template_anniversaire' } }),
      prisma.settings.findUnique({ where: { key: 'adresse_eglise' } }),
    ]);
    const template      = setting?.value        ?? 'Joyeux anniversaire [Prenom] ! 🎂 Que Dieu vous bénisse abondamment.';
    const adresseEglise = settingAdresse?.value ?? '';

    for (const contact of anniversaires) {
      const contenu    = template
        .replace(/\[Prenom\]/gi,  contact.prenom)
        .replace(/\[Adresse\]/gi, adresseEglise);
```

Par :

```ts
    const settingsByCampus = await getCampusSettingsForMany(
      anniversaires.map(c => c.campus),
      ['template_anniversaire', 'adresse_eglise']
    );

    for (const contact of anniversaires) {
      const s       = settingsByCampus.get(contact.campus)!;
      const contenu = s.template_anniversaire
        .replace(/\[Prenom\]/gi,  contact.prenom)
        .replace(/\[Adresse\]/gi, s.adresse_eglise);
```

Puis, pour la boucle ouvriers un peu plus bas dans la même tâche, remplacer :

```ts
    console.log(`[Cron] ${ouvriersAujourdHui.length} anniversaire(s) ouvrier(s) aujourd'hui`);
    for (const ouvrier of ouvriersAujourdHui) {
      const message = template
        .replace(/\[Prenom\]/g,  ouvrier.prenom)
        .replace(/\[Adresse\]/g, adresseEglise);
      const { error } = await sendWhatsApp(ouvrier.telephone, message);
      if (error) console.error(`[ANNIVERSAIRE] Erreur ouvrier ${ouvrier.prenom}:`, error);
    }
```

Par :

```ts
    console.log(`[Cron] ${ouvriersAujourdHui.length} anniversaire(s) ouvrier(s) aujourd'hui`);
    const settingsByCampusOuvriers = await getCampusSettingsForMany(
      ouvriersAujourdHui.map(o => o.campus),
      ['template_anniversaire', 'adresse_eglise']
    );
    for (const ouvrier of ouvriersAujourdHui) {
      const s       = settingsByCampusOuvriers.get(ouvrier.campus)!;
      const message = s.template_anniversaire
        .replace(/\[Prenom\]/g,  ouvrier.prenom)
        .replace(/\[Adresse\]/g, s.adresse_eglise);
      const { error } = await sendWhatsApp(ouvrier.telephone, message);
      if (error) console.error(`[ANNIVERSAIRE] Erreur ouvrier ${ouvrier.prenom}:`, error);
    }
```

- [ ] **Étape 6 : Tâche 10 (Nouvel An) — grouper par campus**

Remplacer :

```ts
    const [setting, settingAdresse] = await Promise.all([
      prisma.settings.findUnique({ where: { key: 'template_nouvel_an' } }),
      prisma.settings.findUnique({ where: { key: 'adresse_eglise' } }),
    ]);
    const template      = setting?.value
      ?? "Bonne année [Prenom] ! 🎉 Toute l'équipe de Phila Cité des Adorateurs vous souhaite une excellente année, pleine de grâce, de santé et de victoires. Que Dieu vous comble de Ses bénédictions en cette nouvelle année !";
    const adresseEglise = settingAdresse?.value ?? '';

    const [contacts, ouvriers] = await Promise.all([
      prisma.contact.findMany({
        where:  {},
        select: { prenom: true, telephone: true },
      }),
      prisma.ouvrier.findMany({
        where:  {},
        select: { prenom: true, telephone: true },
      }),
    ]);

    const seen = new Set<string>();
    const destinataires = [
      ...contacts.map(c => ({ prenom: c.prenom, telephone: c.telephone })),
      ...ouvriers.map(o => ({ prenom: o.prenom, telephone: o.telephone })),
    ].filter(d => {
      if (seen.has(d.telephone)) return false;
      seen.add(d.telephone);
      return true;
    });

    for (const dest of destinataires) {
      const message = template
        .replace(/\[Prenom\]/g,  dest.prenom)
        .replace(/\[Adresse\]/g, adresseEglise);
```

Par :

```ts
    const [contacts, ouvriers] = await Promise.all([
      prisma.contact.findMany({
        where:  {},
        select: { prenom: true, telephone: true, campus: true },
      }),
      prisma.ouvrier.findMany({
        where:  {},
        select: { prenom: true, telephone: true, campus: true },
      }),
    ]);

    const seen = new Set<string>();
    const destinataires = [
      ...contacts.map(c => ({ prenom: c.prenom, telephone: c.telephone, campus: c.campus })),
      ...ouvriers.map(o => ({ prenom: o.prenom, telephone: o.telephone, campus: o.campus })),
    ].filter(d => {
      if (seen.has(d.telephone)) return false;
      seen.add(d.telephone);
      return true;
    });

    const settingsByCampus = await getCampusSettingsForMany(
      destinataires.map(d => d.campus),
      ['template_nouvel_an', 'adresse_eglise']
    );

    for (const dest of destinataires) {
      const s       = settingsByCampus.get(dest.campus)!;
      const message = s.template_nouvel_an
        .replace(/\[Prenom\]/g,  dest.prenom)
        .replace(/\[Adresse\]/g, s.adresse_eglise);
```

- [ ] **Étape 7 : Vérifier**

Run : `npm run typecheck` (depuis `backend/`)
Expected: aucune erreur.

- [ ] **Étape 8 : Commit**

```bash
git add backend/src/lib/cron.ts
git commit -m "feat(campus-settings): cron.ts envoie le template/les infos du campus de chaque destinataire

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task D8 : `messages.controller.ts` — bienvenue manuelle et événement immédiat, campus-aware

**Fichiers:**
- Modify: `backend/src/controllers/messages.controller.ts:1-9` (imports), `:206-219` (sendBienvenue), `:306-312` (createEvenement)

- [ ] **Étape 1 : Importer le helper**

Remplacer :

```ts
import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { sendWhatsApp, sendWhatsAppBulk } from '../lib/twilio';
```

Par :

```ts
import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { sendWhatsApp, sendWhatsAppBulk } from '../lib/twilio';
import { getCampusSettingsWithDefaults } from '../lib/campusSettings';
```

- [ ] **Étape 2 : sendBienvenue — réglages du campus DU contact**

Remplacer :

```ts
    // Charge le template et les settings de l'église
    const [settingTemplate, settingTelEglise, settingAdresse] = await Promise.all([
      prisma.settings.findUnique({ where: { key: 'message_bienvenue' } }),
      prisma.settings.findUnique({ where: { key: 'telephone_eglise' } }),
      prisma.settings.findUnique({ where: { key: 'adresse_eglise' } }),
    ]);

    const contenu = buildBienvenueMessage(
      contact.prenom,
      referent,
      settingTelEglise?.value ?? '',
      settingTemplate?.value  ?? undefined,
      settingAdresse?.value   ?? '',
    );
```

Par :

```ts
    // Charge les réglages du campus de CE contact (pas une valeur globale)
    const s = await getCampusSettingsWithDefaults(contact.campus, ['message_bienvenue', 'telephone_eglise', 'adresse_eglise']);

    const contenu = buildBienvenueMessage(
      contact.prenom,
      referent,
      s.telephone_eglise,
      s.message_bienvenue,
      s.adresse_eglise,
    );
```

- [ ] **Étape 3 : createEvenement — adresse église du campus ciblé**

Remplacer :

```ts
    if (envoyer_maintenant) {
      const dateStr       = new Date(date_evenement).toLocaleDateString('fr-FR');
      const adresseEglise = (await prisma.settings.findUnique({ where: { key: 'adresse_eglise' } }))?.value ?? '';
      const msgText = message_template
```

Par :

```ts
    if (envoyer_maintenant) {
      const dateStr        = new Date(date_evenement).toLocaleDateString('fr-FR');
      // 'paris' = maison mère, utilisée si aucun campus n'est ciblé (envoi multi-campus)
      const templateCampus = filtres.campus ?? filtres_ouvriers.campus ?? 'paris';
      const { adresse_eglise: adresseEglise } = await getCampusSettingsWithDefaults(templateCampus, ['adresse_eglise']);
      const msgText = message_template
```

- [ ] **Étape 4 : Vérifier**

Run : `npm run typecheck && npm test` (depuis `backend/`)
Expected: aucune erreur, suite verte.

- [ ] **Étape 5 : Commit**

```bash
git add backend/src/controllers/messages.controller.ts
git commit -m "feat(campus-settings): sendBienvenue et createEvenement utilisent les reglages du campus cible

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task D9 : `contacts.controller.ts` — verset du certificat par campus

**Fichiers:**
- Modify: `backend/src/controllers/contacts.controller.ts:10-15` (imports), `:1081-1082`

- [ ] **Étape 1 : Importer le helper**

Ajouter, à côté des imports existants en tête de fichier :

```ts
import { getCampusSettingsWithDefaults } from '../lib/campusSettings';
```

- [ ] **Étape 2 : Remplacer la lecture globale par une lecture scopée au campus du contact**

Remplacer :

```ts
  const settingVerset = await prisma.settings.findUnique({ where: { key: 'certificat_verset' } });
  const verset = settingVerset?.value || "\"Car je connais les projets que j'ai formés sur vous...\" — Jérémie 29:11";
```

Par :

```ts
  const { certificat_verset: verset } = await getCampusSettingsWithDefaults(contact.campus, ['certificat_verset']);
```

- [ ] **Étape 3 : Vérifier**

Run : `npm run typecheck && npm test` (depuis `backend/`)
Expected: aucune erreur, suite verte.

- [ ] **Étape 4 : Commit**

```bash
git add backend/src/controllers/contacts.controller.ts
git commit -m "feat(campus-settings): certificat PDF utilise le verset du campus du contact

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Partie E — Frontend : UI des paramètres par campus

### Task E1 : `endpoints.ts` — nouvelles routes settings

**Fichiers:**
- Modify: `frontend/src/services/endpoints.ts:276-280`

- [ ] **Étape 1 : Remplacer settingsEndpoints**

Remplacer :

```ts
export const settingsEndpoints = {
  get:    ()                                     => api.get<Record<string, string>>('/settings'),
  update: (entries: { key: string; value: string }[]) =>
    api.put<Record<string, string>>('/settings', entries),
};
```

Par :

```ts
export const settingsEndpoints = {
  getGlobal:    ()                                         => api.get<Record<string, string>>('/settings/global'),
  updateGlobal: (entries: { key: string; value: string }[]) =>
    api.put<Record<string, string>>('/settings/global', entries),
  getCampus:    (campus: string)                            => api.get<Record<string, string>>(`/settings/campus/${campus}`),
  updateCampus: (campus: string, entries: { key: string; value: string }[]) =>
    api.put<Record<string, string>>(`/settings/campus/${campus}`, entries),
};
```

- [ ] **Étape 2 : Vérifier**

Run : `npm run build` (depuis `frontend/`) — cette étape échouera tant que `Settings.tsx` (Task E2) référence encore l'ancienne forme `settingsEndpoints.get`/`.update` ; c'est attendu, la vérification définitive se fait à la fin de Task E2.

- [ ] **Étape 3 : Commit (groupé avec Task E2)**

Ce fichier est commité avec `Settings.tsx` à la fin de Task E2 (même unité logique).

---

### Task E2 : Réécrire `Settings.tsx` — onglets campus + accès `admin_campus`

**Fichiers:**
- Modify: `frontend/src/features/admin/Settings.tsx` (réécriture complète)

- [ ] **Étape 1 : Réécrire le composant**

Remplacer tout le contenu de `frontend/src/features/admin/Settings.tsx` par :

```tsx
// src/features/admin/Settings.tsx
// Paramètres : Seuils & Alertes (super_admin uniquement, globaux) + templates
// messages/infos église/certificat (par campus — super_admin sur les 4 campus,
// admin_campus limité aux campus de son user.campus[]).

import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, MessageSquare, PartyPopper, Calendar, GraduationCap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { settingsEndpoints } from '../../services/endpoints';
import { CAMPUS_LABELS, CAMPUS_OPTIONS, ROLE_RANK } from '../../utils/constants';
import type { Campus } from '../../types';

// ─── Définition des paramètres ────────────────────────────────────────────────

interface SettingDef {
  key:         string;
  label:       string;
  description: string;
  type:        'number' | 'text' | 'textarea';
  placeholder?: string;
  min?:        number;
  max?:        number;
}

const GLOBAL_SECTIONS: { label: string; icon: ReactNode; settings: SettingDef[] }[] = [
  {
    label: 'Seuils & Alertes',
    icon:  <AlertTriangle size={16} />,
    settings: [
      {
        key: 'seuil_sans_referent',
        label: 'Alerte contact sans référent (jours)',
        description: 'Déclenche une notification si un contact n\'a pas de référent intégration après ce délai.',
        type: 'number', min: 1, max: 30, placeholder: '7',
      },
      {
        key: 'seuil_relance_contact',
        label: 'Délai relance contact (jours)',
        description: 'Rappel au référent si aucune interaction avec son contact depuis ce nombre de jours.',
        type: 'number', min: 1, max: 90, placeholder: '14',
      },
      {
        key: 'nb_jours_inactivite',
        label: 'Inactivité avant passage "inactif" (jours)',
        description: 'Un contact sans mise à jour depuis ce délai sera marqué comme inactif automatiquement.',
        type: 'number', min: 30, max: 365, placeholder: '90',
      },
    ],
  },
];

const CAMPUS_SECTIONS: { label: string; icon: ReactNode; settings: SettingDef[] }[] = [
  {
    label: 'Infos Église',
    icon:  '⛪',
    settings: [
      {
        key: 'nom_eglise',
        label: 'Nom de l\'église',
        description: 'Utilisé dans les messages envoyés aux contacts de ce campus.',
        type: 'text', placeholder: 'Cité des Adorateurs',
      },
      {
        key: 'adresse_eglise',
        label: 'Adresse',
        description: 'Adresse de ce campus.',
        type: 'text', placeholder: '12 rue de l\'Exemple, Paris',
      },
      {
        key: 'telephone_eglise',
        label: 'Téléphone',
        description: 'Numéro de contact de ce campus. Utilisé pour la variable [Telephone_Eglise] dans les messages.',
        type: 'text', placeholder: '+33 1 23 45 67 89',
      },
    ],
  },
  {
    label: 'Templates Messages',
    icon:  <MessageSquare size={16} />,
    settings: [
      {
        key: 'message_bienvenue',
        label: 'Message de bienvenue',
        description: 'Envoyé automatiquement J+3 après l\'inscription. Variables : [Prenom], [Referent], [Telephone_Referent], [Telephone_Eglise], [Campus], [Date].',
        type: 'textarea',
        placeholder: 'Bonjour [Prenom], bienvenue ! Je suis [Referent], votre référent au [Telephone_Referent].',
      },
      {
        key: 'message_evenement_default',
        label: 'Template événement par défaut',
        description: 'Pré-rempli lors de la création d\'un événement pour ce campus. Variables : {prenom}, {titre_evenement}, {date_evenement}.',
        type: 'textarea',
        placeholder: 'Bonjour {prenom}, nous vous invitons à notre événement "{titre_evenement}" le {date_evenement}.',
      },
    ],
  },
  {
    label: 'Messages d\'anniversaire',
    icon:  <Calendar size={16} />,
    settings: [
      {
        key: 'template_anniversaire',
        label: 'Message d\'anniversaire',
        description: 'Envoyé automatiquement chaque année le jour de l\'anniversaire à 9h00. Variable disponible : [Prenom].',
        type: 'textarea',
        placeholder: 'Joyeux anniversaire [Prenom] ! 🎂 Toute l\'équipe Phila vous souhaite une excellente journée. Que Dieu vous bénisse abondamment.',
      },
    ],
  },
  {
    label: 'Message Nouvel An',
    icon:  <PartyPopper size={16} />,
    settings: [
      {
        key:         'template_nouvel_an',
        label:       'Message du Nouvel An',
        description: 'Envoyé automatiquement le 1er janvier à 9h00 à tous les contacts et ouvriers actifs de ce campus. Variable disponible : [Prenom].',
        type:        'textarea' as const,
        placeholder: "Bonne année [Prenom] ! 🎉 Toute l'équipe de Phila Cité des Adorateurs vous souhaite une excellente année...",
      },
    ],
  },
  {
    label: 'Template Événement',
    icon:  <Calendar size={16} />,
    settings: [
      {
        key:         'template_evenement',
        label:       'Message d\'invitation à un événement',
        description: 'Envoyé lors de la création d\'un événement pour ce campus. Variables : [Prenom], [Date], [Theme], [Adresse], [Telephone_Eglise].',
        type:        'textarea' as const,
        placeholder: 'Bonjour [Prenom] ! 🙏 Nous vous invitons à notre événement "[Theme]" le [Date].\n\n📍 [Adresse]\n📞 [Telephone_Eglise]',
      },
    ],
  },
  {
    label: 'Certificat d\'intégration',
    icon:  <GraduationCap size={16} />,
    settings: [
      {
        key:         'certificat_verset',
        label:       'Verset biblique',
        description: 'Ce verset apparaît sur les certificats d\'intégration générés pour les contacts de ce campus.',
        type:        'textarea' as const,
        placeholder: '"Car je connais les projets que j\'ai formés sur vous..." — Jérémie 29:11',
      },
    ],
  },
];

// ─── Sous-composant : un bloc de sections avec son propre état ────────────────

function SettingsBlock({
  sections, values, onChange, computeApercu,
}: {
  sections: { label: string; icon: ReactNode; settings: SettingDef[] }[];
  values:   Record<string, string>;
  onChange: (key: string, value: string) => void;
  computeApercu?: (key: string, raw: string) => string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {sections.map(section => (
        <div key={section.label} style={{
          background:   'var(--bg-card)',
          border:       '1px solid var(--bg-card-border)',
          borderRadius: 12,
          overflow:     'hidden',
        }}>
          <div style={{
            padding:     '14px 20px',
            borderBottom: '1px solid var(--bg-card-border)',
            display:     'flex',
            alignItems:  'center',
            gap:         8,
          }}>
            <span style={{ display: 'flex', alignItems: 'center' }}>{section.icon}</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{section.label}</span>
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {section.settings.map(def => (
              <div key={def.key}>
                <div style={{ marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {def.label}
                  </label>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {def.description}
                  </p>
                </div>

                {def.type === 'textarea' ? (
                  <>
                    <textarea
                      value={values[def.key] ?? ''}
                      onChange={e => onChange(def.key, e.target.value)}
                      placeholder={def.placeholder}
                      rows={4}
                      style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                    />
                    {values[def.key] && computeApercu && (
                      <div style={{
                        marginTop:    8,
                        padding:      '10px 12px',
                        background:   'var(--bg-secondary)',
                        borderRadius: 6,
                        fontSize:     12,
                        color:        def.key === 'certificat_verset' ? '#D4A24E' : 'var(--text-secondary)',
                        fontFamily:   def.key === 'certificat_verset' ? 'Georgia, serif' : 'monospace',
                        fontStyle:    def.key === 'certificat_verset' ? 'italic' : 'normal',
                        lineHeight:   1.6,
                        borderLeft:   `3px solid ${def.key === 'certificat_verset' ? '#D4A24E' : 'var(--accent-teal)'}`,
                        whiteSpace:   'pre-wrap',
                        textAlign:    def.key === 'certificat_verset' ? 'center' : 'left',
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, color: 'var(--text-tertiary)', fontFamily: 'inherit', fontStyle: 'normal' }}>Aperçu</div>
                        {def.key === 'certificat_verset' ? values[def.key] : computeApercu(def.key, values[def.key] || '')}
                      </div>
                    )}
                  </>
                ) : (
                  <input
                    type={def.type}
                    min={def.min}
                    max={def.max}
                    value={values[def.key] ?? ''}
                    onChange={e => onChange(def.key, e.target.value)}
                    placeholder={def.placeholder}
                    style={{ ...inputStyle, maxWidth: def.type === 'number' ? 120 : '100%' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Composant principal ───────────────────────────────────────────────────────

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Guard : admin_campus minimum - redirection immédiate sinon
  if (user && ROLE_RANK[user.role] < ROLE_RANK['admin_campus']) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const isSuperAdmin = user?.role === 'super_admin';
  const availableCampus: Campus[] = isSuperAdmin
    ? CAMPUS_OPTIONS.map(o => o.value)
    : (user?.campus ?? []);

  const [activeCampus, setActiveCampus] = useState<Campus | null>(availableCampus[0] ?? null);

  // ── Bloc global (seuils) — super_admin uniquement ──────────────────────────
  const [globalValues, setGlobalValues] = useState<Record<string, string>>({});
  const [globalSaved,  setGlobalSaved]  = useState<Record<string, string>>({});
  const [globalLoading, setGlobalLoading] = useState(isSuperAdmin);
  const [globalSaving,  setGlobalSaving]  = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;
    settingsEndpoints.getGlobal().then(res => {
      setGlobalValues(res.data);
      setGlobalSaved(res.data);
    }).finally(() => setGlobalLoading(false));
  }, [isSuperAdmin]);

  const globalDirty = JSON.stringify(globalValues) !== JSON.stringify(globalSaved);

  async function handleSaveGlobal() {
    setGlobalSaving(true);
    try {
      const entries = Object.entries(globalValues).map(([key, value]) => ({ key, value }));
      const res = await settingsEndpoints.updateGlobal(entries);
      setGlobalSaved(res.data);
      setGlobalValues(res.data);
      showToast('Seuils sauvegardés');
    } catch {
      showToast('Erreur lors de la sauvegarde');
    } finally { setGlobalSaving(false); }
  }

  // ── Bloc par campus — rechargé à chaque changement d'onglet ────────────────
  const [campusValues, setCampusValues] = useState<Record<string, string>>({});
  const [campusSaved,  setCampusSaved]  = useState<Record<string, string>>({});
  const [campusLoading, setCampusLoading] = useState(true);
  const [campusSaving,  setCampusSaving]  = useState(false);

  useEffect(() => {
    if (!activeCampus) return;
    setCampusLoading(true);
    settingsEndpoints.getCampus(activeCampus).then(res => {
      setCampusValues(res.data);
      setCampusSaved(res.data);
    }).finally(() => setCampusLoading(false));
  }, [activeCampus]);

  const campusDirty = JSON.stringify(campusValues) !== JSON.stringify(campusSaved);

  async function handleSaveCampus() {
    if (!activeCampus) return;
    setCampusSaving(true);
    try {
      const entries = Object.entries(campusValues).map(([key, value]) => ({ key, value }));
      const res = await settingsEndpoints.updateCampus(activeCampus, entries);
      setCampusSaved(res.data);
      setCampusValues(res.data);
      showToast(`Paramètres ${CAMPUS_LABELS[activeCampus]} sauvegardés`);
    } catch {
      showToast('Erreur lors de la sauvegarde');
    } finally { setCampusSaving(false); }
  }

  function computeApercu(key: string, raw: string): string {
    const adresse = campusValues['adresse_eglise']  || '8 rue Saint-Claude, 77340 Pontault-Combault';
    const tel     = campusValues['telephone_eglise'] || '+33 1 23 45 67 89';
    const base = raw
      .replace(/\[Pr[eé]nom\]/gi,          'Marie')
      .replace(/\[Date\]/gi,               '29 juin 2026')
      .replace(/\[Campus\]/gi,             activeCampus ? CAMPUS_LABELS[activeCampus] : 'Paris')
      .replace(/\[Telephone_Eglise\]/gi,   tel)
      .replace(/\[Telephone_Referent\]/gi, '+33 6 12 34 56 78')
      .replace(/\[Referent\]/gi,           'Jean Dupont');
    if (key === 'template_evenement') {
      return base
        .replace(/\[Theme\]/gi,   'La grâce de Dieu')
        .replace(/\[Adresse\]/gi, adresse);
    }
    return base;
  }

  const [toast, setToast] = useState<string | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  if (globalLoading || campusLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
        Chargement…
      </div>
    );
  }

  return (
    <div style={{ padding: 'clamp(16px, 4vw, 28px) clamp(12px, 3vw, 32px)', maxWidth: 780 }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Paramètres</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
          {isSuperAdmin ? 'Configuration système et par campus.' : 'Configuration de votre/vos campus.'}
        </p>
      </div>

      {/* Onglets campus */}
      {availableCampus.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {availableCampus.map(c => (
            <button
              key={c}
              onClick={() => setActiveCampus(c)}
              style={{
                padding: '8px 16px', borderRadius: 8,
                border: `1px solid ${activeCampus === c ? 'var(--accent-teal)' : 'var(--bg-card-border)'}`,
                background: activeCampus === c ? 'var(--accent-teal-light)' : 'var(--bg-card)',
                color: activeCampus === c ? 'var(--accent-teal)' : 'var(--text-primary)',
                fontWeight: activeCampus === c ? 700 : 500,
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {CAMPUS_LABELS[c]}
            </button>
          ))}
        </div>
      )}

      {/* Bloc par campus */}
      {activeCampus && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button
              onClick={handleSaveCampus}
              disabled={!campusDirty || campusSaving}
              style={{
                padding: '9px 22px',
                background:  campusDirty ? 'var(--accent-teal)' : 'var(--bg-secondary)',
                color:       campusDirty ? '#fff' : 'var(--text-tertiary)',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: campusDirty ? 'pointer' : 'default', fontFamily: 'inherit', transition: '120ms ease',
              }}
            >
              {campusSaving ? 'Enregistrement…' : `Sauvegarder — ${CAMPUS_LABELS[activeCampus]}`}
            </button>
          </div>
          <SettingsBlock
            sections={CAMPUS_SECTIONS}
            values={campusValues}
            onChange={(key, value) => setCampusValues(prev => ({ ...prev, [key]: value }))}
            computeApercu={computeApercu}
          />
        </>
      )}

      {/* Bloc global — super_admin uniquement */}
      {isSuperAdmin && (
        <div style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button
              onClick={handleSaveGlobal}
              disabled={!globalDirty || globalSaving}
              style={{
                padding: '9px 22px',
                background:  globalDirty ? 'var(--accent-teal)' : 'var(--bg-secondary)',
                color:       globalDirty ? '#fff' : 'var(--text-tertiary)',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: globalDirty ? 'pointer' : 'default', fontFamily: 'inherit', transition: '120ms ease',
              }}
            >
              {globalSaving ? 'Enregistrement…' : 'Sauvegarder les seuils'}
            </button>
          </div>
          <SettingsBlock
            sections={GLOBAL_SECTIONS}
            values={globalValues}
            onChange={(key, value) => setGlobalValues(prev => ({ ...prev, [key]: value }))}
          />
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)',
          borderRadius: 10, padding: '12px 20px', fontSize: 13, fontWeight: 600,
          color: 'var(--text-primary)', boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          zIndex: 600, maxWidth: 'calc(100vw - 32px)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── Style ────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding:      '9px 12px',
  border:       '1px solid var(--bg-card-border)',
  borderRadius: 8,
  background:   'var(--bg-primary)',
  color:        'var(--text-primary)',
  fontSize:     13,
  outline:      'none',
  width:        '100%',
  boxSizing:    'border-box',
};
```

- [ ] **Étape 2 : Vérifier**

Run : `npm run build` (depuis `frontend/`)
Expected: build réussi.

- [ ] **Étape 3 : Commit (inclut Task E1)**

```bash
git add frontend/src/services/endpoints.ts frontend/src/features/admin/Settings.tsx
git commit -m "feat(campus-settings): Settings.tsx - onglets par campus, acces admin_campus

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task E3 : `Sidebar.tsx` — visibilité du lien Paramètres

**Fichiers:**
- Modify: `frontend/src/layout/Sidebar.tsx:66`

- [ ] **Étape 1 : Abaisser le minRole**

Remplacer :

```ts
      { to: '/parametres',         label: 'Paramètres',   icon: <Settings2 size={18} />,   minRole: 'super_admin' },
```

Par :

```ts
      { to: '/parametres',         label: 'Paramètres',   icon: <Settings2 size={18} />,   minRole: 'admin_campus' },
```

- [ ] **Étape 2 : Vérifier**

Run : `npm run build` (depuis `frontend/`)
Expected: build réussi.

- [ ] **Étape 3 : Commit**

```bash
git add frontend/src/layout/Sidebar.tsx
git commit -m "feat(campus-settings): lien Parametres visible pour admin_campus

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Vérification finale

- [ ] **Étape 1 : Suite complète backend**

Run (depuis `backend/`) : `npm run typecheck && npm test`
Expected: aucune erreur TypeScript, tous les tests Jest verts (existants + nouveaux).

- [ ] **Étape 2 : Build complet frontend**

Run (depuis `frontend/`) : `npm run build`
Expected: build réussi, aucune erreur TypeScript.

- [ ] **Étape 3 : Suite e2e**

Run (depuis `frontend/`, backend + frontend de dev démarrés) : `npm run test:e2e`
Expected: tous les tests verts, y compris le nouveau cas de validation campus (Task C4).

- [ ] **Étape 4 : Migration des données**

Vérifier que Task D4 (`npm run migrate-campus-settings`) a bien été exécutée sur la base de développement avant tout test manuel de l'écran Paramètres — sans elle, `CampusSettings` est vide et tous les champs affichent les valeurs de repli (`DEFAULT_CAMPUS_SETTINGS`), pas les valeurs historiques.

- [ ] **Étape 5 : Vérification manuelle rapide**

- Se connecter en `super_admin` → `/parametres` → onglets Paris/Paris Nord/Orléans/Montpellier visibles, seuils visibles en bas.
- Se connecter en `admin_campus` (campus limité) → `/parametres` → seuls ses campus assignés apparaissent en onglet, pas de section seuils.
- Modifier un template sur Orléans, vérifier que Paris n'est pas affecté (rechargement de l'onglet Paris → valeur inchangée).
- Ouvrir `/form/presentiel`, `/form/en-ligne`, `/form/ouvrier` → chacun propose les 4 campus.

---

## Notes pour l'exécution

- **Ordre strict entre parties** : A → B → C → D → E. Task A1 (extension enum) doit être fait avant tout le reste ; les tâches de la Partie D (D3+) dépendent de D1 (modèle `CampusSettings`).
- **Intérieur d'une partie** : les tâches sont indépendantes entre elles (peuvent être distribuées à des agents en parallèle), à l'exception de D1→D2→D3→(D4 et D5 en parallèle)→D6→(D7, D8, D9 en parallèle), et E1→E2→E3.
- **Migration production** : Task D4 crée le script mais ne l'exécute qu'en local. Avant mise en production, exécuter manuellement `npm run migrate-campus-settings` contre `DATABASE_URL` de Neon.tech, après le `prisma db push` de production et avant d'annoncer la fonctionnalité aux admins de campus.

