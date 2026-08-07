# Backlog — reste à faire

Dernière mise à jour : 7 août 2026, après correctif de sécurité périmètre campus (3 passes de revue).

Chaque point indique où intervenir. Les priorités vont de P0 (bloquant) à P5 (confort).

---

## 🔴 P0 — Bloquant, production dégradée

### Déployer en production (accès au remote `eglise`)

**État : bloqué côté humain.**

Le chantier multi-campus est fusionné dans `main` et poussé vers `origin`, mais `origin` ne déclenche aucun déploiement. Le remote qui déploie est `eglise` (`philaintegrationca/phila-integration`), et il est actuellement inaccessible :

```
remote: Repository not found.
```

**Pourquoi c'est urgent :** la migration `migrate-campus-settings` a déjà été exécutée sur la base partagée le 6 août. Elle a supprimé de la table `Settings` les 9 clés de messagerie, après les avoir copiées dans `CampusSettings`. Le code actuellement déployé ne connaît pas `CampusSettings` et lit encore `Settings`. Résultat, en production, en ce moment :

- les messages WhatsApp automatiques (bienvenue, anniversaire, Nouvel An, événements) partent avec **adresse et téléphone de l'église vides** ;
- les certificats d'intégration utilisent un **verset tronqué** au lieu du verset configuré.

**À faire :** rétablir l'accès au dépôt de l'église (droits ou authentification git), puis pousser `main` vers `eglise`. Vérifier ensuite les messages partis depuis le 6 août.

---

## ✅ Corrigé le 7 août 2026 — Périmètre campus sur les envois et les événements

Un `admin_campus` limité à un campus pouvait agir **en dehors de son périmètre** : envoyer un WhatsApp à tous les campus (`filtres: {}` / `dest_type: 'tous'`), déclencher le message de bienvenue de n'importe quel contact, lire n'importe quel message. Faille pré-existante (antérieure au chantier multi-campus), corrigée en 3 passes après revue à chaque étape (commits `2b28400`, `a3a32eb`, `0ad2615`) :

