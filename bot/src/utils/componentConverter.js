import {
  MessageFlags,
  EmbedBuilder,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  MentionableSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

/**
 * Converts an EmbedBuilder to a ContainerBuilder for Discord's Component v2 system
 * @param {EmbedBuilder} embed - The embed to convert
 * @param {Object} options - Additional options
 * @param {string} options.imageUrl - Optional image URL to include in a media gallery
 * @param {string} options.attachmentUrl - Optional attachment URL reference (like 'attachment://file.png')
 * @param {boolean} options.includeTimestamp - Whether to include a timestamp at the bottom
 * @param {string} options.locale - The user's locale for timestamp formatting
 * @returns {ContainerBuilder} A container builder with the embed content
 */
export function embedToContainer(embed, options = {}) {
  if (!embed) {
    throw new Error("No embed provided to convert");
  }

  const container = new ContainerBuilder();
  const data = embed.data;

  // Set accent color from embed color
  if (data.color) {
    container.setAccentColor(data.color);
  }

  // Add author and thumbnail if present
  if (data.author || data.thumbnail) {
    const section = new SectionBuilder();

    // Add author as text
    if (data.author?.name) {
      section.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### ${data.author.name}`),
      );
    }

    // Add thumbnail if present
    if (data.thumbnail?.url) {
      section.setThumbnailAccessory(
        new ThumbnailBuilder().setURL(data.thumbnail.url),
      );
    } else if (data.author?.icon_url) {
      // Use author icon as thumbnail if no thumbnail but author has icon
      section.setThumbnailAccessory(
        new ThumbnailBuilder().setURL(data.author.icon_url),
      );
    }

    container.addSectionComponents(section);
  }

  // Add title if present
  if (data.title) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# ${data.title}`),
    );
  }

  // Add description if present
  if (data.description) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(data.description),
    );
  }

  // Add fields if present
  if (data.fields && data.fields.length > 0) {
    // Add separator before fields
    //container.addSeparatorComponents(new SeparatorBuilder());

    data.fields.forEach((field, index) => {
      // Add field name as header
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${field.name}`),
      );

      // Add field value
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(field.value),
      );

      // Add separator between fields (except after last field)
      /*if (index < data.fields.length - 1) {
        container.addSeparatorComponents(new SeparatorBuilder());
      }*/
    });
  }

  // Add image from embed or options
  if (data.image?.url || options.imageUrl || options.attachmentUrl) {
    const imageUrl =
      data.image?.url || options.imageUrl || options.attachmentUrl;

    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(imageUrl),
      ),
    );
  }

  // Add footer and timestamp
  if (data.footer?.text || options.includeTimestamp) {
    // Add separator
    //container.addSeparatorComponents(new SeparatorBuilder());

    let footerText = "";

    if (data.footer?.text) {
      footerText += data.footer.text;
    }

    if (options.includeTimestamp) {
      const timestamp = Math.floor(Date.now() / 1000);
      const prefix = options.locale?.startsWith("ru")
        ? "Сегодня, в"
        : options.locale?.startsWith("uk")
          ? "Сьогодні о"
          : "Today at";

      if (footerText) {
        footerText += ` • ${prefix} <t:${timestamp}:t>`;
      } else {
        footerText = `${prefix} <t:${timestamp}:t>`;
      }
    } else if (data.timestamp) {
      // Use timestamp from embed
      const timestamp = Math.floor(new Date(data.timestamp).getTime() / 1000);
      if (footerText) {
        footerText += ` • <t:${timestamp}:f>`;
      } else {
        footerText = `<t:${timestamp}:f>`;
      }
    }

    if (footerText) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`${footerText}`),
      );
    }
  }

  return container;
}

/**
 * Creates a reply object that can be used with interaction.reply() or interaction.editReply()
 * @param {Object} options - Reply options
 * @param {EmbedBuilder|EmbedBuilder[]} options.embeds - Old-style embeds to convert
 * @param {Object} options.files - Files to attach
 * @param {string} options.content - Text content
 * @param {boolean} options.ephemeral - Whether the reply should be ephemeral
 * @param {string} options.imageUrl - URL of an image to include
 * @param {string} options.locale - User's locale for timestamp formatting
 * @param {boolean} options.includeTimestamp - Whether to include a timestamp
 * @returns {Object} Reply options for use with Discord.js interactions
 */
export function createComponentReply(options = {}) {
  const {
    embeds,
    files,
    content,
    ephemeral,
    imageUrl,
    locale,
    includeTimestamp,
  } = options;

  const components = [];

  if (embeds && embeds.length > 0) {
    // Convert each embed to a container
    embeds.forEach((embed) => {
      const container = embedToContainer(embed, {
        imageUrl,
        attachmentUrl:
          files && files.length > 0 ? `attachment://${files[0].name}` : null,
        includeTimestamp,
        locale,
      });
      components.push(container);
    });
  }

  return {
    content, // V2 normally doesn't have content, but this fn might be used generically
    components: components.length > 0 ? components : undefined,
    files,
    ephemeral,
    flags: components.length > 0 ? MessageFlags.IsComponentsV2 : undefined,
  };
}

