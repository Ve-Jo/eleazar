import {
  SlashCommandSubcommandBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import {
  generateImage,
  processImageColors,
} from "../../utils/imageGenerator.js";
import {
  renderUpdate,
  closeSession,
} from "../../utils/PuppeteerSessionManager.js";
import getThreeDObjectScript from "../../render-server/components/ThreeDObject.three.js";

// Rotation increment
const ROTATION_STEP = 0.3; // Radians, adjust as needed
const INTERACTION_TIMEOUT = 60000; // 60 seconds for collector timeout
const SESSION_ID_PREFIX = "threeobject_session_"; // Prefix for session IDs

// Store the initialization script per session to avoid regenerating it unnecessarily
const sessionScripts = new Map();

export default {
  data: () => {
    const builder = new SlashCommandSubcommandBuilder()
      .setName("threeobject")
      .setDescription("Generates an interactive 3D object image using Three.js")
      .addStringOption((option) =>
        option
          .setName("type")
          .setDescription("Type of 3D object to render")
          .setRequired(false)
          .addChoices(
            { name: "Cube", value: "cube" },
            { name: "Sphere", value: "sphere" },
            { name: "Torus", value: "torus" }
          )
      )
      .addNumberOption((option) =>
        option
          .setName("rotationx")
          .setDescription("Initial X-axis rotation (0-6.28)")
          .setRequired(false)
          .setMinValue(0)
          .setMaxValue(6.28)
      )
      .addNumberOption((option) =>
        option
          .setName("rotationy")
          .setDescription("Initial Y-axis rotation (0-6.28)")
          .setRequired(false)
          .setMinValue(0)
          .setMaxValue(6.28)
      );

    return builder;
  },

  async execute(interaction, i18n) {
    await interaction.deferReply();

    const sessionId = SESSION_ID_PREFIX + interaction.id; // Unique ID for this interaction's session
    let modelType = interaction.options.getString("type") || "cube";
    let currentRotationX = interaction.options.getNumber("rotationx") || 0.5;
    let currentRotationY = interaction.options.getNumber("rotationy") || 0.5;
    const locale = interaction.locale || "en";
    i18n.setLocale(locale);

    // --- Helper function to prepare options and generate the final Satori image ---
    const generateSatoriImage = async (rotX, rotY, isInitialRender = false) => {
      // Get the avatar URL by calling the function
      const userAvatarUrl = interaction.user.avatarURL({
        format: "png",
        size: 128,
      });
      const userWithResolvedAvatar = {
        ...interaction.user,
        avatarURL: userAvatarUrl,
      };

      // Get dominant color from user avatar if available
      let modelColor = null;
      let backgroundColorHex = "#2B2D31";
      let ambientLightIntensity = 0.5;
      let directionalLightIntensity = 0.8;

      if (userAvatarUrl) {
        try {
          const colorData = await processImageColors(userAvatarUrl);
          if (colorData.embedColor && colorData.embedColor.startsWith("#")) {
            const hex = colorData.embedColor.slice(1);
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            // Convert hex RGB to decimal integer for Three.js color
            modelColor = (r << 16) + (g << 8) + b;
            backgroundColorHex = colorData.embedColor;
            // Adjust lighting based on darkness
            if (colorData.isDarkText) {
              // If background is light
              ambientLightIntensity = 0.8;
              directionalLightIntensity = 0.6;
            } else {
              // If background is dark
              ambientLightIntensity = 0.4;
              directionalLightIntensity = 1.0;
            }
          }
        } catch (colorError) {
          console.warn(
            `Session ${sessionId}: Error processing avatar colors:`,
            colorError
          );
        }
      }

      // Options for Puppeteer rendering
      const renderOptions = {
        // No longer passing sessionId here, it's part of the function call
        modelType,
        rotationX: rotX,
        rotationY: rotY,
        width: 600,
        height: 400,
        modelColor,
        backgroundColor: backgroundColorHex,
        ambientLightIntensity,
        directionalLightIntensity,
      };

      // Add initialization script only for the first render of this session
      if (isInitialRender) {
        if (!sessionScripts.has(sessionId)) {
          const script = getThreeDObjectScript(renderOptions);
          sessionScripts.set(sessionId, script);
        }
        renderOptions.initializationScript = sessionScripts.get(sessionId);
      }

      // 1. Render the 3D object using Puppeteer Session Manager
      const imageData = await renderUpdate(sessionId, renderOptions);
      if (!imageData) {
        throw new Error(
          "Puppeteer rendering failed, received empty image data."
        );
      }

      // 2. Props for the Satori component
      const props = {
        interaction: { user: userWithResolvedAvatar, guild: interaction.guild },
        imageData, // Pass the base64 image data from Puppeteer
        title: `3D ${modelType.charAt(0).toUpperCase() + modelType.slice(1)}`,
        locale: locale,
        dominantColor: userAvatarUrl ? "user" : [50, 100, 150],
        returnDominant: false, // We just want the buffer
      };

      const scaling = { image: 2, emoji: 1, debug: false };

      // 3. Generate the final image using Satori
      const imageBuffer = await generateImage(
        "ThreeDObject", // Satori component name
        props,
        scaling,
        i18n
      );

      if (!imageBuffer || imageBuffer.length === 0) {
        throw new Error(
          "Satori image generation failed, received empty buffer."
        );
      }

      // 4. Create the attachment
      const attachment = new AttachmentBuilder(imageBuffer, {
        name: `3d-${modelType}-${interaction.user.id}-${Date.now()}.avif`, // Use PNG now
      });

      return attachment;
    };
    // --- End Helper function ---

    // --- Create Buttons (No changes needed here) ---
    const createButtons = (uniqueId) => {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`rotate_left_${uniqueId}`)
          .setLabel("◀ Left")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`rotate_right_${uniqueId}`)
          .setLabel("Right ▶")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`rotate_up_${uniqueId}`)
          .setLabel("▲ Up")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`rotate_down_${uniqueId}`)
          .setLabel("Down ▼")
          .setStyle(ButtonStyle.Secondary)
      );
    };
    // --- End Create Buttons ---

    const interactionUniqueId = interaction.id; // Use interaction ID for button uniqueness

    try {
      // Initial render - pass isInitialRender = true
      const initialAttachment = await generateSatoriImage(
        currentRotationX,
        currentRotationY,
        true // Mark as initial render
      );

      if (!initialAttachment) {
        throw new Error("Initial render failed.");
      }

      const initialMessage = await interaction.editReply({
        files: [initialAttachment],
        components: [createButtons(interactionUniqueId)],
      });

      // Set up component collector
      const filter = (i) =>
        i.customId.endsWith(`_${interactionUniqueId}`) &&
        i.user.id === interaction.user.id;
      const collector = initialMessage.createMessageComponentCollector({
        filter,
        componentType: ComponentType.Button,
        // Use the session manager's timeout logic, but have a safety stop here too
        idle: INTERACTION_TIMEOUT,
      });

      collector.on("collect", async (buttonInteraction) => {
        try {
          await buttonInteraction.deferUpdate(); // Acknowledge the button press

          const action = buttonInteraction.customId.split("_")[1];

          switch (action) {
            case "left":
              currentRotationY -= ROTATION_STEP;
              break;
            case "right":
              currentRotationY += ROTATION_STEP;
              break;
            case "up":
              currentRotationX -= ROTATION_STEP;
              break;
            case "down":
              currentRotationX += ROTATION_STEP;
              break;
          }

          // Subsequent renders - pass isInitialRender = false (default)
          const updatedAttachment = await generateSatoriImage(
            currentRotationX,
            currentRotationY
          );

          if (updatedAttachment) {
            await interaction.editReply({
              files: [updatedAttachment],
              components: [createButtons(interactionUniqueId)], // Keep buttons active
            });
          } else {
            await buttonInteraction.followUp({
              content: "❌ Failed to update the image.",
              ephemeral: true,
            });
          }
        } catch (collectError) {
          console.error(
            `Session ${sessionId}: Error during button interaction:`,
            collectError
          );
          await buttonInteraction
            .followUp({
              content: "❌ An error occurred while updating.",
              ephemeral: true,
            })
            .catch(console.error);
          // Optionally close the session on error during interaction
          collector.stop("interaction_error");
        }
      });

      collector.on("end", async (collected, reason) => {
        console.log(`Session ${sessionId}: Collector ended. Reason: ${reason}`);
        // Clean up the Puppeteer session
        await closeSession(sessionId);
        // Remove the stored script for this session
        sessionScripts.delete(sessionId);
        // Edit the message to remove or disable buttons
        interaction
          .editReply({
            components: [], // Remove buttons after timeout/error
          })
          .catch(console.error); // Catch error if message was deleted
      });
    } catch (error) {
      console.error(
        `Session ${sessionId}: Error executing /threeobject command:`,
        error
      );
      await closeSession(sessionId); // Ensure cleanup on initial error
      sessionScripts.delete(sessionId); // Clean up script cache
      await interaction
        .editReply({
          content:
            "❌ An error occurred while generating the initial 3D object image.",
          components: [],
          files: [],
        })
        .catch(console.error);
    }
  },
};