- `backend/src/lib/authorization.ts` — helpers partagés `horsPerimetreCampus` / `resoudreCampusCible`, utilisés par `evenements.controller.ts`, `messages.controller.ts` et `ouvriers.controller.ts`.
- Le campus de l'événement borne désormais la requête destinataires **au point d'envoi** (`envoyerEvenement` + `cron.ts`), pas seulement à la création — protège aussi les lignes déjà en base.
- `updateEvenement` : liste blanche des champs modifiables (`filtres_json`/`destinataires`/`statut` n'étaient pas censés être réécrivables après coup).
- `getMessage`, `getMessagesByContact` : ajout de `peutAccederContact` (fuite de PII inter-campus, trouvée en cours de revue).
- `cron.ts` Tâche 2 : un événement multi-campus (`campus: null`) n'est envoyé que si le créateur est **encore** super_admin au moment de l'envoi.
- 123 tests, plusieurs vérifiés empiriquement comme échouant sur le code d'avant.

**Suivi mineur, non sécuritaire (échoue de façon sûre — voir P3 ci-dessous) :** un super_admin qui repasse un événement d'un autre utilisateur en multi-campus (`campus: null`) puis le planifie peut se le voir annulé silencieusement par le cron, qui vérifie le rôle du *créateur* d'origine, pas celui de la personne qui a autorisé le passage en multi-campus.

## ✅ Corrigé le 7 août 2026 — « Identifiants invalides » alors que le serveur est injoignable

`frontend/src/pages/Login.tsx` distingue désormais explicitement une erreur réseau (`err.response === undefined`, backend injoignable → « Impossible de contacter le serveur ») d'un vrai refus d'authentification. Repéré deux fois pendant cette session : le backend local n'était simplement pas démarré, mais le message laissait croire à un mauvais mot de passe.

## 🔴 P1 — Sécurité

### Vérifier la signature des webhooks Twilio

`twilioWebhook` dans `messages.controller.ts` met à jour le statut de livraison des messages. La validation de signature Twilio n'a pas été vérifiée. Sans elle, n'importe qui peut falsifier des statuts de livraison.

**À faire :** auditer, et implémenter la validation si absente.

---

## 🟠 P2 — Fonctionnalités cassées silencieusement

### Les envois planifiés n'atteignent jamais les ouvriers

Le modèle `Evenement` ne persiste ni `dest_type` ni `filtres_ouvriers` — ces valeurs n'existent qu'en mémoire, le temps de la requête HTTP. Un événement créé avec `dest_type: 'ouvriers'` ou `'tous'` **et** une date de planification est ensuite repris par le cron (Tâche 2, `backend/src/lib/cron.ts`), qui ne requête que `prisma.contact`. Les ouvriers ne reçoivent rien, sans aucune erreur.

**À faire :** ajouter `dest_type` et `filtres_ouvriers` au modèle Prisma, les enregistrer à la création, et gérer l'audience ouvriers dans la Tâche 2 du cron.

### Trois clés de paramètres configurables mais jamais utilisées

`template_evenement`, `message_evenement_default` et `nom_eglise` figurent dans `CAMPUS_SETTINGS_KEYS` et sont éditables dans l'écran Paramètres, mais **aucun code d'envoi ne les lit**. L'interface laisse croire qu'elles ont un effet.

**À faire :** soit les brancher réellement, soit les retirer de l'écran. Ne pas laisser en l'état.

---

## 🟡 P3 — Bugs d'expérience utilisateur

### Paramètres — trois points

`frontend/src/features/admin/Settings.tsx` :

1. `window.confirm()` natif pour la confirmation de changement d'onglet, alors que le projet a un composant `Modal` et un motif de modale personnalisée (voir `OuvrierList.tsx`). Incohérent avec le reste de l'interface.
2. Aucune garde si l'utilisateur **quitte la page** avec des modifications non enregistrées (seul le changement d'onglet campus est protégé).
3. Changement d'onglet rapide : pas d'annulation de la requête précédente, une réponse tardive peut écraser les données de l'onglet courant.

### Événement multi-campus silencieusement repassé en brouillon

`backend/src/lib/cron.ts`, Tâche 2 — le garde-fou qui vérifie le rôle du créateur avant un envoi multi-campus (voir la faille de périmètre corrigée ci-dessus) regarde `evenement.created_by`, pas la personne qui a le plus récemment autorisé le ciblage multi-campus. Scénario : un `admin_campus` crée un événement sur son campus ; un super_admin l'édite ensuite pour le passer en multi-campus (`campus: null`) et le planifie — parfaitement légitime. Au moment de l'envoi, le cron regarde le rôle du créateur d'origine (`admin_campus`), pas celui du super_admin qui a autorisé le passage en multi-campus, et annule silencieusement l'envoi (repasse en `brouillon`, log une erreur).

Pas une faille de sécurité — l'échec est toujours du côté sûr (rien ne part), juste une perte de fonctionnalité silencieuse pour un usage légitime.

**À faire :** soit tracer qui a autorisé le ciblage multi-campus (ex. transférer `created_by` au super_admin qui fait le changement), soit notifier plutôt que logger silencieusement.

---

## ⚪ P4 — Dette technique

### Listes de campus dupliquées côté backend

Trois définitions indépendantes de la même liste `['paris', 'paris_nord', 'orleans', 'montpellier']` :

- `backend/src/schemas/auth.schema.ts` → `VALID_CAMPUS`
- `backend/src/schemas/contacts.schema.ts` → `CAMPUS_VALUES`
- `backend/src/controllers/ouvriers.controller.ts` → `CAMPUS_VALIDES`

Le frontend, lui, centralise correctement (`CAMPUS_LABELS` / `CAMPUS_OPTIONS`, avec exhaustivité vérifiée par le compilateur). Ajouter un 5ᵉ campus demande aujourd'hui de retrouver ces trois emplacements à la main, sans aide du compilateur.

