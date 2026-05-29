// src/controllers/import.controller.ts
// Import Excel/CSV de contacts depuis une feuille de calcul structurée.
// Réservé aux rôles admin_campus et super_admin.
//
// Colonnes Excel reconnues (insensible à la casse, espaces ignorés) :
//   CIVILITE, PRENOM, NOM, DATE DE NAISSANCE, CONTACT, EMAIL, CODE POSTAL,
//   CAMPUS, ETAT CIVIL, OUVRIER/MEMBRE, BESOIN PARTICULIER, EGLISE D'ATTACHE,
//   SERVICE DANS CETTE EGLISE, DATE D'ARRIVEE, PRESENCE, DERNIER CONTACT,
//   REFERENT, SUIVI, COMMENTAIRE

import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import prisma from '../lib/prisma';

type ImportError = { ligne: number; raison: string };
type ImportResult = { importes: number; ignores: number; erreurs: ImportError[] };

// ─── Helpers de normalisation ─────────────────────────────────────────────────

function normaliserTelephone(raw: string): string | null {
  if (!raw) return null;
  const clean = raw.replace(/[\s.\-()]/g, '').trim();
  if (/^0\d{9}$/.test(clean)) return '+33' + clean.slice(1);
  if (/^\+[1-9]\d{7,14}$/.test(clean)) return clean;
  return null;
}

function mapGenre(raw: string): 'homme' | 'femme' | null {
  const v = (raw ?? '').toString().trim().toLowerCase();
  if (['m', 'mr', 'm.', 'monsieur', 'homme'].includes(v)) return 'homme';
  if (['mme', 'mme.', 'madame', 'femme'].includes(v)) return 'femme';
  return null;
}

function mapEtatCivil(raw: string): 'celibataire' | 'marie' | 'fiance' | 'divorce' | 'veuf' {
  const v = (raw ?? '').toString().trim().toLowerCase();
  if (v.includes('célib') || v.includes('celib')) return 'celibataire';
  if (v.includes('marié') || v.includes('marie')) return 'marie';
  if (v.includes('fiancé') || v.includes('fiance')) return 'fiance';
  if (v.includes('divorcé') || v.includes('divorce')) return 'divorce';
  if (v.includes('veuf') || v.includes('veuve')) return 'veuf';
  return 'celibataire';
}

function mapCampus(raw: string): 'paris' | 'paris_nord' | null {
  const v = (raw ?? '').toString().trim().toLowerCase().replace(/\s+/g, '');
  if (v === 'paris' || v === 'p') return 'paris';
  if (v.includes('nord') || v === 'pn' || v === 'parisnord') return 'paris_nord';
  return null;
}

function mapStatutProfil(raw: string): {
  statut_phila: 'oui' | 'non' | 'premiere_visite';
  profil: 'membre_phila' | 'visiteur_sans_eglise' | 'visiteur_avec_eglise';
} {
  const v = (raw ?? '').toString().trim().toLowerCase();
  if (v.includes('ouvrier') || v.includes('membre') || v === 'oui' || v === 'o') {
    return { statut_phila: 'oui', profil: 'membre_phila' };
  }
  return { statut_phila: 'non', profil: 'visiteur_sans_eglise' };
}

