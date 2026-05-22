// src/components/common/InstallPWA.tsx
// Bandeau d'installation PWA — s'affiche en bas de l'écran quand le navigateur
// signale que l'app est installable (beforeinstallprompt) ou sur iOS (instructions manuelles).
//
// Comportement :
//   - Android/Chrome : bouton "Installer" qui déclenche la boîte native du navigateur.
//   - iOS/Safari     : message guidant vers Partager → "Sur l'écran d'accueil".
//   - Disparaît si déjà installé (standalone) ou si l'utilisateur a fermé le bandeau.
//   - Le refus est mémorisé dans localStorage pour ne pas réafficher à chaque visite.

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Extension de l'interface Event standard — l'API BeforeInstallPrompt n'est pas
// encore dans les types officiels TypeScript/DOM.
interface BeforeInstallPromptEvent extends Event {
  prompt:     () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPWA() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner,    setShowBanner]    = useState(false);
  const [isIOS,         setIsIOS]         = useState(false);

  useEffect(() => {
    // Détection iOS — Safari ne supporte pas beforeinstallprompt
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    // Déjà installée en mode standalone → pas de bandeau
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Utilisateur a déjà fermé le bandeau → pas de réaffichage
    if (localStorage.getItem('pwa-install-dismissed')) return;

    if (ios) {
      // Sur iOS, on affiche toujours les instructions car pas d'événement natif
      setShowBanner(true);
      return;
    }

    // Android / Chrome / Edge — l'événement beforeinstallprompt est différé par le navigateur
    const handler = (e: Event) => {
      e.preventDefault(); // empêche la mini-barre native de Chrome d'apparaître
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setShowBanner(false);
  }

  function handleDismiss() {
    setShowBanner(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  }

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0,   opacity: 1 }}
          exit={{   y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          style={{
            position:     'fixed',
            bottom:       '16px',
            left:         '16px',
            right:        '16px',
            background:   'var(--bg-card-solid, var(--bg-card))',
            border:       '1px solid var(--accent-blue)',
            borderRadius: '12px',
            padding:      '16px',
            zIndex:       2000,
            boxShadow:    '0 8px 32px rgba(0,0,0,0.3)',
            display:      'flex',
            alignItems:   'center',
            gap:          '12px',
          }}
        >
          <img
            src="/icons/icon-72x72.png"
            alt="Phila"
            style={{ width: 48, height: 48, borderRadius: 10, flexShrink: 0 }}
          />

          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
              Installer Phila Intégration
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
              {isIOS
                ? "Appuyez sur Partager puis \"Sur l'écran d'accueil\""
                : "Installez l'app pour un accès rapide"}
            </p>
          </div>

          {!isIOS && (
            <button
              onClick={handleInstall}
              style={{
                background:   '#1A56B0',
                color:        '#fff',
                border:       'none',
                borderRadius: 8,
                padding:      '8px 16px',
                fontSize:     13,
                fontWeight:   600,
                cursor:       'pointer',
                fontFamily:   'inherit',
                flexShrink:   0,
              }}
            >
              Installer
            </button>
          )}

          <button
            onClick={handleDismiss}
            aria-label="Fermer"
            style={{
              background:  'none',
              border:      'none',
              cursor:      'pointer',
              color:       'var(--text-secondary)',
              fontSize:    20,
              lineHeight:  1,
              padding:     '0 4px',
              fontFamily:  'inherit',
              flexShrink:  0,
            }}
          >
            ×
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