**À faire :** une seule constante partagée, idéalement dérivée de `Object.values(Campus)` du client Prisma (motif déjà utilisé dans `stats.controller.ts` et `settings.controller.ts`).

### Commentaires obsolètes

- `messages.controller.ts` — le commentaire justifiant le ré-export de `DEFAULT_BIENVENUE_TEMPLATE` (« pour ne pas casser cron.ts ») est faux : `cron.ts` ne l'importe plus. Ré-export mort.
- `messages.controller.ts:17` et `frontend/src/services/endpoints.ts:49` — annotations `// 'paris' | 'paris_nord'` non mises à jour pour les 4 campus.
- `import.controller.ts` — dans `mapCampus`, le test `nord` a été déplacé avant `paris` sans commentaire ; inoffensif mais déroutant à la relecture.

### Qualité de code non contrôlée

- `npm run lint` remonte **61 erreurs** sur le projet (majoritairement `react-hooks/set-state-in-effect`), jamais traitées.
- **Aucun workflow CI** (pas de dossier `.github`). Ni les tests ni le lint ne tournent automatiquement — le lint aurait détecté une violation réelle des Rules of Hooks passée entre les mailles lors du chantier multi-campus.

**À faire :** ajouter une CI (tests + typecheck + lint), puis résorber progressivement les erreurs existantes.

### Couverture de tests

Quasi inexistante sur deux contrôleurs qui envoient de vrais messages à de vraies personnes :

- `evenements.controller.ts` — seul le correctif `[Adresse]` est couvert ; 7 handlers exportés sans test.
- `messages.controller.ts` — `sendBienvenue`, `listMessages`, `twilioWebhook` non testés.

---

## ⚪ P5 — Organisationnel

### Campus Orléans et Montpellier

L'infrastructure est en place, mais volontairement rien d'autre :

- aucun compte `admin_campus` créé pour ces campus ;
- leurs `CampusSettings` sont une **copie de ceux de Paris** (templates, adresse, téléphone), à personnaliser par leurs responsables quand les campus démarreront.

---

## 🎨 À concevoir

### Glassmorphism

Souhaité. Contrainte technique identifiée : le glassmorphism suppose un `backdrop-filter` sur un arrière-plan **visuellement riche**. Aujourd'hui les fonds sont des aplats unis (`#FFFFFF` en clair, `#091620` en sombre) — flouter un aplat uni ne produit aucun effet visible. Le préalable est donc d'ajouter une couche de fond (dégradé, halos colorés) avant tout blur.

À réserver aux surfaces flottantes (sidebar, modales, toasts, barre supérieure, cartes KPI) : appliquer `backdrop-filter` à chaque ligne d'une longue liste dégrade nettement le scroll sur mobile, et l'application est une PWA très utilisée sur téléphone. Surveiller aussi le contraste — les tests axe (`accessibility.spec.ts`) le détecteraient.

Le thème sombre est déjà à moitié préparé (`--bg-card: rgba(26,86,176,0.08)`, `--bg-card-solid` prévu pour les panneaux flottants) ; le thème clair est entièrement opaque.

### Réorganiser l'écran Paramètres

Trop dense : 6 sections dont **4 ne contiennent qu'un seul champ**, chacune avec son en-tête et sa carte, plus un aperçu permanent sous chaque zone de texte.

Piste proposée, du plus rentable au plus lourd :

1. regrouper 6 → 3 sections (Infos Église / Modèles de messages / Certificat) ;
2. rendre ces sections repliables (accordéon), la première ouverte ;
3. afficher l'aperçu à la demande.

Accordéon plutôt que sous-onglets : le bouton « Sauvegarder » enregistre les 9 clés du campus en une fois, des sous-onglets laisseraient croire qu'il faut sauvegarder onglet par onglet. Les onglets campus, eux, fonctionnent bien et restent.
