import { SlashCommandSubcommandBuilder, AttachmentBuilder } from "discord.js";
import fetch from "node-fetch";

export async function transcribeAudio(
  client,
  audioUrl,
  language = "auto",
  translate = false,
  format = "plain text"
) {
  const output = await client.replicate.run(
    "openai/whisper:cdd97b257f93cb89dede1c7584e3f3dfc969571b357dbcee08e793740bedd854",
    {
      input: {
        audio: audioUrl,
        language: language,
        transcription: format,
        translate: translate,
      },
    }
  );

  let transcription = "";
  if (Array.isArray(output.segments)) {
    transcription = output.segments.map((segment) => segment.text).join(" ");
  } else {
    transcription = output.transcription || "Transcription failed.";
  }

  return transcription;
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
    )
    .addBooleanOption((option) =>
      option
        .setName("translate")
        .setDescription("Translate the transcription to English")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("format")
        .setDescription("Output format (default: plain text)")
        .addChoices(
          { name: "Plain Text", value: "plain text" },
          { name: "SRT", value: "srt" },
          { name: "VTT", value: "vtt" }
        )
        .setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    const audioAttachment = interaction.options.getAttachment("audio");
    const language = interaction.options.getString("language") || "auto";
    const translate = interaction.options.getBoolean("translate") || false;
    const format = interaction.options.getString("format") || "plain text";

    if (!audioAttachment.contentType.startsWith("audio/")) {
      return interaction.editReply("Please provide a valid audio file.");
    }

    try {
      const transcription = await transcribeAudio(
        interaction.client,
        audioAttachment.url,
        language,
        translate,
        format
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
