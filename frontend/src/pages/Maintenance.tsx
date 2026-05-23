// src/pages/Maintenance.tsx
// Page de maintenance -affichée quand le backend renvoie { maintenance: true } sur /health.
// Activable via la variable Railway MAINTENANCE_MODE=true.
// Le logo est importé comme module Vite (hash de cache + chemin résolu au build)
// plutôt qu'un chemin statique /public/ qui n'existe pas dans ce projet.

import logoPhila from '../assets/images/LOGO-PHILA-BLEU.png';

export default function Maintenance() {
  return (
    <div style={{
      minHeight:      '100vh',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      background:     'var(--bg-primary)',
      padding:        '24px',
      textAlign:      'center',
    }}>
      <img src={logoPhila} alt="Phila" style={{ width: '80px', marginBottom: '24px' }} />
      <h1 style={{ color: 'var(--text-primary)', fontSize: '28px', marginBottom: '12px' }}>
        Maintenance en cours
      </h1>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', lineHeight: '1.6' }}>
        L'application Phila Intégration est temporairement indisponible pour maintenance.
        Nous serons de retour très prochainement.
      </p>
      <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', marginTop: '24px' }}>
        Phila Cité des Adorateurs
      </p>
    </div>
  );
}
