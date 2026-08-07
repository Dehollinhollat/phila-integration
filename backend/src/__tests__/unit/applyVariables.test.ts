// applyVariables.test.ts
// [Campus] etait documente comme disponible pour le message de bienvenue
// (voir Settings.tsx) mais jamais renseigne par les deux appelants reels
// (cron.ts Tache 1, sendBienvenue) — restait donc toujours vide. Corrige en
// passant contact.campus aux deux endroits.

import { applyVariables, buildBienvenueMessage } from '../../controllers/messages.controller';

describe('applyVariables - [Campus]', () => {
  it('substitue [Campus] quand la valeur est fournie', () => {
    const result = applyVariables('Bienvenue au campus [Campus] !', { campus: 'orleans' });
    expect(result).toBe('Bienvenue au campus orleans !');
  });

  it('substitue par une chaine vide si campus non fourni (comportement par defaut inchange)', () => {
    const result = applyVariables('Bienvenue au campus [Campus] !', {});
    expect(result).toBe('Bienvenue au campus  !');
  });
});

describe('buildBienvenueMessage - transmet bien le campus a applyVariables', () => {
  it('remplace [Campus] dans un template personnalise', () => {
    const message = buildBienvenueMessage(
      'Marie',
      { prenom: 'Jean', nom: 'Dupont', telephone: '+33600000000' },
      '+33100000000',
      'Bonjour [Prenom], bienvenue au campus [Campus] !',
      '1 rue Exemple',
      'paris_nord',
    );
    expect(message).toBe('Bonjour Marie, bienvenue au campus paris_nord !');
  });
});
