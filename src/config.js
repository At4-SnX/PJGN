import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = process.env;

// ─── Variables obligatoires ────────────────────────────────────────────────
const required = ['DISCORD_TOKEN', 'GUILD_ID', 'ROLE_PJGN_ID', 'FORUM_CASIERS_ID'];
const missing = required.filter((k) => !env[k]);
if (missing.length) {
  console.error(`[CONFIG] Variables manquantes : ${missing.join(', ')}`);
  process.exit(1);
}

export const config = {
  token: env.DISCORD_TOKEN,
  guildId: env.GUILD_ID,
  dataDir: path.resolve(root, env.DATA_DIR || './data'),
  logChannelId: env.LOG_CHANNEL_ID || null,
  roles: {
    pjgn: env.ROLE_PJGN_ID,
    responsable: env.ROLE_RESPONSABLE_ID || null,
  },
  forums: { casiers: env.FORUM_CASIERS_ID },
};

// ─── Thème ─────────────────────────────────────────────────────────────────
export const theme = { color: 0x1f3a93, footer: 'Gendarmerie Nationale • PJGN' };

export const stream = {
  name: 'Gendarmerie Nationale',
  url: env.STREAM_URL || 'https://www.twitch.tv/gendarmerienationale',
};

export const assets = {
  pjgn: { file: path.join(root, 'assets', 'pjgn.png'), name: 'pjgn.png' },
};

// Emojis personnalisés (le bot doit être sur le serveur qui les héberge).
export const emojis = {
  exc: '<:exc:1541213944364924999>',
  fleche: '<:fleche:1541035911976853535>',
  engrenage: '<:engrenage:1541036952462032916>',
};
const { fleche, engrenage } = emojis;

// ─── Texte du panneau ──────────────────────────────────────────────────────
export const texts = {
  panel: {
    title: ' PÔLE JUDICIAIRE DE LA GENDARMERIE NATIONALE',
    description:
      `> ${fleche} Le **__PJGN__** centralise les **__casiers judiciaires__** et les **__dossiers d'enquête__** de la Gendarmerie Nationale.\n\n` +
      `${engrenage} **__Casiers judiciaires__** : ouverture de fiches, condamnations, gardes à vue, amendes, mandats et observations.\n` +
      `${engrenage} **__Dossiers d'enquête__** : gangs, trafics, braquages, violences… chaque catégorie est archivée dans son **__forum dédié__**.\n\n` +
      `> ${fleche} Accès **__strictement réservé__** aux membres du PJGN. Toute action est **__tracée__**.`,
    buttons: {
      casier: 'Ouvrir un casier',
      dossier: 'Ouvrir un dossier',
      recherche: 'Rechercher',
    },
  },
};

// ─── Outil de déclaration des champs de formulaire ─────────────────────────
// f(id, label, { max, long, required, placeholder })  — label : 45 caractères max (limite Discord)
const f = (id, label, opts = {}) => ({ id, label, ...opts });

// ═══════════════════════════════════════════════════════════════════════════
//  CASIERS JUDICIAIRES
// ═══════════════════════════════════════════════════════════════════════════
export const statutsCasier = [
  { value: 'actif', label: 'Casier actif', emoji: '🔵', color: 0x1f3a93 },
  { value: 'surveille', label: 'Sous surveillance', emoji: '🟠', color: 0xe67e22 },
  { value: 'recherche', label: 'Recherché', emoji: '🔴', color: 0xc0392b },
  { value: 'incarcere', label: 'Incarcéré', emoji: '⚫', color: 0x2c2f33 },
  { value: 'archive', label: 'Archivé', emoji: '⚪', color: 0x7f8c8d, restricted: true },
];

export const dangerosites = [
  { value: 'faible', label: 'Faible', emoji: '🟢' },
  { value: 'moderee', label: 'Modérée', emoji: '🟡' },
  { value: 'elevee', label: 'Élevée', emoji: '🟠' },
  { value: 'critique', label: 'Critique', emoji: '🔴' },
];

export const casierIdentiteFields = [
  f('prenom', 'Prénom RP', { max: 40 }),
  f('nom', 'Nom RP', { max: 40 }),
  f('naissance', 'Date de naissance RP', { max: 30, placeholder: 'JJ/MM/AAAA' }),
  f('nationalite', 'Nationalité', { max: 40 }),
  f('adresse', 'Adresse / domicile', { max: 120, required: false }),
];

