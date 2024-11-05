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
    await interaction.deferReply();
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
          locale: interaction.locale,
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
        content: i18n.__("economy.crime.cooldown", {
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
        content: i18n.__("economy.crime.noValidTargets"),
        ephemeral: true,
      });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("select_crime_target")
      .setPlaceholder(i18n.__("economy.crime.selectCrimeTarget"))
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
                : `${i18n.__("economy.crime.unknownUser")} (${
                    userData.user_id
                  })`,
              description: `${userData.balance.toFixed(2)} 💵`,
              value: userData.user_id,
            };
          })
        )
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const response = await interaction.editReply({
      content: i18n.__("economy.crime.selectCrimeTarget"),
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
      console.log(e);
      await interaction.editReply({
        content: i18n.__("economy.crime.noSelectionMade"),
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
    title: {
      en: "Crime",
      ru: "Преступление",
      uk: "Злочин",
    },
    description: {
      en: "Attempt to steal cash from another user",
      ru: "Попытаться украсть деньги у другого пользователя",
      uk: "Спробувати вкрасти гроші у іншого користувача",
    },
    selectCrimeTarget: {
      en: "Select a user to steal from",
      ru: "Выберите пользователя, у которого хотите украсть деньги",
      uk: "Виберіть користувача, у якого хочете вкрасти гроші",
    },
    noSelectionMade: {
      en: "No selection made",
      ru: "Ничего не выбрано",
      uk: "Нічого не вибрано",
    },
    insufficientFundsForCrime: {
      en: "Insufficient funds for crime",
      ru: "Недостаточно средств для преступления",
      uk: "Недостатньо коштів для злочину",
    },
    success: {
      en: "You successfully stole {{amount}} coins",
      ru: "Вы успешно украли {{amount}} монет",
      uk: "Ви успішно вкрали {{amount}} монет",
    },
    failure: {
      en: "You failed to steal. You lost {{amount}} coins",
      ru: "Вы не смогли украсть деньги. Вы потеряли {{amount}} монет",
      uk: "Ви не змогли вкрасти гроші. Ви втратили {{amount}} монет",
    },
    cooldown: {
      en: "You have to wait {{time}} to commit another crime",
      ru: "Вам нужно подождать {{time}} чтобы совершить другое преступление",
      uk: "Вам потрібно почекати {{time}} щоб скористатися ще одним злочином",
    },
    noValidTargets: {
      en: "No valid targets found",
      ru: "Не найдено допустимых целей",
      uk: "Не знайдено допустимих цілей",
    },
    unknownUser: {
      en: "Unknown user",
      ru: "Неизвестный пользователь",
      uk: "Незнайомий користувач",
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
      content: i18n.__("economy.crime.insufficientFundsForCrime"),
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
    description = i18n.__("economy.crime.success", { amount });
  } else {
    amount = Math.floor(Math.random() * (userCash / 2));
    await EconomyEZ.math(`economy.${guildId}.${user.id}.balance`, "-", amount);
    await EconomyEZ.math(
      `economy.${guildId}.${target.id}.balance`,
      "+",
      amount
    );
    description = i18n.__("economy.crime.failure", { amount });
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
      locale: interaction.locale,
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
      name: i18n.__("economy.crime.title"),
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
