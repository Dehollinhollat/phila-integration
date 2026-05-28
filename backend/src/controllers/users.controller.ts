// src/controllers/users.controller.ts
// Gestion des comptes utilisateurs.
// Deux groupes de routes :
//   /me  — tout utilisateur authentifié (profil propre)
//   /    — super_admin uniquement (gestion des comptes)

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { sendWelcomeEmail } from '../lib/email';
import { logAudit } from '../lib/audit';

// Alphabet sans caractères ambigus (0/O, 1/l/I) pour faciliter la saisie manuelle.
// crypto.randomBytes garantit du vrai aléatoire cryptographique (CSPRNG).
const PASSWD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

function genererMotDePasseProvisoire(): string {
  const random = Array.from(crypto.randomBytes(8))
    .map(b => PASSWD_CHARS[b % PASSWD_CHARS.length])
    .join('');
  return `Phila${random}!`;
}

const USER_SELECT = {
  id: true, prenom: true, nom: true, email: true,
  role: true, campus: true, actif: true, created_at: true, onboarding_complete: true,
  telephone: true,
} as const;

// ─── Routes /me ───────────────────────────────────────────────────────────────

// GET /api/users/me
export async function getMyProfile(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: USER_SELECT,
  });
  if (!user) { res.status(404).json({ message: 'Utilisateur introuvable' }); return; }
  res.json(user);
}

// PUT /api/users/me — modifie prénom, nom et téléphone WhatsApp
export async function updateMyProfile(req: Request, res: Response): Promise<void> {
  const { prenom, nom, telephone } = req.body as { prenom?: string; nom?: string; telephone?: string };
  const data: Record<string, unknown> = {};
  if (prenom?.trim())          data.prenom    = prenom.trim();
  if (nom?.trim())             data.nom       = nom.trim();
  if (telephone !== undefined) data.telephone = telephone?.trim() || null;

  if (Object.keys(data).length === 0) {
    res.status(400).json({ message: 'Aucune donnée à mettre à jour' });
    return;
  }

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data,
    select: USER_SELECT,
  });
  res.json(user);
}

