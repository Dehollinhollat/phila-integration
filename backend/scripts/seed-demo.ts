import prisma from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  // ── Compte demo lecteur ────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('demo1234', 10);

  const demo = await prisma.user.upsert({
    where:  { email: 'demo@phila.app' },
    update: {},
    create: {
      email:    'demo@phila.app',
      password: hashedPassword,
      prenom:   'Demo',
      nom:      'Visiteur',
      role:     'lecteur',
      campus:   ['paris', 'paris_nord'],
      actif:    true,
    },
  });

  console.log('Compte demo cree:', demo.email);

  // ── Contacts fictifs ───────────────────────────────────────────────────────
  // Tous les champs obligatoires du modèle Contact sont renseignés.
  const contacts = [
    {
      prenom: 'Marie',   nom: 'Dubois',   telephone: '+33612345001',
      campus: 'paris',      profil: 'visiteur_sans_eglise', statut: 'integre',
      genre: 'femme', etat_civil: 'celibataire', statut_phila: 'non',
      ville: 'Paris',
    },
    {
      prenom: 'Jean',    nom: 'Martin',   telephone: '+33612345002',
      campus: 'paris',      profil: 'membre_phila',          statut: 'contacte',
      genre: 'homme', etat_civil: 'marie',      statut_phila: 'oui',
      ville: 'Montreuil',
    },
    {
      prenom: 'Sophie',  nom: 'Bernard',  telephone: '+33612345003',
      campus: 'paris_nord', profil: 'visiteur_avec_eglise',  statut: 'nouveau',
      genre: 'femme', etat_civil: 'celibataire', statut_phila: 'non',
      ville: 'Saint-Denis',
    },
    {
      prenom: 'Lucas',   nom: 'Petit',    telephone: '+33612345004',
      campus: 'paris',      profil: 'visiteur_sans_eglise', statut: 'integre',
      genre: 'homme', etat_civil: 'celibataire', statut_phila: 'non',
      ville: 'Vincennes',
    },
    {
      prenom: 'Emma',    nom: 'Leroy',    telephone: '+33612345005',
      campus: 'paris_nord', profil: 'membre_phila',          statut: 'contacte',
      genre: 'femme', etat_civil: 'marie',      statut_phila: 'oui',
      ville: 'Aubervilliers',
    },
    {
      prenom: 'Thomas',  nom: 'Moreau',   telephone: '+33612345006',
      campus: 'paris',      profil: 'visiteur_sans_eglise', statut: 'nouveau',
      genre: 'homme', etat_civil: 'celibataire', statut_phila: 'non',
      ville: 'Nogent-sur-Marne',
    },
    {
      prenom: 'Chloe',   nom: 'Simon',    telephone: '+33612345007',
      campus: 'paris_nord', profil: 'visiteur_avec_eglise',  statut: 'integre',
      genre: 'femme', etat_civil: 'fiance',     statut_phila: 'premiere_visite',
      ville: 'Bobigny',
    },
    {
      prenom: 'Antoine', nom: 'Laurent',  telephone: '+33612345008',
      campus: 'paris',      profil: 'membre_phila',          statut: 'contacte',
      genre: 'homme', etat_civil: 'marie',      statut_phila: 'oui',
      ville: 'Champigny-sur-Marne',
    },
  ];

  for (const c of contacts) {
    await prisma.contact.upsert({
      where:  { telephone: c.telephone },
      update: {},
      create: {
        ...c,
        canal:            'presentiel',
        consentement_rgpd: true,
        date_inscription: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000),
        intention:        'souhaite_integrer',
      } as Parameters<typeof prisma.contact.create>[0]['data'],
    });
  }

  console.log('8 contacts fictifs crees');
  console.log('---');
  console.log('Credentials demo:');
  console.log('  Email:    demo@phila.app');
  console.log('  Password: demo1234');
}

main().catch(console.error).finally(() => prisma.$disconnect());
