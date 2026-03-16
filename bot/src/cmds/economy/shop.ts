import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandSubcommandBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import hubClient from "../../api/hubClient.ts";
import { UPGRADES } from "../../../../hub/shared/src/domain.ts";
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
  economy?: { balance?: number; upgradeDiscount?: number };
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
  key: string;
  name: string;
  description: string;
  impactArea: string;
  category: string;
  emoji?: string;
  currentLevel: number;
  nextLevel: number;
  effectPerLevel: number;
  effectUnit: "%" | "m";
  currentEffect: number;
  nextEffect: number;
  deltaEffect: number;
  basePrice: number;
  price: number;
  isAffordable: boolean;
  coinsNeeded: number;
  progress: number;
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

const normalizeLocale = (locale: unknown, fallback = "en"): string => {
  if (typeof locale !== "string") {
    return fallback;
  }

  return (locale.split("-")[0] || fallback).toLowerCase();
};

const upgradesConfig = UPGRADES as Record<string, UpgradeConfig>;
const MINUTE_MS = 60 * 1000;

function formatEffectNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

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

function calculateUpgradePrice(config: UpgradeConfig, currentLevel: number): number {
  return Math.max(
    1,
    Math.floor(config.basePrice * Math.pow(config.priceMultiplier, Math.max(0, currentLevel - 1)))
  );
}

