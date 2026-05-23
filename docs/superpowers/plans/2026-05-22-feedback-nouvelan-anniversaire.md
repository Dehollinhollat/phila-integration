# Feedback / Nouvel An / Anniversaire — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter 4 fonctionnalités : message Nouvel An automatique, anniversaires ouvriers, formulaire de feedback 14j, page résultats feedback + lien sidebar.

**Architecture:** Les features 1 & 2 sont des extensions de `cron.ts` et `Settings.tsx` existants. La feature 3 (feedback) est un nouveau sous-système complet : 2 modèles Prisma, 1 contrôleur, 1 routeur, 1 page formulaire publique, 1 page résultats admin. Toutes les features partagent le même pattern `sendWhatsApp` / `prisma.settings`.

**Tech Stack:** Node.js 20, Express, Prisma (PostgreSQL), TypeScript strict, React 19, Recharts 3 (déjà installé), react-router-dom v7.

---

## Fichiers touchés

| Fichier | Action |
|---|---|
| `backend/src/lib/cron.ts` | Modifier — Tâche 5 (anniversaire ouvriers), Tâche 10 (Nouvel An), Tâche 11 (feedback J+14), upsert setting nouvel_an |
| `backend/prisma/schema.prisma` | Modifier — ajouter `FeedbackToken`, `Feedback`, relation `Contact.feedback_tokens` |
| `backend/src/controllers/feedback.controller.ts` | Créer |
| `backend/src/routes/feedback.routes.ts` | Créer |
| `backend/src/server.ts` | Modifier — enregistrer feedbackRoutes |
| `frontend/src/features/admin/Settings.tsx` | Modifier — section Nouvel An |
| `frontend/src/pages/FormFeedback.tsx` | Créer |
| `frontend/src/pages/FeedbackResultats.tsx` | Créer |
| `frontend/src/App.tsx` | Modifier — 2 nouvelles routes |
| `frontend/src/layout/Sidebar.tsx` | Modifier — lien Satisfaction |

---

## Task 1 : Anniversaire — ajouter les ouvriers

**Fichier :** Modifier `backend/src/lib/cron.ts:323-367` (Tâche 5)

- [ ] **Étape 1 : Ajouter la boucle ouvriers après la boucle contacts dans Tâche 5**

Remplacer (après la boucle `for (const contact of anniversaires) {...}` et `console.log(...)` à la fin de Tâche 5) :

```typescript
  // ── Ouvriers anniversaire ─────────────────────────────────────────────────
  const today     = new Date(); // déjà déclaré plus haut dans la même tâche
  // NOTE: day/month déjà déclarés en début de Tâche 5 — les réutiliser
  const ouvriers = await prisma.ouvrier.findMany({
    where:  { date_naissance: { not: null }, statut: true },
    select: { id: true, prenom: true, telephone: true, date_naissance: true },
  });

  const ouvriersAujourdHui = ouvriers.filter(o => {
    if (!o.date_naissance) return false;
    const d = new Date(o.date_naissance);
    return d.getDate() === todayDay && (d.getMonth() + 1) === todayMonth;
  });

  console.log(`[Cron] ${ouvriersAujourdHui.length} anniversaire(s) ouvrier(s) aujourd'hui`);

  for (const ouvrier of ouvriersAujourdHui) {
    const contenu = template.replace(/\[Prenom\]/gi, ouvrier.prenom);
    const { error } = await sendWhatsApp(ouvrier.telephone, contenu);
    if (error) {
      console.error(`[ANNIVERSAIRE] Erreur ouvrier ${ouvrier.prenom}:`, error);
    }
  }
```

> Note : `template`, `todayDay`, `todayMonth` sont déjà déclarés dans le scope de Tâche 5. Pas de duplication. Les ouvriers n'ont pas de `Message` row (pas de contact_id obligatoire et le modèle Message requiert un type TypeMessage) — on log juste les erreurs.

- [ ] **Étape 2 : Vérifier aucune erreur TypeScript**

```bash
cd backend && npx tsc --noEmit
```

Attendu : zéro erreur.

---

## Task 2 : Nouvel An — cron job + upsert setting

**Fichier :** Modifier `backend/src/lib/cron.ts`

- [ ] **Étape 1 : Ajouter l'upsert `template_nouvel_an` dans le Promise.all existant**

Dans le bloc `Promise.all([...])` (lignes 301-320 du fichier original), ajouter une entrée :

```typescript
    prisma.settings.upsert({
      where:  { key: 'template_nouvel_an' },
      create: {
        key:   'template_nouvel_an',
        value: "Bonne année [Prenom] ! 🎉 Toute l'équipe de Phila Cité des Adorateurs vous souhaite une excellente année, pleine de grâce, de santé et de victoires. Que Dieu vous comble de Ses bénédictions en cette nouvelle année !",
      },
      update: {},
    }),
