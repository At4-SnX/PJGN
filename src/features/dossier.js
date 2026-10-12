import { MessageFlags } from 'discord.js';
import {
  categories, dossierEntryTypes, emojis, menaces, openFieldsFor, statutsDossier,
} from '../config.js';
import { dossierMessage, dossierThreadName, entryMessage } from '../render.js';
import * as store from '../store.js';
import { asEdit, buildNotice } from '../ui.js';
import { linkRecords, refreshDossier } from '../sync.js';
import {
  UserError, audit, buildModal, fetchForum, find, guard, readValues, selectReply, toFieldList, valuesFromList,
} from '../utils.js';

const linkFields = [
  { id: 'casier', label: 'N° du casier (ex : C-0001)', max: 12 },
  { id: 'role', label: 'Rôle dans l\'affaire', max: 100, required: false, placeholder: 'Suspect, témoin, victime, chef…' },
];

const need = (record, id) => {
  if (!record) throw new UserError(`Le dossier **${id}** est introuvable.`);
  return structuredClone(record);
};

export async function handleDossier(interaction) {
  const parts = interaction.customId?.split(':');
  if (!parts || parts[0] !== 'dossier') return false;

  const kind = interaction.isButton() ? 'button' : interaction.isStringSelectMenu() ? 'select' : interaction.isModalSubmit() ? 'modal' : null;
  if (!kind) return false;
  if (!(await guard(interaction))) return true;

  const [, action, id, extra] = parts;
  const route = `${kind}:${action}`;

  switch (route) {
    // ── Ouverture : choix de la catégorie puis formulaire ───────────────────
    case 'button:new':
      if (!categories.length) {
        await interaction.reply(buildNotice('Aucune catégorie', 'Aucun forum de dossier n\'est configuré (variables `FORUM_DOSSIER_…`).'));
        return true;
      }
      await selectReply(
        interaction, 'dossier:cat', 'Catégorie du dossier',
        categories.map((c) => ({ value: c.key, label: c.label, emoji: c.emoji, description: c.description })),
        '**Nouveau dossier** — choisissez la catégorie (chaque catégorie a son propre forum) :',
      );
      return true;
    case 'select:cat': {
      const cat = categories.find((c) => c.key === interaction.values[0]);
      if (!cat) throw new UserError('Catégorie inconnue.');
      await interaction.showModal(buildModal(`dossier:create:${cat.key}`, `${cat.label}`, cat.fields));
      return true;
    }
    case 'modal:create':
      await createDossier(interaction, id);
      return true;

    // ── Ajout d'un élément ─────────────────────────────────────────────────
    case 'select:add': {
      const d = need(store.getDossier(id), id);
      const type = dossierEntryTypes.find((t) => t.key === interaction.values[0] && (!t.only || t.only.includes(d.category)));
      if (!type) throw new UserError('Type d\'élément inconnu.');
      await interaction.showModal(buildModal(`dossier:entry:${id}:${type.key}`, type.label, type.fields));
      return true;
    }
    case 'modal:entry':
      await addEntry(interaction, id, extra);
      return true;

    // ── Statut / menace ────────────────────────────────────────────────────
    case 'button:status':
      need(store.getDossier(id), id);
      await selectReply(interaction, `dossier:setstatus:${id}`, 'Nouveau statut', statutsDossier, `**${id}** — choisissez le nouveau statut :`);
      return true;
    case 'select:setstatus':
      await setField(interaction, id, 'statut', statutsDossier, 'Statut');
      return true;
    case 'button:menace':
      need(store.getDossier(id), id);
      await selectReply(interaction, `dossier:setmenace:${id}`, 'Niveau de menace', menaces, `**${id}** — choisissez le niveau de menace :`);
      return true;
    case 'select:setmenace':
      await setField(interaction, id, 'menace', menaces, 'Niveau de menace');
      return true;

    // ── Modification des informations d'ouverture ──────────────────────────
    case 'button:edit': {
      const d = need(store.getDossier(id), id);
      await interaction.showModal(buildModal(`dossier:saveedit:${id}`, 'Modifier le dossier', openFieldsFor(d.category), valuesFromList(d.fields)));
      return true;
    }
    case 'modal:saveedit': {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const d = need(store.getDossier(id), id);
      const defs = openFieldsFor(d.category);
      d.fields = toFieldList(defs, readValues(interaction, defs));
      await refreshDossier(interaction.client, d);
      store.saveDossier(d);
      await audit(interaction.client, `${emojis.engrenage} **Dossier modifié** : **${d.id}** par <@${interaction.user.id}> — <#${d.threadId}>`);
      await interaction.editReply(asEdit(buildNotice('Dossier modifié', `Les informations du dossier **${d.id}** ont été mises à jour.`)));
      return true;
    }

    // ── Lien avec un casier ────────────────────────────────────────────────
    case 'button:link':
      need(store.getDossier(id), id);
      await interaction.showModal(buildModal(`dossier:savelink:${id}`, 'Lier un casier', linkFields));
      return true;
    case 'modal:savelink': {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const v = readValues(interaction, linkFields);
      const casierId = store.normalizeId(v.casier, 'casier');
      if (!casierId) throw new UserError('Numéro de casier invalide (format : C-0001).');
      const { casier } = await linkRecords(interaction.client, casierId, id, v.role, interaction.user.id);
      await audit(interaction.client, `${emojis.engrenage} **Lien casier ↔ dossier** : **${casierId}** ↔ **${id}** par <@${interaction.user.id}>`);
      await interaction.editReply(asEdit(buildNotice('Lien établi', `Le dossier **${id}** est lié au casier <#${casier.threadId}> **${casierId}**.`)));
      return true;
    }
    default:
      return false;
  }
}

