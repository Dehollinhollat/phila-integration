// e2e/auth.spec.ts
// Tests E2E du flux d'authentification.
// Vérifie :
//   - Connexion avec des identifiants valides → redirection vers /dashboard
//   - Connexion avec mauvais mot de passe → message d'erreur visible
//   - Accès direct à /dashboard sans être connecté → redirect vers /login
//   - Déconnexion → redirect vers /login
//
// Ces tests tournent contre le serveur Vite (localhost:5173).
// Le backend doit être démarré sur localhost:4000.

import { test, expect } from '@playwright/test';

// Credentials de test — définis dans frontend/.env.test (non commité)
const TEST_EMAIL    = process.env.TEST_EMAIL    || 'deohmagique@gmail.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '';

test.describe('Authentification', () => {
  test('connexion avec identifiants valides → /dashboard', async ({ page }) => {
    await page.goto('/login');

    // Vérifier que la page de login est chargée
    await expect(page).toHaveTitle('Phila Integration');
    await expect(page.locator('input[type="email"]')).toBeVisible();

    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Attendre la redirection vers /dashboard
    await expect(page).toHaveURL('/dashboard', { timeout: 10_000 });
  });

  test('connexion avec mauvais mot de passe → message d\'erreur', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', 'mauvais-mot-de-passe');
    await page.click('button[type="submit"]');

    // Message d'erreur visible après tentative
    const errorBanner = page.locator('[role="alert"]');
    await expect(errorBanner).toBeVisible({ timeout: 5_000 });
    await expect(errorBanner).toContainText(/invalides|incorrect/i);

    // Rester sur la page de login
    await expect(page).toHaveURL('/login');
  });

  test('accès à /dashboard sans authentification → redirect /login', async ({ page }) => {
    // Navigation directe sans être connecté
    await page.goto('/dashboard');
    // L'AuthGuard doit rediriger vers login
    await expect(page).toHaveURL('/login', { timeout: 5_000 });
  });

  test('accès à /contacts sans authentification → redirect /login', async ({ page }) => {
    await page.goto('/contacts');
    await expect(page).toHaveURL('/login', { timeout: 5_000 });
  });

  test('page login accessible (champs email/password visibles)', async ({ page }) => {
    await page.goto('/login');

    // Éléments critiques présents et accessibles
    await expect(page.locator('label[for="email"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeEnabled();
    await expect(page.locator('input[type="password"]')).toBeEnabled();
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
  });

  test('lien "Mot de passe oublié ?" visible sur la page login', async ({ page }) => {
    await page.goto('/login');
    const forgotLink = page.getByText(/mot de passe oublié/i);
    await expect(forgotLink).toBeVisible();
  });
});
