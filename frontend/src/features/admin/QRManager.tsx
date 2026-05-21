// src/features/admin/QRManager.tsx
// Page de gestion des QR codes - génération côté client avec la librairie qrcode + Canvas API.
//
// Approche Canvas (compatible Vite, pas de dépendance aux APIs DOM privées) :
//   1. QRCode.toCanvas() dessine le QR code directement sur un <canvas> avec la couleur voulue.
//   2. Une Image() est chargée en async et superposée au centre via ctx.drawImage().
//      Un cercle blanc est tracé derrière le logo pour le faire ressortir sur les modules sombres.
//   3. Téléchargement PNG : canvas.toDataURL('image/png') → lien <a> simulé.
//   4. Téléchargement SVG : QRCode.toString(..., { type: 'svg' }) → Blob → lien <a> simulé.
//      Le SVG ne contient pas le logo (limitation du SVG généré) mais reste vectoriel.
//
// Accessible aux rôles admin_campus et supérieurs.

import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import logoPhila from '../../assets/images/LOGO-PHILA-BLEU.png';
import { useAuth } from '../../context/AuthContext';
import { ROLE_RANK } from '../../utils/constants';

// ─── Couleurs de marque ───────────────────────────────────────────────────────

const ROYAL_BLUE = '#1A56B0';
const GOLD       = '#D4A24E';
const VIOLET     = '#8B5CF6';

// ─── Générateur Canvas ────────────────────────────────────────────────────────
// Le logo est importé comme module Vite (import logoPhila from '...png') plutôt
// que référencé par chemin public - Vite résout l'URL avec un hash de contenu,
// garantissant que l'asset est servi sans 404 et sans problème de CORS.

async function generateQR(
  canvas: HTMLCanvasElement,
  url:    string,
  color:  string,
): Promise<void> {
  // Étape 1 : QR code de base
  await QRCode.toCanvas(canvas, url, {
    width:  280,
    margin: 2,
    color:  { dark: color, light: '#FFFFFF' },
  });

  // Étape 2 : logo superposé au centre - attend la résolution de la Promise
  // avant de continuer pour que canvas.toDataURL() inclue le logo
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  await new Promise<void>(resolve => {
    const logo = new Image();
    logo.onload = () => {
      const logoSize = canvas.width * 0.22;
      const logoX    = (canvas.width  - logoSize) / 2;
      const logoY    = (canvas.height - logoSize) / 2;

      // Fond blanc circulaire derrière le logo
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, logoSize / 2 + 6, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
      resolve();
    };
    logo.onerror = () => resolve(); // logo absent → QR affiché sans logo
    // Import Vite résout l'URL avec hash de contenu - garanti servi, pas de 404
    logo.src = logoPhila;
  });
}

// ─── Config des cartes ────────────────────────────────────────────────────────

interface CardConfig {
  label:       string;
  description: string;
  url:         string;
  color:       string;
  badgeBg:     string;
  badgeColor:  string;
  badgeLabel:  string;
  filename:    string;
}

// ─── Composant carte QR ───────────────────────────────────────────────────────

