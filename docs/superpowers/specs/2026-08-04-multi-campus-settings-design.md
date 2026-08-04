# Ajout des campus Montpellier / Orléans + paramètres de messagerie par campus — Design

**Date :** 2026-08-04
**Statut :** Approuvé par l'utilisateur, prêt pour plan d'implémentation.

## Objectif

1. Ajouter Montpellier et Orléans comme campus de suivi (au même titre que Paris et Paris Nord aujourd'hui).
2. Scoper les paramètres de messagerie (templates WhatsApp, infos église, verset certificat) **par campus**, pour qu'un admin de campus puisse les modifier sans impacter les autres campus. Le numéro Twilio (`TWILIO_WHATSAPP_FROM`) reste unique et partagé entre tous les campus — c'est déjà l'architecture actuelle, aucun changement requis sur ce point.

## Contexte découvert dans le code

- L'enum `Extension` (campus Phila d'origine du membre, distinct du campus de suivi) contenait déjà `orleans` et `montpellier` — seul l'enum `Campus` (campus de suivi, celui qui pilote les permissions RBAC et le ciblage des envois) est resté limité à `paris` / `paris_nord`, avec un commentaire explicite anticipant cette extension.
- Le RBAC par campus existe déjà : `User.campus: Campus[]`, rôle `admin_campus`, et `filtreContactsParRole()` / `requireCampusAccess()` filtrent déjà les contacts par campus.
- Ce qui n'existe pas : l'équivalent pour les paramètres de messagerie. La table `Settings` est une table clé-valeur 100% globale, routes verrouillées `super_admin` uniquement (`backend/src/routes/settings.routes.ts`).

## Volet A — Nouveaux campus (Paris est la "maison mère", les autres sont des "extensions")

Changements mécaniques, un enum de suivi à étendre à plusieurs endroits redondants :

| Fichier | Aujourd'hui | Changement |
|---|---|---|
| `backend/prisma/schema.prisma` → `enum Campus` | `paris`, `paris_nord` | + `orleans`, `montpellier` (migration Prisma) |
| `backend/prisma/schema.prisma` → `enum DestinataireEvenement` | `campus_paris`, `campus_paris_nord` | + `campus_orleans`, `campus_montpellier` |
| `backend/src/schemas/auth.schema.ts` → `VALID_CAMPUS` (Zod) | `['paris','paris_nord']` | + les 2 nouvelles valeurs — sinon impossible de créer un `admin_campus` sur les nouveaux campus |
| `backend/src/middlewares/roles.middleware.ts` → `requireCampusAccess()` | paramètre typé `'paris' \| 'paris_nord'` | Généralisé au type `Campus` (import Prisma) |
| `backend/src/controllers/stats.controller.ts` → `tauxConversion` | fallback `['paris','paris_nord']` hardcodé (ligne ~197) | Dérivé de l'enum Prisma `Campus` (`Object.values`) plutôt qu'une liste en dur |
| `backend/src/controllers/messages.controller.ts` → `buildDestinataireWhere` | 2 `case` campus (lignes 67-68) | + `case 'campus_orleans'` / `case 'campus_montpellier'` |
| `frontend/src/utils/constants.ts` → `CAMPUS_LABELS` | 2 entrées | + `orleans: 'Orléans'`, `montpellier: 'Montpellier'` — reste la source unique de vérité |
| `frontend/src/types/index.ts` → `DestinataireEvenement` | 2 valeurs campus | + 2 valeurs |
| `frontend/src/features/messages/EventScheduler.tsx` → `DESTINATAIRE_LABELS` | 2 entrées | + 2 entrées |
| `frontend/src/pages/StatistiquesAvancees.tsx`, `frontend/src/features/admin/UserManagement.tsx` (`ALL_CAMPUS` + `CAMPUS_LABELS` local), `frontend/src/features/ouvriers/OuvrierList.tsx` (`CAMPUS_LABELS` local) | redéfinissent chacun leur propre map campus → label en dur | Remplacés par un import de `CAMPUS_LABELS`/`CAMPUS_OPTIONS` depuis `constants.ts` — sinon ces écrans afficheraient `orleans`/`montpellier` en brut au lieu de "Orléans"/"Montpellier" |

