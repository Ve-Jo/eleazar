import {
  SlashCommandSubcommand,
  SlashCommandOption,
  OptionType,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import { EmbedBuilder, AttachmentBuilder } from "discord.js";
import Database from "../../database/client.js";
import { generateRemoteImage } from "../../utils/remoteImageGenerator.js";
import i18n from "../../utils/i18n.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("economy", "deposit");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
    });

    // Add amount option
    const amountOption = new SlashCommandOption({
      type: OptionType.STRING,
      name: "amount",
      description: i18nBuilder.translateOption("amount", "description"),
      required: true,
      name_localizations: i18nBuilder.getOptionLocalizations("amount", "name"),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "amount",
        "description"
      ),
    });

    subcommand.addOption(amountOption);

    return subcommand;
  },
  async execute(interaction) {
    await interaction.deferReply();
    const amount = interaction.options.getString("amount");

    try {
      // Get user data with all relations
      const userData = await Database.getUser(
        interaction.guild.id,
        interaction.user.id,
        true
      );

      // Calculate deposit amount
      let amountInt = 0;
      if (amount === "all") {
        amountInt = Number(userData.economy?.balance || 0);
      } else if (amount === "half") {
        amountInt = Math.floor(Number(userData.economy?.balance || 0) / 2);
      } else {
        amountInt = parseInt(amount);
        if (isNaN(amountInt)) {
          return interaction.editReply({
            content: i18n.__("economy.deposit.invalidAmount"),
            ephemeral: true,
          });
        }
      }

      // Calculate current bank balance with interest
      let currentBankBalance = 0;
      if (userData.economy) {
        currentBankBalance = parseFloat(
          await Database.calculateBankBalance(userData)
        );
      }

      // Validate amount
      if (!userData.economy || userData.economy.balance < amountInt) {
        return interaction.editReply({
          content: i18n.__("economy.deposit.insufficientFunds"),
          ephemeral: true,
        });
      }
      if (amountInt <= 0) {
        return interaction.editReply({
          content: i18n.__("economy.deposit.amountGreaterThanZero"),
          ephemeral: true,
        });
      }

      // Calculate bank rate based on level
      const xp = Number(userData.level?.xp?.toString() || 0);
      const levelInfo = Database.calculateLevel(xp);
      const bankRate = 300 + Math.floor(levelInfo.level * 5); // Base 300% + 5% per level

      const userId = interaction.user.id;
      const guildId = interaction.guild.id;

      // Perform deposit operation in single transaction
      await Database.client.$transaction(async (tx) => {
        // Update economy record with both balance and bank changes
        await tx.economy.update({
          where: {
            userId_guildId: {
              userId,
              guildId,
            },
          },
          data: {
            balance: {
              decrement: amountInt,
            },
            bankBalance: (currentBankBalance + amountInt).toFixed(5),
            bankRate: bankRate.toFixed(5),
            bankStartTime: Date.now(),
          },
        });

        // Update user's last activity
        await tx.user.update({
          where: {
            guildId_id: {
              id: userId,
              guildId,
            },
          },
          data: {
            lastActivity: Date.now(),
          },
        });
      });

      // Get updated user data directly from database
      const updatedUser = await Database.getUser(
        interaction.guild.id,
        interaction.user.id,
        true
      );

      // Generate the transfer image
      const pngBuffer = await generateRemoteImage(
        "Transfer",
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
              locale: interaction.user.locale,
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
          database: updatedUser,
          amount: amountInt,
          isDeposit: true,
        },
        { width: 400, height: 200 }
      );

      const attachment = new AttachmentBuilder(pngBuffer.buffer, {
        name: `deposit.${
          pngBuffer.contentType === "image/gif" ? "gif" : "png"
        }`,
      });

      let deposit_embed = new EmbedBuilder()
        .setColor(process.env.EMBED_COLOR)
        .setTimestamp()
        .setImage(
          `attachment://deposit.${
            pngBuffer.contentType === "image/gif" ? "gif" : "png"
          }`
        )
        .setAuthor({
          name: i18n.__("economy.deposit.title"),
          iconURL: interaction.user.displayAvatarURL(),
        });

      await interaction.editReply({
        embeds: [deposit_embed],
        files: [attachment],
      });
    } catch (error) {
      console.error("Error in deposit command:", error);
      await interaction.editReply({
        content: i18n.__("economy.deposit.error"),
        ephemeral: true,
      });
    }
  },
  localization_strings: {
    name: {
      en: "deposit",
      ru: "внести",
      uk: "внести",
    },
    title: {
      en: "Deposit",
      ru: "Внести",
      uk: "Внести",
    },
    description: {
      en: "Deposit money",
      ru: "Положить деньги на счет",
      uk: "Покласти гроші на рахунок",
    },
    options: {
      amount: {
        name: {
          en: "amount",
          ru: "сумма",
          uk: "сума",
        },
        description: {
          en: "Amount to deposit (or 'all', 'half')",
          ru: "Сумма для внесения (или 'all', 'half')",
          uk: "Сума для внесення (або 'all', 'half')",
        },
      },
    },
    success: {
      en: "Successfully deposited {{amount}} coins",
      ru: "Успешно внесено {{amount}} монет",
      uk: "Успішно внесено {{amount}} монет",
    },
    amountGreaterThanZero: {
      en: "Amount must be greater than 0",
      ru: "Сумма должна быть больше 0",
      uk: "Сума повинна бути більшою за 0",
    },
    insufficientFunds: {
      en: "Insufficient funds",
      ru: "Недостаточно средств",
      uk: "Недостатньо коштів",
    },
    invalidAmount: {
      en: "Invalid amount",
      ru: "Неверная сумма",
      uk: "Невірна сума",
    },
    noBankAccount: {
      en: "You don't have a bank account",
      ru: "У вас нет банковского счета",
      uk: "У вас немає банківського рахунку",
    },
    error: {
      en: "An error occurred while processing your deposit",
      ru: "Произошла ошибка при обработке депозита",
      uk: "Сталася помилка під час обробки депозиту",
    },
  },
};