// ─── Création ────────────────────────────────────────────────────────────────
async function createDossier(interaction, catKey) {
  const cat = categories.find((c) => c.key === catKey);
  if (!cat) throw new UserError('Catégorie inconnue.');
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const values = readValues(interaction, cat.fields);
  const forum = await fetchForum(interaction.guild, cat.forumId);
  const now = Date.now();

  const record = {
    id: store.nextId('dossier'),
    threadId: null,
    category: cat.key,
    categoryLabel: cat.label,
    categoryEmoji: cat.emoji,
    statut: 'ouvert',
    menace: 'faible',
    fields: toFieldList(cat.fields, values),
    entries: [],
    casiers: [],
    createdBy: interaction.user.id,
    createdAt: now,
    updatedAt: now,
  };

  const thread = await forum.threads.create({
    name: dossierThreadName(record),
    autoArchiveDuration: 10080,
    message: dossierMessage(record),
  });
  record.threadId = thread.id;
  store.saveDossier(record);

  await audit(interaction.client, `${emojis.engrenage} **Dossier ouvert** : **${record.id}** (${cat.emoji} ${cat.label}) par <@${interaction.user.id}> — <#${thread.id}>`);
  await interaction.editReply(
    asEdit(buildNotice('Dossier ouvert', `Le dossier **${record.id}** a été créé dans le forum **${cat.label}** : ${thread}\nAjoutez membres, véhicules, lieux, saisies et rapports depuis la fiche.`)),
  );
}

// ─── Éléments ────────────────────────────────────────────────────────────────
async function addEntry(interaction, id, typeKey) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const d = need(store.getDossier(id), id);
  const type = dossierEntryTypes.find((t) => t.key === typeKey && (!t.only || t.only.includes(d.category)));
  if (!type) throw new UserError('Type d\'élément inconnu.');

  const raw = readValues(interaction, type.fields);

  // Suspect / membre : lien automatique avec le casier indiqué
  let casierId = null;
  if (type.key === 'membre' && raw.casier) {
    casierId = store.normalizeId(raw.casier, 'casier');
    if (!casierId || !store.getCasier(casierId)) throw new UserError(`Le casier « ${raw.casier} » est introuvable. Corrigez le numéro ou laissez le champ vide.`);
    raw.casier = casierId;
  }

  const values = toFieldList(type.fields, raw);
  const entry = { n: d.entries.length + 1, type: type.key, values, by: interaction.user.id, at: Date.now() };
  d.entries.push(entry);

  const post = entryMessage({
    heading: `${type.emoji} ${type.label.toUpperCase()}`,
    subheading: `Dossier ${d.id} • Élément n°${entry.n}`,
    color: type.color,
    values: values.map((v) => (v.id === 'casier' && v.value ? { ...v, value: `<#${store.getCasier(v.value).threadId}> **${v.value}**` } : v)),
    by: entry.by,
    at: entry.at,
  });
  await refreshDossier(interaction.client, d, { post });
  store.saveDossier(d);

  if (casierId) await linkRecords(interaction.client, casierId, d.id, raw.role, interaction.user.id);

  await audit(interaction.client, `${type.emoji} **${type.label}** ajouté(e) au dossier **${d.id}** par <@${interaction.user.id}> — <#${d.threadId}>`);
  await interaction.editReply(asEdit(buildNotice('Élément enregistré', `${type.emoji} ${type.label} ajouté(e) au dossier **${d.id}**${casierId ? `\nLe casier **${casierId}** a été lié automatiquement.` : ''}`)));
}

// ─── Statut / menace ─────────────────────────────────────────────────────────
async function setField(interaction, id, field, list, label) {
  const option = find(list, interaction.values[0]);
  if (option.restricted && !(await guard(interaction, 'manage'))) return;

  await interaction.deferUpdate();
  const d = need(store.getDossier(id), id);
  d[field] = option.value;
  await refreshDossier(interaction.client, d);
  store.saveDossier(d);

  await audit(interaction.client, `${emojis.engrenage} **${label}** du dossier **${d.id}** → ${option.emoji} **${option.label}** par <@${interaction.user.id}>`);
  await interaction.editReply({ content: `✅ ${label} du dossier **${d.id}** : ${option.emoji} **${option.label}**`, components: [] });
}