**Hors scope Volet A :** création des comptes `admin_campus` pour Montpellier et Orléans — se fait ensuite via "Gestion utilisateurs", existant et déjà multi-campus, aucun dev requis. Pas de données de démo (`seed.ts`/`seed-demo.ts`) pour les nouveaux campus.

### Formulaires publics d'inscription — angle mort découvert et corrigé

En creusant les 3 formulaires publics, l'état actuel est plus inégal que prévu :

| Formulaire | Aujourd'hui |
|---|---|
| `frontend/src/pages/FormOuvrier.tsx` | A déjà un sélecteur de campus (2 `OptionBtn`, Paris/Paris Nord, champ requis) |
| `frontend/src/pages/FormPresentiel.tsx` | **Aucun champ campus** — payload envoie `campus: 'paris'` en dur (ligne 363), corrigé manuellement par un admin après coup |
| `frontend/src/pages/FormEnLigne.tsx` | Même chose — "Pas de champ campus dans le formulaire (assigné par un admin après inscription)" |

Ce défaut silencieux vers `'paris'` était tenable avec 2 campus proches gérés par la même équipe. Avec 4 campus dans des villes différentes et le RBAC `admin_campus` qui filtre déjà les contacts par campus (`filtreContactsParRole`), un inscrit à Orléans resterait invisible pour l'admin d'Orléans tant qu'un super_admin ne le réassigne pas manuellement. Décision validée avec l'utilisateur : les personnes doivent pouvoir choisir elles-mêmes leur campus à l'inscription, sur les 3 formulaires — via un sélecteur manuel (les options QR-code-par-campus avec URL pré-remplie sont écartées : ça impliquerait de réimprimer les QR codes déjà en circulation pour Paris et Paris Nord, pas seulement les 2 nouveaux campus).

Changements :
- `FormPresentiel.tsx` et `FormEnLigne.tsx` : ajout d'un champ "Campus" (4 `OptionBtn`, requis) dans l'étape "Localisation" existante, juste après Ville/Code postal (même endroit dans les deux fichiers). Validation : erreur si non sélectionné, sur le même modèle que la validation `ville` déjà en place. Le payload envoie `campus: form.campus` au lieu de la valeur `'paris'` en dur.
- `FormOuvrier.tsx` : le sélecteur existant passe de 2 à 4 `OptionBtn` (import `CAMPUS_OPTIONS` si possible pour rester aligné avec `constants.ts`, sinon dupliquer les 2 nouvelles options au même format que l'existant). La ligne de récapitulatif `form.campus === 'paris' ? 'Paris' : 'Paris Nord'` (ligne ~628) est remplacée par un lookup dans `CAMPUS_LABELS` pour couvrir les 4 valeurs.
- `frontend/e2e/formulaire.spec.ts` : les tests existants s'arrêtent avant la soumission complète du formulaire présentiel/en ligne (ils ne remplissent pas au-delà de l'étape 2) — pas de régression attendue, mais un cas de validation "Campus obligatoire" est ajouté par cohérence avec le test équivalent déjà présent pour "prénom obligatoire".

## Volet B — Paramètres de messagerie par campus

### Répartition des paramètres

Décidé avec l'utilisateur : seuls les seuils d'alerte restent globaux. Tout le reste (contenu de communication) devient par campus.

**Restent globaux, `super_admin` uniquement** (table `Settings` existante, inchangée) :
- `seuil_sans_referent`, `seuil_relance_contact`, `nb_jours_inactivite`

**Deviennent par campus** (nouvelle table `CampusSettings`) :
- `message_bienvenue`, `template_anniversaire`, `template_nouvel_an`, `template_evenement`, `message_evenement_default`
- `nom_eglise`, `adresse_eglise`, `telephone_eglise`
- `certificat_verset`

### Modèle de données

Nouveau modèle Prisma :

```prisma
model CampusSettings {
  id         String   @id @default(cuid())
  campus     Campus
  key        String
  value      String
  updated_at DateTime @updatedAt

  @@unique([campus, key])
}
```

La table `Settings` existante est conservée telle quelle mais son usage se réduit aux 3 clés de seuils.

### Migration & seed

Migration one-shot qui, pour chacune des 9 clés listées ci-dessus, lit la valeur globale actuelle dans `Settings` et crée une ligne `CampusSettings` pour les 4 campus (`paris`, `paris_nord`, `orleans`, `montpellier`) avec cette même valeur comme point de départ.