function QRCard({ config }: { config: CardConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied]   = useState(false);
  const [ready,  setReady]    = useState(false);

  // Génère le QR code après le mount, quand le canvas existe dans le DOM
  useEffect(() => {
    if (!canvasRef.current) return;
    setReady(false);
    generateQR(canvasRef.current, config.url, config.color)
      .then(() => setReady(true))
      .catch(() => setReady(true));
  }, [config.url, config.color]);

  function handleDownloadPNG() {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `${config.filename}.png`;
    link.href     = canvasRef.current.toDataURL('image/png');
    link.click();
  }

  async function handleDownloadSVG() {
    const svg = await QRCode.toString(config.url, {
      type:   'svg',
      margin: 2,
      color:  { dark: config.color, light: '#FFFFFF' },
    });
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.download = `${config.filename}.svg`;
    link.href     = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function copyUrl() {
    navigator.clipboard.writeText(config.url)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => {});
  }

  return (
    <div style={{
      background:    'var(--bg-card)',
      border:        '1px solid var(--bg-card-border)',
      borderRadius:  12,
      padding:       24,
      display:       'flex',
      flexDirection: 'column',
      gap:           20,
      flex:          '1 1 300px',
      minWidth:      280,
      maxWidth:      420,
    }}>

      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: config.color }}>
            {config.label}
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {config.description}
          </p>
        </div>
        <span style={{
          padding:      '3px 10px',
          borderRadius: 20,
          background:   config.badgeBg,
          color:        config.badgeColor,
          fontSize:     12,
          fontWeight:   600,
          flexShrink:   0,
          whiteSpace:   'nowrap',
        }}>
          {config.badgeLabel}
        </span>
      </div>

      {/* Canvas QR code - fond blanc forcé pour la lisibilité des modules */}
      <div style={{
        display:        'flex',
        justifyContent: 'center',
        alignItems:     'center',
        minHeight:      280,
        padding:        16,
        background:     '#FFFFFF',
        borderRadius:   8,
        border:         '1px solid var(--bg-card-border)',
        position:       'relative',
      }}>
        {!ready && (
          <div style={{
            position:      'absolute',
            width:         32,
            height:        32,
            borderRadius:  '50%',
            border:        `3px solid rgba(0,0,0,0.08)`,
            borderTopColor: config.color,
            animation:     'qrspin 0.7s linear infinite',
          }} />
        )}
        <canvas
          ref={canvasRef}
          style={{
            borderRadius: 4,
            display:      'block',
            opacity:      ready ? 1 : 0,
            transition:   'opacity 0.2s',
          }}
        />
        <style>{`@keyframes qrspin { to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* URL affichée */}
      <div style={{
        padding:      '8px 12px',
        borderRadius: 6,
        background:   'var(--bg-secondary)',
        border:       '1px solid var(--bg-card-border)',
        fontSize:     11,
        color:        'var(--text-secondary)',
        wordBreak:    'break-all',
        fontFamily:   'monospace',
        lineHeight:   1.5,
      }}>
        {config.url}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto' }}>
        <button
          onClick={handleDownloadPNG}
          disabled={!ready}
          style={{
            padding:      '8px 14px',
            borderRadius: 6,
            border:       'none',
            background:   config.color,
            color:        '#fff',
            fontSize:     13,
            fontWeight:   600,
            cursor:       ready ? 'pointer' : 'not-allowed',
            opacity:      ready ? 1 : 0.5,
            fontFamily:   'inherit',
          }}
        >
          ↓ PNG
        </button>

        <button
          onClick={handleDownloadSVG}
          disabled={!ready}
          style={{
            padding:      '8px 14px',
            borderRadius: 6,
            border:       '1px solid var(--bg-card-border)',
            background:   'transparent',
            color:        'var(--text-primary)',
            fontSize:     13,
            fontWeight:   600,
            cursor:       ready ? 'pointer' : 'not-allowed',
            opacity:      ready ? 1 : 0.5,
            fontFamily:   'inherit',
          }}
        >
          ↓ SVG
        </button>

        <button
          onClick={copyUrl}
          style={{
            flex:         1,
            padding:      '8px 14px',
            borderRadius: 6,
            border:       `1px solid ${copied ? '#16a34a' : 'var(--bg-card-border)'}`,
            background:   copied ? '#16a34a' : 'transparent',
            color:        copied ? '#fff' : 'var(--text-primary)',
            fontSize:     13,
            fontWeight:   600,
            cursor:       'pointer',
            fontFamily:   'inherit',
            transition:   'background 0.2s, color 0.2s, border-color 0.2s',
            whiteSpace:   'nowrap',
          }}
        >
          {copied ? '✓ Copié !' : 'Copier le lien'}
        </button>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function QRManager() {
  const { user } = useAuth();

  if (!user || ROLE_RANK[user.role] < ROLE_RANK['admin_campus']) {
    return (
      <div style={{ padding: 32, color: 'var(--text-secondary)', fontSize: 14 }}>
        Accès réservé aux administrateurs de campus.
      </div>
    );
  }

  const origin = window.location.origin;

  const cards: CardConfig[] = [
    {
      label:       'Formulaire Présentiel',
      description: 'Pour les cultes et événements',
      url:         `${origin}/form/presentiel`,
      color:       ROYAL_BLUE,
      badgeBg:     'var(--badge-enligne-bg)',
      badgeColor:  'var(--accent-teal)',
      badgeLabel:  'Présentiel',
      filename:    'qr-phila-presentiel',
    },
    {
      label:       'Formulaire En Ligne',
      description: 'Pour les participants à distance',
      url:         `${origin}/form/en-ligne`,
      color:       GOLD,
      badgeBg:     'var(--accent-gold-light)',
      badgeColor:  'var(--accent-gold)',
      badgeLabel:  'En ligne',
      filename:    'qr-phila-en-ligne',
    },
    {
      label:       'Formulaire Ouvrier',
      description: 'Pour les candidatures au service',
      url:         `${origin}/form/ouvrier`,
      color:       VIOLET,
      badgeBg:     '#EDE9FE',
      badgeColor:  VIOLET,
      badgeLabel:  'Candidature',
      filename:    'qr-phila-ouvrier',
    },
  ];

  return (
    <div style={{ padding: 'clamp(16px, 4vw, 28px) clamp(12px, 3vw, 32px)', maxWidth: 1000, margin: '0 auto' }}>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px' }}>
          QR Codes
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>
          Générez et téléchargez les QR codes pour les formulaires d'inscription.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {cards.map(config => (
          <QRCard key={config.url} config={config} />
        ))}
      </div>

      <div style={{
        marginTop:    28,
        padding:      '14px 16px',
        borderRadius: 8,
        background:   'var(--bg-secondary)',
        border:       '1px solid var(--bg-card-border)',
        fontSize:     13,
        color:        'var(--text-secondary)',
        display:      'flex',
        gap:          10,
        alignItems:   'flex-start',
        lineHeight:   1.6,
      }}>
        <span style={{ flexShrink: 0 }}>ℹ️</span>
        <span>
          Les QR codes pointent vers l'URL actuelle de l'application
          ({' '}<span style={{ fontFamily: 'monospace', fontSize: 12 }}>{origin}</span>{' '}).
          En production, ils pointeront vers votre domaine définitif.
        </span>
      </div>

    </div>
  );
}