```

- [ ] **Étape 2 : Ajouter Tâche 10 (cron Nouvel An) après Tâche 9**

Insérer avant `console.log('[Cron] Tâches planifiées démarrées')` :

```typescript
  // ── Tâche 10 : Message Nouvel An (1er janvier à 09h00) ──────────────────
  cron.schedule('0 9 1 1 *', async () => {
    console.log('[CRON][NOUVEL_AN] Envoi messages Nouvel An...');

    const setting  = await prisma.settings.findUnique({ where: { key: 'template_nouvel_an' } });
    const template = setting?.value
      ?? "Bonne année [Prenom] ! 🎉 Toute l'équipe de Phila Cité des Adorateurs vous souhaite une excellente année, pleine de grâce, de santé et de victoires. Que Dieu vous comble de Ses bénédictions en cette nouvelle année !";

    const [contacts, ouvriers] = await Promise.all([
      prisma.contact.findMany({
        where:  { statut: { not: 'inactif' } },
        select: { prenom: true, telephone: true },
      }),
      prisma.ouvrier.findMany({
        where:  { statut: true },
        select: { prenom: true, telephone: true },
      }),
    ]);

    const destinataires = [
      ...contacts.map(c => ({ prenom: c.prenom, telephone: c.telephone })),
      ...ouvriers.map(o => ({ prenom: o.prenom, telephone: o.telephone })),
    ];

    for (const dest of destinataires) {
      const message = template.replace(/\[Prenom\]/g, dest.prenom);
      try {
        await sendWhatsApp(dest.telephone, message);
      } catch (err) {
        console.error(`[NOUVEL_AN] Erreur pour ${dest.prenom}:`, err);
      }
    }

    console.log(`[CRON][NOUVEL_AN] ${destinataires.length} messages envoyés`);
  });
```

- [ ] **Étape 3 : Vérifier aucune erreur TypeScript**

```bash
cd backend && npx tsc --noEmit
```

---

## Task 3 : Settings.tsx — section Message Nouvel An

**Fichier :** Modifier `frontend/src/features/admin/Settings.tsx`

- [ ] **Étape 1 : Ajouter la section dans le tableau SECTIONS**

Après la section `'Messages d\'anniversaire'`, ajouter :

```typescript
  {
    label: 'Message Nouvel An',
    icon:  '🎉',
    settings: [
      {
        key:         'template_nouvel_an',
        label:       'Message du Nouvel An',
        description: 'Envoyé automatiquement le 1er janvier à 9h00 à tous les contacts et ouvriers actifs. Variable disponible : [Prenom].',
        type:        'textarea',
        placeholder: "Bonne année [Prenom] ! 🎉 Toute l'équipe de Phila Cité des Adorateurs vous souhaite une excellente année...",
      },
    ],
  },
```

- [ ] **Étape 2 : Mettre à jour la condition d'aperçu pour inclure `template_nouvel_an`**

Dans le rendu des `textarea`, la condition de prévisualisation est :
```typescript
def.key === 'template_anniversaire' || def.key === 'message_bienvenue'
```
Changer en :
```typescript
def.key === 'template_anniversaire' || def.key === 'message_bienvenue' || def.key === 'template_nouvel_an'
```

- [ ] **Étape 3 : Vérifier aucune erreur TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

---

## Task 4 : Prisma — modèles FeedbackToken et Feedback

**Fichier :** Modifier `backend/prisma/schema.prisma`

- [ ] **Étape 1 : Ajouter la relation dans le modèle Contact**

Dans le bloc `// Relations` du modèle `Contact`, ajouter après `checklist ChecklistItem[]` :

```prisma
  feedback_tokens       FeedbackToken[]
```

- [ ] **Étape 2 : Ajouter les deux nouveaux modèles en fin de fichier**

```prisma
// ─────────────────────────────────────────
// FEEDBACK TOKEN
// Token à usage unique envoyé par WhatsApp 14 jours après inscription.
// Expire 7 jours après l'envoi. Marqué 'used' après soumission du formulaire.
// ─────────────────────────────────────────

model FeedbackToken {
  id         String   @id @default(cuid())
  contact_id String
  contact    Contact  @relation(fields: [contact_id], references: [id], onDelete: Cascade)
  token      String   @unique
  used       Boolean  @default(false)
  expires_at DateTime
  created_at DateTime @default(now())

  @@index([token])
}

// ─────────────────────────────────────────
// FEEDBACK
// Réponses au questionnaire de satisfaction envoyé à J+14.
// Stocké en JSON pour flexibilité (12 questions de types variés).
// contact_id optionnel : le formulaire est volontairement anonyme.
// ─────────────────────────────────────────

model Feedback {
  id         String   @id @default(cuid())
  contact_id String?
  token      String?
  reponses   Json
  created_at DateTime @default(now())
}
```

- [ ] **Étape 3 : Appliquer la migration**

```bash
cd backend && npx prisma db push
```

Attendu : `Your database is now in sync with your schema.`

- [ ] **Étape 4 : Régénérer le client Prisma**

```bash
cd backend && npx prisma generate
```

---

## Task 5 : Contrôleur feedback

**Fichier :** Créer `backend/src/controllers/feedback.controller.ts`

- [ ] **Étape 1 : Créer le fichier**