export const casierComplementsFields = [
  f('telephone', 'Numéro de téléphone', { max: 30, required: false }),
  f('profession', 'Profession / employeur', { max: 80, required: false }),
  f('description', 'Description physique / signes distinctifs', { max: 500, long: true, required: false }),
  f('photo', 'Photo (lien d\'image)', { max: 400, required: false, placeholder: 'https://…' }),
  f('affiliation', 'Alias / affiliation (gang…)', { max: 150, required: false }),
];

// Types de mentions ajoutables à un casier (liste déroulante sur la fiche).
export const casierEntryTypes = [
  {
    key: 'infraction', label: 'Condamnation / infraction', emoji: '⚖️', color: 0xc0392b,
    fields: [
      f('infractions', 'Infraction(s) retenue(s)', { max: 200 }),
      f('faits', 'Date et lieu des faits', { max: 150 }),
      f('sanction', 'Sanction prononcée', { max: 200, placeholder: 'Ex : 3 mois ferme + 1 500 € d\'amende' }),
      f('circonstances', 'Circonstances', { max: 1000, long: true }),
      f('preuves', 'Preuves / dossier lié', { max: 500, long: true, required: false }),
    ],
  },
  {
    key: 'gav', label: 'Garde à vue', emoji: '🔒', color: 0xe67e22,
    fields: [
      f('motif', 'Motif de la garde à vue', { max: 200 }),
      f('debut', 'Date et heure de début', { max: 80 }),
      f('duree', 'Durée', { max: 60 }),
      f('lieu', 'Lieu de rétention / brigade', { max: 100 }),
      f('suites', 'Suites données', { max: 800, long: true, required: false }),
    ],
  },
  {
    key: 'amende', label: 'Amende / contravention', emoji: '🧾', color: 0xf1c40f,
    fields: [
      f('motif', 'Motif', { max: 200 }),
      f('montant', 'Montant', { max: 40 }),
      f('date', 'Date', { max: 60 }),
      f('paiement', 'Statut du paiement', { max: 60, required: false, placeholder: 'Payée / impayée / contestée' }),
      f('details', 'Détails', { max: 600, long: true, required: false }),
    ],
  },
  {
    key: 'mandat', label: 'Mandat / avis de recherche', emoji: '🚨', color: 0xc0392b,
    fields: [
      f('motif', 'Motif du mandat', { max: 250 }),
      f('autorite', 'Autorité émettrice', { max: 100 }),
      f('validite', 'Date d\'émission / validité', { max: 100 }),
      f('consignes', 'Consignes / conduite à tenir', { max: 800, long: true }),
      f('danger', 'Dangerosité / armement connu', { max: 200, required: false }),
    ],
  },
  {
    key: 'levee', label: 'Levée / fin de peine', emoji: '✅', color: 0x27ae60,
    fields: [
      f('objet', 'Mesure levée / peine purgée', { max: 200 }),
      f('date', 'Date', { max: 60 }),
      f('motif', 'Motif / observations', { max: 600, long: true, required: false }),
    ],
  },
  {
    key: 'observation', label: 'Observation / renseignement', emoji: '📝', color: 0x1f3a93,
    fields: [
      f('titre', 'Objet', { max: 100 }),
      f('contenu', 'Contenu', { max: 1500, long: true }),
      f('source', 'Source / fiabilité', { max: 100, required: false }),
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
//  DOSSIERS D'ENQUÊTE
// ═══════════════════════════════════════════════════════════════════════════
export const statutsDossier = [
  { value: 'ouvert', label: 'Ouvert', emoji: '🔵', color: 0x1f3a93 },
  { value: 'enquete', label: 'Enquête en cours', emoji: '🟡', color: 0xf1c40f },
  { value: 'surveillance', label: 'Sous surveillance', emoji: '🟠', color: 0xe67e22 },
  { value: 'transmis', label: 'Transmis à la justice', emoji: '🟣', color: 0x8e44ad },
  { value: 'classe', label: 'Classé sans suite', emoji: '⚪', color: 0x7f8c8d, restricted: true },
  { value: 'clos', label: 'Clos', emoji: '⚫', color: 0x2c2f33, restricted: true },
];

export const menaces = [
  { value: 'faible', label: 'Faible', emoji: '🟢' },
  { value: 'moderee', label: 'Modérée', emoji: '🟡' },
  { value: 'elevee', label: 'Élevée', emoji: '🟠' },
  { value: 'critique', label: 'Critique', emoji: '🔴' },
];

// Formulaires d'ouverture (5 champs max par formulaire Discord)
const openDefault = [
  f('titre', 'Intitulé de l\'affaire', { max: 100 }),
  f('lieu', 'Lieu / secteur', { max: 100 }),
  f('date', 'Date et heure des faits', { max: 100 }),
  f('suspects', 'Suspect(s) / personnes d\'intérêt', { max: 200, required: false }),
  f('resume', 'Résumé des faits', { max: 1000, long: true }),
];
const openGang = [
  f('titre', 'Nom du gang / de l\'organisation', { max: 100 }),
  f('zone', 'Zone d\'influence / territoire', { max: 150 }),
  f('chefs', 'Chef(s) et lieutenants connus', { max: 200, required: false }),
  f('effectif', 'Effectif estimé', { max: 100, required: false }),
  f('activites', 'Activités criminelles connues', { max: 1000, long: true }),
];
const openTrafic = [
  f('titre', 'Intitulé de l\'affaire', { max: 100 }),
  f('zone', 'Secteur / points de deal', { max: 150 }),
  f('produits', 'Produits / armes et quantités', { max: 200 }),
  f('reseau', 'Réseau / suspects connus', { max: 200, required: false }),
  f('resume', 'Résumé des faits', { max: 1000, long: true }),
];
const openDisparition = [
  f('titre', 'Intitulé du dossier', { max: 100 }),
  f('personne', 'Personne disparue / enlevée', { max: 150 }),
  f('lieu', 'Dernier lieu connu', { max: 100 }),
  f('date', 'Date de disparition', { max: 100 }),
  f('resume', 'Circonstances', { max: 1000, long: true }),
];

// Une catégorie = un forum. Elle n'apparaît que si sa variable de forum est renseignée.
const allCategories = [
  { key: 'gang', label: 'Gangs & organisations criminelles', emoji: '🏴', description: 'Groupes structurés, territoires, hiérarchie', forumId: env.FORUM_DOSSIER_GANG_ID, fields: openGang },
  { key: 'stup', label: 'Trafic de stupéfiants', emoji: '💊', description: 'Réseaux, points de deal, saisies', forumId: env.FORUM_DOSSIER_STUPEFIANTS_ID, fields: openTrafic },
  { key: 'armes', label: 'Trafic d\'armes', emoji: '🔫', description: 'Armes illégales, filières, détention', forumId: env.FORUM_DOSSIER_ARMES_ID, fields: openTrafic },
  { key: 'braquage', label: 'Braquages & vols aggravés', emoji: '💰', description: 'Banques, commerces, convois, cambriolages', forumId: env.FORUM_DOSSIER_BRAQUAGES_ID, fields: openDefault },
  { key: 'violences', label: 'Homicides & violences', emoji: '🩸', description: 'Meurtres, agressions, séquestrations', forumId: env.FORUM_DOSSIER_VIOLENCES_ID, fields: openDefault },
  { key: 'financier', label: 'Fraudes & blanchiment', emoji: '🏦', description: 'Escroqueries, faux, blanchiment d\'argent', forumId: env.FORUM_DOSSIER_FINANCIER_ID, fields: openDefault },
  { key: 'disparition', label: 'Disparitions & enlèvements', emoji: '🔎', description: 'Personnes disparues, enlèvements', forumId: env.FORUM_DOSSIER_DISPARITIONS_ID, fields: openDisparition },
  { key: 'renseignement', label: 'Renseignement & surveillance', emoji: '🛰️', description: 'Surveillances, filatures, écoutes', forumId: env.FORUM_DOSSIER_RENSEIGNEMENT_ID, fields: openDefault },
  { key: 'autre', label: 'Autres enquêtes', emoji: '📁', description: 'Toute autre affaire judiciaire', forumId: env.FORUM_DOSSIER_AUTRES_ID, fields: openDefault },
];
export const categories = allCategories.filter((c) => c.forumId);
export const openFieldsFor = (key) => allCategories.find((c) => c.key === key)?.fields ?? openDefault;

// Éléments ajoutables à un dossier (liste déroulante sur la fiche).
// `only: ['gang']` limite un type à certaines catégories.
export const dossierEntryTypes = [
  {
    key: 'membre', label: 'Suspect / membre', emoji: '👤', color: 0xc0392b,
    fields: [
      f('identite', 'Nom et prénom RP / alias', { max: 120 }),
      f('role', 'Rôle / grade / fonction', { max: 100 }),
      f('casier', 'N° de casier lié (C-0000)', { max: 12, required: false, placeholder: 'Lie automatiquement le casier au dossier' }),
      f('localisation', 'Dernière localisation connue', { max: 150, required: false }),
      f('description', 'Description / signes distinctifs', { max: 500, long: true, required: false }),
    ],
  },
  {
    key: 'victime', label: 'Victime', emoji: '🩹', color: 0x3498db,
    fields: [
      f('nom', 'Nom et prénom RP', { max: 120 }),
      f('etat', 'État / préjudice subi', { max: 200 }),
      f('contact', 'Coordonnées / suivi', { max: 150, required: false }),
      f('details', 'Déclaration / détails', { max: 800, long: true, required: false }),
    ],
  },
  {
    key: 'temoin', label: 'Témoin', emoji: '🗣️', color: 0x3498db,
    fields: [
      f('identite', 'Nom et prénom RP', { max: 120 }),
      f('statut', 'Statut du témoin', { max: 80, placeholder: 'Identifié / anonyme / protégé' }),
      f('contact', 'Coordonnées', { max: 150, required: false }),
      f('deposition', 'Déposition (résumé)', { max: 1000, long: true }),
      f('fiabilite', 'Fiabilité estimée', { max: 100, required: false }),
    ],
  },
  {
    key: 'vehicule', label: 'Véhicule', emoji: '🚗', color: 0x7f8c8d,
    fields: [
      f('modele', 'Marque / modèle / couleur', { max: 120 }),
      f('plaque', 'Plaque d\'immatriculation', { max: 30 }),
      f('proprietaire', 'Propriétaire / utilisateur', { max: 120, required: false }),
      f('usage', 'Usage constaté', { max: 200, required: false }),
      f('details', 'Détails', { max: 600, long: true, required: false }),
    ],
  },
  {
    key: 'lieu', label: 'Lieu / repaire', emoji: '📍', color: 0xe67e22,
    fields: [
      f('nom', 'Nom du lieu', { max: 100 }),
      f('adresse', 'Adresse / secteur', { max: 150 }),
      f('nature', 'Nature', { max: 100, placeholder: 'QG, planque, point de deal, atelier…' }),
      f('surveillance', 'Dispositif de surveillance', { max: 200, required: false }),
      f('details', 'Détails', { max: 600, long: true, required: false }),
    ],
  },
  {
    key: 'saisie', label: 'Pièce à conviction / saisie', emoji: '📦', color: 0x8e44ad,
    fields: [
      f('objet', 'Objet saisi', { max: 150 }),
      f('quantite', 'Quantité', { max: 60 }),
      f('lieu', 'Lieu et date de saisie', { max: 150 }),
      f('scelle', 'N° de scellé', { max: 60, required: false }),
      f('details', 'Détails', { max: 600, long: true, required: false }),
    ],
  },
  {
    key: 'evenement', label: 'Chronologie / fait constaté', emoji: '🕒', color: 0x1f3a93,
    fields: [
      f('date', 'Date et heure', { max: 80 }),
      f('lieu', 'Lieu', { max: 100 }),
      f('titre', 'Fait constaté', { max: 150 }),
      f('details', 'Détails', { max: 1000, long: true, required: false }),
    ],
  },
  {
    key: 'renseignement', label: 'Note de renseignement', emoji: '🛰️', color: 0x1f3a93,
    fields: [
      f('titre', 'Objet', { max: 100 }),
      f('source', 'Source / fiabilité', { max: 100, placeholder: 'Ex : B2 — source fiable, info probable' }),
      f('contenu', 'Contenu', { max: 1500, long: true }),
      f('exploitation', 'Suites à donner', { max: 300, required: false }),
    ],
  },
  {
    key: 'rapport', label: 'Rapport d\'enquête', emoji: '📋', color: 0x1f3a93,
    fields: [
      f('titre', 'Titre du rapport', { max: 100 }),
      f('contenu', 'Contenu', { max: 2000, long: true }),
      f('conclusion', 'Conclusion / préconisations', { max: 500, long: true, required: false }),
    ],
  },
  {
    key: 'alliance', label: 'Alliance / rivalité', emoji: '⚔️', color: 0xc0392b, only: ['gang'],
    fields: [
      f('groupe', 'Groupe concerné', { max: 100 }),
      f('nature', 'Nature de la relation', { max: 80, placeholder: 'Allié / rival / neutre / en guerre' }),
      f('details', 'Détails', { max: 800, long: true, required: false }),
    ],
  },
];
