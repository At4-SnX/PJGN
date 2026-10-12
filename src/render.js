import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SectionBuilder,
  StringSelectMenuBuilder, ThumbnailBuilder,
} from 'discord.js';
import {
  casierEntryTypes, dangerosites, dossierEntryTypes, emojis, menaces, statutsCasier, statutsDossier, theme,
} from './config.js';
import * as store from './store.js';
import { V2, divider, text } from './ui.js';
import { clip, find, titleCase, truncate, ts } from './utils.js';

const NO_PING = { parse: [] };
const one = (v) => String(v ?? '').replace(/\s*\n\s*/g, ' ').trim();
const quote = (label, value) => (value ? `> **__${label}__** : ${one(value)}` : null);

export const casierName = (c) => `${c.identite.nom.toUpperCase()} ${titleCase(c.identite.prenom)}`;
export const casierThreadName = (c) => truncate(`${find(statutsCasier, c.statut).emoji} ${casierName(c)} • ${c.id}`, 100);
export const dossierTitle = (d) => d.fields[0]?.value || 'Sans titre';
export const dossierThreadName = (d) => truncate(`${find(statutsDossier, d.statut).emoji} ${dossierTitle(d)} • ${d.id}`, 100);

const typeOf = (types, key) => types.find((t) => t.key === key);

function lastEntries(entries, types, limit = 5) {
  if (!entries.length) return `${emojis.engrenage} **__Dernières mentions__** : aucune`;
  const lines = entries
    .slice(-limit)
    .reverse()
    .map((e) => {
      const t = typeOf(types, e.type);
      return `\`#${e.n}\` ${t?.emoji ?? '•'} **${t?.label ?? e.type}** — ${truncate(one(e.values[0]?.value), 60)} • ${ts(e.at)}`;
    });
  return `${emojis.engrenage} **__Dernières mentions__**\n${lines.join('\n')}`;
}

function selectRow(customId, placeholder, types) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(types.map((t) => ({ label: t.label, value: t.key, emoji: { name: t.emoji } }))),
  );
}

const buttonRow = (buttons) =>
  new ActionRowBuilder().addComponents(
    ...buttons.map(([id, label]) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(ButtonStyle.Secondary)),
  );

// ═══════════════════════════════════════════════════════════════════════════
//  CASIER
// ═══════════════════════════════════════════════════════════════════════════
export function casierMessage(c) {
  const st = find(statutsCasier, c.statut);
  const dg = find(dangerosites, c.dangerosite);
  const i = c.identite;
  const count = (t) => c.entries.filter((e) => e.type === t).length;

  const identity = clip(
    [
      quote('Nom', i.nom?.toUpperCase()),
      quote('Prénom', titleCase(i.prenom)),
      quote('Date de naissance', i.naissance),
      quote('Nationalité', i.nationalite),
      quote('Adresse', i.adresse),
      quote('Profession', i.profession),
      quote('Téléphone', i.telephone),
      quote('Alias / affiliation', i.affiliation),
      quote('Description', i.description),
    ].filter(Boolean).join('\n'),
    1700,
  );

  const dossiers = (c.dossiers ?? [])
    .map((id) => store.getDossier(id))
    .filter(Boolean)
    .slice(0, 10)
    .map((d) => `<#${d.threadId}> **${d.id}**`);

  const container = new ContainerBuilder()
    .setAccentColor(st.color)
    .addTextDisplayComponents(text(`### ${emojis.exc}**__ CASIER JUDICIAIRE — ${c.id}__**`))
    .addSeparatorComponents(divider());

  if (i.photo) {
    container.addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(text(identity)).setThumbnailAccessory(new ThumbnailBuilder().setURL(i.photo)),
    );
  } else {
    container.addTextDisplayComponents(text(identity));
  }

  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        `${emojis.engrenage} **__Statut__** : ${st.emoji} ${st.label}   •   **__Dangerosité__** : ${dg.emoji} ${dg.label}\n` +
          `${emojis.engrenage} **__Casier__** : ${count('infraction')} condamnation(s) • ${count('gav')} garde(s) à vue • ${count('amende')} amende(s) • ${count('mandat')} mandat(s)` +
          (dossiers.length ? `\n${emojis.engrenage} **__Dossiers liés__** : ${dossiers.join(' • ')}` : ''),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(clip(lastEntries(c.entries, casierEntryTypes), 800)))
    .addSeparatorComponents(divider())
    .addActionRowComponents(selectRow(`casier:add:${c.id}`, 'Ajouter une mention au casier…', casierEntryTypes))
    .addActionRowComponents(
      buttonRow([
        [`casier:status:${c.id}`, 'Statut'],
        [`casier:danger:${c.id}`, 'Dangerosité'],
        [`casier:identite:${c.id}`, 'Identité'],
        [`casier:complements:${c.id}`, 'Compléments'],
        [`casier:link:${c.id}`, 'Lier un dossier'],
      ]),
    )
    .addTextDisplayComponents(text(`-# ${theme.footer} • Ouvert par <@${c.createdBy}> le ${ts(c.createdAt, 'F')} • Mis à jour ${ts(c.updatedAt ?? c.createdAt, 'R')}`));

  return { components: [container], flags: V2, allowedMentions: NO_PING };
}

