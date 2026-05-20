// unit/phone.test.ts
// Teste la validation du format téléphonique E.164.
// E.164 : + suivi de 1 à 15 chiffres (pas de zéro leading, pas d'espaces).
// C'est la clé d'unicité principale dans la table Contact — une validation
// stricte ici évite les doublons silencieux (+33612345678 vs 0612345678).

// Regex de validation utilisée dans contacts.controller.ts
const E164_REGEX = /^\+[1-9]\d{6,14}$/;

describe('Validation téléphone E.164', () => {
  describe('Numéros valides', () => {
    it('devrait valider un numéro français (+33)', () => {
      expect(E164_REGEX.test('+33612345678')).toBe(true);
    });

    it('devrait valider un numéro belge (+32)', () => {
      expect(E164_REGEX.test('+32498123456')).toBe(true);
    });

    it('devrait valider un numéro congolais (+243)', () => {
      expect(E164_REGEX.test('+243812345678')).toBe(true);
    });

    it('devrait valider un numéro avec exactement 7 chiffres après le +', () => {
      // +33 + 12345 = 7 chiffres au total → satisfait \d{6,14}
      expect(E164_REGEX.test('+3312345')).toBe(true);
    });

    it('devrait valider un numéro avec 15 chiffres au total', () => {
      expect(E164_REGEX.test('+123456789012345')).toBe(true); // max valide
    });
  });

  describe('Numéros invalides', () => {
    it('devrait rejeter un numéro sans préfixe + (format national)', () => {
      expect(E164_REGEX.test('0612345678')).toBe(false);
    });

    it('devrait rejeter un numéro trop court', () => {
      expect(E164_REGEX.test('+331234')).toBe(false);
    });

    it('devrait rejeter un numéro trop long (> 15 chiffres)', () => {
      expect(E164_REGEX.test('+1234567890123456')).toBe(false);
    });

    it('devrait rejeter un numéro avec espaces', () => {
      expect(E164_REGEX.test('+33 6 12 34 56 78')).toBe(false);
    });

    it('devrait rejeter une chaîne vide', () => {
      expect(E164_REGEX.test('')).toBe(false);
    });

    it('devrait rejeter +0 (zéro leading interdit)', () => {
      expect(E164_REGEX.test('+0612345678')).toBe(false);
    });

    it('devrait rejeter un numéro avec tirets', () => {
      expect(E164_REGEX.test('+33-6-12-34-56-78')).toBe(false);
    });
  });
});