Conséquence : à la sortie de la migration, rien ne change en pratique pour Paris et Paris Nord (mêmes textes qu'avant) ; Paris Nord dispose désormais de ses propres réglages modifiables indépendamment de Paris (auparavant les deux partageaient les mêmes valeurs globales sans le savoir) ; Orléans et Montpellier démarrent avec une copie des valeurs de Paris ("maison mère"), à adapter par leur admin (nom_eglise/adresse en priorité).

Après la migration, les anciennes lignes `Settings` pour ces 9 clés ne sont plus lues côté backend (voir ci-dessous) ; la migration les supprime de `Settings` une fois copiées vers `CampusSettings`, pour éviter toute confusion future (deux sources de vérité qui divergent silencieusement).

### API & permissions

Routes `backend/src/routes/settings.routes.ts` réorganisées :

- `GET /api/settings/global`, `PUT /api/settings/global` — les 3 seuils, `requireRole('super_admin')` (comportement identique à aujourd'hui, périmètre réduit).
- `GET /api/settings/campus/:campus`, `PUT /api/settings/campus/:campus` — les 9 clés du campus demandé. Accès : `super_admin` (tous campus) ou `admin_campus` **si et seulement si** `:campus` ∈ `req.user.campus[]`, via `requireCampusAccess(:campus)` (middleware déjà existant, juste généralisé en Volet A). Le `PUT` fait un upsert scopé au campus de l'URL uniquement — structurellement impossible d'impacter un autre campus au niveau de la requête elle-même.

`backend/src/controllers/settings.controller.ts` : `getSettings`/`updateSettings` actuels renommés/scindés en 4 handlers (`getGlobalSettings`, `updateGlobalSettings`, `getCampusSettings`, `updateCampusSettings`), même logique d'upsert transactionnel par lot que l'existant.

### Logique d'envoi de messages — changement fonctionnel réel

Aujourd'hui, `backend/src/lib/cron.ts` charge le template et les infos église **une fois pour tout le lot de contacts**, tous campus confondus (ex. lignes 56-63 pour la tâche bienvenue J+3), puis applique la même valeur à tout le monde. Ça doit devenir : grouper les contacts par `campus`, charger les réglages de chaque campus rencontré une seule fois (`Map<Campus, {template, tel, adresse}>`), puis appliquer le bon jeu de valeurs par groupe. Fallback sur les constantes par défaut existantes (`DEFAULT_BIENVENUE_TEMPLATE`, etc.) si une ligne `CampusSettings` manque pour une clé/campus donné — même pattern qu'aujourd'hui.

Fichiers concernés :
- `backend/src/lib/cron.ts` — tâche bienvenue J+3, tâche anniversaire, tâche vœux Nouvel An, tâche envoi événements planifiés (adresse église)
- `backend/src/controllers/messages.controller.ts` — envoi manuel de bienvenue, envoi immédiat d'événement (`envoyer_maintenant`)
- `backend/src/controllers/contacts.controller.ts:1081` — génération certificat PDF : le verset est déjà cherché juste après avoir chargé `contact`, qui a un `campus` disponible → lookup `CampusSettings` scopé à `contact.campus` au lieu du `Settings` global

Note : `template_evenement` et `message_evenement_default` ne sont lus nulle part côté backend au moment de l'envoi réel aujourd'hui (vérifié) — ils ne servent qu'à pré-remplir le formulaire de composition d'événement côté frontend. Pour ces deux clés, "par campus" signifie donc uniquement : chaque admin voit et édite son propre texte suggéré, sans logique cron à modifier.

### Frontend — `frontend/src/features/admin/Settings.tsx`

Aujourd'hui verrouillée `super_admin` avec redirection immédiate (`navigate('/dashboard')`) pour tout autre rôle. Changements :

- Accessible aussi à `admin_campus`.
- Un sélecteur de campus (onglets) en haut de page : pour `super_admin`, les 4 campus ; pour `admin_campus`, uniquement ceux de `user.campus[]` (avec sélection automatique du premier si un seul campus assigné).
- Section "Seuils & Alertes" : visible uniquement pour `super_admin` (appelle `/api/settings/global`).
- Les 6 autres sections (Infos Église, Templates Messages, Anniversaire, Nouvel An, Événement, Certificat) : scopées au campus actif dans l'onglet sélectionné (`/api/settings/campus/:campus`), rechargées au changement d'onglet. Le bouton "Sauvegarder" n'écrit que sur le campus actif.
- `Sidebar.tsx` : le lien "Paramètres" devient visible pour `admin_campus` en plus de `super_admin`.

## Tests à mettre à jour

- `backend/src/__tests__/authorization.test.ts` — cas `admin_campus` avec `campus: ['paris', 'paris_nord']` déjà présent ; ajouter un cas couvrant l'accès refusé à un campus hors de la liste de l'utilisateur, et la nouvelle route `settings/campus/:campus`.
- Nouveaux tests pour `getCampusSettings`/`updateCampusSettings` : isolation entre campus (modifier Orléans ne doit rien changer à Paris), refus `admin_campus` sur un campus non assigné, autorisation `super_admin` sur tous.
- Test de la migration/seed : les 4 campus ont bien une valeur pour chacune des 9 clés après migration.
- Test cron : un lot de contacts multi-campus reçoit chacun le template de son propre campus (pas de fuite entre campus).

## Addendum — balayage complet des occurrences codées en dur "2 campus" (ajouté après relecture)

Un balayage plus large que celui fait pendant le brainstorming a révélé que le motif binaire `campus === 'paris' ? 'Paris' : 'Paris Nord'` (ou équivalent) existe dans beaucoup plus d'endroits que les 5 fichiers initialement listés en Volet A. Avec 4 campus, ce motif binaire n'est pas juste incomplet, il est **incorrect** : un contact d'Orléans ou de Montpellier s'y afficherait étiqueté "Paris Nord". Décidé avec l'utilisateur : tout est corrigé dans ce même chantier plutôt que reporté.

Fichiers additionnels concernés (au-delà de ceux déjà listés en Volet A) :

- `backend/src/middlewares/auth.middleware.ts` — `CampusValue = 'paris' | 'paris_nord'`, le type source du JWT (`req.user.campus`), à généraliser.
- `backend/src/controllers/import.controller.ts` — `mapCampus()`, normalisation Excel/CSV, ne reconnaît que "paris"/variantes "nord".
- `frontend/src/pages/Dashboard.tsx` — cas le plus lourd : les KPI par campus sont des variables nommées en dur (`paris`, `parisNord`, `parisIntegre`, `parisMembrePhila`, `parisNordIntegre`, `parisNordMembrePhila`), utilisées à la fois dans les cartes KPI à l'écran et le tableau du rapport PDF (`autoTable`). Restructuré en une structure indexée par campus (ex. `Record<Campus, {total, integre, membrePhila}>`) plutôt que 6 variables figées.
- `frontend/src/features/planning/PlanningTable.tsx`, `PlanningDetail.tsx`, `MesPlannings.tsx` — ternaires d'affichage + `<option>` de filtre.
- `frontend/src/features/messages/MessageCompose.tsx`, `MessageHistory.tsx` — `<option>` de filtre/ciblage par campus.
- `frontend/src/features/referents/ReferentList.tsx` — ternaire d'affichage des campus d'un référent.
- `frontend/src/features/contacts/ContactList.tsx`, `ContactForm.tsx`, `ContactDetail.tsx` — `<option>` de filtre/formulaire.
- `frontend/src/features/ouvriers/OuvrierForm.tsx` et `OuvrierList.tsx` — formulaire de création/édition et liste : `<option>` figées à 2 valeurs, cast TypeScript `campus as 'paris' | 'paris_nord'`, et pour `OuvrierList.tsx` spécifiquement les cartes KPI (`campusParis`, `campusNord`) qui doivent devenir dynamiques sur les 4 campus — demande explicite de l'utilisateur pour avoir un total et un filtre par campus sur l'écran Ouvriers.

Principe de correction commun : partout où c'est possible, remplacer le ternaire/switch en dur par un lookup dans `CAMPUS_LABELS`/`CAMPUS_OPTIONS` (source unique définie dans `frontend/src/utils/constants.ts`), plutôt que redéfinir localement à chaque fois — c'est ce qui a permis de repérer tous ces cas en cherchant les définitions locales dupliquées.

## Hors scope

- Création des comptes admin Montpellier/Orléans (fait manuellement ensuite).
- Toute évolution du numéro Twilio expéditeur (reste unique et global, déjà le cas).
- Données de démo pour les nouveaux campus.
