# Backlog — reste à faire

Dernière mise à jour : 12 août 2026, après un second passage d'audit de sécurité (routes, middlewares, lib/, dépendances npm) — 4 failles applicatives corrigées supplémentaires, 3 dépendances mises à jour.

Chaque point indique où intervenir. Les priorités vont de P0 (bloquant) à P5 (confort).

---

## ✅ Corrigé le 7 août 2026 — Déploiement en production

`main` (commit `76292cc`) poussé vers `eglise` (`philaintegrationca/phila-integration`), déclenchant Vercel + Railway. L'accès était bloqué par un jeton GitHub fine-grained scopé au mauvais dépôt ; débloqué avec un nouveau jeton — **à révoquer/régénérer**, il a été partagé en clair dans une conversation.

**Reste à vérifier une fois le déploiement terminé :** que les messages WhatsApp automatiques (bienvenue, anniversaire, Nouvel An, événements) et les certificats repartent avec adresse/téléphone/verset corrects — ils étaient dégradés depuis la migration `migrate-campus-settings` du 6 août, exécutée avant que ce déploiement ne mette le code à jour.

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

## ✅ Corrigé le 8 août 2026 — Signature Twilio non vérifiée sur le webhook de statut

`twilioWebhook` (`messages.controller.ts`) mettait à jour le statut de livraison d'un message depuis un POST public, sans aucune vérification — n'importe qui connaissant un `twilio_sid` pouvait falsifier un statut de livraison. `handleIncomingWhatsApp` (`twilio.controller.ts`, messages entrants) avait déjà le bon motif ; appliqué à l'identique ici (`twilio.validateRequest()`, activé uniquement en production). 3 tests ajoutés, vérifiés comme échouant sur le code d'avant.

## ✅ Corrigé le 8 août 2026 — Contournement de périmètre campus sur les stats

Repéré par la revue de sécurité automatique après ouverture de 3 endpoints `/api/stats/*` à `referent_integration` : `inscriptionsParMois`/`profilsStats`/`statutsStats` acceptaient un `?campus=` arbitraire sans vérifier qu'il appartient au périmètre de l'appelant (le filtre par `req.user.campus` n'était appliqué que si aucun campus n'était fourni). Corrigé avec `horsPerimetreCampus`. 3 tests ajoutés, vérifiés comme échouant sur le code d'avant.

---

## ✅ Corrigé le 8 août 2026 — Les envois planifiés n'atteignaient jamais les ouvriers

Le modèle `Evenement` ne persistait ni `dest_type` ni `filtres_ouvriers` — ces valeurs n'existaient qu'en mémoire, le temps de la requête HTTP. Un événement créé avec `dest_type: 'ouvriers'` ou `'tous'` **et** une date de planification (ou renvoyé manuellement plus tard) ne touchait jamais les ouvriers, sans aucune erreur. Corrigé :

