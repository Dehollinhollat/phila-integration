// scripts/generate-icons.mjs
// Génère toutes les icônes PWA depuis le logo Phila haute résolution.
// Utilise sharp (traitement d'image natif via libvips) pour des sorties PNG sans perte.
// Fond blanc pour les tailles standard ; les icônes 192 et 512 sont aussi "maskable"
// (Android les recadre dans un cercle/carré selon le launcher).
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
      background: { r: 255, g: 255, b: 255, alpha: 1 }, // fond blanc opaque
    })
    .png()
    .toFile(`./public/icons/icon-${size}x${size}.png`);
  console.log(`✓ Generated ${size}×${size}`);
}

// Apple Touch Icon — 180×180, utilisé par Safari/iOS
await sharp(SOURCE)
  .resize(180, 180, {
    fit:        'contain',
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  })
  .png()
  .toFile('./public/apple-touch-icon.png');

console.log('✓ Generated apple-touch-icon (180×180)');
console.log('All icons generated!');
