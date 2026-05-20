// e2e/accessibility.spec.ts
// Tests d'accessibilité avec axe-core (via axe-playwright).
// axe-core scanne les violations WCAG 2.1 AA : contraste, labels, ARIA, focusable...
//
// Niveaux d'impact : critical > serious > moderate > minor
// Ces tests échouent uniquement sur les violations "critical" et "serious"
// pour éviter les faux positifs sur les règles "minor".
//
// Rapport HTML disponible dans playwright-report/ après les tests.

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibilité — Pages publiques', () => {
  test('page login — aucune violation critique/sérieuse', async ({ page }) => {
    await page.goto('/login');
    // Attendre que le contenu soit chargé
    await expect(page.locator('form')).toBeVisible({ timeout: 5_000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      // Exclure les violations liées au Turnstile (iframe Cloudflare hors contrôle)
      .exclude('iframe[src*="cloudflare"]')
      .analyze();

    // Filtrer uniquement les violations critiques et sérieuses
    const criticalViolations = results.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );

    if (criticalViolations.length > 0) {
      console.log('Violations accessibilité détectées :');
      criticalViolations.forEach(v => {
        console.log(`  [${v.impact}] ${v.id}: ${v.description}`);
        v.nodes.forEach(n => console.log(`    → ${n.html}`));
      });
    }

    expect(criticalViolations).toHaveLength(0);
  });

  test('formulaire présentiel — aucune violation critique/sérieuse', async ({ page }) => {
    await page.goto('/form/presentiel');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5_000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude('iframe[src*="cloudflare"]')
      .analyze();

    const criticalViolations = results.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(criticalViolations).toHaveLength(0);
  });

  test('formulaire en ligne — aucune violation critique/sérieuse', async ({ page }) => {
    await page.goto('/form/en-ligne');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5_000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude('iframe[src*="cloudflare"]')
      .analyze();

    const criticalViolations = results.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(criticalViolations).toHaveLength(0);
  });

  test('page "Mot de passe oublié" — aucune violation critique', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('form, h1, h2').first()).toBeVisible({ timeout: 5_000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const criticalViolations = results.violations.filter(v => v.impact === 'critical');
    expect(criticalViolations).toHaveLength(0);
  });
});
