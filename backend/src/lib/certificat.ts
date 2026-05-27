// src/lib/certificat.ts
// Génère un certificat d'intégration PDF au format A4 paysage.

import PDFDocument from 'pdfkit';
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

    const W = 841.89;
    const H = 595.28;

    // Fond bleu très clair
    doc.rect(0, 0, W, H).fill('#EEF4FF');

    // Bordure bleue externe
    doc.rect(20, 20, W - 40, H - 40).lineWidth(4).stroke('#1A56B0');
    // Bordure dorée interne
    doc.rect(28, 28, W - 56, H - 56).lineWidth(1.5).stroke('#D4A24E');

    // Filigrane PHILA
    doc
      .save()
      .translate(W / 2, H / 2)
      .rotate(-30)
      .fontSize(120)
      .fillColor('#1A56B0')
      .fillOpacity(0.05)
      .text('PHILA', 0, 0, { align: 'center' })
      .restore();

    // Logo en haut centré
    const logoPath = path.join(__dirname, '../../public/icons/icon-128x128.png');
    try {
      doc.image(logoPath, (W - 80) / 2, 30, { width: 80 });
    } catch {
      // Logo non disponible, continue sans
    }

    // Titre (décalé vers le bas pour laisser place au logo)
    doc
      .fillOpacity(1)
      .fillColor('#1A56B0')
      .fontSize(36)
      .font('Helvetica-Bold')
      .text("CERTIFICAT D'INTÉGRATION", 0, 130, { align: 'center', width: W });

    // Ligne décorative dorée
    doc
      .moveTo(W / 2 - 150, 185)
      .lineTo(W / 2 + 150, 185)
      .lineWidth(2)
      .stroke('#D4A24E');

    // Texte introductif
    doc
      .fillColor('#374151')
      .fontSize(14)
      .font('Helvetica')
      .text('Ce certificat est remis à', 0, 215, { align: 'center', width: W });

    // Nom du bénéficiaire
    doc
      .fillColor('#1A56B0')
      .fontSize(40)
      .font('Helvetica-Bold')
      .text(`${contact.prenom} ${contact.nom}`, 0, 245, { align: 'center', width: W });

    // Ligne décorative
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
      .fontSize(14)
      .font('Helvetica')
      .text(
        `en reconnaissance de son intégration au sein de l'Église Phila — Campus de ${contact.campus},`,
        80, 320, { align: 'center', width: W - 160 },
      )
      .text(`célébrée le ${dateFormatee}.`, 0, 345, { align: 'center', width: W });

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
