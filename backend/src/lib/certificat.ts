// src/lib/certificat.ts
// Génère un certificat d'intégration PDF au format A4 paysage.
// Logo encodé en base64 — aucun accès disque requis en production.

import PDFDocument from 'pdfkit';

const LOGO_BASE64 = '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';

const logoBuffer: Buffer = Buffer.from(LOGO_BASE64, 'base64');

export const genererCertificat = (contact: {
  prenom: string;
  nom: string;
  campus: string;
  date_integration: Date;
  verset?: string;
}): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 50,
      autoFirstPage: true,
      bufferPages: false,
    });
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

    // Logo en haut centré — buffer encodé en base64
    doc.image(logoBuffer, (W - 70) / 2, 25, { width: 70 });

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
      .text('Église Phila Cité des Adorateurs', 0, 174, { align: 'center', width: W });

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
