import {
  MessageFlags,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import hubClient, { CRATE_TYPES } from "../../api/hubClient.js";
import prettyMs from "pretty-ms";
import { generateImage } from "../../utils/imageGenerator.js";
import CratesDisplay from "../../render-server/components/CratesDisplay.jsx";
import { ComponentBuilder } from "../../utils/componentConverter.js";

export default {
  data: () => {
    const builder = new SlashCommandSubcommandBuilder()
      .setName("cases")
      .setDescription("Open cases and get rewards")
      .addStringOption((option) =>
        option
          .setName("case")
          .setDescription("Choose a specific case to open directly")
          .setRequired(false)
          .addChoices(
            {
              name: "daily",
              value: "daily",
            },
            {
              name: "weekly",
              value: "weekly",
            }
          )
      );

    return builder;
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
  },

  async execute(interaction, i18n) {
    const builderMode = "v2";

    await interaction.deferReply();

    try {
      const requestedCase = interaction.options.getString("case");

      if (requestedCase) {
        return await this.handleDirectCaseOpen(
          interaction,
          i18n,
          requestedCase,
          builderMode
        );
      }

      return await this.handleCaseMenu(interaction, i18n, builderMode);
    } catch (error) {
      console.error("Error in cases command:", error);
      await this.handleError(interaction, i18n, error);
    }
  },

  async handleDirectCaseOpen(interaction, i18n, requestedCase, builderMode) {
    if (!["daily", "weekly"].includes(requestedCase)) {
      await interaction.editReply({
        content: await i18n.__("commands.economy.cases.noCratesAvailable"),
      });
      return;
    }

    const cooldownTimestamp = await hubClient.getCrateCooldown(
      interaction.guild.id,
      interaction.user.id,
      requestedCase
    );

    const now = Date.now();
    const remainingCooldown =
      cooldownTimestamp > 0
        ? Math.max(
            0,
            cooldownTimestamp + CRATE_TYPES[requestedCase].cooldown - now
          )
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
      const { crateName, crateEmoji } = this.getCrateInfo(requestedCase, i18n);
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

  async handleCaseMenu(interaction, i18n, builderMode) {
    // Ensure user exists in database before fetching data
    await hubClient.ensureGuildUser(interaction.guild.id, interaction.user.id);

    const userData = await hubClient.getUser(
      interaction.guild.id,
      interaction.user.id
    );

    const cratesList = await this.buildCratesList(interaction, i18n);
    let selectedCrate = 0;

    const generateCratesMessage = async (disableInteractions = false) => {
      const [pngBuffer, dominantColor] = await generateImage(
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
          selectedCrate: selectedCrate,
          dominantColor: "user",
          returnDominant: true,
        },
        { image: 2, emoji: 2 },
        i18n
      );

      const attachment = new AttachmentBuilder(pngBuffer, {
        name: "crates.avif",
      });

      const cratesComponent = new ComponentBuilder({
        dominantColor,
        mode: builderMode,
      })
        .addText(await i18n.__("commands.economy.cases.title"), "header3")
        .addText(
          await i18n.__("commands.economy.cases.balance", {
            balance: Math.round(Number(userData.economy?.balance || 0)),
          })
        )
        .addImage("attachment://crates.avif");

      if (!disableInteractions) {
        const selectMenu = await this.createSelectMenu(
          cratesList,
          selectedCrate,
          i18n
        );
        const openButton = await this.createOpenButton(
          cratesList,
          selectedCrate,
          i18n
        );

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);
        const buttonRow = new ActionRowBuilder().addComponents(openButton);

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
      filter: (i) => i.user.id === interaction.user.id,
      time: 60000,
    });

    collector.on("collect", async (i) => {
      try {
        console.log("Button/Menu interaction detected:", i.customId);
        if (i.customId === "select_crate") {
          selectedCrate = parseInt(i.values[0]);
          await i.update(await generateCratesMessage());
        } else if (i.customId === "open_crate") {
          console.log("Open crate button clicked!");
          await this.handleCrateOpen(
            i,
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
        await this.handleCollectorError(i, i18n);
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

  async buildCratesList(interaction, i18n) {
    const crates = await hubClient.getUserCrates(
      interaction.guild.id,
      interaction.user.id
    );

    const [dailyCooldown, weeklyCooldown] = await Promise.all([
      this.getCooldownTime(interaction, "daily"),
      this.getCooldownTime(interaction, "weekly"),
    ]);

    const cratesList = [
      {
        id: "daily",
        name: this.getCrateTranslation("types.daily.name", "Daily Crate", i18n),
        description: this.getCrateTranslation(
          "types.daily.description",
          "A crate you can open once every 24 hours",
          i18n
        ),
        emoji: CRATE_TYPES.daily.emoji,
        available: dailyCooldown <= 0,
        cooldown: dailyCooldown,
        count: -1,
      },
      {
        id: "weekly",
        name: this.getCrateTranslation(
          "types.weekly.name",
          "Weekly Crate",
          i18n
        ),
        description: this.getCrateTranslation(
          "types.weekly.description",
          "A crate you can open once every 7 days",
          i18n
        ),
        emoji: CRATE_TYPES.weekly.emoji,
        available: weeklyCooldown <= 0,
        cooldown: weeklyCooldown,
        count: -1,
      },
    ];

    // Add special crates from inventory
    for (const crate of crates) {
      if (crate.count > 0 && !["daily", "weekly"].includes(crate.type)) {
        cratesList.push({
          id: crate.type,
          name: this.getCrateTranslation(
            `types.${crate.type}.name`,
            crate.type,
            i18n
          ),
          description: this.getCrateTranslation(
            `types.${crate.type}.description`,
            "A special crate with unique rewards",
            i18n
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

  async getCooldownTime(interaction, crateType) {
    const cooldownTimestamp = await hubClient.getCrateCooldown(
      interaction.guild.id,
      interaction.user.id,
      crateType
    );

    const now = Date.now();
    return cooldownTimestamp > 0
      ? Math.max(0, cooldownTimestamp + CRATE_TYPES[crateType].cooldown - now)
      : 0;
  },

  getCrateTranslation(path, defaultValue, i18n) {
    const userLocale = i18n.getUserLocale ? i18n.getUserLocale() : "en";

    const pathParts = path.split(".");
    let result = CratesDisplay.localization_strings;

    for (const part of pathParts) {
      if (!result[part]) return defaultValue;
      result = result[part];
    }

    return result[userLocale] || result.en || defaultValue;
  },

  getCrateInfo(requestedCase, i18n) {
    const crateName = this.getCrateTranslation(
      `types.${requestedCase}.name`,
      requestedCase,
      i18n
    );
    const crateEmoji = CRATE_TYPES[requestedCase]?.emoji || "🎁";

    return { crateName, crateEmoji };
  },

  async createSelectMenu(cratesList, selectedCrate, i18n) {
    return new StringSelectMenuBuilder()
      .setCustomId("select_crate")
      .setPlaceholder(await i18n.__("commands.economy.cases.selectCrate"))
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

  async createOpenButton(cratesList, selectedCrate, i18n) {
    return new ButtonBuilder()
      .setCustomId("open_crate")
      .setLabel(await i18n.__("commands.economy.cases.openButton"))
      .setStyle(ButtonStyle.Success)
      .setDisabled(!cratesList[selectedCrate].available);
  },

  async handleCrateOpen(
    i,
    cratesList,
    selectedCrate,
    interaction,
    i18n,
    builderMode,
    message
  ) {
    const selectedCrateInfo = cratesList[selectedCrate];

    if (!selectedCrateInfo.available) {
      await i.reply({
        content: await i18n.__("commands.economy.cases.cooldownActive", {
          time: prettyMs(selectedCrateInfo.cooldown, { verbose: true }),
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

  // Shared method for opening cases and creating reward messages
  async openCaseAndCreateMessage(
    interaction,
    i18n,
    crateType,
    crateName,
    crateEmoji,
    builderMode,
    logPrefix = "CASE OPENING"
  ) {
    const rewards = await hubClient.openCrate(
      interaction.guild.id,
      interaction.user.id,
      crateType
    );

    console.log(`${logPrefix} - REWARDS:`);
    console.log(rewards);

    return await this.createRewardMessage(
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
  ) {
    const [rewardBuffer, dominantColor] = await generateImage(
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
        crateType: crateType,
        crateEmoji: crateEmoji,
        crateName: crateName,
        rewards: rewards,
        dominantColor: "user",
        returnDominant: true,
      },
      { image: 2, emoji: 2 },
      i18n
    );

    const rewardAttachment = new AttachmentBuilder(rewardBuffer, {
      name: "reward.avif",
    });

    const rewardComponent = new ComponentBuilder({
      dominantColor,
      mode: builderMode,
    }).addImage("attachment://reward.avif");

    const backButton = new ButtonBuilder()
      .setCustomId("back_to_crates")
      .setLabel(await i18n.__("commands.economy.cases.backToCrates"))
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🔙");

    const backRow = new ActionRowBuilder().addComponents(backButton);
    rewardComponent.addActionRow(backRow);

    return rewardComponent.toReplyOptions({
      files: [rewardAttachment],
    });
  },

  setupBackToMenuCollector(message, interaction, i18n) {
    const backCollector = message.createMessageComponentCollector({
      filter: (i) =>
        i.user.id === interaction.user.id && i.customId === "back_to_crates",
      time: 60000,
      max: 1,
    });

    backCollector.on("collect", async (i) => {
      await i.deferUpdate();

      const newInteraction = {
        ...interaction,
        options: {
          ...interaction.options,
          getString: (name) =>
            name === "case" ? null : interaction.options.getString(name),
        },
        editReply: i.editReply.bind(i),
        reply: i.reply.bind(i),
        deferReply: () => Promise.resolve(),
      };

      await this.execute(newInteraction, i18n);
    });

    this.setupCollectorEnd(backCollector, message);
  },

  setupBackToCratesCollector(message, interaction, i18n, cratesList) {
    const backCollector = message.createMessageComponentCollector({
      filter: (i) =>
        i.user.id === interaction.user.id && i.customId === "back_to_crates",
      time: 60000,
      max: 1,
    });

    backCollector.on("collect", async (i) => {
      try {
        const updatedCratesList = await this.buildCratesList(interaction, i18n);
        // Update the original cratesList reference
        cratesList.splice(0, cratesList.length, ...updatedCratesList);

        const newInteraction = {
          ...interaction,
          guild: interaction.guild,
          user: interaction.user,
          options: interaction.options,
          locale: interaction.locale,
          editReply: i.update.bind(i),
          deferReply: () => Promise.resolve(),
        };

        await this.handleCaseMenu(newInteraction, i18n, "v2");
      } catch (error) {
        console.error("Error in back collector:", error);
        await this.handleCollectorError(i, i18n);
      }
    });

    this.setupCollectorEnd(backCollector, message);
  },

  setupCollectorEnd(collector, message) {
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

  async handleError(interaction, i18n, error) {
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

  async handleCollectorError(i, i18n) {
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
