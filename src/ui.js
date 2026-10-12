import {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder,
  MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags, SeparatorBuilder,
  SeparatorSpacingSize, TextDisplayBuilder,
} from 'discord.js';
import { assets, emojis, theme } from './config.js';

export const V2 = MessageFlags.IsComponentsV2;
export const V2_EPHEMERAL = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

export const text = (content) => new TextDisplayBuilder().setContent(content);
export const divider = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

/** Panneau interactif : bannière + titre + description + boutons. */
export function buildPanel(key, content, buttons) {
  const asset = assets[key];
  const row = new ActionRowBuilder().addComponents(
    ...buttons.map((b) => new ButtonBuilder().setCustomId(b.id).setLabel(b.label).setStyle(b.style ?? ButtonStyle.Primary)),
  );

  const container = new ContainerBuilder()
    .setAccentColor(theme.color)
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(`attachment://${asset.name}`)),
    )
    .addTextDisplayComponents(text(`### ${emojis.exc}**__${content.title}__**\n${content.description}`))
    .addSeparatorComponents(divider())
    .addActionRowComponents(row);

  return {
    components: [container],
    files: [new AttachmentBuilder(asset.file, { name: asset.name })],
    flags: V2,
  };
}

/** Message simple éphémère (réponses). */
export function buildNotice(title, message) {
  const container = new ContainerBuilder()
    .setAccentColor(theme.color)
    .addTextDisplayComponents(text(`### ${title}\n${message}`));
  return { components: [container], flags: V2_EPHEMERAL };
}

/** Adapte un message pour editReply (pas de flag éphémère, V2 conservé). */
export const asEdit = (payload) => ({ components: payload.components, flags: V2 });
