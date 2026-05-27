// src/lib/certificat.ts
// Génère un certificat d'intégration PDF au format A4 paysage.

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export const genererCertificat = (contact: {
  prenom: string;
  nom: string;
  campus: string;
  date_integration: Date;
  verset?: string;
}): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const W = doc.page.width;
    const H = doc.page.height;

    // Fond bleu très clair
    doc.rect(0, 0, W, H).fill('#EEF4FF');

    // Bordure bleue externe
    doc.rect(20, 20, W - 40, H - 40).lineWidth(4).stroke('#1A56B0');
    // Bordure dorée interne
    doc.rect(28, 28, W - 56, H - 56).lineWidth(1.5).stroke('#D4A24E');

    // Filigrane PHILA — centré, sans rotation
    doc
      .font('Helvetica-Bold')
      .fontSize(120)
      .fillColor('#1A56B0')
      .fillOpacity(0.04)
      .text('PHILA', 0, H / 2 - 60, { align: 'center', width: W });
    doc.fillOpacity(1);

    // Logo en haut centré — cherche dans plusieurs emplacements
    const logoPaths = [
      path.join(__dirname, '../../public/icons/icon-128x128.png'),
      path.join(__dirname, '../../../frontend/public/icons/icon-128x128.png'),
      path.join(process.cwd(), 'public/icons/icon-128x128.png'),
    ];
    const logoPath = logoPaths.find(p => fs.existsSync(p));
    if (logoPath) {
      doc.image(logoPath, (W - 70) / 2, 25, { width: 70 });
    }

    // Titre
    doc
      .fillColor('#1A56B0')
      .fontSize(36)
      .font('Helvetica-Bold')
      .text("CERTIFICAT D'INTÉGRATION", 0, 130, { align: 'center', width: W });

    // Sous-titre église
    doc
      .fillColor('#1A56B0')
      .fontSize(13)
      .font('Helvetica')
      .text("Église Phila Cité des Adorateurs", 0, 174, { align: 'center', width: W });

    // Ligne décorative dorée
    doc
      .moveTo(W / 2 - 150, 198)
      .lineTo(W / 2 + 150, 198)
      .lineWidth(2)
      .stroke('#D4A24E');

    // Texte introductif
    doc
      .fillColor('#374151')
      .fontSize(14)
      .font('Helvetica')
      .text('Ce certificat est décerné à', 0, 218, { align: 'center', width: W });

    // Nom du bénéficiaire
    doc
      .fillColor('#1A56B0')
      .fontSize(40)
      .font('Helvetica-Bold')
      .text(`${contact.prenom} ${contact.nom}`, 0, 245, { align: 'center', width: W });

    // Ligne décorative sous le nom
    doc
      .moveTo(W / 2 - 100, 300)
      .lineTo(W / 2 + 100, 300)
      .lineWidth(1)
      .stroke('#D4A24E');

    // Corps du certificat
    const dateFormatee = contact.date_integration.toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

    doc
      .fillColor('#374151')
      .fontSize(13)
      .font('Helvetica')
      .text(
        `en reconnaissance de son parcours d'intégration accompli avec fidélité au sein de l'Église Phila Cité des Adorateurs — Campus de ${contact.campus}`,
        80, 315, { align: 'center', width: W - 160 },
      )
      .text(`Délivré le ${dateFormatee}.`, 0, 348, { align: 'center', width: W });

    // Verset biblique — italique, centré, doré
    if (contact.verset) {
      doc
        .font('Helvetica-Oblique')
        .fontSize(11)
        .fillColor('#D4A24E')
        .text(contact.verset, 80, 375, { align: 'center', width: W - 160 });
    }

    // Zones de signature
    const sigY = 440;
    const sigW = 180;

    // Signature Pasteur (gauche)
    doc
      .moveTo(W / 2 - 220, sigY)
      .lineTo(W / 2 - 220 + sigW, sigY)
      .lineWidth(1)
      .stroke('#9CA3AF');
    doc
      .fillColor('#374151')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('Pasteur', W / 2 - 220, sigY + 8, { width: sigW, align: 'center' })
      .font('Helvetica')
      .fontSize(10)
      .text('Signature & Cachet', W / 2 - 220, sigY + 22, { width: sigW, align: 'center' });

    // Signature Référent (droite)
    doc
      .moveTo(W / 2 + 40, sigY)
      .lineTo(W / 2 + 40 + sigW, sigY)
      .lineWidth(1)
      .stroke('#9CA3AF');
    doc
      .fillColor('#374151')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text("Référent d'intégration", W / 2 + 40, sigY + 8, { width: sigW, align: 'center' })
      .font('Helvetica')
      .fontSize(10)
      .text('Signature', W / 2 + 40, sigY + 22, { width: sigW, align: 'center' });

    // Pied de page
    doc
      .fillColor('#9CA3AF')
      .fontSize(9)
      .font('Helvetica')
      .text('Phila Intégration — Système de gestion des intégrations', 0, H - 55, { align: 'center', width: W });

    doc.end();
  });
};