/**
 * Creates a component builder for customizing container layouts
 * Provides a fluent interface for building complex Discord UI components
 */
export class ComponentBuilder {
  constructor(options = {}) {
    this.options = options;
    this.mode = options.mode || "v2"; // 'v1' or 'v2', default v2

    if (this.mode === "v2") {
      this.container = new ContainerBuilder();
    } else {
      // V1 state
      this.embedData = { fields: [] };
      this.v1ActionRows = [];
    }

    if (options.color) {
      this.setColor(options.color);
    } else if (options.dominantColor) {
      // Support passing dominantColor directly from imageGenerator
      this.setColor(options.dominantColor);
    }
  }

  /**
   * Sets the accent color for the container or embed
   * @param {number|string} color - Hex color as number or string
   * @returns {ComponentBuilder} this builder for chaining
   */
  setColor(color) {
    let formattedColor = this.formatColor(color);
    if (this.mode === "v2") {
      this.container.setAccentColor(formattedColor);
    } else {
      this.embedData.color = formattedColor;
    }
    return this;
  }

  /**
   * Formats a color to ensure it's a valid numeric value for Discord.js
   * @param {any} color - Color in any format (string, number, object with embedColor property)
   * @returns {number} Properly formatted numeric color
   */
  formatColor(color) {
    const defaultColor = 0x0099ff; // Discord blurple

    // If no color provided, return default
    if (color === undefined || color === null) {
      return defaultColor;
    }

    // If color is already a number and valid, use it directly
    if (typeof color === "number" && !isNaN(color)) {
      return color;
    }

    // If it's a hex string, convert to number
    if (typeof color === "string") {
      try {
        // Remove the # if it exists and convert to number
        const parsedColor = parseInt(color.replace("#", ""), 16);
        return isNaN(parsedColor) ? defaultColor : parsedColor;
      } catch (error) {
        console.error("Error parsing color string:", error);
        return defaultColor;
      }
    }

    // If it's an object with embedColor property (from imageGenerator)
    if (typeof color === "object" && color !== null) {
      if (color.embedColor !== undefined) {
        return this.formatColor(color.embedColor); // Recursively format embedColor
      }
    }

    // If all else fails, return default
    return defaultColor;
  }

