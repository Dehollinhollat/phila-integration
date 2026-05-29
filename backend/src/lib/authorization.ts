import prisma from './prisma';

type UserContext = { id: string; role: string; campus: string[] };

export async function peutAccederContact(user: UserContext, contactId: string): Promise<boolean> {
  if (user.role === 'super_admin') return true;

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { campus: true, referent_eglise_id: true },
  });
  if (!contact) return false;

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
