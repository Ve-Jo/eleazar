import { SlashCommandSubcommandBuilder, AttachmentBuilder } from "discord.js";
import fetch from "node-fetch";
import fs from "fs";
import { pipeline } from "stream/promises";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { promisify } from "util";

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
      console.log("Falling back to DeepInfra API");

      const transcription = await client.deepinfra.whisper.generate({
        audio: fs.createReadStream(convertedFilePath),
        language: language,
      });

      await Promise.all([
        unlinkAsync(originalFilePath),
        unlinkAsync(convertedFilePath),
      ]);

      return {
        text: transcription.text,
        language: transcription.language,
        provider: "deepinfra",
      };
    }
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw error;
  }
}

export default {
  data: () => {
    // Create a standard subcommand with Discord.js builders
    const builder = new SlashCommandSubcommandBuilder()
      .setName("transcribe_audio")
      .setDescription("Transcribe audio to text")
      .addAttachmentOption((option) =>
        option
          .setName("audio")
          .setDescription("The audio file to transcribe")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("language")
          .setDescription("The language of the audio (default: auto)")
          .setRequired(false)
      );

    return builder;
  },

  // Define localization strings directly in the command
  localization_strings: {
    command: {
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
    },
    options: {
      audio: {
        name: {
          ru: "аудио",
          uk: "аудіо",
        },
        description: {
          ru: "Аудиофайл для транскрибации",
          uk: "Аудіофайл для транскрибації",
        },
      },
      language: {
        name: {
          ru: "язык",
          uk: "мова",
        },
        description: {
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
    no_attachment: {
      en: "Please provide an audio file to transcribe.",
      ru: "Пожалуйста, предоставьте аудиофайл для транскрибации.",
      uk: "Будь ласка, надайте аудіофайл для транскрибації.",
    },
    invalid_attachment_type: {
      en: "The provided file is not a supported audio format. Supported formats: {{accepted_types}}. Received: {{received_type}}",
      ru: "Предоставленный файл имеет неподдерживаемый формат. Поддерживаемые форматы: {{accepted_types}}. Получено: {{received_type}}",
      uk: "Наданий файл має непідтримуваний формат. Підтримувані формати: {{accepted_types}}. Отримано: {{received_type}}",
    },
    file_too_large: {
      en: "The audio file is too large (max 25MB).",
      ru: "Аудиофайл слишком большой (максимум 25МБ).",
      uk: "Аудіофайл занадто великий (максимум 25МБ).",
    },
    downloading: {
      en: "Downloading audio file...",
      ru: "Загрузка аудиофайла...",
      uk: "Завантаження аудіофайлу...",
    },
    transcribing: {
      en: "Transcribing audio...",
      ru: "Транскрибирование аудио...",
      uk: "Транскрибування аудіо...",
    },
    result: {
      en: "Transcription:\n\n{{transcription}}",
      ru: "Транскрипция:\n\n{{transcription}}",
      uk: "Транскрипція:\n\n{{transcription}}",
    },
  },

  async execute(interaction, i18n) {
    await interaction.deferReply();

    // Get the file attachment
    const attachment = interaction.options.getAttachment("audio");
    if (!attachment) {
      return interaction.editReply(
        i18n.__("commands.ai.transcribe_audio.no_attachment")
      );
    }

    // Check file type
    const acceptedTypes = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/ogg",
      "video/mp4",
      "audio/mp4",
      "audio/mpeg3",
      "audio/x-mpeg-3",
      "audio/webm",
    ];
    if (!acceptedTypes.includes(attachment.contentType)) {
      return interaction.editReply(
        i18n.__(
          "invalid_attachment_type",
          {
            accepted_types: acceptedTypes.join(", "),
            received_type: attachment.contentType || "unknown",
          },
          userLocale
        )
      );
    }

    // Check file size
    if (attachment.size > 25 * 1024 * 1024) {
      // 25 MB
      return interaction.editReply(
        i18n.__("commands.ai.transcribe_audio.file_too_large")
      );
    }

    try {
      // Download the file
      await interaction.editReply(
        i18n.__("commands.ai.transcribe_audio.downloading")
      );

      const response = await fetch(attachment.url);
      if (!response.ok) {
        throw new Error(
          `Failed to download file: ${response.status} ${response.statusText}`
        );
      }

      const audioData = await response.arrayBuffer();

      // Transcribe the audio
      await interaction.editReply(
        i18n.__("commands.ai.transcribe_audio.transcribing")
      );

      const formData = new FormData();
      formData.append("file", new Blob([audioData]), attachment.name);
      formData.append("model", "whisper-1");

      const transcriptionResponse = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: formData,
        }
      );

      if (!transcriptionResponse.ok) {
        const errorText = await transcriptionResponse.text();
        throw new Error(
          `OpenAI API error: ${transcriptionResponse.status} ${transcriptionResponse.statusText}\n${errorText}`
        );
      }

      const transcriptionData = await transcriptionResponse.json();

      // Respond with the transcription
      return interaction.editReply({
        content: i18n.__("commands.ai.transcribe_audio.result", {
          transcription: transcriptionData.text,
        }),
      });
    } catch (error) {
      console.error("Error transcribing audio:", error);
      return interaction.editReply(
        i18n.__("commands.ai.transcribe_audio.error")
      );
    }
  },
};
