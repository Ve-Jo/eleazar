import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  SlashCommandSubcommandBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import hubClient, { CRATE_TYPES } from "../../api/hubClient.ts";
import prettyMs from "pretty-ms";
import { generateImage } from "../../utils/imageGenerator.ts";
import { ComponentBuilder } from "../../utils/componentConverter.ts";

type TranslatorLike = {
  __: (key: string, vars?: Record<string, unknown>) => Promise<string | unknown>;
};

type UserLike = {
  id: string;
  username: string;
  displayName: string;
  displayAvatarURL: (options?: Record<string, unknown>) => string;
};

type GuildLike = {
  id: string;
  name: string;
  iconURL: (options?: Record<string, unknown>) => string | null;
};

type CrateTypeConfig = {
  emoji?: string;
  cooldown: number;
};

type CrateListItem = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  available: boolean;
  cooldown: number;
  count: number;
};

type MessageLike = {
  editable?: boolean;
  edit: (payload: unknown) => Promise<unknown>;
  createMessageComponentCollector: (options: Record<string, unknown>) => {
    on: (event: string, handler: (...args: any[]) => void | Promise<void>) => void;
  };
};

type InteractionLike = {
  replied?: boolean;
  deferred?: boolean;
  locale?: string;
  guild: GuildLike;
  user: UserLike;
  options: {
    getString: (name: string) => string | null;
  };
  deferReply: () => Promise<unknown>;
  editReply: (payload: unknown) => Promise<MessageLike>;
  reply: (payload: unknown) => Promise<unknown>;
};

type ComponentInteractionLike = {
  replied?: boolean;
  deferred?: boolean;
  customId: string;
  values: string[];
  user: { id: string };
  update: (payload: unknown) => Promise<unknown>;
  reply: (payload: unknown) => Promise<unknown>;
  followUp: (payload: unknown) => Promise<unknown>;
  deferUpdate: () => Promise<unknown>;
  editReply: (payload: unknown) => Promise<unknown>;
};

type CasesCommandShape = {
  data: () => SlashCommandSubcommandBuilder;
  localization_strings: Record<string, any>;
  execute: (interaction: InteractionLike, i18n: TranslatorLike) => Promise<void>;
  handleDirectCaseOpen: (
    interaction: InteractionLike,
    i18n: TranslatorLike,
    requestedCase: string,
    builderMode: "v2"
  ) => Promise<void>;
  handleCaseMenu: (
    interaction: InteractionLike,
    i18n: TranslatorLike,
    builderMode: "v2"
  ) => Promise<void>;
  buildCratesList: (interaction: InteractionLike, i18n: TranslatorLike) => Promise<CrateListItem[]>;
  getCooldownTime: (interaction: InteractionLike, crateType: string) => Promise<number>;
  getCrateTranslation: (path: string, defaultValue: string, interactionLocale?: string) => string;
  getCrateInfo: (requestedCase: string, interactionLocale?: string) => { crateName: string; crateEmoji: string };
  createSelectMenu: (
    cratesList: CrateListItem[],
    selectedCrate: number,
    i18n: TranslatorLike
  ) => Promise<StringSelectMenuBuilder>;
  createOpenButton: (
    cratesList: CrateListItem[],
    selectedCrate: number,
    i18n: TranslatorLike
  ) => Promise<ButtonBuilder>;
  handleCrateOpen: (
    i: ComponentInteractionLike,
    cratesList: CrateListItem[],
    selectedCrate: number,
    interaction: InteractionLike,
    i18n: TranslatorLike,
    builderMode: "v2",
    message: MessageLike
  ) => Promise<void>;
  openCaseAndCreateMessage: (
    interaction: InteractionLike,
    i18n: TranslatorLike,
    crateType: string,
    crateName: string,
    crateEmoji: string,
    builderMode: "v2",
    logPrefix?: string
  ) => Promise<Record<string, unknown>>;
  createRewardMessage: (
    interaction: InteractionLike,
    i18n: TranslatorLike,
    crateType: string,
    crateName: string,
    crateEmoji: string,
    rewards: unknown,
    builderMode: "v2"
  ) => Promise<Record<string, unknown>>;
  setupBackToMenuCollector: (
    message: MessageLike,
    interaction: InteractionLike,
    i18n: TranslatorLike
  ) => void;
  setupBackToCratesCollector: (
    message: MessageLike,
    interaction: InteractionLike,
    i18n: TranslatorLike,
    cratesList: CrateListItem[]
  ) => void;
  setupCollectorEnd: (collector: { on: (event: string, handler: () => Promise<void>) => void }, message: MessageLike) => void;
  handleError: (interaction: InteractionLike, i18n: TranslatorLike, error: unknown) => Promise<void>;
  handleCollectorError: (i: ComponentInteractionLike, i18n: TranslatorLike) => Promise<void>;
};

