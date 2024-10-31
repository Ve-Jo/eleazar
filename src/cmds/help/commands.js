import {
  SlashCommandSubcommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";
import { generateRemoteImage } from "../../utils/remoteImageGenerator.js";
import i18n from "../../utils/i18n.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("commands")
    .setDescription("Help with commands"),
  async execute(interaction) {
    const commands = [];
    const categories = new Set();
    const locale = interaction.locale;

    interaction.client.commands.forEach(command => {
      if (command.data.options && command.data.options.length > 0) {
        command.data.options.forEach((subcommand) => {
          const args = subcommand.options
            ? subcommand.options.map(
                (option) =>
                  `${option.name}${option.required ? "*" : ""}: ${
                    option.description_localizations
                      ? option.description_localizations[locale]
                      : option.description
                  }`
              )
            : [];

          const requiredArgs = subcommand.options
            ? subcommand.options
                .filter((option) => option.required)
                .map((option) => option.name)
            : [];

          const usage = `/${command.data.name} ${
            subcommand.name
          } ${requiredArgs.map((arg) => `<${arg}>`).join(" ")}`;

          commands.push({
            title: subcommand.name,
            description: subcommand.description_localizations?.[locale] || subcommand.description,
            category: command.data.name,
            currentValue: [usage, ...args],
          });

          categories.add(command.data.name);
        });
      } else {
        const args = command.data.options
          ? command.data.options.map(
              (option) =>
                `${option.name}${option.required ? "*" : ""}: ${option.description}`
            )
          : [];

        const requiredArgs = command.data.options
          ? command.data.options
              .filter((option) => option.required)
              .map((option) => option.name)
          : [];

        const usage = `/${command.data.name} ${requiredArgs
          .map((arg) => `<${arg}>`)
          .join(" ")}`;

        commands.push({
          title: command.data.name,
          description: command.data.description,
          category: "General",
          currentValue: [usage, ...args],
        });

        categories.add("General");
      }
    });

    let highlightedPosition = 0;
    const visibleCount = 1;

    const generateCommandImage = async () => {
      return await generateRemoteImage(
        "SettingsDisplay",
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
          settings: commands,
          highlightedPosition,
          visibleCount,
          height: 700,
          width: 600,
          maxSettingsHided: 4,
          maxSettingsHidedWidth: 450,
        },
        { width: 600, height: 700 }
      );
    };

    const updateMessage = async () => {
      const pngBuffer = await generateCommandImage();
      const attachment = new AttachmentBuilder(pngBuffer, {
        name: "commands.png",
      });

      const embed = new EmbedBuilder()
        .setTimestamp()
        .setColor(process.env.EMBED_COLOR)
        .setImage("attachment://commands.png")
        .setAuthor({
          name: i18n.__("help.commandsTitle"),
          iconURL: interaction.user.avatarURL(),
        });

      return { embeds: [embed], files: [attachment] };
    };

    const createCategoryMenu = () => {
      return new StringSelectMenuBuilder()
        .setCustomId("category")
        .setPlaceholder("Select a category")
        .addOptions(
          Array.from(categories).map((category) => ({
            label: category,
            value: category,
          }))
        );
    };

    const createSubcommandMenu = () => {
      const currentCategory = commands[highlightedPosition].category;
      const subcommands = commands.filter(
        (cmd) => cmd.category === currentCategory
      );

      return new StringSelectMenuBuilder()
        .setCustomId("subcommand")
        .setPlaceholder("Select a subcommand")
        .addOptions(
          subcommands.map((cmd, index) => ({
            label: cmd.title,
            value: index.toString(),
          }))
        );
    };

    const row2 = new ActionRowBuilder().addComponents(createCategoryMenu());
    const row3 = new ActionRowBuilder().addComponents(createSubcommandMenu());

    const response = await interaction.editReply({
      ...(await updateMessage()),
      components: [row2, row3],
    });

    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      idle: 60000, // 60 seconds of inactivity
    });

    collector.on("collect", async (i) => {
      if (i.user.id === interaction.user.id) {
        if (i.customId === "category") {
          const selectedCategory = i.values[0];
          highlightedPosition = commands.findIndex(
            (cmd) => cmd.category === selectedCategory
          );
        } else if (i.customId === "subcommand") {
          const currentCategory = commands[highlightedPosition].category;
          const subcommandIndex = parseInt(i.values[0]);
          highlightedPosition = commands.findIndex(
            (cmd) =>
              cmd.category === currentCategory &&
              cmd.title ===
                commands.filter((c) => c.category === currentCategory)[
                  subcommandIndex
                ].title
          );
        }

        await i.deferUpdate();
        await response.edit({
          ...(await updateMessage()),
          components: [
            row2,
            new ActionRowBuilder().addComponents(createSubcommandMenu()),
          ],
        });
      } else {
        i.reply({
          content: "You can't use these components.",
          ephemeral: true,
        });
      }
    });

    collector.on("end", () => {
      interaction.editReply({ components: [] });
    });
  },
};
