// lighthouserc.js
// Configuration Lighthouse CI pour les audits de performance et d'accessibilité.
// Lance automatiquement des audits Lighthouse sur les URLs listées.
//
// Seuils configurés :
//   - Performance ≥ 80 (warn) : pages lentes signalées mais ne bloquent pas le CI
//   - Accessibilité ≥ 90 (error) : seuil strict — une régression d'accessibilité casse le build
//   - FCP < 2s (warn) : First Contentful Paint — ressenti initial de l'utilisateur
//   - LCP < 3s (warn) : Largest Contentful Paint — contenu principal visible
//
// Exécution : npx lhci autorun
// (Vite doit être démarré : npm run dev)

module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:5173/login',
        'http://localhost:5173/form/presentiel',
      ],
      // Démarrer le serveur Vite avant les audits
      // Commenter si le serveur est déjà lancé manuellement
      // startServerCommand: 'npm run dev',
      // startServerReadyPattern: 'Local:.*5173',
      numberOfRuns: 2, // Moyenner sur 2 runs pour réduire la variance
    },
    assert: {
      assertions: {
        'categories:performance':     ['warn',  { minScore: 0.80 }],
        'categories:accessibility':   ['error', { minScore: 0.90 }],
        'categories:best-practices':  ['warn',  { minScore: 0.80 }],
        'categories:seo':             ['warn',  { minScore: 0.70 }],
        // Core Web Vitals
        'first-contentful-paint':     ['warn',  { maxNumericValue: 2000 }],
        'largest-contentful-paint':   ['warn',  { maxNumericValue: 3000 }],
        'total-blocking-time':        ['warn',  { maxNumericValue: 300  }],
        'cumulative-layout-shift':    ['warn',  { maxNumericValue: 0.1  }],
      },
    },
    upload: {
      // Stocker les rapports localement (pas de serveur LHCI)
      target: 'filesystem',
      outputDir: './lighthouse-results',
    },
  },
};
