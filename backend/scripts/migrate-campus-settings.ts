// scripts/migrate-campus-settings.ts
// Migration one-shot : copie les 9 clés de messagerie de Settings (global) vers
// CampusSettings (par campus), pour les 4 campus. Paris et Paris Nord repartent de
// la valeur globale actuelle (rien ne change pour eux) ; Orléans et Montpellier
// démarrent avec la même copie, à adapter par leur admin. Supprime ensuite les
// lignes Settings devenues obsolètes.
//
// Rejouable sans danger : n'écrase pas une ligne CampusSettings déjà migrée.
//
// Usage : npx tsx scripts/migrate-campus-settings.ts

import prisma from '../src/lib/prisma';
import { CAMPUS_SETTINGS_KEYS, DEFAULT_CAMPUS_SETTINGS } from '../src/lib/campusSettings';

const CAMPUSES = ['paris', 'paris_nord', 'orleans', 'montpellier'] as const;

async function main() {
  const existing = await prisma.settings.findMany({
    where: { key: { in: CAMPUS_SETTINGS_KEYS as unknown as string[] } },
  });
  const currentValues: Record<string, string> = {};
  for (const row of existing) currentValues[row.key] = row.value;

  let upserted = 0;
  for (const key of CAMPUS_SETTINGS_KEYS) {
    const value = currentValues[key] ?? DEFAULT_CAMPUS_SETTINGS[key];
    for (const campus of CAMPUSES) {
      await prisma.campusSettings.upsert({
        where:  { campus_key: { campus, key } },
        update: {},                          // ne pas écraser si déjà migré
        create: { campus, key, value },
      });
      upserted++;
    }
  }
  console.log(`[migrate-campus-settings] ${upserted} ligne(s) CampusSettings créée(s)/vérifiée(s).`);

  const deleted = await prisma.settings.deleteMany({
    where: { key: { in: CAMPUS_SETTINGS_KEYS as unknown as string[] } },
  });
  console.log(`[migrate-campus-settings] ${deleted.count} ancienne(s) ligne(s) Settings supprimée(s).`);
}

main()
  .catch(err => { console.error('[migrate-campus-settings] Erreur :', err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
