import { ButtonStyle, MessageFlags } from 'discord.js';
import { texts } from '../config.js';
import { casierName, casierSummary, dossierSummary, dossierTitle } from '../render.js';
import * as store from '../store.js';
import { V2, asEdit, buildNotice, buildPanel } from '../ui.js';
import { buildModal, canUse, guard, truncate } from '../utils.js';

const searchFields = [{ id: 'query', label: 'Nom, prénom, alias, titre ou numéro', max: 100 }];

const panelButtons = () => [
  { id: 'casier:new', label: texts.panel.buttons.casier, style: ButtonStyle.Primary },
  { id: 'dossier:new', label: texts.panel.buttons.dossier, style: ButtonStyle.Primary },
  { id: 'pjgn:search', label: texts.panel.buttons.recherche, style: ButtonStyle.Secondary },
];

export async function handlePanel(interaction) {
  // ── Commandes ────────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'setup') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await interaction.channel.send(buildPanel('pjgn', texts.panel, panelButtons()));
      await interaction.editReply('Panneau PJGN envoyé.');
      return true;
    }
    if (interaction.commandName === 'casier') {
      if (!(await guard(interaction))) return true;
      const c = resolve(interaction.options.getString('recherche', true), 'casier');
      await interaction.reply(c ? buildNotice('Casier judiciaire', casierSummary(c)) : buildNotice('Introuvable', 'Aucun casier ne correspond à cette recherche.'));
      return true;
    }
    if (interaction.commandName === 'dossier') {
      if (!(await guard(interaction))) return true;
      const d = resolve(interaction.options.getString('recherche', true), 'dossier');
      await interaction.reply(d ? buildNotice('Dossier d\'enquête', dossierSummary(d)) : buildNotice('Introuvable', 'Aucun dossier ne correspond à cette recherche.'));
      return true;
    }
    return false;
  }

  // ── Autocomplétion des commandes /casier et /dossier ─────────────────────
  if (interaction.isAutocomplete()) {
    if (!canUse(interaction.member)) return interaction.respond([]).then(() => true);
    const query = interaction.options.getFocused();
    const choices =
      interaction.commandName === 'casier'
        ? store.searchCasiers(query).map((c) => ({ name: truncate(`${c.id} — ${casierName(c)}`, 100), value: c.id }))
        : store.searchDossiers(query).map((d) => ({ name: truncate(`${d.id} — ${dossierTitle(d)} (${d.categoryLabel})`, 100), value: d.id }));
    await interaction.respond(choices.slice(0, 25));
    return true;
  }

  // ── Bouton « Rechercher » du panneau ─────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'pjgn:search') {
    if (!(await guard(interaction))) return true;
    await interaction.showModal(buildModal('pjgn:search', 'Recherche PJGN', searchFields));
    return true;
  }
  if (interaction.isModalSubmit() && interaction.customId === 'pjgn:search') {
    if (!(await guard(interaction))) return true;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const q = interaction.fields.getTextInputValue('query').trim();
    const casiers = store.searchCasiers(q);
    const dossiers = store.searchDossiers(q);

    const lines = [
      `**Casiers (${casiers.length})**`,
      ...(casiers.slice(0, 10).map((c) => `• <#${c.threadId}> **${c.id}** — ${casierName(c)}`)),
      ...(casiers.length ? [] : ['Aucun résultat.']),
      '',
      `**Dossiers (${dossiers.length})**`,
      ...(dossiers.slice(0, 10).map((d) => `• <#${d.threadId}> **${d.id}** — ${truncate(dossierTitle(d), 60)} (${d.categoryEmoji} ${d.categoryLabel})`)),
      ...(dossiers.length ? [] : ['Aucun résultat.']),
    ];
    const payload = buildNotice(`Résultats pour « ${truncate(q, 40)} »`, truncate(lines.join('\n'), 3500));
    await interaction.editReply({ components: payload.components, flags: V2 });
    return true;
  }
  return false;
}

/** Identifiant (choisi via l'autocomplétion) ou texte libre -> enregistrement. */
function resolve(input, kind) {
  const id = store.normalizeId(input, kind);
  const direct = id && (kind === 'casier' ? store.getCasier(id) : store.getDossier(id));
  if (direct) return direct;
  const results = kind === 'casier' ? store.searchCasiers(input) : store.searchDossiers(input);
  return results[0] ?? null;
}
