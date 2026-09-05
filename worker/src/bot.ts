import {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';

export function createDiscordBot(token: string) {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds], // Minimum intent, NO MESSAGE_CONTENT per architecture doc
  });

  client.once('ready', () => {
    console.log(`[Railway Worker] Discord Bot logged in as ${client.user?.tag}`);
  });

  // Handle interactive buttons (e.g. "Mark Complete", "Open in Classroom")
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith('complete_hw_')) {
      const hwId = interaction.customId.replace('complete_hw_', '');
      await interaction.reply({
        content: `Marked homework task as complete!`,
        ephemeral: true,
      });
    }
  });

  return client;
}

export async function sendBotEmbed(
  client: Client,
  channelId: string,
  embedPayload: any
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      return { success: false, error: 'Target channel not found or not text' };
    }

    const discordEmbed = new EmbedBuilder()
      .setTitle(embedPayload.title)
      .setColor(embedPayload.color || 0x00bae2)
      .setTimestamp(new Date());

    if (embedPayload.url) discordEmbed.setURL(embedPayload.url);
    if (embedPayload.description) discordEmbed.setDescription(embedPayload.description);

    if (embedPayload.fields) {
      for (const f of embedPayload.fields) {
        discordEmbed.addFields({ name: f.name, value: f.value, inline: f.inline ?? true });
      }
    }

    const msg = await channel.send({ embeds: [discordEmbed] });
    return { success: true, messageId: msg.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
