import {
  ActivityType, Client, Events, GatewayIntentBits, PermissionFlagsBits, SlashCommandBuilder,
} from 'discord.js';
import { categories, config, stream } from './src/config.js';
import { handleCasier } from './src/features/casier.js';
import { handleDossier } from './src/features/dossier.js';
import { handlePanel } from './src/features/panel.js';
import { asEdit, buildNotice } from './src/ui.js';
import { UserError } from './src/utils.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Envoie le panneau PJGN dans ce salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('casier')
    .setDescription('Consulter un casier judiciaire')
    .addStringOption((o) => o.setName('recherche').setDescription('Nom, prénom, alias ou numéro (C-0001)').setAutocomplete(true).setRequired(true)),
  new SlashCommandBuilder()
    .setName('dossier')
    .setDescription('Consulter un dossier d\'enquête')
    .addStringOption((o) => o.setName('recherche').setDescription('Titre, catégorie ou numéro (D-0001)').setAutocomplete(true).setRequired(true)),
].map((c) => c.toJSON());

client.once(Events.ClientReady, async (c) => {
  c.user.setPresence({
    status: 'online',
    activities: [{ name: stream.name, type: ActivityType.Streaming, url: stream.url }],
  });

  const guild = await c.guilds.fetch(config.guildId);
  await guild.commands.set(commands);

  console.log(`[BOT] Connecté en tant que ${c.user.tag}`);
  console.log(`[BOT] Catégories de dossiers actives : ${categories.map((k) => k.key).join(', ') || 'aucune (renseignez FORUM_DOSSIER_…)'}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    for (const handler of [handlePanel, handleCasier, handleDossier]) {
      if (await handler(interaction)) return;
    }
  } catch (err) {
    if (interaction.isAutocomplete()) return;
    const user = err instanceof UserError;
    if (!user) console.error('[ERREUR]', err);

    const payload = buildNotice(user ? 'Action impossible' : 'Erreur', user ? err.message : 'Une erreur est survenue. Vérifiez la configuration (forums, permissions) puis réessayez.');
    if (interaction.isStringSelectMenu() && interaction.deferred) {
      await interaction.editReply({ content: `⚠️ ${user ? err.message : 'Une erreur est survenue.'}`, components: [] }).catch(() => null);
    } else if (interaction.deferred || interaction.replied) await interaction.editReply(asEdit(payload)).catch(() => null);
    else await interaction.reply(payload).catch(() => null);
  }
});

client.login(config.token);