- `dest_type` et `filtres_ouvriers` ajoutés au modèle Prisma (`db push`, colonnes nullables, additif — aucune donnée existante affectée) et persistés à la création (`createEvenement`, `messages.controller.ts`), `filtres_ouvriers` déjà borné au périmètre du créateur, même principe que `filtres_json`.
- `envoyerEvenement` (renvoi manuel, `evenements.controller.ts`) et la Tâche 2 du cron (`cron.ts`) gèrent maintenant l'audience ouvriers, avec le même motif que pour les contacts (adresse par campus, non-blocage si un groupe est vide).
- `dest_type`/`filtres_ouvriers` explicitement exclus de la liste blanche de `updateEvenement` (même raison que `filtres_json` : redéfiniraient QUI reçoit après coup).
- Nouveau helper partagé `buildOuvrierWhere` (`messages.controller.ts`), réutilisé par les 3 points d'envoi.
- Le frontend envoyait déjà `dest_type`/`filtres_ouvriers` dans le payload (`MessageCompose.tsx`) — aucun changement nécessaire côté client.
- 9 tests ajoutés (persistance + 3 points d'envoi), vérifiés empiriquement comme échouant sur le code d'avant.

**Découverte en cours de route, non corrigée :** `evenements.controller.ts::createEvenement` (route `POST /api/evenements`) est un second endpoint de création d'événement, plus simple (pas de `dest_type`/immédiat), **jamais appelé par le frontend** — `evenementsEndpoints.create` n'existe même pas côté client, qui utilise uniquement `messagesEndpoints.createEvenement` (`POST /api/messages/evenement`). Code mort, probablement un reliquat d'avant l'ajout du système de filtres avancés. À supprimer (fonction + route) après confirmation qu'aucun appel externe n'en dépend.

---

## ✅ Corrigé le 8 août 2026 — Deux clés de paramètres configurables mais jamais utilisées

`message_evenement_default` et `nom_eglise` figuraient dans `CAMPUS_SETTINGS_KEYS`, éditables dans Paramètres, mais aucun code d'envoi ne les lisait.

- **`nom_eglise`** retiré (même disposition que `template_evenement` le 7 août) : rien ne le lisait nulle part, et le brancher aurait demandé de toucher les 4 points d'envoi de messages pour un gain marginal (le nom de l'église ne varie pas vraiment par campus en pratique).
- **`message_evenement_default`** branché : `MessageCompose.tsx` pré-remplit désormais le template à la sélection du campus (`GET /settings/campus/:campus`), sans jamais écraser un texte déjà saisi. Sa valeur par défaut utilisait `{prenom}`/`{titre_evenement}`/`{date_evenement}` — une syntaxe à accolades qui ne correspond à AUCUNE substitution réelle (les vraies variables sont `[Prénom]`/`[Date]`/`[Campus]`/`[Adresse]`, entre crochets) ; corrigée.

**Trouvé en cours de route et corrigé au passage** (même famille de bug — une variable annoncée disponible mais jamais substituée à l'envoi) :

- `MessageCompose.tsx` proposait `[Thème]`, `[Référent]`, `[Tél. Référent]`, `[Tél. Église]` comme variables insérables pour un événement/actu — aucune n'est substituée par `createEvenement`/`envoyerEvenement`/`cron.ts` (qui ne gèrent que `[Prénom]`, `[Date]`, `[Campus]`, `[Adresse]`) : le texte du placeholder partait tel quel, en clair, dans le message WhatsApp réel. Retirées de la liste.
- L'aperçu live de Paramètres (`Settings.tsx::computeApercu`) substituait `[Telephone_Eglise]`/`[Telephone_Referent]`/`[Referent]` pour **tous** les templates, alors que seul `message_bienvenue` les substitue réellement à l'envoi — l'aperçu affichait donc un résultat trompeur pour anniversaire/nouvel an/événement. Il contenait aussi un `if (key === 'template_evenement')` mort (clé retirée le 7 août), qui empêchait `[Adresse]` de s'afficher correctement dans l'aperçu de `message_evenement_default`. Réécrit avec un jeu de variables explicite par clé.
- `[Campus]` était documenté comme disponible pour `message_bienvenue` mais jamais transmis par les deux appelants réels (`cron.ts` Tâche 1, `sendBienvenue`) — toujours vide en pratique. `buildBienvenueMessage`/`applyVariables` reçoivent maintenant `contact.campus`.
- **Bug Rules of Hooks pré-existant, sans rapport avec ce qui précède, trouvé en isolant l'effet lint de ce correctif** : `MessageCompose.tsx` avait un retour anticipé (`if (!isAdmin) return`) **avant** ses `useEffect` — les hooks n'étaient pas appelés du tout pour un non-admin, ce qui plante React si le rôle change en cours de session. Ce seul bug expliquait la grande majorité des 61 erreurs eslint historiques (cascade de règles react-hooks) : après correction (retour anticipé déplacé juste avant le rendu, après tous les hooks), le total du projet est passé de 61 à 35 erreurs.

15 tests ajoutés/adaptés au total pour ce lot, plusieurs vérifiés empiriquement comme échouant sur le code d'avant.

---

## ✅ Corrigé le 8 août 2026 — P3 : bugs d'expérience utilisateur

### Paramètres — trois points

`frontend/src/features/admin/Settings.tsx` :

1. `window.confirm()` natif remplacé par le composant `Modal` du projet (`components/common/Modal.tsx` — jusque-là jamais importé nulle part). Même comportement (Annuler / Changer quand même), juste cohérent visuellement avec le reste de l'app.
2. Garde ajoutée sur `beforeunload` : fermeture d'onglet, rechargement ou saisie d'une autre adresse avec des modifications non enregistrées (campus ou seuils globaux) déclenche la confirmation native du navigateur. **Limite connue, non couverte** : la navigation interne (clic sur un lien de la sidebar) — le routeur de l'app est un `BrowserRouter` classique, pas un data router, et `useBlocker` n'est disponible qu'avec `createBrowserRouter`/`RouterProvider`. Couvrir ce cas demanderait de migrer le routeur, hors périmètre d'un correctif P3.
3. L'effet de chargement par campus ignore désormais les réponses obsolètes (`let ignore = false` + cleanup, même motif que `MessageCompose.tsx`) : changer rapidement d'onglet ne peut plus faire écraser les valeurs du campus courant par une réponse tardive de l'ancien.

### Événement multi-campus silencieusement repassé en brouillon

`backend/src/lib/cron.ts`, Tâche 2 — le garde-fou continue de se baser sur `evenement.created_by` (le changer aurait faussé l'affichage "créateur" ailleurs dans l'app pour un gain incertain). À la place : l'échec n'est plus silencieux. Le créateur d'origine et tous les `super_admin` actifs reçoivent maintenant une notification (`evenement_envoi_annule`, nouvelle valeur d'enum) expliquant que l'événement a été repassé en brouillon, avec un lien vers `/evenements` pour le re-planifier.

