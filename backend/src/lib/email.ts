// src/lib/email.ts
// Service d'envoi d'email via Resend.
// Deux fonctions exportées :
//   - sendPasswordResetEmail : lien de réinitialisation de mot de passe
//   - sendWelcomeEmail       : identifiants de connexion lors de la création de compte
//
// En mode développement (NODE_ENV === 'development'), aucun email n'est envoyé :
// les informations sont simplement affichées dans la console pour faciliter les tests
// sans nécessiter une clé RESEND_API_KEY valide ni un domaine vérifié.

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPasswordResetEmail(
  email: string,
  prenom: string,
  resetUrl: string,
): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    console.log('=================================');
    console.log('[DEV] Lien de reset mot de passe :');
    console.log(resetUrl);
    console.log('=================================');
    return;
  }

  await resend.emails.send({
    from: 'Phila Intégration <noreply@phila-integration.fr>',
    to:   email,
    subject: 'Réinitialisation de votre mot de passe — Phila Intégration',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <div style="background: #1A56B0; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="margin: 0; color: #fff; font-size: 20px; font-weight: 700;">Phila Intégration</h1>
        </div>
        <div style="padding: 32px 28px; background: #fff; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="margin: 0 0 16px; color: #1A56B0; font-size: 18px;">Réinitialisation de mot de passe</h2>
          <p style="margin: 0 0 12px; line-height: 1.6;">Bonjour ${prenom},</p>
          <p style="margin: 0 0 20px; line-height: 1.6;">Vous avez demandé la réinitialisation de votre mot de passe.</p>
          <p style="margin: 0 0 24px; line-height: 1.6;">Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien est valable <strong>1 heure</strong>.</p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${resetUrl}" style="display: inline-block; background: #1A56B0; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
              Réinitialiser mon mot de passe
            </a>
          </div>
          <p style="color: #6B7280; font-size: 13px; line-height: 1.6;">Si vous n'avez pas fait cette demande, ignorez cet email. Votre mot de passe ne sera pas modifié.</p>
          <p style="color: #6B7280; font-size: 13px; line-height: 1.6;">Pour votre sécurité, ce lien expirera dans 1 heure.</p>
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;">
          <p style="color: #9CA3AF; font-size: 12px; margin: 0;">Église Phila · Cité des Adorateurs · 8 rue Saint-Claude, 77340 Pontault-Combault</p>
        </div>
      </div>
    `,
  });
}

// ─── Email de bienvenue — envoyé à la création de compte ─────────────────────
// Le mot de passe passé ici est le mot de passe en clair AVANT hashage.
// Il ne transite que dans la mémoire du processus et n'est jamais persisté.

const ROLE_LABELS: Record<string, string> = {
  super_admin:          'Super Administrateur',
  admin_campus:         'Administrateur Campus',
  referent_eglise:      'Référent Église',
  referent_integration: 'Référent Intégration',
  lecteur:              'Lecteur',
};

export async function sendWelcomeEmail(
  email:                string,
  prenom:               string,
  role:                 string,
  motDePasseProvisoire: string,
): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    console.log('=================================');
    console.log('[DEV] Email de bienvenue :');
    console.log('Destinataire:', email);
    console.log('Mot de passe provisoire:', motDePasseProvisoire);
    console.log('=================================');
    return;
  }

  const loginUrl  = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/login`;
  const roleLabel = ROLE_LABELS[role] ?? role;

  await resend.emails.send({
    from:    'Phila Intégration <noreply@phila-integration.fr>',
    to:      email,
    subject: 'Bienvenue sur Phila Intégration — Vos identifiants de connexion',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <div style="background: #0C5E6B; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="margin: 0; color: #fff; font-size: 20px; font-weight: 700;">Phila Intégration</h1>
        </div>
        <div style="padding: 32px 28px; background: #fff; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="margin: 0 0 16px; color: #0C5E6B; font-size: 18px;">Bienvenue, ${prenom} !</h2>
          <p style="margin: 0 0 12px; line-height: 1.6;">
            Un compte a été créé pour vous sur l'application de gestion de l'église Phila Cité des Adorateurs.
          </p>
          <p style="margin: 0 0 20px; line-height: 1.6;">
            <strong>Rôle attribué :</strong> ${roleLabel}
          </p>
          <div style="background: #F3F4F6; border-radius: 10px; padding: 20px; margin: 0 0 24px; border: 1px solid #E5E7EB;">
            <p style="margin: 0 0 10px; font-weight: 700; font-size: 14px; color: #374151;">Vos identifiants de connexion :</p>
            <p style="margin: 0 0 8px; font-size: 14px; color: #374151;">
              Email : <strong>${email}</strong>
            </p>
            <p style="margin: 0; font-size: 14px; color: #374151;">
              Mot de passe provisoire :
              <strong style="color: #0C5E6B; font-size: 20px; letter-spacing: 3px; display: block; margin-top: 6px;">
                ${motDePasseProvisoire}
              </strong>
            </p>
          </div>
          <div style="text-align: center; margin: 0 0 24px;">
            <a href="${loginUrl}" style="display: inline-block; background: #0C5E6B; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
              Se connecter
            </a>
          </div>
          <p style="color: #6B7280; font-size: 13px; line-height: 1.6;">
            Pour votre sécurité, nous vous recommandons de changer ce mot de passe dès votre première connexion
            depuis la section <strong>Mon profil</strong>.
          </p>
          <p style="color: #6B7280; font-size: 13px; line-height: 1.6;">
            Si vous avez des questions, contactez votre administrateur.
          </p>
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;">
          <p style="color: #9CA3AF; font-size: 12px; margin: 0;">Église Phila · Cité des Adorateurs · 8 rue Saint-Claude, 77340 Pontault-Combault</p>
        </div>
      </div>
    `,
  });
}