/** Résumé texte (commande /casier, recherches). */
export function casierSummary(c) {
  const st = find(statutsCasier, c.statut);
  const dg = find(dangerosites, c.dangerosite);
  const count = (t) => c.entries.filter((e) => e.type === t).length;
  return (
    `<#${c.threadId}> • **${c.id}** — ${casierName(c)}\n` +
    `${st.emoji} ${st.label} • Dangerosité ${dg.emoji} ${dg.label}\n` +
    `${count('infraction')} condamnation(s) • ${count('gav')} GAV • ${count('amende')} amende(s) • ${count('mandat')} mandat(s)`
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  DOSSIER
// ═══════════════════════════════════════════════════════════════════════════
export function dossierMessage(d) {
  const st = find(statutsDossier, d.statut);
  const mn = find(menaces, d.menace);
  const types = dossierEntryTypes.filter((t) => !t.only || t.only.includes(d.category));
  const count = (k) => d.entries.filter((e) => e.type === k).length;

  const fields = clip(d.fields.map((f) => quote(f.label, f.value)).filter(Boolean).join('\n'), 1800);

  const counts = types
    .filter((t) => count(t.key) > 0)
    .map((t) => `${t.emoji} ${count(t.key)} ${t.label.toLowerCase()}`)
    .join(' • ');

  const casiers = (d.casiers ?? [])
    .slice(0, 12)
    .map((l) => {
      const c = store.getCasier(l.id);
      return c ? `<#${c.threadId}> **${c.id}** (${casierName(c)})${l.role ? ` — ${truncate(l.role, 50)}` : ''}` : null;
    })
    .filter(Boolean);

  const container = new ContainerBuilder()
    .setAccentColor(st.color)
    .addTextDisplayComponents(text(`### ${emojis.exc}**__ DOSSIER ${d.id} — ${d.categoryEmoji} ${d.categoryLabel.toUpperCase()}__**`))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(fields))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        `${emojis.engrenage} **__Statut__** : ${st.emoji} ${st.label}   •   **__Niveau de menace__** : ${mn.emoji} ${mn.label}` +
          (counts ? `\n${emojis.engrenage} **__Éléments__** : ${clip(counts, 400)}` : '') +
          (casiers.length ? `\n${emojis.engrenage} **__Casiers liés__**\n${clip(casiers.join('\n'), 700)}` : ''),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(clip(lastEntries(d.entries, dossierEntryTypes), 700)))
    .addSeparatorComponents(divider())
    .addActionRowComponents(selectRow(`dossier:add:${d.id}`, 'Ajouter un élément au dossier…', types))
    .addActionRowComponents(
      buttonRow([
        [`dossier:status:${d.id}`, 'Statut'],
        [`dossier:menace:${d.id}`, 'Menace'],
        [`dossier:edit:${d.id}`, 'Modifier'],
        [`dossier:link:${d.id}`, 'Lier un casier'],
      ]),
    )
    .addTextDisplayComponents(text(`-# ${theme.footer} • Ouvert par <@${d.createdBy}> le ${ts(d.createdAt, 'F')} • Mis à jour ${ts(d.updatedAt ?? d.createdAt, 'R')}`));

  return { components: [container], flags: V2, allowedMentions: NO_PING };
}

export function dossierSummary(d) {
  const st = find(statutsDossier, d.statut);
  const mn = find(menaces, d.menace);
  return (
    `<#${d.threadId}> • **${d.id}** — ${truncate(dossierTitle(d), 80)}\n` +
    `${d.categoryEmoji} ${d.categoryLabel} • ${st.emoji} ${st.label} • Menace ${mn.emoji} ${mn.label}\n` +
    `${d.entries.length} élément(s) • ${(d.casiers ?? []).length} casier(s) lié(s)`
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Fiche d'une mention / d'un élément (message posté dans le fil)
// ═══════════════════════════════════════════════════════════════════════════
export function entryMessage({ heading, subheading, color, values, by, at }) {
  const body = values.filter((v) => v.value).map((v) => `**__${v.label}__**\n${v.value}`).join('\n\n');
  const container = new ContainerBuilder()
    .setAccentColor(color ?? theme.color)
    .addTextDisplayComponents(text(`### ${emojis.exc}**__ ${heading}__**\n-# ${subheading}`))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(clip(body || '—', 3300)))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`-# Saisi par <@${by}> • ${ts(at, 'F')}`));
  return { components: [container], flags: V2, allowedMentions: NO_PING };
}
