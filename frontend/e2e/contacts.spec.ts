// e2e/contacts.spec.ts
// Tests E2E du module Contacts (après authentification).
// Login effectué dans beforeEach — chaque test repart d'une session fraîche.
//
// Vérifie :
//   - Navigation vers la liste des contacts
//   - Tableau des contacts visible et chargé
//   - Barre de recherche fonctionnelle
//   - URL /dashboard accessible après connexion

import { test, expect } from '@playwright/test';

// Credentials de test — définis dans frontend/.env.test (non commité)
const TEST_EMAIL    = process.env.TEST_EMAIL    || '';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '';

test.describe('Module Contacts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Attendre dashboard ou onboarding (première connexion Playwright)
    await page.waitForURL(
      url => url.pathname.includes('/dashboard') || url.pathname.includes('/onboarding'),
      { timeout: 15_000 },
    );

    // Si onboarding, passer le guide
    if (page.url().includes('/onboarding')) {
      const passerBtn = page.locator('button', { hasText: /passer/i });
      if (await passerBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await passerBtn.click();
      } else {
        await page.goto('/dashboard');
      }
      await page.waitForURL('**/dashboard', { timeout: 5_000 });
    }
  });

  test('navigation vers /contacts depuis le dashboard', async ({ page }) => {
    await page.goto('/contacts');
    await expect(page).toHaveURL('/contacts');
  });

  test('liste des contacts — tableau visible', async ({ page }) => {
    await page.goto('/contacts');
    // ContactList.tsx rend un vrai élément <table>
    await expect(page.locator('table')).toBeVisible({ timeout: 10_000 });
  });

  test('barre de recherche présente', async ({ page }) => {
    await page.goto('/contacts');
    // Placeholder exact issu de ContactList.tsx ligne 301
    const searchInput = page.locator('input[placeholder="Nom, prénom, téléphone…"]');
    await expect(searchInput).toBeVisible({ timeout: 5_000 });
  });

  test('URL /dashboard accessible après connexion', async ({ page }) => {
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});
