// vite.config.ts
// Configuration Vite + PWA.
// VitePWA génère le service worker (Workbox) et le manifest.webmanifest au build.
// En dev, le SW n'est pas actif sauf si devOptions.enabled = true.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Remplace automatiquement l'ancien SW quand une nouvelle version est buildée
      registerType: 'autoUpdate',

      // Fichiers statiques préchargés dans le cache d'installation (précache)
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png'],

      manifest: {
        name:             'Phila Integration',
        short_name:       'Phila Integration',
        description:      "Application de gestion de l'intégration - Phila Cité des Adorateurs",
        theme_color:      '#1A56B0',
        background_color: '#ffffff',
        display:          'standalone',   // lance sans la barre d'adresse du navigateur
        orientation:      'any',       // autorise portrait et paysage
        scope:            '/',
        start_url:        '/',
        lang:             'fr',
        icons: [
          { src: 'icons/icon-72x72.png',   sizes: '72x72',   type: 'image/png' },
          { src: 'icons/icon-96x96.png',   sizes: '96x96',   type: 'image/png' },
          { src: 'icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
          { src: 'icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
          { src: 'icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
          {
            src:     'icons/icon-192x192.png',
            sizes:   '192x192',
            type:    'image/png',
            purpose: 'any maskable',   // maskable = icône adaptative Android
          },
          { src: 'icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
          {
            src:     'icons/icon-512x512.png',
            sizes:   '512x512',
            type:    'image/png',
            purpose: 'any maskable',
          },
        ],
        categories: ['productivity', 'utilities'],
        shortcuts: [
          {
            name:        'Nouveau contact',
            short_name:  'Contact',
            description: 'Ajouter un nouveau contact',
            url:         '/contacts/nouveau',
            icons: [{ src: 'icons/icon-96x96.png', sizes: '96x96' }],
          },
          {
            name:        'Dashboard',
            short_name:  'Dashboard',
            description: 'Voir le tableau de bord',
            url:         '/dashboard',
            icons: [{ src: 'icons/icon-96x96.png', sizes: '96x96' }],
          },
        ],
      },

      workbox: {
        // Fichiers inclus dans le précache généré par Workbox au build
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

        runtimeCaching: [
          {
            // Cache réseau-first pour toutes les requêtes API Railway
            urlPattern: /^https:\/\/phila-integration-production\.up\.railway\.app\/api\/.*/i,
            handler:    'NetworkFirst',
            options: {
              cacheName:  'api-cache',
              expiration: {
                maxEntries:    100,
                maxAgeSeconds: 60 * 60 * 24, // 24 h
              },
              networkTimeoutSeconds: 10, // fallback cache si le réseau dépasse 10 s
            },
          },
        ],
      },
    }),
  ],
});
