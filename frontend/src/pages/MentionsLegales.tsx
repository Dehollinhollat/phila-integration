// src/pages/MentionsLegales.tsx
// Page de mentions légales - route publique, sans authentification.
// Route : /mentions-legales

import { Link } from 'react-router-dom';
import Logo from '../components/ui/Logo';
import Footer from '../components/common/Footer';

// ─── Sous-composant Section ───────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: '1px solid var(--table-border)', paddingTop: 20, marginTop: 20 }}>
      <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: 'var(--accent-teal)' }}>
        {title}
      </h2>
      <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.8 }}>
        {children}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MentionsLegales() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>

      {/* Lien retour */}
      <div style={{ padding: '16px 24px', maxWidth: 800, width: '100%', margin: '0 auto' }}>
        <Link to="/" style={{ color: 'var(--accent-teal)', fontSize: 14, fontWeight: 600 }}>
          ← Retour
        </Link>
      </div>

      {/* Contenu central */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', padding: '0 16px 48px',
      }}>

        {/* Logo */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 10, marginBottom: 28,
        }}>
          <Link to="/" style={{ display: 'block' }}>
            <Logo width={52} height={52} />
          </Link>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--bg-card-border)',
          borderRadius: 16, padding: 'clamp(20px, 4vw, 36px)',
          maxWidth: 800, width: '100%',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: 'var(--accent-teal)' }}>
            Mentions légales
          </h1>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-secondary)' }}>
            Conformément aux dispositions de la loi n° 2004-575 du 21 juin 2004 pour la confiance en
            l'économie numérique.
          </p>

          <Section title="Éditeur du site">
            <p style={{ margin: '0 0 6px' }}>
              <strong>Nom de l'association :</strong> Phila Cité des Adorateurs
            </p>
            <p style={{ margin: '0 0 6px' }}>
              <strong>Adresse :</strong> 8 rue Saint-Claude, 77340 Pontault-Combault
            </p>
            <p style={{ margin: '0 0 6px' }}>
              <strong>Email :</strong>{' '}
              <a href="mailto:phila.integration.ca@gmail.com" style={{ color: 'var(--accent-teal)' }}>
                phila.integration.ca@gmail.com
              </a>
            </p>
            <p style={{ margin: 0 }}>
              <strong>Responsable de la publication :</strong> Pasteur Nomaq Muzembe
            </p>
          </Section>

          <Section title="Hébergement">
            <p style={{ margin: '0 0 6px' }}>
              <strong>Frontend :</strong> Vercel Inc. - 340 Pine Street, San Francisco, CA 94104, USA
            </p>
            <p style={{ margin: 0 }}>
              <strong>Backend et base de données :</strong> Railway / Neon Technologies
            </p>
          </Section>

          <Section title="Propriété intellectuelle">
            <p style={{ margin: 0 }}>
              L'ensemble du contenu de ce site (textes, images, logos) est la propriété exclusive de
              l'église Phila Cité des Adorateurs. Toute reproduction, représentation ou diffusion, intégrale
              ou partielle, sur quelque support que ce soit, est interdite sans autorisation préalable et
              écrite de l'association.
            </p>
          </Section>

          <Section title="Responsabilité">
            <p style={{ margin: 0 }}>
              L'église Phila Cité des Adorateurs s'efforce d'assurer l'exactitude et la mise à jour des
              informations diffusées sur ce site, mais ne peut garantir leur exhaustivité ni leur absence
              d'erreur. L'association se réserve le droit de corriger le contenu à tout moment et sans préavis.
            </p>
          </Section>
        </div>
      </div>

      <Footer />
    </div>
  );
}
