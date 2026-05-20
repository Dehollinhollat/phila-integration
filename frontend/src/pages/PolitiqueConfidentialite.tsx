// src/pages/PolitiqueConfidentialite.tsx
// Politique de confidentialité - route publique, sans authentification.
// Route : /politique-confidentialite

import { Link } from 'react-router-dom';
import Logo from '../components/ui/Logo';
import Footer from '../components/common/Footer';

// ─── Sous-composant Section ───────────────────────────────────────────────────

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: '1px solid var(--table-border)', paddingTop: 20, marginTop: 20 }}>
      <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: 'var(--accent-teal)' }}>
        {num}. {title}
      </h2>
      <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.8 }}>
        {children}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PolitiqueConfidentialite() {
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
            Politique de confidentialité
          </h1>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-secondary)' }}>
            Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })}
          </p>

          <Section num="1" title="Responsable du traitement">
            <p style={{ margin: 0 }}>
              <strong>Phila Cité des Adorateurs</strong>
              <br />
              8 rue Saint-Claude, 77340 Pontault-Combault
            </p>
          </Section>

          <Section num="2" title="Données collectées">
            <p style={{ margin: '0 0 8px' }}>
              Dans le cadre de notre mission d'accueil et d'intégration, nous collectons les données
              suivantes :
            </p>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li><strong>Identité :</strong> nom, prénom, genre, état civil</li>
              <li><strong>Coordonnées :</strong> téléphone, email, ville, code postal</li>
              <li>
                <strong>Informations pastorales :</strong> besoins spirituels, souhait d'intégration,
                intérêt pour les cellules
              </li>
              <li>
                <strong>Données de suivi :</strong> statut d'intégration, commentaires des référents
              </li>
            </ul>
          </Section>

          <Section num="3" title="Finalité du traitement">
            <p style={{ margin: '0 0 8px' }}>Les données sont utilisées uniquement pour :</p>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>Assurer le suivi pastoral personnalisé</li>
              <li>
                Vous contacter via WhatsApp pour les messages de bienvenue et les informations
                de l'église
              </li>
              <li>Organiser les équipes de service (ouvriers)</li>
            </ul>
          </Section>

          <Section num="4" title="Base légale">
            <p style={{ margin: 0 }}>
              Le traitement est fondé sur votre <strong>consentement explicite</strong> recueilli lors de la
              soumission du formulaire d'accueil (Article 6.1.a du RGPD).
            </p>
          </Section>

          <Section num="5" title="Durée de conservation">
            <p style={{ margin: 0 }}>
              Vos données sont conservées pendant la durée de votre relation avec l'église Phila, et au
              maximum <strong>3 ans</strong> après votre dernier contact.
            </p>
          </Section>

          <Section num="6" title="Vos droits">
            <p style={{ margin: '0 0 8px' }}>
              Conformément au RGPD, vous disposez des droits suivants :
            </p>
            <ul style={{ margin: '0 0 8px', paddingLeft: 20 }}>
              <li>Droit d'accès à vos données</li>
              <li>Droit de rectification</li>
              <li>Droit à l'effacement (droit à l'oubli)</li>
              <li>Droit d'opposition au traitement</li>
              <li>Droit à la portabilité</li>
            </ul>
            <p style={{ margin: 0 }}>
              Pour exercer ces droits, contactez-nous par email à{' '}
              <a href="mailto:phila.integration.ca@gmail.com" style={{ color: 'var(--accent-teal)' }}>
                phila.integration.ca@gmail.com
              </a>{' '}
              ou en écrivant à notre adresse.
            </p>
          </Section>

          <Section num="7" title="Sécurité">
            <p style={{ margin: 0 }}>
              Vos données sont protégées par des mesures techniques adaptées : chiffrement SSL, accès
              restreint par authentification, hébergement sécurisé. Nous mettons tout en œuvre pour
              garantir la confidentialité et l'intégrité de vos informations.
            </p>
          </Section>

          <Section num="8" title="Cookies">
            <p style={{ margin: 0 }}>
              Ce site utilise uniquement des cookies techniques nécessaires au fonctionnement de
              l'application (session d'authentification). <strong>Aucun cookie publicitaire ou de
              tracking n'est utilisé.</strong>
            </p>
          </Section>

          <Section num="9" title="Contact">
            <p style={{ margin: 0 }}>
              Pour toute question relative à vos données personnelles :{' '}
              <a href="mailto:phila.integration.ca@gmail.com" style={{ color: 'var(--accent-teal)' }}>
                phila.integration.ca@gmail.com
              </a>
            </p>
          </Section>
        </div>
      </div>

      <Footer />
    </div>
  );
}
