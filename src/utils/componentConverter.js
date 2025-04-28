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
        new TextDisplayBuilder().setContent(`### ${data.author.name}`)
      );
    }

    // Add thumbnail if present
    if (data.thumbnail?.url) {
      section.setThumbnailAccessory(
        new ThumbnailBuilder().setURL(data.thumbnail.url)
      );
    } else if (data.author?.icon_url) {
      // Use author icon as thumbnail if no thumbnail but author has icon
      section.setThumbnailAccessory(
        new ThumbnailBuilder().setURL(data.author.icon_url)
      );
    }

    container.addSectionComponents(section);
  }

  // Add title if present
  if (data.title) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# ${data.title}`)
    );
  }

  // Add description if present
  if (data.description) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(data.description)
    );
  }

  // Add fields if present
  if (data.fields && data.fields.length > 0) {
    // Add separator before fields
    container.addSeparatorComponents(new SeparatorBuilder());

    data.fields.forEach((field, index) => {
      // Add field name as header
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${field.name}`)
      );

      // Add field value
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(field.value)
      );

      // Add separator between fields (except after last field)
      if (index < data.fields.length - 1) {
        container.addSeparatorComponents(new SeparatorBuilder());
      }
    });
  }

  // Add image from embed or options
  if (data.image?.url || options.imageUrl || options.attachmentUrl) {
    const imageUrl =
      data.image?.url || options.imageUrl || options.attachmentUrl;

    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(imageUrl)
      )
    );
  }

  // Add footer and timestamp
  if (data.footer?.text || options.includeTimestamp) {
    // Add separator
    container.addSeparatorComponents(new SeparatorBuilder());

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
        new TextDisplayBuilder().setContent(`${footerText}`)
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
    content,
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
    this.container = new ContainerBuilder();
    this.options = options;
    this.actionRows = [];

    if (options.color) {
      this.setColor(options.color);
    } else if (options.dominantColor) {
      // Support passing dominantColor directly from imageGenerator
      this.setColor(options.dominantColor);
    }
  }

  /**
   * Sets the accent color for the container
   * @param {number|string} color - Hex color as number or string
   * @returns {ComponentBuilder} this builder for chaining
   */
  setColor(color) {
    // Convert color to a usable format
    let formattedColor = this.formatColor(color);
    this.container.setAccentColor(formattedColor);
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
    const section = new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### ${title}`)
    );

    // Only set thumbnail accessory if avatarUrl is provided and not null/undefined
    if (avatarUrl) {
      try {
        section.setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl));
      } catch (error) {
        console.error("Error setting thumbnail in header:", error);
        // Continue without the thumbnail if there's an error
      }
    }

    this.container.addSectionComponents(section);
    return this;
  }

  /**
   * Adds a section with text on left and image on right
   * @param {string} text - The text to display
   * @param {string} imageUrl - URL for the thumbnail image
   * @returns {ComponentBuilder} this builder for chaining
   */
  addTextWithThumbnail(text, imageUrl) {
    const section = new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(text)
    );

    // Only set thumbnail if imageUrl is provided and not null/undefined
    if (imageUrl) {
      try {
        section.setThumbnailAccessory(new ThumbnailBuilder().setURL(imageUrl));
      } catch (error) {
        console.error("Error setting thumbnail in text section:", error);
        // Continue without the thumbnail if there's an error
      }
    }

    this.container.addSectionComponents(section);
    return this;
  }

  /**
   * Adds a simple text display
   * @param {string} text - The text to display
   * @param {string} style - Style to apply ('plain', 'header1', 'header2', 'header3', 'italic', 'bold')
   * @returns {ComponentBuilder} this builder for chaining
   */
  addText(text, style = "plain") {
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
      // plain doesn't need formatting
    }

    this.container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(formattedText)
    );
    return this;
  }

  /**
   * Adds an image or attachment to the container
   * @param {string} url - The URL of the image or attachment reference
   * @returns {ComponentBuilder} this builder for chaining
   */
  addImage(url) {
    this.container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(url)
      )
    );
    return this;
  }

  /**
   * Adds a separator line to the container
   * @returns {ComponentBuilder} this builder for chaining
   */
  addSeparator() {
    this.container.addSeparatorComponents(new SeparatorBuilder());
    return this;
  }

  /**
   * Adds a timestamp to the bottom of the container
   * @param {string} locale - User locale for formatting
   * @param {string} prefix - Optional custom prefix text
   * @returns {ComponentBuilder} this builder for chaining
   */
  addTimestamp(locale, prefix = null) {
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
      new TextDisplayBuilder().setContent(text)
    );
    return this;
  }

  /**
   * Adds a footer text to the container
   * @param {string} text - The footer text
   * @param {boolean} italic - Whether to format as italic
   * @returns {ComponentBuilder} this builder for chaining
   */
  addFooter(text, italic = true) {
    this.container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(italic ? `*${text}*` : text)
    );
    return this;
  }

  /**
   * Add an action row with components to the container
   * @param {ActionRowBuilder} actionRow - The action row to add
   * @returns {ComponentBuilder} this builder for chaining
   */
  addActionRow(actionRow) {
    if (actionRow instanceof ActionRowBuilder) {
      this.container.addActionRowComponents(actionRow);
    } else {
      console.error("Invalid ActionRowBuilder provided to addActionRow");
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
    const actionRow = new ActionRowBuilder().addComponents(...buttons);
    this.container.addActionRowComponents(actionRow);
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
   * @param {Array} options - The options for the select menu
   * @param {Object} settings - Additional settings (min/max values, disabled)
   * @returns {ComponentBuilder} this builder for chaining
   */
  addStringSelectMenu(customId, placeholder, options, settings = {}) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(options);

    if (settings.minValues) menu.setMinValues(settings.minValues);
    if (settings.maxValues) menu.setMaxValues(settings.maxValues);
    if (settings.disabled) menu.setDisabled(true);

    const actionRow = new ActionRowBuilder().addComponents(menu);
    this.container.addActionRowComponents(actionRow);
    return this;
  }

  /**
   * Builds and returns the final container
   * @returns {ContainerBuilder} The built container
   */
  build() {
    return this.container;
  }

  /**
   * Creates a reply object with components and files
   * @param {Object} options - Reply options
   * @param {Array} options.files - Array of files to attach
   * @param {string} options.content - Text content
   * @param {boolean} options.ephemeral - Whether the reply should be ephemeral
   * @returns {Object} Reply options for interaction.reply/editReply
   */
  toReplyOptions({ files, content, ephemeral } = {}) {
    return {
      content,
      components: [this.build()],
      files,
      ephemeral,
      flags: MessageFlags.IsComponentsV2,
    };
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
   * @param {...Object} components - Components to add
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
   * @returns {ActionRowComponentBuilder} this builder for chaining
   */
  addButton(customId, label, style = ButtonStyle.Primary, emoji = null) {
    const button = new ButtonBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setStyle(style);

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
   * Adds a select menu to the action row
   * @param {string} customId - The custom ID for the select menu
   * @param {string} placeholder - The placeholder text
   * @returns {ActionRowComponentBuilder} this builder for chaining
   */
  addStringSelectMenu(customId, placeholder) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder);

    this.actionRow.addComponents(menu);
    return this;
  }

  /**
   * Completes the action row and adds it to the parent container
   * @returns {ComponentBuilder} The parent ComponentBuilder for chaining
   */
  done() {
    this.parentBuilder.addActionRow(this.actionRow);
    return this.parentBuilder;
  }
}

