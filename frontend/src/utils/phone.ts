// src/utils/phone.ts
// Validation et normalisation des numéros de téléphone en format E.164.
// Utilisé par FormPresentiel, FormEnLigne, FormOuvrier (préfixe + numéro local)
// et ContactForm (numéro E.164 complet).

// Longueurs attendues des chiffres abonnés par indicatif (sans le 0 initial)
const PHONE_LENGTHS: Record<string, { min: number; max: number }> = {
  '+1':   { min: 10, max: 10 }, // USA / Canada
  '+7':   { min: 10, max: 10 }, // Russie
  '+30':  { min: 10, max: 10 }, // Grèce
  '+31':  { min: 9,  max: 9  }, // Pays-Bas
  '+32':  { min: 8,  max: 9  }, // Belgique
  '+33':  { min: 9,  max: 9  }, // France
  '+34':  { min: 9,  max: 9  }, // Espagne
  '+36':  { min: 8,  max: 9  }, // Hongrie
  '+39':  { min: 9,  max: 11 }, // Italie
  '+40':  { min: 9,  max: 9  }, // Roumanie
  '+41':  { min: 9,  max: 9  }, // Suisse
  '+43':  { min: 7,  max: 13 }, // Autriche
  '+44':  { min: 10, max: 10 }, // Royaume-Uni
  '+45':  { min: 8,  max: 8  }, // Danemark
  '+46':  { min: 7,  max: 9  }, // Suède
  '+47':  { min: 8,  max: 8  }, // Norvège
  '+48':  { min: 9,  max: 9  }, // Pologne
  '+49':  { min: 7,  max: 12 }, // Allemagne
  '+212': { min: 9,  max: 9  }, // Maroc
  '+213': { min: 9,  max: 9  }, // Algérie
  '+216': { min: 8,  max: 8  }, // Tunisie
  '+221': { min: 9,  max: 9  }, // Sénégal
  '+223': { min: 8,  max: 8  }, // Mali
  '+224': { min: 9,  max: 9  }, // Guinée
  '+225': { min: 10, max: 10 }, // Côte d'Ivoire
  '+226': { min: 8,  max: 8  }, // Burkina Faso
  '+228': { min: 8,  max: 8  }, // Togo
  '+229': { min: 8,  max: 8  }, // Bénin
  '+235': { min: 8,  max: 8  }, // Tchad
  '+236': { min: 8,  max: 8  }, // Centrafrique
  '+237': { min: 9,  max: 9  }, // Cameroun
  '+241': { min: 7,  max: 8  }, // Gabon
  '+242': { min: 9,  max: 9  }, // Congo Brazzaville
  '+243': { min: 9,  max: 9  }, // RD Congo
  '+351': { min: 9,  max: 9  }, // Portugal
  '+352': { min: 9,  max: 11 }, // Luxembourg
  '+353': { min: 9,  max: 9  }, // Irlande
  '+370': { min: 8,  max: 8  }, // Lituanie
  '+371': { min: 8,  max: 8  }, // Lettonie
  '+372': { min: 7,  max: 8  }, // Estonie
  '+380': { min: 9,  max: 9  }, // Ukraine
  '+381': { min: 8,  max: 9  }, // Serbie
  '+385': { min: 8,  max: 9  }, // Croatie
  '+509': { min: 8,  max: 8  }, // Haïti
  '+590': { min: 9,  max: 9  }, // Guadeloupe
  '+594': { min: 9,  max: 9  }, // Guyane
  '+596': { min: 9,  max: 9  }, // Martinique
};

function stripFormatting(raw: string): string {
  return raw.replace(/[\s\-\.]/g, '');
}

function toSubscriberDigits(stripped: string): string {
  return stripped.startsWith('0') ? stripped.slice(1) : stripped;
}

// Normalise préfixe + numéro local en E.164 (ex: "+33", "0612345678" → "+33612345678")
export function normalizePhone(prefix: string, raw: string): string {
  return `${prefix}${toSubscriberDigits(stripFormatting(raw))}`;
}

// Valide le numéro local saisi avec son indicatif.
// Retourne null si valide, sinon un message d'erreur localisé.
export function validatePhone(prefix: string, raw: string): string | null {
  if (!raw.trim()) return 'Le numéro de téléphone est obligatoire.';

  const stripped = stripFormatting(raw);
  if (!/^\d+$/.test(stripped)) return 'Le numéro ne doit contenir que des chiffres.';

  const digits = toSubscriberDigits(stripped);
  const { min, max } = PHONE_LENGTHS[prefix] ?? { min: 6, max: 12 };

  if (digits.length < min || digits.length > max) {
    const expected = min === max ? `${min}` : `${min} à ${max}`;
    return `Numéro invalide pour cet indicatif (${expected} chiffres attendus, ${digits.length} saisi${digits.length > 1 ? 's' : ''}).`;
  }

  return null;
}

// Valide un numéro E.164 complet (utilisé dans ContactForm, admin).
// Accepte les espaces et tirets (ex: "+33 6 12 34 56 78").
export function validateFullPhone(value: string): string | null {
  if (!value.trim()) return 'Le numéro de téléphone est obligatoire.';
  const cleaned = stripFormatting(value);
  if (!/^\+[1-9]\d{6,14}$/.test(cleaned)) {
    return 'Format invalide. Exemple : +33612345678';
  }
  return null;
}

// Normalise un numéro E.164 complet (supprime espaces et tirets).
export function normalizeFullPhone(value: string): string {
  return stripFormatting(value);
}
