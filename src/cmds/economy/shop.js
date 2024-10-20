import {
  SlashCommandSubcommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SelectMenuBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import i18n from "../../utils/i18n";
import { getUpgradesForUser } from "../../utils/shopManager";
import EconomyEZ from "../../utils/economy";

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("shop")
    .setDescription("Buy upgrades/roles")
    .setDescriptionLocalizations({
      ru: "Купить улучшения/роли",
      uk: "Купити улучшення/ролі",
    }),
  async execute(interaction) {
    return interaction.editReply({
      content: "Магазин будет переработан в ближайшее время",
    });

    const locale = interaction.locale || "en";
    const upgrades = await getUpgradesForUser(
      interaction.guildId,
      interaction.user.id,
      locale
    );

    console.log(upgrades);

    let currentIndex = 0;

    const getUpgradeDescription = (upgrade) => {
      return `\`\`\`mk\n${upgrade.emoji} "${
        upgrade.name
      }"\n${upgrade.description.replace(
        "{current_multiplier}",
        upgrade.current_multiplier
      )}\n\n${i18n.__({ phrase: "economy.shop.price", locale })}: ${
        upgrade.price
      } 💵\n${i18n.__({ phrase: "economy.shop.purchase", locale })}: +${
        upgrade.multiplier_increase
      }%\n# ${upgrade.current_level} ${i18n.__({
        phrase: "economy.shop.level",
        locale,
      })} ${upgrade.max_level || "∞"}\`\`\``;
    };

    const shop_embed = new EmbedBuilder()
      .setColor(process.env.EMBED_COLOR)
      .setTimestamp()
      .setThumbnail(interaction.user.avatarURL())
      .setAuthor({
        name: i18n.__({ phrase: "economy.shop.title", locale }),
        iconURL: interaction.user.avatarURL(),
      })
      .setDescription(getUpgradeDescription(upgrades[currentIndex]));

    const selectMenu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("select-upgrade")
        .setPlaceholder(
          i18n.__({ phrase: "economy.shop.selectPlaceholder", locale })
        )
        .addOptions(
          upgrades.map((upgrade, index) => ({
            label: upgrade.name,
            description:
              `(${upgrade.current_level}) ` + upgrade.short_description,
            emoji: upgrade.emoji,
            value: index.toString(),
          }))
        )
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("buy")
        .setLabel(i18n.__({ phrase: "economy.shop.buyButton", locale }))
        .setStyle(ButtonStyle.Success)
    );

    const message = await interaction.editReply({
      embeds: [shop_embed],
      components: [row, selectMenu],
      fetchReply: true,
    });

    const filter = (i) => i.user.id === interaction.user.id;
    const collector = message.createMessageComponentCollector({
      filter,
      time: 60000,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "select-upgrade") {
        currentIndex = parseInt(i.values[0], 10);
      } else if (i.customId === "buy") {
        const upgrade = upgrades[currentIndex];
        const userBalance = await EconomyEZ.get(
          `economy.${interaction.guildId}.${interaction.user.id}.balance`
        );

        if (userBalance < upgrade.price) {
          await i.update({
            content: i18n.__({ phrase: "economy.insufficientFunds", locale }),
            components: [],
          });
          return;
        }

        await EconomyEZ.math(
          `economy.${interaction.guildId}.${interaction.user.id}.balance`,
          "-",
          upgrade.price
        );
        await EconomyEZ.set(
          `shop.${interaction.guildId}.${interaction.user.id}.upgrade_id`,
          upgrade.id
        );
        await EconomyEZ.math(
          `shop.${interaction.guildId}.${interaction.user.id}.upgrade_level`,
          "+",
          1
        );

        await i.update({
          content: i18n.__(
            { phrase: "economy.shop.purchaseMessage", locale },
            {
              name: upgrade.name,
              price: upgrade.price,
            }
          ),
          components: [],
        });
        return;
      }

      shop_embed.setDescription(getUpgradeDescription(upgrades[currentIndex]));
      await i.update({ embeds: [shop_embed], components: [row, selectMenu] });
    });

    collector.on("end", (collected) => {
      message.edit({ components: [] });
    });
  },
};
