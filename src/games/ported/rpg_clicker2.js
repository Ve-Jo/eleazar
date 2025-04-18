import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import ms from "ms";
const rpgImagesJson = [
  "https://i.pinimg.com/originals/80/2c/2b/802c2bab8ab08640ba84de46834dbff5.jpg",
  "https://cdnb.artstation.com/p/assets/images/images/018/099/011/large/steven-nicodemus-arid-desert-originally-wild-west-1-rgb.jpg?1558370159",
  "https://external-preview.redd.it/VkT6ycP5C8hA035TOY32s55VAdWPLcG4cFUgALReT70.jpg?auto=webp&s=a292046179bf77e3520c756181c4731aff07793c",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQWpgPno9vnVSJ-Q_oyIqzdFyMreMNoowurUPqBZDRG2EKuz3crRGfQKoXgh_TqSoeQ10M&usqp=CAU",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTEfj3IFbOYTCFax5U9y4ns3My0rLyh6zWElbc-84Ulg5LvkqtD_QdfWR7LHmu5zkS4I60&usqp=CAU",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZySlgNZMhhIRuke1ZK3AaZdACH_JwT19KU3zQZbGkzL2XMctKgIenpWamHgXV1IYbIW8&usqp=CAU",
  "https://p4.wallpaperbetter.com/wallpaper/530/393/250/fantasy-landscape-barren-desert-wallpaper-preview.jpg",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRQsBZFU_2cFPUuwFI1qaVkEXiytN247K_ltSACYsLp2jmrxrQGccoOZDkFfBptgFVUX08&usqp=CAU",
  "https://img.wallpapersafari.com/desktop/1600/900/10/10/S8y3hi.jpg",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQTxSWDnDQOOhfqsF0Zk9rLROunQBSPHD9aut7sjZJhX9JHAUFvNMLrYJE0O2CZ1ZUsA9Q&usqp=CAU",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQqnsAQKF5pMdpe7VuEwaNkt2I2Dz5pSMjikME8OHos-0hISf_Jupw3rgy4jVxg-BLprsI&usqp=CAU",
  "https://cdn.wallpapersafari.com/41/1/402zWG.jpg",
  "https://wallup.net/wp-content/uploads/2019/10/1000408-fantasy-art-artwork-original-wallpaper-fantastic-748x421.jpg",
  "https://i.pinimg.com/originals/de/03/43/de0343ee9567968c2a83ee2ac60ad12f.jpg",
  "https://i.pinimg.com/originals/d4/e8/a2/d4e8a25b2e1ee0fee61786b23d233003.jpg",
  "https://i.pinimg.com/originals/3b/c9/74/3bc974ebcd496769bfb1d359aa082cf7.jpg",
  "https://i.pinimg.com/originals/ec/11/aa/ec11aa7d046b778f87bea0958f776f8f.jpg",
  "https://i.pinimg.com/originals/3b/c9/74/3bc974ebcd496769bfb1d359aa082cf7.jpg",
];
import { DEFAULT_GAME_SCHEMAS } from "../../database/legacyClient.js";
function randomInteger(min, max) {
  let rand = min - 0.5 + Math.random() * (max - min + 1);
  return Number(rand.toFixed(1));
}

function randomIntegerSmall(min, max) {
  let rand = min - 0.5 + Math.random() * (max - min + 1);
  return Number(rand.toFixed(2));
}

