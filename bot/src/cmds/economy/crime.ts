import {
  ActionRowBuilder,
  AttachmentBuilder,
  ComponentType,
  SlashCommandSubcommandBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import hubClient from "../../api/hubClient.ts";
import { UPGRADES } from "../../../../hub/shared/src/domain.ts";
import { generateImage } from "../../utils/imageGenerator.ts";
import { ComponentBuilder } from "../../utils/componentConverter.ts";
import ms from "ms";

type TranslatorLike = {
  __: (key: string, vars?: Record<string, unknown>) => Promise<string | unknown>;
};

type UserLike = {
  id: string;
  username: string;
  displayName: string;
  displayAvatarURL: (options?: Record<string, unknown>) => string;
};

type GuildMemberLike = {
  id: string;
  displayName: string;
  user: UserLike & { bot?: boolean };
  displayAvatarURL: (options?: Record<string, unknown>) => string;
};

type GuildLike = {
  id: string;
  name: string;
  iconURL: (options?: Record<string, unknown>) => string | null;
  members: {
    fetch: (userId: string) => Promise<GuildMemberLike>;
  };
};

type EconomyUserData = Record<string, any> & {
  id: string;
  economy?: {
    balance?: number;
  };
  upgrades?: Array<{ type: string; level?: number }>;
};

type MessageLike = {
  awaitMessageComponent: (options: Record<string, unknown>) => Promise<any>;
};

type InteractionLike = {
  replied?: boolean;
  deferred?: boolean;
  locale: string;
  user: UserLike;
  guild: GuildLike;
  deferReply: () => Promise<unknown>;
  editReply: (payload: unknown) => Promise<MessageLike>;
  reply: (payload: unknown) => Promise<unknown>;
};

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("crime")
      .setDescription("Attempt to steal money from another user");
  },

  localization_strings: {
    command: {
      name: {
        en: "crime",
        ru: "преступление",
        uk: "злочин",
      },
      description: {
        en: "Attempt to steal money from another user",
        ru: "Попытаться украсть деньги у другого пользователя",
        uk: "Спробувати вкрасти гроші у іншого користувача",
      },
    },
    cooldown: {
      en: "You need to wait before committing another crime",
      ru: "Вам нужно подождать прежде чем совершить новое преступление",
      uk: "Вам потрібно зачекати перш ніж вчинити новий злочин",
    },
    selectTarget: {
      en: "Select a user to steal from",
      ru: "Выберите пользователя, у которого хотите украсть",
      uk: "Виберіть користувача, у якого хочете вкрасти",
    },
    noValidTargets: {
      en: "No valid targets found (users must have coins to steal)",
      ru: "Не найдено подходящих целей (у пользователей должны быть монеты)",
      uk: "Не знайдено підходящих цілей (у користувачів повинні бути монети)",
    },
    noSelection: {
      en: "No target selected",
      ru: "Цель не выбрана",
      uk: "Ціль не вибрана",
    },
    title: {
      en: "Crime",
      ru: "Преступление",
      uk: "Злочин",
    },
    successTarget: {
      en: "You successfully stole {{amount}} coins from {{target}}!",
      ru: "Вы успешно украли {{amount}} монет у {{target}}!",
      uk: "Ви успішно вкрали {{amount}} монет у {{target}}!",
    },
    failTarget: {
      en: "You were caught and had to pay a fine of {{amount}} coins!",
      ru: "Вас поймали и вам пришлось заплатить штраф в размере {{amount}} монет!",
      uk: "Вас спіймали і вам довелося заплатити штраф у розмірі {{amount}} монет!",
    },
    error: {
      en: "An error occurred while processing your crime attempt",
      ru: "Произошла ошибка при обработке попытки преступления",
      uk: "Сталася помилка під час обробки спроби злочину",
    },
  },

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<void> {
    const builderMode = "v2";
    await interaction.deferReply();

    const guild = interaction.guild;
    const user = interaction.user;

    try {
      await (hubClient as any).ensureGuildUser(guild.id, user.id);

      let userData = (await (hubClient as any).getUser(guild.id, user.id, true)) as EconomyUserData;

      const cooldownResponse = await (hubClient as any).getCooldown(guild.id, user.id, "crime");
      const cooldownTime = Number(cooldownResponse?.cooldown || 0);

      if (cooldownTime > 0) {
        const timeLeft = Math.ceil(cooldownTime / 1000);

        const generated = (await generateImage(
          "Cooldown",
          {
            interaction: {
              user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatarURL: user.displayAvatarURL({
                  extension: "png",
                  size: 1024,
                }),
              },
              guild: {
                id: guild.id,
                name: guild.name,
                iconURL: guild.iconURL({
                  extension: "png",
                  size: 1024,
                }),
              },
            },
            database: userData,
            locale: interaction.locale,
            nextDaily: timeLeft * 1000,
            emoji: "🦹",
            returnDominant: true,
          },
          { image: 1, emoji: 1 },
          i18n as any
        )) as [Buffer, unknown];

        const pngBuffer = generated?.[0];
        const dominantColor = generated?.[1];

        const attachment = new AttachmentBuilder(pngBuffer, {
          name: "crime_cooldown.webp",
        });

        const cooldownComponent = new ComponentBuilder({
          dominantColor: dominantColor as any,
          mode: builderMode,
        })
          .addText(String(await i18n.__("commands.economy.crime.title")), "header3")
          .addText(String(await i18n.__("commands.economy.crime.cooldown")))
          .addImage("attachment://crime_cooldown.webp");

        await interaction.editReply({
          ...cooldownComponent.toReplyOptions({ files: [attachment] }),
          ephemeral: true,
        });
        return;
      }

      let validTargets = ((await (hubClient as any).getGuildUsers(guild.id)) as EconomyUserData[]).filter(
        (target) => target.id !== user.id && Number(target.economy?.balance || 0) > 1
      );

      if (validTargets.length === 0) {
        await interaction.editReply({
          content: await i18n.__("commands.economy.crime.noValidTargets"),
          ephemeral: true,
        });
        return;
      }

      const targetOptions = await Promise.all(
        validTargets.map(async (userDataItem) => {
          try {
            const member = await guild.members.fetch(userDataItem.id);
            if (!member || member.user.bot) {
              return null;
            }

            return {
              label: member.displayName,
              description: `${Number(userDataItem.economy?.balance || 0).toFixed(0)} coins`,
              value: userDataItem.id,
            };
          } catch (error) {
            console.error(`Failed to fetch member ${userDataItem.id}:`, error);
            return null;
          }
        })
      );

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("select_crime_target")
        .setPlaceholder(String(await i18n.__("commands.economy.crime.selectTarget")))
        .addOptions(targetOptions.filter((option): option is { label: string; description: string; value: string } => option !== null));

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      const selectTargetComponent = new ComponentBuilder({
        mode: builderMode,
      })
        .addText(String(await i18n.__("commands.economy.crime.selectTarget")))
        .addActionRow(row);

      const response = await interaction.editReply(selectTargetComponent.toReplyOptions());

      try {
        const collection = await response.awaitMessageComponent({
          filter: (componentInteraction: any) => componentInteraction.user.id === user.id,
          time: 30000,
          componentType: ComponentType.StringSelect,
        });

        const targetId = collection.values[0] as string | undefined;
        if (!targetId) {
          throw new Error("Missing target selection");
        }

        const target = await guild.members.fetch(targetId);
        const [freshUserData, targetData] = (await Promise.all([
          (hubClient as any).getUser(guild.id, user.id, true),
          (hubClient as any).getUser(guild.id, targetId, true),
        ])) as [EconomyUserData, EconomyUserData];

        const crimeUpgrade = freshUserData.upgrades?.find((upgrade) => upgrade.type === "crime");
        const crimeLevel = crimeUpgrade?.level || 1;
        const successChance = Math.min(0.55, 0.3 + (crimeLevel - 1) * 0.04);
        const success = Math.random() < successChance;

        const targetShieldUpgrade = targetData.upgrades?.find(
          (upgrade) => upgrade.type === "wallet_shield"
        );
        const targetShieldLevel = targetShieldUpgrade?.level || 1;
        const targetShieldReduction = Math.min(
          0.35,
          (targetShieldLevel - 1) * (UPGRADES.wallet_shield.effectMultiplier || 0)
        );

        const baseMaxStealPercent = Math.min(0.15, 0.08 + (crimeLevel - 1) * 0.01);
        const maxStealPercent = Math.max(0.02, baseMaxStealPercent * (1 - targetShieldReduction));

        const fraudProtectionUpgrade = freshUserData.upgrades?.find(
          (upgrade) => upgrade.type === "fraud_protection"
        );
        const fraudProtectionLevel = fraudProtectionUpgrade?.level || 1;
        const fraudReduction = Math.min(
          0.3,
          (fraudProtectionLevel - 1) * (UPGRADES.fraud_protection.effectMultiplier || 0)
        );

        let amount = 0;
        if (success) {
          const targetBalance = Number(targetData.economy?.balance || 0);
          const minStealAmount = Math.floor(targetBalance * 0.01);
          const maxStealAmount = Math.floor(targetBalance * maxStealPercent);
          const rolledAmount = Math.floor(
            minStealAmount + Math.random() * Math.max(1, maxStealAmount - minStealAmount + 1)
          );
          amount = Math.min(targetBalance, Math.max(1, rolledAmount));
        } else {
          const robberBalance = Number(freshUserData.economy?.balance || 0);
          const minFine = Math.floor(robberBalance * (0.02 * (1 - fraudReduction)));
          const maxFine = Math.floor(robberBalance * (0.06 * (1 - fraudReduction)));
          const rolledFine = Math.floor(minFine + Math.random() * Math.max(1, maxFine - minFine + 1));
          amount = Math.min(robberBalance, Math.max(1, rolledFine));
        }

        if (amount > 0) {
          if (success) {
            await (hubClient as any).addBalance(guild.id, targetId, -amount);
            await (hubClient as any).addBalance(guild.id, user.id, amount);
          } else {
            await (hubClient as any).addBalance(guild.id, user.id, -amount);
            await (hubClient as any).addBalance(guild.id, targetId, amount);
          }
        }

        await (hubClient as any).setCooldown(guild.id, user.id, "crime", ms("2h"));

        const [updatedUserData, updatedTargetData] =
          amount > 0
            ? ((await Promise.all([
                (hubClient as any).getUser(guild.id, user.id, true),
                (hubClient as any).getUser(guild.id, targetId, true),
              ])) as [EconomyUserData, EconomyUserData])
            : [freshUserData, targetData];

        const generated = (await generateImage(
          "Crime",
          {
            interaction: {
              user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatarURL: user.displayAvatarURL({
                  extension: "png",
                  size: 1024,
                }),
              },
              guild: {
                id: guild.id,
                name: guild.name,
                iconURL: guild.iconURL({ extension: "png", size: 1024 }),
              },
            },
            locale: interaction.locale,
            victim: {
              user: {
                id: target.id,
                username: target.user.username,
                displayName: target.displayName,
                avatarURL: target.displayAvatarURL({
                  extension: "png",
                  size: 1024,
                }),
              },
              balance: Number(updatedTargetData.economy?.balance || 0),
            },
            robber: {
              user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatarURL: user.displayAvatarURL({
                  extension: "png",
                  size: 1024,
                }),
              },
              balance: Number(updatedUserData.economy?.balance || 0),
            },
            returnDominant: true,
            amount,
            success,
          },
          { image: 2, emoji: 1 },
          i18n as any
        )) as [Buffer, unknown];

        const pngBuffer = generated?.[0];
        const dominantColor = generated?.[1];

        const attachment = new AttachmentBuilder(pngBuffer, {
          name: "crime_result.webp",
        });

        const resultComponent = new ComponentBuilder({
          dominantColor: dominantColor as any,
          mode: builderMode,
        })
          .addText(String(await i18n.__("commands.economy.crime.title")), "header3")
          .addText(
            success
              ? String(
                  await i18n.__("commands.economy.crime.successTarget", {
                    amount,
                    target: target.displayName,
                  })
                )
              : String(await i18n.__("commands.economy.crime.failTarget", { amount }))
          )
          .addImage("attachment://crime_result.webp");

        const resultOptions = resultComponent.toReplyOptions({
          files: [attachment],
        });
        await collection.update(resultOptions);
      } catch (error) {
        console.error("Error during crime target selection:", error);
        const errorOptions = {
          content: await i18n.__("commands.economy.crime.noSelection"),
          components: [],
          files: [],
        };
        await interaction.editReply(errorOptions).catch(() => {});
      }
    } catch (error) {
      console.error("Error in crime command:", error);
      const errorOptions = {
        content: await i18n.__("commands.economy.crime.error"),
        ephemeral: true,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(errorOptions).catch(() => {});
      } else {
        await interaction.reply(errorOptions).catch(() => {});
      }
    }
  },
};

export default command;
