import { MessageFlags } from 'discord.js';
import {
  casierComplementsFields, casierEntryTypes, casierIdentiteFields, config, dangerosites, emojis, statutsCasier,
} from '../config.js';
import { casierMessage, casierThreadName, entryMessage } from '../render.js';
import * as store from '../store.js';
import { asEdit, buildNotice } from '../ui.js';
import { linkRecords, refreshCasier } from '../sync.js';
import {
  UserError, audit, buildModal, fetchForum, find, guard, readValues, selectReply, toFieldList,
} from '../utils.js';

const linkFields = [
  { id: 'dossier', label: 'N° du dossier (ex : D-0001)', max: 12 },
  { id: 'role', label: 'Rôle dans l\'affaire', max: 100, required: false, placeholder: 'Suspect, témoin, victime, chef…' },
];

const need = (record, id) => {
  if (!record) throw new UserError(`Le casier **${id}** est introuvable.`);
  return structuredClone(record);
};

export async function handleCasier(interaction) {
  const parts = interaction.customId?.split(':');
  if (!parts || parts[0] !== 'casier') return false;

  const kind = interaction.isButton() ? 'button' : interaction.isStringSelectMenu() ? 'select' : interaction.isModalSubmit() ? 'modal' : null;
  if (!kind) return false;
  if (!(await guard(interaction))) return true;

  const [, action, id, extra] = parts;
  const route = `${kind}:${action}`;

  switch (route) {
    // ── Ouverture d'un casier (bouton du panneau) ───────────────────────────
    case 'button:new':
      await interaction.showModal(buildModal('casier:create', 'Ouverture d\'un casier', casierIdentiteFields));
      return true;
    case 'modal:create':
      await createCasier(interaction);
      return true;

    // ── Ajout d'une mention ────────────────────────────────────────────────
    case 'select:add': {
      need(store.getCasier(id), id);
      const type = casierEntryTypes.find((t) => t.key === interaction.values[0]);
      if (!type) throw new UserError('Type de mention inconnu.');
      await interaction.showModal(buildModal(`casier:entry:${id}:${type.key}`, type.label, type.fields));
      return true;
    }
    case 'modal:entry':
      await addEntry(interaction, id, extra);
      return true;

    // ── Statut / dangerosité ───────────────────────────────────────────────
    case 'button:status':
      need(store.getCasier(id), id);
      await selectReply(interaction, `casier:setstatus:${id}`, 'Nouveau statut', statutsCasier, `**${id}** — choisissez le nouveau statut :`);
      return true;
    case 'select:setstatus':
      await setField(interaction, id, 'statut', statutsCasier, 'Statut');
      return true;
    case 'button:danger':
      need(store.getCasier(id), id);
      await selectReply(interaction, `casier:setdanger:${id}`, 'Niveau de dangerosité', dangerosites, `**${id}** — choisissez la dangerosité :`);
      return true;
    case 'select:setdanger':
      await setField(interaction, id, 'dangerosite', dangerosites, 'Dangerosité');
      return true;

    // ── Modification de la fiche ───────────────────────────────────────────
    case 'button:identite': {
      const c = need(store.getCasier(id), id);
      await interaction.showModal(buildModal(`casier:saveidentite:${id}`, 'Identité', casierIdentiteFields, c.identite));
      return true;
    }
    case 'modal:saveidentite':
      await saveIdentity(interaction, id, casierIdentiteFields, 'Identité mise à jour');
      return true;
    case 'button:complements': {
      const c = need(store.getCasier(id), id);
      await interaction.showModal(buildModal(`casier:savecompl:${id}`, 'Compléments de la fiche', casierComplementsFields, c.identite));
      return true;
    }
    case 'modal:savecompl':
      await saveIdentity(interaction, id, casierComplementsFields, 'Fiche complétée');
      return true;

    // ── Lien avec un dossier ───────────────────────────────────────────────
    case 'button:link':
      need(store.getCasier(id), id);
      await interaction.showModal(buildModal(`casier:savelink:${id}`, 'Lier à un dossier', linkFields));
      return true;
    case 'modal:savelink': {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const v = readValues(interaction, linkFields);
      const dossierId = store.normalizeId(v.dossier, 'dossier');
      if (!dossierId) throw new UserError('Numéro de dossier invalide (format : D-0001).');
      const { dossier } = await linkRecords(interaction.client, id, dossierId, v.role, interaction.user.id);
      await audit(interaction.client, `${emojis.engrenage} **Lien casier ↔ dossier** : **${id}** ↔ **${dossierId}** par <@${interaction.user.id}>`);
      await interaction.editReply(asEdit(buildNotice('Lien établi', `Le casier **${id}** est lié au dossier <#${dossier.threadId}> **${dossierId}**.`)));
      return true;
    }
    default:
      return false;
  }
}

