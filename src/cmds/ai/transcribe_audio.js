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
  data: new SlashCommandSubcommandBuilder()
    .setName("transcribe_audio")
    .setDescription("Transcribe audio to text")
    .addAttachmentOption((option) =>
      option
        .setName("audio")
        .setDescription("The link (!) to audio file to transcribe")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("language")
        .setDescription("The language of the audio (default: auto)")
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const audioAttachment = interaction.options.getAttachment("audio");
    const language = interaction.options.getString("language") || "auto";

    if (!audioAttachment.contentType.startsWith("audio/")) {
      return interaction.editReply("Please provide a valid audio file.");
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
          content:
            "The transcription is too long to display. Here's a text file with the result:",
          files: [attachment],
        });
      } else {
        await interaction.editReply(`Transcription:\n\n${transcription}`);
      }
    } catch (error) {
      console.error("Error transcribing audio:", error);
      await interaction.editReply(
        "An error occurred while transcribing the audio. Please try again later."
      );
    }
  },
};
