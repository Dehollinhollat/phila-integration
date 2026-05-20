// src/pages/SuccessOuvrier.tsx
// Page de confirmation après soumission du formulaire de candidature ouvrier.
// Route publique - /success-ouvrier.

import Logo from '../components/ui/Logo';
import Footer from '../components/common/Footer';

export default function SuccessOuvrier() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-secondary)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Zone centrée contenant la carte */}
      <div style={{
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px 20px', textAlign: 'center',
      }}>
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)',
          borderRadius: 16, padding: '40px 28px',
          maxWidth: 440, width: '100%',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <Logo width={72} height={72} />
          </div>

          <h1 style={{
            margin: '0 0 16px', fontSize: 26, fontWeight: 800,
            color: 'var(--accent-violet)', letterSpacing: '-0.5px',
          }}>
            Merci pour votre engagement
          </h1>

          <p style={{
            margin: '0 0 12px', fontSize: 16,
            color: 'var(--text-primary)', lineHeight: 1.75,
          }}>
            Votre candidature a bien été enregistrée.
            <br />
            Notre équipe examinera votre dossier et vous contactera très prochainement.
          </p>

          <p style={{
            margin: '16px 0 0', fontSize: 16, fontWeight: 700,
            color: 'var(--accent-violet)',
          }}>
            Que Dieu bénisse votre désir de servir !
          </p>

          <div style={{
            marginTop: 32, paddingTop: 20,
            borderTop: '1px solid var(--bg-card-border)',
            fontSize: 12, color: 'var(--text-secondary)',
          }}>
            Église Phila · Cité des Adorateurs
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
