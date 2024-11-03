import {
  SlashCommandSubcommand,
  SlashCommandOption,
  OptionType,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import { AttachmentBuilder } from "discord.js";
import fetch from "node-fetch";
import fs from "fs";
import { pipeline } from "stream/promises";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { promisify } from "util";
import i18n from "../../utils/i18n.js";

const unlinkAsync = promisify(fs.unlink);

async function convertAudio(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat("mp3")
      .on("error", (err) => reject(err))
      .on("end", () => resolve())
      .save(outputPath);
  });
}

export async function transcribeAudio(client, audioUrl, language = "auto") {
  try {
    const response = await fetch(audioUrl);
    const originalFilePath = `./temp_original_audio_file${path.extname(
      audioUrl
    )}`;
    await pipeline(response.body, fs.createWriteStream(originalFilePath));

    const convertedFilePath = "./temp_converted_audio_file.mp3";
    await convertAudio(originalFilePath, convertedFilePath);

    try {
      const transcription = await client.groq.audio.transcriptions.create({
        file: fs.createReadStream(convertedFilePath),
        model: "whisper-large-v3-turbo",
        response_format: "json",
      });

      await Promise.all([
        unlinkAsync(originalFilePath),
        unlinkAsync(convertedFilePath),
      ]);

      return {
        text: transcription.text,
        language: transcription.language,
        provider: "groq",
      };
    } catch (groqError) {
      console.error("Error using Groq API:", groqError);
      console.log("Falling back to Replicate API");

      const output = await client.replicate.run(
        "openai/whisper:cdd97b257f93cb89dede1c7584e3f3dfc969571b357dbcee08e793740bedd854",
        {
          input: {
            audio: audioUrl,
            language: language,
          },
        }
      );

      await Promise.all([
        unlinkAsync(originalFilePath),
        unlinkAsync(convertedFilePath),
      ]);

      let transcription = "";
      if (Array.isArray(output.segments)) {
        transcription = output.segments
          .map((segment) => segment.text)
          .join(" ");
      } else {
        transcription = output.transcription || "Transcription failed.";
      }

      return {
        text: transcription,
        language: output.language,
        provider: "replicate",
      };
    }
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw error;
  }
}

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("ai", "transcribe_audio");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
    });

    // Add audio option
    const audioOption = new SlashCommandOption({
      type: OptionType.ATTACHMENT,
      name: "audio",
      description: i18nBuilder.translateOption("audio", "description"),
      required: true,
      name_localizations: i18nBuilder.getOptionLocalizations("audio", "name"),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "audio",
        "description"
      ),
    });

    // Add language option
    const languageOption = new SlashCommandOption({
      type: OptionType.STRING,
      name: "language",
      description: i18nBuilder.translateOption("language", "description"),
      required: false,
      name_localizations: i18nBuilder.getOptionLocalizations(
        "language",
        "name"
      ),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "language",
        "description"
      ),
    });

    subcommand.addOption(audioOption);
    subcommand.addOption(languageOption);

    return subcommand;
  },
  async execute(interaction) {
    await interaction.deferReply();

    const audioAttachment = interaction.options.getAttachment("audio");
    const language = interaction.options.getString("language") || "auto";

    if (!audioAttachment.contentType.startsWith("audio/")) {
      return interaction.editReply(i18n.__("ai.transcribe_audio.invalid_file"));
    }

    try {
      const transcription = await transcribeAudio(
        interaction.client,
        audioAttachment.url,
        language
      );

      if (transcription.length > 2000) {
        const attachment = new AttachmentBuilder(
          Buffer.from(transcription, "utf-8"),
          { name: "transcription.txt" }
        );
        await interaction.editReply({
          content: i18n.__("ai.transcribe_audio.too_long"),
          files: [attachment],
        });
      } else {
        await interaction.editReply(
          i18n.__("ai.transcribe_audio.generated", { transcription })
        );
      }
    } catch (error) {
      console.error("Error transcribing audio:", error);
      await interaction.editReply(i18n.__("ai.transcribe_audio.error"));
    }
  },
  localization_strings: {
    name: {
      en: "transcribe",
      ru: "транскрипция",
      uk: "транскрипція",
    },
    description: {
      en: "Transcribe audio to text",
      ru: "Преобразовать аудио в текст",
      uk: "Перетворити аудіо в текст",
    },
    options: {
      audio: {
        name: {
          en: "audio",
          ru: "аудио",
          uk: "аудіо",
        },
        description: {
          en: "The audio file to transcribe",
          ru: "Аудиофайл для транскрибации",
          uk: "Аудіофайл для транскрибації",
        },
      },
      language: {
        name: {
          en: "language",
          ru: "язык",
          uk: "мова",
        },
        description: {
          en: "The language of the audio (default: auto)",
          ru: "Язык аудио (по умолчанию: auto)",
          uk: "Мова аудіо (за замовчуванням: auto)",
        },
      },
    },
    invalid_file: {
      en: "Please provide a valid audio file.",
      ru: "Пожалуйста, предоставьте допустимый аудиофайл.",
      uk: "Будь ласка, надайте допустимий аудіофайл.",
    },
    generated: {
      en: "Transcription:\n\n{{transcription}}",
      ru: "Транскрипция:\n\n{{transcription}}",
      uk: "Транскрипція:\n\n{{transcription}}",
    },
    failed: {
      en: "Failed to transcribe the audio. Please try again.",
      ru: "Не удалось транскрибировать аудио. Пожалуйста, попробуйте еще раз.",
      uk: "Не вдалося транскрибувати аудіо. Будь ласка, спробуйте ще раз.",
    },
    error: {
      en: "An error occurred while transcribing the audio. Please try again later.",
      ru: "Произошла ошибка при транскрибации аудио. Пожалуйста, попробуйте еще раз позже.",
      uk: "Виникла помилка при транскрибуванні аудіо. Будь ласка, спробуйте ще раз пізніше.",
    },
    too_long: {
      en: "The transcription is too long to display. Here's a text file with the result:",
      ru: "Транскрипция слишком длинная для отображения. Вот текстовый файл с результатом:",
      uk: "Транскрипція занадто довга для відображення. Ось текстовий файл з результатом:",
    },
  },
};
