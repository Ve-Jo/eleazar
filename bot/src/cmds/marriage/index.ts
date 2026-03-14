import { SlashCommandBuilder } from "discord.js";
import hubClient from "../../api/hubClient.ts";

type TranslatorLike = {
  __: (
    key: string,
    vars?: Record<string, unknown>,
    locale?: string
  ) => Promise<string | unknown>;
};

type UserLike = {
  id: string;
  bot?: boolean;
  tag?: string;
  toString: () => string;
  send: (content: unknown) => Promise<unknown>;
};

type MarriageStatusLike = {
  partnerId?: string;
  status?: string;
};

type InteractionLike = {
  guild: {
    id: string;
    name: string;
  };
  user: UserLike;
  client: {
    users: {
      fetch: (userId: string) => Promise<UserLike | null>;
    };
  };
  options: {
    getSubcommand: () => string;
    getUser: (name: string) => UserLike;
  };
  deferReply: () => Promise<unknown>;
  editReply: (payload: unknown) => Promise<unknown>;
};

const command = {
  data: (): SlashCommandBuilder => {
    const builder = new SlashCommandBuilder()
      .setName("marriage")
      .setDescription("Manage your marriage status")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("propose")
          .setDescription("Propose marriage to another user")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("The user to propose to")
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("accept")
          .setDescription("Accept a marriage proposal")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("The user whose proposal you want to accept")
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("reject")
          .setDescription("Reject a marriage proposal")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("The user whose proposal you want to reject")
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("divorce")
          .setDescription("End your current marriage")
      );

    return builder as SlashCommandBuilder;
  },
  localization_strings: {
    command: {
      name: {
        ru: "брак",
        uk: "шлюб",
      },
      description: {
        ru: "Управление вашим семейным положением",
        uk: "Керування вашим сімейним станом",
      },
    },
    subcommands: {
      propose: {
        name: {
          ru: "предложить",
          uk: "запропонувати",
        },
        description: {
          ru: "Предложить брак другому пользователю",
          uk: "Запропонувати шлюб іншому користувачеві",
        },
        options: {
          user: {
            description: {
              ru: "Пользователь, которому вы хотите предложить брак",
              uk: "Користувач, якому ви хочете запропонувати шлюб",
            },
          },
        },
      },
      accept: {
        name: {
          ru: "принять",
          uk: "прийняти",
        },
        description: {
          ru: "Принять предложение о браке",
          uk: "Прийняти пропозицію про шлюб",
        },
        options: {
          user: {
            description: {
              ru: "Пользователь, чье предложение вы хотите принять",
              uk: "Користувач, чию пропозицію ви хочете прийняти",
            },
          },
        },
      },
      reject: {
        name: {
          ru: "отклонить",
          uk: "відхилити",
        },
        description: {
          ru: "Отклонить предложение о браке",
          uk: "Відхилити пропозицію про шлюб",
        },
        options: {
          user: {
            description: {
              ru: "Пользователь, чье предложение вы хотите отклонить",
              uk: "Користувач, чию пропозицію ви хочете відхилити",
            },
          },
        },
      },
      divorce: {
        name: {
          ru: "развод",
          uk: "розлучення",
        },
        description: {
          ru: "Завершить ваш текущий брак",
          uk: "Завершити ваш поточний шлюб",
        },
      },
    },
    proposeSuccess: {
      en: "💍 You have proposed marriage to {{user}}! He/She needs to use /marriage accept to accept.",
      ru: "💍 Вы предложили брак {{user}}! Ей/ему нужно использовать /marriage accept, чтобы принять.",
      uk: "💍 Ви запропонували шлюб {{user}}! Їй/йому потрібно використати /marriage accept, щоб прийняти.",
    },
    cannotMarrySelf: {
      en: "You cannot marry yourself.",
      ru: "Вы не можете жениться на себе.",
      uk: "Ви не можете одружитися самі з собою.",
    },
    cannotMarryBot: {
      en: "You cannot marry a bot.",
      ru: "Вы не можете жениться на боте.",
      uk: "Ви не можете одружитися з ботом.",
    },
    alreadyMarried: {
      en: "You are already married or have a pending proposal.",
      ru: "Вы уже состоите в браке или у вас есть ожидающее предложение.",
      uk: "Ви вже одружені або маєте очікувану пропозицію.",
    },
    targetAlreadyMarried: {
      en: "{{user}} is already married or has a pending proposal.",
      ru: "{{user}} уже состоит в браке или у них есть ожидающее предложение.",
      uk: "{{user}} вже одружені або мають очікувану пропозицію.",
    },
    proposalError: {
      en: "An error occurred while proposing marriage.",
      ru: "Произошла ошибка при предложении брака.",
      uk: "Сталася помилка під час пропозиції шлюбу.",
    },
    proposalDM: {
      en: "💍 You have received a marriage proposal from {{user}} in {{guild}}! Use /marriage accept or /marriage reject in that server.",
      ru: "💍 Вы получили предложение о браке от {{user}} на сервере {{guild}}! Используйте /marriage accept или /marriage reject на этом сервере.",
      uk: "💍 Ви отримали пропозицію про шлюб від {{user}} на сервері {{guild}}! Використовуйте /marriage accept або /marriage reject на цьому сервері.",
    },
    cannotSendDM: {
      en: "(Could not send a DM to the user.)",
      ru: "(Не удалось отправить ЛС пользователю.)",
      uk: "(Не вдалося надіслати ОП користувачеві.)",
    },
    acceptSuccess: {
      en: "💖 Congratulations! You are now married to {{user}}!",
      ru: "💖 Поздравляем! Теперь вы состоите в браке с {{user}}!",
      uk: "💖 Вітаємо! Тепер ви одружені з {{user}}!",
    },
    noProposalToAccept: {
      en: "You do not have a pending marriage proposal from {{user}}.",
      ru: "У вас нет ожидающего предложения о браке от {{user}}.",
      uk: "У вас немає очікуваної пропозиції про шлюб від {{user}}.",
    },
    acceptError: {
      en: "An error occurred while accepting the marriage proposal.",
      ru: "Произошла ошибка при принятии предложения о браке.",
      uk: "Сталася помилка під час прийняття пропозиції про шлюб.",
    },
    rejectSuccess: {
      en: "💔 You have rejected the marriage proposal from {{user}}.",
      ru: "💔 Вы отклонили предложение о браке от {{user}}.",
      uk: "💔 Ви відхилили пропозицію про шлюб від {{user}}.",
    },
    noProposalToReject: {
      en: "You do not have a pending marriage proposal from {{user}}.",
      ru: "У вас нет ожидающего предложения о браке от {{user}}.",
      uk: "У вас немає очікуваної пропозиції про шлюб від {{user}}.",
    },
    rejectError: {
      en: "An error occurred while rejecting the marriage proposal.",
      ru: "Произошла ошибка при отклонении предложения о браке.",
      uk: "Сталася помилка під час відхилення пропозиції про шлюб.",
    },
    divorceSuccess: {
      en: "💔 You have successfully divorced {{user}}.",
      ru: "💔 Вы успешно развелись с {{user}}.",
      uk: "💔 Ви успішно розлучилися з {{user}}.",
    },
    notMarried: {
      en: "You are not currently married.",
      ru: "В настоящее время вы не состоите в браке.",
      uk: "На даний момент ви не одружені.",
    },
    divorceError: {
      en: "An error occurred while processing the divorce.",
      ru: "Произошла ошибка при обработке развода.",
      uk: "Сталася помилка під час обробки розлучення.",
    },
    divorceDM: {
      en: "💔 You have been divorced from {{user}} in {{guild}}.",
      ru: "💔 Вы развелись с {{user}} на сервере {{guild}}.",
      uk: "💔 Ви розлучилися з {{user}} на сервері {{guild}}.",
    },
  },

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<unknown> {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    await interaction.deferReply();

    try {
      switch (subcommand) {
        case "propose": {
          const targetUser = interaction.options.getUser("user");
          const targetUserId = targetUser.id;

          if (userId === targetUserId) {
            return interaction.editReply(
              await i18n.__("commands.marriage.cannotMarrySelf")
            );
          }
          if (targetUser.bot) {
            return interaction.editReply(
              await i18n.__("commands.marriage.cannotMarryBot")
            );
          }

          try {
            await (hubClient as any).proposeMarriage(guildId, userId, targetUserId);

            let dmSent = false;
            try {
              await targetUser.send(
                await i18n.__("commands.marriage.proposalDM", {
                  user: interaction.user.tag,
                  guild: interaction.guild.name,
                })
              );
              dmSent = true;
            } catch (dmError) {
              console.warn(`Failed to send proposal DM to ${targetUser.id}:`, dmError);
            }

            return interaction.editReply(
              `${String(
                await i18n.__("commands.marriage.proposeSuccess", {
                  user: targetUser.toString(),
                  proposer: interaction.user.toString(),
                })
              )}${dmSent ? "" : ` ${await i18n.__("commands.marriage.cannotSendDM")}`}`
            );
          } catch (error) {
            const typedError = error as Error;
            if (typedError.message.includes("User 1 is already married")) {
              return interaction.editReply(
                await i18n.__("commands.marriage.alreadyMarried")
              );
            }
            if (typedError.message.includes("User 2 is already married")) {
              return interaction.editReply(
                await i18n.__("commands.marriage.targetAlreadyMarried", {
                  user: targetUser.toString(),
                })
              );
            }
            console.error("Propose marriage error:", error);
            return interaction.editReply(
              await i18n.__("commands.marriage.proposalError")
            );
          }
        }
        case "accept": {
          const proposingUser = interaction.options.getUser("user");
          const proposingUserId = proposingUser.id;

          try {
            await (hubClient as any).acceptMarriage(guildId, userId, proposingUserId);
            return interaction.editReply(
              await i18n.__("commands.marriage.acceptSuccess", {
                user: proposingUser.toString(),
              })
            );
          } catch (error) {
            const typedError = error as Error;
            if (typedError.message.includes("No pending marriage proposal")) {
              return interaction.editReply(
                await i18n.__("commands.marriage.noProposalToAccept", {
                  user: proposingUser.toString(),
                })
              );
            }
            console.error("Accept marriage error:", error);
            return interaction.editReply(
              await i18n.__("commands.marriage.acceptError")
            );
          }
        }
        case "reject": {
          const proposingUser = interaction.options.getUser("user");
          const proposingUserId = proposingUser.id;

          try {
            await (hubClient as any).rejectMarriage(guildId, userId, proposingUserId);
            return interaction.editReply(
              await i18n.__("commands.marriage.rejectSuccess", {
                user: proposingUser.toString(),
              })
            );
          } catch (error) {
            const typedError = error as Error;
            if (typedError.message.includes("No pending marriage proposal")) {
              const status = (await (hubClient as any).getMarriageStatus(
                guildId,
                userId
              )) as MarriageStatusLike | null;
              if (
                status?.partnerId === proposingUserId &&
                status?.status === "PENDING"
              ) {
                await (hubClient as any).rejectMarriage(
                  guildId,
                  userId,
                  proposingUserId
                );
                return interaction.editReply(
                  await i18n.__("commands.marriage.rejectSuccess", {
                    user: proposingUser.toString(),
                  })
                );
              }
              return interaction.editReply(
                await i18n.__("commands.marriage.noProposalToReject", {
                  user: proposingUser.toString(),
                })
              );
            }
            console.error("Reject marriage error:", error);
            return interaction.editReply(
              await i18n.__("commands.marriage.rejectError")
            );
          }
        }
        case "divorce": {
          try {
            const status = (await (hubClient as any).getMarriageStatus(
              guildId,
              userId
            )) as MarriageStatusLike | null;
            if (!status || status.status !== "MARRIED" || !status.partnerId) {
              return interaction.editReply(
                await i18n.__("commands.marriage.notMarried")
              );
            }

            const partner = await interaction.client.users.fetch(status.partnerId);
            const partnerTag = partner
              ? partner.toString()
              : `User (${status.partnerId})`;

            await (hubClient as any).dissolveMarriage(
              guildId,
              userId,
              status.partnerId
            );

            let partnerDmSent = false;
            const divorceMessage = await i18n.__(
              "commands.marriage.divorceDM",
              {
                user: interaction.user.tag,
                guild: interaction.guild.name,
              }
            );

            if (partner) {
              try {
                await partner.send(divorceMessage);
                partnerDmSent = true;
              } catch {
                console.warn(
                  `Failed to send divorce DM to partner ${partner.id}`
                );
              }
            }

            let replyMessage = String(
              await i18n.__("commands.marriage.divorceSuccess", {
                user: partnerTag,
              })
            );
            if (!partnerDmSent) {
              replyMessage += ` ${String(
                await i18n.__("commands.marriage.cannotSendDM")
              ).replace("the user", "your partner")}`;
            }

            return interaction.editReply(replyMessage);
          } catch (error) {
            const typedError = error as Error;
            if (typedError.message.includes("No active marriage found")) {
              return interaction.editReply(
                await i18n.__("commands.marriage.notMarried")
              );
            }
            console.error("Divorce error:", error);
            return interaction.editReply(
              await i18n.__("commands.marriage.divorceError")
            );
          }
        }
        default: {
          return interaction.editReply("Unknown subcommand.");
        }
      }
    } catch (error) {
      console.error(`Error executing marriage command (${subcommand}):`, error);
      return interaction.editReply(
        "An unexpected error occurred. Please try again later."
      );
    }
  },
};

export default command;
