# Phila Intégration — instructions projet

Application de gestion de l'intégration des membres pour l'église Phila Cité des Adorateurs.
**En production depuis le 1er juillet 2026.**

Le reste à faire est dans **[docs/BACKLOG.md](docs/BACKLOG.md)**.

## Stack

- **Frontend** : React 19 + TypeScript + Vite, PWA. Pas de framework CSS — styles en ligne + variables CSS (`frontend/src/index.css`) et tokens (`frontend/src/components/ui/tokens.ts`).
- **Backend** : Node + Express 5 + TypeScript, Prisma 7 (adaptateur `pg` natif).
- **Base** : PostgreSQL sur Neon.tech.
- **Envois** : Twilio (WhatsApp).

## Commandes

```bash
# Backend (depuis backend/)
npm run dev          # tsx watch, port 4000
npm run typecheck    # tsc --noEmit
npm test             # jest
npm run seed

# Frontend (depuis frontend/)
npm run dev          # vite, port 5173
npm run build        # tsc -b && vite build
npm run lint         # eslint
npm run test:e2e     # playwright (démarre les serveurs automatiquement)
```

## Conventions

- **Interface, commentaires et messages de commit en français.** Les commentaires expliquent le *pourquoi*, en tête de fichier et sur les passages non évidents.
- **Prisma : `npx prisma db push`, jamais `prisma migrate`.** Il n'y a volontairement pas de dossier `migrations/`. Après tout changement de schéma : `npx prisma db push && npx prisma generate`.
- Le client Prisma généré (`backend/generated/`) est ignoré par git. Après un `git pull` touchant le schéma, relancer `npx prisma generate`, sinon le typecheck échoue.
- Tests backend : Prisma est mocké via `backend/src/__tests__/__mocks__/prisma.ts` (`moduleNameMapper`). `node-cron` est mocké globalement dans `setup.ts` — pour tester une tâche planifiée, récupérer son callback via `(cron.schedule as jest.Mock).mock.calls`, en le cherchant par son motif cron plutôt que par index.

## ⚠️ Une seule base de données

**Le développement local et la production partagent la même base Neon.** Il n'y a pas de base de dev séparée.

Conséquences :
- Tout script de données (`npm run migrate-campus-settings`, `seed`, …) touche **directement la production**.
- Ne jamais lancer un script qui supprime des lignes avant que le code qui lit la nouvelle forme ne soit déployé. C'est exactement ce qui a provoqué l'incident du 6 août 2026 (messages WhatsApp partis avec adresse et téléphone vides).
- `prisma db push` modifie le schéma de production.

## Déploiement

Push sur `main` → Vercel (frontend) + Railway (backend), automatiquement.

Deux remotes :
- `eglise` → `philaintegrationca/phila-integration` — **c'est celui qui déclenche le déploiement**.
- `origin` → `Dehollinhollat/phila-integration` — fork personnel, ne déploie rien.

Pousser vers `origin` seul ne met pas la production à jour.

## Rôles

Hiérarchie (`ROLE_RANK` dans `frontend/src/utils/constants.ts`) :
`super_admin` (5) > `admin_campus` (4) > `referent_eglise` (3) > `referent_integration` (2) > `lecteur` (1)

Un `admin_campus` est limité aux campus listés dans son `user.campus[]`. Côté backend, cette limite se vérifie avec les helpers existants — `verifierPerimetreCible` (users), `horsPerimetreCampus` (ouvriers), `peutAccederContact` (contacts) — et le middleware `requireCampusAccess`, **toujours chaîné après `requireMinRole`** (seul, il ne vérifie que l'appartenance au campus, pas le rôle).

## Campus

4 campus : `paris` (maison mère), `paris_nord`, `orleans`, `montpellier`.

Ajouter un campus implique : l'enum Prisma `Campus`, `DestinataireEvenement`, et plusieurs listes encore dupliquées côté backend (voir le backlog, dette technique).