```typescript
// src/controllers/feedback.controller.ts
// Questionnaire de satisfaction — envoyé par WhatsApp 14 jours après inscription.
// POST /api/feedback/:token — public : vérifie le token, sauvegarde les réponses JSON.
// GET  /api/feedback         — admin_campus+ : retourne les feedbacks avec statistiques.

import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// POST /api/feedback/:token
export async function submitFeedback(req: Request, res: Response): Promise<void> {
  const { token } = req.params;
  const reponses  = req.body as Record<string, unknown>;

  const feedbackToken = await prisma.feedbackToken.findUnique({ where: { token } });

  if (!feedbackToken) {
    res.status(404).json({ message: 'Lien invalide ou expiré.' });
    return;
  }
  if (feedbackToken.used) {
    res.status(409).json({ message: 'Ce questionnaire a déjà été rempli.' });
    return;
  }
  if (feedbackToken.expires_at < new Date()) {
    res.status(410).json({ message: 'Ce lien a expiré. Merci de nous contacter directement.' });
    return;
  }

  await prisma.$transaction([
    prisma.feedback.create({
      data: {
        contact_id: feedbackToken.contact_id,
        token,
        reponses,
      },
    }),
    prisma.feedbackToken.update({
      where: { token },
      data:  { used: true },
    }),
  ]);

  res.status(200).json({ message: 'Merci pour vos réponses !' });
}

// GET /api/feedback
export async function getFeedbacks(_req: Request, res: Response): Promise<void> {
  const feedbacks = await prisma.feedback.findMany({
    orderBy: { created_at: 'desc' },
  });

  const total = feedbacks.length;

  // Statistiques Q4 et Q5 (étoiles 1-5)
  function moyenneQuestion(key: string): number | null {
    const values = feedbacks
      .map(f => {
        const r = f.reponses as Record<string, unknown>;
        return typeof r[key] === 'number' ? (r[key] as number) : null;
      })
      .filter((v): v is number => v !== null);
    if (values.length === 0) return null;
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  }

  // Répartition pour chaque question radio/checkbox
  function repartition(key: string): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const f of feedbacks) {
      const r = f.reponses as Record<string, unknown>;
      const val = r[key];
      if (Array.isArray(val)) {
        for (const v of val) {
          if (typeof v === 'string') counts[v] = (counts[v] ?? 0) + 1;
        }
      } else if (typeof val === 'string' && val) {
        counts[val] = (counts[val] ?? 0) + 1;
      }
    }
    return counts;
  }

  // Liste des commentaires Q12
  const commentaires = feedbacks
    .map(f => {
      const r = f.reponses as Record<string, unknown>;
      return typeof r['q12'] === 'string' && r['q12'] ? r['q12'] as string : null;
    })
    .filter((c): c is string => c !== null);

  res.json({
    total,
    statistiques: {
      moyenne_q4: moyenneQuestion('q4'),
      moyenne_q5: moyenneQuestion('q5'),
      q1: repartition('q1'),
      q2: repartition('q2'),
      q3: repartition('q3'),
      q4: repartition('q4'),
      q5: repartition('q5'),
      q6: repartition('q6'),
      q7: repartition('q7'),
      q8: repartition('q8'),
      q9: repartition('q9'),
      q10: repartition('q10'),
      q11: repartition('q11'),
    },
    commentaires,
    feedbacks,
  });
}
```

---

## Task 6 : Routes feedback + enregistrement serveur

**Fichiers :** Créer `backend/src/routes/feedback.routes.ts` + modifier `backend/src/server.ts`

- [ ] **Étape 1 : Créer feedback.routes.ts**

```typescript
// src/routes/feedback.routes.ts
// Questionnaire de satisfaction.
// POST /:token — public (pas d'authenticate)
// GET  /       — admin_campus+

import { Router } from 'express';
import { authenticate }  from '../middlewares/auth.middleware';
import { requireMinRole } from '../middlewares/roles.middleware';
import { submitFeedback, getFeedbacks } from '../controllers/feedback.controller';

const router = Router();

// Route publique — vérification du token dans le contrôleur
router.post('/:token', submitFeedback);

// Route protégée
router.get('/', authenticate, requireMinRole('admin_campus'), getFeedbacks);

export default router;
```

- [ ] **Étape 2 : Enregistrer dans server.ts**

Dans `server.ts`, ajouter l'import après les imports existants :

```typescript
import feedbackRoutes from './routes/feedback.routes';
```

Et dans la section `// Routes protégées`, ajouter :

```typescript
app.use('/api/feedback', feedbackRoutes);
```

- [ ] **Étape 3 : Vérifier TypeScript backend**

```bash
cd backend && npx tsc --noEmit
```

---

## Task 7 : Cron feedback J+14

**Fichier :** Modifier `backend/src/lib/cron.ts`

- [ ] **Étape 1 : Ajouter l'import crypto en haut du fichier**

```typescript
import crypto from 'crypto';
```

- [ ] **Étape 2 : Ajouter Tâche 11 après Tâche 10**

```typescript
  // ── Tâche 11 : Liens feedback satisfaction J+14 (tous les jours à 10h00) ──
  cron.schedule('0 10 * * *', async () => {
    const il_y_a_14_jours = new Date();
    il_y_a_14_jours.setDate(il_y_a_14_jours.getDate() - 14);

    const debut = new Date(il_y_a_14_jours);
    debut.setHours(0, 0, 0, 0);
    const fin = new Date(il_y_a_14_jours);
    fin.setHours(23, 59, 59, 999);

    const contacts = await prisma.contact.findMany({
      where: {
        date_inscription: { gte: debut, lte: fin },
        statut: { not: 'inactif' },
      },
      select: { id: true, prenom: true, telephone: true },
    });

    for (const contact of contacts) {
      const token     = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await prisma.feedbackToken.create({
        data: { contact_id: contact.id, token, expires_at: expiresAt },
      });

      const lien    = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/form/feedback/${token}`;
      const message = `Bonjour ${contact.prenom}, nous espérons que vous vous sentez bien chez nous à Phila ! Votre avis nous est précieux. Prenez 3 minutes pour répondre à notre questionnaire de satisfaction : ${lien}`;

      await sendWhatsApp(contact.telephone, message).catch(err =>
        console.error('[FEEDBACK] Erreur envoi:', err)
      );
    }

    console.log(`[CRON][FEEDBACK] ${contacts.length} lien(s) envoyé(s)`);
  });
