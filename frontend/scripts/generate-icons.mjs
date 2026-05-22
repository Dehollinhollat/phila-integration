// scripts/generate-icons.mjs
// Génère toutes les icônes PWA depuis le logo Phila haute résolution.
// Utilise sharp (traitement d'image natif via libvips) pour des sorties PNG sans perte.
//
// Fond : bleu Phila #1A56B0 (r:26 g:86 b:176).
// Un fond blanc transparent donnait un carré noir sur Android (le launcher remplace
// la transparence par du noir quand l'icône n'est pas déclarée "maskable" avec fond).
// Le bleu Phila garantit un rendu cohérent sur tous les launchers Android et iOS.
//
// Usage : node scripts/generate-icons.mjs

import sharp from 'sharp';
import { mkdirSync } from 'fs';

mkdirSync('./public/icons', { recursive: true });

const SOURCE = './src/assets/images/LOGO-PHILA-BLEU.png';
const SIZES  = [72, 96, 128, 144, 152, 192, 384, 512];

for (const size of SIZES) {
  await sharp(SOURCE)
    .resize(size, size, {
      fit:        'contain',
      background: { r: 26, g: 86, b: 176, alpha: 1 } // #1A56B0 — bleu Phila, // fond blanc opaque
    })
    .png()
    .toFile(`./public/icons/icon-${size}x${size}.png`);
  console.log(`✓ Generated ${size}×${size}`);
}

// Apple Touch Icon — 180×180, utilisé par Safari/iOS (même fond bleu)
await sharp(SOURCE)
  .resize(180, 180, {
    fit:        'contain',
    background: { r: 26, g: 86, b: 176, alpha: 1 } // #1A56B0 — bleu Phila,
  })
  .png()
  .toFile('./public/apple-touch-icon.png');

console.log('✓ Generated apple-touch-icon (180×180)');
console.log('All icons generated!');
