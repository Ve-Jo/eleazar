import { SlashCommandSubcommandBuilder } from "discord.js";
import HMFull from "hmfull";
import { ComponentBuilder } from "../../utils/componentConverter.ts";
import type { TranslatorLike, InteractionLike, ImageData, ExtendedMessageLike } from "../../types/index.ts";

const negativeEmotionChoices = [
  { name: "bonk", value: "bonk" },
  { name: "punch", value: "punch" },
  { name: "poke", value: "poke" },
  { name: "bully", value: "bully" },
  { name: "kick", value: "kick" },
  { name: "slap", value: "slap" },
  { name: "throw", value: "throw" },
  { name: "bite", value: "bite" },
  { name: "kill", value: "kill" },
  { name: "threaten", value: "threaten" },
  { name: "tickle", value: "tickle" },
] as const;

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("negative")
      .setDescription("Choose a negative emotion with a user")
      .addStringOption((option) =>
        option
          .setName("emotion")
          .setDescription("Choose an emotion")
          .setRequired(true)
          .addChoices(...negativeEmotionChoices)
      )
      .addUserOption((option) =>
        option.setName("user").setDescription("Choose a user").setRequired(true)
      );
  },

  localization_strings: {
    command: {
      name: {
        ru: "негативные",
        uk: "негативні",
      },
      description: {
        ru: "Выберите негативную эмоцию с пользователем",
        uk: "Виберіть негативну емоцію з користувачем",
      },
    },
    bonk: { title: { en: "Bonk", ru: "Стук", uk: "Стук" }, description: { en: "<@{{user}}> bonks <@{{targetUser}}>!", ru: "<@{{user}}> стукает <@{{targetUser}}>!", uk: "<@{{user}}> стукає <@{{targetUser}}>!" } },
    punch: { title: { en: "Punch", ru: "Удар", uk: "Удар" }, description: { en: "<@{{user}}> punches <@{{targetUser}}>!", ru: "<@{{user}}> бьет <@{{targetUser}}>!", uk: "<@{{user}}> б'є <@{{targetUser}}>!" } },
    poke: { title: { en: "Poke", ru: "Тык", uk: "Тык" }, description: { en: "<@{{user}}> pokes <@{{targetUser}}>!", ru: "<@{{user}}> тыкает <@{{targetUser}}>!", uk: "<@{{user}}> тикає <@{{targetUser}}>!" } },
    bully: { title: { en: "Bully", ru: "Издевание", uk: "Знущання" }, description: { en: "<@{{user}}> bullies <@{{targetUser}}>!", ru: "<@{{user}}> издевается над <@{{targetUser}}>!", uk: "<@{{user}}> знущається з <@{{targetUser}}>!" } },
    kick: { title: { en: "Kick", ru: "Пинание", uk: "Пинає" }, description: { en: "<@{{user}}> kicks <@{{targetUser}}>!", ru: "<@{{user}}> пинает <@{{targetUser}}>!", uk: "<@{{user}}> б'є ногою <@{{targetUser}}>!" } },
    slap: { title: { en: "Slap", ru: "Шлеп", uk: "Шлеп" }, description: { en: "<@{{user}}> slaps <@{{targetUser}}>!", ru: "<@{{user}}> шлепает <@{{targetUser}}>!", uk: "<@{{user}}> ляпає <@{{targetUser}}>!" } },
    throw: { title: { en: "Throw", ru: "Бросок", uk: "Кидок" }, description: { en: "<@{{user}}> throws something at <@{{targetUser}}>!", ru: "<@{{user}}> бросает что-то в <@{{targetUser}}>!", uk: "<@{{user}}> кидає щось у <@{{targetUser}}>!" } },
    bite: { title: { en: "Bite", ru: "Кусание", uk: "Кусає" }, description: { en: "<@{{user}}> bites <@{{targetUser}}>!", ru: "<@{{user}}> кусает <@{{targetUser}}>!", uk: "<@{{user}}> кусає <@{{targetUser}}>!" } },
    kill: { title: { en: "Kill", ru: "Убийство", uk: "Убивство" }, description: { en: "<@{{user}}> kills <@{{targetUser}}>!", ru: "<@{{user}}> убивает <@{{targetUser}}>!", uk: "<@{{user}}> вбиває <@{{targetUser}}>!" } },
    threaten: { title: { en: "Threaten", ru: "Угроза", uk: "Погроза" }, description: { en: "<@{{user}}> threatens <@{{targetUser}}>!", ru: "<@{{user}}> угрожает <@{{targetUser}}>!", uk: "<@{{user}}> погрожує <@{{targetUser}}>!" } },
    tickle: { title: { en: "Tickle", ru: "Щекотание", uk: "Лоскоче" }, description: { en: "<@{{user}}> tickles <@{{targetUser}}>!", ru: "<@{{user}}> щекочет <@{{targetUser}}>!", uk: "<@{{user}}> лоскоче <@{{targetUser}}>!" } },
    imageNotFound: { en: "Image not found", ru: "Изображение не найдено", uk: "Зображення не знайдено" },
    cannotSelectSelf: { en: "You cannot select yourself", ru: "Вы не можете выбрать себя", uk: "Ви не можете вибрати себе" },
    cannotSelectBot: { en: "You cannot select a bot", ru: "Вы не можете выбрать бота", uk: "Ви не можете вибрати бота" },
  },

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<void> {
    const builderMode = "v2";
    await interaction.deferReply();

    const user = interaction.user;
    const targetUser = interaction.options.getUser!("user") || user;
    const emotionType = interaction.options.getString!("emotion");

    if (targetUser.id === user.id) {
      await interaction.editReply({
        content: await i18n.__("commands.emotions.cannotSelectSelf"),
        ephemeral: true,
      });
      return;
    }

    if (targetUser.bot) {
      await interaction.editReply({
        content: await i18n.__("commands.emotions.cannotSelectBot"),
        ephemeral: true,
      });
      return;
    }

    const getEmotionData = async (): Promise<ImageData | null> => {
      try {
        const sources = [HMFull.HMtai.sfw, HMFull.Nekos.sfw, HMFull.NekoBot.sfw, HMFull.NekoLove.sfw];

        for (let attempts = 0; attempts < 3; attempts += 1) {
          for (const source of sources) {
            if (emotionType && Object.keys(source).includes(emotionType)) {
              const fetcher = source[emotionType];
              if (!fetcher) {
                continue;
              }
              let imageUrl = await fetcher();
              if (typeof imageUrl === "object" && imageUrl?.url) {
                imageUrl = imageUrl.url;
              }
              if (imageUrl && typeof imageUrl === "string" && imageUrl.startsWith("http")) {
                return {
                  image: imageUrl,
                  category: emotionType,
                  emotion: await i18n.__(`commands.emotions.negative.${emotionType}.title`),
                  description: await i18n.__(
                    `commands.emotions.negative.${emotionType}.description`,
                    { user: interaction.user.id, targetUser: targetUser.id }
                  ),
                };
              }
            }
          }
        }
        return null;
      } catch (error) {
        console.error(`Error fetching ${emotionType} image:`, error);
        return null;
      }
    };

    try {
      const emotionData = await getEmotionData();

      if (!emotionData?.image) {
        await interaction.editReply({
          content: await i18n.__("commands.emotions.negative.imageNotFound"),
          ephemeral: true,
        });
        return;
      }

      const emotionComponent = new ComponentBuilder({
        color: process.env.EMBED_COLOR,
        mode: builderMode,
      })
        .addText(String(emotionData.emotion), "header3")
        .addText(String(emotionData.description))
        .addImage(emotionData.image)
        .addTimestamp(interaction.locale);

      const replyOptions = emotionComponent.toReplyOptions();
      const message = await interaction.editReply(replyOptions) as ExtendedMessageLike;

      const collector = message.createMessageComponentCollector({
        time: 60000,
      });

      collector.on("collect", async (componentInteraction: any) => {
        if (componentInteraction.customId === "next_emotion") {
          if (componentInteraction.user.id !== user.id) {
            await componentInteraction.reply({
              content: "Only the command user can request the next image.",
              ephemeral: true,
            });
            return;
          }
          await componentInteraction.deferUpdate();
          await getEmotionData();
        }
      });

      collector.on("end", async (_collected: unknown, reason: string) => {
        if (reason !== "messageDelete" && message.editable && message.id && message.channel) {
          try {
            const latestMessage = await message.channel.messages.fetch(message.id);
            if (latestMessage.components.length > 0) {
              await latestMessage.edit({ components: [] });
            }
          } catch (error) {
            console.error("Failed to remove components on collector end:", error);
          }
        }
      });
    } catch (error) {
      console.error("Error getting emotion data:", error);
      const errorOptions = {
        content: await i18n.__("commands.emotions.negative.imageNotFound"),
        ephemeral: true,
        components: [],
        embeds: [],
        files: [],
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