  /**
   * Adds a header section with optional user avatar
   * @param {string} title - Title text
   * @param {string} avatarUrl - Optional URL for user avatar
   * @returns {ComponentBuilder} this builder for chaining
   */
  addHeader(title, avatarUrl = null) {
    if (this.mode === "v2") {
      const section = new SectionBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### ${title}`),
      );
      if (avatarUrl) {
        try {
          section.setThumbnailAccessory(
            new ThumbnailBuilder().setURL(avatarUrl),
          );
        } catch (error) {
          console.error("Error setting thumbnail in header:", error);
        }
      }
      this.container.addSectionComponents(section);
    } else {
      // V1 - Set embed title and author/thumbnail
      this.embedData.title = title;
      if (avatarUrl) {
        // Use author for avatar in V1 typically
        this.embedData.author = { name: title, icon_url: avatarUrl };
        // Or use thumbnail if more appropriate for layout, adjust title setting
        // this.embedData.thumbnail = { url: avatarUrl };
      } else {
        // If no avatarUrl, just set the title as author name if it wasn't set
        if (!this.embedData.author) {
          this.embedData.author = { name: title };
        }
      }
    }
    return this;
  }

  /**
   * Adds a section with text on left and image on right (V2 only)
   * In V1, adds text to description and sets thumbnail
   * @param {string} text - The text to display
   * @param {string} imageUrl - URL for the thumbnail image
   * @returns {ComponentBuilder} this builder for chaining
   */
  addTextWithThumbnail(text, imageUrl) {
    if (this.mode === "v2") {
      const section = new SectionBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(text),
      );
      if (imageUrl) {
        try {
          section.setThumbnailAccessory(
            new ThumbnailBuilder().setURL(imageUrl),
          );
        } catch (error) {
          console.error("Error setting thumbnail in text section:", error);
        }
      }
      this.container.addSectionComponents(section);
    } else {
      // V1 - Add text to description, set thumbnail
      this.embedData.description =
        (this.embedData.description || "") +
        `
${text}`;
      if (imageUrl) {
        this.embedData.thumbnail = { url: imageUrl };
      }
    }
    return this;
  }

  /**
   * Adds a simple text display
   * @param {string} text - The text to display
   * @param {string} style - Style to apply ('plain', 'header1', 'header2', 'header3', 'italic', 'bold')
   * @returns {ComponentBuilder} this builder for chaining
   */
  addText(text, style = "plain") {
    // Validate text parameter to prevent ValidationError
    if (text === undefined || text === null) {
      console.warn("addText called with undefined/null text, skipping");
      return this;
    }

    if (this.mode === "v2") {
      let formattedText = text;
      switch (style) {
        case "header1":
          formattedText = `# ${text}`;
          break;
        case "header2":
          formattedText = `## ${text}`;
          break;
        case "header3":
          formattedText = `### ${text}`;
          break;
        case "italic":
          formattedText = `*${text}*`;
          break;
        case "bold":
          formattedText = `**${text}**`;
          break;
      }
      this.container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(formattedText),
      );
    } else {
      // V1 - Append to description
      let formattedText = text;
      switch (style) {
        // V1 supports markdown directly in description/fields
        case "header1":
          formattedText = `# ${text}\n`;
          break; // Needs newline?
        case "header2":
          formattedText = `## ${text}\n`;
          break;
        case "header3":
          formattedText = `### ${text}\n`;
          break;
        case "italic":
          formattedText = `*${text}*`;
          break;
        case "bold":
          formattedText = `**${text}**`;
          break;
        // Add line break for 'plain' unless it's the first text added
        default:
          formattedText = (this.embedData.description ? "\n" : "") + text;
          break;
      }
      this.embedData.description =
        (this.embedData.description || "") + formattedText;
      // Alternative: Add as field if needed
      // this.embedData.fields.push({ name: '​', value: formattedText, inline: false });
    }
    return this;
  }

  /**
   * Adds an inline field (V1 only, simulates with text in V2)
   * @param {string} name - Field name
   * @param {string} value - Field value
   * @param {boolean} inline - Whether the field should be inline (default true for V1)
   * @returns {ComponentBuilder} this builder for chaining
   */
  addField(name, value, inline = true) {
    if (this.mode === "v1") {
      this.embedData.fields.push({
        name: name || "​",
        value: value || "​",
        inline,
      });
    } else {
      // V2 simulation: Add name as header, value as text
      this.addText(name, "header3"); // Use a smaller header for field names
      this.addText(value);
      // Note: V2 doesn't have direct inline support like V1 fields
    }
    return this;
  }

  /**
   * Adds an image or attachment to the container/embed
   * @param {string} url - The URL of the image or attachment reference (e.g., 'http://...', 'attachment://file.png')
   * @returns {ComponentBuilder} this builder for chaining
   */
  addImage(url) {
    if (this.mode === "v2") {
      this.container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder().setURL(url),
        ),
      );
    } else {
      // V1 - Set embed image
      this.embedData.image = { url: url };
    }
    return this;
  }

  /**
   * Adds a separator line to the container
   * @returns {ComponentBuilder} this builder for chaining
   */
  addSeparator() {
    if (this.mode === "v2") {
      this.container.addSeparatorComponents(new SeparatorBuilder());
    } else {
      // V1 - Add a field to simulate separator
      // Use a non-breaking space field name/value which is common practice
      this.embedData.fields.push({ name: "​", value: "​", inline: false });
      // Or: this.embedData.fields.push({ name: '━━━━━━━━━━━━━━━', value: '​'});
    }
    return this;
  }

  /**
   * Adds a timestamp to the bottom of the container/embed
   * @param {string} locale - User locale for formatting (used for V2 prefix only)
   * @param {string} prefix - Optional custom prefix text (used for V2 only)
   * @returns {ComponentBuilder} this builder for chaining
   */
  addTimestamp(locale, prefix = null) {
    if (this.mode === "v2") {
      const timestamp = Math.floor(Date.now() / 1000);
      let defaultPrefix;
      if (locale?.startsWith("ru")) {
        defaultPrefix = "Сегодня, в";
      } else if (locale?.startsWith("uk")) {
        defaultPrefix = "Сьогодні о";
      } else {
        defaultPrefix = "Today at";
      }
      const text = `${prefix || defaultPrefix} <t:${timestamp}:t>`;
      this.container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(text),
      );
    } else {
      // V1 - Set embed timestamp
      this.embedData.timestamp = new Date().toISOString();
      // V1 timestamp is handled directly by Discord, no prefix needed in footer text
      // If a custom prefix *was* provided, add it to the footer
      if (prefix) {
        // Add prefix to footer, create footer if needed
        if (!this.embedData.footer) this.embedData.footer = { text: "" };
        this.embedData.footer.text =
          (this.embedData.footer.text
            ? this.embedData.footer.text + " • "
            : "") + prefix;
      }
    }
    return this;
  }

  /**
   * Adds a footer text to the container/embed
   * @param {string} text - The footer text
   * @param {string} iconURL - Optional icon URL for the footer (V1 only)
   * @returns {ComponentBuilder} this builder for chaining
   */
  addFooter(text, iconURL = null) {
    if (this.mode === "v2") {
      // V2 doesn't have icon URLs for footers, just text
      this.container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(text), // Typically small/italic *${text}*?
      );
    } else {
      // V1 - Add to embed footer
      this.embedData.footer = { text: text };
      if (iconURL) {
        this.embedData.footer.icon_url = iconURL;
      }
    }
    return this;
  }

  /**
   * Add an action row with components to the container or V1 list
   * @param {ActionRowBuilder} actionRow - The action row to add
   * @returns {ComponentBuilder} this builder for chaining
   */
  addActionRow(actionRow) {
    if (!(actionRow instanceof ActionRowBuilder)) {
      console.error("Invalid ActionRowBuilder provided to addActionRow");
      return this;
    }
    if (this.mode === "v2") {
      this.container.addActionRowComponents(actionRow);
    } else {
      // V1 - Add to V1 action row list
      this.v1ActionRows.push(actionRow);
    }
    return this;
  }

  /**
   * Start creating a new action row and return a builder for it
   * This allows you to chain component additions to the action row
   * @returns {ActionRowComponentBuilder} A builder for the action row
   */
  createActionRow() {
    const rowBuilder = new ActionRowComponentBuilder(this);
    return rowBuilder;
  }

  /**
   * Creates and adds an ActionRow with buttons
   * @param {...ButtonBuilder} buttons - The buttons to add to the action row
   * @returns {ComponentBuilder} this builder for chaining
   */
  addButtons(...buttons) {
    const validButtons = buttons.filter((b) => b instanceof ButtonBuilder);
    if (validButtons.length === 0) {
      console.error("No valid ButtonBuilders provided to addButtons");
      return this;
    }
    const actionRow = new ActionRowBuilder().addComponents(...validButtons);
    this.addActionRow(actionRow);
    return this;
  }

  /**
   * Creates and adds a primary (blue) button
   * @param {string} customId - The custom ID for the button
   * @param {string} label - The label to display on the button
   * @param {string} emoji - Optional emoji to display on the button
   * @returns {ComponentBuilder} this builder for chaining
   */
  addPrimaryButton(customId, label, emoji = null) {
    const button = new ButtonBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setStyle(ButtonStyle.Primary);

    if (emoji) {
      button.setEmoji(emoji);
    }

    return this.addButtons(button);
  }

  /**
   * Creates and adds a secondary (grey) button
   * @param {string} customId - The custom ID for the button
   * @param {string} label - The label to display on the button
   * @param {string} emoji - Optional emoji to display on the button
   * @returns {ComponentBuilder} this builder for chaining
   */
  addSecondaryButton(customId, label, emoji = null) {
    const button = new ButtonBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setStyle(ButtonStyle.Secondary);

    if (emoji) {
      button.setEmoji(emoji);
    }

    return this.addButtons(button);
  }

  /**
   * Creates and adds a success (green) button
   * @param {string} customId - The custom ID for the button
   * @param {string} label - The label to display on the button
   * @param {string} emoji - Optional emoji to display on the button
   * @returns {ComponentBuilder} this builder for chaining
   */
  addSuccessButton(customId, label, emoji = null) {
    const button = new ButtonBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setStyle(ButtonStyle.Success);

    if (emoji) {
      button.setEmoji(emoji);
    }

    return this.addButtons(button);
  }

  /**
   * Creates and adds a danger (red) button
   * @param {string} customId - The custom ID for the button
   * @param {string} label - The label to display on the button
   * @param {string} emoji - Optional emoji to display on the button
   * @returns {ComponentBuilder} this builder for chaining
   */
  addDangerButton(customId, label, emoji = null) {
    const button = new ButtonBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setStyle(ButtonStyle.Danger);

    if (emoji) {
      button.setEmoji(emoji);
    }

    return this.addButtons(button);
  }

  /**
   * Creates and adds a link button
   * @param {string} url - The URL to open when the button is clicked
   * @param {string} label - The label to display on the button
   * @param {string} emoji - Optional emoji to display on the button
   * @returns {ComponentBuilder} this builder for chaining
   */
  addLinkButton(url, label, emoji = null) {
    const button = new ButtonBuilder()
      .setURL(url)
      .setLabel(label)
      .setStyle(ButtonStyle.Link);

    if (emoji) {
      button.setEmoji(emoji);
    }

    return this.addButtons(button);
  }

  /**
   * Adds a string select menu to the container in a new action row
   * @param {string} customId - The custom ID for the select menu
   * @param {string} placeholder - The placeholder text for the select menu
   * @param {Array<import('discord.js').APISelectMenuOption>} options - The options for the select menu (label, value, description?, emoji?, default?)
   * @param {Object} settings - Additional settings (minValues, maxValues, disabled)
   * @returns {ComponentBuilder} this builder for chaining
   */
  addStringSelectMenu(customId, placeholder, options, settings = {}) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(options); // options should be { label, value, ... }

    if (settings.minValues) menu.setMinValues(settings.minValues);
    if (settings.maxValues) menu.setMaxValues(settings.maxValues);
    if (settings.disabled !== undefined) menu.setDisabled(settings.disabled); // Check for undefined explicitly

    const actionRow = new ActionRowBuilder().addComponents(menu);
    this.addActionRow(actionRow);
    return this;
  }

  /**
   * Builds and returns the final container (V2) or V1 data structure.
   * DEPRECATED: Use toReplyOptions() for clarity.
   * @returns {ContainerBuilder|Object} The built container (V2) or V1 data { embeds: [embedJson], components: [actionRowJson] }
   */
  build() {
    console.warn(
      "`ComponentBuilder.build()` is ambiguous with V1/V2 modes. Use `toReplyOptions()`.",
    );
    if (this.mode === "v2") {
      return this.container;
    } else {
      // Return V1 structure (or just the internal data?)
      return {
        embeds:
          this.embedData.fields.length > 0 ||
          this.embedData.description ||
          this.embedData.title
            ? [new EmbedBuilder(this.embedData).toJSON()]
            : [], // Return raw embed data only if embed has content
        components: this.v1ActionRows.map((row) => row.toJSON()), // Return raw action row data
      };
    }
  }

  /**
   * Creates a reply object suitable for interaction.reply/editReply or message.reply/edit
   * @param {Object} options - Reply options
   * @param {Array} options.files - Array of files to attach
   * @param {string} options.content - Text content (mainly for V1, V2 usually doesn't have top-level content)
   * @param {boolean} options.ephemeral - Whether the reply should be ephemeral
   * @returns {Object} Reply options object
   */
  toReplyOptions({ files, content, ephemeral } = {}) {
    if (this.mode === "v2") {
      // CORRECT V2 Structure: The top-level components array should only contain the ContainerBuilder.
      // ActionRows are added *inside* the container via addActionRowComponents.
      const finalComponents =
        this.container.components.length > 0 ? [this.container] : undefined;

      return {
        content: content || undefined, // Allow content for V2, though uncommon at top level
        components: finalComponents, // Send only the container(s)
        files,
        ephemeral,
        // Set V2 flag if a ContainerBuilder is actually present in the final payload
        flags:
          finalComponents &&
          finalComponents.some((c) => c instanceof ContainerBuilder)
            ? MessageFlags.IsComponentsV2
            : undefined,
        // Make sure attachments are cleared for edits if files are not provided again
        attachments: files ? undefined : [],
      };
    } else {
      // V1 structure
      const finalEmbeds =
        this.embedData &&
        (this.embedData.fields.length > 0 ||
          this.embedData.description ||
          this.embedData.title ||
          this.embedData.author ||
          this.embedData.image ||
          this.embedData.thumbnail ||
          this.embedData.footer ||
          this.embedData.timestamp)
          ? [new EmbedBuilder(this.embedData)]
          : [];

      return {
        content,
        embeds: finalEmbeds, // Build embed from data only if it has content
        components:
          this.v1ActionRows.length > 0 ? this.v1ActionRows : undefined, // Pass V1 action rows only if present
        files,
        ephemeral,
        // No flags for V1
        // Make sure attachments are cleared for edits if files are not provided again
        attachments: files ? undefined : [],
      };
    }
  }
}

