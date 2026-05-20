// k6/load-test.js
// Tests de charge k6 pour le backend Phila Intégration.
// Simule des soumissions de formulaire (scan QR code) par des utilisateurs simultanés.
//
// Scénario :
//   - Montée progressive à 50 utilisateurs simultanés (1 minute)
//   - Maintien à 100 utilisateurs (3 minutes) — charge nominale dimanche matin
//   - Descente à 0 (1 minute)
//
// Seuils :
//   - p(95) < 500ms : 95% des requêtes répondent en moins de 500ms
//   - taux d'erreur < 1% : moins de 1% de requêtes échouées (5xx)
//
// Installation k6 : https://k6.io/docs/getting-started/installation/
// Exécution : k6 run k6/load-test.js
// (Le backend doit être démarré sur localhost:4000)

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ─── Métriques personnalisées ─────────────────────────────────────────────────
const contactsCreated = new Rate('contacts_created');  // taux de créations réussies
const responseTime    = new Trend('response_time');     // distribution des temps de réponse

// ─── Configuration du test de charge ─────────────────────────────────────────
export const options = {
  stages: [
    { duration: '1m', target: 50  },  // Montée progressive à 50 VUs
    { duration: '3m', target: 100 },  // Charge nominale : 100 VUs simultanés
    { duration: '1m', target: 0   },  // Descente propre
  ],
  thresholds: {
    // SLO : 95% des requêtes sous 500ms
    http_req_duration:     ['p(95)<500'],
    // Fiabilité : moins de 1% d'erreurs HTTP 5xx
    http_req_failed:       ['rate<0.01'],
    // Taux de succès (201 = créé, 409 = doublon téléphone) : les deux sont attendus
    contacts_created:      ['rate>0.95'],
  },
};

// ─── Fonctions utilitaires ────────────────────────────────────────────────────

/** Génère un numéro de téléphone E.164 aléatoire pour éviter les doublons */
function randomPhone() {
  const suffix = Math.floor(10000000 + Math.random() * 89999999);
  return `+336${suffix}`;
}

/** Génère un payload de contact réaliste */
function buildContactPayload() {
  const genres     = ['homme', 'femme'];
  const statuts    = ['non', 'premiere_visite'];
  const etats      = ['celibataire', 'marie', 'fiance'];
  const prenoms    = ['Marie', 'Jean', 'Sophie', 'Pierre', 'Fatou', 'Kwame'];
  const noms       = ['Dupont', 'Martin', 'Bernard', 'Thomas', 'Koné'];
  const villes     = ['Paris', 'Lyon', 'Marseille', 'Orleans', 'Bordeaux'];

  return JSON.stringify({
    genre:             genres[Math.floor(Math.random() * genres.length)],
    prenom:            prenoms[Math.floor(Math.random() * prenoms.length)],
    nom:               noms[Math.floor(Math.random() * noms.length)],
    telephone:         randomPhone(),
    email:             undefined,
    ville:             villes[Math.floor(Math.random() * villes.length)],
    etat_civil:        etats[Math.floor(Math.random() * etats.length)],
    statut_phila:      statuts[Math.floor(Math.random() * statuts.length)],
    autre_eglise:      false,
    canal:             'presentiel',
    consentement_rgpd: true,
    // Token de test Turnstile — nécessite TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
    turnstile_token:   '1x0000000000000000000000000000000AA',
  });
}

// ─── Scénario principal ───────────────────────────────────────────────────────
export default function () {
  const payload = buildContactPayload();
  const params  = {
    headers: { 'Content-Type': 'application/json' },
    timeout: '10s',
  };

  const res = http.post('http://localhost:4000/api/contacts', payload, params);

  // 201 = contact créé, 409 = doublon (numéro déjà utilisé) — les deux sont normaux
  const success = check(res, {
    'statut 201 ou 409': (r) => r.status === 201 || r.status === 409,
    'temps de réponse < 500ms': (r) => r.timings.duration < 500,
    'pas d\'erreur 5xx': (r) => r.status < 500,
  });

  contactsCreated.add(success);
  responseTime.add(res.timings.duration);

  // Pause réaliste entre requêtes — simule une vraie utilisation
  sleep(1);
}

// ─── Scénario de santé API ────────────────────────────────────────────────────
// Tester aussi le health check pour séparer les pannes infra des pannes applicatives
export function healthCheck() {
  const res = http.get('http://localhost:4000/health');
  check(res, {
    'health check OK': (r) => r.status === 200 && JSON.parse(r.body).ok === true,
  });
}
