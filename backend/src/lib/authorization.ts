import prisma from './prisma';

type UserContext = { id: string; role: string; campus: string[] };

// Vrai si l'utilisateur n'a pas le droit d'agir sur ce campus.
// Un super_admin passe partout ; tout autre rôle est limité à son user.campus[].
// `campusCible` null/undefined signifie « tous les campus » : hors périmètre pour
// quiconque n'est pas super_admin.
export function horsPerimetreCampus(user: UserContext, campusCible: string | null | undefined): boolean {
  if (user.role === 'super_admin') return false;
  if (!campusCible) return true;
  return !user.campus.includes(campusCible);
}

// Détermine le campus sur lequel une action d'envoi va réellement porter, en le
// contraignant au périmètre de l'appelant.
//
//   - super_admin                            → le campus demandé, ou null (tous campus)
//   - campus demandé dans le périmètre       → ce campus
//   - campus demandé hors périmètre          → refus
//   - aucun campus demandé, périmètre à 1    → ce campus, implicitement
//   - aucun campus demandé, périmètre à 2+   → refus, l'appelant doit choisir
//
// Le dernier cas est volontairement un refus plutôt qu'un ciblage multi-campus : le
// campus retenu est stocké sur l'événement et sert ensuite à autoriser sa modification
// et son envoi (y compris différé par le cron, qui n'a plus de contexte utilisateur).
// Un événement sans campus ne serait plus gérable par son propre créateur.
export function resoudreCampusCible(
  user: UserContext,
  campusDemande: string | null | undefined
):
  | { ok: true; campus: string | null }
  | { ok: false; message: string } {
  if (user.role === 'super_admin') {
    return { ok: true, campus: campusDemande ?? null };
  }
  if (campusDemande) {
    return user.campus.includes(campusDemande)
      ? { ok: true, campus: campusDemande }
      : { ok: false, message: 'Campus hors de votre périmètre' };
  }
  if (user.campus.length === 1) {
    return { ok: true, campus: user.campus[0]! };
  }
  return {
    ok: false,
    message: 'Précisez le campus concerné (votre compte couvre plusieurs campus)',
  };
}

export async function peutAccederContact(user: UserContext, contactId: string): Promise<boolean> {
  if (user.role === 'super_admin') return true;

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { campus: true, referent_eglise_id: true },
  });
  if (!contact) return false;

  // referent_integration : accès à tout le campus, pas seulement ses contacts
  // assignés — un référent peut consulter/commenter le contact d'un collègue
  // pour l'aider. La page « Contacts » restreint ensuite l'affichage à « mes
  // contacts » par défaut (cf. listContacts), mais l'accès direct reste ouvert
  // à tout le campus.
  if (
    user.role === 'admin_campus' ||
    user.role === 'referent_integration' ||
    user.role === 'lecteur'
  ) {
    return user.campus.includes(contact.campus);
  }

  if (user.role === 'referent_eglise') {
    return contact.referent_eglise_id === user.id && user.campus.includes(contact.campus);
  }

  return false;
}

export function filtreContactsParRole(user: UserContext): object {
  if (user.role === 'super_admin') return {};

  if (
    user.role === 'admin_campus' ||
    user.role === 'referent_integration' ||
    user.role === 'lecteur'
  ) {
    return { campus: { in: user.campus } };
  }

  if (user.role === 'referent_eglise') {
    return { referent_eglise_id: user.id, campus: { in: user.campus } };
  }

  return { id: 'impossible' };
}
