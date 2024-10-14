import {
  SlashCommandSubcommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  AttachmentBuilder,
} from "discord.js";
import EconomyEZ from "../../utils/economy.js";
import i18n from "../../utils/i18n.js";
import prettyMs from "pretty-ms";
import cooldownsManager from "../../utils/cooldownsManager.js";
import Crime from "../../components/Crime.jsx";
import Cooldown from "../../components/Cooldown.jsx";
import { generateImage } from "../../utils/imageGenerator.js";

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("crime")
    .setDescription("Attempt to steal cash from another user")
    .setDescriptionLocalizations({
      ru: "Попытаться украсть деньги у другого пользователя",
      uk: "Спробувати вкрасти гроші у іншого користувача",
    }),
  async execute(interaction) {
    const user = interaction.user;
    const guildId = interaction.guild.id;

    const timeLeft = await cooldownsManager.getCooldownTime(
      guildId,
      user.id,
      "crime"
    );

    if (timeLeft > 0) {
      const pngBuffer = await generateImage(
        Cooldown,
        {
          interaction,
          user: interaction.user,
          nextDaily: timeLeft,
          emoji: "🦹",
        },
        { width: 450, height: 200 }
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

  const pngBuffer = await generateImage(
    Crime,
    {
      interaction: interaction,
      victim: {
        user: target,
        balance: targetData.balance,
      },
      robber: {
        user: user,
        balance: userData.balance,
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
