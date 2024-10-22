import {
  SlashCommandSubcommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";
import i18n from "../../utils/i18n";
import { getUpgradesForUser } from "../../utils/shopManager";
import EconomyEZ from "../../utils/economy";
import UpgradesDisplay from "../../components/UpgradesDisplay.jsx";
import { generateImage } from "../../utils/imageGenerator.js";

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("shop")
    .setDescription("Buy upgrades/roles")
    .setDescriptionLocalizations({
      ru: "Купить улучшения/роли",
      uk: "Купити улучшення/ролі",
    }),
  async execute(interaction) {
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

      return await generateImage(
        UpgradesDisplay,
        {
          interaction: interaction,
          upgrades: formattedUpgrades,
          currentUpgrade: Number(currentUpgrade),
          balance: formattedBalance,
          width: 600,
          height: 350,
        },
        { width: 600, height: 350 }
      );
    };

    const updateMessage = async () => {
      try {
        const pngBuffer = await generateShopImage();
        const attachment = new AttachmentBuilder(pngBuffer, {
          name: "shop.png",
        });

        const embed = new EmbedBuilder()
          .setTimestamp()
          .setColor(process.env.EMBED_COLOR)
          .setImage("attachment://shop.png")
          .setAuthor({
            name: i18n.__({ phrase: "economy.shop.title", locale }),
            iconURL: interaction.user.avatarURL(),
          });

        return { embeds: [embed], files: [attachment] };
      } catch (error) {
        console.error("Error generating shop image:", error);
        return {
          content: i18n.__({
            phrase: "economy.shop.errorGeneratingImage",
            locale,
          }),
        };
      }
    };

    const createUpgradeMenu = () => {
      return new StringSelectMenuBuilder()
        .setCustomId("select-upgrade")
        .setPlaceholder(
          i18n.__({ phrase: "economy.shop.selectPlaceholder", locale })
        )
        .addOptions(
          upgrades.map((upgrade, index) => ({
            label: upgrade.title,
            description: `(${upgrade.currentLevel}) ${upgrade.description}`,
            emoji: upgrade.emoji,
            value: index.toString(),
          }))
        );
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("buy")
        .setLabel(i18n.__({ phrase: "economy.shop.buyButton", locale }))
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
            content: i18n.__({ phrase: "economy.insufficientFunds", locale }),
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
            content: i18n.__(
              { phrase: "economy.shop.purchaseMessage", locale },
              {
                name: upgrade.title,
                price: upgrade.price,
              }
            ),
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
            content: i18n.__({ phrase: "economy.shop.purchaseError", locale }),
            ephemeral: true,
          });
        }
      }
    });

    collector.on("end", () => {
      response.edit({ components: [] });
    });
  },
};
