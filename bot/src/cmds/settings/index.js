import {
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  EmbedBuilder,
  PermissionsBitField,
  ChannelType,
} from "discord.js";
import hubClient from "../../api/hubClient.js";
import i18n from "../../utils/i18n.js";

export default {
  data: () => {
    const builder = new SlashCommandBuilder()
      .setName("settings") // Assuming a general settings command
      .setDescription("Configure bot settings (level roles, etc.)") // Adjust description
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator) // Only Admins
      .addSubcommandGroup((group) =>
        group
          .setName("levelroles")
          .setDescription("Configure roles awarded for reaching chat levels")
          .addSubcommand((subcommand) =>
            subcommand
              .setName("add")
              .setDescription(
                "Assign a role to be awarded at a specific chat level",
              )
              .addRoleOption((option) =>
                option
                  .setName("role")
                  .setDescription("The role to award")
                  .setRequired(true),
              )
              .addIntegerOption((option) =>
                option
                  .setName("level")
                  .setDescription(
                    "The chat level required to receive this role",
                  )
                  .setRequired(true)
                  .setMinValue(1),
              ),
          )
          .addSubcommand((subcommand) =>
            subcommand
              .setName("remove")
              .setDescription("Remove a role reward associated with a level")
              .addRoleOption((option) =>
                option
                  .setName("role")
                  .setDescription("The role reward to remove")
                  .setRequired(true),
              ),
          )
          .addSubcommand((subcommand) =>
            subcommand
              .setName("list")
              .setDescription("List all configured level role rewards"),
          ),
      );
    return builder;
  },

  localization_strings: {
    command: {
      name: { en: "settings", ru: "настройки", uk: "налаштування" },
      description: {
        en: "Configure bot settings (level roles, etc.)",
        ru: "Настроить настройки бота (уровневые роли, и т.д.)",
        uk: "Налаштувати налаштування бота (рівневі ролі, і т.д.)",
      },
    },
    subcommands: {
      levelroles: {
        name: { en: "levelroles", ru: "уровневыероли", uk: "рівневіролі" },
        description: {
          en: "Configure roles awarded for reaching chat levels",
          ru: "Настроить роли, выдаваемые за достижение уровней чата",
          uk: "Налаштувати ролі, що видаються за досягнення рівнів чату",
        },
        add: {
          name: { en: "add", ru: "добавить", uk: "додати" },
          description: {
            en: "Assign a role to be awarded at a specific chat level",
            ru: "Назначить роль для выдачи на определенном уровне чата",
            uk: "Призначити роль для видачі на певному рівні чату",
          },
          options: {
            role: {
              name: { en: "role", ru: "роль", uk: "роль" },
              description: {
                en: "The role to award",
                ru: "Роль для награды",
                uk: "Роль для нагороди",
              },
            },
            level: {
              name: { en: "level", ru: "уровень", uk: "рівень" },
              description: {
                en: "The chat level required to receive this role",
                ru: "Уровень чата, необходимый для получения этой роли",
                uk: "Рівень чату, необхідний для отримання цієї ролі",
              },
            },
          },
          success: {
            en: "Successfully set role {{roleName}} to be awarded at chat level {{level}}.",
            ru: "Роль {{roleName}} успешно установлена для выдачи на уровне чата {{level}}.",
            uk: "Роль {{roleName}} успішно встановлено для видачі на рівні чату {{level}}.",
          },
          error_level_exists: {
            en: "Error: Another role ({{existingRoleName}}) is already assigned to level {{level}}.",
            ru: "Ошибка: Другая роль ({{existingRoleName}}) уже назначена на уровень {{level}}.",
            uk: "Помилка: Інша роль ({{existingRoleName}}) вже призначена на рівень {{level}}.",
          },
          error_role_exists: {
            en: "Error: Role {{roleName}} is already assigned to level {{existingLevel}}. Remove it first.",
            ru: "Ошибка: Роль {{roleName}} уже назначена на уровень {{existingLevel}}. Сначала удалите её.",
            uk: "Помилка: Роль {{roleName}} вже призначена на рівень {{existingLevel}}. Спочатку видаліть її.",
          },
          error_level_invalid: {
            en: "Error: Required level must be 1 or higher.",
            ru: "Ошибка: Требуемый уровень должен быть 1 или выше.",
            uk: "Помилка: Необхідний рівень має бути 1 або вище.",
          },
          error_role_unmanageable: {
            en: "Error: I cannot assign the role {{roleName}} because it is higher than my highest role.",
            ru: "Ошибка: Я не могу назначить роль {{roleName}}, так как она выше моей наивысшей роли.",
            uk: "Помилка: Я не можу призначити роль {{roleName}}, оскільки вона вища за мою найвищу роль.",
          },
        },
        remove: {
          name: { en: "remove", ru: "удалить", uk: "видалити" },
          description: {
            en: "Remove a role reward associated with a level",
            ru: "Удалить награду в виде роли, связанную с уровнем",
            uk: "Видалити нагороду у вигляді ролі, пов'язану з рівнем",
          },
          options: {
            role: {
              name: { en: "role", ru: "роль", uk: "роль" },
              description: {
                en: "The role reward to remove",
                ru: "Награда в виде роли для удаления",
                uk: "Нагорода у вигляді ролі для видалення",
              },
            },
          },
          success: {
            en: "Successfully removed role reward {{roleName}}.",
            ru: "Награда в виде роли {{roleName}} успешно удалена.",
            uk: "Нагороду у вигляді ролі {{roleName}} успішно видалено.",
          },
          error_not_found: {
            en: "Error: Role {{roleName}} is not configured as a level reward.",
            ru: "Ошибка: Роль {{roleName}} не настроена как награда за уровень.",
            uk: "Помилка: Роль {{roleName}} не налаштована як нагорода за рівень.",
          },
        },
        list: {
          name: { en: "list", ru: "список", uk: "список" },
          description: {
            en: "List all configured level role rewards",
            ru: "Показать список всех настроенных наград за уровень в виде ролей",
            uk: "Показати список усіх налаштованих нагород за рівень у вигляді ролей",
          },
          title: {
            en: "Configured Level Roles",
            ru: "Настроенные Уровневые Роли",
            uk: "Налаштовані Рівневі Ролі",
          },
          no_roles: {
            en: "No level roles configured yet.",
            ru: "Уровневые роли еще не настроены.",
            uk: "Рівневі ролі ще не налаштовані.",
          },
          entry: {
            en: "Level {{level}}: {{roleMention}}",
            ru: "Уровень {{level}}: {{roleMention}}",
            uk: "Рівень {{level}}: {{roleMention}}",
          },
        },
      },
    },
    error_permissions: {
      en: "You need the Administrator permission to manage level roles.",
      ru: "Вам необходимо разрешение Администратора для управления уровневыми ролями.",
      uk: "Вам потрібен дозвіл Адміністратора для керування рівневими ролями.",
    },
    error_generic: {
      en: "An error occurred while managing level roles.",
      ru: "Произошла ошибка при управлении уровневыми ролями.",
      uk: "Сталася помилка під час керування рівневими ролями.",
    },
  },

  async execute(interaction, i18n) {
    if (!interaction.inGuild()) return;
    if (
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.Administrator,
      )
    ) {
      return interaction.reply({
        content: await i18n.__("commands.settings.error_permissions"),
        ephemeral: true,
      });
    }

    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();
    const { guild } = interaction;

    await interaction.deferReply({ ephemeral: true });

    const i18nBaseKey = `commands.settings.subcommands.${subcommandGroup}.${subcommand}`;

    try {
      if (subcommandGroup === "levelroles") {
        if (subcommand === "add") {
          const role = interaction.options.getRole("role");
          const level = interaction.options.getInteger("level");
          const botMember = await guild.members.fetchMe();

          if (botMember.roles.highest.comparePositionTo(role) <= 0) {
            return interaction.editReply(
              await i18n.__(`${i18nBaseKey}.error_role_unmanageable`, {
                roleName: role.name,
              }),
            );
          }

          try {
            await hubClient.addLevelRole(guild.id, level, role.id);
            await interaction.editReply(
              await i18n.__(`${i18nBaseKey}.success`, {
                roleName: role.name,
                level: level,
              }),
            );
          } catch (dbError) {
            if (dbError.message.includes("already assigned to level")) {
              if (dbError.message.includes("A different role")) {
                const match = dbError.message.match(/\((.*?)\)/);
                const existingRoleId = match ? match[1] : "unknown";
                const existingRole = await guild.roles
                  .fetch(existingRoleId)
                  .catch(() => null);
                await interaction.editReply(
                  await i18n.__(`${i18nBaseKey}.error_level_exists`, {
                    existingRoleName: existingRole?.name || existingRoleId,
                    level: level,
                  }),
                );
              } else {
                const match = dbError.message.match(/level (\d+)/);
                const existingLevel = match ? match[1] : "unknown";
                await interaction.editReply(
                  await i18n.__(`${i18nBaseKey}.error_role_exists`, {
                    roleName: role.name,
                    existingLevel: existingLevel,
                  }),
                );
              }
            } else if (dbError.message.includes("level must be at least 1")) {
              await interaction.editReply(
                await i18n.__(`${i18nBaseKey}.error_level_invalid`),
              );
            } else {
              throw dbError;
            }
          }
        } else if (subcommand === "remove") {
          const role = interaction.options.getRole("role");
          try {
            await hubClient.removeLevelRole(guild.id, level);
            await interaction.editReply(
              await i18n.__(`${i18nBaseKey}.success`, {
                roleName: role.name,
              }),
            );
          } catch (dbError) {
            if (dbError.message.includes("not found")) {
              await interaction.editReply(
                await i18n.__(`${i18nBaseKey}.error_not_found`, {
                  roleName: role.name,
                }),
              );
            } else {
              throw dbError;
            }
          }
        } else if (subcommand === "list") {
          const levelRoles = await hubClient.getGuildLevelRoles(guild.id);

          if (!levelRoles || levelRoles.length === 0) {
            return interaction.editReply(
              await i18n.__(`${i18nBaseKey}.no_roles`),
            );
          }

          const embed = new EmbedBuilder()
            .setTitle(await i18n.__(`${i18nBaseKey}.title`))
            .setColor(process.env.EMBED_COLOR || 0x0099ff)
            .setTimestamp();

          let description = "";
          for (const lr of levelRoles) {
            const roleMention = `<@&${lr.roleId}>`;
            description +=
              (await i18n.__(`${i18nBaseKey}.entry`, {
                level: lr.requiredLevel,
                roleMention: roleMention,
              })) + "\n";
          }

          embed.setDescription(description.trim());

          await interaction.editReply({ embeds: [embed] });
        }
      }
    } catch (error) {
      console.error("Error executing levelroles setting command:", error);
      await interaction
        .editReply({
          content: await i18n.__("commands.settings.error_generic"),
        })
        .catch(() => {});
    }
  },
};
