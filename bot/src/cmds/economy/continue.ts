import { SlashCommandSubcommandBuilder } from "discord.js";
import hubClient from "../../api/hubClient.ts";
import type { TranslatorLike, InteractionLike } from "../../types/index.ts";

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("continue")
      .setDescription("Continue bank interest accumulation after cycle completes");
  },

  localization_strings: {
    command: {
      name: {
        ru: "продолжить",
        uk: "продовжити",
      },
      description: {
        ru: "Продолжить накопление процентов в банке после завершения цикла",
        uk: "Продовжити накопичення відсотків у банку після завершення циклу",
      },
    },
    title: {
      en: "Bank Continue",
      ru: "Продолжение Банка",
      uk: "Продовження Банку",
    },
    noBankBalance: {
      en: "You don't have any money in your bank account",
      ru: "На вашем банковском счету нет денег",
      uk: "На вашому банківському рахунку немає грошей",
    },
    continueSuccess: {
      en: "✅ Bank interest cycle restarted! You earned **{{interest}}** coins from {{cycles}} completed cycle(s). Your bank is now accumulating interest again.",
      ru: "✅ Цикл начисления процентов перезапущен! Вы заработали **{{interest}}** монет за {{cycles}} завершенных циклов. Ваш банк снова накапливает проценты.",
      uk: "✅ Цикл нарахування відсотків перезапущений! Ви заробили **{{interest}}** монет за {{cycles}} завершених циклів. Ваш банк знову накопичує відсотки.",
    },
    continueNoCycle: {
      en: "✅ Bank timer reset. No cycles were completed yet, so no interest was added. Your bank is now accumulating interest.",
      ru: "✅ Таймер банка сброшен. Циклы еще не завершены, поэтому проценты не добавлены. Ваш банк снова накапливает проценты.",
      uk: "✅ Таймер банку скинутий. Цикли ще не завершені, тому відсотки не додані. Ваш банк знову накопичує відсотки.",
    },
    partnerContinueDM: {
      en: "🏦 Your partner {{user}} continued the bank interest cycle in {{guild}}. Earned: **{{interest}}** coins.",
      ru: "🏦 Ваш партнер {{user}} продолжил цикл начисления процентов на сервере {{guild}}. Заработано: **{{interest}}** монет.",
      uk: "🏦 Ваш партнер {{user}} продовжив цикл нарахування відсотків на сервері {{guild}}. Зароблено: **{{interest}}** монет.",
    },
    error: {
      en: "An error occurred while continuing your bank interest",
      ru: "Произошла ошибка при продолжении начисления процентов",
      uk: "Сталася помилка при продовженні нарахування відсотків",
    },
  },

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<void> {
    await interaction.deferReply();

    const guildId = interaction.guild?.id;
    const userId = interaction.user?.id;

    try {
      await (hubClient as any).ensureGuildUser(guildId, userId);

      const userData = await (hubClient as any).getUser(guildId, userId, true);
      if (!userData?.economy?.bankBalance || Number(userData.economy.bankBalance) <= 0) {
        await interaction.editReply({
          content: String(await i18n.__("commands.economy.continue.noBankBalance")),
        });
        return;
      }

      // Check for marriage - continue both partners' banks
      const marriageStatus = await (hubClient as any).getMarriageStatus(guildId, userId);
      let partnerResult = null;

      if (marriageStatus && marriageStatus.status === "MARRIED") {
        // Continue partner's bank as well
        const partnerContinue = await (hubClient as any).continueBankBalance(
          guildId,
          marriageStatus.partnerId
        );
        partnerResult = partnerContinue;
      }

      // Continue user's bank
      const result = await (hubClient as any).continueBankBalance(guildId, userId);

      if (!result.success) {
        await interaction.editReply({
          content: String(await i18n.__("commands.economy.continue.noBankBalance")),
        });
        return;
      }

      const interestAdded = Number(result.interestAdded) || 0;
      const cyclesCompleted = result.newCycle || 0;

      let message: string;
      if (interestAdded > 0) {
        message = String(
          await i18n.__("commands.economy.continue.continueSuccess", {
            interest: interestAdded.toFixed(2),
            cycles: cyclesCompleted,
          })
        );
      } else {
        message = String(await i18n.__("commands.economy.continue.continueNoCycle"));
      }

      await interaction.editReply({ content: message });

      // DM partner if they also got interest
      if (partnerResult && Number(partnerResult.interestAdded) > 0) {
        try {
          const partnerDiscordUser = await interaction.client?.users.fetch(
            marriageStatus.partnerId
          );
          if (partnerDiscordUser && 'send' in partnerDiscordUser && typeof partnerDiscordUser.send === 'function') {
            await partnerDiscordUser.send({
              content: String(
                await i18n.__("commands.economy.continue.partnerContinueDM", {
                  user: interaction.user.username,
                  interest: Number(partnerResult.interestAdded).toFixed(2),
                  guild: interaction.guild.name,
                })
              ),
            });
          }
        } catch (dmError) {
          console.error("Failed to send continue DM to partner:", dmError);
        }
      }
    } catch (error) {
      console.error("Error in continue command:", error);
      const errorOptions = {
        content: String(await i18n.__("commands.economy.continue.error")),
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