export default {
  title: "РПГ кликер 2.0",
  description:
    "Сражайтесь со смертоносными монстрами и станьте одним из лучших!",
  emoji: "⚔️",
  isLegacy: true,
  game_info: {
    tags: ["records", "rebirth", "health"],
    description:
      "Сражайтесь со смертоносными монстрами и станьте одним из лучших!",
    name_id: "rpg_clicker2",
    name: `РПГ кликер 2.0`,
  },
  //TODO: Добавить предпросмотр статистики
  async execute(interaction, legacyDb) {
    try {
      // Get guild and user IDs
      const guildId = interaction.guild.id;
      const userId = interaction.user.id;
      const gameId = "rpg_clicker2";

      let collector;

      try {
        // Send initial loading message
        await interaction.editReply({
          components: [],
          embeds: [],
          content: "Loading game...",
          ephemeral: true,
          fetchReply: true,
        });

        // Keep the original key format for backward compatibility
        let key = `${guildId}.${userId}.${gameId}`;
        let server_key = `${guildId}.${userId}`;

        // Create a client object with methods that match the old API
        const client = {
          fdb: {
            get: async (keyPath, _, returnFullObject) => {
              try {
                if (returnFullObject) {
                  return (
                    (await legacyDb._getData(guildId, userId, gameId)) || {}
                  );
                }
                const path = keyPath.replace(`${key}.`, "");
                return await legacyDb.get(guildId, userId, gameId, path);
              } catch (error) {
                console.error("Error in fdb.get:", error);
                return {};
              }
            },
            set: async (keyPath, value) => {
              try {
                const path = keyPath.replace(`${key}.`, "");
                return await legacyDb.set(guildId, userId, gameId, path, value);
              } catch (error) {
                console.error("Error in fdb.set:", error);
              }
            },
            inc: async (keyPath, amount) => {
              try {
                const path = keyPath.replace(`${key}.`, "");
                return await legacyDb.inc(
                  guildId,
                  userId,
                  gameId,
                  path,
                  amount
                );
              } catch (error) {
                console.error("Error in fdb.inc:", error);
              }
            },
            dec: async (keyPath, amount) => {
              try {
                const path = keyPath.replace(`${key}.`, "");
                return await legacyDb.dec(
                  guildId,
                  userId,
                  gameId,
                  path,
                  amount
                );
              } catch (error) {
                console.error("Error in fdb.dec:", error);
              }
            },
          },
          db: {
            delete: async (keyPath) => {
              try {
                const path = keyPath.replace(`${key}.`, "");
                return await legacyDb.delete(guildId, userId, gameId, path);
              } catch (error) {
                console.error("Error in db.delete:", error);
              }
            },
          },
          // Add utility methods that would have been on the original client
          tall: (content, locale) => content, // Replace with interaction.client.tall if it exists
          // Custom ez_collector based on user's implementation
          ez_collector: (customIdFilter, message, options) => {
            try {
              const filter =
                typeof customIdFilter === "function"
                  ? customIdFilter
                  : (i) =>
                      i.customId.startsWith(customIdFilter) &&
                      i.user.id === userId;

              // Create a collector on the channel, not on the message
              const channel = interaction.channel;

              if (!channel) {
                console.error("Channel not found for collector");
                return null;
              }

              return channel.createMessageComponentCollector({
                filter,
                idle: options?.idle || 300000, // Default 5 minute idle timeout
              });
            } catch (error) {
              console.error("Error creating collector:", error);
              return null;
            }
          },
          // Add more utility methods as needed
          createTimeout: (timeoutKey, duration) => {
            // Simplified timeout implementation
            console.log(
              `Creating timeout for ${timeoutKey} with duration ${duration}`
            );
          },
        };

        // Create a message object that mimics the old API
        const message = {
          guild: { id: guildId },
          member: { id: userId },
          author: { id: userId },
          locale: interaction.locale,
          reply: interaction.reply.bind(interaction),
          editReply: interaction.editReply.bind(interaction),
          channel: interaction.channel,
          // Add any other properties from the old message object that might be needed
        };

        // Continue with the original execute function using our adapter objects
        await main();

        // Original Main function will now be executed
        async function main() {
          let activities = [];

          let data = await client.fdb.get(`${key}`, "rpg_clicker2", true);

          if (data?.global_mob?.here == 0) {
            var chance = Math.floor(randomInteger(0, 20));

            var first_name = [
              "Устрашающий",
              "Окровавленный",
              "Железный",
              "Ослепительный",
            ];
            var second_name = ["страж", "бог", "зверь", "гигант", "дракон"];
            var first_name_random =
              first_name[Math.floor(Math.random() * first_name.length)];
            var second_name_random =
              second_name[Math.floor(Math.random() * second_name.length)];
            var name = first_name_random + " " + second_name_random;

            if (chance === 1) {
              var random_health = randomInteger(500, 2000);
              var random_damage = Number(randomIntegerSmall(0.3, 1));
              var random_regeneration = Number(randomIntegerSmall(0.01, 0.1));
              var random_armor = randomInteger(1, 5);
              var random_aim = randomInteger(1, 8);
              await client.fdb.set(`${key}.global_mob.here`, 1);
              await client.fdb.set(`${key}.global_mob.name`, name);
              await client.fdb.set(
                `${key}.global_mob.health_max`,
                random_health
              );
              await client.fdb.set(`${key}.global_mob.health`, random_health);
              await client.fdb.set(`${key}.global_mob.damage`, random_damage);
              await client.fdb.set(
                `${key}.global_mob.regeneration`,
                random_regeneration
              );
              await client.fdb.set(`${key}.global_mob.armor`, random_armor);
              await client.fdb.set(`${key}.global_mob.aim`, random_aim);
              await client.fdb.set(
                `${key}.global_mob.wallpaper_link`,
                `https://cdn.discordapp.com/attachments/959591573371379753/973516494082306059/unknown.png`
              );
            }
          }

          let rpg_embed = new EmbedBuilder()
            .setTitle(`РПГ v2.0`)
            .setDescription(
              "Стань могущественным повелителем в этих адских землях!"
            );

          if (data?.global_mob?.health <= 0 && data?.global_mob?.here === 1) {
            await client.fdb.set(`${key}.global_mob.here`, 0, "rpg_clicker2");
            if (data?.user?.home === 2) {
              await client.fdb.set(`${key}.user.home`, 0, "rpg_clicker2");
              await client.fdb.set(`${key}.mob_dead`, 1, "rpg_clicker2");
            }
          }

          if (data?.crime_fail) {
            activities.push(`\` КРАЖА! \` Вам не удалось ограбить моба\n`);
            client.db.delete(`${key}.crime_fail`);
          }

          if (data?.crime_success) {
            activities.push(
              `\` КРАЖА! \` Вы ограбили моба и получили 1 случайный предмет!\n`
            );
            client.db.delete(`${key}.crime_success`);
          }

          if (data?.mob_dead) {
            activities.push(
              `\` 🗺️ ГЛОБАЛЬНЫЙ МОБ УБИТ! \` Моб убит, вы вернулись на обычное поле боя!\n`
            );
            client.db.delete(`${key}.mob_dead`);
          }

          if (data?.shield_resist) {
            activities.push(
              `\` БЛОК! \` Моб смог отразить удар своей броней! Нанесено меньше урона\n`
            );
            client.db.delete(`${key}.shield_resist`);
          }

          if (data?.bomb) {
            let decreaser = data.class_stats.bomb;
            activities.push(
              `\` 💣 БАХ! \` Моб взорвался и потерял ${decreaser.toFixed(
                1
              )} здоровья!\n`
            );
            client.db.delete(`${key}.user.bomb`);
          }

          if (data?.durability) {
            let decreaser = data.class_stats.durability;
            activities.push(
              `\` 🔧 Ремонт! \` Ваше оружие было починено на ${decreaser.toFixed(
                0
              )} ед. прочности!\n`
            );
            client.db.delete(`${key}.user.durability`);
          }

          if (data?.ammo) {
            let decreaser = data.class_stats.ammo;
            activities.push(
              `\` 🎯 Патроны! \` Ваше оружие получило ${decreaser.toFixed(
                0
              )} патронов!\n`
            );
            client.db.delete(`${key}.user.ammo`);
          }

          if (data?.health) {
            let increaser = data.health;
            activities.push(
              `\` 💊 Лечение! \` Вы восстановили ${increaser.toFixed(
                1
              )} здоровья!\n`
            );
            client.db.delete(`${key}.health`);
          }

          if (data?.mana) {
            let increaser = data.mana;
            activities.push(
              `\` 🧙 Мана! \` Вы восстановили ${increaser.toFixed(1)} маны!\n`
            );
            client.db.delete(`${key}.mana`);
          }

          if (data?.global_mob?.health_max === data?.global_mob?.health) {
            if (data?.global_mob?.here == 1) {
              activities.push(
                "` 🗺️ ОБЬЯВЛЕН БОСС! ` Вы можете попробовать с ним сразиться.\n"
              );
            }
          }

          if (data?.mob_money) {
            let bonus = data.mob_money;
            activities.push(
              `\` 🗺️ Прибыль! \` С моба упало ${bonus.toFixed(1)} золота!\n`
            );
            client.db.delete(`${key}.mob_money`);
          }

          async function random_rpg_image() {
            var ready_image =
              rpgImagesJson[Math.floor(Math.random() * rpgImagesJson.length)];
            await client.fdb.set(`${key}.location.wallpaper_link`, ready_image);
          }

          if (
            !data?.location?.wallpaper_link ||
            data?.location?.wallpaper_link == null
          ) {
            await random_rpg_image();
          }

          if (
            data?.location?.distance_to == 0 ||
            data?.location?.fixed_distance >= data?.location?.distance_to
          ) {
            await client.fdb.set(`${key}.location.name`, "Дремущий лес");
            await client.fdb.inc(`${key}.location.level`, 1, "rpg_clicker2");
            let fixer = NaN;
            if (2.5 - data?.location?.level / 5 < 1) {
              fixer = 1.2;
            }
            await client.fdb.set(
              `${key}.location.distance_to`,
              data?.location?.distance_to *
                (fixer || 2.5 - data?.location?.level / 5)
            );
            activities.push(
              `\` 🗺️ ВНИМАНИЕ! \` Уровень мира повышен! Мобы стали сильнее!\n\` 💰 \` Прибыль за убийства мобов увеличена!\n`
            );

            var first_word = [
              `Пугающая`,
              `Устрашающая`,
              `Подводная`,
              `Райская`,
              `Невидимая`,
              `Огненная`,
              `Адская`,
              `Инопланетная`,
              `Царская`,
            ];
            var second_word = [
              `долина`,
              `расщелина`,
              `крепость`,
              `пустыня`,
              `пещера`,
            ];

            var random_location =
              first_word[Math.floor(Math.random() * first_word.length)] +
              ` ` +
              second_word[Math.floor(Math.random() * second_word.length)];
            await client.fdb.set(
              `${key}.location.name`,
              random_location,
              "rpg_clicker2"
            );
            data = await client.fdb.get(`${key}`, "rpg_clicker2", true);
            await random_rpg_image();
          }

          if (data.combo) {
            activities.push(
              `\n\` КОМБО ${data.combo}X \` Удары усилены на ${
                1 + data.combo / 4
              }x`
            );
            client.db.delete(`${key}.combo`);
          }

          if (data?.cooldown > 0) {
            await client.fdb.dec(`${key}.cooldown`, 1, "rpg_clicker2");
            if (
              (await client.fdb.get(`${key}.cooldown`, "rpg_clicker2")) === 0
            ) {
              client.db.delete(`${key}.cooldown`);
            }
          }

          if (data.user.health_current <= 0) {
            await client.fdb.set(
              `${key}.user.health_current`,
              user.health_max,
              "rpg_clicker2"
            );
            await client.fdb.set(
              `${key}.class_stats.sword`,
              data.class_stats.sword_max,
              "rpg_clicker2"
            );
            await client.fdb.set(
              `${key}.class_stats.shield`,
              data.class_stats.shield_max,
              "rpg_clicker2"
            );
            await client.fdb.set(
              `${key}.class_stats.daggers`,
              data.class_stats.daggers_max,
              "rpg_clicker2"
            );
            await client.fdb.set(
              `${key}.class_stats.arrows`,
              data.class_stats.arrows_max,
              "rpg_clicker2"
            );
            await client.fdb.set(
              `${key}.class_stats.mana`,
              user3.mana_max,
              "rpg_clicker2"
            );
            client.createTimeout(`timeouts.${key}`, ms("30m"));
            return message.editReply(
              await client.tall(
                {
                  content: `**ВАС УБИЛИ!**\n\nУ вас не хватило здоровья расправиться с противником!\n* Вы сможете вернуться к битве через пол часа!`,
                  ephemeral: true,
                  components: [],
                },
                message.locale
              )
            );
          }

          data = await client.fdb.get(`${key}`, "rpg_clicker2", true);
          let required = data.user.level * 2 * 19;

          if (data.crit_success) {
            var damage = data.crit_success;
            activities.push(
              `\` КРИТ. УДАР! \` Нанесено ${damage} ед. урона!\n`
            );
            client.db.delete(`${key}.crit_success`);
          }

          if (data.attack_success) {
            var damage = data.attack_success;
            activities.push(`\` Удар! \` Нанесено ${damage} ед. урона!\n`);
            client.db.delete(`${key}.attack_success`);
          }

          if (data.attack_failure) {
            activities.push(`\` 💥 \` Вы промахнулись!\n`),
              client.db.delete(`${key}.attack_failure`);
          }

          if (data.enemy_failure) {
            activities.push(`\` 💂🏼 \` Ваш враг промахнулся!`),
              client.db.delete(`${key}.enemy_failure`);
          }

          if (data.mob.health < 0 && data.mob.here === 1) {
            await client.fdb.set(`${key}.mob.here`, 0, "rpg_clicker2");
            let xp =
              randomInteger(data.mob.level * 15, data.mob.level * 25) *
              (1 + data.stones.xp_bonus / 100);
            var main_money =
              ((data.mob.health_max / 11) * (1 + data.location.level / 3)) / 2;
            await client.fdb.inc(
              `${key}.balance`,
              Number(main_money),
              "balance"
            );
            var money =
              (data.mob.health_max / 11) *
              (1 + data.location.level / 3) *
              (1 + data.stones.gold_bonus / 100);
            if (money > 2000) money = 2000;
            await client.fdb.inc(`${key}.user.gold`, money, "rpg_clicker2");
            activities.push(
              `\n\` 🌈 МОБ УБИТ! \` Вы получили ${xp.toFixed(
                1
              )} опыта!\n\` 👛 \` Заработано ${money.toFixed(
                1
              )} золота\n\` 💵 \` Вы получили ${main_money.toFixed(1)} налички`
            );
            await client.fdb.inc(`${key}.user.xp`, xp, "rpg_clicker2");

            var drop_chance = Math.floor(randomInteger(1, 3));
            console.log(`DROP CHANCE: ${drop_chance}`);
            if (drop_chance === 1) {
              var selector = Math.floor(randomInteger(1, 5));
              switch (selector) {
                case 1:
                  await client.fdb.inc(
                    `${key}.class_stats.health_bottle`,
                    1,
                    "rpg_clicker2"
                  );
                  break;
                case 2:
                  await client.fdb.inc(
                    `${key}.class_stats.durability_bottle`,
                    1,
                    "rpg_clicker2"
                  );
                  break;
                case 3:
                  await client.fdb.inc(
                    `${key}.class_stats.bomb`,
                    1,
                    "rpg_clicker2"
                  );
                  break;
                case 4:
                  await client.fdb.inc(
                    `${key}.class_stats.mana_bottle`,
                    1,
                    "rpg_clicker2"
                  );
                  break;
                case 5:
                  await client.fdb.inc(
                    `${key}.class_stats.ammo_box`,
                    1,
                    "rpg_clicker2"
                  );
                  break;
              }
            }

            if (data.user.xp + xp > required) {
              await client.fdb.inc(`${key}.user.level`, 1, "rpg_clicker2");
              await client.fdb.set(
                `${key}.user.xp`,
                data.user.xp + xp - required,
                "rpg_clicker2"
              );
              var health_max = data.user.health_max;
              var bonus_health = health_max / 6;
              activities.push(
                `\n\` ☄️ \` Поздравляем с повышением до ${
                  data.user.level + 1
                } уровня!\n\` ❤️ \` Ваше макс. здоровье увеличено на ${bonus_health.toFixed(
                  1
                )}\n`
              ),
                await client.fdb.inc(
                  `${key}.user.health_max`,
                  bonus_health,
                  "rpg_clicker2"
                );

              /*if (!(await settings.has(`${message.member.id}-sync`))) {
					await global_leaderboard_games.ensure(`${message.member.id}-rpg_2`, {
						user_id: message.member.id,
						guild_id: message.guild.id,
						private: await settings.has(`${message.guild.id}-private`),
						tag: message.member.user.username + '#' + message.member.user.discriminator,
						score: 0,
						when: Date.now(),
					})
					if (
						user.level >
						(await global_leaderboard_games.get(`${message.member.id}-rpg_2.score`))
					) {
						await global_leaderboard_games.set(`${message.member.id}-rpg_2`, {
							user_id: message.member.id,
							guild_id: message.guild.id,
							private: await settings.has(`${message.guild.id}-private`),
							tag: message.member.user.username + '#' + message.member.user.discriminator,
							score: user.level,
							when: Date.now(),
						})
					}
				}*/
            }
            data = await client.fdb.get(`${key}`, "rpg_clicker2", true);
          }

          if (data.user.health_current < data.user.health_max / 8) {
            activities.push(
              `\` 💔 ОЧЕНЬ МАЛО здоровья! \` У вас меньше восьмой части здоровья!`
            );
          } else if (data.user.health_current < data.user.health_max / 4) {
            activities.push(
              `\` 💔 Мало здоровья! \` У вас меньше четверти здоровья!`
            );
          }
          if (
            data.class_stats.mana < data.class_stats.mana_max / 4 &&
            data.class_stats.mana !== 0
          ) {
            activities.push(`\` 🔮 Мало маны! \` У вас меньше четверти маны!`);
          }
          if (
            data.class_stats.arrows < data.class_stats.arrows / 8 &&
            data.class_stats.arrows !== 0
          ) {
            activities.push(
              `\` 🏹 Мало стрел! \` У вас меньше одной восьмой части стрел!`
            );
          }
          if (
            data.class_stats.daggers < data.class_stats.daggers_max / 6 &&
            data.class_stats.daggers !== 0
          ) {
            activities.push(
              `\` 🔪 Мало кинжалов! \` У вас меньше шестой части кинжалов!`
            );
          }
          if (
            data.class_stats.sword < data.class_stats.sword_max / 8 &&
            data.class_stats.sword !== 0
          ) {
            activities.push(
              `\` 🗡️ Оружие вот-вот сломается! \` У вас очень мало прочности!`
            );
          }
          if (
            data.class_stats.shield < data.class_stats.shield_max / 8 &&
            data.class_stats.shield !== 0
          ) {
            activities.push(
              `\` 🛡️ Щит вот-вот сломается! \` У вас очень мало прочности щита!`
            );
          }

          if (data.class.name == null) {
            rpg_embed.addFields([
              {
                name: "Добро пожаловать, путник!",
                value: `- Вижу, ты здесь впервые? Я помогу тебе освоиться для похода на монстров, но для начала выбери свой класс, чтобы я знал какие вещи тебе дать из моего рюкзака :3 `,

                inline: true,
              },
              {
                name: "При выборе своего КЛАССА:",
                value:
                  "**ВАЖНО!** Вы не сможете поменять свой класс в процессе игры. Выбирайте свой класс тщательно или вам придётся сбросить игру и проходить всё заново.",
                inline: true,
              },
            ]);

            let class_selector = new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId("rpg2_class")
                .setPlaceholder("Выберите класс")
                .addOptions(
                  new StringSelectMenuOptionBuilder()
                    .setLabel("Воин")
                    .setValue("1")
                    .setDescription(
                      "Вы склонны идти напролом! Отличный урон и здоровье!"
                    )
                    .setEmoji("🗡️"),
                  new StringSelectMenuOptionBuilder()
                    .setLabel("Маг")
                    .setValue("2")
                    .setDescription(
                      "Ваша магия способна поразить любого противника! Своя полоса манны"
                    )
                    .setEmoji("🔮"),
                  new StringSelectMenuOptionBuilder()
                    .setLabel("Стрелок")
                    .setValue("3")
                    .setDescription(
                      "Покажите мощь своих стрел! Попадайте врагам прямо в их головы!"
                    )
                    .setEmoji("🏹"),
                  new StringSelectMenuOptionBuilder()
                    .setLabel("Ниндзя")
                    .setValue("4")
                    .setDescription(
                      "Кидайте кинжалы и используйте компактный щит!"
                    )
                    .setEmoji("🔪"),
                  new StringSelectMenuOptionBuilder()
                    .setLabel("Вор")
                    .setValue("5")
                    .setDescription(
                      "Комбинируйте лук и меч! Возможность красть предметы у врагов!"
                    )
                    .setEmoji("🗡️"),
                  new StringSelectMenuOptionBuilder()
                    .setLabel("Танк")
                    .setValue("6")
                    .setDescription(
                      "Здоровье превосходит всех но маленький урон!"
                    )
                    .setEmoji("🛡️")
                )
            );

            return message.editReply(
              await client.tall(
                {
                  embeds: [rpg_embed],
                  ephemeral: true,
                  components: [class_selector],
                },
                message.locale
              )
            );
          }

          var class_ready = NaN;
          var bonus_info = NaN;
          var attack_btn = NaN;
          var attack_emoji = NaN;
          var bonus_button = NaN;

          switch (data.class.name) {
            case 1: {
              class_ready = "Воин";
              bonus_info = `🗡️ ${data.class_stats.sword_level} (${(
                data.class_stats.sword_level * 5 +
                data.class_stats.sword_level
              ).toFixed(1)} урона)\n🛡️ ${
                data.class_stats.shield_level
              }\`\`\`\`\`\`✊ Прочность меча: ${(
                (data.class_stats.sword / data.class_stats.sword_max) *
                100
              ).toFixed(0)}% (${data.class_stats.sword.toFixed(
                1
              )}/${data.class_stats.sword_max.toFixed(
                1
              )})\n🛡️ Прочность щита: ${(
                (data.class_stats.shield / data.class_stats.shield_max) *
                100
              ).toFixed(0)}% (${data.class_stats.shield.toFixed(
                1
              )}/${data.class_stats.shield_max.toFixed(1)})`;

              attack_btn = "Ударить мечом";
              attack_emoji = "🗡️";

              bonus_button = "Щит";
              break;
            }
            case 2: {
              var mana_ready = "";
              for (var i = 0; i < data.class_stats.mana_max; i = i + 3) {
                if (i < data.class_stats.mana) {
                  mana_ready = mana_ready + "💧";
                } else {
                  mana_ready = mana_ready + "🌫️";
                }
              }
              class_ready = "Маг";
              bonus_info = `🔮 ${data.class_stats.magic_level} (${(
                data.class_stats.magic_level * 4 +
                data.class_stats.magic_level
              ).toFixed(
                1
              )} маг. урона)\`\`\`\`\`\`🌊 Мана: ${data.class_stats.mana.toFixed(
                1
              )}/${data.class_stats.mana_max.toFixed(1)}\n${mana_ready}`;
              attack_btn = "Использовать посох";
              attack_emoji = "🔮";

              bonus_button = "Восполнить здоровье";
              break;
            }
            case 3: {
              (class_ready = "Стрелок"),
                (bonus_info = `🏹 ${data.class_stats.bow_level} (${(
                  data.class_stats.bow_level * 5 +
                  data.class_stats.bow_level
                ).toFixed(
                  1
                )} урона стрелы)\n🎒 Количество стрел: ${data.class_stats.arrows.toFixed(
                  0
                )}`);
              attack_btn = "Выстрелить";
              attack_emoji = "🏹";

              bonus_button = "Спрятаться";
              break;
            }
            case 4: {
              class_ready = "Ниндзя";
              bonus_info = `⚔️ ${data.class_stats.ninja_level} (${(
                data.class_stats.ninja_level * 4 +
                data.class_stats.ninja_level
              ).toFixed(1)} урона кинжалами)\n🛡️ ${
                data.class_stats.shield_level
              } (${data.class_stats.shield.toFixed(
                1
              )}/${data.class_stats.shield_max.toFixed(
                1
              )} прочности)\n🐱‍👤 Количество сюрикенов: ${data.class_stats.daggers.toFixed(
                0
              )}`;
              attack_btn = "Ударить кинжалами";
              attack_emoji = "⚔️";

              bonus_button = "Щит";
              break;
            }
            case 5: {
              (class_ready = "Вор"),
                (bonus_info = `🗡️ ${data.class_stats.sword_level} (${(
                  data.class_stats.sword_level * 4 +
                  data.class_stats.sword_level
                ).toFixed(1)} урона)\n🏹 ${data.class_stats.bow_level} (${(
                  data.class_stats.bow_level * 4 +
                  data.class_stats.bow_level
                ).toFixed(1)} урона стрелы)\n✊ Прочность кинжала: ${(
                  (data.class_stats.sword / data.class_stats.sword_max) *
                  100
                ).toFixed(
                  0
                )}%\n🎒 Количество стрел: ${data.class_stats.arrows.toFixed(
                  0
                )}`);
              attack_btn = "Ударить мечом";
              attack_emoji = "🗡️";
              bonus_button = "Выстрел с лука";
              break;
            }
            case 6: {
              class_ready = "Танк";
              bonus_info = `🔨 ${data.class_stats.sword_level} (${(
                data.class_stats.sword_level * 6 +
                data.class_stats.sword_level
              ).toFixed(1)} урона)\n🛡️ ${
                data.class_stats.shield_level
              }\`\`\`\`\`\`✊ Прочность молота: ${(
                (data.class_stats.sword / data.class_stats.sword_max) *
                100
              ).toFixed(0)}% (${data.class_stats.sword.toFixed(
                1
              )}/${data.class_stats.sword_max.toFixed(
                1
              )})\n🛡️ Прочность щита: ${(
                (data.class_stats.shield / data.class_stats.shield_max) *
                100
              ).toFixed(0)}% (${data.class_stats.shield.toFixed(
                1
              )}/${data.class_stats.shield_max.toFixed(1)})`;
              attack_btn = "Удар молотом";
              attack_emoji = "🔨";
              bonus_button = "Защититься";
              break;
            }
          }

          if (data.stones.level !== 0) {
            bonus_info += `\`\`\`\`\`\`💎 "${data.stones.name}" (${data.stones.level}LVL)\n- ${data.stones.xp_bonus}% к опыту\n- ${data.stones.gold_bonus}% к прибыли\n- ${data.stones.health_bonus}% к здоровью\n- ${data.stones.regeneration_bonus}% к регенерации`;
          }

          var outside_text = "";
          var mob_text = "";
          var home_text = "";

          var attack_toggler = true;
          if (data.mob.here === 1) {
            attack_toggler = false;
          }
          if (data.user.home === 2) {
            if (data.global_mob.here === 1) {
              attack_toggler = false;
            }
          }

          if (data.user.home === 1) {
            var user_health_bar = "";

            for (var i = 0; i < data.user.health_max; i++) {
              if (i < data.user.health_current) {
                if (i <= data.user.health_current - 100) {
                  user_health_bar += "💜";
                  i = i + 99;
                } else if (i <= data.user.health_current - 25) {
                  user_health_bar += "💛";
                  i = i + 19;
                } else if (i <= data.user.health_current - 5) {
                  i = i + 4;
                  user_health_bar += "🧡";
                } else if (i <= data.user.health_current - 2) {
                  user_health_bar += "💕";
                  i = i + 1;
                } else {
                  user_health_bar += "❤️";
                }
              }
            }

            let home_selector;
            let home_selector_2;
            if (data.user.mobile === 0) {
              home_selector = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel(
                    `Выйти (${data.location.fixed_distance.toFixed(
                      1
                    )}м) ${outside_text}`
                  )
                  .setEmoji("⚠")
                  .setCustomId("rpg2_home_exit"),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel("Кузница")
                  .setEmoji("🛠")
                  .setCustomId("rpg2_home_smith"),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel("Медик")
                  .setEmoji("💊")
                  .setCustomId("rpg2_home_medic"),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel("Оружейник")
                  .setEmoji("🔫")
                  .setCustomId("rpg2_home_gunsmith"),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel(`Колдун (3LVL+)`)
                  .setEmoji("🧙‍♂️")
                  .setCustomId("rpg2_home_mage")
              );
            }
            if (data.user.mobile === 1) {
              home_selector = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel(
                    `Выход (${data.location.fixed_distance.toFixed(
                      1
                    )}м) ${outside_text}`
                  )
                  .setEmoji("⚠")
                  .setCustomId("rpg2_home_exit"),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji("🛠")
                  .setCustomId("rpg2_home_smith"),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji("💊")
                  .setCustomId("rpg2_home_medic"),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji("🔫")
                  .setCustomId("rpg2_home_gunsmith"),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji("🧙‍♂️")
                  .setCustomId("rpg2_home_mage")
              );
            }

            var mobile_text = "ВЫКЛ";
            if (data.user.mobile === 1) {
              mobile_text = "ВКЛ";
            }

            if (data.user.mobile === 0) {
              home_selector_2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel(`Барыга (5LVL+)`)
                  .setEmoji("👨‍💼")
                  .setCustomId("rpg2_home_seller"),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel(`Астролог (10LVL+)`)
                  .setEmoji("🧙‍♂️")
                  .setCustomId("rpg2_home_astrologer"),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel(`Режим телефона (${mobile_text})`)
                  .setEmoji("📱")
                  .setCustomId("rpg2_home_phone"),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Danger)
                  .setLabel("Сбросить прогресс")
                  .setEmoji("🔄")
                  .setCustomId("rpg2_home_reset")
              );
            } else {
              home_selector_2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji("👨‍💼")
                  .setCustomId("rpg2_home_seller"),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji("🧙‍♂️")
                  .setCustomId("rpg2_home_astrologer"),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji("📱")
                  .setLabel(mobile_text)
                  .setCustomId("rpg2_home_phone"),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Danger)
                  .setEmoji("🔄")
                  .setCustomId("rpg2_home_reset")
              );
            }

            rpg_embed.addFields(
              {
                name: "Статистика",
                value: `\`\`\`\n🌠 ${data.user.level} уровень (${
                  data.user.xp
                }/${required}xp)\n🗺️ ${
                  data.location.level
                } ур. мира!\n👛 ${data.user.gold.toFixed(
                  1
                )} золота\`\`\`\`\`\`${class_ready}\n${bonus_info}\`\`\``,
                inline: true,
              },
              {
                name: "Характеристики",
                value: `\`\`\`${data.user.health_current.toFixed(
                  1
                )} / ${data.user.health_max.toFixed(
                  1
                )} здоровья\n${user_health_bar}\`\`\`\`\`\`- ${data.class.aim.toFixed(
                  0
                )} точность\n- ${data.class.regeneration.toFixed(
                  1
                )} здоровья за ход\n- ${data.class.defence.toFixed(
                  0
                )} ур. брони\n- ${data.class_stats.crit_percent.toFixed(
                  0
                )}% шанс крита\`\`\``,
                inline: true,
              }
            );

            if (data.user.mobile === 0) {
              rpg_embed.setImage(
                `https://luiishu535.files.wordpress.com/2014/11/holmint-1.png`
              );
            }
            if (data.user.mobile === 1) {
              rpg_embed.setThumbnail(
                `https://luiishu535.files.wordpress.com/2014/11/holmint-1.png`
              );
            }

            var easter = Math.floor(randomInteger(1, 100));
            if (easter === 1) {
              rpg_embed.addFields({
                name: `Кароче меченый!`,

                value:
                  "```\n- Я тебя спас, и в благородство играть не буду. Выполнишь для меня пару заданий, и мы в расчёте. Заодно посмотрим как быстро твоя башка после амнезии проясниться. А по твоей теме, постараюсь разузнать.```",
              });
            } else {
              rpg_embed.addFields({
                name: `Добро пожаловать в безопасную зону!`,
                value: `\`\`\`\n- Рады приветсвовать! Здесь вы сможете отдохнуть и набраться сил!\`\`\``,
              });
            }
            return message.editReply(
              await client.tall(
                {
                  embeds: [rpg_embed],
                  ephemeral: true,
                  components: [home_selector, home_selector_2],
                },
                message.locale
              )
            );
          }

          var universal_button = NaN;
          if (attack_toggler === false || data.user.home === 2) {
            if (data.user.mobile === 1) {
              universal_button = new ButtonBuilder()
                .setStyle(ButtonStyle.Danger)
                .setEmoji(attack_emoji)
                .setCustomId("rpg2_attack")
                .setDisabled(attack_toggler);
            } else {
              universal_button = new ButtonBuilder()
                .setStyle(ButtonStyle.Danger)
                .setLabel(attack_btn)
                .setEmoji(attack_emoji)
                .setCustomId("rpg2_attack")
                .setDisabled(attack_toggler);
            }
          } else {
            if (data.user.mobile === 1) {
              universal_button = new ButtonBuilder()
                .setStyle(ButtonStyle.Primary)
                .setEmoji("➡")
                .setCustomId("rpg2_walk");
            }
            if (data.user.mobile === 0) {
              universal_button = new ButtonBuilder()
                .setStyle(ButtonStyle.Primary)
                .setLabel("Идти вперёд")
                .setEmoji("➡")
                .setCustomId("rpg2_walk");
            }
          }

          var home_style = 1;
          var home_counter = "";
          if (data.location.fixed_distance !== data.location.distance) {
            home_style = 2;
            home_counter = `(${data.location.distance.toFixed(1)}м)`;
          }

          var homebtn = NaN;

          if (data.user.home === 2) {
            homebtn = new ButtonBuilder()
              .setStyle(ButtonStyle.Danger)
              .setLabel("ВЫЙТИ" + outside_text)
              .setEmoji("🔎")
              .setCustomId("rpg2_global_leave");
          } else {
            homebtn = new ButtonBuilder()
              .setStyle(home_style)
              .setLabel(`Домой ${home_counter}` + home_text)
              .setEmoji("🔎")
              .setCustomId("rpg2_home");
          }

          var default_controls = new ActionRowBuilder().addComponents(
            homebtn,
            universal_button
          );

          if (data.location.inactive > 6) {
            default_controls.addComponents([
              new ButtonBuilder()
                .setStyle(ButtonStyle.Secondary)
                .setLabel("Найти моба")
                .setEmoji("🔎")
                .setCustomId("rpg2_walk_bonus"),
            ]);
          }

          var counter = " ";
          var bonus_disabled = false;
          var bonus_style = 1;
          if (data.cooldown > 0) {
            counter = `(${data.cooldown})`;
            attack_emoji = "⏳";
            bonus_disabled = true;
            bonus_style = 2;
          }

          if (data.user.mobile === 0) {
            default_controls.addComponents([
              new ButtonBuilder()
                .setStyle(bonus_style)
                .setLabel(`${bonus_button} ${counter}`)
                .setCustomId("rpg2_bonus_attack")
                .setDisabled(bonus_disabled)
                .setEmoji(attack_emoji),
            ]);
          }
          if (data.user.mobile === 1) {
            default_controls.addComponents([
              new ButtonBuilder()
                .setStyle(bonus_style)
                .setLabel(counter)
                .setEmoji(attack_emoji)
                .setCustomId("rpg2_bonus_attack")
                .setDisabled(bonus_disabled),
            ]);
          }

          if (data.class.name === 5) {
            if (data.mob.here === 1) {
              if (!data?.crime) {
                var chance = Math.floor(randomInteger(1, 35));
                if (chance === 1) {
                  await client.fdb.set(`${key}.crime`, 1, "rpg_clicker2");
                  data.crime = 1;
                }
              }
            }
          }

          if (data.crime) {
            default_controls.addComponents([
              new ButtonBuilder()
                .setStyle(ButtonStyle.Primary)
                .setLabel(`Ограбить`)
                .setEmoji("🔎")
                .setCustomId("rpg2_crime"),
            ]);
          }

          var i = 0;

          async function inventory(item, label, emoji) {
            if (data.class_stats[`${item}`] > 0) {
              if (data.user.mobile === 0) {
                return new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel(`${label} ` + `(${data.class_stats[`${item}`]})`)
                  .setEmoji(emoji)
                  .setCustomId(`rpg2_inventory_${item}`);
              }
              if (data.user.mobile === 1) {
                return new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel(`(${data.class_stats[`${item}`]})`)
                  .setEmoji(emoji)
                  .setCustomId(`rpg2_inventory_${item}`);
              }
            } else {
              i++;
              return new ButtonBuilder()
                .setStyle(ButtonStyle.Secondary)
                .setLabel(`  `)
                .setCustomId(`rpg2_nan_${i}`)
                .setEmoji(emoji)
                .setDisabled(true);
            }
          }

          var inventory_controls = new ActionRowBuilder().addComponents(
            await inventory("mana_bottle", "Зелье манны", "🌊"),
            await inventory("health_bottle", "Зелье здоровья", "💊"),
            await inventory("durability_bottle", "Комплект починки", "🔧"),
            await inventory("bomb", "Бомба", "💣"),
            await inventory("ammo_box", "Патроны", "🎯")
          );
          var third_controls = NaN;

          async function dungeon() {
            if (data.user.home === 0) {
              if (data.global_mob.here === 1) {
                return new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel(
                    `БОСС (${data.global_mob.health.toFixed(1)}🖤) ${mob_text}`
                  )
                  .setEmoji("🔎")
                  .setCustomId("rpg2_walk_boss");
              } else {
                return new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel(`БОСС скоро появится`)
                  .setEmoji("🔎")
                  .setCustomId("rpg2_walk_boss")

                  .setDisabled(true);
              }
            } else {
              return new ButtonBuilder()
                .setStyle(ButtonStyle.Secondary)
                .setLabel("Вы уже здесь")
                .setEmoji("🔎")
                .setCustomId("rpg2_walk_boss")

                .setDisabled(true);
            }
          }

          if (data.user.home !== 1) {
            var third_controls = new ActionRowBuilder().addComponents(
              await dungeon()
            );
          }

          data = await client.fdb.get(`${key}`, `rpg_clicker2`, true);

          var mob_health_bar = "";

          async function generate_health_bar(item) {
            for (var i = 0; i < item; i++) {
              if (i < item - 2500) {
                mob_health_bar = mob_health_bar = "🧡";
                i = i + 2500;
              } else if (i < item - 1000) {
                mob_health_bar = mob_health_bar = "💛";
                i = i + 1000;
              } else if (i < item - 500) {
                mob_health_bar = mob_health_bar = "💚";
                i = i + 500;
              } else if (i < item - 250) {
                mob_health_bar = mob_health_bar = "💙";
                i = i + 250;
              } else if (i < item - 100) {
                mob_health_bar = mob_health_bar = "💜";
                i = i + 100;
              } else if (i < item - 50) {
                mob_health_bar = mob_health_bar + "❤️";
                i = i + 50;
              } else if (i < item - 25) {
                mob_health_bar = mob_health_bar + "🤍";
                i = i + 25;
              } else if (i < item - 10) {
                mob_health_bar = mob_health_bar + "🤎";
                i = i + 10;
              } else {
                mob_health_bar = mob_health_bar + "🖤";
              }
            }
          }

          if (data.mob.here === 1 && data.user.home === 0) {
            await generate_health_bar(data.mob.health);
          } else if (data.user.home === 2 && data.global_mob.here === 1) {
            await generate_health_bar(data.global_mob.health);
          }

          var mob_info = "";
          if (data.user.home === 2 && data.global_mob.here === 1) {
            mob_info = `\`\`\`${mob_health_bar}\`\`\`\n\`\`\`\n${
              data.global_mob.name
            }\n- Урон: ${data.global_mob.damage.toFixed(
              2
            )}\n- ${data.global_mob.health.toFixed(
              1
            )} / ${data.global_mob.health_max.toFixed(
              1
            )}\`\`\`\n\`${data.global_mob.regeneration.toFixed(
              2
            )} здоровья в секунду\` \`${data.global_mob.armor.toFixed(
              1
            )} ур. брони\` \`${data.global_mob.aim.toFixed(1)} точность\``;
          } else if (data.mob.here === 1 && data.user.home === 0) {
            mob_info = `\`\`\`\n${mob_health_bar}\`\`\`\n\`\`\`\n🤖 Моб: "${
              data.mob.name
            }" (${
              (data.user.level + data.location.level) / 2
            } lvl)\n- Урон: ${Number(data.mob.damage || "?").toFixed(
              1
            )}\n- ${Number(data.mob.health || "?").toFixed(1)} / ${Number(
              data.mob.health_max || "?"
            ).toFixed(1)} ❤️\`\`\`\n\`${Number(
              data.mob.regeneration || "?"
            ).toFixed(1)} здоровья за ход\` \`${
              data.mob.defence
            } ур. брони\` \`${data.mob.aim} ур. точности\``;
          } else {
            mob_info = `\`\`\`\nМоба рядом пока-что нет.\`\`\``;
          }

          if (data.user.home === 2) {
            rpg_embed.addFields(
              {
                name: "БОСС",
                value: `\`\`\`\n🗺️ Вы сражаетесь с боссом ${data.global_mob.name}!\`\`\``,
              },
              {
                name: "Ваш персонаж",
                value: `\`\`\`\nКласс: ${class_ready}\n${bonus_info}\`\`\`\`\`\`\n❤️ ${data.user.health_current.toFixed(
                  1
                )} / ${data.user.health_max.toFixed(
                  1
                )} здоровья\n👛 ${data.user.gold.toFixed(1)} золота\n🧭 ${
                  data.user.level
                } уровень\n🧮 ${data.user.xp.toFixed(1)} / ${required.toFixed(
                  1
                )} опыта\`\`\`\`${
                  data.class.aim
                } точность\` \`${data.class.regeneration.toFixed(
                  1
                )} здоровья за ход\`\n\`${data.class.defence.toFixed(
                  0
                )} ур. брони\` \`${data.class_stats.crit_percent.toFixed(
                  0
                )}% шанс крита\``,
                inline: true,
              },
              {
                name: "Информация о боссе",
                value: `${mob_info}`,
                inline: true,
              }
            );
          } else {
            rpg_embed.addFields(
              {
                name: "Путешествия",
                value: `\`\`\`\n🗺️ "${data.location.name || "Без названия"}" (${
                  data.location.level || 0
                } уровень)\nПройдено: ${
                  data.location.distance.toFixed(0) || 0
                } м\nДо повышения уровня мира: ${(
                  data.location.distance_to - data.location.fixed_distance
                ).toFixed(0)} метров\`\`\``,
              },
              {
                name: "Ваш персонаж",
                value: `\`\`\`\nКласс: ${class_ready}\n${bonus_info}\`\`\`\`\`\`\n❤️ ${data.user.health_current.toFixed(
                  1
                )} / ${data.user.health_max.toFixed(
                  1
                )} здоровья\n👛 ${data.user.gold.toFixed(1)} золота\n🧭 ${
                  data.user.level
                } уровень\n🧮 ${data.user.xp.toFixed(1)} / ${required.toFixed(
                  1
                )} опыта\`\`\`\`${
                  data.class.aim
                } точность\` \`${data.class.regeneration.toFixed(
                  1
                )} здоровья за ход\`\n\`${data.class.defence.toFixed(
                  0
                )} ур. брони\` \`${data.class_stats.crit_percent.toFixed(
                  0
                )}% шанс крита\``,

                inline: true,
              },
              {
                name: "Информация врага",
                value: `${mob_info}`,
                inline: true,
              }
            );
            if (data.location.distance < data.location.fixed_distance) {
              if ((await client.fdb.get(`${data.user.home}`)) !== 1) {
                rpg_embed.addFields({
                  name: "Вы идёте домой!",
                  value: `\`\`\`\nПродолжайте идти что-бы вернуться в безопасную зону!\`\`\``,
                });
              }
            }

            if (data.user.home === 0) {
              if (data.user.mobile === 0) {
                rpg_embed.setImage(`${data.location.wallpaper_link}`);
              }
              if (data.user.mobile === 1) {
                rpg_embed.setThumbnail(`${data.location.wallpaper_link}`);
              }
            }
            if (data.user.home === 2) {
              if (data.user.mobile === 0) {
                rpg_embed.setImage(
                  `${
                    (await client.fdb.get(`${key}.global_mob.wallpaper_link`),
                    "rpg_clicker2")
                  }`
                );
              }
              if (data.user.mobile === 1) {
                rpg_embed.setThumbnail(
                  `${
                    (await client.fdb.get(`${key}.global_mob.wallpaper_link`),
                    "rpg_clicker2")
                  }`
                );
              }
            }
          }

          if (activities.length > 0) {
            const translatedLines = await Promise.all(
              activities.map(
                async (line) =>
                  await (
                    await client.tall({ content: line }, message.locale)
                  ).content
              )
            );
            const translatedActivityfeed = translatedLines.join("\n");

            rpg_embed.addFields({
              name: "Активность",
              value: `!!!  ${translatedActivityfeed}`,
            });
          }

          return message.editReply(
            await client.tall(
              {
                embeds: [rpg_embed],
                ephemeral: true,
                components: [
                  default_controls,
                  inventory_controls,
                  third_controls,
                ],
              },
              message.locale
            )
          );
        }

        await main();
        collector = await client.ez_collector(
          "rpg2",
          message,
          message.user,
          60000
        );
        collector.on("collect", async (collected) => {
          if (collected.isStringSelectMenu()) {
            if (await client.fdb.get(`${key}.class.name`, "rpg_clicker2")) {
              return collected.reply({
                content: "Вы уже выбрали ваш класс!",
                ephemeral: true,
              });
            }
            var value = collected.values[0];
            var data = await client.fdb.get(`${key}`, "rpg_clicker2", true);
            var user = data.user;

            if (value === "1") {
              await client.fdb.set(`${key}.class.name`, 1, "rpg_clicker2");
              await client.fdb.set(`${key}.class.aim`, 2, "rpg_clicker2");
              await client.fdb.set(
                `${key}.class.regeneration`,
                0.1,
                "rpg_clicker2"
              );
              await client.fdb.set(`${key}.class.defence`, 2, "rpg_clicker2");
              await client.fdb.set(`${key}.class.health`, 1, "rpg_clicker2");
            } else if (value === "2") {
              await client.fdb.set(`${key}.class.name`, 2, "rpg_clicker2");
              await client.fdb.set(`${key}.class.aim`, 3, "rpg_clicker2");
              await client.fdb.set(
                `${key}.class.regeneration`,
                0.3,
                "rpg_clicker2"
              );
              await client.fdb.set(`${key}.class.defence`, 2, "rpg_clicker2");
              await client.fdb.set(`${key}.class.health`, 0.6, "rpg_clicker2");
              await client.fdb.set(
                `${key}.user.health_current`,
                user.health_max * 0.6,
                "rpg_clicker2"
              );
              await client.fdb.set(
                `${key}.user.health_max`,
                user.health_max * 0.6,
                "rpg_clicker2"
              );
            } else if (value === "3") {
              await client.fdb.set(`${key}.class.name`, 3, "rpg_clicker2");
              await client.fdb.set(`${key}.class.aim`, 4, "rpg_clicker2");
              await client.fdb.set(
                `${key}.class.regeneration`,
                0.3,
                "rpg_clicker2"
              );
              await client.fdb.set(`${key}.class.defence`, 1, "rpg_clicker2");
              await client.fdb.set(`${key}.class.health`, 0.7, "rpg_clicker2");
              await client.fdb.set(
                `${key}.user.health_current`,
                user.health_max * 0.7,
                "rpg_clicker2"
              );
              await client.fdb.set(
                `${key}.user.health_max`,
                user.health_max * 0.7,
                "rpg_clicker2"
              );
            } else if (value === "4") {
              await client.fdb.set(`${key}.class.name`, 4, "rpg_clicker2");
              await client.fdb.set(`${key}.class.aim`, 4, "rpg_clicker2");
              await client.fdb.set(
                `${key}.class.regeneration`,
                0.2,
                "rpg_clicker2"
              );
              await client.fdb.set(`${key}.class.defence`, 2, "rpg_clicker2");
              await client.fdb.set(`${key}.class.health`, 0.5, "rpg_clicker2");
              await client.fdb.set(
                `${key}.user.health_current`,
                user.health_max * 0.5,
                "rpg_clicker2"
              );
              await client.fdb.set(
                `${key}.user.health_max`,
                user.health_max * 0.5,
                "rpg_clicker2"
              );
            } else if (value === "5") {
              await client.fdb.set(`${key}.class.name`, 5, "rpg_clicker2");
              await client.fdb.set(`${key}.class.aim`, 3, "rpg_clicker2");
              await client.fdb.set(
                `${key}.class.regeneration`,
                0.1,
                "rpg_clicker2"
              );
              await client.fdb.set(`${key}.class.defence`, 1, "rpg_clicker2");
              await client.fdb.set(`${key}.class.health`, 0.6, "rpg_clicker2");
              await client.fdb.set(
                `${key}.user.health_current`,
                user.health_max * 0.6,
                "rpg_clicker2"
              );
              await client.fdb.set(
                `${key}.user.health_max`,
                user.health_max * 0.6,
                "rpg_clicker2"
              );
            } else if (value === "6") {
              await client.fdb.set(`${key}.class.name`, 6, "rpg_clicker2");
              await client.fdb.set(`${key}.class.aim`, 1, "rpg_clicker2");
              await client.fdb.set(
                `${key}.class.regeneration`,
                0.05,
                "rpg_clicker2"
              );
              await client.fdb.set(`${key}.class.defence`, 4, "rpg_clicker2");
              await client.fdb.set(`${key}.class.health`, 2, "rpg_clicker2");
              await client.fdb.set(
                `${key}.user.health_current`,
                user.health_max * 2,
                "rpg_clicker2"
              );
              await client.fdb.set(
                `${key}.user.health_max`,
                user.health_max * 2,
                "rpg_clicker2"
              );
            }
            await collected.deferUpdate();
            await main();
          }

          async function enemy_attack() {
            var data = await client.fdb.get(`${key}`, "rpg_clicker2", true);
            if (data.mob.here === 1 || data.user.home !== 1) {
              if (data.user.home === 2) {
                var defence_ready = randomInteger(
                  0,
                  data.class.defence + data.class.defence
                );
              } else {
                var defence_ready = randomInteger(
                  0,
                  data.class.defence + data.mob.defence
                );
              }
              console.log(defence_ready, data.class.defence + data.mob.defence);

              if (
                data.mob.here === 1 ||
                (data.user.home === 2 && data.global_mob.here === 1)
              ) {
                var ignore = NaN;
                if (defence_ready < data.class.defence) {
                  ignore = true;
                  await client.fdb.set(
                    `${key}.enemy_failure`,
                    1,
                    "rpg_clicker2"
                  );
                } else {
                  await client.fdb.set(
                    `${key}.class_stats.combo`,
                    0,
                    "rpg_clicker2"
                  );
                }
                if (ignore !== true) {
                  if (data.user.home === 2) {
                    await client.fdb.dec(
                      `${key}.user.health_current`,
                      data.global_mob.damage,
                      "rpg_clicker2"
                    );
                  } else {
                    await client.fdb.dec(
                      `${key}.user.health_current`,
                      data.mob.damage,
                      "rpg_clicker2"
                    );
                  }
                }
              }
            }
            if (data.mob.health < data.mob.health_max - data.mob.regeneration) {
              await client.fdb.inc(`${key}.mob.health`, data.mob.regeneration);
            }
            if (data.user.home === 2) {
              if (
                data.global_mob.health <
                data.global_mob.health_max - data.global_mob.regeneration
              ) {
                await client.fdb.inc(
                  `global_mob.health`,
                  data.global_mob.regeneration
                );
              }
            }
          }

          async function walking(activated) {
            var data = await client.fdb.get(`${key}`, "rpg_clicker2", true);
            if (data.location.distance > data.location.fixed_distance) {
              await client.fdb.set(
                `${key}.location.fixed_distance`,
                data.location.distance,
                "rpg_clicker2"
              );
            }
            if (activated === true && data.mob.here === 1) {
              return client.reply(collected, {
                content: "Сначало разберитесь с этим мобом.",
                locale: message.locale,
                ephemeral: true,
              });
            }
            if (data.class_stats.mana < 0) {
              await client.fdb.set(`${key}.user.mana`, 0, "rpg_clicker2");
            }
            if (
              data.class_stats.mana <
              data.class_stats.mana_max -
                (data.class_stats.magic_upgrade - 1) / 2
            ) {
              await client.fdb.set(
                `${key}.class_stats.mana`,
                data.class_stats.mana +
                  1 +
                  (data.class_stats.magic_upgrade - 1) / 2,
                "rpg_clicker2"
              );
            }
            if (
              data.class_stats.mana < data.class_stats.mana_max &&
              data.class_stats.mana >
                data.class_stats.mana_max -
                  (data.class_stats.magic_upgrade - 1) / 2
            ) {
              await client.fdb.inc(
                `${key}.class_stats.mana`,
                data.class_stats.mana_max
              );
            }
            if (
              data.user.health_current <
              data.user.health_max - data.class.regeneration
            ) {
              await client.fdb.inc(
                `${key}.user.health_current`,
                data.class.regeneration
              );
            }
            if (
              data.user.health_current < data.user.health_max &&
              data.user.health_current >
                data.user.health_max - data.class.regeneration
            ) {
              await client.fdb.set(
                `${key}.user.health_current`,
                data.user.health_max
              );
            }
            await client.fdb.inc(`${key}.location.inactive`, 1, "rpg_clicker2");

            if (data.mob.here === 0) {
              var walk = randomInteger(1, 5);
              var boss = randomInteger(1, 40);
              if (activated == true) {
                walk = randomInteger(1, 2);
                boss = randomInteger(1, 5);
                if (boss != 1 && walk != 1) {
                  walk = 1;
                }
              }
            }

            let first_word = [
              `Адский`,
              `Иссушенный`,
              `Раскалённый`,
              `Страшный`,
              `Устрашающий`,
              `Пугливый`,
              `Магический`,
            ];
            let second_word = [
              `вождь`,
              `скелет`,
              `киккик`,
              `скорострел`,
              `прыгун`,
              `страж`,
              `маг`,
              `заросший голем`,
            ];

            var name = `${
              first_word[Math.floor(Math.random() * first_word.length)]
            } ${second_word[Math.floor(Math.random() * second_word.length)]}`;

            if (walk === 1 || boss === 1) {
              await client.fdb.set(
                `${key}.location.inactive`,
                0,
                "rpg_clicker2"
              );
            }
            console.log(`DATA LOCATION LEVEL`);
            console.log(data.location.level);
            if (walk === 1) {
              await client.fdb.set(`${key}.mob.name`, name, "rpg_clicker2");
              await client.fdb.set(
                `${key}.mob.defence`,
                randomInteger(1, data.location.level),
                "rpg_clicker2"
              );
              await client.fdb.set(
                `${key}.mob.health`,
                randomInteger(
                  10 * data.location.level,
                  (13 + 10 * data.location.level) *
                    (1 + data.location.level / 3)
                ),
                "rpg_clicker2"
              );
              if (
                (await client.fdb.get(`${key}.mob.health`)) <
                (await client.fdb.get(`${key}.user.health_max`)) / 2
              ) {
                await client.fdb.set(
                  `${key}.mob.health`,
                  (await client.fdb.get(`${key}.user.health_max`)) / 2
                ),
                  "rpg_clicker2";
              }
              await client.fdb.set(
                `${key}.mob.damage`,
                randomInteger(
                  3 * data.location.level,
                  5 * data.location.level
                ) / 10,
                "rpg_clicker2"
              );
              await client.fdb.set(
                `${key}.mob.health_max`,
                await client.fdb.get(`${key}.mob.health`),
                "rpg_clicker2"
              );
              await client.fdb.set(
                `${key}.mob.regeneration`,
                randomInteger(1, data.location.level + 1) / 5,
                "rpg_clicker2"
              );
              await client.fdb.set(`${key}.mob.here`, 1);
            } else if (boss === 1) {
              await client.fdb.set(
                `${key}.mob.name`,
                name + " [BOSS]",
                "rpg_clicker2"
              );
              await client.fdb.set(
                `${key}.mob.defence`,
                randomInteger(1, data.location.level) * 2,
                "rpg_clicker2"
              );
              await client.fdb.set(
                `${key}.mob.health`,
                randomInteger(
                  20 * data.location.level,
                  (25 + 10 * data.location.level) * data.location.level,
                  "rpg_clicker2"
                )
              );
              await client.fdb.set(
                `${key}.mob.damage`,
                randomInteger(
                  6 * data.location.level,
                  9 * data.location.level
                ) / 10,
                "rpg_clicker2"
              );
              await client.fdb.set(
                `${key}.mob.health_max`,
                await client.fdb.get(`${key}.mob.health`),
                "rpg_clicker2"
              );
              await client.fdb.set(
                `${key}.mob.regeneration`,
                (randomInteger(1, data.location.level + 1) / 5) * 3,
                "rpg_clicker2"
              );
              await client.fdb.set(
                `${key}.mob.aim`,
                randomInteger(
                  2,
                  1 + data.location.level * (1 + data.location.level / 6),
                  "rpg_clicker2"
                )
              );
              await client.fdb.set(`${key}.mob.here`, 1, "rpg_clicker2");
            }
          }

          if (collected.isButton()) {
            await enemy_attack();
            let data = await client.fdb.get(`${key}`, "rpg_clicker2", true);
            if (collected.customId.includes("global")) {
              if (data.user.home !== 2) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "Вы не находитесь в поле с глобальными мобами!",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
            }
            if (
              collected.customId.includes("home") &&
              !collected.customId === "rpg2_home"
            ) {
              if (data.user.home !== 1) {
                return collected.reply(
                  await client.tall(
                    {
                      content:
                        "Вы не находитесь дома и не можете использовать эту кнопку",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
            }
            var array_outside = ["bonus", "attack", "walk", "inventory"];
            var boss = ["bonus", "attack", "inventory"];
            if (
              array_outside.some((array) => collected.customId.includes(array))
            ) {
              if (data.user.home === 2) {
                if (boss.some((boss) => collected.customId.includes(boss))) {
                } else {
                  return collected.reply(
                    await client.tall(
                      {
                        content:
                          "Нельзя использовать эту кнопку, находясь у босса!",
                        ephemeral: true,
                      },
                      message.locale
                    )
                  );
                }
              } else if (data.user.home !== 0) {
                return collected.reply(
                  await client.tall(
                    {
                      content:
                        "Вы находитесь дома и не можете использовать эту кнопку",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
            }
          }

          data = await client.fdb.get(`${key}`, "rpg_clicker2", true);
          switch (collected.customId) {
            case "rpg2_home_exit": {
              await client.fdb.set(
                `${key}.location.distance`,
                data.location.fixed_distance
              );
              await client.fdb.set(`${key}.user.home`, 0);
              break;
            }
            case "rpg2_bonus_attack": {
              if (data?.cooldown > 0) {
                return collected.reply(
                  await client.tall(
                    {
                      content: `Вы не можете сейчас использовать это! Вам необходимо сделать ещё ${data.cooldown} ходов`,
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              switch (data.class.name) {
                case 1: {
                  if (data.class_stats.shield > 0) {
                    if (
                      data.user.health_current >
                      data.user.health_max -
                        4 * (0.5 + data.class_stats.shield_level / 2)
                    ) {
                      return collected.reply(
                        await client.tall(
                          {
                            content: "Вы уже здоровы",
                            ephemeral: true,
                          },
                          message.locale
                        )
                      );
                    }
                    await client.fdb.set(
                      `${key}.user.health_current`,
                      data.user.health_current +
                        4 * (0.5 + data.class_stats.shield_level / 2)
                    );
                    await client.fdb.dec(
                      `${key}.class_stats.shield`,
                      1,
                      "rpg_clicker2"
                    );
                  } else {
                    return collected.reply(
                      await client.tall(
                        {
                          content: "Ваш щит больше не исправен!",
                          ephemeral: true,
                        },
                        message.locale
                      )
                    );
                  }
                  break;
                }
                case 2: {
                  if (
                    (await client.fdb.get(
                      `${key}.class_stats.mana`,
                      "rpg_clicker2"
                    )) > 3
                  ) {
                    if (
                      data.user.health_current >
                      data.user.health_max -
                        6 * (0.5 + data.class_stats.magic_level / 2)
                    ) {
                      return collected.reply(
                        await client.tall(
                          {
                            content: "Вы уже здоровы",
                            ephemeral: true,
                          },
                          message.locale
                        )
                      );
                    }
                    await client.fdb.set(
                      `${key}.user.health_current`,
                      data.user.health_current +
                        6 * (0.5 + data.class_stats.magic_level / 2)
                    );
                    await client.fdb.set(
                      `${key}.class_stats.mana`,
                      (await client.fdb.get(`${key}.class_stats.mana`)) - 3,
                      "rpg_clicker2"
                    );
                  } else {
                    return collected.reply(
                      await client.tall(
                        {
                          content: "У вас недостаточно маны!",
                          ephemeral: true,
                        },
                        message.locale
                      )
                    );
                  }
                  break;
                }
                case 3: {
                  if (data.user.health_current > data.user.health_max - 3) {
                    return collected.reply(
                      await client.tall(
                        {
                          content: "Вы уже здоровы",
                          ephemeral: true,
                        },
                        message.locale
                      )
                    );
                  }
                  await client.fdb.set(
                    `${key}.user.health_current`,
                    data.user.health_current +
                      3 * ((0.5 * data.class_stats.bow_level) / 2)
                  );
                  break;
                }
                case 4: {
                  if (
                    (await client.fdb.get(
                      `${key}.class_stats.shield`,
                      "rpg_clicker2"
                    )) > 0
                  ) {
                    if (
                      data.user.health_current >
                      data.user.health_max -
                        3 * (0.5 + data.class_stats.shield_level / 2)
                    ) {
                      return collected.reply(
                        await client.tall(
                          {
                            content: "Вы уже здоровы",
                            ephemeral: true,
                          },
                          message.locale
                        )
                      );
                    }
                    await client.fdb.set(
                      `${key}.user.health_current`,
                      data.user.health_current +
                        3 * (0.5 + data.class_stats.shield_level / 2)
                    );
                    await client.fdb.dec(
                      `${key}.class_stats.shield`,
                      1,
                      "rpg_clicker2"
                    );
                  } else {
                    return collected.reply(
                      await client.tall(
                        {
                          content: "Ваш щит больше не исправен!",
                          ephemeral: true,
                        },
                        message.locale
                      )
                    );
                  }
                  break;
                }
                case 5: {
                  if (
                    (await client.fdb.get(
                      `${key}.class_stats.arrows`,
                      "rpg_clicker2"
                    )) > 1
                  ) {
                    var damage =
                      data.class_stats.bow_level * 4 +
                      data.class_stats.bow_level;
                    if (
                      (await client.fdb.get(`${key}.mob.here`)) === 1 ||
                      (await client.fdb.get(`${key}.user.home`)) === 2
                    ) {
                      if ((await client.fdb.get(`${key}.user.home`)) === 2) {
                        var mob_health = await client.fdb.get(
                          `global_mob.health`
                        );
                        await client.fdb.dec(
                          `global_mob.health`,
                          damage,
                          "rpg_clicker2"
                        );
                      } else {
                        var mob_health = await client.fdb.get(
                          `${key}.mob.health`
                        );
                        await client.fdb.dec(
                          `${key}.mob.health`,
                          damage,
                          "rpg_clicker2"
                        );
                      }
                    }
                    await client.fdb.set(
                      `${key}-damage_bow`,
                      damage,
                      "rpg_clicker2"
                    );
                    await client.fdb.dec(
                      `${key}.class_stats.arrows`,
                      1,
                      "rpg_clicker2"
                    );
                  } else {
                    return collected.reply(
                      await client.tall(
                        {
                          content: "У вас не осталось стрел...",
                          ephemeral: true,
                        },
                        message.locale
                      )
                    );
                  }
                  break;
                }
                case 6: {
                  if (
                    (await client.fdb.get(
                      `${key}.class_stats.shield`,
                      "rpg_clicker2"
                    )) > 0
                  ) {
                    if (
                      data.user.health_current >
                      data.user.health_max -
                        6 * (0.5 + data.class_stats.shield_level / 2)
                    ) {
                      return collected.reply(
                        await client.tall(
                          {
                            content: "Вы уже здоровы",
                            ephemeral: true,
                          },
                          message.locale
                        )
                      );
                    }
                    await client.fdb.set(
                      `${key}.user.health_current`,
                      data.user.health_current +
                        6 * (0.5 + data.class_stats.shield_level / 2)
                    );
                    await client.fdb.dec(
                      `${key}.class_stats.shield`,
                      1,
                      "rpg_clicker2"
                    );
                  } else {
                    return collected.reply(
                      await client.tall(
                        {
                          content: "Ваш щит больше не исправен!",
                          ephemeral: true,
                        },
                        message.locale
                      )
                    );
                  }
                  break;
                }
              }
              await client.fdb.set(`${key}-cooldown`, 10);
            }
            case "rpg2_attack": {
              if (
                (await client.fdb.get(`${key}.mob.here`)) !== 1 &&
                (await client.fdb.get(`${key}.user.home`)) !== 2
              ) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "Вы не видите никакого монстра",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              var your_damage = 0;
              var crit = 0;
              await client.fdb.inc(
                `${key}.class_stats.combo`,
                1,
                "rpg_clicker2"
              );
              switch (data.class.name) {
                case 1: {
                  if (data.class_stats.sword > 0) {
                    your_damage =
                      data.class_stats.sword_level * 5 +
                      data.class_stats.sword_level;
                    await client.fdb.dec(
                      `${key}.class_stats.sword`,
                      1,
                      "rpg_clicker2"
                    );
                  } else {
                    return collected.reply(
                      await client.tall(
                        {
                          content: "У вас сломан меч.. БЕГИ!",
                          ephemeral: true,
                        },
                        message.locale
                      )
                    );
                  }
                  break;
                }
                case 2: {
                  if (data.class_stats.mana > 0) {
                    your_damage =
                      data.class_stats.magic_level * 4 +
                      data.class_stats.magic_level;
                    await client.fdb.dec(
                      `${key}.class_stats.mana`,
                      2,
                      "rpg_clicker2"
                    );
                  } else {
                    return collected.reply(
                      await client.tall(
                        {
                          content: `У вас кончилась мана.. ОСТУПИТЕ!`,
                          ephemeral: true,
                        },
                        message.locale
                      )
                    );
                  }
                  break;
                }
                case 3: {
                  if (data.class_stats.arrows > 0) {
                    your_damage =
                      data.class_stats.bow_level * 5 +
                      data.class_stats.bow_level;
                    await client.fdb.dec(
                      `${key}.class_stats.arrows`,
                      1,
                      "rpg_clicker2"
                    );
                  } else {
                    return collected.reply(
                      await client.tall(
                        {
                          content: `У тебя кончились стрелы... БЕГИ!`,
                          ephemeral: true,
                        },
                        message.locale
                      )
                    );
                  }
                  break;
                }
                case 4: {
                  if (data.class_stats.daggers > 0) {
                    your_damage =
                      data.class_stats.ninja_level * 4 +
                      data.class_stats.ninja_level;
                    await client.fdb.dec(
                      `${key}.class_stats.daggers`,
                      1,
                      "rpg_clicker2"
                    );
                  } else {
                    return collected.reply(
                      await client.tall(
                        {
                          content: `У тебя кончились кинжалы... БЕГИ!`,
                          ephemeral: true,
                        },
                        message.locale
                      )
                    );
                  }
                  break;
                }
                case 5: {
                  if (data.class_stats.sword > 0) {
                    your_damage =
                      data.class_stats.sword_level * 4 +
                      data.class_stats.sword_level;
                    await client.fdb.dec(
                      `${key}.class_stats.sword`,
                      1,
                      "rpg_clicker2"
                    );
                  } else {
                    return collected.reply(
                      await client.tall(
                        {
                          content: "У вас сломан кинжал.. БЕГИ!",
                          ephemeral: true,
                        },
                        message.locale
                      )
                    );
                  }
                  break;
                }
                case 6: {
                  if (data.class_stats.sword > 0) {
                    your_damage =
                      data.class_stats.sword_level * 6 +
                      data.class_stats.sword_level;
                    await client.fdb.dec(
                      `${key}.class_stats.sword`,
                      1,
                      "rpg_clicker2"
                    );
                  } else {
                    return collected.reply(
                      await client.tall(
                        {
                          content: "У вас сломан молот.. БЕГИ!",
                          ephemeral: true,
                        },
                        message.locale
                      )
                    );
                  }
                  break;
                }
              }
              var crit_percent = data.class_stats.crit_percent;
              var crit_ready = randomInteger(0, 100);
              if (crit_ready < crit_percent) {
                your_damage = your_damage * 2;
                crit = 1;
              }
              if (data.class_stats.combo > 1) {
                your_damage = your_damage * (1 + data.class_stats.combo / 4);
                await client.fdb.set(`${key}.combo`, data.class_stats.combo);
              }
              console.log(`COMBO: ` + data.class_stats.combo);
              console.log("!!! ", your_damage);
              var aim = 0;
              if ((await client.fdb.get(`${key}.user.home`)) === 2) {
                aim = randomInteger(0, data.class.aim + data.class.aim);
              } else {
                aim = randomInteger(0, data.mob.aim + data.class.aim);
              }
              if (aim > data.class.aim) {
                await client.fdb.set(`${key}.attack_failure`, 1);
              } else {
                var armor = 0;
                if ((await client.fdb.get(`${key}.user.home`)) == 2) {
                  var global_mob = await client.fdb.get(`global_mob`);
                  armor = randomInteger(
                    0,
                    global_mob.defence + data.class.armor
                  );
                } else {
                  armor = randomInteger(0, data.mob.defence + data.class.armor);
                }
                if (armor < data.class.armor) {
                  your_damage = your_damage / 2;
                  await client.fdb.set(`${key}.shield_resist`, 1);
                }

                if (crit === 1) {
                  await client.fdb.set(`${key}.crit_success`, your_damage);
                } else {
                  await client.fdb.set(`${key}.attack_success`, your_damage);
                }

                if ((await client.fdb.get(`${key}.user.home`)) === 2) {
                  var mob_health = await client.fdb.get(`global_mob.health`);
                  var user = await client.fdb.get(`${key}.user`);
                  var earning = your_damage / 11;
                  await client.fdb.set(
                    `global_mob.health`,
                    mob_health - your_damage
                  );
                  await client.fdb.set(`${key}.user.gold`, user.gold + earning);
                  await client.fdb.set(`${key}.mob_money`, your_damage / 18);
                } else {
                  var mob_health = await client.fdb.get(`${key}.mob.health`);
                  await client.fdb.set(
                    `${key}.mob.health`,
                    mob_health - your_damage
                  );
                }
              }
              break;
            }
            case "rpg2_walk": {
              var step = randomInteger(2, 4);
              await client.fdb.set(
                `${key}.location.distance`,
                data.location.distance + step
              );
              if (
                (await client.fdb.get(`${key}.location.distance`)) <
                (await client.fdb.get(`${key}.location.fixed_distance`))
              ) {
                var difference =
                  (await client.fdb.get(`${key}.location.fixed_distance`)) -
                  (await client.fdb.get(`${key}.location.distance`));
                var difference_ready = difference / 2;
                if (
                  (await client.fdb.get(`${key}.location.fixed_distance`)) -
                    (await client.fdb.get(`${key}.location.distance`)) +
                    difference_ready <
                  15
                ) {
                  await client.fdb.set(
                    `${key}.location.distance`,
                    await client.fdb.get(`${key}.location.fixed_distance`)
                  );
                } else {
                  await client.fdb.inc(
                    `${key}.location.distance`,
                    difference_ready,
                    "rpg_clicker2"
                  );
                }
              }
              walking();
              break;
            }
            case "rpg2_walk_bonus": {
              if ((await client.fdb.get(`${key}.location.inactive`)) < 4) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "Нельзя.",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }

              var step = randomInteger(2, 4);
              await client.fdb.inc(`${key}.location.distance`, step);
              walking(true);
              break;
            }
            case "rpg2_home": {
              var distance = data.location.distance;
              if (data.user.home !== 0) {
              } else {
                if (data.mob.here === 1) {
                  await client.fdb.set(
                    `${key}.location.distance`,
                    distance / 1.15
                  );
                } else {
                  await client.fdb.set(
                    `${key}.location.distance`,
                    distance / 2
                  );
                }
                if (data.location.distance <= 10) {
                  await client.fdb.set(`${key}.user.home`, 1);
                  await client.fdb.set(`${key}.mob.here`, 0);
                }
                walking();
              }
              break;
            }
            case "rpg2_home_repair": {
              var repair_price =
                ((data.class_stats.sword_max -
                  data.class_stats.sword +
                  (data.class_stats.shield_max - data.class_stats.shield)) /
                  10) *
                (1 + data.user.level / 2);

              if (repair_price === 0) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "Вам нет смысла это делать",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }

              if (data.user.gold > repair_price) {
                await client.fdb.set(
                  `${key}.user.gold`,
                  data.user.gold - repair_price
                );
                await client.fdb.set(
                  `${key}.class_stats.sword`,
                  data.class_stats.sword_max
                );
                await client.fdb.set(
                  `${key}.class_stats.shield`,
                  data.class_stats.shield_max
                );
              } else {
                return collected.reply(
                  await client.tall(
                    {
                      content: "Недостаточно золота",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              break;
            }
            case "rpg2_home_health": {
              var health_price =
                ((data.user.health_max - data.user.health_current) / 3) *
                (1 + data.user.level / 5);

              if (health_price === 0) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "Вам нет смысла это делать",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }

              if (data.user.gold > health_price) {
                await client.fdb.set(
                  `${key}.user.gold`,
                  data.user.gold - health_price
                );
                await client.fdb.set(
                  `${key}.user.health_current`,
                  data.user.health_max
                );
              } else {
                return collected.reply(
                  await client.tall(
                    {
                      content: "Недостаточно золота",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              break;
            }
            case "rpg2_inventory_mana_bottle": {
              var decreaser = 15 * (1 + data.class_stats.magic_level / 3);
              if (data.class_stats.mana_bottle > 0) {
                if (
                  data.class_stats.mana <
                  data.class_stats.mana_max - decreaser
                ) {
                  await client.fdb.dec(
                    `${key}.class_stats.mana_bottle`,
                    1,
                    "rpg_clicker2"
                  );
                  await client.fdb.set(
                    `${key}.class_stats.mana`,
                    data.class_stats.mana + decreaser
                  );
                  await client.fdb.set(`${key}-mana`, decreaser);
                } else {
                  return collected.reply(
                    await client.tall(
                      {
                        content: `У вас должно нехватать хотя-бы ${decreaser.toFixed(
                          1
                        )} маны для применения зелья!`,
                        ephemeral: true,
                      },
                      message.locale
                    )
                  );
                }
              } else {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У тебя нет бутылок маны",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              break;
            }
            case "rpg2_inventory_health_bottle": {
              var decreaser = 5 * (1 + data.user.level / 3);
              if (data.class_stats.health_bottle > 0) {
                if (
                  data.user.health_current <
                  data.user.health_max - decreaser
                ) {
                  await client.fdb.dec(`${key}.class_stats.health_bottle`);
                  await client.fdb.set(
                    `${key}.user.health_current`,
                    data.user.health_current + decreaser
                  );
                  await client.fdb.set(`${key}-health`, decreaser);
                } else {
                  return collected.reply(
                    await client.tall(
                      {
                        content: `У вас должно нехватать хотя-бы ${decreaser.toFixed(
                          1
                        )} здоровья для применения зелья!`,
                        ephemeral: true,
                      },
                      message.locale
                    )
                  );
                }
              } else {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У тебя нет бутылок здоровья",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              break;
            }
            case "rpg2_inventory_durability_bottle": {
              var decreaser = 9 * (1 + data.user.level / 10);
              if (data.class_stats.durability_bottle > 0) {
                if (
                  data.class_stats.sword <
                  data.class_stats.sword_max - decreaser
                ) {
                  await client.fdb.dec(`${key}.class_stats.durability_bottle`);
                  await client.fdb.set(
                    `${key}.class_stats.sword`,
                    data.class_stats.sword + decreaser
                  );
                  await client.fdb.set(`${key}-durability`, 1);
                } else if (
                  data.class_stats.shield <
                  data.class_stats.shield_max - decreaser
                ) {
                  await client.fdb.dec(`${key}.class_stats.durability_bottle`);
                  await client.fdb.set(
                    `${key}.class_stats.shield`,
                    data.class_stats.shield + decreaser
                  );
                  await client.fdb.set(`${key}-durability`, decreaser);
                } else {
                  return collected.reply(
                    await client.tall(
                      {
                        content: `Ваше оружие/щит (имеющие прочность) должно потерять хотя-бы ${decreaser.toFixed(
                          1
                        )} прочности для применения зелья!`,
                        ephemeral: true,
                      },
                      message.locale
                    )
                  );
                }
              } else {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У тебя нет бутылок прочности",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              break;
            }
            case "rpg2_inventory_ammo_box": {
              if (data.class_stats.ammo_box > 0) {
                if (
                  data.class_stats.arrows <
                  data.class_stats.arrows_max - 20 * (1 + data.user.level / 10)
                ) {
                  await client.fdb.set(
                    `${key}.class_stats.arrows`,
                    data.class_stats.arrows + 20 * (1 + data.user.level / 10)
                  );
                  await client.fdb.dec(`${key}.class_stats.ammo_box`);
                  await client.fdb.set(
                    `${key}-ammo`,
                    20 * (1 + data.user.level / 10)
                  );
                } else if (
                  data.class_stats.daggers <
                  data.class_stats.daggers_max - 15 * (1 + data.user.level / 10)
                ) {
                  await client.fdb.set(
                    `${key}.class_stats.daggers`,
                    data.class_stats.daggers + 15 * (1 + data.user.level / 10)
                  );
                  await client.fdb.dec(`${key}.class_stats.ammo_box`);
                  await client.fdb.set(
                    `${key}-ammo`,
                    15 * (1 + data.user.level / 10)
                  );
                } else {
                  return collected.reply(
                    await client.tall(
                      {
                        content:
                          "У вас итак полный набор стрел/кинжалов, либо же этот комплект вам не нужен!",
                        ephemeral: true,
                      },
                      message.locale
                    )
                  );
                }
              }
              break;
            }
            case "rpg2_inventory_bomb": {
              var decreaser = 20 * (1 + data.user.level / 9);
              if (data.class_stats.bomb > 0) {
                if (data.mob.here === 1 || data.user.home === 2) {
                  await client.fdb.dec(`${key}.class_stats.bomb`);
                  if (data.user.home === 2) {
                    await client.fdb.dec(`global_mob.health`, decreaser);
                  } else {
                    await client.fdb.set(
                      `${key}.mob.health`,
                      data.mob.health - decreaser
                    );
                  }
                  await client.fdb.set(`${key}-bomb`, decreaser);
                } else {
                  return collected.reply(
                    await client.tall(
                      {
                        content: "Вы не видите моба!",
                        ephemeral: true,
                      },
                      message.locale
                    )
                  );
                }
              } else {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У тебя нет бомб",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              break;
            }
            case "rpg2_home_seller": {
              if (data.user.level < 5) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У вас нету 5-го уровня для доступа!",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }

              var formula = 1 + data.user.level / 3;
              var onee = 3 * formula;
              var twoo = 5 * formula;
              var threee = 3 * formula;
              var fourr = 6 * formula;
              var fivee = 4 * formula;

              var i = 0;

              async function seller(item, label, emoji) {
                i++;
                if ((await client.fdb.get(`${key}.class_stats.${item}`)) > 0) {
                  var price = 0;
                  switch (i) {
                    case 1:
                      price = onee;
                      break;
                    case 2:
                      price = twoo;
                      break;
                    case 3:
                      price = threee;
                      break;
                    case 4:
                      price = fourr;
                      break;
                    case 5:
                      price = fivee;
                      break;
                  }

                  return new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel(
                      `${label} (${await client.fdb.get(
                        `${key}`,
                        `class_stats.${item}`
                      )} шт.) (${price.toFixed(1)})`
                    )
                    .setEmoji(`${emoji}`)
                    .setCustomId(`rpg2_home_seller_${item}`);
                } else {
                  return new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel(`⠀`)
                    .setCustomId(`rpg2_nan_${i}`)
                    .setDisabled(true);
                }
              }

              var seller_ready = new ActionRowBuilder().addComponents([
                await seller("mana_bottle", "Зелье манны", "🌊"),
                await seller("health_bottle", "Зелье здоровья", "💊"),
                await seller("durability_bottle", "Комплект починки", "🔧"),
                await seller("bomb", "Бомба", "💣"),
                await seller("ammo_box", "Патроны", "🎯"),
              ]);

              var seller_ready_2 = new ActionRowBuilder().addComponents([
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel("Назад")
                  .setCustomId("rpg2_home"),
              ]);

              var seller_embed = new EmbedBuilder()
                .setTitle("Барыга")
                .setDescription("Э-гей! Ух-ты! Я куплю все твои предметы!")
                .addFields({
                  name: "Добро пожаловать!",
                  value:
                    "Здесь вы можете продать все предметы, которые вам не нужны",
                })
                .setThumbnail(
                  "https://cdn.discordapp.com/attachments/959591573371379753/973515457871097876/unknown.png"
                );

              await collected.deferUpdate();
              return collected.message.edit(
                await client.tall(
                  {
                    embeds: [seller_embed],
                    components: [seller_ready, seller_ready_2],
                    ephemeral: true,
                  },
                  message.locale
                )
              );
              break;
            }
            case "rpg2_home_seller_mana_bottle": {
              if (
                (await client.fdb.get(`${key}.class_stats.mana_bottle`)) === 0
              ) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У вас нет зелий манны",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              var formula = 1 + data.user.level / 3;
              var onee = 3 * formula;
              await client.fdb.dec(`${key}.class_stats.mana_bottle`);
              await client.fdb.set(
                `${key}.user.gold`,
                (await client.fdb.get(`${key}.user.gold`)) + onee
              );
              break;
            }
            case "rpg2_home_seller_health_bottle": {
              if (
                (await client.fdb.get(`${key}.class_stats.health_bottle`)) === 0
              ) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У вас нет зелий здоровья",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              var formula = 1 + data.user.level / 3;
              var twoo = 5 * formula;
              await client.fdb.dec(`${key}.class_stats.health_bottle`);
              await client.fdb.set(
                `${key}.user.gold`,
                (await client.fdb.get(`${key}.user.gold`)) + twoo
              );
              break;
            }
            case "rpg2_home_seller_durability_bottle": {
              if (
                (await client.fdb.get(
                  `${key}.class_stats.durability_bottle`
                )) === 0
              ) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У вас нет зелий починки",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              var formula = 1 + data.user.level / 3;
              var threee = 3 * formula;
              await client.fdb.dec(`${key}.class_stats.durability_bottle`);
              await client.fdb.set(
                `${key}.user.gold`,
                (await client.fdb.get(`${key}.user.gold`)) + threee
              );
              break;
            }
            case "rpg2_home_seller_bomb": {
              if ((await client.fdb.get(`${key}.class_stats.bomb`)) === 0) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У вас нет бомб",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              var formula = 1 + data.user.level / 3;
              var four = 6 * formula;
              await client.fdb.dec(`${key}.class_stats.bomb`);
              await client.fdb.set(
                `${key}.user.gold`,
                (await client.fdb.get(`${key}.user.gold`)) + four
              );
              break;
            }
            case "rpg2_home_seller_ammo_box": {
              if ((await client.fdb.get(`${key}.class_stats.ammo_box`)) === 0) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У вас нет боеприпасов",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              var formula = 1 + data.user.level / 3;
              var five = 4 * formula;
              await client.fdb.dec(`${key}.class_stats.ammo_box`);
              await client.fdb.set(
                `${key}.user.gold`,
                (await client.fdb.get(`${key}.user.gold`)) + five
              );
              break;
            }

            case "rpg2_home_mage": {
              if (data.user.level < 3) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У вас нету 3-го уровня для доступа!",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }

              var first = 40 * (1 + data.class.aim / 5);
              var second =
                50 *
                (data.class.regeneration + (1 + data.class.regeneration / 2));
              var third = 40 * (1 + data.class_stats.crit_percent / 5);
              var fourth = 60 * (1 + data.class_stats.magic_upgrade / 2);
              var five = 80 * (1 + data.class_stats.magic_max / 2);

              var mag_embed = new EmbedBuilder()
                .setTitle("Магия")
                .setDescription(
                  `- Я могу сделать из тебя бога. Только оставь меня в покое!`
                )
                .addFields({
                  name: "Добро пожаловать к лучшему магу в округе!",
                  value: "Прокачай свои физ. хар-ки и стань ещё круче!",
                })
                .setThumbnail(
                  "https://images-cdn.9gag.com/photo/aN1q4L4_700b.jpg"
                );

              var mag_controls = new ActionRowBuilder().addComponents([
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Success)
                  .setLabel(`Назад`)
                  .setEmoji("⬅")
                  .setCustomId("rpg2_home"),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel(
                    `Шанс крита (${
                      data.class_stats.crit_percent
                    }%) (${third.toFixed(1)}$)`
                  )
                  .setEmoji("🩸")
                  .setCustomId("rpg2_home_mage_crit"),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel(
                    `Точность (${data.class.aim} ур) (${first.toFixed(1)}$)`
                  )
                  .setEmoji("👒")
                  .setCustomId("rpg2_home_mage_aim"),
              ]);

              var mag_controls_2 = new ActionRowBuilder().addComponents([
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel(
                    `Регенерация (${data.class.regeneration.toFixed(
                      1
                    )} hp/ход) (${second.toFixed(1)}$)`
                  )
                  .setEmoji("❤️")
                  .setCustomId("rpg2_home_mage_regen"),
              ]);

              if (data.class.name === 2) {
                mag_controls_2.addComponents([
                  new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel(
                      `Реген маны (${
                        data.class_stats.magic_upgrade
                      } ур) (${fourth.toFixed(1)}$)`
                    )
                    .setEmoji("🧙")
                    .setCustomId("rpg2_home_mage_magic"),
                  new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel(
                      `Макс. манна (${
                        data.class_stats.magic_max
                      } ур) (${five.toFixed(1)}$)`
                    )
                    .setEmoji("🧙")
                    .setCustomId("rpg2_home_mage_mana_max"),
                ]);
              }

              await collected.deferUpdate();
              return collected.message.edit(
                await client.tall(
                  {
                    embeds: [mag_embed],
                    components: [mag_controls, mag_controls_2],
                    ephemeral: true,
                  },
                  message.locale
                )
              );
            }
            case "rpg2_home_mage_magic": {
              var fourth = 60 * (1 + data.class_stats.magic_upgrade / 2);

              if (
                Math.floor(data.user.level / 1.5) <
                data.class_stats.magic_upgrade
              ) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У вас недостаточно уровня игрока для прокачки",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              if (data.user.gold < fourth) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У вас не хватает денег",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              await client.fdb.set(`${key}.user.gold`, data.user.gold - fourth);
              await client.fdb.inc(`${key}.class_stats.magic_upgrade`);
              break;
            }
            case "rpg2_home_mage_mana_max": {
              var five = 80 * (1 + data.class_stats.magic_max / 2);

              if (
                Math.floor(data.user.level / 1.5) <
                data.class_stats.magic_max / 15
              ) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У вас недостаточно уровня игрока для прокачки",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              if (data.user.gold < five) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У вас не хватает денег",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }

              await client.fdb.set(`${key}.user.gold`, data.user.gold - five);
              await client.fdb.inc(`${key}.class_stats.magic_max`);
              await client.fdb.set(
                `${key}.class_stats.mana_max`,
                data.class_stats.mana_max * 2
              );
              break;
            }
            case "rpg2_home_medic": {
              var health_price =
                ((data.user.health_max - data.user.health_current) / 3) *
                (1 + data.user.level / 5);
              var mana_price =
                ((data.class_stats.mana_max - data.class_stats.mana) / 8) *
                (1 + data.user.level / 2);
              var health_max_price =
                40 *
                (data.class_stats.health_max_level +
                  data.class_stats.health_max_level / 6);

              var medic_embed = new EmbedBuilder()
                .setTitle("Медицина")
                .setDescription("- Ты поранился? Беги скорее, подлатаю!")
                .addFields({
                  name: "Добро пожаловать в медицинский центр!",
                  value:
                    "Здесь ты сможешь полностью восстановить свои здоровье и ману.",
                })
                .setThumbnail(
                  "https://static.wikia.nocookie.net/atom-rpg/images/a/a9/Village_Doctor.png/revision/latest?cb=20181120044403&path-prefix=ru"
                );

              var medic_controls = new ActionRowBuilder().addComponents([
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Success)
                  .setLabel(`Назад`)
                  .setEmoji("⬅")
                  .setCustomId("rpg2_home"),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel(`Лечение (${health_price.toFixed(1)})`)
                  .setEmoji("🏥")
                  .setCustomId("rpg2_home_health"),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel(
                    `Увеличить здоровье (${health_max_price.toFixed(1)})`
                  )
                  .setEmoji("💊")
                  .setCustomId("rpg2_home_health_max"),
              ]);

              if (data.class.name === 2) {
                medic_controls.addComponents([
                  new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel(`Восстановить ману (${mana_price.toFixed(1)})`)
                    .setEmoji("🔮")
                    .setCustomId("rpg2_home_mana"),
                ]);
              }

              await collected.deferUpdate();
              return collected.message.edit(
                await client.tall(
                  {
                    embeds: [medic_embed],
                    components: [medic_controls],
                    ephemeral: true,
                  },
                  message.locale
                )
              );
            }
            case "rpg2_home_health_max": {
              if (
                Math.floor(data.user.level / 1.5) <
                data.class_stats.health_max_level
              ) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У вас недостаточно уровня игрока для прокачки!",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              var health_max_price =
                35 *
                data.class_stats.health_max_level *
                (1 + data.class_stats.health_max_level / 6);
              if (data.user.gold < health_max_price) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "Недостаточно средств",
                    },
                    message.locale
                  )
                );
              }
              await client.fdb.set(
                `${key}.user.gold`,
                data.user.gold - health_max_price
              );
              await client.fdb.inc(`${key}.class_stats.health_max_level`);
              var difference = data.user.health_max * 1.5;
              await client.fdb.set(`${key}.user.health_max`, difference);
              break;
            }
            case "rpg2_home_smith": {
              var shield_price =
                30 *
                (data.class_stats.shield_level +
                  data.class_stats.shield_level / 5);
              var repair_price =
                ((data.class_stats.sword_max -
                  data.class_stats.sword +
                  (data.class_stats.shield_max - data.class_stats.shield)) /
                  10) *
                (1 + data.user.level / 2);

              var smith_embed = new EmbedBuilder()
                .setTitle("Кузница")
                .setDescription(
                  "- Приветствую путник. Что-то починить? С радостью всё сделаю для тебя!"
                )
                .addFields({
                  name: "Добро пожаловать в кузницу!",
                  value: "Прокачивайте, чините и станьте самым сильным!",
                })
                .setThumbnail(
                  `https://cdn.discordapp.com/attachments/959591573371379753/973515694190764052/unknown.png`
                );

              var smith_controls = new ActionRowBuilder().addComponents([
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Success)
                  .setLabel(`Назад`)
                  .setEmoji("⬅")
                  .setCustomId("rpg2_home"),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel(`Ремонт (${repair_price.toFixed(1)})`)
                  .setEmoji("🔧")
                  .setCustomId("rpg2_home_repair"),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel(`Улучшить щит (${shield_price.toFixed(1)})`)
                  .setEmoji("🛡")
                  .setCustomId("rpg2_home_shield"),
              ]);

              await collected.deferUpdate();
              return collected.message.edit(
                await client.tall(
                  {
                    embeds: [smith_embed],
                    components: [smith_controls],
                    ephemeral: true,
                  },
                  message.locale
                )
              );
              break;
            }
            case "rpg2_home_mana": {
              if (data.class.name !== 2) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "Вы не маги и не можете использовать эту кнопку",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }

              var mana_price =
                ((data.class_stats.mana_max - data.class_stats.mana) / 8) *
                (1 + data.user.level / 2);

              if (data.user.gold < mana_price) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "Недостаточно средств",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }

              var mana_max = data.class_stats.mana_max;
              await client.fdb.set(`${key}.class_stats.mana`, mana_max);
              await client.fdb.set(
                `${key}.user.gold`,
                data.user.gold - mana_price
              );
              break;
            }
            case "rpg2_home_shield": {
              var shield_price =
                30 *
                (data.class_stats.shield_level +
                  data.class_stats.shield_level / 5);

              if (
                Math.floor(data.user.level / 1.5 + 3) <
                data.class_stats.shield_level
              ) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У вас недостаточно уровня игрока для прокачки",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              if (data.user.gold < shield_price) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "Недостаточно средств",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }

              var shield_level = data.class_stats.shield_level + 1;
              var shield = await client.fdb.get(`${key}.class_stats.shield`);
              var shield_max = await client.fdb.get(
                `${key}.class_stats.shield_max`
              );
              await client.fdb.set(
                `${key}.class_stats.shield_level`,
                shield_level
              );
              await client.fdb.set(`${key}.class_stats.shield`, shield * 1.5);
              await client.fdb.set(
                `${key}.class_stats.shield_max`,
                shield_max * 1.5
              );
              await client.fdb.set(
                `${key}.user.gold`,
                data.user.gold - shield_price
              );
              break;
            }
            case "rpg2_home_ammo": {
              var repair_price =
                (data.class_stats.daggers_max -
                  data.class_stats.daggers +
                  (data.class_stats.arrows_max - data.class_stats.arrows) / 6) *
                (1 + data.user.level / 10);

              if (data.user.gold < repair_price) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "Недостаточно средств",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }

              await client.fdb.set(
                `${key}.user.gold`,
                data.user.gold - repair_price
              );
              await client.fdb.set(
                `${key}.class_stats.daggers`,
                data.class_stats.daggers_max
              );
              await client.fdb.set(
                `${key}.class_stats.arrows`,
                data.class_stats.arrows_max
              );
              break;
            }
            case "rpg2_home_mage_crit": {
              var third = 40 * (1 + data.class_stats.crit_percent / 5);

              if (
                Math.floor(data.user.level / 1.5 + 8) <
                data.class_stats.crit_percent
              ) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У вас недостаточно уровня игрока для прокачки",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              if (data.user.gold < third) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "Недостаточно средств",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }

              await client.fdb.set(`${key}.user.gold`, data.user.gold - third);
              await client.fdb.set(
                `${key}.class_stats.crit_percent`,
                data.class_stats.crit_percent + 1
              );
              break;
            }
            case "rpg2_home_mage_aim": {
              var first = 40 * (1 + user4.aim / 5);

              if (data.user.gold < first) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "Недостаточно средств",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              if (
                Math.floor(data.user.level / 1.5 + 3) <
                data.class_stats.crit_percent
              ) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У вас недостаточно уровня игрока для прокачки",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }

              await client.fdb.set(`${key}.user.gold`, data.user.gold - first);
              await client.fdb.set(`${key}.class.aim`, data.class.aim + 1);
              break;
            }
            case "rpg2_home_mage_regen": {
              var second =
                50 *
                (data.class.regeneration + (1 + data.class.regeneration / 2));

              if (
                Math.floor(data.user.level / 1.5) <
                data.class.regeneration_level
              ) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У вас недостаточно уровня игрока для прокачки",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              if (data.user.gold < second) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "Недостаточно средств",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }

              await client.fdb.set(`${key}.user.gold`, data.user.gold - second);
              await client.fdb.set(
                `${key}.class.regeneration`,
                data.class.regeneration * 1.5
              );
              break;
            }
            case "rpg2_home_gunsmith": {
              var repair_price =
                (data.class_stats.daggers_max -
                  data.class_stats.daggers +
                  (data.class_stats.arrows_max - data.class_stats.arrows) / 6) *
                (1 + data.user.level / 10);
              var repair_second_price = 0;

              var upgrade_price = 0;
              var bonus_price = 0;
              switch (data.class.name) {
                case 1: {
                  upgrade_price =
                    (data.class_stats.sword_level +
                      data.class_stats.sword_level / 4) *
                    70;
                  break;
                }
                case 2: {
                  upgrade_price =
                    (data.class_stats.magic_level +
                      data.class_stats.magic_level / 4) *
                    70;
                  break;
                }
                case 3: {
                  upgrade_price =
                    (data.class_stats.bow_level +
                      data.class_stats.bow_level / 4) *
                    70;
                  repair_second_price =
                    data.class_stats.bow_level *
                    25 *
                    (1 + data.class_stats.bow_level / 3);
                  break;
                }
                case 4: {
                  upgrade_price =
                    (data.class_stats.ninja_level +
                      data.class_stats.ninja_level / 4) *
                    70;
                  repair_second_price =
                    data.class_stats.ninja_level *
                    25 *
                    (1 + data.class_stats.ninja_level / 3);
                  break;
                }
                case 5: {
                  upgrade_price =
                    (data.class_stats.sword_level +
                      data.class_stats.sword_level / 4) *
                    70;
                  bonus_price =
                    (data.class_stats.bow_level +
                      data.class_stats.bow_level / 4) *
                    70;
                  repair_second_price =
                    data.class_stats.bow_level *
                    35 *
                    (1 + data.class_stats.bow_level / 3);
                  break;
                }
                case 6: {
                  upgrade_price =
                    (data.class_stats.sword_level +
                      data.class_stats.sword_level / 4) *
                    70;
                  break;
                }
              }

              var smith_embed = new EmbedBuilder()
                .setTitle("Оружейня")
                .setDescription(
                  "- Ух-ты, Здравствуй! У меня есть очень крутое вооружение!"
                )
                .addFields({
                  name: "Добро пожаловать в оружейню",
                  value: "Покупайте оружия и пополняйте комплект!",
                })
                .setThumbnail(
                  "https://static.wikia.nocookie.net/atom-rpg/images/5/52/City_Trader.png/revision/latest?cb=20181228164630&path-prefix=ru"
                );

              var smith_controls = new ActionRowBuilder().addComponents([
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Success)
                  .setLabel(`Назад`)
                  .setEmoji("⬅")
                  .setCustomId("rpg2_home"),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel(
                    `Прокачать ваше оружие (${upgrade_price.toFixed(1)})`
                  )
                  .setEmoji("🛠")
                  .setCustomId("rpg2_home_gunsmith_upgrade"),
              ]);

              if (
                data.class.name > 2 &&
                data.class.name < 6 &&
                data.class.name !== 5
              ) {
                smith_controls.addComponents([
                  new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel(`Пополнение запасов (${repair_price.toFixed(1)})`)
                    .setEmoji("🔧")
                    .setCustomId("rpg2_home_ammo"),
                ]);
              }

              if (
                data.class.name === 3 ||
                data.class.name === 4 ||
                data.class.name === 5
              ) {
                smith_controls.addComponents([
                  new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel(`Прокачать лук (${bonus_price.toFixed(1)})`)
                    .setEmoji("🏹")
                    .setCustomId("rpg2_home_gunsmith_upgrade_second"),
                ]);
              }

              if (data.class.name == 5) {
                smith_controls.addComponents([
                  new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel(`Пополнение запасов (${repair_price.toFixed(1)})`)
                    .setEmoji("🔧")
                    .setCustomId("rpg2_home_ammo"),
                ]);
              }

              await collected.deferUpdate();
              return collected.message.edit(
                await client.tall(
                  {
                    embeds: [smith_embed],
                    components: [smith_controls],
                    ephemeral: true,
                  },
                  message.locale
                )
              );
            }
            case "rpg2_home_gunsmith_upgrade_second": {
              var upgrade_price = 0;
              var target = 0;
              if (data.class.name !== 5) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "Вы не вор",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              upgrade_price =
                (data.class_stats.bow_level + data.class_stats.bow_level / 4) *
                70;
              if (
                Math.floor(data.user.level / 1.5) < data.class_stats.bow_level
              ) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У вас недостаточно уровня игрока для прокачки!",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              target = "bow_level";
              if (data.user.gold < upgrade_price) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "Недостаточно средств",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              await client.fdb.set(
                `${key}.user.gold`,
                data.user.gold - upgrade_price
              );
              await client.fdb.inc(`${key}.class_stats.${target}`);
              break;
            }
            case "rpg2_home_gunsmith_upgrade": {
              var upgrade_price = 0;
              var target = 0;
              switch (data.class.name) {
                case 1: {
                  upgrade_price =
                    (data.class_stats.sword_level +
                      data.class_stats.sword_level / 4) *
                    70;
                  target = "sword_level";
                  break;
                }
                case 2: {
                  upgrade_price =
                    (data.class_stats.magic_level +
                      data.class_stats.magic_level / 4) *
                    70;
                  target = "magic_level";
                  break;
                }
                case 3: {
                  upgrade_price =
                    (data.class_stats.bow_level +
                      data.class_stats.bow_level / 4) *
                    70;
                  target = "bow_level";
                  break;
                }
                case 4: {
                  upgrade_price =
                    (data.class_stats.ninja_level +
                      data.class_stats.ninja_level / 4) *
                    70;
                  target = "ninja_level";
                  break;
                }
                case 5: {
                  upgrade_price =
                    (data.class_stats.sword_level +
                      data.class_stats.sword_level / 4) *
                    70;
                  target = "sword_level";
                  break;
                }
                case 6: {
                  upgrade_price =
                    (data.class_stats.sword_level +
                      data.class_stats.sword_level / 4) *
                    70;
                  target = "sword_level";
                  break;
                }
              }
              var level = await client.fdb.get(`${key}.class_stats.${target}`);
              if (Math.floor(data.user.level / 1.5) < level) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У вас недостаточно уровня игрока для прокачки!",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              if (data.user.gold < upgrade_price) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "Недостаточно средств",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              await client.fdb.set(
                `${key}.user.gold`,
                data.user.gold - upgrade_price
              );
              await client.fdb.inc(`${key}.class_stats.${target}`);

              if (target === "sword_level") {
                await client.fdb.set(
                  `${key}.class_stats.sword_max`,
                  (await client.fdb.get(`${key}.class_stats.sword`)) * 2
                );
              }
              break;
            }
            case "rpg2_walk_boss": {
              if ((await client.fdb.get("global_mob.here")) === 0) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "Глобальных боссов не обнаружено",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              await client.fdb.set(`${key}.user.home`, 2);
              break;
            }
            case "rpg2_global_leave": {
              if ((await client.fdb.get(`${key}.user.home`)) === 2) {
                await client.fdb.set(`${key}.user.home`, 0);
              } else {
                return collected.reply(
                  await client.tall(
                    {
                      content: "Что? Вас же... итак нет здесь",
                    },
                    message.locale
                  )
                );
              }
              break;
            }
            case "rpg2_class_restart": {
              await client.fdb.set(`${key}.class.name`, NaN);
              break;
            }
            case "rpg2_home_reset": {
              var reset_button = new ActionRowBuilder().addComponents([
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Danger)
                  .setLabel("Подтвердить сброс")
                  .setEmoji("❌")
                  .setCustomId("rpg2_home_reset_confirm"),
              ]);
              return collected.reply(
                await client.tall(
                  {
                    content:
                      "СТОП! Вы уверены, что хотите сбросить все данные в игре?\n\n- Используйте сброс только когда вас не устроил ваш класс, либо же вы столкнулись с проблемами при старте!",
                    components: [reset_button],
                    ephemeral: true,
                  },
                  message.locale
                )
              );
              break;
            }
            case "rpg2_home_reset_confirm": {
              try {
                // Reset by setting to default schema
                await legacyDb._setData(
                  guildId,
                  userId,
                  gameId,
                  DEFAULT_GAME_SCHEMAS.rpg_clicker2
                );

                // Also clear memory cache
                const cacheKey = `${guildId}:${userId}:${gameId}`;
                if (global.memoryCache && global.memoryCache.has) {
                  global.memoryCache.delete(cacheKey);
                }

                return collected.reply(
                  await client.tall(
                    {
                      content:
                        "Весь прогресс был сброшен. Перезапустите игру что-бы начать с чистого листа",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              } catch (error) {
                console.error("Error resetting game data:", error);
                return collected.reply(
                  await client.tall(
                    {
                      content:
                        "Произошла ошибка при сбросе прогресса. Пожалуйста, попробуйте еще раз.",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }

              break;
            }
            case "rpg2_crime": {
              if (data.class.name !== 5) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "Вы не вор",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              var chance = Math.floor(randomInteger(1, 3));
              if (chance === 1) {
                var selector = Math.floor(randomInteger(1, 5));
                switch (selector) {
                  case 1:
                    rpg_clicker2.inc(`${key}.class_stats.health_bottle`);
                    break;
                  case 2:
                    rpg_clicker2.inc(`${key}.class_stats.durability_bottle`);
                    break;
                  case 3:
                    rpg_clicker2.inc(`${key}.class_stats.bomb`);
                    break;
                  case 4:
                    rpg_clicker2.inc(`${key}.class_stats.mana_bottle`);
                    break;
                  case 5:
                    rpg_clicker2.inc(`${key}.class_stats.ammo_box`);
                    break;
                }
                await client.fdb.set(`${key}.crime_success`, 1);
              } else {
                await client.fdb.set(`${key}.crime_fail`, 1);
              }
              client.db.delete(`${key}.crime`);
              break;
            }
            case "rpg2_home_phone": {
              if (data.user.mobile === 0) {
                await client.fdb.set(`${key}.user.mobile`, 1);
              } else if (data.user.mobile === 1) {
                await client.fdb.set(`${key}.user.mobile`, 0);
              }
              break;
            }
            case "rpg2_home_ammo_second": {
              var repair_price = 0;
              var target = 0;

              switch (data.class.name) {
                case 1:
                  repair_price =
                    data.class_stats.bow_level *
                    25 *
                    (1 + data.class_stats.bow_level / 3);
                  target = "bow_level";
                  break;
                case 2:
                  repair_price =
                    data.class_stats.ninja_level *
                    25 *
                    (1 + data.class_stats.ninja_level / 3);
                  target = "ninja_level";
                  break;
                case 3:
                  repair_price =
                    data.class_stats.bow_level *
                    35 *
                    (1 + data.class_stats.bow_level / 3);
                  target = "bow_level";
                  break;
                default: {
                  return;
                }
              }

              if (data.user.gold < repair_price) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У вас недостаточно золота",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }

              if (target === "bow_level") {
                rpg_clicker2.inc(`${key}.class_stats.bow_level`);
                rpg_clicker2.set(
                  `${key}.class_stats.arrows_max`,
                  (await client.fdb.get(`${key}.class_stats.arrows_max`)) * 2
                );
              }
              if (target === "ninja_level") {
                rpg_clicker2.inc(`${key}.class_stats.ninja_level`);
                rpg_clicker2.set(
                  `${key}.class_stats.daggers_max`,
                  (await client.fdb.get(`${key}.class_stats.daggers_max`)) * 2
                );
              }
              break;
            }
            case "rpg2_home_astrologer": {
              if (data.user.level < 10) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "Вы не достигли 10-го уровня для открытия!",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }

              const upgrades = new ActionRowBuilder();
              var upgrades_2 = new ActionRowBuilder().addComponents([
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel("Назад")
                  .setCustomId("rpg2_home"),
              ]);

              upgrades_toggler = false;
              if (data.stones.level === 0) {
                upgrades.addComponents([
                  new ButtonBuilder()
                    .setStyle(ButtonStyle.Primary)
                    .setLabel(`Приобрести браслет (75$)`)
                    .setEmoji("💰")
                    .setCustomId("rpg2_astrolog_buy_bracelet"),
                ]);
                upgrades_toggler = true;
              } else {
                var bracelet_price = 75 * (1 + data.stones.level / 8);
                upgrades.addComponents([
                  new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel(
                      `Возвысить браслет (До +${data.stones.max_bonus.toFixed(
                        1
                      )}%) (${bracelet_price}$)`
                    )
                    .setEmoji("💰")
                    .setCustomId("rpg2_astrolog_buy_bracelet"),
                ]);
              }

              var xp_bonus_price = 40 * (1 + data.stones.xp_bonus / 7);
              var gold_bonus_price = 40 * (1 + data.stones.gold_bonus / 7);
              var health_bonus_price = 40 * (1 + data.stones.health_bonus / 7);
              var regeneration_bonus_price =
                40 * (1 + data.stones.regeneration_bonus / 7);

              upgrades.addComponents([
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel(
                    `Бонус к опыту (${data.stones.xp_bonus.toFixed(
                      0
                    )}%) (${xp_bonus_price.toFixed(0)}$)`
                  )
                  .setEmoji("💰")
                  .setCustomId("rpg2_astrolog_buy_xp")
                  .setDisabled(upgrades_toggler),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel(
                    `Бонус к золоту (${data.stones.gold_bonus.toFixed(
                      0
                    )}%) (${gold_bonus_price.toFixed(0)}$)`
                  )
                  .setEmoji("💰")
                  .setCustomId("rpg2_astrolog_buy_gold")
                  .setDisabled(upgrades_toggler),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel(
                    `Доп. здоровье (${data.stones.health_bonus.toFixed(
                      0
                    )}%) (${health_bonus_price.toFixed(0)}$)`
                  )
                  .setEmoji("💰")
                  .setCustomId("rpg2_astrolog_buy_health")
                  .setDisabled(upgrades_toggler),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel(
                    `Регенерация (${data.stones.regeneration_bonus.toFixed(
                      0
                    )}%) (${regeneration_bonus_price.toFixed(0)}$)`
                  )
                  .setEmoji("💰")
                  .setCustomId("rpg2_astrolog_buy_regeneration")
                  .setDisabled(upgrades_toggler),
              ]);

              const astrolog_embed = new EmbedBuilder()
                .setTitle("Астролог")
                .setDescription(
                  "- Наконец-то ты здесь! Этот браслет по настоящему уникальный!"
                )
                .addFields({
                  name: "Добро пожаловать к астрологу!",
                  value: "Прокачай свой браслет и сделай его самым мощным!",
                })
                .setThumbnail(
                  "https://static.wikia.nocookie.net/eldenringgame/images/a/ab/%D0%90%D1%81%D1%82%D1%80%D0%BE%D0%BB%D0%BE%D0%B3.png/revision/latest/top-crop/width/360/height/450?cb=20220224070906&path-prefix=ru"
                );

              await collected.deferUpdate();
              return collected.message.edit(
                await client.tall(
                  {
                    embeds: [astrolog_embed],
                    components: [upgrades, upgrades_2],
                    ephemeral: true,
                  },
                  message.locale
                )
              );
              break;
            }
            case "rpg2_astrolog_buy_bracelet": {
              var price = 0;
              if (data.stones.level === 0) {
                price = 75;
              } else {
                price = 75 * (1 + data.stones.level / 8);
              }
              if (data.user.gold < price) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У вас недостаточно средств!",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              await client.fdb.set(`${key}.user.gold`, data.user.gold - price);
              await client.fdb.set(
                `${key}.stones.level`,
                data.stones.level + 1
              );
              await client.fdb.set(
                `${key}.stones.max_bonus`,
                data.stones.max_bonus + 15
              );

              var first = [
                `Небесный`,
                `Демонический`,
                `Звездный`,
                `Смертельный`,
                `Превосходный`,
                `Сверхъестественный`,
              ];
              var second = [
                `кристал`,
                `камень`,
                `самоцвет`,
                `медальйон`,
                `амулет`,
              ];

              var first_random =
                first[Math.floor(Math.random() * first.length)];
              var second_random =
                second[Math.floor(Math.random() * second.length)];
              var name = `${first_random} ${second_random}`;
              await client.fdb.set(`${key}.stones.name`, name);
              break;
            }
            case "rpg2_astrolog_buy_xp": {
              var price = 40 * (1 + stones.xp_bonus / 7);
              if (data.user.gold < price) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У вас недостаточно средств!",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              if (data.stones.xp_bonus + 2 > data.stones.max_bonus) {
                return collected.reply(
                  await client.tall(
                    {
                      content:
                        "Улучшение слишком мощное! Браслет не выдерживает! Необходимо возвысить браслет!",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              await client.fdb.set(`${key}.user.gold`, data.user.gold - price);
              await client.fdb.set(
                `${key}.stones.xp_bonus`,
                data.stones.xp_bonus + 2
              );
              break;
            }
            case "rpg2_astrolog_buy_gold": {
              var price = 40 * (1 + data.stones.gold_bonus / 7);
              if (data.user.gold < price) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У вас недостаточно средств!",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              if (data.stones.gold_bonus + 2 > data.stones.max_bonus) {
                return collected.reply(
                  await client.tall(
                    {
                      content:
                        "Улучшение слишком мощное! Браслет не выдерживает! Необходимо возвысить браслет!",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              await client.fdb.set(`${key}.user.gold`, data.user.gold - price);
              await client.fdb.set(
                `${key}.stones.gold_bonus`,
                data.stones.gold_bonus + 2
              );
              break;
            }
            case "rpg2_astrolog_buy_health": {
              var price = 40 * (1 + data.stones.health_bonus / 7);
              if (data.user.gold < price) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У вас недостаточно средств!",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              if (data.stones.health_bonus + 2 > data.stones.max_bonus) {
                return collected.reply(
                  await client.tall(
                    {
                      content:
                        "Улучшение слишком мощное! Браслет не выдерживает! Необходимо возвысить браслет!",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              await client.fdb.set(`${key}.user.gold`, data.user.gold - price);
              await client.fdb.set(
                `${key}.stones.health_bonus`,
                data.stones.health_bonus + 2
              );

              await client.fdb.set(
                `${key}.user.health_max`,
                data.user.health_max * (1 + 2 / 100)
              );
              break;
            }
            case "rpg2_astrolog_buy_regeneration": {
              var price = 40 * (1 + data.stones.regeneration_bonus / 7);
              if (data.user.gold < price) {
                return collected.reply(
                  await client.tall(
                    {
                      content: "У вас недостаточно средств!",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              if (data.stones.regeneration_bonus + 2 > data.stones.max_bonus) {
                return collected.reply(
                  await client.tall(
                    {
                      content:
                        "Улучшение слишком мощное! Браслет не выдерживает! Необходимо возвысить браслет!",
                      ephemeral: true,
                    },
                    message.locale
                  )
                );
              }
              await client.fdb.set(`${key}.user.gold`, data.user.gold - price);
              await client.fdb.set(
                `${key}.stones.regeneration_bonus`,
                data.stones.regeneration_bonus + 2
              );

              var user3 = await client.fdb.get(`${key}.class`);
              await client.fdb.set(
                `${key}.class_stats.regeneration`,
                data.class_stats.regeneration * (1 + 2 / 100)
              );
              break;
            }
            default:
              return;
          }
          await collected.deferUpdate();
          await main();
        });
      } catch (error) {
        console.log(error);
      }
    } catch (error) {
      console.log(error);
    }
  },
};
