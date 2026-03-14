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
} from "discord.js";

type BuilderMode = "v1" | "v2";
type ColorLike = number | string | { embedColor?: unknown } | null | undefined;
type SelectOption = { label: string; value: string; description?: string; emoji?: string; default?: boolean };
type MenuSettings = { minValues?: number; maxValues?: number; disabled?: boolean };
type ReplyFiles = Array<{ name?: string } | unknown>;
type EmbedField = { name: string; value: string; inline?: boolean };
type EmbedDataShape = Record<string, any> & { fields: EmbedField[] };
type EmbedToContainerOptions = { imageUrl?: string | null; attachmentUrl?: string | null; includeTimestamp?: boolean; locale?: string };
type ComponentReplyOptions = { embeds?: EmbedBuilder[]; files?: ReplyFiles; content?: string; ephemeral?: boolean; imageUrl?: string; locale?: string; includeTimestamp?: boolean };
type ComponentBuilderOptions = { mode?: BuilderMode; color?: ColorLike; dominantColor?: ColorLike };
type SimpleLayoutOptions = { title?: string; imageUrl?: string; attachmentUrl?: string; userAvatarUrl?: string; description?: string; footerText?: string; footerIconUrl?: string; locale?: string; includeTimestamp?: boolean; color?: ColorLike };

function getTimestampPrefix(locale?: string): string {
  if (locale?.startsWith("ru")) return "Сегодня, в";
  if (locale?.startsWith("uk")) return "Сьогодні о";
  return "Today at";
}

function embedToContainer(embed: EmbedBuilder, options: EmbedToContainerOptions = {}): ContainerBuilder {
  if (!embed) throw new Error("No embed provided to convert");
  const container = new ContainerBuilder();
  const data = (embed as unknown as { data: any }).data;
  if (data.color) container.setAccentColor(data.color);
  if (data.author || data.thumbnail) {
    const section = new SectionBuilder();
    if (data.author?.name) section.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${data.author.name}`));
    if (data.thumbnail?.url) section.setThumbnailAccessory(new ThumbnailBuilder().setURL(data.thumbnail.url));
    else if (data.author?.icon_url) section.setThumbnailAccessory(new ThumbnailBuilder().setURL(data.author.icon_url));
    container.addSectionComponents(section);
  }
  if (data.title) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${data.title}`));
  if (data.description) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(data.description));
  if (data.fields?.length) {
    data.fields.forEach((field: EmbedField) => {
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${field.name}`));
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(field.value));
    });
  }
  const imageUrl = data.image?.url || options.imageUrl || options.attachmentUrl;
  if (imageUrl) container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(imageUrl)));
  if (data.footer?.text || options.includeTimestamp || data.timestamp) {
    let footerText = data.footer?.text || "";
    if (options.includeTimestamp) {
      const timestamp = Math.floor(Date.now() / 1000);
      footerText = footerText ? `${footerText} • ${getTimestampPrefix(options.locale)} <t:${timestamp}:t>` : `${getTimestampPrefix(options.locale)} <t:${timestamp}:t>`;
    } else if (data.timestamp) {
      const timestamp = Math.floor(new Date(data.timestamp).getTime() / 1000);
      footerText = footerText ? `${footerText} • <t:${timestamp}:f>` : `<t:${timestamp}:f>`;
    }
    if (footerText) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(footerText));
  }
  return container;
}

function createComponentReply(options: ComponentReplyOptions = {}) {
  const { embeds, files, content, ephemeral, imageUrl, locale, includeTimestamp } = options;
  const components: ContainerBuilder[] = [];
  if (embeds?.length) {
    embeds.forEach((embed) => {
      components.push(embedToContainer(embed, { imageUrl, attachmentUrl: files && files.length > 0 ? `attachment://${(files[0] as { name?: string }).name}` : null, includeTimestamp, locale }));
    });
  }
  return { content, components: components.length > 0 ? components : undefined, files, ephemeral, flags: components.length > 0 ? MessageFlags.IsComponentsV2 : undefined };
}

class ComponentBuilder {
  options: ComponentBuilderOptions;
  mode: BuilderMode;
  container: ContainerBuilder;
  embedData: EmbedDataShape;
  v1ActionRows: ActionRowBuilder<any>[];

