import {
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandStringOption,
  EmbedBuilder,
  Colors,
} from "discord.js";
import hubClient from "../../api/hubClient.js";
import i18n from "../../utils/i18n.js";
import { getCountryFlag, getCountryName } from "../../utils/countryFlags.js";
import {
  validatePersonalizationData,
  getGenderEmoji,
  formatAge,
  sanitizeRealName,
  sanitizeGender,
} from "../../utils/validation.js";

export default {
  data: () => {
    const builder = new SlashCommandBuilder()
      .setName("profile")
      .setDescription("Manage your personal profile information")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("set")
          .setDescription("Set your profile information")
          .addStringOption((option) =>
            option
              .setName("name")
              .setDescription("Your real name (1-50 characters)")
              .setRequired(false)
              .setMaxLength(50),
          )
          .addIntegerOption((option) =>
            option
              .setName("age")
              .setDescription("Your age (13-120)")
              .setRequired(false)
              .setMinValue(13)
              .setMaxValue(120),
          )
          .addStringOption((option) =>
            option
              .setName("gender")
              .setDescription("Your gender")
              .setRequired(false)
              .addChoices(
                { name: "Male", value: "male" },
                { name: "Female", value: "female" },
                { name: "Non-binary", value: "non-binary" },
                { name: "Other", value: "other" },
              ),
          )
          .addStringOption((option) =>
            option
              .setName("country")
              .setDescription("Your country code (2 letters, e.g., US, GB, CA)")
              .setRequired(false)
              .setMaxLength(2)
              .setMinLength(2),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("reset")
          .setDescription("Reset your profile information")
          .addStringOption((option) =>
            option
              .setName("field")
              .setDescription("Which field to reset (leave empty to reset all)")
              .setRequired(false)
              .addChoices(
                { name: "name", value: "realName" },
                { name: "age", value: "age" },
                { name: "gender", value: "gender" },

                { name: "country", value: "countryCode" },
                { name: "all", value: "all" },
              ),
          ),
      );

    return builder;
  },

  localization_strings: {
    command: {
      name: { en: "profile", ru: "профиль", uk: "профіль" },
      description: {
        en: "Manage your personal profile information",
        ru: "Управление личной информацией профиля",
        uk: "Управління особистою інформацією профілю",
      },
    },
    subcommands: {
      view: {
        name: { en: "view", ru: "просмотреть", uk: "переглянути" },
        description: {
          en: "View your profile or someone else's profile",
          ru: "Просмотреть свой профиль или профиль другого пользователя",
          uk: "Переглянути свій профіль або профіль іншого користувача",
        },
        options: {
          user: {
            name: { en: "user", ru: "пользователь", uk: "користувач" },
            description: {
              en: "The user whose profile you want to view",
              ru: "Пользователь, профиль которого вы хотите просмотреть",
              uk: "Користувач, профіль якого ви хочете переглянути",
            },
          },
        },
        title: {
          en: "Profile",
          ru: "Профиль",
          uk: "Профіль",
        },
        no_profile: {
          en: "No profile information set yet.",
          ru: "Информация профиля еще не установлена.",
          uk: "Інформація профілю ще не встановлена.",
        },
      },
      set: {
        name: { en: "set", ru: "установить", uk: "встановити" },
        description: {
          en: "Set your profile information",
          ru: "Установить информацию профиля",
          uk: "Встановити інформацію профілю",
        },
        options: {
          name: {
            name: { en: "name", ru: "имя", uk: "імя" },
            description: {
              en: "Your real name (1-50 characters)",
              ru: "Ваше реальное имя (1-50 символов)",
              uk: "Ваше справжнє імя (1-50 символів)",
            },
          },
          age: {
            name: { en: "age", ru: "возраст", uk: "вік" },
            description: {
              en: "Your age (13-120)",
              ru: "Ваш возраст (13-120)",
              uk: "Ваш вік (13-120)",
            },
          },
          gender: {
            name: { en: "gender", ru: "пол", uk: "стать" },
            description: {
              en: "Your gender (male, female, non-binary, or custom)",
              ru: "Ваш пол (мужской, женский, небинарный или свой)",
              uk: "Ваша стать (чоловіча, жіноча, небінарна або своя)",
            },
          },

          country: {
            name: { en: "country", ru: "страна", uk: "країна" },
            description: {
              en: "Your country code (2 letters, e.g., US, GB, CA)",
              ru: "Код вашей страны (2 буквы, например, RU, GB, US)",
              uk: "Код вашої країни (2 літери, наприклад, UA, GB, US)",
            },
          },
        },
        success: {
          en: "Profile updated successfully!",
          ru: "Профиль успешно обновлен!",
          uk: "Профіль успішно оновлений!",
        },
        errors: {
          invalid_name: {
            en: "Name must be 1-50 characters and contain only letters, spaces, hyphens, and apostrophes",
            ru: "Имя должно быть 1-50 символов и содержать только буквы, пробелы, дефисы и апострофы",
            uk: "Імя має бути 1-50 символів і містити лише літери, пробіли, дефіси та апострофи",
          },
          invalid_age: {
            en: "Age must be between 13 and 120",
            ru: "Возраст должен быть от 13 до 120",
            uk: "Вік має бути від 13 до 120",
          },
          invalid_gender: {
            en: "Gender must be 1-20 characters and contain only letters",
            ru: "Пол должен быть 1-20 символов и содержать только буквы",
            uk: "Стать має бути 1-20 символів і містити лише літери",
          },

          invalid_country: {
            en: "Country code must be a valid 2-letter ISO code (e.g., US, GB, CA)",
            ru: "Код страны должен быть действительным 2-буквенным ISO кодом (например, RU, GB, US)",
            uk: "Код країни має бути дійсним 2-літерним ISO кодом (наприклад, UA, GB, US)",
          },
        },
      },
      reset: {
        name: { en: "reset", ru: "сбросить", uk: "скинути" },
        description: {
          en: "Reset your profile information",
          ru: "Сбросить информацию профиля",
          uk: "Скинути інформацію профілю",
        },
        options: {
          field: {
            name: { en: "field", ru: "поле", uk: "поле" },
            description: {
              en: "Which field to reset (leave empty to reset all)",
              ru: "Какое поле сбросить (оставьте пустым для сброса всех)",
              uk: "Яке поле скинути (залиште порожнім для скидання всіх)",
            },
          },
        },
        success: {
          en: "Profile reset successfully!",
          ru: "Профиль успешно сброшен!",
          uk: "Профіль успішно скинутий!",
        },
        errors: {
          nothing_to_reset: {
            en: "Nothing to reset - your profile is already empty.",
            ru: "Нечего сбрасывать - ваш профиль уже пуст.",
            uk: "Нічого скидати - ваш профіль уже порожній.",
          },
        },
      },
    },
    fields: {
      name: {
        en: "Name",
        ru: "Имя",
        uk: "Імя",
      },
      age: {
        en: "Age",
        ru: "Возраст",
        uk: "Вік",
      },
      gender: {
        en: "Gender",
        ru: "Пол",
        uk: "Стать",
      },

      country: {
        en: "Country",
        ru: "Страна",
        uk: "Країна",
      },
      privacy: {
        en: "Privacy",
        ru: "Конфиденциальность",
        uk: "Конфіденційність",
      },
    },
    fields: {
      name: {
        en: "Name",
        ru: "Имя",
        uk: "Імя",
      },
      age: {
        en: "Age",
        ru: "Возраст",
        uk: "Вік",
      },
      gender: {
        en: "Gender",
        ru: "Пол",
        uk: "Стать",
      },

      country: {
        en: "Country",
        ru: "Страна",
        uk: "Країна",
      },
      privacy: {
        en: "Privacy",
        ru: "Конфиденциальность",
        uk: "Конфіденційність",
      },
    },
    ephemeral: true,
  },

  async execute(interaction, i18n) {
    const subcommand = interaction.options.getSubcommand();

    await interaction.deferReply();

    try {
      switch (subcommand) {
        case "set":
          await handleSetProfile(interaction, i18n);
          break;
        case "reset":
          await handleResetProfile(interaction, i18n);
          break;
        default:
          await interaction.editReply({
            content: "❌ Unknown subcommand.",
            ephemeral: true,
          });
      }
    } catch (error) {
      console.error("Error executing profile command:", error);
      await interaction.editReply({
        content: "❌ An error occurred while processing your command.",
        ephemeral: true,
      });
    }
  },
};

