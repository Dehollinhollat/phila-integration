import { useNavigate } from 'react-router-dom';
import logoPhila from '../assets/images/LOGO-PHILA-BLEU.png';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      padding: '24px',
      textAlign: 'center',
    }}>
      <img src={logoPhila} alt="Phila" style={{ width: '80px', marginBottom: '24px' }} />
      <h1 style={{ fontSize: '80px', fontWeight: 800, color: 'var(--accent-blue)', margin: 0, lineHeight: 1 }}>404</h1>
      <h2 style={{ color: 'var(--text-primary)', fontSize: '24px', marginTop: '16px' }}>Page introuvable</h2>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', lineHeight: '1.6', marginTop: '8px' }}>
        La page que vous cherchez n'existe pas ou a été déplacée.
      </p>
      <div style={{ display: 'flex', gap: '12px', marginTop: '32px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: '1px solid var(--bg-card-border)',
            background: 'transparent',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          ← Retour
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: 'var(--accent-blue)',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          Tableau de bord
        </button>
      </div>
      <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginTop: '40px' }}>
        Phila Cité des Adorateurs
      </p>
    </div>
  );
}
