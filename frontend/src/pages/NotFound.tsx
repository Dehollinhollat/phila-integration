// src/pages/NotFound.tsx
// Page 404 personnalisée - affichée pour toute route inconnue (catch-all dans App.tsx).
// Design centré, sobre : logo + grand "404" bleu royal + titre + sous-titre + deux boutons.

import { useNavigate } from 'react-router-dom';
import Logo from '../components/ui/Logo';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight:      '100vh',
      background:     'var(--bg-primary)',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '32px 20px',
      fontFamily:     'system-ui, sans-serif',
    }}>

      {/* Logo */}
      <Logo width={64} height={64} style={{ marginBottom: 32 }} />

      {/* 404 */}
      <div style={{
        fontSize:   96,
        fontWeight: 500,
        color:      '#1A56B0',
        lineHeight: 1,
        margin:     '0 0 16px',
        letterSpacing: '-4px',
      }}>
        404
      </div>

      {/* Titre */}
      <h1 style={{
        fontSize:   24,
        fontWeight: 700,
        color:      'var(--text-primary)',
        margin:     '0 0 12px',
        textAlign:  'center',
      }}>
        Page introuvable
      </h1>

      {/* Sous-titre */}
      <p style={{
        fontSize:  15,
        color:     'var(--text-secondary)',
        margin:    '0 0 40px',
        textAlign: 'center',
        maxWidth:  380,
        lineHeight: 1.6,
      }}>
        La page que vous cherchez n'existe pas ou a été déplacée.
      </p>

      {/* Boutons */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            padding:      '11px 24px',
            borderRadius: 8,
            border:       'none',
            background:   '#1A56B0',
            color:        '#fff',
            fontSize:     14,
            fontWeight:   600,
            cursor:       'pointer',
            fontFamily:   'inherit',
            transition:   '120ms ease',
          }}
        >
          Retour au dashboard
        </button>

        <button
          onClick={() => navigate(-1)}
          style={{
            padding:      '11px 24px',
            borderRadius: 8,
            border:       '1px solid var(--border, #e5e7eb)',
            background:   'transparent',
            color:        'var(--text-primary)',
            fontSize:     14,
            fontWeight:   600,
            cursor:       'pointer',
            fontFamily:   'inherit',
            transition:   '120ms ease',
          }}
        >
          ← Retour en arrière
        </button>
      </div>
    </div>
  );
}