function parseDate(raw: unknown): Date | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === 'number') {
    // Serial Excel : jours depuis 1900-01-01 (avec bug Lotus 1900-02-29)
    const ms = (raw - 25569) * 86400 * 1000;
    const d  = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === 'string') {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function cell(row: Record<string, unknown>, key: string): string {
  const val = row[key];
  return val !== undefined && val !== null ? String(val).trim() : '';
}

// Normalise les clés de la ligne : MAJUSCULES + espaces uniques
function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.toUpperCase().replace(/\s+/g, ' ').trim()] = v;
  }
  return out;
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function importContacts(req: Request, res: Response): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uploadedFile = (req as any).file as { buffer: Buffer; originalname?: string } | undefined;
  if (!uploadedFile?.buffer) {
    res.status(400).json({ message: 'Fichier manquant (champ "file" attendu en multipart/form-data)' });
    return;
  }

  const result: ImportResult = { importes: 0, ignores: 0, erreurs: [] };

  let rows: Record<string, unknown>[];
  try {
    const workbook = XLSX.read(uploadedFile.buffer, { type: 'buffer', cellDates: true });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    rows = (XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' }))
      .map(normalizeRow);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ message: `Fichier invalide ou illisible : ${msg}` });
    return;
  }

  // Cache des utilisateurs actifs pour résolution du référent par nom
  const users = await prisma.user.findMany({
    where:  { actif: true },
    select: { id: true, prenom: true, nom: true, role: true },
  });

  function findReferent(raw: string): string | null {
    if (!raw) return null;
    const search = raw.trim().toLowerCase();
    const found = users.find(u => {
      const full1 = `${u.prenom} ${u.nom}`.toLowerCase();
      const full2 = `${u.nom} ${u.prenom}`.toLowerCase();
      return full1 === search || full2 === search || u.nom.toLowerCase() === search;
    });
    return found?.id ?? null;
  }

  const auteurId   = req.user!.id;
  const auteurRole = req.user!.role;

  for (let i = 0; i < rows.length; i++) {
    const row  = rows[i];
    const ligne = i + 2; // Numéro de ligne Excel (1 = header)

    try {
      // ── Ligne vide — ignore silencieusement ───────────────────────────────
      if (!cell(row, 'PRENOM') && !cell(row, 'NOM') && !cell(row, 'CONTACT')) continue;

      // ── Téléphone (clé anti-doublon obligatoire) ──────────────────────────
      const telephoneRaw = cell(row, 'CONTACT');
      const telephone = normaliserTelephone(telephoneRaw);
      if (!telephone) {
        result.erreurs.push({ ligne, raison: `Téléphone invalide : "${telephoneRaw}"` });
        continue;
      }

      const exists = await prisma.contact.findUnique({ where: { telephone }, select: { id: true } });
      if (exists) {
        console.log(`[IMPORT] Ligne ${ligne} ignorée — ${telephone} déjà en base`);
        result.ignores++;
        continue;
      }

      // ── Genre obligatoire ─────────────────────────────────────────────────
      const genre = mapGenre(cell(row, 'CIVILITE'));
      if (!genre) {
        result.erreurs.push({ ligne, raison: `CIVILITE invalide : "${cell(row, 'CIVILITE')}" — attendu Monsieur/M ou Madame/Mme` });
        continue;
      }

      // ── Prénom / Nom ──────────────────────────────────────────────────────
      const prenom = cell(row, 'PRENOM');
      const nom    = cell(row, 'NOM');
      if (!prenom || !nom) {
        result.erreurs.push({ ligne, raison: 'PRENOM ou NOM manquant' });
        continue;
      }

      // ── Campus obligatoire ────────────────────────────────────────────────
      const campus = mapCampus(cell(row, 'CAMPUS'));
      if (!campus) {
        result.erreurs.push({ ligne, raison: `CAMPUS invalide : "${cell(row, 'CAMPUS')}" — attendu Paris ou Paris Nord` });
        continue;
      }

      // ── Champs mappés ─────────────────────────────────────────────────────
      const etatCivil          = mapEtatCivil(cell(row, 'ETAT CIVIL'));
      const { statut_phila, profil } = mapStatutProfil(cell(row, 'OUVRIER/MEMBRE'));

      const emailVal           = cell(row, 'EMAIL') || null;
      const codePostal         = cell(row, 'CODE POSTAL') || null;
      const dateNaissance      = parseDate(row['DATE DE NAISSANCE']);
      const dateInscription    = parseDate(row["DATE D'ARRIVEE"]) ?? new Date();
      const derniereInteraction = parseDate(row['DERNIER CONTACT']);

      const egliseAttache      = cell(row, "EGLISE D'ATTACHE") || null;
      const serviceEglise      = cell(row, 'SERVICE DANS CETTE EGLISE') || null;
      const autreEglise        = egliseAttache !== null;

      const besoinParticulier  = cell(row, 'BESOIN PARTICULIER') || null;
      const presence           = cell(row, 'PRESENCE') || null;
      const suivi              = cell(row, 'SUIVI') || null;
      const commentaireTexte   = cell(row, 'COMMENTAIRE') || null;

      const referentId         = findReferent(cell(row, 'REFERENT'));

      // ville non présente dans le fichier — on infère depuis code_postal ou défaut
      const ville = codePostal ? `CP ${codePostal}` : 'Non renseigné';

      // ── Création du contact ───────────────────────────────────────────────
      const contact = await prisma.contact.create({
        data: {
          genre,
          prenom,
          nom,
          telephone,
          email:                emailVal,
          code_postal:          codePostal,
          date_naissance:       dateNaissance ?? undefined,
          ville,
          etat_civil:           etatCivil,
          statut_phila,
          profil,
          campus,
          canal:                'presentiel',
          consentement_rgpd:    true,
          saisi_par_membre:     true,
          date_inscription:     dateInscription,
          derniere_interaction: derniereInteraction ?? undefined,
          nom_autre_eglise:     egliseAttache ?? undefined,
          autre_eglise:         autreEglise || undefined,
          service_autre_eglise: serviceEglise ?? undefined,
          besoin_particulier:   besoinParticulier ?? undefined,
          presence:             presence ?? undefined,
          suivi:                suivi ?? undefined,
          referent_integration_id: referentId ?? undefined,
        },
      });

      // ── Commentaire initial ───────────────────────────────────────────────
      if (commentaireTexte) {
        await prisma.commentaire.create({
          data: {
            contact_id:  contact.id,
            auteur_id:   auteurId,
            role_auteur: auteurRole as never,
            contenu:     commentaireTexte,
          },
        });
      }

      result.importes++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.erreurs.push({ ligne, raison: `Erreur inattendue : ${msg}` });
    }
  }

  console.log(`[IMPORT] Terminé — importés:${result.importes} ignorés:${result.ignores} erreurs:${result.erreurs.length}`);
  res.json(result);
}
