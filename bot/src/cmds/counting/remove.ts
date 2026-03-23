import {
  SlashCommandSubcommandBuilder,
  PermissionsBitField,
} from "discord.js";
import hubClient from "../../api/hubClient.ts";
import type { TranslatorLike, InteractionLike } from "../../types/index.ts";

type GuildDataLike = {
  settings?: {
    counting?: {
      channel_id?: string;
    };
  };
};

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("remove")
      .setDescription("Remove counting channel");
  },

  localization_strings: {
    command: {
      name: {
        en: "remove",
        ru: "удалить",
        uk: "видалити",
      },
      description: {
        en: "Remove counting channel",
        ru: "Удалить канал для счета",
        uk: "Видалити канал для рахунку",
      },
    },
    success: {
      en: "Counting channel has been removed",
      ru: "Канал для счета был удален",
      uk: "Канал для рахунку був видалений",
    },
  },

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<unknown> {
    if (!(interaction.member as any)?.permissions?.has(PermissionsBitField.Flags.ManageChannels)) {
      return interaction.reply({
        content: await i18n.__("commands.counting.no_perms"),
        ephemeral: true,
      });
    }

    const guildData = (await (hubClient as any).getGuild(interaction.guild.id)) as GuildDataLike;
    if (!guildData?.settings?.counting?.channel_id) {
      return interaction.reply({
        content: await i18n.__("commands.counting.no_channel"),
        ephemeral: true,
      });
    }

    await (hubClient as any).removeCounting(interaction.guild.id);

    return interaction.reply({
      content: await i18n.__("commands.counting.remove.success"),
      ephemeral: true,
    });
  },
};

export default command;
