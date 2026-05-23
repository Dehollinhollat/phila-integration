import 'dotenv/config';
import prisma from '../src/lib/prisma';
import crypto from 'crypto';

async function main() {
  const contact = await prisma.contact.findFirst();
  if (!contact) { console.log('Aucun contact en base'); return; }

  const token = crypto.randomBytes(32).toString('hex');
  await prisma.feedbackToken.create({
    data: {
      contact_id: contact.id,
      token,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  console.log(`Contact : ${contact.prenom} ${contact.nom}`);
  console.log('Lien local :');
  console.log(`http://localhost:5173/form/feedback/${token}`);
  console.log('Lien production :');
  console.log(`https://phila-integration-five.vercel.app/form/feedback/${token}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