const crateTypes = CRATE_TYPES as Record<string, CrateTypeConfig>;

const command: CasesCommandShape = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("cases")
      .setDescription("Open cases and get rewards")
      .addStringOption((option) =>
        option
          .setName("case")
          .setDescription("Choose a specific case to open directly")
          .setRequired(false)
          .addChoices(
            { name: "daily", value: "daily" },
            { name: "weekly", value: "weekly" }
          )
      );
  },
  localization_strings: {
    command: {
      name: {
        ru: "кейсы",
        uk: "кейси",
      },
      description: {
        ru: "Открыть кейсы и получить награды",
        uk: "Відкрити кейси та отримати нагороди",
      },
    },
    options: {
      case: {
        name: {
          ru: "кейс",
          uk: "кейс",
        },
        description: {
          ru: "Выберите конкретный кейс для прямого открытия",
          uk: "Виберіть конкретний кейс для прямого відкриття",
        },
      },
    },
    title: {
      en: "Cases",
      ru: "Кейсы",
      uk: "Кейси",
    },
    selectCrate: {
      en: "Select a case to open",
      ru: "Выберите кейс для открытия",
      uk: "Виберіть кейс для відкриття",
    },
    openButton: {
      en: "Open Case",
      ru: "Открыть кейс",
      uk: "Відкрити кейс",
    },
    cooldownActive: {
      en: "This case is on cooldown for {{time}}",
      ru: "Этот кейс на перезарядке {{time}}",
      uk: "Цей кейс на перезарядці {{time}}",
    },
    balance: {
      en: "Your balance: {{balance}} coins",
      ru: "Ваш баланс: {{balance}} монет",
      uk: "Ваш баланс: {{balance}} монет",
    },
    backButton: {
      en: "Back to Crates",
      ru: "Назад к ящикам",
      uk: "Назад до скринь",
    },
    backToCrates: {
      en: "Back to Crates",
      ru: "Назад к кейсам",
      uk: "Назад до кейсів",
    },
    noCratesAvailable: {
      en: "You don't have any of these crates",
      ru: "У вас нет таких ящиков",
      uk: "У вас немає таких скринь",
    },
    rewardIntro: {
      en: "You opened a {{crate}} crate and received:\n",
      ru: "Вы открыли ящик {{crate}} и получили:\n",
      uk: "Ви відкрили скриню {{crate}} і отримали:\n",
    },
    rewardCoins: {
      en: "• {{amount}} coins\n",
      ru: "• {{amount}} монет\n",
      uk: "• {{amount}} монет\n",
    },
    rewardXp: {
      en: "• {{amount}} XP\n",
      ru: "• {{amount}} опыта\n",
      uk: "• {{amount}} досвіду\n",
    },
    rewardDiscount: {
      en: "• {{amount}}% discount\n",
      ru: "• {{amount}}% скидки\n",
      uk: "• {{amount}}% знижки\n",
    },
    error: {
      en: "An error occurred while processing your request.",
      ru: "Произошла ошибка при обработке вашего запроса.",
      uk: "Сталася помилка під час обробки вашого запиту.",
    },
    types: {
      daily: {
        name: {
          en: "Daily Crate",
          ru: "Ежедневный ящик",
          uk: "Щоденна скриня",
        },
        description: {
          en: "A crate you can open once every 24 hours",
          ru: "Ящик, который можно открыть раз в 24 часа",
          uk: "Скриня, яку можна відкрити раз на 24 години",
        },
      },
      weekly: {
        name: {
          en: "Weekly Crate",
          ru: "Еженедельный ящик",
          uk: "Щотижнева скриня",
        },
        description: {
          en: "A crate you can open once every 7 days",
          ru: "Ящик, который можно открыть раз в 7 дней",
          uk: "Скриня, яку можна відкрити раз на 7 днів",
        },
      },
      special: {
        description: {
          en: "A special crate with unique rewards",
          ru: "Особый ящик с уникальными наградами",
          uk: "Особлива скриня з унікальними нагородами",
        },
      },
    },
  },

  async execute(interaction, i18n): Promise<void> {
    const builderMode = "v2";

    await interaction.deferReply();

    try {
      const requestedCase = interaction.options.getString("case");

      if (requestedCase) {
        await this.handleDirectCaseOpen(interaction, i18n, requestedCase, builderMode);
        return;
      }

      await this.handleCaseMenu(interaction, i18n, builderMode);
    } catch (error) {
      console.error("Error in cases command:", error);
      await this.handleError(interaction, i18n, error);
    }
  },

  async handleDirectCaseOpen(interaction, i18n, requestedCase, builderMode): Promise<void> {
    if (!["daily", "weekly"].includes(requestedCase)) {
      await interaction.editReply({
        content: await i18n.__("commands.economy.cases.noCratesAvailable"),
      });
      return;
    }

    const cooldownTimestamp = Number(
      await (hubClient as any).getCrateCooldown(interaction.guild.id, interaction.user.id, requestedCase)
    );

    const now = Date.now();
    const remainingCooldown =
      cooldownTimestamp > 0
        ? Math.max(0, cooldownTimestamp + (crateTypes[requestedCase]?.cooldown || 0) - now)
        : 0;

    if (remainingCooldown > 0) {
      await interaction.editReply({
        content: await i18n.__("commands.economy.cases.cooldownActive", {
          time: prettyMs(remainingCooldown, { verbose: true }),
        }),
      });
      return;
    }

    try {
      const { crateName, crateEmoji } = this.getCrateInfo(requestedCase, interaction.locale);
      const rewardMessage = await this.openCaseAndCreateMessage(
        interaction,
        i18n,
        requestedCase,
        crateName,
        crateEmoji,
        builderMode,
        "DIRECT CASE OPENING"
      );

      const message = await interaction.editReply(rewardMessage);
      this.setupBackToMenuCollector(message, interaction, i18n);
    } catch (error) {
      console.error("Error opening requested case:", error);
      await interaction.editReply({
        content: await i18n.__("commands.economy.cases.error"),
        ephemeral: true,
      });
    }
  },

  async handleCaseMenu(interaction, i18n, builderMode): Promise<void> {
    await (hubClient as any).ensureGuildUser(interaction.guild.id, interaction.user.id);

    const userData = await (hubClient as any).getUser(interaction.guild.id, interaction.user.id);
    const cratesList = await this.buildCratesList(interaction, i18n);
    let selectedCrate = 0;

    const generateCratesMessage = async (disableInteractions = false): Promise<Record<string, unknown>> => {
      const generated = (await generateImage(
        "CratesDisplay",
        {
          interaction: {
            user: {
              id: interaction.user.id,
              username: interaction.user.username,
              displayName: interaction.user.displayName,
              avatarURL: interaction.user.displayAvatarURL({
                extension: "png",
                size: 1024,
              }),
            },
            guild: {
              id: interaction.guild.id,
              name: interaction.guild.name,
              iconURL: interaction.guild.iconURL({
                extension: "png",
                size: 1024,
              }),
            },
          },
          database: {
            balance: Math.round(Number(userData.economy?.balance || 0)),
            xp: userData.Level?.xp || 0,
            seasonXp: userData.Level?.seasonXp || 0,
          },
          locale: interaction.locale,
          crates: cratesList,
          selectedCrate,
          dominantColor: "user",
          returnDominant: true,
        },
        { image: 2, emoji: 2 },
        i18n as any
      )) as [Buffer, unknown];

      const pngBuffer = generated?.[0];
      const dominantColor = generated?.[1];

      const attachment = new AttachmentBuilder(pngBuffer, {
        name: "crates.avif",
      });

      const cratesComponent = new ComponentBuilder({
        dominantColor: dominantColor as any,
        mode: builderMode as any,
      })
        .addText(String(await i18n.__("commands.economy.cases.title")), "header3")
        .addText(
          String(
            await i18n.__("commands.economy.cases.balance", {
              balance: Math.round(Number(userData.economy?.balance || 0)),
            })
          )
        )
        .addImage("attachment://crates.avif");

      if (!disableInteractions) {
        const selectMenu = await this.createSelectMenu(cratesList, selectedCrate, i18n);
        const openButton = await this.createOpenButton(cratesList, selectedCrate, i18n);

        const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
        const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(openButton);

        cratesComponent.addActionRow(selectRow);
        cratesComponent.addActionRow(buttonRow);
      }

      return {
        components: [cratesComponent.build()],
        files: [attachment],
        flags: MessageFlags.IsComponentsV2,
      };
    };

    const initialMessage = await generateCratesMessage();
    const message = await interaction.editReply(initialMessage);

    const collector = message.createMessageComponentCollector({
      filter: (componentInteraction: ComponentInteractionLike) =>
        componentInteraction.user.id === interaction.user.id,
      time: 60000,
    });

    collector.on("collect", async (componentInteraction: ComponentInteractionLike) => {
      try {
        if (componentInteraction.customId === "select_crate") {
          selectedCrate = parseInt(componentInteraction.values[0] || "0", 10);
          await componentInteraction.update(await generateCratesMessage());
        } else if (componentInteraction.customId === "open_crate") {
          await this.handleCrateOpen(
            componentInteraction,
            cratesList,
            selectedCrate,
            interaction,
            i18n,
            builderMode,
            message
          );
        }
      } catch (error) {
        console.error("Error in collector:", error);
        await this.handleCollectorError(componentInteraction, i18n);
      }
    });

    collector.on("end", async () => {
      try {
        if (message.editable) {
          const finalMessage = await generateCratesMessage(true);
          await message.edit(finalMessage);
        }
      } catch (error) {
        console.error("Error updating components on end:", error);
      }
    });
  },

  async buildCratesList(interaction, i18n): Promise<CrateListItem[]> {
    const crates = (await (hubClient as any).getUserCrates(
      interaction.guild.id,
      interaction.user.id
    )) as Array<{ type: string; count: number }>;

    const [dailyCooldown, weeklyCooldown] = await Promise.all([
      this.getCooldownTime(interaction, "daily"),
      this.getCooldownTime(interaction, "weekly"),
    ]);

    const cratesList: CrateListItem[] = [
      {
        id: "daily",
        name: this.getCrateTranslation("types.daily.name", "Daily Crate", interaction.locale),
        description: this.getCrateTranslation(
          "types.daily.description",
          "A crate you can open once every 24 hours",
          interaction.locale
        ),
        emoji: crateTypes.daily?.emoji || "🎁",
        available: dailyCooldown <= 0,
        cooldown: dailyCooldown,
        count: -1,
      },
      {
        id: "weekly",
        name: this.getCrateTranslation("types.weekly.name", "Weekly Crate", interaction.locale),
        description: this.getCrateTranslation(
          "types.weekly.description",
          "A crate you can open once every 7 days",
          interaction.locale
        ),
        emoji: crateTypes.weekly?.emoji || "🎁",
        available: weeklyCooldown <= 0,
        cooldown: weeklyCooldown,
        count: -1,
      },
    ];

    for (const crate of crates || []) {
      if (crate.count > 0 && !["daily", "weekly"].includes(crate.type)) {
        cratesList.push({
          id: crate.type,
          name: this.getCrateTranslation(`types.${crate.type}.name`, crate.type, interaction.locale),
          description: this.getCrateTranslation(
            `types.${crate.type}.description`,
            "A special crate with unique rewards",
            interaction.locale
          ),
          emoji: "🎁",
          available: true,
          cooldown: 0,
          count: crate.count,
        });
      }
    }

    return cratesList;
  },

  async getCooldownTime(interaction, crateType): Promise<number> {
    const cooldownTimestamp = Number(
      await (hubClient as any).getCrateCooldown(interaction.guild.id, interaction.user.id, crateType)
    );

    const now = Date.now();
    return cooldownTimestamp > 0
      ? Math.max(0, cooldownTimestamp + (crateTypes[crateType]?.cooldown || 0) - now)
      : 0;
  },

  getCrateTranslation(path, defaultValue, interactionLocale): string {
    const userLocale = interactionLocale?.split("-")[0] || "en";
    const pathParts = path.split(".");
    let result: any = this.localization_strings;

    for (const part of pathParts) {
      if (!result?.[part]) {
        return defaultValue;
      }
      result = result[part];
    }

    const localeKey = userLocale || "en";
    return result?.[localeKey] || result?.en || defaultValue;
  },

  getCrateInfo(requestedCase, interactionLocale): { crateName: string; crateEmoji: string } {
    const crateName = this.getCrateTranslation(
      `types.${requestedCase}.name`,
      requestedCase,
      interactionLocale
    );
    const crateEmoji = crateTypes[requestedCase]?.emoji || "🎁";

    return { crateName, crateEmoji };
  },

  async createSelectMenu(cratesList, selectedCrate, i18n): Promise<StringSelectMenuBuilder> {
    return new StringSelectMenuBuilder()
      .setCustomId("select_crate")
      .setPlaceholder(String(await i18n.__("commands.economy.cases.selectCrate")))
      .addOptions(
        cratesList.map((crate, index) => {
          const labelPrefix = crate.count > 0 ? `(${crate.count}) ` : "";
          const labelSuffix =
            !crate.available && crate.cooldown > 0
              ? ` (${prettyMs(crate.cooldown, { compact: true })})`
              : "";

          return {
            label: `${labelPrefix}${crate.name}${labelSuffix}`,
            description: crate.description,
            value: index.toString(),
            emoji: crate.emoji,
            default: selectedCrate === index,
          };
        })
      );
  },

  async createOpenButton(cratesList, selectedCrate, i18n): Promise<ButtonBuilder> {
    const selected = cratesList[selectedCrate];
    return new ButtonBuilder()
      .setCustomId("open_crate")
      .setLabel(String(await i18n.__("commands.economy.cases.openButton")))
      .setStyle(ButtonStyle.Success)
      .setDisabled(!selected?.available);
  },

  async handleCrateOpen(i, cratesList, selectedCrate, interaction, i18n, builderMode, message): Promise<void> {
    const selectedCrateInfo = cratesList[selectedCrate];

    if (!selectedCrateInfo?.available) {
      await i.reply({
        content: await i18n.__("commands.economy.cases.cooldownActive", {
          time: prettyMs(selectedCrateInfo?.cooldown || 0, { verbose: true }),
        }),
        ephemeral: true,
      });
      return;
    }

    try {
      const rewardMessage = await this.openCaseAndCreateMessage(
        interaction,
        i18n,
        selectedCrateInfo.id,
        selectedCrateInfo.name,
        selectedCrateInfo.emoji,
        builderMode,
        "INTERACTIVE CASE OPENING"
      );

      await i.update(rewardMessage);
      this.setupBackToCratesCollector(message, interaction, i18n, cratesList);
    } catch (error) {
      console.error("Error in interactive case opening:", error);
      await i.reply({
        content: await i18n.__("commands.economy.cases.error"),
        ephemeral: true,
      });
    }
  },

  async openCaseAndCreateMessage(
    interaction,
    i18n,
    crateType,
    crateName,
    crateEmoji,
    builderMode,
    logPrefix = "CASE OPENING"
  ): Promise<Record<string, unknown>> {
    const rewards = await (hubClient as any).openCrate(
      interaction.guild.id,
      interaction.user.id,
      crateType
    );

    console.log(`${logPrefix} - REWARDS:`);
    console.log(rewards);

    return this.createRewardMessage(
      interaction,
      i18n,
      crateType,
      crateName,
      crateEmoji,
      rewards,
      builderMode
    );
  },

  async createRewardMessage(
    interaction,
    i18n,
    crateType,
    crateName,
    crateEmoji,
    rewards,
    builderMode
  ): Promise<Record<string, unknown>> {
    const generated = (await generateImage(
      "CrateRewards",
      {
        interaction: {
          user: {
            id: interaction.user.id,
            username: interaction.user.username,
            displayName: interaction.user.displayName,
            avatarURL: interaction.user.displayAvatarURL({
              extension: "png",
              size: 1024,
            }),
          },
          guild: {
            id: interaction.guild.id,
            name: interaction.guild.name,
            iconURL: interaction.guild.iconURL({
              extension: "png",
              size: 1024,
            }),
          },
        },
        locale: interaction.locale,
        crateType,
        crateEmoji,
        crateName,
        rewards,
        dominantColor: "user",
        returnDominant: true,
      },
      { image: 2, emoji: 2 },
      i18n as any
    )) as [Buffer, unknown];

    const rewardBuffer = generated?.[0];
    const dominantColor = generated?.[1];

    const rewardAttachment = new AttachmentBuilder(rewardBuffer, {
      name: "reward.avif",
    });

    const rewardComponent = new ComponentBuilder({
      dominantColor: dominantColor as any,
      mode: builderMode as any,
    }).addImage("attachment://reward.avif");

    const backButton = new ButtonBuilder()
      .setCustomId("back_to_crates")
      .setLabel(String(await i18n.__("commands.economy.cases.backToCrates")))
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🔙");

    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
    rewardComponent.addActionRow(backRow);

    return rewardComponent.toReplyOptions({
      files: [rewardAttachment],
    }) as Record<string, unknown>;
  },

  setupBackToMenuCollector(message, interaction, i18n): void {
    const backCollector = message.createMessageComponentCollector({
      filter: (i: ComponentInteractionLike) =>
        i.user.id === interaction.user.id && i.customId === "back_to_crates",
      time: 60000,
      max: 1,
    });

    backCollector.on("collect", async (i: ComponentInteractionLike) => {
      await i.deferUpdate();

      const newInteraction = {
        ...interaction,
        options: {
          ...interaction.options,
          getString: (name: string) =>
            name === "case" ? null : interaction.options.getString(name),
        },
        editReply: i.editReply.bind(i),
        reply: i.reply.bind(i),
        deferReply: () => Promise.resolve(),
      } as InteractionLike;

      await this.execute(newInteraction, i18n);
    });

    this.setupCollectorEnd(backCollector as any, message);
  },

  setupBackToCratesCollector(message, interaction, i18n, cratesList): void {
    const backCollector = message.createMessageComponentCollector({
      filter: (i: ComponentInteractionLike) =>
        i.user.id === interaction.user.id && i.customId === "back_to_crates",
      time: 60000,
      max: 1,
    });

    backCollector.on("collect", async (i: ComponentInteractionLike) => {
      try {
        const updatedCratesList = await this.buildCratesList(interaction, i18n);
        cratesList.splice(0, cratesList.length, ...updatedCratesList);

        const newInteraction = {
          ...interaction,
          guild: interaction.guild,
          user: interaction.user,
          options: interaction.options,
          locale: interaction.locale,
          editReply: i.update.bind(i),
          deferReply: () => Promise.resolve(),
        } as InteractionLike;

        await this.handleCaseMenu(newInteraction, i18n, "v2");
      } catch (error) {
        console.error("Error in back collector:", error);
        await this.handleCollectorError(i, i18n);
      }
    });

    this.setupCollectorEnd(backCollector as any, message);
  },

  setupCollectorEnd(collector, message): void {
    collector.on("end", async () => {
      try {
        if (message.editable) {
          await message.edit({ components: [] });
        }
      } catch (error) {
        console.error("Error disabling components:", error);
      }
    });
  },

  async handleError(interaction, i18n, _error): Promise<void> {
    const errorOptions = {
      content: await i18n.__("commands.economy.cases.error"),
      ephemeral: true,
    };

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(errorOptions);
      } else {
        await interaction.reply(errorOptions);
      }
    } catch (replyError) {
      console.error("Error sending error message:", replyError);
    }
  },

  async handleCollectorError(i, i18n): Promise<void> {
    try {
      if (i.replied || i.deferred) {
        await i.followUp({
          content: await i18n.__("commands.economy.cases.error"),
          ephemeral: true,
        });
      } else {
        await i.reply({
          content: await i18n.__("commands.economy.cases.error"),
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error("Error sending collector error message:", error);
    }
  },
};

export default command;