  constructor(options: ComponentBuilderOptions = {}) {
    this.options = options;
    this.mode = options.mode || "v2";
    this.container = new ContainerBuilder();
    this.embedData = { fields: [] };
    this.v1ActionRows = [];
    if (options.color) this.setColor(options.color); else if (options.dominantColor) this.setColor(options.dominantColor);
  }

  setColor(color: ColorLike): this {
    const formattedColor = this.formatColor(color);
    if (this.mode === "v2") this.container.setAccentColor(formattedColor); else this.embedData.color = formattedColor;
    return this;
  }

  formatColor(color: ColorLike): number {
    const defaultColor = 0x0099ff;
    if (color === undefined || color === null) return defaultColor;
    if (typeof color === "number" && !Number.isNaN(color)) return color;
    if (typeof color === "string") {
      try {
        const parsedColor = parseInt(color.replace("#", ""), 16);
        return Number.isNaN(parsedColor) ? defaultColor : parsedColor;
      } catch {
        return defaultColor;
      }
    }
    if (typeof color === "object" && color !== null && "embedColor" in color) return this.formatColor(color.embedColor as ColorLike);
    return defaultColor;
  }

  addHeader(title: string, avatarUrl: string | null = null): this {
    if (this.mode === "v2") {
      const section = new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${title}`));
      if (avatarUrl) {
        try { section.setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl)); } catch (error) { console.error("Error setting thumbnail in header:", error); }
      }
      this.container.addSectionComponents(section);
    } else {
      this.embedData.title = title;
      this.embedData.author = avatarUrl ? { name: title, icon_url: avatarUrl } : this.embedData.author || { name: title };
    }
    return this;
  }

  addTextWithThumbnail(text: string, imageUrl: string): this {
    if (this.mode === "v2") {
      const section = new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
      if (imageUrl) {
        try { section.setThumbnailAccessory(new ThumbnailBuilder().setURL(imageUrl)); } catch (error) { console.error("Error setting thumbnail in text section:", error); }
      }
      this.container.addSectionComponents(section);
    } else {
      this.embedData.description = `${this.embedData.description || ""}\n${text}`;
      if (imageUrl) this.embedData.thumbnail = { url: imageUrl };
    }
    return this;
  }

  addText(text: string | null | undefined, style = "plain"): this {
    if (text === undefined || text === null) return this;
    const format = (value: string) => style === "header1" ? `# ${value}` : style === "header2" ? `## ${value}` : style === "header3" ? `### ${value}` : style === "italic" ? `*${value}*` : style === "bold" ? `**${value}**` : value;
    const formatted = format(text);
    if (this.mode === "v2") this.container.addTextDisplayComponents(new TextDisplayBuilder().setContent(formatted));
    else this.embedData.description = `${this.embedData.description || ""}${style === "plain" && this.embedData.description ? "\n" : ""}${formatted}${style.startsWith("header") ? "\n" : ""}`;
    return this;
  }

  addField(name: string, value: string, inline = true): this {
    if (this.mode === "v1") this.embedData.fields.push({ name: name || "​", value: value || "​", inline });
    else { this.addText(name, "header3"); this.addText(value); }
    return this;
  }

  addImage(url: string): this {
    if (this.mode === "v2") this.container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(url)));
    else this.embedData.image = { url };
    return this;
  }

  addSeparator(): this {
    if (this.mode === "v2") this.container.addSeparatorComponents(new SeparatorBuilder());
    else this.embedData.fields.push({ name: "​", value: "​", inline: false });
    return this;
  }

  addTimestamp(locale?: string, prefix: string | null = null): this {
    if (this.mode === "v2") this.container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${prefix || getTimestampPrefix(locale)} <t:${Math.floor(Date.now() / 1000)}:t>`));
    else { this.embedData.timestamp = new Date().toISOString(); if (prefix) this.embedData.footer = { ...(this.embedData.footer || {}), text: this.embedData.footer?.text ? `${this.embedData.footer.text} • ${prefix}` : prefix }; }
    return this;
  }

  addFooter(text: string, iconURL: string | null = null): this {
    if (this.mode === "v2") this.container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
    else this.embedData.footer = iconURL ? { text, icon_url: iconURL } : { text };
    return this;
  }

  addActionRow(actionRow: ActionRowBuilder<any>): this {
    if (!(actionRow instanceof ActionRowBuilder)) return this;
    if (this.mode === "v2") this.container.addActionRowComponents(actionRow); else this.v1ActionRows.push(actionRow);
    return this;
  }

  createActionRow(): ActionRowComponentBuilder { return new ActionRowComponentBuilder(this); }
  addButtons(...buttons: ButtonBuilder[]): this { const valid = buttons.filter((button) => button instanceof ButtonBuilder); if (valid.length) this.addActionRow(new ActionRowBuilder<any>().addComponents(...valid)); return this; }
  addPrimaryButton(customId: string, label: string, emoji: string | null = null): this { const button = new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(ButtonStyle.Primary); if (emoji) button.setEmoji(emoji); return this.addButtons(button); }
  addSecondaryButton(customId: string, label: string, emoji: string | null = null): this { const button = new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(ButtonStyle.Secondary); if (emoji) button.setEmoji(emoji); return this.addButtons(button); }
  addSuccessButton(customId: string, label: string, emoji: string | null = null): this { const button = new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(ButtonStyle.Success); if (emoji) button.setEmoji(emoji); return this.addButtons(button); }
  addDangerButton(customId: string, label: string, emoji: string | null = null): this { const button = new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(ButtonStyle.Danger); if (emoji) button.setEmoji(emoji); return this.addButtons(button); }
  addLinkButton(url: string, label: string, emoji: string | null = null): this { const button = new ButtonBuilder().setURL(url).setLabel(label).setStyle(ButtonStyle.Link); if (emoji) button.setEmoji(emoji); return this.addButtons(button); }

  addStringSelectMenu(customId: string, placeholder: string, options: SelectOption[], settings: MenuSettings = {}): this {
    const menu = new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).addOptions(options);
    if (settings.minValues) menu.setMinValues(settings.minValues); if (settings.maxValues) menu.setMaxValues(settings.maxValues); if (settings.disabled !== undefined) menu.setDisabled(settings.disabled);
    return this.addActionRow(new ActionRowBuilder<any>().addComponents(menu));
  }

  build() {
    console.warn("`ComponentBuilder.build()` is ambiguous with V1/V2 modes. Use `toReplyOptions()`.");
    if (this.mode === "v2") return this.container;
    return { embeds: this.embedData.fields.length > 0 || this.embedData.description || this.embedData.title ? [new EmbedBuilder(this.embedData).toJSON()] : [], components: this.v1ActionRows.map((row) => row.toJSON()) };
  }

  toReplyOptions({ files, content, ephemeral }: { files?: ReplyFiles; content?: string; ephemeral?: boolean } = {}) {
    if (this.mode === "v2") {
      const components = ((this.container as unknown as { components?: unknown[] }).components || []).length > 0 ? [this.container] : undefined;
      return { content: content || undefined, components, files, ephemeral, flags: components?.some((component) => component instanceof ContainerBuilder) ? MessageFlags.IsComponentsV2 : undefined, attachments: files ? undefined : [] };
    }
    const embeds = this.embedData && (this.embedData.fields.length > 0 || this.embedData.description || this.embedData.title || this.embedData.author || this.embedData.image || this.embedData.thumbnail || this.embedData.footer || this.embedData.timestamp) ? [new EmbedBuilder(this.embedData)] : [];
    return { content, embeds, components: this.v1ActionRows.length > 0 ? this.v1ActionRows : undefined, files, ephemeral, attachments: files ? undefined : [] };
  }
}

class ActionRowComponentBuilder {
  parentBuilder: ComponentBuilder;
  actionRow: ActionRowBuilder<any>;

  constructor(parentBuilder: ComponentBuilder) { this.parentBuilder = parentBuilder; this.actionRow = new ActionRowBuilder<any>(); }
  addComponents(...components: any[]): this { this.actionRow.addComponents(...components); return this; }
  addButton(customId: string, label: string, style: ButtonStyle = ButtonStyle.Primary, emoji: string | null = null, disabled = false): this { const button = new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style).setDisabled(disabled); if (emoji) button.setEmoji(emoji); this.actionRow.addComponents(button); return this; }
  addLinkButton(url: string, label: string, emoji: string | null = null): this { const button = new ButtonBuilder().setURL(url).setLabel(label).setStyle(ButtonStyle.Link); if (emoji) button.setEmoji(emoji); this.actionRow.addComponents(button); return this; }
  addStringSelectMenu(customId: string, placeholder: string, options: SelectOption[], settings: MenuSettings = {}): this { const menu = new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).addOptions(options); if (settings.minValues) menu.setMinValues(settings.minValues); if (settings.maxValues) menu.setMaxValues(settings.maxValues); if (settings.disabled !== undefined) menu.setDisabled(settings.disabled); this.actionRow.addComponents(menu); return this; }
  addUserSelectMenu(customId: string, placeholder: string, settings: MenuSettings = {}): this { const menu = new UserSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder); if (settings.minValues) menu.setMinValues(settings.minValues); if (settings.maxValues) menu.setMaxValues(settings.maxValues); if (settings.disabled !== undefined) menu.setDisabled(settings.disabled); this.actionRow.addComponents(menu); return this; }
  addRoleSelectMenu(customId: string, placeholder: string, settings: MenuSettings = {}): this { const menu = new RoleSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder); if (settings.minValues) menu.setMinValues(settings.minValues); if (settings.maxValues) menu.setMaxValues(settings.maxValues); if (settings.disabled !== undefined) menu.setDisabled(settings.disabled); this.actionRow.addComponents(menu); return this; }
  addChannelSelectMenu(customId: string, placeholder: string, channelTypes?: number[], settings: MenuSettings = {}): this { const menu = new ChannelSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder); if (channelTypes) menu.setChannelTypes(channelTypes as any); if (settings.minValues) menu.setMinValues(settings.minValues); if (settings.maxValues) menu.setMaxValues(settings.maxValues); if (settings.disabled !== undefined) menu.setDisabled(settings.disabled); this.actionRow.addComponents(menu); return this; }
  addMentionableSelectMenu(customId: string, placeholder: string, settings: MenuSettings = {}): this { const menu = new MentionableSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder); if (settings.minValues) menu.setMinValues(settings.minValues); if (settings.maxValues) menu.setMaxValues(settings.maxValues); if (settings.disabled !== undefined) menu.setDisabled(settings.disabled); this.actionRow.addComponents(menu); return this; }
  done(): ComponentBuilder { this.parentBuilder.addActionRow(this.actionRow); return this.parentBuilder; }
}

function createSimpleContainer(options: SimpleLayoutOptions = {}): ContainerBuilder {
  const builder = new ComponentBuilder({ mode: "v2", color: options.color });
  if (options.title || options.userAvatarUrl) builder.addHeader(options.title || "", options.userAvatarUrl || null);
  if (options.description) builder.addText(options.description);
  if (options.imageUrl || options.attachmentUrl) builder.addImage(options.attachmentUrl || options.imageUrl || "");
  if (options.footerText || options.includeTimestamp) {
    let footer = options.footerText || "";
    if (options.includeTimestamp) {
      const timestampText = `${getTimestampPrefix(options.locale)} <t:${Math.floor(Date.now() / 1000)}:t>`;
      footer = footer ? `${footer} • ${timestampText}` : timestampText;
    }
    if (footer) builder.addFooter(footer);
  }
  return builder.container;
}

function createSimpleEmbed(options: SimpleLayoutOptions = {}): EmbedBuilder {
  const builder = new ComponentBuilder({ mode: "v1", color: options.color });
  if (options.title || options.userAvatarUrl) builder.addHeader(options.title || "", options.userAvatarUrl || null);
  if (options.description) builder.addText(options.description);
  if (options.imageUrl || options.attachmentUrl) builder.addImage(options.attachmentUrl || options.imageUrl || "");
  if (options.footerText || options.includeTimestamp || options.footerIconUrl) {
    builder.addFooter(options.footerText || "", options.footerIconUrl || null);
    if (options.includeTimestamp) builder.addTimestamp();
  }
  return new EmbedBuilder(builder.embedData);
}

export { embedToContainer, createComponentReply, ComponentBuilder, createSimpleContainer, createSimpleEmbed };
