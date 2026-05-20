import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// __dirname n'existe pas en ES modules ("type": "module" dans package.json)
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Charge les credentials de test depuis .env.test (non commité)
config({ path: resolve(__dirname, '.env.test') });

// Configuration Playwright pour les tests E2E Phila Intégration.
// Les tests tournent contre le serveur de dev Vite (baseURL: localhost:5173).
// Le backend Express doit être accessible sur localhost:4000.
export default defineConfig({
  testDir: './e2e',
  // Timeout global par test (30s) — les formulaires multi-étapes prennent du temps
  timeout: 30_000,
  // Délai d'assertion par défaut
  expect: { timeout: 5_000 },
  // Rapport : HTML visible dans playwright-report/index.html après npx playwright show-report
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL:    'http://localhost:5173',
    headless:   true,
    // Capture d'écran en cas d'échec uniquement — évite de remplir le disque
    screenshot: 'only-on-failure',
    // Traces en cas d'échec pour le debug
    trace:      'on-first-retry',
    // Locale française pour les dates et messages
    locale:     'fr-FR',
  },
  projects: [
    {
      name: 'chromium',
      use:  { ...devices['Desktop Chrome'] },
    },
  ],
  // Démarre automatiquement le backend et le frontend si pas déjà lancés.
  // reuseExistingServer: true → réutilise un serveur déjà démarré manuellement.
  webServer: [
    {
      // Backend Express — requis pour le login et tous les appels API
      command:             'npm run start',
      cwd:                 resolve(__dirname, '../backend'),
      url:                 'http://localhost:4000/health',
      reuseExistingServer: true,
      timeout:             30_000,
    },
    {
      // Frontend Vite
      command:             'npm run dev',
      url:                 'http://localhost:5173',
      reuseExistingServer: true,
      timeout:             30_000,
    },
  ],
});
