import {
  ActionRowBuilder, ChannelType, ContainerBuilder, MessageFlags, ModalBuilder, PermissionFlagsBits,
  StringSelectMenuBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import { config, theme } from './config.js';
import { V2, buildNotice, text } from './ui.js';

/** Erreur dont le message est affiché tel quel à l'utilisateur. */
export class UserError extends Error {}

// ─── Texte ─────────────────────────────────────────────────────────────────
export const truncate = (s, max) => (String(s).length > max ? `${String(s).slice(0, max - 1)}…` : String(s));
export const clip = truncate;
export const titleCase = (s) => String(s ?? '').trim().toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
export const ts = (ms, style = 'd') => `<t:${Math.floor(ms / 1000)}:${style}>`;
export const find = (list, value) => list.find((x) => x.value === value) ?? list[0];

// ─── Formulaires ───────────────────────────────────────────────────────────
function textField(def, value) {
  const input = new TextInputBuilder()
    .setCustomId(def.id)
    .setLabel(def.label.slice(0, 45))
    .setStyle(def.long ? TextInputStyle.Paragraph : TextInputStyle.Short)
    .setRequired(def.required !== false);
  if (def.max) input.setMaxLength(def.max);
  if (def.placeholder) input.setPlaceholder(def.placeholder.slice(0, 100));
  if (value) input.setValue(String(value).slice(0, def.max ?? 4000));
  return new ActionRowBuilder().addComponents(input);
}

export const buildModal = (customId, title, defs, values = {}) =>
  new ModalBuilder().setCustomId(customId).setTitle(title.slice(0, 45)).addComponents(...defs.map((d) => textField(d, values[d.id])));

/** Lit les valeurs d'un formulaire soumis -> { id: valeur } */
export function readValues(interaction, defs) {
  return Object.fromEntries(defs.map((d) => [d.id, interaction.fields.getTextInputValue(d.id).trim()]));
}

/** { id: valeur } -> [{ id, label, value }] (conserve l'ordre des champs) */
export const toFieldList = (defs, values) => defs.map((d) => ({ id: d.id, label: d.label, value: values[d.id] ?? '' }));

export const valuesFromList = (list) => Object.fromEntries(list.map((f) => [f.id, f.value]));

/** Liste déroulante éphémère. */
export function selectReply(interaction, customId, placeholder, list, content) {
  const options = list.map((o) => {
    const opt = { label: o.label.slice(0, 100), value: o.value ?? o.key };
    if (o.emoji) opt.emoji = { name: o.emoji };
    if (o.description) opt.description = o.description.slice(0, 100);
    return opt;
  });
  const menu = new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).addOptions(options);
  return interaction.reply({ content, components: [new ActionRowBuilder().addComponents(menu)], flags: MessageFlags.Ephemeral });
}

// ─── Permissions ───────────────────────────────────────────────────────────
const hasRole = (member, id) => (Array.isArray(member.roles) ? member.roles.includes(id) : member.roles.cache.has(id));
const isAdmin = (member) => member.permissions?.has?.(PermissionFlagsBits.Administrator) ?? false;

export const canUse = (member) => isAdmin(member) || hasRole(member, config.roles.pjgn);
export const canManage = (member) =>
  isAdmin(member) || (config.roles.responsable ? hasRole(member, config.roles.responsable) : hasRole(member, config.roles.pjgn));

/** Vérifie l'accès et répond « Accès refusé » si besoin. */
export async function guard(interaction, level = 'use') {
  const ok = level === 'manage' ? canManage(interaction.member) : canUse(interaction.member);
  if (!ok) {
    await interaction.reply(
      buildNotice('Accès refusé', level === 'manage' ? 'Cette action est réservée à la direction du PJGN.' : 'Cette fonction est réservée aux membres du PJGN.'),
    );
  }
  return ok;
}

// ─── Salons / fils ─────────────────────────────────────────────────────────
export async function fetchForum(guild, id) {
  const channel = await guild.channels.fetch(id).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildForum) {
    throw new UserError(`Le forum ${id} est introuvable ou n'est pas un salon forum. Vérifiez la configuration.`);
  }
  return channel;
}

export async function getThread(client, id) {
  const thread = await client.channels.fetch(id).catch(() => null);
  if (!thread?.isThread()) throw new UserError('Le fil du forum associé est introuvable (supprimé ?).');
  if (thread.archived) await thread.setArchived(false);
  return thread;
}

/** Renomme un fil sans bloquer si Discord limite le débit (2 renommages / 10 min). */
export async function safeRename(thread, name) {
  if (thread.name === name) return;
  await Promise.race([thread.setName(name).catch(() => null), new Promise((r) => setTimeout(r, 4000))]);
}

// ─── Journal d'audit ───────────────────────────────────────────────────────
export async function audit(client, message) {
  if (!config.logChannelId) return;
  try {
    const channel = await client.channels.fetch(config.logChannelId);
    const container = new ContainerBuilder().setAccentColor(theme.color).addTextDisplayComponents(text(`${message}\n-# ${theme.footer}`));
    await channel.send({ components: [container], flags: V2, allowedMentions: { parse: [] } });
  } catch (err) {
    console.error('[AUDIT]', err.message);
  }
}