// PATCH /api/users/me/password — vérifie l'ancien mot de passe avant de changer
export async function changeMyPassword(req: Request, res: Response): Promise<void> {
  const { current_password, new_password } = req.body as {
    current_password: string;
    new_password:     string;
  };

  if (!current_password || !new_password) {
    res.status(400).json({ message: 'Tous les champs sont requis' });
    return;
  }
  if (new_password.length < 8) {
    res.status(400).json({ message: 'Le nouveau mot de passe doit contenir au moins 8 caractères' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) { res.status(404).json({ message: 'Utilisateur introuvable' }); return; }

  const valid = await bcrypt.compare(current_password, user.password);
  if (!valid) {
    res.status(401).json({ message: 'Mot de passe actuel incorrect' });
    return;
  }

  const hashed = await bcrypt.hash(new_password, 12);
  await prisma.user.update({ where: { id: req.user!.id }, data: { password: hashed } });
  res.json({ message: 'Mot de passe modifié avec succès' });
}

// GET /api/users
export async function listUsers(req: Request, res: Response): Promise<void> {
  const { campus, role } = req.query;
  const where: Record<string, unknown> = {};

  if (req.user!.role === 'admin_campus') {
    // Un admin_campus ne voit que les utilisateurs de ses campus
    where.campus = { hasSome: req.user!.campus };
  } else {
    if (campus) where.campus = { hasSome: [campus as string] };
  }
  if (role) where.role = role;

  const users = await prisma.user.findMany({
    where,
    select: USER_SELECT,
    orderBy: [{ actif: 'desc' }, { nom: 'asc' }],
  });
  res.json(users);
}

// GET /api/users/check-email?email=x&excludeId=y
export async function checkEmail(req: Request, res: Response): Promise<void> {
  const { email, excludeId } = req.query;
  if (!email) {
    res.status(400).json({ message: 'Email requis' });
    return;
  }
  const where: Record<string, unknown> = { email: email as string };
  if (excludeId) where.id = { not: excludeId as string };
  const existing = await prisma.user.findFirst({ where, select: { id: true } });
  res.json({ available: !existing });
}

// POST /api/users
// Le mot de passe n'est PAS fourni par le frontend — il est généré côté serveur.
// Le plaintext ne vit que dans cette stack frame ; seul le hash est persisté.
export async function createUser(req: Request, res: Response): Promise<void> {
  const { prenom, nom, email, role, campus } = req.body as {
    prenom: string; nom: string; email: string;
    role: string; campus?: string[];
  };

  if (!prenom || !nom || !email || !role) {
    res.status(400).json({ message: 'Champs obligatoires manquants' });
    return;
  }

  // Un admin_campus ne peut pas créer un super_admin
  if (req.user!.role === 'admin_campus' && role === 'super_admin') {
    res.status(403).json({ message: 'Non autorisé à créer un Super Administrateur' });
    return;
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    res.status(409).json({ message: 'Un compte existe déjà avec cet email' });
    return;
  }

  const motDePasseProvisoire = genererMotDePasseProvisoire();
  const hashed = await bcrypt.hash(motDePasseProvisoire, 12);

  const user = await prisma.user.create({
    data: { prenom, nom, email, password: hashed, role: role as never, campus: (campus ?? []) as never },
    select: USER_SELECT,
  });

  // Envoi de l'email de bienvenue — non bloquant : une erreur d'email ne fait pas
  // échouer la création du compte (le compte existe déjà en base à ce stade).
  await sendWelcomeEmail(user.email, user.prenom, user.role, motDePasseProvisoire).catch(err => {
    console.error('[USERS][CREATE] Erreur envoi email bienvenue:', err);
  });

  res.status(201).json({ ...user, email_bienvenue_envoye: true });
}

// PUT /api/users/:id
export async function updateUser(req: Request, res: Response): Promise<void> {
  const id = req.params['id'] as string;
  const { prenom, nom, email, role, campus, actif } = req.body as {
    prenom?: string; nom?: string; email?: string;
    role?: string; campus?: string[]; actif?: boolean;
  };

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

  if (email) {
    const conflict = await prisma.user.findFirst({ where: { email, id: { not: id } } });
    if (conflict) {
      res.status(409).json({ message: 'Cet email est déjà utilisé' });
      return;
    }
  }

  const data: Record<string, unknown> = {};
  if (prenom  !== undefined) data.prenom  = prenom;
  if (nom     !== undefined) data.nom     = nom;
  if (email   !== undefined) data.email   = email;
  if (role    !== undefined) data.role    = role;
  if (campus  !== undefined) data.campus  = campus;
  if (actif   !== undefined) data.actif   = actif;

  const user = await prisma.user.update({ where: { id }, data, select: USER_SELECT });

  await logAudit({
    entite: 'user', entite_id: id,
    action: 'modification',
    description: `Compte utilisateur modifié : ${user.prenom} ${user.nom}`,
    auteur_id: req.user!.id,
  });

  res.json(user);
}

// PATCH /api/users/:id/statut
export async function toggleStatut(req: Request, res: Response): Promise<void> {
  const id = req.params['id'] as string;

  if (id === req.user!.id) {
    res.status(400).json({ message: 'Impossible de modifier son propre statut' });
    return;
  }

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

  const user = await prisma.user.update({
    where: { id },
    data:  { actif: !current.actif },
    select: USER_SELECT,
  });
  res.json(user);
}

// DELETE /api/users/:id — suppression définitive (super_admin uniquement)
// Refuse si l'utilisateur a des contacts assignés — réassignation requise d'abord.
export async function deleteUser(req: Request, res: Response): Promise<void> {
  const id = req.params['id'] as string;

  // Seul super_admin peut supprimer (double vérification — la route est déjà protégée)
  if (req.user!.role !== 'super_admin') {
    res.status(403).json({ message: 'Non autorisé' });
    return;
  }

  if (id === req.user!.id) {
    res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte' });
    return;
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, prenom: true, nom: true } });
  if (!target) {
    res.status(404).json({ message: 'Utilisateur introuvable' });
    return;
  }

  if (target.role === 'super_admin') {
    res.status(403).json({ message: 'Impossible de supprimer un Super Administrateur' });
    return;
  }

  // Vérifier les contacts assignés avant toute suppression
  const [
    contactsIntegration,
    contactsEglise,
    nbCommentaires,
    nbHistorique,
    nbPlannings,
    nbEvenements,
  ] = await Promise.all([
    prisma.contact.count({ where: { referent_integration_id: id } }),
    prisma.contact.count({ where: { referent_eglise_id: id } }),
    prisma.commentaire.count({ where: { auteur_id: id } }),
    prisma.historiqueStatut.count({ where: { change_par_id: id } }),
    prisma.planningService.count({ where: { created_by: id } }),
    prisma.evenement.count({ where: { created_by: id } }),
  ]);
  const totalContacts = contactsIntegration + contactsEglise;

  if (totalContacts > 0) {
    res.status(409).json({
      message: `Cet utilisateur a ${totalContacts} contact(s) assigné(s). Réassignez-les avant de supprimer ce compte.`,
      contacts_integration: contactsIntegration,
      contacts_eglise:      contactsEglise,
    });
    return;
  }

  // Ces données ont des FK non-nullables sans cascade — la suppression échouerait sans ce contrôle
  const blockers: string[] = [];
  if (nbCommentaires > 0)  blockers.push(`${nbCommentaires} commentaire(s)`);
  if (nbHistorique > 0)    blockers.push(`${nbHistorique} entrée(s) d'historique`);
  if (nbPlannings > 0)     blockers.push(`${nbPlannings} planning(s) créé(s)`);
  if (nbEvenements > 0)    blockers.push(`${nbEvenements} événement(s) créé(s)`);

  if (blockers.length > 0) {
    res.status(409).json({
      message: `Impossible de supprimer ce compte : ${blockers.join(', ')} lui sont rattaché(s). Transférez ou supprimez ces données d'abord.`,
      contacts_integration: 0,
      contacts_eglise:      0,
    });
    return;
  }

  // Supprimer les données liées dont le FK est non-nullable (pas de cascade dans le schéma).
  // Les RefreshToken / PasswordResetToken ont onDelete: Cascade et sont supprimés automatiquement,
  // mais on le fait explicitement ici pour invalider les sessions avant la suppression.
  await prisma.notification.deleteMany({ where: { user_id: id } });
  await prisma.refreshToken.deleteMany({ where: { user_id: id } });
  await prisma.passwordResetToken.deleteMany({ where: { user_id: id } });

  await prisma.user.delete({ where: { id } });

  await logAudit({
    entite: 'user', entite_id: id,
    action: 'suppression',
    description: `Compte utilisateur supprimé : ${target.prenom} ${target.nom}`,
    auteur_id: req.user!.id,
  });

  res.json({ message: `Compte de ${target.prenom} ${target.nom} supprimé avec succès` });
}

// PATCH /api/users/me/onboarding — marque le guide comme vu
export async function completeOnboarding(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data:  { onboarding_complete: true },
    select: USER_SELECT,
  });
  res.json(user);
}

// GET /api/users/:id/connexions — historique des connexions (super_admin uniquement)
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