// ─── Création ────────────────────────────────────────────────────────────────
async function createCasier(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const v = readValues(interaction, casierIdentiteFields);

  const dup = store.findCasierByIdentity(v.nom, v.prenom, v.naissance);
  if (dup) {
    await interaction.editReply(asEdit(buildNotice('Casier déjà existant', `Un casier existe déjà pour cette identité : <#${dup.threadId}> **${dup.id}**.`)));
    return;
  }

  const forum = await fetchForum(interaction.guild, config.forums.casiers);
  const now = Date.now();
  const record = {
    id: store.nextId('casier'),
    threadId: null,
    statut: 'actif',
    dangerosite: 'faible',
    identite: v,
    entries: [],
    dossiers: [],
    createdBy: interaction.user.id,
    createdAt: now,
    updatedAt: now,
  };

  const thread = await forum.threads.create({
    name: casierThreadName(record),
    autoArchiveDuration: 10080,
    message: casierMessage(record),
  });
  record.threadId = thread.id;
  store.saveCasier(record);

  await audit(interaction.client, `${emojis.engrenage} **Casier ouvert** : **${record.id}** (${record.identite.nom.toUpperCase()} ${record.identite.prenom}) par <@${interaction.user.id}> — <#${thread.id}>`);
  await interaction.editReply(
    asEdit(buildNotice('Casier ouvert', `Le casier **${record.id}** a été créé : ${thread}\nUtilisez les boutons de la fiche pour la **compléter** (photo, description, alias) et y ajouter des mentions.`)),
  );
}

// ─── Mentions ────────────────────────────────────────────────────────────────
async function addEntry(interaction, id, typeKey) {
  const type = casierEntryTypes.find((t) => t.key === typeKey);
  if (!type) throw new UserError('Type de mention inconnu.');
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const c = need(store.getCasier(id), id);
  const values = toFieldList(type.fields, readValues(interaction, type.fields));
  const entry = { n: c.entries.length + 1, type: type.key, values, by: interaction.user.id, at: Date.now() };
  c.entries.push(entry);

  // Automatismes de statut
  if (type.key === 'mandat') c.statut = 'recherche';
  if (type.key === 'levee' && c.statut === 'recherche') c.statut = 'actif';

  const post = entryMessage({
    heading: `${type.emoji} ${type.label.toUpperCase()}`,
    subheading: `Casier ${c.id} • Mention n°${entry.n}`,
    color: type.color,
    values,
    by: entry.by,
    at: entry.at,
  });
  await refreshCasier(interaction.client, c, { post });
  store.saveCasier(c);

  await audit(interaction.client, `${type.emoji} **${type.label}** ajouté(e) au casier **${c.id}** par <@${interaction.user.id}> — <#${c.threadId}>`);
  await interaction.editReply(asEdit(buildNotice('Mention enregistrée', `${type.emoji} ${type.label} ajouté(e) au casier **${c.id}**${type.key === 'mandat' ? '\nLe statut du casier est passé à **Recherché**.' : ''}`)));
}

// ─── Statut / dangerosité ────────────────────────────────────────────────────
async function setField(interaction, id, field, list, label) {
  const value = interaction.values[0];
  const option = find(list, value);
  if (option.restricted && !(await guard(interaction, 'manage'))) return;

  await interaction.deferUpdate();
  const c = need(store.getCasier(id), id);
  c[field] = option.value;
  await refreshCasier(interaction.client, c);
  store.saveCasier(c);

  await audit(interaction.client, `${emojis.engrenage} **${label}** du casier **${c.id}** → ${option.emoji} **${option.label}** par <@${interaction.user.id}>`);
  await interaction.editReply({ content: `✅ ${label} du casier **${c.id}** : ${option.emoji} **${option.label}**`, components: [] });
}

// ─── Identité / compléments ──────────────────────────────────────────────────
async function saveIdentity(interaction, id, defs, message) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const c = need(store.getCasier(id), id);
  const v = readValues(interaction, defs);

  if (v.photo && !/^https?:\/\/\S+$/i.test(v.photo)) {
    throw new UserError('Le lien de la photo doit commencer par http:// ou https://.');
  }
  c.identite = { ...c.identite, ...v };

  await refreshCasier(interaction.client, c);
  store.saveCasier(c);

  await audit(interaction.client, `${emojis.engrenage} **${message}** : casier **${c.id}** par <@${interaction.user.id}> — <#${c.threadId}>`);
  await interaction.editReply(asEdit(buildNotice(message, `La fiche du casier **${c.id}** a été mise à jour.`)));
}
