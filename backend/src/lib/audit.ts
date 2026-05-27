// src/lib/audit.ts
// Helper centralisé pour enregistrer les actions dans l'AuditLog.
// Toutes les erreurs sont swallowées - un échec de log ne doit jamais faire échouer
// l'action métier qui l'a déclenché.

import prisma from './prisma';

export type AuditAction =
  | 'creation'
  | 'modification'
  | 'suppression'
  | 'changement_statut'
  | 'assignation_referent'
  | 'checklist_cochee';

export async function logAudit(params: {
  entite: string;
  entite_id: string;
  action: AuditAction;
  champ?: string;
  ancienne_valeur?: string;
  nouvelle_valeur?: string;
  description: string;
  auteur_id: string;
}): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.auditLog as any).create({ data: params }).catch((err: unknown) => {
    console.error('[AUDIT] Erreur création log:', err);
  });
}