10 tests ajoutés/adaptés pour ce lot (Modal, effets ignore, notifications cron), vérifiés empiriquement comme échouant sur le code d'avant.

---

## ✅ Corrigé le 8 août 2026 — P4 : dette technique

### Listes de campus dupliquées côté backend

`VALID_CAMPUS` (`auth.schema.ts`), `CAMPUS_VALUES` (`contacts.schema.ts`) et `CAMPUS_VALIDES` (`ouvriers.controller.ts`) — trois copies indépendantes de `['paris', 'paris_nord', 'orleans', 'montpellier']` — remplacées : les deux schémas Zod utilisent maintenant `z.enum(Campus)` (Zod 4 accepte directement un enum natif — `z.nativeEnum` est déprécié dans cette version), `ouvriers.controller.ts` utilise `Object.values(Campus)`. Les trois dérivent maintenant de l'enum Prisma — un 5ᵉ campus ajouté dans `schema.prisma` est reconnu partout sans rien dupliquer.

### Commentaires obsolètes

Les 3 corrigés : ré-export mort de `DEFAULT_BIENVENUE_TEMPLATE` supprimé (plus personne ne l'importait depuis `messages.controller.ts`), annotations `// 'paris' | 'paris_nord'` complétées pour les 4 campus (`messages.controller.ts`, `frontend/src/services/endpoints.ts`), commentaire ajouté sur l'ordre des tests dans `mapCampus` (`import.controller.ts`) expliquant qu'il n'a pas d'effet (pas de chevauchement possible entre les deux conditions).

### CI ajoutée (`.github/workflows/ci.yml`)

Deux jobs : **backend** (`prisma generate` + `typecheck` + `test`, zéro secret requis — Prisma/Twilio/node-cron entièrement mockés dans les tests) et **frontend** (`typecheck` + `lint`). Volontairement **pas de e2e Playwright** en CI : l'app partage une seule base Neon entre dev et prod, les lancer sur chaque push toucherait des données réelles.

Le lint frontend reste **informatif** (`continue-on-error`) : les 35 erreurs `react-hooks/set-state-in-effect` préexistantes (une par fichier, setState synchrone en tête d'un `useEffect`) sont laissées en l'état — les faire échouer aurait bloqué tout push sur ce dépôt dès l'ajout de la CI. Prochaine étape naturelle : les résorber fichier par fichier puis retirer `continue-on-error`.

### Couverture de tests

`evenements.controller.ts` : 4 handlers non couverts (`listEvenements`, `getEvenement`, `deleteEvenement`, `planifierEvenement`) ont maintenant des tests (périmètre campus, statuts, validations). `messages.controller.ts` : `sendBienvenue` (périmètre, statut 409/400, succès/échec Twilio) et `listMessages` (scoping par rôle, filtres, pagination) désormais couverts. (`twilioWebhook` l'était déjà depuis le correctif de signature du 8 août — la mention plus haut dans une version antérieure de cette section était obsolète.)

30 tests ajoutés pour ce lot.

---

## ✅ Corrigé le 12 août 2026 — Audit de sécurité complet : 7 failles IDOR/périmètre

Demande explicite d'audit complet. Revue manuelle (pas de sous-agent) de tous les contrôleurs backend pas encore passés au crible par les correctifs de périmètre campus des 7-8 août (`referents`, `import`, `checklist`, `planning`, `affectations`, `auth`). 9 constats au total, 7 corrigés (les 2 restants sont des notes de maintenabilité/rate-limiting, closes elles aussi au passage) :

### Routes fantômes `/api/auth/users*` — contournaient une protection déjà corrigée

`auth.controller.ts` dupliquait `createUser`/`listUsers`/`updateUser`/`deactivateUser` de `users.controller.ts`, montées sur des routes parallèles (`/api/auth/users*` vs `/api/users*`) jamais appelées par le frontend (confirmé par `grep`) mais toujours **live** côté API. Son `updateUser` n'avait **aucune** protection anti-changement-de-son-propre-rôle — exactement la faille corrigée sur `users.controller.ts` plus tôt dans le projet, silencieusement contournable via ce doublon. Plutôt que de synchroniser deux implémentations pour toujours, les 4 fonctions et leurs routes ont été **supprimées** ; `auth.controller.ts` ne garde que `login`/`refresh`/`logout`/`forgot-password`/`reset-password`/`me`. `formRateLimit` ajouté sur `/auth/forgot-password` (jusque-là sans limite de tentatives).

### IDOR / périmètre campus sur 5 contrôleurs

Même famille de faille que le correctif du 7 août (`evenements`/`messages`/`ouvriers`), pas encore appliquée ici : un `admin_campus` pouvait agir sur des ressources hors de ses campus assignés simplement en connaissant leur ID.

- **`referents.controller.ts`** : `assignReferentIntegration`/`removeReferentIntegration`/`assignReferentEglise`/`removeReferentEglise` vérifient maintenant `peutAccederContact`. **`reassignerContacts`** (réassignation en masse, utilisée en production par `ReferentList.tsx`) vérifie en plus que tous les `contact_ids` sont dans le périmètre de l'appelant — c'était le point le plus exposé du lot.
- **`import.controller.ts`** : `importContacts` rejette désormais, ligne par ligne, tout contact dont le `CAMPUS` de la feuille Excel est hors du périmètre de l'auteur de l'import (les autres lignes du fichier sont importées normalement).
- **`checklist.controller.ts`** : `listChecklist`/`updateChecklistItem` vérifient `peutAccederContact`. Le second est le plus sensible : cocher `integration_confirmee` déclenche un changement de statut + notification, jusque-là accessible pour n'importe quel contact d'un autre campus.
- **`planning.controller.ts`** : `getPlanning`/`updatePlanning`/`deletePlanning` vérifient le périmètre. `createPlanning` route désormais le campus visé via `resoudreCampusCible`. `updatePlanning` remplace un `{ ...req.body }` (liste ouverte) par une liste blanche explicite (`nouveaux_membres`/`service_salle`/`preparation_salle`/`priere_lundi`/`date_dimanche`), même motif que `updateEvenement` le 7 août — `campus`/`created_by` n'étaient pas censés être réécrivables après coup.
- **`affectations.controller.ts`** : `listAffectations`/`createAffectation`/`deleteAffectation` vérifient le périmètre via le campus du planning parent. **`respondToAffectation`** (`PATCH /:id/statut`, accessible à tout utilisateur authentifié — un ouvrier peut avoir n'importe quel rôle de compte) autorise désormais soit l'ouvrier concerné lui-même (apparié par email), soit un admin de son périmètre — jusque-là n'importe quel utilisateur connecté pouvait accepter/décliner l'affectation de n'importe qui.

37 tests ajoutés (12+2+5+9+9), vérifiés empiriquement : les fichiers corrigés remis de côté via `git stash`, 21 des 37 nouveaux tests échouent (les contrôles de périmètre), les 16 autres passent (comportement inchangé) — confirme que les tests ciblent bien les failles et non un comportement accessoire. Suite complète : 223/223 après restauration des correctifs.

**Non-sécuritaire, notés informationnels lors de l'audit :** absence de rate-limiting sur `/auth/forgot-password` (corrigée au passage ci-dessus) ; duplication `auth.controller.ts`/`users.controller.ts` (résolue par la suppression ci-dessus).

---

## ✅ Corrigé le 12 août 2026 (2) — Second passage d'audit : routes, middlewares, lib/, dépendances

Suite explicite à la demande « il faut faire un audit complet de toutes les zones ». Relu au-delà des contrôleurs déjà couverts par les deux lots précédents : les 17 fichiers `routes/*.ts` (chaînage des middlewares), `auth.middleware.ts`/`roles.middleware.ts`, `server.ts` (CORS, Helmet, sanitisation XSS globale, limites de taille), `validate.middleware.ts`, `turnstile.middleware.ts`, `env.ts`, tous les fichiers `lib/` (`cron.ts`, `cache.ts`, `audit.ts`, `prisma.ts`, `twilio.ts`, `campusSettings.ts`, `certificat.ts`), les schémas Zod, et les 12 contrôleurs restants (`contacts`, `ouvriers`, `twilio`, `settings`, `notifications`, `feedback`, `audit`, `users`, `messages`, `evenements`, `stats`), plus `npm audit` sur les deux paquets (backend et frontend).

### `updateContact` — escalade de privilège via liste ouverte

`PATCH /api/contacts/:id` n'exige que le rôle `referent_integration` et appliquait `{ ...req.body }` sans liste blanche ni schéma de validation — seul `{ ...req.body }` restant dans toute la base après les correctifs du 7-8 août (`updateEvenement`, `updatePlanning`). Un référent intégration pouvait :
- se réassigner (ou réassigner à un collègue) n'importe quel contact via `referent_integration_id`/`referent_eglise_id`, en contournant `PATCH /api/referents/contacts/:id/*` qui lui est explicitement interdit (réservé à `admin_campus`+) ;
- déplacer un contact vers n'importe quel campus via `campus` — `peutAccederContact` ne vérifie que le campus *actuel*, jamais la destination ;
- forcer `statut` directement, court-circuitant l'historique et le log d'audit dédiés à `updateStatut`.

Corrigé avec une liste blanche explicite (mêmes champs de profil que le formulaire d'inscription, moins `campus`/`telephone`/les référents/`statut`/les métadonnées système), même motif que `updateEvenement`/`updatePlanning`. 8 tests ajoutés.

### `getFeedbacks` — fuite de réponses au questionnaire inter-campus

`GET /api/feedback` (ouvert à `admin_campus`/`referent_integration`/`referent_eglise`) ne filtrait jamais par campus — un admin de Paris-Nord voyait les réponses (y compris le texte libre) de tous les campus. Même famille de faille que stats/messages/événements (7-8 août), oubliée sur cette route. `Feedback.contact_id` n'a pas de relation Prisma vers `Contact` (simple `String`, voir schema.prisma) : corrigé via une sous-requête explicite sur les contacts du périmètre de l'appelant plutôt qu'un filtre imbriqué. 3 tests ajoutés.

11 tests ajoutés au total pour ce lot, vérifiés empiriquement comme échouant sur le code d'avant (`git stash`) : 9/11 échouaient pour la bonne raison (champs qui fuitaient, filtre absent), les 2 autres passaient déjà (comportement inchangé). Suite complète : 234/234 après restauration.

### Anti-bot Turnstile — laissé volontairement débranché

`verifyTurnstile` (Cloudflare Turnstile) est entièrement implémenté et testé, mais n'est monté sur aucune route — décision délibérée antérieure à cet audit (retiré intentionnellement), pas un oubli. Les 2 formulaires publics restent protégés par honeypot + rate-limit IP (5/heure) uniquement. Laissé en l'état pour l'instant, à reconsidérer plus tard si le spam devient un problème réel.

### Dépendances npm vulnérables

Corrigées sans changement de code (déjà dans la plage `^` de chaque `package.json`, `typecheck`/`build`/suite de tests complets revérifiés après coup) :
- Backend : `multer` 2.1.1 → 2.2.0 (2 CVE de déni de service — route d'import Excel), `morgan` 1.10.1 → 1.11.0 (injection dans les logs via `:remote-user`).
- Frontend : `react-router-dom` 7.14.2 → 7.18.2 (CSRF sur PUT/PATCH/DELETE, redirection ouverte, déni de service — c'est le routeur de toute l'application), `axios` 1.15.2 → 1.19.0 (contournement de `maxBodyLength` en HTTP/2, pollution de prototype sur les sous-champs d'authentification — au passage, corrige aussi `form-data` qui n'apparaissait qu'en transitif d'axios).

**Non corrigées, aucun correctif disponible en amont — risque accepté et documenté :**
- `xlsx` (backend, sévérité haute : pollution de prototype + ReDoS dans SheetJS) — utilisé par `importContacts` pour parser les fichiers Excel uploadés. Route réservée à `admin_campus`+, ce qui limite l'exploitation à un compte admin compromis ou un fichier reçu d'un tiers puis importé sans le relire. Migrer vers une autre librairie (ex. `exceljs`) est une tâche à part entière, hors périmètre de cet audit.
- `dompurify` (frontend, sévérité modérée) — dépendance transitive de `jspdf` (génération de PDF), déjà à sa dernière version publiée (4.2.1) ; aucune mise à jour indépendante possible sans forcer une version potentiellement incompatible. L'application n'appelle nulle part la fonctionnalité HTML-vers-PDF de jspdf qui utiliserait dompurify (aucun `dangerouslySetInnerHTML` dans tout le frontend, confirmé par recherche exhaustive) — risque résiduel très faible en pratique.

**Noté en information, pas une faille active :** le JWT et le refresh token sont stockés en `localStorage` (`frontend/src/services/api.ts`) plutôt qu'en cookie `httpOnly` — pratique standard pour une SPA mais qui rendrait les tokens accessibles à un XSS si un vecteur d'injection existait. Aucun n'a été trouvé (pas de `dangerouslySetInnerHTML`, sanitisation XSS globale du body côté backend) ; à garder à l'esprit si une future fonctionnalité introduit du rendu HTML non échappé.

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

<!-- "Réorganiser l'écran Paramètres" fait le 7 août : 6 → 3 sections (Infos Église /
     Modèles de messages / Certificat), accordéon repliable, aperçu à la demande. -->