/**
 * Helper class for building action rows with components
 */
class ActionRowComponentBuilder {
  constructor(parentBuilder) {
    this.parentBuilder = parentBuilder;
    this.actionRow = new ActionRowBuilder();
  }

  /**
   * Adds components to the action row
   * @param {...(ButtonBuilder|StringSelectMenuBuilder|UserSelectMenuBuilder|RoleSelectMenuBuilder|ChannelSelectMenuBuilder|MentionableSelectMenuBuilder)} components - Components to add
   * @returns {ActionRowComponentBuilder} this builder for chaining
   */
  addComponents(...components) {
    this.actionRow.addComponents(...components);
    return this;
  }

  /**
   * Adds a button to the action row
   * @param {string} customId - The custom ID for the button
   * @param {string} label - The label for the button
   * @param {ButtonStyle} style - The style for the button
   * @param {string} emoji - Optional emoji for the button
   * @param {boolean} disabled - Optional disabled state
   * @returns {ActionRowComponentBuilder} this builder for chaining
   */
  addButton(
    customId,
    label,
    style = ButtonStyle.Primary,
    emoji = null,
    disabled = false,
  ) {
    const button = new ButtonBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setStyle(style)
      .setDisabled(disabled);

    if (emoji) {
      button.setEmoji(emoji);
    }

    this.actionRow.addComponents(button);
    return this;
  }

