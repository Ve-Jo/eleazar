import {
  SlashCommandSubcommand,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import {
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";
import { getUpgradesForUser } from "../../utils/shopManager.js";
import EconomyEZ from "../../utils/economy.js";
import { generateRemoteImage } from "../../utils/remoteImageGenerator.js";
import i18n from "../../utils/i18n.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("economy", "shop");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
    });

    return subcommand;
  },
  async execute(interaction) {
    await interaction.deferReply();
    const locale = interaction.locale || "en";
    const upgrades = await getUpgradesForUser(
      interaction.guildId,
      interaction.user.id,
      locale
    );

    let currentUpgrade = 0;
    let balance = await EconomyEZ.get(
      `economy.${interaction.guildId}.${interaction.user.id}.balance`
    );

    const generateShopImage = async () => {
      // Ensure all data is properly formatted for Satori
      const formattedUpgrades = upgrades.map((upgrade) => ({
        ...upgrade,
        title: String(upgrade.title),
        description: String(upgrade.description),
        currentLevel: Number(upgrade.currentLevel),
        nextLevel: Number(upgrade.nextLevel),
        price: Number(upgrade.price),
        progress: Number(upgrade.progress),
        emoji: String(upgrade.emoji),
      }));

      let formattedBalance = Number(balance);

      const pngBuffer = await generateRemoteImage(
        "UpgradesDisplay",
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
          upgrades: formattedUpgrades,
          currentUpgrade: Number(currentUpgrade),
          balance: formattedBalance,
        },
        { width: 600, height: 350 }
      );

      const attachment = new AttachmentBuilder(pngBuffer.buffer, {
        name: `shop.${pngBuffer.contentType === "image/gif" ? "gif" : "png"}`,
      });

      const embed = new EmbedBuilder()
        .setTimestamp()
        .setColor(process.env.EMBED_COLOR)
        .setImage(
          `attachment://shop.${
            pngBuffer.contentType === "image/gif" ? "gif" : "png"
          }`
        )
        .setAuthor({
          name: i18n.__("economy.shop.title"),
          iconURL: interaction.user.avatarURL(),
        });

      return { embeds: [embed], files: [attachment] };
    };

    const updateMessage = async () => {
      try {
        const { embeds, files } = await generateShopImage();
        return { embeds, files };
      } catch (error) {
        console.error("Error generating shop image:", error);
        return {
          content: i18n.__("economy.shop.errorGeneratingImage"),
        };
      }
    };

    const createUpgradeMenu = () => {
      return new StringSelectMenuBuilder()
        .setCustomId("select-upgrade")
        .setPlaceholder(i18n.__("economy.shop.selectPlaceholder"))
        .addOptions(
          upgrades.map((upgrade, index) => ({
            label: upgrade.title || "Unknown Upgrade",
            description: `(${upgrade.currentLevel}) ${upgrade.description}`,
            emoji: upgrade.emoji,
            value: index.toString(),
          }))
        );
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("buy")
        .setLabel(i18n.__("economy.shop.buyButton"))
        .setStyle(ButtonStyle.Success)
    );

    const selectMenu = new ActionRowBuilder().addComponents(
      createUpgradeMenu()
    );

    const response = await interaction.editReply({
      ...(await updateMessage()),
      components: [row, selectMenu],
    });

    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 60000,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "select-upgrade") {
        currentUpgrade = parseInt(i.values[0], 10);
        await i.deferUpdate();
        await response.edit({
          ...(await updateMessage()),
          components: [row, selectMenu],
        });
      } else if (i.customId === "buy") {
        const upgrade = upgrades[currentUpgrade];

        if (balance < upgrade.price) {
          await i.reply({
            content: i18n.__("economy.shop.insufficientFunds"),
            ephemeral: true,
          });
          return;
        }

        try {
          // Deduct the price from the user's balance
          await EconomyEZ.math(
            `economy.${interaction.guildId}.${interaction.user.id}.balance`,
            "-",
            upgrade.price
          );

          // Increment the upgrade level
          const currentLevel =
            (await EconomyEZ.get(
              `shop.${interaction.guildId}.${interaction.user.id}.upgrade_level.${upgrade.id}`
            )) || 0;

          // Here's the corrected line:
          await EconomyEZ.set(
            `shop.${interaction.guildId}.${interaction.user.id}.upgrade_level.${upgrade.id}`,
            currentLevel + 1
          );

          await i.reply({
            content: i18n.__("economy.shop.purchaseMessage", {
              name: upgrade.title,
              price: upgrade.price,
            }),
            ephemeral: true,
          });

          // Update the message with new data
          const updatedUpgrades = await getUpgradesForUser(
            interaction.guildId,
            interaction.user.id,
            locale
          );
          upgrades.splice(0, upgrades.length, ...updatedUpgrades);
          balance = await EconomyEZ.get(
            `economy.${interaction.guildId}.${interaction.user.id}.balance`
          );

          await response.edit({
            ...(await updateMessage()),
            components: [
              row,
              new ActionRowBuilder().addComponents(createUpgradeMenu()),
            ],
          });
        } catch (error) {
          console.error("Error during purchase:", error);
          await i.reply({
            content: i18n.__("economy.shop.purchaseError"),
            ephemeral: true,
          });
        }
      }
    });

    collector.on("end", () => {
      response.edit({ components: [] });
    });
  },
  localization_strings: {
    name: {
      en: "shop",
      ru: "магазин",
      uk: "магазин",
    },
    description: {
      en: "Buy upgrades/roles",
      ru: "Купить улучшения/роли",
      uk: "Купити улучшення/ролі",
    },
    title: {
      en: "Shop",
      ru: "Магазин",
      uk: "Магазин",
    },
    selectPlaceholder: {
      en: "Select an upgrade",
      ru: "Выберите улучшение",
      uk: "Виберіть улучшення",
    },
    insufficientFunds: {
      en: "Insufficient funds",
      ru: "Недостаточно средств",
      uk: "Недостатньо коштів",
    },
    buyButton: {
      en: "Buy",
      ru: "Купить",
      uk: "Купити",
    },
    errorGeneratingImage: {
      en: "Error generating image",
      ru: "Ошибка при генерации изображения",
      uk: "Помилка при генерації зображення",
    },
    purchaseMessage: {
      en: "{{name}} purchased for {{price}}",
      ru: "{{name}} куплен за {{price}}",
      uk: "{{name}} куплено за {{price}}",
    },
    purchaseError: {
      en: "Error during purchase",
      ru: "Ошибка при покупке",
      uk: "Помилка при покупці",
    },
  },
};