async function handleSetProfile(interaction, i18n) {
  const { guild } = interaction;
  const user = interaction.user;

  // Collect data from options
  const updateData = {};

  const name = interaction.options.getString("name");
  if (name) updateData.realName = sanitizeRealName(name);

  const age = interaction.options.getInteger("age");
  if (age) updateData.age = age;

  const gender = interaction.options.getString("gender");
  if (gender) updateData.gender = sanitizeGender(gender);

  const country = interaction.options.getString("country");
  if (country) updateData.countryCode = country.toUpperCase();

  if (Object.keys(updateData).length === 0) {
    return await interaction.editReply({
      content: "❌ Please provide at least one piece of information to update.",
      ephemeral: true,
    });
  }

  // Validate the data
  const validation = validatePersonalizationData(updateData);

  if (!validation.isValid) {
    const errorMessages = Object.values(validation.errors).join("\n");
    return await interaction.editReply({
      content: `❌ **Validation Errors:**\n${errorMessages}`,
      ephemeral: true,
    });
  }

  try {
    // Update user profile
    await hubClient.updateUserProfile(guild.id, user.id, validation.sanitized);

    await interaction.editReply({
      content: await i18n.__("commands.profile.subcommands.set.success"),
      ephemeral: true,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    await interaction.editReply({
      content: "❌ An error occurred while updating your profile.",
      ephemeral: true,
    });
  }
}

async function handleResetProfile(interaction, i18n) {
  const { guild } = interaction;
  const user = interaction.user;

  const field = interaction.options.getString("field");

  try {
    // Get current profile first
    const currentProfile = await hubClient.getUserProfile(guild.id, user.id);

    if (
      !currentProfile ||
      Object.keys(currentProfile).length === 0 ||
      !hasAnyPersonalizationData(currentProfile)
    ) {
      return await interaction.editReply({
        content: await i18n.__(
          "commands.profile.subcommands.reset.errors.nothing_to_reset",
        ),
        ephemeral: true,
      });
    }

    let resetData = {};

    if (field === "all" || !field) {
      // Reset all fields
      resetData = {
        realName: null,
        age: null,
        gender: null,

        countryCode: null,
      };
    } else {
      // Reset specific field
      resetData[field] = null;
    }

    // Update profile with reset data
    await hubClient.updateUserProfile(guild.id, user.id, resetData);

    await interaction.editReply({
      content: await i18n.__("commands.profile.subcommands.reset.success"),
      ephemeral: true,
    });
  } catch (error) {
    console.error("Error resetting profile:", error);
    await interaction.editReply({
      content: "❌ An error occurred while resetting your profile.",
      ephemeral: true,
    });
  }
}

// Helper function to check if profile has any personalization data
function hasAnyPersonalizationData(profile) {
  return (
    profile.realName || profile.age || profile.gender || profile.countryCode
  );
}