  /**
   * Adds a link button to the action row
   * @param {string} url - The URL to open
   * @param {string} label - The label for the button
   * @param {string} emoji - Optional emoji for the button
   * @returns {ActionRowComponentBuilder} this builder for chaining
   */
  addLinkButton(url, label, emoji = null) {
    const button = new ButtonBuilder()
      .setURL(url)
      .setLabel(label)
      .setStyle(ButtonStyle.Link);

    if (emoji) {
      button.setEmoji(emoji);
    }

    this.actionRow.addComponents(button);
    return this;
  }

  /**
   * Adds a string select menu to the action row
   * @param {string} customId - The custom ID for the select menu
   * @param {string} placeholder - The placeholder text
   * @param {Array<import('discord.js').APISelectMenuOption>} options - The options for the select menu
   * @param {Object} settings - Additional settings (minValues, maxValues, disabled)
   * @returns {ActionRowComponentBuilder} this builder for chaining
   */
  addStringSelectMenu(customId, placeholder, options, settings = {}) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(options);

    if (settings.minValues) menu.setMinValues(settings.minValues);
    if (settings.maxValues) menu.setMaxValues(settings.maxValues);
    if (settings.disabled !== undefined) menu.setDisabled(settings.disabled);

    this.actionRow.addComponents(menu);
    return this;
  }

  /**
   * Adds a user select menu to the action row.
   * @param {string} customId - The custom ID for the select menu.
   * @param {string} placeholder - The placeholder text to display when nothing is selected.
   * @param {Object} [settings] - Optional settings.
   * @param {number} [settings.minValues] - The minimum number of values that must be selected.
   * @param {number} [settings.maxValues] - The maximum number of values that can be selected.
   * @param {boolean} [settings.disabled] - Whether the select menu is disabled.
   * @returns {ActionRowComponentBuilder} This builder for chaining.
   */
  addUserSelectMenu(customId, placeholder, settings = {}) {
    const menu = new UserSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder);

    if (settings.minValues) menu.setMinValues(settings.minValues);
    if (settings.maxValues) menu.setMaxValues(settings.maxValues);
    if (settings.disabled !== undefined) menu.setDisabled(settings.disabled);

    this.actionRow.addComponents(menu);
    return this;
  }

  /**
   * Adds a role select menu to the action row.
   * @param {string} customId - The custom ID for the select menu.
   * @param {string} placeholder - The placeholder text to display when nothing is selected.
   * @param {Object} [settings] - Optional settings.
   * @param {number} [settings.minValues] - The minimum number of values that must be selected.
   * @param {number} [settings.maxValues] - The maximum number of values that can be selected.
   * @param {boolean} [settings.disabled] - Whether the select menu is disabled.
   * @returns {ActionRowComponentBuilder} This builder for chaining.
   */
  addRoleSelectMenu(customId, placeholder, settings = {}) {
    const menu = new RoleSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder);

    if (settings.minValues) menu.setMinValues(settings.minValues);
    if (settings.maxValues) menu.setMaxValues(settings.maxValues);
    if (settings.disabled !== undefined) menu.setDisabled(settings.disabled);

    this.actionRow.addComponents(menu);
    return this;
  }

  /**
   * Adds a channel select menu to the action row.
   * @param {string} customId - The custom ID for the select menu.
   * @param {string} placeholder - The placeholder text to display when nothing is selected.
   * @param {import('discord.js').ChannelType[]} [channelTypes] - The channel types to filter by.
   * @param {Object} [settings] - Optional settings.
   * @param {number} [settings.minValues] - The minimum number of values that must be selected.
   * @param {number} [settings.maxValues] - The maximum number of values that can be selected.
   * @param {boolean} [settings.disabled] - Whether the select menu is disabled.
   * @returns {ActionRowComponentBuilder} This builder for chaining.
   */
  addChannelSelectMenu(customId, placeholder, channelTypes, settings = {}) {
    const menu = new ChannelSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder);

    if (channelTypes) menu.setChannelTypes(channelTypes);
    if (settings.minValues) menu.setMinValues(settings.minValues);
    if (settings.maxValues) menu.setMaxValues(settings.maxValues);
    if (settings.disabled !== undefined) menu.setDisabled(settings.disabled);

    this.actionRow.addComponents(menu);
    return this;
  }

  /**
   * Adds a mentionable (user or role) select menu to the action row.
   * @param {string} customId - The custom ID for the select menu.
   * @param {string} placeholder - The placeholder text to display when nothing is selected.
   * @param {Object} [settings] - Optional settings.
   * @param {number} [settings.minValues] - The minimum number of values that must be selected.
   * @param {number} [settings.maxValues] - The maximum number of values that can be selected.
   * @param {boolean} [settings.disabled] - Whether the select menu is disabled.
   * @returns {ActionRowComponentBuilder} This builder for chaining.
   */
  addMentionableSelectMenu(customId, placeholder, settings = {}) {
    const menu = new MentionableSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder);

    if (settings.minValues) menu.setMinValues(settings.minValues);
    if (settings.maxValues) menu.setMaxValues(settings.maxValues);
    if (settings.disabled !== undefined) menu.setDisabled(settings.disabled);

    this.actionRow.addComponents(menu);
    return this;
  }

  /**
   * Completes the action row and adds it to the parent container/builder
   * @returns {ComponentBuilder} The parent ComponentBuilder for chaining
   */
  done() {
    this.parentBuilder.addActionRow(this.actionRow);
    return this.parentBuilder;
  }
}

