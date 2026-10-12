import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const file = path.join(config.dataDir, 'pjgn.json');
fs.mkdirSync(config.dataDir, { recursive: true });

let data = { counters: { casier: 0, dossier: 0 }, casiers: {}, dossiers: {} };
try {
  data = { ...data, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
} catch {
  /* premier démarrage */
}

// Écriture atomique : fichier temporaire puis renommage
function persist() {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

const PREFIX = { casier: 'C', dossier: 'D' };

export function nextId(kind) {
  data.counters[kind] += 1;
  persist();
  return `${PREFIX[kind]}-${String(data.counters[kind]).padStart(4, '0')}`;
}

/** "c-1", "C0001", "1" -> "C-0001" (ou null si invalide) */
export function normalizeId(input, kind) {
  const m = String(input ?? '').trim().toUpperCase().match(/^([CD])?[-\s]?0*(\d{1,6})$/);
  if (!m) return null;
  if (m[1] && m[1] !== PREFIX[kind]) return null;
  return `${PREFIX[kind]}-${m[2].padStart(4, '0')}`;
}

export const getCasier = (id) => data.casiers[id] ?? null;
export const getDossier = (id) => data.dossiers[id] ?? null;
export const allCasiers = () => Object.values(data.casiers);
export const allDossiers = () => Object.values(data.dossiers);

export function saveCasier(record) {
  record.updatedAt = Date.now();
  data.casiers[record.id] = record;
  persist();
}
export function saveDossier(record) {
  record.updatedAt = Date.now();
  data.dossiers[record.id] = record;
  persist();
}

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function findCasierByIdentity(nom, prenom, naissance) {
  return allCasiers().find(
    (c) => norm(c.identite.nom) === norm(nom) && norm(c.identite.prenom) === norm(prenom) && norm(c.identite.naissance) === norm(naissance),
  ) ?? null;
}

export function searchCasiers(query) {
  const q = norm(query);
  return allCasiers()
    .filter((c) => !q || norm([c.id, c.identite.nom, c.identite.prenom, c.identite.affiliation, c.identite.telephone].join(' ')).includes(q))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function searchDossiers(query) {
  const q = norm(query);
  return allDossiers()
    .filter((d) => !q || norm([d.id, d.categoryLabel, ...d.fields.map((f) => f.value)].join(' ')).includes(q))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
