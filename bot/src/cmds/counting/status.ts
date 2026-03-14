import { SlashCommandSubcommandBuilder } from "discord.js";
import hubClient from "../../api/hubClient.ts";

type TranslatorLike = {
  __: (key: string, vars?: Record<string, unknown>) => Promise<string | unknown>;
};

type CountingSettings = {
  channel_id?: string;
  message?: number;
  pinoneach?: number | null;
  pinnedrole?: string | null;
  only_numbers?: boolean;
  no_same_user?: boolean;
  no_unique_role?: boolean;
};

type GuildDataLike = {
  settings?: {
    counting?: CountingSettings;
  };
};

type InteractionLike = {
  guild: {
    id: string;
    channels: {
      fetch: (channelId: string) => Promise<{ name?: string } | null>;
    };
    roles: {
      fetch: (roleId: string) => Promise<{ name?: string } | null>;
    };
  };
  reply: (payload: { content: unknown; ephemeral: boolean }) => Promise<unknown>;
};

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("status")
      .setDescription("Show counting channel status");
  },

  localization_strings: {
    command: {
      name: {
        en: "status",
        ru: "статус",
        uk: "статус",
      },
      description: {
        en: "Show counting channel status",
        ru: "Показать статус канала для счета",
        uk: "Показати статус каналу для рахунку",
      },
    },
    status: {
      en: "Counting channel status:\nChannel: {{channel}}\nCurrent number: {{number}}\nPin on each: {{pinoneach}}\nPinned role: {{pinnedrole}}\nOnly numbers: {{only_numbers}}\nNo same user: {{no_same_user}}\nNo unique role: {{no_unique_role}}",
      ru: "Статус канала для счета:\nКанал: {{channel}}\nТекущее число: {{number}}\nЗакреплять на каждом: {{pinoneach}}\nЗакрепленная роль: {{pinnedrole}}\nТолько числа: {{only_numbers}}\nБез повторений: {{no_same_user}}\nНе уникальная роль: {{no_unique_role}}",
      uk: "Статус каналу для рахунку:\nКанал: {{channel}}\nПоточне число: {{number}}\nЗакріплювати на кожному: {{pinoneach}}\nЗакріплена роль: {{pinnedrole}}\nТільки числа: {{only_numbers}}\nБез повторень: {{no_same_user}}\nНе унікальна роль: {{no_unique_role}}",
    },
  },

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<unknown> {
    const guildData = (await (hubClient as any).getGuild(interaction.guild.id)) as GuildDataLike;
    const counting = guildData?.settings?.counting;

    if (!counting?.channel_id) {
      return interaction.reply({
        content: await i18n.__("commands.counting.no_channel"),
        ephemeral: true,
      });
    }

    const channel = await interaction.guild.channels.fetch(counting.channel_id);
    const pinnedRole = counting.pinnedrole
      ? await interaction.guild.roles.fetch(counting.pinnedrole)
      : null;

    return interaction.reply({
      content: await i18n.__("commands.counting.status.status", {
        channel: channel?.name || "Unknown",
        number: counting.message,
        pinoneach: counting.pinoneach || "None",
        pinnedrole: pinnedRole?.name || "None",
        only_numbers: counting.only_numbers ? "Yes" : "No",
        no_same_user: counting.no_same_user ? "Yes" : "No",
        no_unique_role: counting.no_unique_role ? "Yes" : "No",
      }),
      ephemeral: true,
    });
  },
};

export default command;