/**
 * Simple function to create a container with a basic layout (V2 Only)
 * @param {Object} options - Container options
 * @param {string} options.title - Title to display at the top
 * @param {string} options.imageUrl - URL of the image to display
 * @param {string} options.attachmentUrl - URL reference to an attachment (e.g., 'attachment://file.png')
 * @param {string} options.userAvatarUrl - URL of user's avatar for thumbnail
 * @param {string} options.description - Optional description text
 * @param {string} options.footerText - Text to show in the footer
 * @param {string} options.locale - User's locale for timestamp formatting
 * @param {boolean} options.includeTimestamp - Whether to include a timestamp
 * @param {number|string} options.color - Container accent color
 * @returns {ContainerBuilder} A pre-configured container
 */
export function createSimpleContainer(options = {}) {
  const builder = new ComponentBuilder({ mode: "v2", color: options.color });

  if (options.title || options.userAvatarUrl) {
    builder.addHeader(options.title || "", options.userAvatarUrl);
  }

  if (options.description) {
    builder.addText(options.description);
  }

  if (options.imageUrl || options.attachmentUrl) {
    builder.addImage(options.attachmentUrl || options.imageUrl);
  }

  if (options.footerText || options.includeTimestamp) {
    let combinedFooter = options.footerText || "";
    if (options.includeTimestamp) {
      const timestamp = Math.floor(Date.now() / 1000);
      const prefix = options.locale?.startsWith("ru")
        ? "Сегодня, в"
        : options.locale?.startsWith("uk")
          ? "Сьогодні о"
          : "Today at";
      const timestampText = `${prefix} <t:${timestamp}:t>`;
      combinedFooter = combinedFooter
        ? `${combinedFooter} • ${timestampText}`
        : timestampText;
    }
    if (combinedFooter) {
      builder.addFooter(combinedFooter); // Using addFooter for consistency, V2 timestamp is handled inside
    }
  }

  // Return the built container directly from the internal state
  return builder.container;
}

