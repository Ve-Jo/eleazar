import { SlashCommandBuilder } from "discord.js";
import EconomyEZ from "../../utils/economy.js";
import i18n from "i18n";
import balance from "./balance.js";
import transfer from "./transfer.js";
import daily from "./daily.js";
import deposit from "./deposit.js";
import withdraw from "./withdraw.js";
import shop from "./shop.js";
import crime from "./crime.js";
import leaderboard from "./leaderboard.js";

export default {
  data: new SlashCommandBuilder()
    .setName("economy")
    .setDescription("Economy commands")
    .setDescriptionLocalizations({
      ru: "Команды экономики",
      uk: "Команди економіки",
    })
    .addSubcommand(balance.data)
    .addSubcommand(transfer.data)
    .addSubcommand(daily.data)
    .addSubcommand(deposit.data)
    .addSubcommand(withdraw.data)
    .addSubcommand(shop.data)
    .addSubcommand(crime.data)
    .addSubcommand(leaderboard.data),
  server: true,
  async execute(interaction) {
    await interaction.deferReply();
    await EconomyEZ.ensure(
      `economy.${interaction.guild.id}.${interaction.user.id}`
    );

    let subcommand = interaction.options.getSubcommand();

    const subcommands = {
      balance: balance,
      transfer: transfer,
      daily: daily,
      deposit: deposit,
      withdraw: withdraw,
      shop: shop,
      crime: crime,
      leaderboard: leaderboard,
    };

    if (!subcommands[subcommand]) {
      return interaction.editReply({
        content: i18n.__("subcommandNotFound"),
        ephemeral: true,
      });
    }

    await subcommands[subcommand].execute(interaction);
  },
};
