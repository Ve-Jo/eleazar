import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandSubcommandBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import hubClient, { UPGRADES } from "../../api/hubClient.ts";
import { generateImage } from "../../utils/imageGenerator.ts";
import { ComponentBuilder } from "../../utils/componentConverter.ts";

type TranslatorLike = {
  __: (key: string, vars?: Record<string, unknown>) => Promise<string | unknown>;
  getUserLocale?: () => string;
};

type UserLike = {
  id: string;
  username: string;
  displayName: string;
  displayAvatarURL: (options?: Record<string, unknown>) => string;
};

type GuildLike = {
  id: string;
  name: string;
  iconURL: (options?: Record<string, unknown>) => string | null;
};

type UserUpgradeEntry = {
  type: string;
  level?: number;
};

type UserDataLike = {
  economy?: { balance?: number };
  bank?: { balance?: number; rate?: number };
  stats?: { totalEarned?: number };
  upgrades?: UserUpgradeEntry[] | Record<string, { level?: number }>;
};

type UpgradeConfig = {
  basePrice: number;
  priceMultiplier: number;
  effectMultiplier?: number;
  effectValue?: number;
  emoji?: string;
  category?: string;
};

type UpgradeInfoEntry = {
  price: number;
  effect: number;
  originalPrice?: number;
  discountPercent?: number;
};