/**
 * Simple function to create an embed with a basic layout (V1 Only)
 * @param {Object} options - Embed options
 * @param {string} options.title - Title to display at the top
 * @param {string} options.imageUrl - URL of the image to display
 * @param {string} options.attachmentUrl - URL reference to an attachment (e.g., 'attachment://file.png')
 * @param {string} options.userAvatarUrl - URL of user's avatar for author icon
 * @param {string} options.description - Optional description text
 * @param {string} options.footerText - Text to show in the footer
 * @param {string} options.footerIconUrl - Optional icon URL for the footer
 * @param {boolean} options.includeTimestamp - Whether to include a timestamp
 * @param {number|string} options.color - Embed color
 * @returns {EmbedBuilder} A pre-configured embed builder
 */
export function createSimpleEmbed(options = {}) {
  const builder = new ComponentBuilder({ mode: "v1", color: options.color });

  if (options.title || options.userAvatarUrl) {
    builder.addHeader(options.title || "", options.userAvatarUrl); // Uses author in V1
  }

  if (options.description) {
    builder.addText(options.description);
  }

  if (options.imageUrl || options.attachmentUrl) {
    builder.addImage(options.attachmentUrl || options.imageUrl);
  }

  if (options.footerText || options.includeTimestamp || options.footerIconUrl) {
    builder.addFooter(options.footerText || "", options.footerIconUrl);
    if (options.includeTimestamp) {
      builder.addTimestamp(); // Adds timestamp to embedData
    }
  }

  // Return an EmbedBuilder instance from the generated data
  return new EmbedBuilder(builder.embedData);
}
