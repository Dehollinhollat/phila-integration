// src/components/common/Footer.tsx
// Pied de page commun à toutes les pages publiques.
// Affiche l'adresse de l'église, les liens légaux, et le copyright annuel.

import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer style={{
      padding: '20px 24px',
      textAlign: 'center',
      borderTop: '1px solid var(--table-border)',
      color: 'var(--text-secondary)',
      fontSize: 12,
      lineHeight: 1.8,
    }}>
      <p style={{ margin: '0 0 6px' }}>
        Phila Cité des Adorateurs - 8 rue Saint-Claude, 77340 Pontault-Combault
      </p>
      <p style={{ margin: '0 0 6px' }}>
        <Link to="/mentions-legales" style={{ color: 'var(--accent-teal)', marginRight: 20 }}>
          Mentions légales
        </Link>
        <Link to="/politique-confidentialite" style={{ color: 'var(--accent-teal)' }}>
          Politique de confidentialité
        </Link>
      </p>
      <p style={{ margin: 0 }}>
        © {new Date().getFullYear()} - Tous droits réservés
      </p>
    </footer>
  );
}