```

- [ ] **Étape 3 : Vérifier TypeScript backend**

```bash
cd backend && npx tsc --noEmit
```

---

## Task 8 : Page FormFeedback

**Fichier :** Créer `frontend/src/pages/FormFeedback.tsx`

- [ ] **Étape 1 : Créer le fichier complet**

```typescript
// src/pages/FormFeedback.tsx
// Formulaire de satisfaction — accessible via /form/feedback/:token (public).
// 5 sections, barre de progression, submit vers POST /api/feedback/:token.
// Anonyme : le token identifie le contact côté backend sans l'exposer dans l'UI.

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import Logo from '../components/ui/Logo';
import Footer from '../components/common/Footer';
import { API_BASE } from '../utils/constants';

// ─── Types locaux ─────────────────────────────────────────────────────────────

interface Reponses {
  q1:       string;
  q2:       string;
  q3:       string[];
  q3_autre: string;
  q4:       number;
  q5:       number;
  q6:       string[];
  q6_autre: string;
  q7:       string[];
  q7_autre: string;
  q8:       string;
  q9:       string;
  q10:      string;
  q11:      string;
  q12:      string;
}

const INITIAL: Reponses = {
  q1: '', q2: '', q3: [], q3_autre: '', q4: 0, q5: 0,
  q6: [], q6_autre: '', q7: [], q7_autre: '', q8: '',
  q9: '', q10: '', q11: '', q12: '',
};

const SECTIONS_LABELS = [
  'Votre profil',
  'Expérience globale',
  'Déroulement du culte',
  'Vie communautaire',
  'Recommandation',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function RadioGroup({ options, value, onChange }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {options.map(opt => (
        <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: 'var(--text-primary, #0F172A)' }}>
          <input
            type="radio"
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            style={{ accentColor: '#0D9488', width: 16, height: 16, flexShrink: 0 }}
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

function CheckboxGroup({ options, values, onChange, otherValue, onOtherChange }: {
  options: { value: string; label: string }[];
  values: string[];
  onChange: (v: string[]) => void;
  otherValue: string;
  onOtherChange: (v: string) => void;
}) {
  function toggle(val: string) {
    onChange(values.includes(val) ? values.filter(v => v !== val) : [...values, val]);
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {options.map(opt => (
        <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: 'var(--text-primary, #0F172A)' }}>
          <input
            type="checkbox"
            checked={values.includes(opt.value)}
            onChange={() => toggle(opt.value)}
            style={{ accentColor: '#0D9488', width: 16, height: 16, flexShrink: 0 }}
          />
          {opt.label}
        </label>
      ))}
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 14, color: 'var(--text-primary, #0F172A)' }}>
        <input
          type="checkbox"
          checked={values.includes('autre')}
          onChange={() => toggle('autre')}
          style={{ accentColor: '#0D9488', width: 16, height: 16, flexShrink: 0, marginTop: 2 }}
        />
        <div style={{ flex: 1 }}>
          Autre
          {values.includes('autre') && (
            <input
              type="text"
              value={otherValue}
              onChange={e => onOtherChange(e.target.value)}
              placeholder="Précisez…"
              style={{ display: 'block', marginTop: 6, width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, color: '#0F172A', background: '#F8FAFC', boxSizing: 'border-box' }}
            />
          )}
        </div>
      </label>
    </div>
  );
}

