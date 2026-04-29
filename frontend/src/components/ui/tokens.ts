// src/components/ui/tokens.ts
// Design tokens — source de vérité pour toute la charte graphique Phila Intégration.
// Importer depuis ce fichier pour garantir la cohérence visuelle dans tous les composants.

export const colors = {
  // ── Primaire — sidebar, boutons principaux, liens actifs ──────────────────
  primary:        '#0C5E6B',
  primaryHover:   '#0A4F5A',
  primaryLight:   '#E1F5EE',
  primaryText:    '#085041',

  // ── Secondaire — Profil B, alertes douces, accents dorés ─────────────────
  secondary:      '#C8943E',
  secondaryHover: '#A97A2E',
  secondaryLight: '#FAEEDA',
  secondaryText:  '#633806',

  // ── Sémantiques ──────────────────────────────────────────────────────────
  danger:         '#A32D2D',
  dangerLight:    '#FDECEA',
  success:        '#1A7A4A',
  successLight:   '#E6F5EC',
  info:           '#378ADD',
  infoLight:      '#EBF3FD',
  warning:        '#C8943E',
  warningLight:   '#FAEEDA',

  // ── Neutres ───────────────────────────────────────────────────────────────
  white:          '#FFFFFF',
  black:          '#0D0D0D',
  gray50:         '#F9FAFB',
  gray100:        '#F3F4F6',
  gray200:        '#E5E7EB',
  gray300:        '#D1D5DB',
  gray400:        '#9CA3AF',
  gray500:        '#6B7280',
  gray600:        '#4B5563',
  gray700:        '#374151',
  gray800:        '#1F2937',
  gray900:        '#111827',

  // ── Sidebar ───────────────────────────────────────────────────────────────
  sidebarBg:      '#0C5E6B',
  sidebarText:    '#FFFFFF',
  sidebarActive:  'rgba(255, 255, 255, 0.12)',
  sidebarHover:   'rgba(255, 255, 255, 0.07)',
} as const;

export const typography = {
  fontFamily: "system-ui, 'Segoe UI', Roboto, -apple-system, sans-serif",
  fontSize: {
    xs:   '11px',
    sm:   '13px',
    base: '14px',
    md:   '15px',
    lg:   '16px',
    xl:   '18px',
    '2xl':'22px',
    '3xl':'28px',
  },
  fontWeight: {
    normal:   400,
    medium:   500,
    semibold: 600,
    bold:     700,
  },
  lineHeight: {
    tight:  1.25,
    normal: 1.5,
    loose:  1.75,
  },
} as const;

export const spacing = {
  0:   '0',
  1:   '4px',
  2:   '8px',
  3:   '12px',
  4:   '16px',
  5:   '20px',
  6:   '24px',
  8:   '32px',
  10:  '40px',
  12:  '48px',
  16:  '64px',
} as const;

export const radius = {
  sm:   '4px',
  md:   '8px',
  lg:   '12px',
  xl:   '16px',
  full: '9999px',
} as const;

export const shadows = {
  sm:  '0 1px 2px rgba(0,0,0,0.05)',
  md:  '0 2px 8px rgba(0,0,0,0.08)',
  lg:  '0 4px 16px rgba(0,0,0,0.10)',
  xl:  '0 8px 32px rgba(0,0,0,0.12)',
} as const;

export const layout = {
  sidebarWidth:      '240px',
  sidebarCollapsed:  '64px',
  appBarHeight:      '56px',
  contentMaxWidth:   '1200px',
  cardBorder:        `0.5px solid ${colors.gray200}`,
} as const;

// Durées d'animation
export const transitions = {
  fast:   '120ms ease',
  normal: '200ms ease',
  slow:   '300ms ease',
} as const;