/**
 * Simple function to create a container with a basic layout
 * @param {Object} options - Container options
 * @param {string} options.title - Title to display at the top
 * @param {string} options.imageUrl - URL of the image to display
 * @param {string} options.attachmentUrl - URL reference to an attachment
 * @param {string} options.userAvatarUrl - URL of user's avatar
 * @param {string} options.footerText - Text to show in the footer
 * @param {string} options.locale - User's locale for timestamp formatting
 * @param {boolean} options.includeTimestamp - Whether to include a timestamp
 * @param {number} options.color - Container accent color
 * @returns {ContainerBuilder} A pre-configured container
 */
export function createSimpleContainer(options = {}) {
  const container = new ContainerBuilder();

  if (options.color) {
    container.setAccentColor(options.color);
  }

  // Add title with user avatar
  if (options.title) {
    const section = new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### ${options.title}`)
    );

    if (options.userAvatarUrl) {
      section.setThumbnailAccessory(
        new ThumbnailBuilder().setURL(options.userAvatarUrl)
      );
    }

    container.addSectionComponents(section);
  }

  // Add image
  if (options.imageUrl || options.attachmentUrl) {
    const url = options.attachmentUrl || options.imageUrl;
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(url)
      )
    );
  }

  // Add footer and timestamp
  if (options.footerText || options.includeTimestamp) {
    let footerText = options.footerText || "";

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
    }

    if (footerText) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`*${footerText}*`)
      );
    }
  }

  return container;
}