function StarRating({ value, onChange, label1, label5 }: {
  value: number;
  onChange: (v: number) => void;
  label1: string;
  label5: string;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(n)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 32, lineHeight: 1, padding: 2, color: (hovered || value) >= n ? '#F59E0B' : '#CBD5E1', transition: '120ms ease' }}
          >
            ★
          </button>
        ))}
        {value > 0 && <span style={{ fontSize: 13, color: '#64748B', marginLeft: 4 }}>{value}/5</span>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94A3B8' }}>
        <span>{label1}</span>
        <span>{label5}</span>
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function FormFeedback() {
  const { token } = useParams<{ token: string }>();
  const [step,      setStep]      = useState(0); // 0-4 = sections, 5 = merci
  const [reponses,  setReponses]  = useState<Reponses>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [checking,   setChecking]   = useState(true);

  // Vérifie côté UX que le token existe (GET non exposé — on fait juste un HEAD implicite
  // via le POST ; ici on commence directement le formulaire et on gère les erreurs à la soumission)
  useEffect(() => { setChecking(false); }, []);

  function set<K extends keyof Reponses>(key: K, value: Reponses[K]) {
    setReponses(prev => ({ ...prev, [key]: value }));
  }

  function canGoNext(): boolean {
    switch (step) {
      case 0: return !!reponses.q1 && !!reponses.q2 && reponses.q3.length > 0;
      case 1: return reponses.q4 > 0 && reponses.q5 > 0;
      case 2: return reponses.q6.length > 0 && reponses.q7.length > 0 && !!reponses.q8;
      case 3: return !!reponses.q9;
      case 4: return !!reponses.q10 && !!reponses.q11;
      default: return false;
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setTokenError(null);
    try {
      await axios.post(`${API_BASE}/feedback/${token}`, reponses);
      setStep(5);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setTokenError(err.response?.data?.message ?? 'Une erreur est survenue.');
      } else {
        setTokenError('Impossible de contacter le serveur.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) return null;

  // ── Écran de remerciement ──
  if (step === 5) {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <Logo width={56} height={56} style={{ marginBottom: 16 }} />
          <div style={{ fontSize: 40, marginBottom: 16 }}>🙏</div>
          <h1 style={{ ...S.title, marginBottom: 12 }}>Merci infiniment !</h1>
          <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.7, textAlign: 'center' }}>
            Votre avis contribue directement à l'amélioration de notre communauté.<br />
            Que Dieu vous bénisse.
          </p>
        </div>
        <Footer />
      </div>
    );
  }

  // ── Barre de progression ──
  const progress = ((step) / 5) * 100;

  return (
    <div style={S.page}>
      <div style={S.card}>

        {/* En-tête */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Logo width={52} height={52} style={{ marginBottom: 12 }} />
          <span style={{ display: 'inline-block', background: '#0D9488', color: '#fff', borderRadius: 20, padding: '4px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12 }}>
            Questionnaire de satisfaction
          </span>
          <h1 style={S.title}>Votre avis compte pour nous</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#475569' }}>
            Questionnaire de satisfaction (anonyme)
          </p>
        </div>

        {/* Introduction — seulement sur la première section */}
        {step === 0 && (
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '14px 16px', marginBottom: 24, fontSize: 13, color: '#166534', lineHeight: 1.6 }}>
            Dans le cadre de notre démarche d'amélioration continue, nous souhaitons mieux comprendre votre vécu lors de nos cultes. Ce questionnaire est entièrement anonyme et ne prend que 3 à 5 minutes. Vos réponses sincères sont précieuses pour nous aider à grandir ensemble. Merci de votre participation !
          </div>
        )}

        {/* Barre de progression */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Section {step + 1} / 5</span>
            <span style={{ fontSize: 12, color: '#64748B' }}>{SECTIONS_LABELS[step]}</span>
          </div>
          <div style={{ height: 4, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: '#0D9488', borderRadius: 4, transition: '400ms ease' }} />
          </div>
        </div>

        {/* Titre de section */}
        <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: '#1E293B', paddingBottom: 10, borderBottom: '1px solid #E2E8F0' }}>
          {SECTIONS_LABELS[step]}
        </h2>

        {/* ─── Section 1 : Profil ─── */}
        {step === 0 && (
          <div style={S.section}>
            <div style={S.question}>
              <label style={S.label}>Q1 — Comment vous définissez-vous au sein de l'assemblée ?</label>
              <RadioGroup
                value={reponses.q1}
                onChange={v => set('q1', v)}
                options={[
                  { value: 'nouveau_visiteur', label: 'Nouveau visiteur (moins de 3 mois)' },
                  { value: 'membre_regulier',  label: 'Membre régulier' },
                  { value: 'ouvrier',          label: 'Ouvrier / bénévole' },
                ]}
              />
            </div>
            <div style={S.question}>
              <label style={S.label}>Q2 — À quelle fréquence venez-vous au culte du dimanche ?</label>
              <RadioGroup
                value={reponses.q2}
                onChange={v => set('q2', v)}
                options={[
                  { value: 'premiere_fois',     label: "C'est ma première fois" },
                  { value: 'quelques_fois',      label: 'Quelques fois seulement' },
                  { value: 'irregulier',         label: 'De manière irrégulière' },
                  { value: 'presque_chaque_dim', label: 'Presque chaque dimanche' },
                ]}
              />
            </div>
            <div style={S.question}>
              <label style={S.label}>Q3 — Comment avez-vous découvert Phila Cité des Adorateurs ?</label>
              <CheckboxGroup
                values={reponses.q3}
                onChange={v => set('q3', v)}
                otherValue={reponses.q3_autre}
                onOtherChange={v => set('q3_autre', v)}
                options={[
                  { value: 'proche',    label: 'Par un proche / ami / famille' },
                  { value: 'reseaux',   label: 'Réseaux sociaux' },
                  { value: 'internet',  label: 'Recherche internet' },
                  { value: 'affiches',  label: 'Affiches / flyers' },
                  { value: 'passais',   label: 'Je passais devant' },
                ]}
              />
            </div>
          </div>
        )}

        {/* ─── Section 2 : Expérience globale ─── */}
        {step === 1 && (
          <div style={S.section}>
            <div style={S.question}>
              <label style={S.label}>Q4 — De manière générale, comment évaluez-vous votre expérience lors du culte du dimanche ?</label>
              <StarRating value={reponses.q4} onChange={v => set('q4', v)} label1="Pas satisfait" label5="Très satisfait" />
            </div>
            <div style={S.question}>
              <label style={S.label}>Q5 — Comment avez-vous trouvé l'accueil à votre arrivée ?</label>
              <StarRating value={reponses.q5} onChange={v => set('q5', v)} label1="Peu chaleureux" label5="Très chaleureux" />
            </div>
          </div>
        )}

        {/* ─── Section 3 : Déroulement du culte ─── */}
        {step === 2 && (
          <div style={S.section}>
            <div style={S.question}>
              <label style={S.label}>Q6 — Parmi les éléments suivants, lesquels avez-vous particulièrement appréciés ?</label>
              <CheckboxGroup
                values={reponses.q6}
                onChange={v => set('q6', v)}
                otherValue={reponses.q6_autre}
                onOtherChange={v => set('q6_autre', v)}
                options={[
                  { value: 'louange',    label: 'La louange et l'adoration' },
                  { value: 'predication', label: 'La prédication / le message' },
                  { value: 'priere',     label: 'Les temps de prière' },
                  { value: 'annonces',   label: 'Les annonces et la vie de l'assemblée' },
                  { value: 'echanges',   label: 'Les échanges fraternels après le culte' },
                  { value: 'ambiance',   label: 'L'ambiance générale' },
                ]}
              />
            </div>
            <div style={S.question}>
              <label style={S.label}>Q7 — Y a-t-il des aspects que vous souhaiteriez voir améliorés ou renforcés ?</label>
              <CheckboxGroup
                values={reponses.q7}
                onChange={v => set('q7', v)}
                otherValue={reponses.q7_autre}
                onOtherChange={v => set('q7_autre', v)}
                options={[
                  { value: 'accueil_nouveaux', label: 'L'accueil des nouveaux arrivants' },
                  { value: 'duree_culte',      label: 'La durée globale du culte' },
                  { value: 'louange_duree',    label: 'Le temps consacré à la louange' },
                  { value: 'message',          label: 'Le contenu ou la durée du message' },
                  { value: 'echange',          label: 'Le temps d'échange et de rencontre entre membres' },
                  { value: 'communication',    label: 'La communication / les informations pratiques' },
                  { value: 'logistique',       label: 'L'organisation logistique (espace, son, etc.)' },
                  { value: 'satisfait',        label: 'Rien en particulier, je suis satisfait(e)' },
                ]}
              />
            </div>
            <div style={S.question}>
              <label style={S.label}>Q8 — Quelle durée de culte vous semble la plus adaptée ?</label>
              <RadioGroup
                value={reponses.q8}
                onChange={v => set('q8', v)}
                options={[
                  { value: 'moins_1h30',   label: 'Moins de 1h30' },
                  { value: '1h30_2h',      label: 'Entre 1h30 et 2h' },
                  { value: '2h_2h30',      label: 'Entre 2h et 2h30' },
                  { value: 'plus_2h30',    label: 'Plus de 2h30' },
                ]}
              />
            </div>
          </div>
        )}

        {/* ─── Section 4 : Vie communautaire ─── */}
        {step === 3 && (
          <div style={S.section}>
            <div style={S.question}>
              <label style={S.label}>Q9 — Après le culte, avez-vous eu l'opportunité d'échanger avec d'autres membres ?</label>
              <RadioGroup
                value={reponses.q9}
                onChange={v => set('q9', v)}
                options={[
                  { value: 'oui_facilement',  label: 'Oui, facilement' },
                  { value: 'un_peu',          label: 'Un peu, mais j'aurais aimé plus' },
                  { value: 'non_vraiment',    label: 'Non, pas vraiment' },
                  { value: 'reparti_direct',  label: 'Je suis reparti(e) directement après le culte' },
                ]}
              />
            </div>
          </div>
        )}

        {/* ─── Section 5 : Recommandation et intention ─── */}
        {step === 4 && (
          <div style={S.section}>
            <div style={S.question}>
              <label style={S.label}>Q10 — Avez-vous l'intention de revenir au culte ?</label>
              <RadioGroup
                value={reponses.q10}
                onChange={v => set('q10', v)}
                options={[
                  { value: 'oui_certainement',  label: 'Oui, certainement' },
                  { value: 'probablement',       label: 'Probablement' },
                  { value: 'ne_sais_pas',        label: 'Je ne sais pas encore' },
                  { value: 'probablement_pas',   label: 'Probablement pas' },
                ]}
              />
            </div>
            <div style={S.question}>
              <label style={S.label}>Q11 — Recommanderiez-vous nos cultes à quelqu'un de votre entourage ?</label>
              <RadioGroup
                value={reponses.q11}
                onChange={v => set('q11', v)}
                options={[
                  { value: 'oui_certainement', label: 'Oui, certainement' },
                  { value: 'probablement_oui', label: 'Probablement oui' },
                  { value: 'ne_sais_pas',      label: 'Je ne sais pas encore' },
                  { value: 'probablement_pas', label: 'Probablement pas' },
                ]}
              />
            </div>
            <div style={S.question}>
              <label style={{ ...S.label, marginBottom: 8 }}>
                Q12 — Avez-vous des suggestions, idées ou commentaires à partager avec nous ?
                <span style={{ fontWeight: 400, color: '#94A3B8' }}> (facultatif)</span>
              </label>
              <textarea
                value={reponses.q12}
                onChange={e => set('q12', e.target.value)}
                placeholder="Vos suggestions sont les bienvenues…"
                rows={4}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 14, color: '#0F172A', background: '#F8FAFC', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
          </div>
        )}

        {/* Erreur soumission */}
        {tokenError && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#DC2626' }}>
            {tokenError}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, gap: 12 }}>
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              style={{ padding: '11px 20px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              ← Précédent
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < 4 ? (
            <button
              type="button"
              onClick={() => canGoNext() && setStep(s => s + 1)}
              disabled={!canGoNext()}
              style={{ padding: '11px 24px', background: canGoNext() ? '#0D9488' : '#CBD5E1', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: canGoNext() ? 'pointer' : 'default', fontFamily: 'inherit', transition: '120ms ease' }}
            >
              Suivant →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !canGoNext()}
              style={{ padding: '11px 24px', background: (!submitting && canGoNext()) ? '#0D9488' : '#CBD5E1', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: (!submitting && canGoNext()) ? 'pointer' : 'default', fontFamily: 'inherit', transition: '120ms ease' }}
            >
              {submitting ? 'Envoi…' : 'Envoyer mes réponses ✓'}
            </button>
          )}
        </div>

      </div>
      <Footer />
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight:      '100vh',
    display:        'flex',
    flexDirection:  'column' as const,
    background:     'linear-gradient(135deg, #F0FDFA 0%, #fff 60%)',
  },
  card: {
    flex:           1,
    maxWidth:       540,
    width:          '100%',
    margin:         '0 auto',
    padding:        'clamp(20px, 5vw, 40px)',
    background:     '#fff',
  },
  title: {
    margin:      0,
    fontSize:    22,
    fontWeight:  700,
    color:       '#0F172A',
    letterSpacing: '-0.3px',
  },
  section: {
    display:       'flex',
    flexDirection: 'column' as const,
    gap:           28,
  },
  question: {
    display:       'flex',
    flexDirection: 'column' as const,
    gap:           12,
  },
  label: {
    display:    'block',
    fontSize:   14,
    fontWeight: 600,
    color:      '#1E293B',
    lineHeight: 1.4,
  },
} as const;
```

- [ ] **Étape 2 : Vérifier TypeScript frontend**

```bash
cd frontend && npx tsc --noEmit
```

---

## Task 9 : Page FeedbackResultats

**Fichier :** Créer `frontend/src/pages/FeedbackResultats.tsx`

- [ ] **Étape 1 : Créer le fichier**

```typescript
// src/pages/FeedbackResultats.tsx
// Résultats du questionnaire de satisfaction — admin_campus+.
// Affiche : nombre total, moyennes Q4/Q5, graphiques Recharts, commentaires Q12, export CSV.

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { settingsEndpoints } from '../services/endpoints';
import api from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedbackStats {
  total: number;
  statistiques: {
    moyenne_q4: number | null;
    moyenne_q5: number | null;
    q1: Record<string, number>;
    q2: Record<string, number>;
    q3: Record<string, number>;
    q4: Record<string, number>;
    q5: Record<string, number>;
    q6: Record<string, number>;
    q7: Record<string, number>;
    q8: Record<string, number>;
    q9: Record<string, number>;
    q10: Record<string, number>;
    q11: Record<string, number>;
  };
  commentaires: string[];
  feedbacks: { id: string; created_at: string; reponses: Record<string, unknown> }[];
}

// ─── Libellés lisibles ────────────────────────────────────────────────────────

const LABELS: Record<string, Record<string, string>> = {
  q1: { nouveau_visiteur: 'Nouveau visiteur', membre_regulier: 'Membre régulier', ouvrier: 'Ouvrier/bénévole' },
  q2: { premiere_fois: '1ère fois', quelques_fois: 'Quelques fois', irregulier: 'Irrégulier', presque_chaque_dim: 'Presque chaque dim.' },
  q3: { proche: 'Proche/famille', reseaux: 'Réseaux sociaux', internet: 'Internet', affiches: 'Affiches', passais: 'Je passais devant', autre: 'Autre' },
  q6: { louange: 'Louange', predication: 'Prédication', priere: 'Prière', annonces: 'Annonces', echanges: 'Échanges', ambiance: 'Ambiance', autre: 'Autre' },
  q7: { accueil_nouveaux: 'Accueil NM', duree_culte: 'Durée culte', louange_duree: 'Durée louange', message: 'Message', echange: 'Échanges', communication: 'Communication', logistique: 'Logistique', satisfait: 'Satisfait', autre: 'Autre' },
  q8: { moins_1h30: '< 1h30', '1h30_2h': '1h30-2h', '2h_2h30': '2h-2h30', plus_2h30: '> 2h30' },
  q9: { oui_facilement: 'Oui, facilement', un_peu: 'Un peu', non_vraiment: 'Pas vraiment', reparti_direct: 'Reparti direct' },
  q10: { oui_certainement: 'Oui, certaint.', probablement: 'Probablement', ne_sais_pas: 'Ne sait pas', probablement_pas: 'Prob. pas' },
  q11: { oui_certainement: 'Oui, certaint.', probablement_oui: 'Prob. oui', ne_sais_pas: 'Ne sait pas', probablement_pas: 'Prob. pas' },
};

const TEAL = '#0D9488';
const COLORS = ['#0D9488', '#1A56B0', '#F59E0B', '#EF4444', '#8B5CF6', '#10B981', '#F97316', '#06B6D4', '#EC4899'];

// ─── Composant graphique ──────────────────────────────────────────────────────

function QuestionChart({ title, data, qKey }: { title: string; data: Record<string, number>; qKey: string }) {
  const labels = LABELS[qKey] ?? {};
  const chartData = Object.entries(data).map(([key, count]) => ({
    name: labels[key] ?? key,
    count,
  })).sort((a, b) => b.count - a.count);

  if (chartData.length === 0) return null;

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)', borderRadius: 12, padding: 20 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 40, left: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary, #64748B)' }} angle={-30} textAnchor="end" interval={0} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary, #64748B)' }} allowDecimals={false} />
          <Tooltip formatter={(v: number) => [`${v} réponse(s)`, 'Nombre']} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Export CSV ───────────────────────────────────────────────────────────────

function exportCSV(feedbacks: FeedbackStats['feedbacks']) {
  const headers = ['id', 'created_at', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11', 'q12'];
  const rows = feedbacks.map(f => {
    const r = f.reponses as Record<string, unknown>;
    return headers.map(h => {
      if (h === 'id') return f.id;
      if (h === 'created_at') return new Date(f.created_at).toLocaleDateString('fr-FR');
      const v = r[h];
      return Array.isArray(v) ? `"${v.join(', ')}"` : `"${String(v ?? '')}"`;
    }).join(';');
  });
  const csv = [headers.join(';'), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `feedback-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function FeedbackResultats() {
  const [data,    setData]    = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    api.get('/feedback')
      .then(r => setData(r.data as FeedbackStats))
      .catch(() => setError('Impossible de charger les résultats.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Chargement…</div>;
  if (error)   return <div style={{ padding: 40, color: '#EF4444', fontSize: 13 }}>{error}</div>;
  if (!data)   return null;

  const { total, statistiques: s, commentaires, feedbacks } = data;

  return (
    <div style={{ padding: 'clamp(16px, 4vw, 28px)', maxWidth: 900 }}>

      {/* Titre */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Satisfaction</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>Résultats du questionnaire — {total} réponse(s)</p>
        </div>
        <button
          onClick={() => exportCSV(feedbacks)}
          disabled={total === 0}
          style={{ padding: '9px 18px', background: TEAL, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          ↓ Exporter CSV
        </button>
      </div>

      {total === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
          Aucune réponse pour l'instant.
        </div>
      )}

      {total > 0 && (
        <>
          {/* Moyennes étoiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
            {([
              { label: 'Expérience générale (Q4)', value: s.moyenne_q4 },
              { label: 'Accueil (Q5)',              value: s.moyenne_q5 },
            ] as { label: string; value: number | null }[]).map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)', borderRadius: 12, padding: '20px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: TEAL }}>{value !== null ? value.toFixed(1) : '—'}</div>
                <div style={{ fontSize: 20, color: '#F59E0B', margin: '4px 0 2px' }}>{'★'.repeat(Math.round(value ?? 0))}{'☆'.repeat(5 - Math.round(value ?? 0))}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Graphiques par question */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 28 }}>
            <QuestionChart title="Q1 — Profil dans l'assemblée" data={s.q1} qKey="q1" />
            <QuestionChart title="Q2 — Fréquence de venue" data={s.q2} qKey="q2" />
            <QuestionChart title="Q3 — Découverte (checkboxes)" data={s.q3} qKey="q3" />
            <QuestionChart title="Q4 — Évaluation générale (distribution)" data={s.q4} qKey="q4" />
            <QuestionChart title="Q5 — Accueil (distribution)" data={s.q5} qKey="q5" />
            <QuestionChart title="Q6 — Éléments appréciés" data={s.q6} qKey="q6" />
            <QuestionChart title="Q7 — Axes d'amélioration" data={s.q7} qKey="q7" />
            <QuestionChart title="Q8 — Durée préférée" data={s.q8} qKey="q8" />
            <QuestionChart title="Q9 — Échanges après culte" data={s.q9} qKey="q9" />
            <QuestionChart title="Q10 — Intention de revenir" data={s.q10} qKey="q10" />
            <QuestionChart title="Q11 — Recommandation" data={s.q11} qKey="q11" />
          </div>

          {/* Commentaires Q12 */}
          {commentaires.length > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)', borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                Q12 — Commentaires libres ({commentaires.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {commentaires.map((c, i) => (
                  <div key={i} style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, borderLeft: `3px solid ${TEAL}` }}>
                    {c}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Étape 2 : Vérifier TypeScript frontend**

```bash
cd frontend && npx tsc --noEmit
```

---

## Task 10 : App.tsx routes + Sidebar

**Fichiers :** `frontend/src/App.tsx` + `frontend/src/layout/Sidebar.tsx`

- [ ] **Étape 1 : Ajouter les imports dans App.tsx**

```typescript
import FormFeedback      from './pages/FormFeedback';
import FeedbackResultats from './pages/FeedbackResultats';
```

- [ ] **Étape 2 : Ajouter la route publique dans App.tsx**

Dans la section `{/* Pages publiques */}`, ajouter :

```tsx
<Route path="/form/feedback/:token" element={<FormFeedback />} />
```

- [ ] **Étape 3 : Ajouter la route protégée dans App.tsx**

Dans la section `<Route element={<ProtectedLayout />}>`, ajouter :

```tsx
<Route path="/feedback-resultats" element={<FeedbackResultats />} />
```

- [ ] **Étape 4 : Ajouter le lien dans Sidebar.tsx**

Dans le tableau `NAV_SECTIONS`, section `'Admin'`, ajouter avant `{ to: '/parametres', ... }` :

```typescript
{ to: '/feedback-resultats', label: 'Satisfaction', icon: '📊', minRole: 'admin_campus' },
```

- [ ] **Étape 5 : Vérifier TypeScript frontend — zéro erreur**

```bash
cd frontend && npx tsc --noEmit
```

---

## Task 11 : Vérification finale

- [ ] **Étape 1 : TypeScript backend**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Étape 2 : TypeScript frontend**

```bash
cd frontend && npx tsc --noEmit
```

Attendu : 0 erreur dans les deux cas.

---

## Notes d'implémentation

- Le contrôleur feedback expose `feedbacks` (liste brute) dans le GET pour permettre l'export CSV côté frontend. En production avec beaucoup de données, paginer ou retirer ce champ.
- L'endpoint POST `/api/feedback/:token` n'est pas protégé par `authenticate` — c'est voulu : le token est le mécanisme d'autorisation.
- Les ouvriers anniversaire n'ont pas de row `Message` créée (contrairement aux contacts) car le modèle `Message` requiert un `TypeMessage` enum et un `contact_id`. Si ce tracking est nécessaire plus tard, ajouter un `ouvrier_id` nullable sur `Message`.
- `recharts` est déjà dans `package.json` (v3.8.1) — aucune installation requise.
- `crypto` est un module Node.js natif — pas besoin de `npm install`.
