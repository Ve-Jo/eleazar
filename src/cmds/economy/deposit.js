import {
  SlashCommandSubcommand,
  SlashCommandOption,
  OptionType,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import { EmbedBuilder, AttachmentBuilder } from "discord.js";
import EconomyEZ from "../../utils/economy.js";
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
      // Get initial user data and update bank balance
      await EconomyEZ.updateBankOnInactivity(
        interaction.guild.id,
        interaction.user.id
      );
      const initialUser = await EconomyEZ.get(
        `${interaction.guild.id}.${interaction.user.id}`
      );

      if (!initialUser?.bank) {
        return interaction.editReply({
          content: i18n.__("economy.deposit.noBankAccount"),
          ephemeral: true,
        });
      }

      // Calculate deposit amount
      let amountInt = 0;
      if (amount === "all") {
        amountInt = Number(initialUser.balance);
      } else if (amount === "half") {
        amountInt = Math.floor(Number(initialUser.balance) / 2);
      } else {
        amountInt = parseInt(amount);
        if (isNaN(amountInt)) {
          return interaction.editReply({
            content: i18n.__("economy.deposit.invalidAmount"),
            ephemeral: true,
          });
        }
      }

      // Validate amount
      if (initialUser.balance < amountInt) {
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

      // Perform the deposit transaction
      const levelInfo = EconomyEZ.calculateLevel(initialUser.totalXp);
      const holdingPercentage = 300 + levelInfo.level * 10; // Base 300% + level bonus

      // First update the bank
      await EconomyEZ.set(
        `${interaction.guild.id}.${interaction.user.id}.bank`,
        {
          amount: initialUser.bank.amount + amountInt,
          startedToHold: initialUser.bank.startedToHold || Date.now(),
          holdingPercentage: Math.max(
            holdingPercentage,
            initialUser.bank.holdingPercentage || 0
          ),
        }
      );

      // Then update the balance
      await EconomyEZ.set(
        `${interaction.guild.id}.${interaction.user.id}.balance`,
        initialUser.balance - amountInt
      );

      // Get updated user data
      const updatedUser = await EconomyEZ.get(
        `${interaction.guild.id}.${interaction.user.id}`
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
