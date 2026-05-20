// unit/profil.test.ts
// Teste la fonction determinerProfil() — logique métier centrale de classification.
// Le profil est calculé automatiquement à la création et mise à jour d'un contact
// selon deux critères : statut_phila (est-il membre ?) et autre_eglise (va-t-il ailleurs ?).
//
// Matrice de décision :
//   statut_phila = 'oui'               → membre_phila
//   statut_phila ≠ 'oui' + autre_eglise → visiteur_avec_eglise
//   sinon                              → visiteur_sans_eglise

import { determinerProfil } from '../../controllers/contacts.controller';

describe('determinerProfil — Logique de classification', () => {
  describe('Membre Phila', () => {
    it('devrait retourner membre_phila si statut_phila = "oui"', () => {
      expect(determinerProfil('oui', false)).toBe('membre_phila');
    });

    it('devrait retourner membre_phila même si autre_eglise = true (membre prioritaire)', () => {
      expect(determinerProfil('oui', true)).toBe('membre_phila');
    });
  });

  describe('Visiteur avec église', () => {
    it('devrait retourner visiteur_avec_eglise si statut_phila = "non" et autre_eglise = true', () => {
      expect(determinerProfil('non', true)).toBe('visiteur_avec_eglise');
    });

    it('devrait retourner visiteur_avec_eglise si premiere_visite et autre_eglise = true', () => {
      expect(determinerProfil('premiere_visite', true)).toBe('visiteur_avec_eglise');
    });
  });

  describe('Visiteur sans église', () => {
    it('devrait retourner visiteur_sans_eglise si statut_phila = "non" et autre_eglise = false', () => {
      expect(determinerProfil('non', false)).toBe('visiteur_sans_eglise');
    });

    it('devrait retourner visiteur_sans_eglise pour premiere_visite sans eglise', () => {
      expect(determinerProfil('premiere_visite', false)).toBe('visiteur_sans_eglise');
    });

    it('devrait retourner visiteur_sans_eglise si statut_phila undefined', () => {
      expect(determinerProfil(undefined, false)).toBe('visiteur_sans_eglise');
    });

    it('devrait retourner visiteur_sans_eglise si autre_eglise = null', () => {
      expect(determinerProfil('non', null)).toBe('visiteur_sans_eglise');
    });
  });
});