function getUpgradeEffectDetails(
  key: string,
  config: UpgradeConfig,
  currentLevel: number
): Pick<UpgradeInfoEntry, "effectPerLevel" | "effectUnit" | "currentEffect" | "nextEffect" | "deltaEffect"> {
  const nextLevel = currentLevel + 1;
  const minuteKeys = new Set(["daily_cooldown", "crime", "cooldown_mastery"]);
  const usesMinutes = minuteKeys.has(key);
  const effectUnit: "%" | "m" = usesMinutes ? "m" : "%";
  const baseEffect = usesMinutes
    ? Number(config.effectValue || 0) / MINUTE_MS
    : Number((config.effectMultiplier ?? config.effectValue ?? 0) * 100);
  const effectPerLevel = Math.max(0, usesMinutes ? Math.floor(baseEffect) : Math.round(baseEffect));
  const currentEffect = effectPerLevel * currentLevel;
  const nextEffect = effectPerLevel * nextLevel;
  const deltaEffect = Math.max(0, nextEffect - currentEffect);

  return { effectPerLevel, effectUnit, currentEffect, nextEffect, deltaEffect };
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
    selectedLine: {
      en: "Selected: {{emoji}} {{name}} (L{{current}} → L{{next}})",
      ru: "Выбрано: {{emoji}} {{name}} (Ур.{{current}} → Ур.{{next}})",
      uk: "Вибрано: {{emoji}} {{name}} (Рів.{{current}} → Рів.{{next}})",
    },
    noSelectedLine: {
      en: "Selected: -",
      ru: "Выбрано: -",
      uk: "Вибрано: -",
    },
    statsLine: {
      en: "Now: {{now}} | Next: {{next}} | Gain: {{gain}}",
      ru: "Сейчас: {{now}} | След.: {{next}} | Прирост: {{gain}}",
      uk: "Зараз: {{now}} | Далі: {{next}} | Приріст: {{gain}}",
    },
    panelHintLine: {
      en: "Full upgrade details are shown in the image panel.",
      ru: "Полные детали улучшения показаны на изображении ниже.",
      uk: "Повні деталі покращення показані на зображенні нижче.",
    },
    affordable: {
      en: "Affordable",
      ru: "Доступно",
      uk: "Доступно",
    },
    needMore: {
      en: "Need {{coins}} more",
      ru: "Нужно ещё {{coins}}",
      uk: "Потрібно ще {{coins}}",
    },
    costLine: {
      en: "Cost: {{price}} | {{status}} | Affects: {{impact}}",
      ru: "Цена: {{price}} | {{status}} | Влияет: {{impact}}",
      uk: "Ціна: {{price}} | {{status}} | Впливає: {{impact}}",
    },
    noCostLine: {
      en: "Cost: -",
      ru: "Цена: -",
      uk: "Ціна: -",
    },
    discountedPrice: {
      en: "{{price}} (from {{original}}, -{{discount}}%)",
      ru: "{{price}} (с {{original}}, -{{discount}}%)",
      uk: "{{price}} (з {{original}}, -{{discount}}%)",
    },
    menuStatsLine: {
      en: "Now {{now}} • Next {{next}} • +{{gain}}",
      ru: "Сейчас {{now}} • След. {{next}} • +{{gain}}",
      uk: "Зараз {{now}} • Далі {{next}} • +{{gain}}",
    },
    menuImpactCostLine: {
      en: "{{impact}} • Cost {{price}}",
      ru: "{{impact}} • Цена {{price}}",
      uk: "{{impact}} • Ціна {{price}}",
    },
    impact_daily_rewards: {
      en: "Daily rewards",
      ru: "Ежедневные награды",
      uk: "Щоденні нагороди",
    },
    impact_daily_cooldown: {
      en: "Daily cooldown",
      ru: "Перезарядка daily",
      uk: "Перезарядка daily",
    },
    impact_crime_cooldown: {
      en: "Crime cooldown",
      ru: "Перезарядка crime",
      uk: "Перезарядка crime",
    },
    impact_bank_growth: {
      en: "Bank growth",
      ru: "Рост банка",
      uk: "Зростання банку",
    },
    impact_game_payouts: {
      en: "Game payouts",
      ru: "Выплаты игр",
      uk: "Виплати ігор",
    },
    impact_crime_fines: {
      en: "Crime fines",
      ru: "Штрафы crime",
      uk: "Штрафи crime",
    },
    impact_theft_defense: {
      en: "Theft defense",
      ru: "Защита от кражи",
      uk: "Захист від крадіжки",
    },
    impact_risk_game_losses: {
      en: "Risk game losses",
      ru: "Потери в риск-играх",
      uk: "Втрати в ризик-іграх",
    },
    impact_core_cooldowns: {
      en: "Core cooldowns",
      ru: "Базовые перезарядки",
      uk: "Базові перезарядки",
    },
    impact_bank_operation_fees: {
      en: "Bank operation fees",
      ru: "Банковские комиссии",
      uk: "Банківські комісії",
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
      fraud_protection: {
        name: { en: "Fraud Protection", ru: "Защита от Штрафов", uk: "Захист від Штрафів" },
        description: {
          en: "Reduce failed-crime fines by {{effect}}% (+{{increasePerLevel}}%)",
          ru: "Снижает штрафы за неудачные преступления на {{effect}}% (+{{increasePerLevel}}%)",
          uk: "Знижує штрафи за невдалі злочини на {{effect}}% (+{{increasePerLevel}}%)",
        },
      },
      wallet_shield: {
        name: { en: "Wallet Shield", ru: "Щит Кошелька", uk: "Щит Гаманця" },
        description: {
          en: "Reduce max stolen amount by {{effect}}% (+{{increasePerLevel}}%)",
          ru: "Снижает максимум украденных средств на {{effect}}% (+{{increasePerLevel}}%)",
          uk: "Знижує максимум вкрадених коштів на {{effect}}% (+{{increasePerLevel}}%)",
        },
      },
      vault_insurance: {
        name: { en: "Vault Insurance", ru: "Страховка Хранилища", uk: "Страхування Сховища" },
        description: {
          en: "Recover {{effect}}% on risky losses (+{{increasePerLevel}}%)",
          ru: "Возвращает {{effect}}% при рискованных потерях (+{{increasePerLevel}}%)",
          uk: "Повертає {{effect}}% при ризикованих втратах (+{{increasePerLevel}}%)",
        },
      },
      cooldown_mastery: {
        name: { en: "Cooldown Mastery", ru: "Мастер Перезарядки", uk: "Майстер Перезарядки" },
        description: {
          en: "Reduce cooldowns by {{effect}} minutes (-{{increasePerLevelMinutes}}m)",
          ru: "Снижает перезарядки на {{effect}} минут (-{{increasePerLevelMinutes}}м)",
          uk: "Знижує перезарядки на {{effect}} хвилин (-{{increasePerLevelMinutes}}хв)",
        },
      },
      tax_optimization: {
        name: { en: "Tax Optimization", ru: "Оптимизация Комиссий", uk: "Оптимізація Комісій" },
        description: {
          en: "Reduce operation fees by {{effect}}% (+{{increasePerLevel}}%)",
          ru: "Снижает комиссии операций на {{effect}}% (+{{increasePerLevel}}%)",
          uk: "Знижує комісії операцій на {{effect}}% (+{{increasePerLevel}}%)",
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
      const userLocale = normalizeLocale(
        i18n.getUserLocale?.() ?? interaction.locale,
        "en"
      );

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
        const upgradeDiscount = Math.max(
          0,
          Math.min(30, Math.round(Number(userData.economy?.upgradeDiscount || 0)))
        );
        const userBalance = Math.round(Number(userData.economy?.balance || 0));
        const impactKeys: Record<string, string> = {
          daily_bonus: "daily_rewards",
          daily_cooldown: "daily_cooldown",
          crime: "crime_cooldown",
          bank_rate: "bank_growth",
          games_earning: "game_payouts",
          fraud_protection: "crime_fines",
          wallet_shield: "theft_defense",
          vault_insurance: "risk_game_losses",
          cooldown_mastery: "core_cooldowns",
          tax_optimization: "bank_operation_fees",
        };

        const upgradeEntries = Object.keys(upgradesConfig).map((key) => {
          const config = getUpgradeConfig(key);
          const currentLevel = getUpgradeLevel(userData, key);
          const basePrice = calculateUpgradePrice(config, currentLevel);
          const discountedPrice =
            upgradeDiscount > 0
              ? Math.max(1, Math.floor(basePrice - (basePrice * upgradeDiscount) / 100))
              : basePrice;
          const effectDetails = getUpgradeEffectDetails(key, config, currentLevel);
          const upgradeName = getUpgradeTranslation(`upgrades.${key}.name`, key);
          const upgradeDescription = getUpgradeTranslation(`upgrades.${key}.description`, "");
          const formattedDescription = upgradeDescription
            .replace(/\{\{effect\}\}/g, formatEffectNumber(effectDetails.currentEffect))
            .replace(/\{\{increasePerLevel\}\}/g, formatEffectNumber(effectDetails.effectPerLevel))
            .replace(
              /\{\{increasePerLevelMinutes\}\}/g,
              formatEffectNumber(effectDetails.effectPerLevel)
            )
            .replace(/\{\{price\}\}/g, String(Math.round(discountedPrice)));
          const coinsNeeded = Math.max(0, discountedPrice - userBalance);
          const progress = discountedPrice > 0 ? Math.min(Math.round((userBalance / discountedPrice) * 100), 100) : 100;

          const entry: UpgradeInfoEntry = {
            key,
            name: upgradeName,
            description: formattedDescription,
            impactArea: getUpgradeTranslation(`impact_${impactKeys[key]}`, "Economy"),
            category: config.category || "economy",
            emoji: config.emoji,
            currentLevel,
            nextLevel: currentLevel + 1,
            effectPerLevel: effectDetails.effectPerLevel,
            effectUnit: effectDetails.effectUnit,
            currentEffect: effectDetails.currentEffect,
            nextEffect: effectDetails.nextEffect,
            deltaEffect: effectDetails.deltaEffect,
            basePrice,
            price: discountedPrice,
            isAffordable: coinsNeeded === 0,
            coinsNeeded,
            progress,
          };

          if (upgradeDiscount > 0) {
            entry.originalPrice = basePrice;
            entry.discountPercent = Math.round(upgradeDiscount);
          }

          return entry;
        });

        upgradeInfo = Object.fromEntries(upgradeEntries.map((entry) => [entry.key, entry]));

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
            upgrades: upgradeEntries.map((upgrade, index) => {
              const upgradeObj: Record<string, unknown> = {
                emoji: upgrade.emoji,
                title: upgrade.name,
                description: upgrade.description,
                impactArea: upgrade.impactArea,
                currentLevel: upgrade.currentLevel,
                nextLevel: upgrade.nextLevel,
                currentEffect: upgrade.currentEffect,
                nextEffect: upgrade.nextEffect,
                deltaEffect: upgrade.deltaEffect,
                price: Math.round(upgrade.price),
                basePrice: Math.round(upgrade.basePrice),
                isAffordable: upgrade.isAffordable,
                coinsNeeded: upgrade.coinsNeeded,
                progress: upgrade.progress,
                id: index,
                category: upgrade.category,
                effectPerLevel: upgrade.effectPerLevel,
                effectUnit: upgrade.effectUnit,
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
          { image: 1, emoji: 1 },
          i18n as any
        )) as [Buffer, unknown];

        const pngBuffer = generated?.[0];
        const dominantColor = generated?.[1];
        const attachment = new AttachmentBuilder(pngBuffer, { name: "shop_upgrades.webp" });

        const shopComponent = new ComponentBuilder({
          dominantColor: dominantColor as any,
          mode: builderMode,
        })
          .addText(String(await i18n.__("commands.economy.shop.title")), "header3")
          .addImage("attachment://shop_upgrades.webp");

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("switch_upgrade")
          .setPlaceholder(String(await i18n.__("commands.economy.shop.selectUpgrade")))
          .addOptions(
            upgradeEntries.map((upgrade, index) => {
              const categoryTag = upgrade.category === "cooldowns" ? "CD" : "ECO";
              const description = getUpgradeTranslation("menuImpactCostLine", "{{impact}} • Cost {{price}}")
                .replace(/\{\{impact\}\}/g, upgrade.impactArea)
                .replace(/\{\{price\}\}/g, String(Math.round(upgrade.price)));

              const option: Record<string, unknown> = {
                label: `[${categoryTag}] ${upgrade.name} L${upgrade.currentLevel}→L${upgrade.nextLevel}`,
                description,
                value: index.toString(),
                emoji: upgrade.emoji,
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
        const currentUpgradeEntry = currentUpgradeType ? upgradeInfo[currentUpgradeType] : undefined;
        const currentLevel = currentUpgradeEntry?.currentLevel || 1;

        if (currentLevel <= 1 || !currentUpgradeType) {
          revertButton
            .setLabel(String(await i18n.__("commands.economy.shop.revertButton")))
            .setDisabled(true);
        } else {
          const currentPurchasePrice = currentUpgradeEntry?.basePrice || 0;
          const refundAmount = Math.floor(currentPurchasePrice * 0.85);
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
          if (!type) {
            await componentInteraction.reply({
              content: await i18n.__("commands.economy.shop.error"),
              ephemeral: true,
            });
            return;
          }

          try {
            await hubClient.purchaseUpgrade(guild.id, user.id, type);
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
          if (!type) {
            await componentInteraction.reply({
              content: await i18n.__("commands.economy.shop.noSelection"),
              ephemeral: true,
            });
            return;
          }

          try {
            await hubClient.revertUpgrade(guild.id, user.id, type);
            await componentInteraction.update(await generateShopMessage());
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
            } else {
              throw error;
            }
          }
          return;
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
