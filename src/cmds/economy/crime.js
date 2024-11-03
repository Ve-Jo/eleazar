import {
  SlashCommandSubcommand,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  AttachmentBuilder,
} from "discord.js";
import EconomyEZ from "../../utils/economy.js";
import prettyMs from "pretty-ms";
import cooldownsManager from "../../utils/cooldownsManager.js";
import { generateRemoteImage } from "../../utils/remoteImageGenerator.js";
import i18n from "../../utils/i18n.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("economy", "crime");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
    });

    return subcommand;
  },
  async execute(interaction) {
    const user = interaction.user;
    const guildId = interaction.guild.id;

    const timeLeft = await cooldownsManager.getCooldownTime(
      guildId,
      user.id,
      "crime"
    );

    if (timeLeft > 0) {
      const pngBuffer = await generateRemoteImage(
        "Cooldown",
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
          nextDaily: timeLeft,
          emoji: "🦹",
        },
        { width: 450, height: 200 },
        { image: 2, emoji: 2 }
      );

      const attachment = new AttachmentBuilder(pngBuffer, {
        name: "crime_cooldown.png",
      });

      return interaction.editReply({
        files: [attachment],
        content: i18n.__("economy.crimeCooldown", {
          time: prettyMs(timeLeft, { verbose: true }),
        }),
      });
    }

    const guildEconomy = await EconomyEZ.get(`economy.${guildId}`);

    console.log(`guildEconomy`);
    console.log(JSON.stringify(guildEconomy, null, 2));

    const sortedUsers = Object.entries(guildEconomy)
      .filter(
        ([, userData]) =>
          userData.user_id !== user.id &&
          !interaction.guild.members.cache.get(userData.user_id)?.user.bot
      )
      .sort(([, a], [, b]) => b.balance - a.balance)
      .slice(0, 25);

    console.log(`sortedUsers`);
    console.log(JSON.stringify(sortedUsers, null, 2));

    if (sortedUsers.length === 0) {
      return interaction.editReply({
        content: i18n.__("economy.noValidTargets"),
        ephemeral: true,
      });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("select_crime_target")
      .setPlaceholder(i18n.__("economy.crimeTargetPlaceholder"))
      .addOptions(
        await Promise.all(
          sortedUsers.map(async ([, userData]) => {
            let member = interaction.guild.members.cache.get(userData.user_id);
            if (!member) {
              try {
                member = await interaction.guild.members.fetch(
                  userData.user_id
                );
              } catch (error) {
                console.error(
                  `Failed to fetch member ${userData.user_id}:`,
                  error
                );
              }
            }
            return {
              label: member
                ? member.displayName
                : `${i18n.__("economy.unknownUser")} (${userData.user_id})`,
              description: `${userData.balance.toFixed(2)} 💵`,
              value: userData.user_id,
            };
          })
        )
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const response = await interaction.editReply({
      content: i18n.__("economy.selectCrimeTarget"),
      components: [row],
    });

    try {
      const collection = await response.awaitMessageComponent({
        filter: (i) => i.user.id === user.id,
        time: 30000,
        componentType: ComponentType.StringSelect,
      });

      const targetId = collection.values[0];
      const target = await interaction.guild.members.fetch(targetId);

      // Proceed with the crime logic
      await performCrime(interaction, user, target, guildId);
    } catch (e) {
      await interaction.editReply({
        content: i18n.__("economy.noSelectionMade"),
        components: [],
      });
    }
  },
  localization_strings: {
    name: {
      en: "crime",
      ru: "преступление",
      uk: "злочин",
    },
    description: {
      en: "Attempt to steal cash from another user",
      ru: "Попытаться украсть деньги у другого пользователя",
      uk: "Спробувати вкрасти гроші у іншого користувача",
    },
  },
};

async function performCrime(interaction, user, target, guildId) {
  const userData = await EconomyEZ.get(`economy.${guildId}.${user.id}`);
  const targetData = await EconomyEZ.get(`economy.${guildId}.${target.id}`);

  const userCash = userData.balance;
  const targetCash = targetData.balance;

  if (userCash < targetCash / 5) {
    return interaction.editReply({
      content: i18n.__("economy.insufficientFundsForCrime"),
      components: [],
    });
  }

  const success = Math.random() < 0.5; // 50% chance of success
  let amount;
  let description;

  if (success) {
    amount = Math.floor(Math.random() * (targetCash / 2));
    await EconomyEZ.math(`economy.${guildId}.${user.id}.balance`, "+", amount);
    await EconomyEZ.math(
      `economy.${guildId}.${target.id}.balance`,
      "-",
      amount
    );
    description = i18n.__("economy.crimeSuccess", { amount });
  } else {
    amount = Math.floor(Math.random() * (userCash / 2));
    await EconomyEZ.math(`economy.${guildId}.${user.id}.balance`, "-", amount);
    await EconomyEZ.math(
      `economy.${guildId}.${target.id}.balance`,
      "+",
      amount
    );
    description = i18n.__("economy.crimeFailure", { amount });
  }

  await EconomyEZ.set(`timestamps.${guildId}.${user.id}.crime`, Date.now());

  let updatedUserBalance = await EconomyEZ.get(
    `economy.${guildId}.${user.id}.balance`
  );
  let updatedTargetBalance = await EconomyEZ.get(
    `economy.${guildId}.${target.id}.balance`
  );

  const pngBuffer = await generateRemoteImage(
    "Crime",
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
          iconURL: interaction.guild.iconURL({ extension: "png", size: 1024 }),
        },
      },
      victim: {
        user: {
          id: target.id,
          username: target.user.username,
          displayName: target.displayName,
          avatarURL: target.displayAvatarURL({ extension: "png", size: 1024 }),
        },
        balance: updatedTargetBalance,
      },
      robber: {
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarURL: user.displayAvatarURL({ extension: "png", size: 1024 }),
        },
        balance: updatedUserBalance,
      },
      amount: amount,
      success: success,
    },
    { width: 450, height: 200 }
  );

  const attachment = new AttachmentBuilder(pngBuffer, { name: "crime.png" });

  const embed = new EmbedBuilder()
    .setColor(process.env.EMBED_COLOR)
    .setTimestamp()
    .setImage("attachment://crime.png")
    .setAuthor({
      name: i18n.__("economy.title"),
      iconURL: user.avatarURL(),
    })
    .setDescription(description);

  await interaction.editReply({
    content: " ",
    embeds: [embed],
    files: [attachment],
    components: [],
  });
}