type MessageLike = {
  editable?: boolean;
  edit: (payload: unknown) => Promise<unknown>;
  createMessageComponentCollector: (options: Record<string, unknown>) => {
    on: (event: string, handler: (...args: any[]) => void | Promise<void>) => void;
  };
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

const upgradesConfig = UPGRADES as Record<string, UpgradeConfig>;

function getUpgradeLevel(userData: UserDataLike, key: string): number {
  if (Array.isArray(userData.upgrades)) {
    return userData.upgrades.find((upgrade) => upgrade.type === key)?.level || 1;
  }

  return userData.upgrades?.[key]?.level || 1;
}

function getUpgradeConfig(key: string): UpgradeConfig {
  const config = upgradesConfig[key];
  return {
    basePrice: config?.basePrice || 0,
    priceMultiplier: config?.priceMultiplier || 1,
    effectMultiplier: config?.effectMultiplier || 0,
    effectValue: config?.effectValue || 0,
    emoji: config?.emoji,
    category: config?.category,
  };
}

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("shop")
      .setDescription("View and purchase upgrades");
  },

  localization_strings: {
    command: {
      name: {
        en: "shop",
        ru: "магазин",
        uk: "магазин",
      },
      description: {
        en: "View and purchase upgrades",
        ru: "Просмотреть и купить улучшения",
        uk: "Переглянути та купити покращення",
      },
    },
    title: {
      en: "Shop",
      ru: "Магазин",
      uk: "Магазин",
    },
    selectUpgrade: {
      en: "Select an upgrade to view",
      ru: "Выберите улучшение для просмотра",
      uk: "Виберіть покращення для перегляду",
    },
    purchaseButton: {
      en: "Purchase",
      ru: "Купить",
      uk: "Купити",
    },
    insufficientFunds: {
      en: "You don't have enough coins for this upgrade",
      ru: "У вас недостаточно монет для этого улучшения",
      uk: "У вас недостатньо монет для цього покращення",
    },
    noSelection: {
      en: "No upgrade selected",
      ru: "Улучшение не выбрано",
      uk: "Покращення не вибрано",
    },
    purchaseTitle: {
      en: "Purchase Successful",
      ru: "Покупка Успешна",
      uk: "Покупка Успішна",
    },
    purchaseSuccess: {
      en: "Successfully upgraded {{type}} to level {{level}} for {{cost}} coins",
      ru: "Успешно улучшено {{type}} до уровня {{level}} за {{cost}} монет",
      uk: "Успішно покращено {{type}} до рівня {{level}} за {{cost}} монет",
    },
    error: {
      en: "An error occurred while processing your shop request",
      ru: "Произошла ошибка при обработке запроса магазина",
      uk: "Сталася помилка під час обробки запиту магазину",
    },
    category_economy: {
      en: "Economy Upgrades",
      ru: "Улучшения Экономики",
      uk: "Покращення Економіки",
    },
    category_cooldowns: {
      en: "Cooldown Upgrades",
      ru: "Улучшения Перезарядки",
      uk: "Покращення Перезарядки",
    },
    revertButton: {
      en: "Revert",
      ru: "Отменить",
      uk: "Відмінити",
    },
    revertButtonWithRefund: {
      en: "Revert (-1 lvl, +{{refund}} coins)",
      ru: "Отменить (-1 ур., +{{refund}} монет)",
      uk: "Відмінити (-1 рів., +{{refund}} монет)",
    },
    revertSuccess: {
      en: "Successfully reverted {{type}} to level {{level}} and received {{refund}} coins (85% refund)",
      ru: "Успешно отменено улучшение {{type}} до уровня {{level}} и получено {{refund}} монет (85% возврат)",
      uk: "Успішно відмінено покращення {{type}} до рівня {{level}} і отримано {{refund}} монет (85% повернення)",
    },
    revertCooldown: {
      en: "Cooldown active. You can revert another upgrade in {{minutes}} minutes",
      ru: "Перезарядка активна. Вы можете отменить другое улучшение через {{minutes}} минут",
      uk: "Перезарядка активна. Ви можете відмінити інше покращення через {{minutes}} хвилин",
    },
    cannotRevert: {
      en: "Cannot revert a level 1 upgrade",
      ru: "Невозможно отменить улучшение уровня 1",
      uk: "Неможливо відмінити покращення рівня 1",
    },
    description: {
      en: "View and purchase upgrades",
      ru: "Просмотреть и купить улучшения",
      uk: "Переглянути та купити покращення",
    },
    upgrades: {
      daily_bonus: {
        name: { en: "Daily Bonus", ru: "Ежедн. Бонус", uk: "Щоденний Бонус" },
        description: {
          en: "Increase your daily bonus multiplier by {{effect}}% (+{{increasePerLevel}}%)",
          ru: "Увеличивает ежедневный бонус на {{effect}}% (+{{increasePerLevel}}%)",
          uk: "Збільшує щоденний бонус на {{effect}}% (+{{increasePerLevel}}%)",
        },
      },
      daily_cooldown: {
        name: { en: "Daily Cooldown", ru: "Перезарядка Ежедн.", uk: "Перезарядка Щоденного" },
        description: {
          en: "Reduce daily cooldown by {{effect}} minutes (-{{increasePerLevelMinutes}}m)",
          ru: "Уменьшает перезарядку ежедневного бонуса на {{effect}} минут (-{{increasePerLevelMinutes}}м)",
          uk: "Зменшує перезарядку щоденного бонусу на {{effect}} хвилин (-{{increasePerLevelMinutes}}хв)",
        },
      },
      crime: {
        name: { en: "Crime Cooldown", ru: "Преступления", uk: "Крадіжка" },
        description: {
          en: "Reduce crime cooldown by {{effect}} minutes (-{{increasePerLevelMinutes}}m)",
          ru: "Уменьшает перезарядку преступления на {{effect}} минут (-{{increasePerLevelMinutes}}м)",
          uk: "Зменшує перезарядку злочину на {{effect}} хвилин (-{{increasePerLevelMinutes}}хв)",
        },
      },
      bank_rate: {
        name: { en: "Bank Interest", ru: "Банк. Процент", uk: "Банк. Відсоток" },
        description: {
          en: "Increase bank interest rate by {{effect}}% (+{{increasePerLevel}}%)",
          ru: "Увеличивает процентную ставку банка на {{effect}}% (+{{increasePerLevel}}%)",
          uk: "Збільшує відсоткову ставку банку на {{effect}}% (+{{increasePerLevel}}%)",
        },
      },
      games_earning: {
        name: { en: "Games Earnings", ru: "Доход от Игр", uk: "Дохід від Ігор" },
        description: {
          en: "Increase earnings from games by {{effect}}% (+{{increasePerLevel}}%)",
          ru: "Увеличивает доход от игр на {{effect}}% (+{{increasePerLevel}}%)",
          uk: "Збільшує дохід від ігор на {{effect}}% (+{{increasePerLevel}}%)",
        },
      },
    },
  },

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<void> {
    await interaction.deferReply();
    const guild = interaction.guild;
    const user = interaction.user;

    try {
      let currentUpgrade = 0;
      let upgradeInfo: Record<string, UpgradeInfoEntry> = {};
      const builderMode = "v2" as const;
      const userLocale = i18n.getUserLocale?.() || (interaction.locale.split("-")[0] || "en").toLowerCase();

      const getUpgradeTranslation = (path: string, defaultValue: string): string => {
        const pathParts = path.split(".");
        let result: any = command.localization_strings;
        for (const part of pathParts) {
          if (!result?.[part]) {
            return defaultValue;
          }
          result = result[part];
        }
        return result?.[userLocale] || result?.en || defaultValue;
      };

      const generateShopMessage = async (
        options: { disableInteractions?: boolean } = {}
      ): Promise<Record<string, unknown>> => {
        const { disableInteractions = false } = options;

        await (hubClient as any).ensureGuildUser(guild.id, user.id);
        const userData = (await (hubClient as any).getUser(guild.id, user.id)) as UserDataLike;
        const upgradeDiscount = 0;
        const dailyBonusConfig = getUpgradeConfig("daily_bonus");
        const dailyCooldownConfig = getUpgradeConfig("daily_cooldown");
        const crimeConfig = getUpgradeConfig("crime");
        const bankRateConfig = getUpgradeConfig("bank_rate");
        const gamesEarningConfig = getUpgradeConfig("games_earning");

        upgradeInfo = {
          daily_bonus: {
            price: Math.floor(
              dailyBonusConfig.basePrice *
                Math.pow(dailyBonusConfig.priceMultiplier, getUpgradeLevel(userData, "daily_bonus") - 1)
            ),
            effect: (dailyBonusConfig.effectMultiplier || 0) * getUpgradeLevel(userData, "daily_bonus"),
          },
          daily_cooldown: {
            price: Math.floor(
              dailyCooldownConfig.basePrice *
                Math.pow(dailyCooldownConfig.priceMultiplier, getUpgradeLevel(userData, "daily_cooldown") - 1)
            ),
            effect: (dailyCooldownConfig.effectValue || 0) * getUpgradeLevel(userData, "daily_cooldown"),
          },
          crime: {
            price: Math.floor(
              crimeConfig.basePrice *
                Math.pow(crimeConfig.priceMultiplier, getUpgradeLevel(userData, "crime") - 1)
            ),
            effect: (crimeConfig.effectValue || 0) * getUpgradeLevel(userData, "crime"),
          },
          bank_rate: {
            price: Math.floor(
              bankRateConfig.basePrice *
                Math.pow(bankRateConfig.priceMultiplier, getUpgradeLevel(userData, "bank_rate") - 1)
            ),
            effect: (bankRateConfig.effectValue || 0) * getUpgradeLevel(userData, "bank_rate"),
          },
          games_earning: {
            price: Math.floor(
              gamesEarningConfig.basePrice *
                Math.pow(gamesEarningConfig.priceMultiplier, getUpgradeLevel(userData, "games_earning") - 1)
            ),
            effect: (gamesEarningConfig.effectMultiplier || 0) * getUpgradeLevel(userData, "games_earning"),
          },
        };

        if (upgradeDiscount > 0) {
          Object.keys(upgradeInfo).forEach((key) => {
            const entry = upgradeInfo[key];
            if (!entry) {
              return;
            }
            const discountAmount = (entry.price * upgradeDiscount) / 100;
            entry.originalPrice = entry.price;
            entry.price = Math.max(1, Math.floor(entry.price - discountAmount));
            entry.discountPercent = Math.round(upgradeDiscount);
          });
        }

        const generated = (await generateImage(
          "UpgradesDisplay",
          {
            interaction: {
              user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatarURL: user.displayAvatarURL({ extension: "png", size: 1024 }),
              },
              guild: {
                id: guild.id,
                name: guild.name,
                iconURL: guild.iconURL({ extension: "png", size: 1024 }),
              },
            },
            database: {
              balance: Math.round(Number(userData.economy?.balance || 0)),
              bankBalance: Math.round(Number((userData as any).bank?.balance || 0)),
              bankRate: (userData as any).bank?.rate || 0,
              totalEarned: Math.round(Number(userData.stats?.totalEarned || 0)),
              upgradeDiscount,
            },
            locale: interaction.locale,
            upgrades: Object.entries(upgradeInfo).map(([key, upgrade], index) => {
              const config = getUpgradeConfig(key);
              const currentLevel = getUpgradeLevel(userData, key);
              let effectPerLevel = 0;
              let effectUnit = "%";
              let effectValue = 0;

              if (key === "daily_bonus") {
                effectPerLevel = Math.round((config.effectMultiplier || 0) * 100);
                effectUnit = "%";
                effectValue = upgrade.effect * 100;
              } else if (key === "daily_cooldown" || key === "crime") {
                effectPerLevel = Math.floor((config.effectValue || 0) / (60 * 1000));
                effectUnit = "m";
                effectValue = Math.floor(upgrade.effect / (60 * 1000));
              } else if (key === "bank_rate") {
                effectPerLevel = Math.round((config.effectValue || 0) * 100);
                effectUnit = "%";
                effectValue = upgrade.effect * 100;
              } else if (key === "games_earning") {
                effectPerLevel = Math.round((config.effectMultiplier || 0) * 100);
                effectUnit = "%";
                effectValue = upgrade.effect * 100;
              }

              const userBalance = Math.round(Number(userData.economy?.balance || 0));
              const progressPercentage = Math.min(Math.round((userBalance / upgrade.price) * 100), 100);
              const upgradeName = getUpgradeTranslation(`upgrades.${key}.name`, key);
              const upgradeDescription = getUpgradeTranslation(`upgrades.${key}.description`, "");
              const formattedDescription = upgradeDescription
                .replace(/\{\{effect\}\}/g, String(Math.round(effectValue)))
                .replace(/\{\{increasePerLevel\}\}/g, String(Math.round(effectPerLevel)))
                .replace(/\{\{increasePerLevelMinutes\}\}/g, String(Math.round(effectPerLevel)))
                .replace(/\{\{price\}\}/g, String(Math.round(upgrade.price)));

              const upgradeObj: Record<string, unknown> = {
                emoji: config.emoji,
                title: upgradeName,
                description: formattedDescription,
                currentLevel,
                nextLevel: currentLevel + 1,
                price: Math.round(upgrade.price),
                progress: progressPercentage,
                id: index,
                category: config.category,
                effectPerLevel,
                effectUnit,
              };

              if (upgrade.discountPercent) {
                upgradeObj.originalPrice = upgrade.originalPrice;
                upgradeObj.discountPercent = upgrade.discountPercent;
              }

              return upgradeObj;
            }),
            currentUpgrade,
            balance: Math.round(Number(userData.economy?.balance || 0)),
            dominantColor: "user",
            returnDominant: true,
          },
          { image: 2, emoji: 2 },
          i18n as any
        )) as [Buffer, unknown];

        const pngBuffer = generated?.[0];
        const dominantColor = generated?.[1];
        const attachment = new AttachmentBuilder(pngBuffer, { name: "shop_upgrades.avif" });

        const shopComponent = new ComponentBuilder({
          dominantColor: dominantColor as any,
          mode: builderMode,
        })
          .addText(String(await i18n.__("commands.economy.shop.title")), "header3")
          .addText(
            String(
              await i18n.__("commands.economy.shop.description", {
                balance: Math.round(Number(userData.economy?.balance || 0)),
              })
            )
          )
          .addImage("attachment://shop_upgrades.avif");

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("switch_upgrade")
          .setPlaceholder(String(await i18n.__("commands.economy.shop.selectUpgrade")))
          .addOptions(
            Object.entries(upgradeInfo).map(([key, upgrade], index) => {
              const config = getUpgradeConfig(key);
              let effectPerLevel = 0;
              let effectValue = 0;
              if (key === "daily_bonus") {
                effectPerLevel = Math.round((config.effectMultiplier || 0) * 100);
                effectValue = upgrade.effect * 100;
              } else if (key === "daily_cooldown" || key === "crime") {
                effectPerLevel = Math.floor((config.effectValue || 0) / (60 * 1000));
                effectValue = Math.floor(upgrade.effect / (60 * 1000));
              } else if (key === "bank_rate") {
                effectPerLevel = Math.round((config.effectValue || 0) * 100);
                effectValue = upgrade.effect * 100;
              } else if (key === "games_earning") {
                effectPerLevel = Math.round((config.effectMultiplier || 0) * 100);
                effectValue = upgrade.effect * 100;
              }

              const upgradeName = getUpgradeTranslation(`upgrades.${key}.name`, key);
              const upgradeDescription = getUpgradeTranslation(`upgrades.${key}.description`, "");
              const formattedDescription = upgradeDescription
                .replace(/\{\{effect\}\}/g, String(Math.round(effectValue)))
                .replace(/\{\{increasePerLevel\}\}/g, String(Math.round(effectPerLevel)))
                .replace(/\{\{increasePerLevelMinutes\}\}/g, String(Math.round(effectPerLevel)))
                .replace(/\{\{price\}\}/g, String(Math.round(upgrade.price)));

              const option: Record<string, unknown> = {
                label: upgradeName,
                description: formattedDescription,
                value: index.toString(),
                emoji: config.emoji,
                default: currentUpgrade === index,
              };

              if (upgrade.discountPercent) {
                option.label = `${option.label} (${upgrade.discountPercent}% off)`;
              }

              return option as {
                label: string;
                description: string;
                value: string;
                emoji?: string;
                default?: boolean;
              };
            })
          );

        const openButton = new ButtonBuilder()
          .setCustomId("purchase")
          .setLabel(String(await i18n.__("commands.economy.shop.purchaseButton")))
          .setStyle(ButtonStyle.Success);

        const revertButton = new ButtonBuilder().setCustomId("revert").setStyle(ButtonStyle.Danger);
        const currentUpgradeType = Object.keys(upgradeInfo)[currentUpgrade];
        const currentLevel = currentUpgradeType ? getUpgradeLevel(userData, currentUpgradeType) : 1;

        if (currentLevel <= 1 || !currentUpgradeType) {
          revertButton
            .setLabel(String(await i18n.__("commands.economy.shop.revertButton")))
            .setDisabled(true);
        } else {
          const currentConfig = getUpgradeConfig(currentUpgradeType);
          const currentUpgradeInfo = {
            price: Math.floor(
              currentConfig.basePrice *
                Math.pow(currentConfig.priceMultiplier, currentLevel - 1)
            ),
          };
          const refundAmount = Math.floor(currentUpgradeInfo.price * 0.85);
          revertButton
            .setLabel(
              String(
                (await i18n.__("commands.economy.shop.revertButtonWithRefund", {
                  refund: refundAmount || 0,
                })) || (await i18n.__("commands.economy.shop.revertButton"))
              )
            )
            .setDisabled(false);
        }

        const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
        const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(openButton, revertButton);

        if (!disableInteractions) {
          shopComponent.addActionRow(selectRow);
          shopComponent.addActionRow(buttonRow);
        }

        return shopComponent.toReplyOptions({ files: [attachment] }) as Record<string, unknown>;
      };

      const initialMessageOptions = await generateShopMessage();
      const message = await interaction.editReply(initialMessageOptions);

      const collector = message.createMessageComponentCollector({
        filter: (componentInteraction: any) => componentInteraction.user.id === user.id,
        time: 60000,
      });

      collector.on("collect", async (componentInteraction: any) => {
        if (componentInteraction.customId === "switch_upgrade") {
          currentUpgrade = parseInt(componentInteraction.values[0] || "0", 10);
          await componentInteraction.update(await generateShopMessage());
          return;
        }

        if (componentInteraction.customId === "purchase") {
          const upgradeTypes = Object.keys(upgradeInfo);
          const type = upgradeTypes[currentUpgrade];

          try {
            await (hubClient as any).purchaseUpgrade(guild.id, user.id, type);
            await componentInteraction.update(await generateShopMessage());
          } catch (error: any) {
            if (error?.message === "Insufficient balance") {
              await componentInteraction.reply({
                content: await i18n.__("commands.economy.shop.insufficientFunds"),
                ephemeral: true,
              });
            } else {
              throw error;
            }
          }
          return;
        }

        if (componentInteraction.customId === "revert") {
          const upgradeTypes = Object.keys(upgradeInfo);
          const type = upgradeTypes[currentUpgrade];

          try {
            throw new Error("Revert upgrade not yet implemented in hub services");
          } catch (error: any) {
            if (error?.message?.startsWith("Cooldown active:")) {
              const cooldownTime = parseInt(String(error.message).split(":")[1]?.trim() || "0", 10);
              const minutesLeft = Math.ceil(cooldownTime / (1000 * 60));
              await componentInteraction.reply({
                content: await i18n.__("commands.economy.shop.revertCooldown", {
                  minutes: minutesLeft,
                }),
                ephemeral: true,
              });
            } else if (error?.message === "Cannot revert a level 1 upgrade") {
              await componentInteraction.reply({
                content: await i18n.__("commands.economy.shop.cannotRevert"),
                ephemeral: true,
              });
            } else if (error?.message === "Revert upgrade not yet implemented in hub services") {
              await componentInteraction.reply({
                content: await i18n.__("commands.economy.shop.error"),
                ephemeral: true,
              });
            } else {
              throw error;
            }
          }
        }
      });

      collector.on("end", async () => {
        if (message.editable) {
          try {
            const finalMessage = await generateShopMessage({ disableInteractions: true });
            await message.edit(finalMessage);
          } catch (error) {
            console.error("Error updating components on end:", error);
            await message.edit({ components: [] }).catch(() => {});
          }
        }
      });
    } catch (error) {
      console.error("Error in shop command:", error);
      const errorOptions = {
        content: await i18n.__("commands.economy.shop.error"),
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
