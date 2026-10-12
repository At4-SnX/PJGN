import { casierMessage, casierThreadName, dossierMessage, dossierThreadName, entryMessage } from './render.js';
import * as store from './store.js';
import { UserError, getThread, safeRename } from './utils.js';

/**
 * Met à jour la fiche (premier message) du casier et le nom du fil.
 * `post` : message supplémentaire à publier dans le fil (mention, lien…).
 */
export async function refreshCasier(client, c, { post } = {}) {
  const thread = await getThread(client, c.threadId);
  if (post) await thread.send(post);
  const starter = await thread.fetchStarterMessage();
  await starter.edit(casierMessage(c));
  await safeRename(thread, casierThreadName(c));
  return thread;
}

export async function refreshDossier(client, d, { post } = {}) {
  const thread = await getThread(client, d.threadId);
  if (post) await thread.send(post);
  const starter = await thread.fetchStarterMessage();
  await starter.edit(dossierMessage(d));
  await safeRename(thread, dossierThreadName(d));
  return thread;
}

/** Lie un casier et un dossier dans les deux sens (met à jour le rôle si déjà lié). */
export async function linkRecords(client, casierId, dossierId, role, userId) {
  const c0 = store.getCasier(casierId);
  const d0 = store.getDossier(dossierId);
  if (!c0) throw new UserError(`Le casier **${casierId}** n'existe pas.`);
  if (!d0) throw new UserError(`Le dossier **${dossierId}** n'existe pas.`);

  const c = structuredClone(c0);
  const d = structuredClone(d0);

  c.dossiers = c.dossiers ?? [];
  if (!c.dossiers.includes(d.id)) c.dossiers.push(d.id);

  d.casiers = d.casiers ?? [];
  const existing = d.casiers.find((l) => l.id === c.id);
  if (existing) existing.role = role || existing.role;
  else d.casiers.push({ id: c.id, role: role || '' });

  const at = Date.now();
  const mk = (heading, subheading, other) =>
    entryMessage({
      heading,
      subheading,
      values: [
        { label: 'Élément lié', value: other },
        { label: 'Rôle dans l\'affaire', value: role },
      ],
      by: userId,
      at,
    });

  await refreshCasier(client, c, { post: mk('LIEN AVEC UN DOSSIER', c.id, `<#${d.threadId}> **${d.id}**`) });
  await refreshDossier(client, d, { post: mk('LIEN AVEC UN CASIER', d.id, `<#${c.threadId}> **${c.id}**`) });

  store.saveCasier(c);
  store.saveDossier(d);
  return { casier: c, dossier: d };
}
