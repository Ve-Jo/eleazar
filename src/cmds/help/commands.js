import {
  SlashCommandSubcommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";
import SettingsDisplay from "../../components/SettingsDisplay.jsx";
import { generateImage } from "../../utils/imageGenerator.js";
import i18n from "../../utils/i18n.js";

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("commands")
    .setDescription("Help with commands"),
  async execute(interaction) {
    const commands = [];
    const categories = new Set();

    interaction.client.commands.forEach((command) => {
      if (command.data.options && command.data.options.length > 0) {
        // This is a command with subcommands
        command.data.options.forEach((subcommand) => {
          const args = subcommand.options
            ? subcommand.options.map(
                (option) =>
                  `${option.name}${option.required ? "*" : ""}: ${
                    option.description
                  }`
              )
            : [];

          const requiredArgs = subcommand.options
            ? subcommand.options
                .filter((option) => option.required)
                .map((option) => option.name)
            : [];

          const usage = `/${command.data.name} ${subcommand.name} ${requiredArgs
            .map((arg) => `<${arg}>`)
            .join(" ")}`;

          commands.push({
            title: subcommand.name,
            description: subcommand.description,
            category: command.data.name,
            currentValue: [usage, ...args],
          });

          // Add category to the set
          categories.add(command.data.name);
        });
      } else {
        // This is a top-level command without subcommands
        const args = command.data.options
          ? command.data.options.map(
              (option) =>
                `${option.name}${option.required ? "*" : ""}: ${
                  option.description
                }`
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

        // Add category to the set
        categories.add("General");
      }
    });

    let highlightedPosition = 0;
    let mobileMode = true;
    const visibleCount = 1;

    const generateCommandImage = async () => {
      return await generateImage(
        SettingsDisplay,
        {
          settings: commands,
          highlightedPosition,
          visibleCount,
          height: mobileMode ? 900 : 700,
          width: mobileMode ? 500 : 800,
        },
        { width: mobileMode ? 500 : 800, height: mobileMode ? 900 : 700 }
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

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("previous")
        .setLabel("⬆️")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("mobile")
        .setLabel(mobileMode ? "💻" : "📱")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("next")
        .setLabel("⬇️")
        .setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(createCategoryMenu());
    const row3 = new ActionRowBuilder().addComponents(createSubcommandMenu());

    const response = await interaction.editReply({
      ...(await updateMessage()),
      components: [row1, row2, row3],
    });

    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      idle: 60000, // 60 seconds of inactivity
    });

    collector.on("collect", async (i) => {
      if (i.user.id === interaction.user.id) {
        if (i.customId === "previous") {
          highlightedPosition =
            (highlightedPosition - 1 + commands.length) % commands.length;
        } else if (i.customId === "next") {
          highlightedPosition = (highlightedPosition + 1) % commands.length;
        } else if (i.customId === "category") {
          const selectedCategory = i.values[0];
          highlightedPosition = commands.findIndex(
            (cmd) => cmd.category === selectedCategory
          );
        } else if (i.customId === "mobile") {
          mobileMode = !mobileMode;
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
            row1,
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
