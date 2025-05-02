import {
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  ButtonStyle,
  TextInputBuilder,
  AttachmentBuilder,
  TextInputStyle,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import ms from "ms";
import fs from "fs";
import prettyMilliseconds from "pretty-ms";
import ndarray from "ndarray";
import createPlanner from "l1-path-finder";
import {
  createCanvas,
  GlobalFonts,
  loadImage,
  Image,
  Path2D,
} from "@napi-rs/canvas";
import { join } from "path";
import legacyDbClient, {
  DEFAULT_GAME_SCHEMAS,
} from "../../database/legacyClient.js";
import extendCanvas from "../../utils/canvasExtensions.js";
import fetch from "node-fetch";

function randomInteger(min, max) {
  let rand = min - 0.5 + Math.random() * (max - min + 1);
  return Number(rand.toFixed(0));
}

export default {
  game_info: {
    emoji: "⛏️",
    name: "Шахтерское дело",
    id: "mining2",
    description:
      "Копайте, стройте, убивайте мобов и путешествуйте по разным местностям!",
  },
  //TODO: Добавить предпросмотр статистики, с отображением кадра игры
  async execute(interaction, legacyDb) {
    // We'll use our imported legacyDbClient instead of the passed parameter

    // Setup for legacy database
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const gameId = "mining2";
    // Remove the incorrect hyphenated key definition
    // const key = `${guildId}-${userId}-${gameId}`;

    // Use 'key' for the correct dot-formatted key
    const key = `${guildId}.${userId}.${gameId}`;
    console.log("Game key format:", key);

    // Adapter for legacy database client
    const client = {
      fdb: {
        get: async (keyPath, _, returnFullObject) => {
          try {
            // Fix keyPath handling to ensure proper prefix is used
            const path = keyPath.replace(`${key}`, "").replace(/^\./, "");
            console.log(
              `GET: original path: ${keyPath}, processed path: ${path}`
            );

            if (returnFullObject) {
              return (
                (await legacyDbClient._getData(guildId, userId, gameId)) || {}
              );
            }

            return await legacyDbClient.get(guildId, userId, gameId, path);
          } catch (error) {
            console.error("Error in fdb.get:", error);
            return {};
          }
        },
        set: async (keyPath, value, _) => {
          try {
            // Fix keyPath handling to ensure proper prefix is used
            const path = keyPath.replace(`${key}`, "").replace(/^\./, "");
            console.log(
              `SET: original path: ${keyPath}, processed path: ${path}, value:`,
              value
            );

            return await legacyDbClient.set(
              guildId,
              userId,
              gameId,
              path,
              value
            );
          } catch (error) {
            console.error("Error in fdb.set:", error);
          }
        },
        inc: async (keyPath, amount, _) => {
          try {
            // Fix keyPath handling to ensure proper prefix is used
            const path = keyPath.replace(`${key}`, "").replace(/^\./, "");
            console.log(
              `INC: original path: ${keyPath}, processed path: ${path}, amount: ${amount}`
            );

            return await legacyDbClient.inc(
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
        dec: async (keyPath, amount, _) => {
          try {
            // Fix keyPath handling to ensure proper prefix is used
            const path = keyPath.replace(`${key}`, "").replace(/^\./, "");
            console.log(
              `DEC: original path: ${keyPath}, processed path: ${path}, amount: ${amount}`
            );

            return await legacyDbClient.dec(
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
        push: async (keyPath, value) => {
          try {
            // Fix keyPath handling to ensure proper prefix is used
            const path = keyPath.replace(`${key}`, "").replace(/^\./, "");
            console.log(
              `PUSH: original path: ${keyPath}, processed path: ${path}, value:`,
              value
            );

            // For arrays, we need to get the current array, push to it, then set it back
            const currentArray =
              (await legacyDbClient.get(guildId, userId, gameId, path)) || [];
            currentArray.push(value);
            return await legacyDbClient.set(
              guildId,
              userId,
              gameId,
              path,
              currentArray
            );
          } catch (error) {
            console.error("Error in fdb.push:", error);
          }
        },
        delete: async (keyPath) => {
          try {
            // Fix keyPath handling to ensure proper prefix is used
            const path = keyPath.replace(`${key}`, "").replace(/^\./, "");
            console.log(
              `DELETE: original path: ${keyPath}, processed path: ${path}`
            );

            return await legacyDbClient.delete(guildId, userId, gameId, path);
          } catch (error) {
            console.error("Error in fdb.delete:", error);
          }
        },
      },
      db: {
        delete: async (keyPath) => {
          try {
            // Fix keyPath handling to ensure proper prefix is used
            const path = keyPath.replace(`${key}`, "").replace(/^\./, "");
            console.log(
              `DB DELETE: original path: ${keyPath}, processed path: ${path}`
            );

            return await legacyDbClient.delete(guildId, userId, gameId, path);
          } catch (error) {
            console.error("Error in db.delete:", error);
          }
        },
      },
      // Add utility methods that would have been on the original client
      tall: (content, locale) => content, // Replace with interaction.client.tall if it exists
      ez_collector: (customIdFilter, message, options) => {
        try {
          const filter =
            typeof customIdFilter === "function"
              ? customIdFilter
              : (i) =>
                  i.customId.startsWith(customIdFilter) && i.user.id === userId;

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
      createTimeout: (timeoutKey, duration) => {
        // timeoutKey is now expected to be `timeouts.${guildId}.${userId}.${gameId}`
        console.log(
          `Creating timeout for ${timeoutKey} with duration ${duration}`
        );
        try {
          // The path within the player data object is simply "timeouts"
          // Or potentially we want timeouts stored separately?
          // For now, let's assume it's stored within the main player data object.
          // We need the guildId, userId, gameId from the outer scope.

          // Construct the correct internal path relative to the base key
          const internalPath = timeoutKey
            .replace(`${key}`, "")
            .replace(/^\./, ""); // Should result in "timeouts"

          if (internalPath === "timeouts") {
            // Basic check
            console.log(`Setting timeout at path: ${internalPath}`);
            // Use guildId, userId, gameId from the outer scope
            legacyDbClient.set(
              guildId,
              userId,
              gameId,
              internalPath, // Set the value at the "timeouts" path
              Date.now() + duration
            );
          } else {
            console.error(
              `Invalid internal path calculated for timeout: ${internalPath} from key ${timeoutKey}`
            );
          }
        } catch (error) {
          console.error(`Error creating timeout for ${timeoutKey}:`, error);
        }
      },
      ctx_extended: async (context) => {
        // Apply canvas extensions to the context
        return extendCanvas(context);
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
    };

    GlobalFonts.registerFromPath(
      join(__dirname, "../../", "fonts", "minecraft.ttf"),
      "Minecraft"
    );
    GlobalFonts.registerFromPath(
      join(__dirname, "../../", "fonts", "MontserratAlternates-Bold.ttf"),
      "MontserratCool"
    );

    // Initialize player with default values
    let current_player = await legacyDbClient._getData(guildId, userId, gameId);
    console.log("Initial player data:", current_player);

    // Helper function to safely serialize objects by removing circular references
    function safeClone(obj) {
      if (obj === null || typeof obj !== "object") {
        return obj;
      }

      const seen = new WeakSet();

      function _safeClone(object) {
        if (object === null || typeof object !== "object") {
          return object;
        }

        // Detect circular references
        if (seen.has(object)) {
          return "[Circular Reference]";
        }

        seen.add(object);

        if (Array.isArray(object)) {
          return object.map((item) => _safeClone(item));
        }

        const result = {};
        for (const [key, value] of Object.entries(object)) {
          result[key] = _safeClone(value);
        }

        return result;
      }

      return _safeClone(obj);
    }

    // Check if player data exists, if not create default data
    if (!current_player || Object.keys(current_player).length === 0) {
      console.log("Creating new player data");
      const defaultPlayer = {
        player: {
          x: 0,
          y: 0,
          look: 0,
          food: 20,
          food_when: 20,
          health: 100,
          health_max: 100,
          level: 1,
          xp: 0,
          xp_needed: 100,
          stats: {
            coins_spent: 0,
            blocks_placed: 0,
            blocks_broken: 0,
            mobs_killed: 0,
            deaths: 0,
          },
          upgrades: {
            health: 1,
            damage: 1,
            pickaxe_durability: 1,
            pickaxe_damage: 1,
          },
          inventory: { size: 0 },
        },
        visible_area: { area: 1, x: 0, y: 0, width: 11, height: 11 },
        modificators: { blocks_health: 1, mobs_health: 1 },
        tools: {
          pickaxe: { level: 1, durability: 50, durability_max: 50 },
          sword: { durability: 50, durability_max: 50, damage: 5 },
          vision: { number: 11, level: 1 },
          backpack: { size: 10 },
          tools_backpack: { size: 5 },
        },
        destroyed: [],
        mobs: {},
        placed: {},
        destroying: { mob: 0, x: 0, y: 0, points: 0, points_max: 0 },
        tools_inventory: { size: 0 },
        shopping: { status: 0, page: 0 },
        custom_textures: [],
        blocks: [],
        starting_times: 1,
      };

      // Save updated player data - clone to remove circular references
      const cleanPlayerData = safeClone(defaultPlayer);
      await legacyDbClient._setData(guildId, userId, gameId, cleanPlayerData);
      current_player = defaultPlayer;
    } else {
      // Ensure existing player has all required fields
      if (!current_player.modificators) current_player.modificators = {};
      if (!current_player.modificators.blocks_health)
        current_player.modificators.blocks_health = 1;
      if (!current_player.tools) current_player.tools = {};
      if (!current_player.tools.pickaxe)
        current_player.tools.pickaxe = {
          level: 1,
          durability: 50,
          durability_max: 50,
        };
      if (!current_player.tools.sword)
        current_player.tools.sword = {
          durability: 50,
          durability_max: 50,
          damage: 5,
        };
      if (!current_player.tools.vision)
        current_player.tools.vision = { number: 11, level: 1 };

      // Ensure core properties
      current_player.player.x =
        current_player.player.x !== undefined ? current_player.player.x : 0;
      current_player.player.y =
        current_player.player.y !== undefined ? current_player.player.y : 0;
      current_player.player.look =
        current_player.player.look !== undefined
          ? current_player.player.look
          : 0;
      current_player.player.food =
        current_player.player.food !== undefined
          ? current_player.player.food
          : 20;
      current_player.player.food_when =
        current_player.player.food_when !== undefined
          ? current_player.player.food_when
          : 20;

      // Ensure arrays/objects
      current_player.destroyed = current_player.destroyed || [];
      current_player.mobs = current_player.mobs || {};
      current_player.placed = current_player.placed || {};

      // Save updated player data - clone to remove circular references
      const cleanPlayerData = safeClone(current_player);
      await legacyDbClient._setData(guildId, userId, gameId, cleanPlayerData);
    }

    console.log("Player initialized:", current_player);

    var collector;
    var author = userId;

    var painting_mode = 0;
    var painting_text_db = NaN;
    var i_err = 0;

    let gameMessage = null; // Variable to hold the message object
    let activeCollector = null; // Variable to hold the active collector

    async function menu() {
      var menu_embed = new EmbedBuilder()
        .setTitle(`Симулятор Шахтёра 2.0`)
        .setThumbnail(interaction.user.displayAvatarURL());

      var controls = new ActionRowBuilder();

      if (painting_mode === 1) {
        menu_embed.addFields({
          name: `Добро пожаловать в Режим творчества!`,
          value: `Хотите отдохнуть и построить что-нибудь? Этот режим для вас!`,
        });

        controls.addComponents([
          new ButtonBuilder()
            .setStyle(ButtonStyle.Secondary)
            .setLabel(`Назад`)
            .setCustomId("mine_painting_back"),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Success)
            .setLabel(
              (await legacyDbClient._getData(
                guildId,
                userId,
                gameId,
                "painting.x"
              ))
                ? `Продолжить творчество`
                : `Начать творить`
            )
            .setCustomId("mine_start"),
        ]);

        if (
          await legacyDbClient._getData(guildId, userId, gameId, "painting.x")
        ) {
          controls.addComponents([
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel(`Сбросить холст`)
              .setCustomId("mine_painting_restart"),
          ]);
        }
      } else if (
        (await legacyDbClient._getData(guildId, userId, gameId, "x")) ||
        (await legacyDbClient._getData(guildId, userId, gameId, "y"))
      ) {
        menu_embed.addFields({
          name: `Рады вас видеть снова!`,
          value: `Готовы вновь отправиться в приключение?`,
        });
        controls.addComponents([
          new ButtonBuilder()
            .setStyle(ButtonStyle.Primary)
            .setLabel(`Продолжить игру`)
            .setCustomId("mine_start"),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Secondary)
            .setLabel(`Начать заново`)
            .setCustomId("mine_restart"),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Secondary)
            .setLabel(`Режим творчества`)
            .setCustomId("mine_painting"),
        ]);
      } else {
        menu_embed.addFields(
          {
            name: `Добро пожаловать!`,
            value: `Рады вас впервые видеть здесь! ${
              (await legacyDbClient._getData(
                guildId,
                userId,
                gameId,
                "rebirth_mining2"
              ))
                ? "Или я что-то не то говорю?.."
                : " "
            }`,
          },
          {
            name: `Что это за игра?`,
            value: `Это полноценный симулятор шахтёра!\n- Исследуйте 2д мир, ломайте блоки и находите руды!\n- Находите новые локации проходя дальше!\n- Прокачивайтесь и покупайте расходники!\n- Сражайтесь с монстрами и следите за показателями здоровья и голода!`,
          }
        );
        menu_embed.setImage(
          "https://cdn.discordapp.com/attachments/1021464659435466933/1053072129605763132/image.png"
        );
        controls.addComponents([
          new ButtonBuilder()
            .setStyle(ButtonStyle.Success)
            .setLabel(`Начать игру`)
            .setCustomId("mine_start"),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Secondary)
            .setLabel(`Режим творчества`)
            .setCustomId("mine_painting"),
        ]);
      }

      gameMessage = await client.tall(
        {
          embeds: [menu_embed],
          components: [controls],
        },
        interaction.locale,
        { fetchReply: true }
      );
      console.log(interaction.id, Number(interaction.id));
      author = userId;

      // Stop previous collector if it exists
      activeCollector?.stop();

      // Create collector on the new message
      activeCollector = gameMessage.message.createMessageComponentCollector({
        filter: (i) =>
          i.customId.startsWith("mine") && i.user.id === interaction.user.id,
        idle: 300000, // 5 minute idle timeout
      });
      console.log("Collector attached to menu message:", gameMessage.id);

      // Attach the event listener to the new collector
      collectorListener(activeCollector);
    }

    await client.fdb.set(
      `${key}.other.latest_message_id`,
      Number(interaction.id)
    );
    await client.fdb.set(`${key}.other.latest_starting`, Date.now());

    function getDeepKeys(obj) {
      var keys = [];
      for (var key in obj) {
        keys.push(`${key}|${obj[key]}`);
        if (typeof obj[key] === "object") {
          var subkeys = getDeepKeys(obj[key]);
          keys = keys.concat(
            subkeys.map(function (subkey) {
              return key + "." + subkey;
            })
          );
        }
      }
      return keys;
    }

    // Initial call to menu
    await menu();

    var closest_blocks = [];

    var mob_drops = {
      1: [
        {
          name: `Железный осколок`,
          emoji: "♦️",
          chance: 5,
          price: 3,
        },
        {
          name: `Гнилая плоть`,
          emoji: "♦️",
          chance: 100,
          price: 0.6,
        },
      ],
      2: [
        {
          name: `Сланцовый реликт`,
          emoji: `〰️`,
          chance: 100,
          price: 1.4,
        },
      ],
      3: [
        {
          name: `Метеоритный кластер`,
          emoji: `♠️`,
          chance: 10,
          price: 3,
        },
        {
          name: `Метеоритный кусок`,
          emoji: `◼️`,
          chance: 100,
          price: 2,
        },
      ],
      4: [
        {
          name: `Обломок прошлого`,
          emoji: "🈳",
          chance: 5,
          price: 3.4,
        },
        {
          name: `Аметистовый самоцвет`,
          emoji: "♾",
          chance: 100,
          price: 2.3,
        },
      ],
      5: [
        {
          name: `Стальная червоточина`,
          emoji: `🎴`,
          chance: 5,
          price: 4.3,
        },
        {
          name: `Закалённый обломок стали`,
          emoji: `➰`,
          chance: 100,
          price: 3,
        },
      ],
      6: [
        {
          name: `Адский реликт`,
          emoji: "✳️",
          chance: 10,
          price: 5,
        },
        {
          name: `Осколок мучений`,
          emoji: "🈹",
          chance: 100,
          price: 4,
        },
      ],
    };

    var items = {
      torch: {
        id: 0,
        name: `Факел`,
        key: "torch",
        emoji: `💡`,
        emoji_canvas: `other/minecraft/items/torch.png`,
        description: `Освещает блоки рядом`,
        pickable: true,
        placable: true,
        light: {
          power: 3,
        },
        shop: {
          price: 1,
        },
      },
      torch1: {
        id: 1,
        name: `Улучшенный факел`,
        key: "torch1",
        emoji: `💡`,
        emoji_canvas: `other/minecraft/items/torch.png`,
        description: `Освещает блоки вокруг`,
        pickable: true,
        placable: true,
        light: {
          power: 5,
        },
        shop: {
          price: 2.5,
        },
      },
      torch2: {
        id: 2,
        name: `Мега факел`,
        key: "torch2",
        emoji: `💡`,
        emoji_canvas: `other/minecraft/items/torch.png`,
        description: `Освещает блоки очень далеко`,
        pickable: true,
        placable: true,
        light: {
          power: 10,
        },
        shop: {
          price: 8,
        },
      },
      food_pack: {
        id: 3,
        name: `Переносной обед`,
        key: "food_pack",
        emoji: `🍱`,
        description: `Перекусите, когда это так хочется!`,
        food_recover: 4,
        shop: {
          price: 3,
        },
      },
      bandage: {
        id: 4,
        name: `Бинт`,
        key: "bandage",
        emoji: `💉`,
        description: `Мало здоровья? Это может спасти!`,
        health_recover: 4,
        shop: {
          price: 5,
        },
      },
      repair: {
        id: 5,
        name: "Ремонт. комплект",
        key: "repair",
        emoji: "🧰",
        description: "Чините ваши инструменты на ходу!",
        repair_power: 6,
        shop: {
          price: 5,
        },
      },
    };

    var tools = {
      pickaxe: {
        name: `Кирка`,
        emoji: `⛏️`,
        key: `${key}.tools.pickaxe`,
      },
      sword: {
        name: `Меч`,
        emoji: `🗡️`,
        key: `${key}.tools.sword`,
      },
    };

    var locations = [
      {
        name: "Безопасная зона",
        from: 0,
        to: 1,
        tier: 0,
      },
      {
        name: "Каменные развалины",
        from: 1,
        to: 6,
        tier: 1,
      },
      {
        name: "Сланцевые обломки",
        from: 6,
        to: 15,
        multiply: 1.5,
        tier: 2,
      },
      {
        name: "Аметистовые земли",
        from: 15,
        to: 25,
        multiply: 3,
        tier: 3,
      },
      {
        name: "Стальные залежи",
        from: 25,
        to: 50,
        multiply: 4,
        tier: 4,
      },
      {
        name: "Адские земли",
        from: 50,
        to: 115,
        multiply: 5,
        tier: 5,
      },
      {
        from: 115,
        to: 210,
        multiply: 6,
        tier: 6,
      },
    ];

    var ores = [
      {
        name: "Уголь",
        emoji: "🟤",
        tier: 1,
        price: 2,
        from: 0,
        to: 15,
        id: -1,
      },
      {
        name: "Золотая порода",
        emoji: "🟠",
        tier: 2,
        price: 3.5,
        from: 15,
        to: 30,
        id: -2,
      },
      {
        name: `Древний осколок`,
        emoji: "🖤",
        tier: 3,
        price: 4,
        from: 30,
        to: 45,
        id: -3,
      },
      {
        name: `Аметистовый реликт`,
        emoji: `🟣`,
        tier: 4,
        price: 5,
        from: 45,
        to: 75,
        id: -4,
      },
      {
        name: `Заряженная сталь`,
        emoji: `🔵`,
        tier: 5,
        price: 5.5,
        from: 75,
        to: 150,
        id: -5,
      },
      {
        name: `Древесина ада`,
        emoji: "🟢",
        tier: 6,
        price: 6,
        from: 150,
        to: 250,
        id: -6,
      },
    ];

    var mobs = [
      {
        name: `Зомби`,
        emoji: `👽`,
        emoji_canvas: `other/minecraft/mobs/mob-1.png`,
        id: 1,
        type: "mob",
      },
      {
        name: `Пустынный зомби`,
        emoji: `🤠`,
        emoji_canvas: `other/minecraft/mobs/mob-2.png`,
        id: 2,
        type: "mob",
      },
      {
        name: `Свино-зомби`,
        emoji: `😈`,
        emoji_canvas: `other/minecraft/mobs/mob-3.png`,
        id: 3,
        type: "mob",
      },
      {
        name: `Пиглин`,
        emoji: `👹`,
        emoji_canvas: `other/minecraft/mobs/mob-4.png`,
        id: 4,
        type: "mob",
      },
      {
        name: `Скелет-иссушитель`,
        emoji: `🦇`,
        emoji_canvas: `other/minecraft/mobs/mob-5.png`,
        id: 5,
        type: "mob",
      },
      {
        name: `Вредина`,
        emoji: `🐾`,
        emoji_canvas: `other/minecraft/mobs/mob-6.png`,
        id: 6,
        type: "mob",
      },
    ];

    var blocks;
    var temp_blocks;
    var all_blocks;

    function travelling(current_player) {
      // Ensure player object and coordinates exist
      current_player.player = current_player.player || {};
      current_player.player.x = current_player.player.x ?? 0;
      current_player.player.y = current_player.player.y ?? 0;
      // Ensure vision exists
      current_player.tools = current_player.tools || {};
      current_player.tools.vision = current_player.tools.vision || {
        number: 5,
        level: 1, // Added level property
      };

      const visionRadius = Math.floor(
        (current_player.tools.vision.number - 1) / 2
      );
      const minX = current_player.player.x - visionRadius;
      const maxX = current_player.player.x + visionRadius;
      const minY = current_player.player.y - visionRadius;
      const maxY = current_player.player.y + visionRadius;

      if (painting_mode === 1) {
        temp_blocks = {
          "⬜️": {
            name: `Пустой блок`,
            emoji: "⬜️",
            emoji_canvas: "./../../other/minecraft/empty_block.png",
            from: 0,
            to: 100,
            tier: 0,
            id: 0,
          },
          "🛑": {
            name: "Барьер",
            emoji: "🛑",
            emoji_canvas: "./../../other/minecraft/barrier.png",
            mining_blocked: true,
            from: 100,
            to: 120,
          },
        };
      }
      if (current_player.shopping.status === 1 && painting_mode === 0) {
        current_player.tools.vision.number = 5;
        blocks = {
          "🟩": {
            name: "Спавн",
            emoji: "🟩",
            emoji_canvas: "./../../other/minecraft/locations/grass.png",
            from: 0,
            to: 4,
            tier: 0,
            id: 0,
          },
          "1️⃣": {
            name: `Продать блоки`,
            emoji: "1️⃣",
            emoji_canvas: "./../../other/minecraft/shop/shop_blocks.png",
            use: true,
            use_id: 1,
            mining_blocked: true,
            fixed_pos: {
              x: 0,
              y: 2,
            },
          },
          "2️⃣": {
            name: `Возвышение`,
            emoji: "2️⃣",
            emoji_canvas: "./../../other/minecraft/shop/shop_upgrades.png",
            use: true,
            use_id: 2,
            mining_blocked: true,
            fixed_pos: {
              x: 2,
              y: 0,
            },
          },
          "3️⃣": {
            name: `Починка`,
            emoji: "3️⃣",
            emoji_canvas: "./../../other/minecraft/shop/shop_anvil.png",
            use: true,
            use_id: 3,
            mining_blocked: true,
            fixed_pos: {
              x: -2,
              y: 0,
            },
          },
          "4️⃣": {
            name: `Восполнение`,
            emoji: "4️⃣",
            emoji_canvas: "./../../other/minecraft/shop/shop_food.png",
            use: true,
            use_id: 4,
            mining_blocked: true,
            fixed_pos: {
              x: -1,
              y: -2,
            },
          },
          "5️⃣": {
            name: `Расходники`,
            emoji: "🎒", // Changed from "5️⃣" to a backpack emoji which is more common
            emoji_canvas: "other/minecraft/shop/shop_temp.png",
            use: true,
            use_id: 5,
          },
          "6️⃣": {
            name: `Перерождения`,
            emoji: "6️⃣",
            emoji_canvas: `./../../other/minecraft/shop/shop_rebirth.png`,
            use: true,
            use_id: 6,
            mining_blocked: true,
            fixed_pos: {
              x: 2,
              y: 2,
            },
          },
          "7️⃣": {
            name: `Модификаторы`,
            emoji: "7️⃣",
            emoji_canvas: `./../../other/minecraft/shop/shop_modificator.png`,
            use: true,
            use_id: 7,
            mining_blocked: true,
            fixed_pos: {
              x: -2,
              y: 2,
            },
          },
          "8️⃣": {
            name: "Статистика",
            emoji: "8️⃣",
            emoji_canvas: `./../../other/minecraft/shop/shop_stats.png`,
            use: true,
            use_id: 8,
            mining_blocked: true,
            fixed_pos: {
              x: -3,
              y: -2,
            },
          },
          "🛑": {
            name: "Барьер",
            emoji: "🛑",
            emoji_canvas: "./../../other/minecraft/barrier.png",
            mining_blocked: true,
            from: 4,
            to: 10,
          },
        };
      } else {
        blocks = {
          "🟩": {
            name: "Спавн",
            emoji: "🟩",
            emoji_canvas: "./../../other/minecraft/locations/grass.png",
            from: 0,
            to: 1,
            tier: 0,
            id: 0,
          },
          "🟫": {
            name: "Камень",
            emoji: "🟫",
            emoji_canvas: "./../../other/minecraft/locations/stone.png",
            from: 1,
            to: 6,
            price: 0.5,
            tier: 1,
            id: 1,
          },
          "🔳": {
            name: "Сланец",
            emoji: "🔳",
            emoji_canvas: "./../../other/minecraft/locations/deepslate.png",
            from: 6,
            to: 15,
            price: 1.2,
            tier: 2,
            id: 2,
          },
          "🔲": {
            name: "Чёрный камень",
            emoji_canvas: "./../../other/minecraft/locations/blackstone.png",
            emoji: "🔲",
            from: 15,
            to: 25,
            price: 1.8,
            tier: 3,
            id: 3,
          },
          "⚛️": {
            name: `Аметист`,
            emoji_canvas: "./../../other/minecraft/locations/amethyst.png",
            emoji: "⚛️",
            from: 25,
            to: 50,
            price: 2,
            tier: 4,
            id: 4,
          },
          "✴️": {
            name: `Сталь`,
            emoji_canvas: `./../../other/minecraft/locations/copper.png`,
            emoji: "✴️",
            from: 50,
            to: 115,
            price: 2.5,
            tier: 5,
            id: 5,
          },
          "❇️": {
            name: `Земля ада`,
            emoji_canvas: `./../../other/minecraft/locations/nylium.png`,
            emoji: "❇️",
            from: 115,
            to: 210,
            price: 3,
            tier: 6,
            id: 6,
          },
          "🛑": {
            name: "В разработке...",
            emoji: "🛑",
            emoji_canvas: "./../../other/minecraft/barrier.png",

            use: true,
            use_id: -1,
            mining_blocked: true,

            from: 210,
            to: 300,
          },
        };
      }

      if (painting_mode === 1) {
        all_blocks = blocks;
        blocks = temp_blocks;
      }
    }

    var font_size_last_check = NaN;
    var font_size = 66;
    var canvas_images = {};

    var upgrds = [];

    function upgrades_update(current_player) {
      if (current_player.shopping.page === 2) {
        upgrds = [
          {
            name: `Рюкзак блоков`,
            emoji: "🎒",
            description: "Позволяет нести больше блоков!",
            current_level: `${current_player.tools.backpack.level}`,
            price_multiply: 2.5,
            price: 5,
            id: 0,
            keys: [
              {
                key: `${key}.tools.backpack.size`,
                multiply: 1.5,
              },
              {
                key: `${key}.tools.backpack.level`,
                add: 1,
              },
            ],
          },
          {
            name: `Рюкзак расходников`,
            emoji: "👜",
            description: "Позволяет нести больше используемых вещей!",
            current_level: `${current_player.tools.tools_backpack.level}`,
            price_multiply: 2.5,
            price: 7,
            id: 1,
            keys: [
              {
                key: `${key}.tools.tools_backpack.size`,
                multiply: 2,
              },
              {
                key: `${key}.tools.tools_backpack.level`,
                add: 1,
              },
            ],
          },
          {
            name: `Мощность кирки`,
            emoji: "⛏️",
            description: "Увеличивает урон по блокам",
            current_level: `${current_player.tools.pickaxe.level}`,
            price_multiply: 2.3,
            price: 4,
            id: 2,
            keys: [
              {
                key: `${key}.tools.pickaxe.level`,
                add: 1,
              },
            ],
          },
          {
            name: `Прочность кирки`,
            emoji: "⚒️",
            description: "Увеличивает лимит максимальной прочности!",
            current_level: `${current_player.tools.pickaxe.durability_level}`,
            price_multiply: 2.2,
            price: 6,
            id: 3,
            keys: [
              {
                key: `${key}.tools.pickaxe.durability_level`,
                add: 1,
              },
              {
                key: `${key}.tools.pickaxe.durability_max`,
                multiply: 1.5,
              },
            ],
          },
          {
            name: "Мощность меча",
            emoji: "🗡️",
            description: "Позволяет наносить врагу больше урона!",
            current_level: `${current_player.tools.sword.level}`,
            price_multiply: 2.1,
            price: 5,
            id: 4,
            keys: [
              {
                key: `${key}.tools.sword.level`,
                add: 1,
              },
            ],
          },
          {
            name: "Прочность меча",
            emoji: "⚔️",
            description: "Увеличивает максимальную прочность меча!",
            current_level: `${current_player.tools.sword.durability_level}`,
            price_multiply: 2,
            price: 7,
            id: 5,
            keys: [
              {
                key: `${key}.tools.sword.durability_level`,
                add: 1,
              },
              {
                key: `${key}.tools.sword.durability_max`,
                multiply: 1.5,
              },
            ],
          },
          {
            name: `Увеличение поля зрения`,
            emoji: "👁️",
            description: "Вы видите на большее кол-во блоков вокруг!",
            current_level: `${current_player.tools.vision.level}`,
            price_multiply: 4,
            price: 10,
            id: 6,
            upgrade_to: 15,
            keys: [
              {
                key: `${key}.tools.vision.level`,
                add: 1,
              },
              {
                key: `${key}.tools.vision.number`,
                add: 2,
              },
            ],
          },
          {
            name: `Максимальное здоровье`,
            emoji: `❤️`,
            description: `Добавляет дополнительное сердце`,
            current_level: `${current_player.health_level}`,
            price_multiply: 1.8,
            price: 6,
            id: 7,
            lvl_from: 2,
            keys: [
              {
                key: `${key}.health_max`,
                add: 2,
              },
              {
                key: `${key}.health_level`,
                add: 1,
              },
            ],
          },
          {
            name: `Максимальный голод`,
            emoji: `🍖`,
            description: `Добавляет дополнительную ячейку голода`,
            current_level: `${current_player.food_level}`,
            price_multiply: 2,
            price: 6,
            id: 8,
            lvl_from: 2,
            keys: [
              {
                key: `${key}.food_max`,
                add: 2,
              },
              {
                key: `${key}.food_level`,
                add: 1,
              },
            ],
          },
          {
            name: `Повышенная сытость`,
            emoji: `🥩`,
            description: `Вы меньше тратите голода`,
            current_level: `${current_player.food_when_multiplier_lvl}`,
            price_multiply: 2,
            price: 8,
            id: 9,
            lvl_from: 2,
            keys: [
              {
                key: `${key}.food_when_multiplier`,
                add: 0.1,
              },
              {
                key: `${key}.food_when_multiplyer_lvl`,
                add: 1,
              },
            ],
          },
        ];
      }
      if (current_player.shopping.page === 7) {
        upgrds = [
          {
            name: `Уменьшение здоровья всех мобов`,
            emoji: `🧟`,
            description: `У всех мобов уменьшено здоровье`,
            current_level: `${current_player.modificators.mobs_health}`,
            price_multiply: 12,
            price: 5,
            id: 0,
            lvl_from: 4,
            keys: [
              {
                key: `${key}.modificators.mobs_health`,
                add: 0.05,
              },
            ],
          },
          {
            name: `Ослабление блоков`,
            emoji: `🏔️`,
            description: `Все блоки копаются легче`,
            current_level: `${current_player.modificators.blocks_health}`,
            price_multiply: 14,
            price: 4,
            id: 1,
            lvl_from: 4,
            keys: [
              {
                key: `${key}.modificators.blocks_health`,
                add: 0.05,
              },
            ],
          },
          {
            name: `Увеличение получения опыта`,
            emoji: `🌠`,
            description: `Вы получаете больше опыта`,
            current_level: `${current_player.modificators.xp_boost}`,
            price_multiply: 12,
            price: 6,
            id: 2,
            lvl_from: 4,
            keys: [
              {
                key: `${key}.modificators.xp_boost`,
                add: 0.05,
              },
            ],
          },
          {
            name: `Авто-передвижение при ломании`,
            emoji: `⏏️`,
            description: `Вы автоматически двигаетесь туда, где сломали блок. Экономит целый ход!`,
            current_level: `${current_player.modificators.block_teleport_at_break}`,
            price_multiply: 2,
            price: 15,
            id: 3,
            lvl_from: 6,
            upgrade_to: 2,
            keys: [
              {
                key: `${key}.modificators.block_teleport_at_break`,
                add: 1,
              },
            ],
          },
        ];
      }
    }

    async function mobss(current_player, visible_area) {
      for (var i = 0; i < current_player.destroyed.length; i++) {
        var x = Number(current_player.destroyed[i].split(">")[0]);
        var y = Number(current_player.destroyed[i].split(">")[1]);

        if (
          visible_area.includes(`${x}>${y}`) &&
          !current_player.mobs[`${x}>${y}`] &&
          current_player.destroyed.includes(`${x}>${y}`)
        ) {
          var generation = randomInteger(0, 45);
          console.log(`GENERATION XY: ${x}>${y}`);
          console.log(`TARGET XY: ${current_player.x}>${current_player.y}`);
          console.log(`GENERATION ${generation}`);
          if (generation === 0) {
            console.log(`${x}>${y} : ${generation}`);
            var not_to_spawn = 0;
            var selected_mob_xy = Math.abs(x) + Math.abs(y);
            Object.keys(current_player.mobs).forEach((key) => {
              var _mob = current_player.mobs[key];
              var _mob_x = _mob.x;
              var _mob_y = _mob.y;
              var _mob_xy = Math.abs(_mob_x) + Math.abs(_mob_y);
              var _player_xy =
                Math.abs(current_player.x) + Math.abs(current_player.y);
              if (_mob_x === current_player.x && _mob_y === current_player.y) {
                not_to_spawn = 1;
                console.log(`no spawn inside the player`);
              } else if (
                _mob_xy - 1 <= _player_xy ||
                _mob_xy + 1 >= _player_xy
              ) {
                not_to_spawn = 1;
                console.log(`no spawn close to player`);
                console.log(`SPAWNED | MOB XY ${_mob_xy}`);
                console.log(`SPAWNED | PLAYER XY ${_player_xy}`);
              } else if (
                _mob_xy + 4 > selected_mob_xy &&
                _mob_xy - 4 < selected_mob_xy
              ) {
                not_to_spawn = 1;
                console.log(`no spawn`);
              }
            });
            Object.keys(current_player.placed).forEach((key) => {
              var current_placed = current_player.placed[key];
              if (items[current_placed.key]?.light) {
                var item_x = Number(current_placed.xy.split(">")[0]);
                var item_y = Number(current_placed.xy.split(">")[1]);
                var power = items[current_placed.key].light.power;
                if (
                  x >= item_x - power &&
                  x <= item_x + power &&
                  y >= item_y - power &&
                  y <= item_y + power
                ) {
                  not_to_spawn = 1;
                  console.log(`not spawning due to light`);
                }
              }
            });
            if (not_to_spawn === 0) {
              var xy = Math.abs(x + y);
              var mob_rank = 0;
              for (var i = 0; i < locations.length; i++) {
                if (locations[i].from <= xy && locations[i].to >= xy) {
                  mob_rank = locations[i].tier;
                }
              }
              /*await client.fdb.set(`${key}.mobs.${x}>${y}`, {
								x: x,
								y: y,
								rank: mob_rank,
								health: 20 * mob_rank,
								damage: 1 * (0.5 + mob_rank / 1.5),
							})*/
              await client.fdb.set(`${key}.mobs.${x}>${y}.x`, x);
              await client.fdb.set(`${key}.mobs.${x}>${y}.y`, y);
              await client.fdb.set(`${key}.mobs.${x}>${y}.rank`, mob_rank);
              await client.fdb.set(
                `${key}.mobs.${x}>${y}.health`,
                20 * mob_rank
              );
              await client.fdb.set(
                `${key}.mobs.${x}>${y}.damage`,
                1 * (0.5 + mob_rank / 1.5)
              );
              return;
            }
          }
        }
      }
    }

    async function block({ y, x, current_player }) {
      var emoji = "⬜️";

      // Ensure current_player has required properties
      if (!current_player) {
        console.error("block function received undefined current_player");
        return emoji;
      }

      // Initialize missing properties if they don't exist
      if (!current_player.shopping) {
        current_player.shopping = { status: 0, page: 0 };
      }

      if (!current_player.tools) {
        current_player.tools = {
          vision: { number: 11, level: 1 },
          sword: { durability: 50, durability_max: 50, damage: 5 },
        };
      } else if (!current_player.tools.vision) {
        current_player.tools.vision = { number: 11, level: 1 };
      }

      if (!current_player.player.look) {
        current_player.player.look = 0;
      }

      if (!current_player.founded_pos) {
        current_player.founded_pos = [];
      }

      console.log(y, x);

      function fixed_blockk(fixed_x, fixed_y, emoj) {
        if (x === fixed_x && y === fixed_y) {
          emoji = emoj;
        }
      }

      function blockk(number, distance, emoj) {
        if (
          y >= number - number * 2 &&
          y <= number &&
          x >= number - number * 2 &&
          x <= number
        ) {
          if (distance) {
            if (Math.abs(y) <= distance && Math.abs(x) <= distance) {
              return;
            }
          }
          emoji = emoj;
        } else {
          console.log(`${y} >= ${number - number * 2} && ${y} <= ${number}`);
          console.log(`${x} >= ${number - number * 2} && ${x} <= ${number}`);
        }
      }

      Object.keys(blocks).forEach(function (key) {
        var block = blocks[key];
        if (block.to) {
          blockk(block.to, block.from, block.emoji);
        }
        if (block.fixed_pos) {
          fixed_blockk(block.fixed_pos.x, block.fixed_pos.y, block.emoji);
        }
      });

      var founded = await client.fdb.get(
        `${key}${(painting_text_db || "") + "." || "."}founded`,
        "mining2"
      );

      // Ensure founded is an array
      if (!founded) {
        founded = [];
        await client.fdb.set(`${key}.founded`, []);
      }

      for (var i = 0; i < (founded ? founded.length : 0); i++) {
        // Handle new structure: {x, y, ore}
        const foundedEntry = founded[i];
        if (!foundedEntry || typeof foundedEntry !== "object") continue; // Skip invalid entries
        var founded_x = foundedEntry.x;
        var founded_y = foundedEntry.y;
        var founded_ore = foundedEntry.ore; // Get the ore object
        if (x === founded_x && y === founded_y) {
          var destroyed = await client.fdb.get(
            `${key}${(painting_text_db || "") + "." || "."}destroyed`,
            "mining2"
          );

          // Ensure destroyed is an array
          if (!destroyed) {
            destroyed = [];
            await client.fdb.set(`${key}.destroyed`, []);
          }

          var remove_this = 0;
          for (var i = 0; i < (destroyed ? destroyed.length : 0); i++) {
            var x_ = Number(destroyed[i].split(">")[0]);
            var y_ = Number(destroyed[i].split(">")[1]);
            if (x_ === founded_x && y_ === founded_y) {
              remove_this = 1;
              break;
            }
          }
          if (remove_this === 1) {
            break;
          } else {
            // Use the specific ore emoji
            emoji = founded_ore?.emoji || "🟪"; // Fallback to default if ore is missing
          }
        }
      }

      if (current_player.shopping.status === 0 && painting_mode === 0) {
        if (
          !(current_player.player.x < 0 && current_player.player.look === 0) ||
          !(current_player.player.y < 0 && current_player.player.look === 1) ||
          !(current_player.player.x > 0 && current_player.player.look === 2) ||
          !(current_player.player.y > 0 && current_player.player.look === 3)
        ) {
          var max_y =
            current_player.player.y +
            Math.floor(current_player.tools.vision.number / 2);
          var min_y =
            current_player.player.y -
            Math.floor(current_player.tools.vision.number / 2);
          var max_x =
            current_player.player.x +
            Math.floor(current_player.tools.vision.number / 2);
          var min_x =
            current_player.player.x -
            Math.floor(current_player.tools.vision.number / 2);

          if (Math.abs(current_player.player.x + current_player.player.y) > 1) {
            if ((x === max_x || x === min_x) && (y === max_y || y === min_y)) {
              var generation = randomInteger(0, 10);
              console.log(`ORE GENERATION IS ${generation}`);
              if (generation === 0) {
                var generate_stop = 0;
                var already_spawned = 0;

                for (var i = 0; i < current_player.founded_pos.length; i++) {
                  let x = Number(current_player.founded_pos[i].split(">")[0]);
                  let y = Number(current_player.founded_pos[i].split(">")[1]);
                  console.log(Math.abs(x + y));
                  console.log(
                    Math.abs(
                      current_player.player.x + current_player.player.y
                    ) - 1
                  );
                  console.log(
                    Math.abs(
                      current_player.player.x + current_player.player.y
                    ) + 1
                  );
                  if (
                    Math.abs(x + y) >
                      Math.abs(
                        current_player.player.x + current_player.player.y
                      ) -
                        4 &&
                    Math.abs(x + y) <
                      Math.abs(
                        current_player.player.x + current_player.player.y
                      ) +
                        4
                  ) {
                    console.log("close to last ore finding position");
                    generate_stop = 1;
                    break;
                  }
                }

                if (generate_stop === 0) {
                  if (already_spawned === 0) {
                    already_spawned === 1;

                    let founded = await client.fdb.get(
                      `${key}.founded`,
                      "mining2"
                    );
                    let founded_pos = await client.fdb.get(
                      `${key}.founded_pos`,
                      "mining2"
                    );

                    // Ensure arrays exist
                    if (!founded || !Array.isArray(founded)) {
                      founded = [];
                    }

                    if (!founded_pos || !Array.isArray(founded_pos)) {
                      founded_pos = [];
                    }

                    // Determine location tier for potential ore
                    const checkX = current_player.player.x;
                    const checkY = current_player.player.y;
                    let oreLocationTier = 0;
                    for (let loc of locations) {
                      const dist = Math.abs(checkX) + Math.abs(checkY);
                      if (dist >= loc.from && dist < loc.to) {
                        oreLocationTier = loc.tier;
                        break;
                      }
                    }
                    // Find the ore for this tier
                    const potentialOre = ores.find(
                      (o) => o.tier === oreLocationTier
                    );

                    if (potentialOre) {
                      let oreX, oreY;
                      switch (current_player.player.look) {
                        case 0: {
                          // Looking Left (target Right)
                          oreX = max_x + 1;
                          oreY = randomInteger(min_y, max_y);
                          break;
                        }
                        case 1: {
                          // Looking Down (target Up)
                          oreX = randomInteger(min_x, max_x);
                          oreY = max_y + 1;
                          break;
                        }
                        case 2: {
                          // Looking Right (target Left)
                          oreX = min_x - 1;
                          oreY = randomInteger(min_y, max_y);
                          break;
                        }
                        case 3: {
                          // Looking Up (target Down)
                          oreX = randomInteger(min_x, max_x);
                          oreY = min_y - 1;
                          break;
                        }
                      }

                      // Store {x, y, ore_emoji}
                      founded.push({ x: oreX, y: oreY, ore: potentialOre });
                      await client.fdb.set(
                        `${key}.founded`,
                        JSON.stringify(founded)
                      );

                      // Also update founded_pos (though its usage is unclear)
                      founded_pos.push(`${checkX}>${checkY}`);
                      await client.fdb.set(
                        `${key}.founded_pos`,
                        JSON.stringify(founded_pos)
                      );
                    }
                  }
                }
              }
            }
          }
        }
      }

      return emoji;
    }

    async function shopping_menu({
      embed: embed,
      current_player: current_player,
      buffer_ready: buffer_ready,
      interaction: interaction,
    }) {
      if (!current_player) {
        current_player = await client.fdb.get(
          `${key}${(painting_text_db || "") + "." || "."}`,
          painting_mode ? "mining2_paint" : "mining2",
          true
        );
      }
      var shop_pages = {
        current: [],
      };

      embed
        .setTitle("Магазин")
        .setDescription(`Продавайте руды и прокачивайте своё снаряжение!`);

      shop_pages.current.push({
        label: `Назад`,
        value: `back`,
        description: " ",
        emoji: "◀️",
      });

      console.log(`SHHOP`, current_player);

      if (painting_mode === 1) {
        if (current_player.shopping.status === 2) {
          var custom_texture_control = new ActionRowBuilder().addComponents([
            new ButtonBuilder()
              .setStyle(ButtonStyle.Primary)
              .setLabel(`Назад`)
              .setCustomId("mine_painting_custom_back"),
            new ButtonBuilder()
              .setStyle(
                `${
                  current_player.shopping.custom_name &&
                  current_player.shopping.custom_name.toString().length > 0
                    ? ButtonStyle.Primary
                    : ButtonStyle.Secondary
                }`
              )
              .setLabel(`Название`)
              .setCustomId("mine_painting_custom_name"),
            new ButtonBuilder()
              .setStyle(
                `${
                  current_player.shopping.custom_emoji &&
                  current_player.shopping.custom_emoji.toString().length > 0
                    ? ButtonStyle.Primary
                    : ButtonStyle.Secondary
                }`
              )
              .setEmoji(
                `${
                  current_player.shopping.custom_emoji &&
                  current_player.shopping.custom_emoji.toString().length > 0
                    ? `${current_player.shopping.custom_emoji}`
                    : "❔"
                }`
              )
              .setLabel(`Эмодзи`)
              .setCustomId("mine_painting_custom_emoji"),
            new ButtonBuilder()
              .setStyle(
                `${
                  current_player.shopping.custom_url &&
                  current_player.shopping.custom_url.toString().length > 0
                    ? ButtonStyle.Primary
                    : ButtonStyle.Secondary
                }`
              )
              .setLabel(`Ссылка на текстуру`)
              .setCustomId("mine_painting_custom_url"),
            new ButtonBuilder()
              .setStyle(ButtonStyle.Primary)
              .setLabel(`Создать`)
              .setCustomId("mine_painting_custom_create"),
          ]);
          embed.addFields({
            name: `Предпросмотр`,
            value: `\` ${current_player.shopping.custom_emoji || ""} \` ${
              current_player.shopping.custom_name || ""
            }\n\n- Скопировать эмодзи можно отсюда [getemoji.com](https://getemoji.com/)\n- Текстуры блоков майнкрафта можно найти тут [vanilladefault](https://www.curseforge.com/minecraft/texture-packs/vanilladefault)\n- Если вы хотите вытянуть ссылку из файла который скачали, можете отправить его в чат а затем нажать по нему **ПКМ -> "Скопировать ссылку"**\n- Рекомендуемые форматы: \`png, jpg\`. **Другие форматы (например webp, gif) могут сломать ваш холст!**`,
          });
          if (current_player.shopping.custom_url) {
            try {
              embed.setImage(`${current_player.shopping.custom_url}`);
            } catch (error) {
              /*await mining2.set(`${key}.shopping.custom_url`, undefined)*/
              await client.fdb.set(`${key}.shopping.custom_url`, undefined);
              return updater();
            }
          }
          try {
            return gameMessage.edit(
              await client.tall(
                {
                  embeds: [embed],
                  files: [],
                  components: [custom_texture_control],
                },
                interaction.locale,
                { fetchReply: true }
              )
            );
          } catch (error) {
            if (error.toString().includes("emoji")) {
              /*await mining2.set(`${key}.shopping.custom_emoji`, undefined)*/
              await client.fdb.set(`${key}.shopping.custom_emoji`, undefined);
              return updater();
            }
          }
        }
        if (current_player.shopping.status === 1) {
          var selector = [
            new StringSelectMenuOptionBuilder({
              label: `Назад`,
              emoji: `◀️`,
              value: `back`,
            }),
          ];
          var page_i = 0;
          var page_ii = 0;
          Object.keys(all_blocks).forEach((key) => {
            var current_block = all_blocks[key];
            if (!current_block.mining_blocked) {
              page_i++;
              if (
                page_i > 25 * (current_player.shopping.page - 1) &&
                page_i < 25 * current_player.shopping.page - 1
              ) {
                page_ii++;
                selector.push(
                  new StringSelectMenuOptionBuilder({
                    label: `${current_block.name}`,
                    emoji: `${current_block.emoji}`,
                    value: `block-${current_block.id}`,
                  })
                );
              }
            }
          });
          Object.keys(ores).forEach((key) => {
            var current_ore = ores[key];
            if (current_ore.tier) {
              page_i++;
              if (
                page_i > 25 * (current_player.shopping.page - 1) &&
                page_i < 25 * current_player.shopping.page - 1
              ) {
                page_ii++;
                selector.push(
                  new StringSelectMenuOptionBuilder({
                    label: `${current_ore.name}`,
                    emoji: `${current_ore.emoji}`,
                    value: `ore-${current_ore.tier}`,
                  })
                );
              }
            }
          });
          Object.keys(mobs).forEach((key) => {
            var current_mob = mobs[key];
            if (current_mob.id) {
              page_i++;
              if (
                page_i > 25 * (current_player.shopping.page - 1) &&
                page_i < 25 * current_player.shopping.page - 1
              ) {
                page_ii++;
                selector.push(
                  new StringSelectMenuOptionBuilder({
                    label: `${current_mob.name}`,
                    emoji: `${current_mob.emoji}`,
                    value: `mob-${current_mob.id}`,
                  })
                );
              }
            }
          });
          Object.keys(current_player.custom_textures).forEach((key) => {
            var current_custom_texture = current_player.custom_textures[key];
            if (current_custom_texture.id) {
              page_i++;
              if (
                page_i > 25 * (current_player.shopping.page - 1) &&
                page_i < 25 * current_player.shopping.page - 1
              ) {
                page_ii++;
                selector.push(
                  new StringSelectMenuOptionBuilder({
                    label: `${current_custom_texture.name}`,
                    description: `${
                      current_player.selected_block?.id ===
                      Number(current_custom_texture.id)
                        ? `Уже выбран. Нажмите что-бы удалить`
                        : ""
                    }`,
                    emoji: `${current_custom_texture.emoji}`,
                    value: `custom-${current_custom_texture.id}`,
                  })
                );
              }
            }
          });

          if (page_ii === 24) {
            page_ii++;
            selector.push(
              new StringSelectMenuOptionBuilder({
                label: `Следующая страница`,
                emoji: `▶️`,
                value: `next`,
              })
            );
          } else if (page_ii < 24) {
            page_ii++;
            selector.push(
              new StringSelectMenuOptionBuilder({
                label: `Свои текстуры`,
                emoji: `➕`,
                value: `add_custom`,
              })
            );
          }
          console.log(selector);
          var block_selector = new ActionRowBuilder().addComponents([
            new StringSelectMenuBuilder()
              .setCustomId("mine_painting_block_selected")
              .setPlaceholder(`Выберите блок`)
              .setOptions(selector),
          ]);
          return gameMessage.edit(
            await client.tall(
              {
                content: `Выберите нужный вам блок`,
                components: [block_selector],
              },
              interaction.locale,
              { fetchReply: true }
            )
          );
        }
      }

      current_player = await client.fdb.get(`${key}`, "mining2", true);

      if (current_player.shopping.page === -1) {
        /*await mining2.set(`${key}.shopping.page`, 0)*/
        await client.fdb.set(`${key}.shopping.page`, 0);
        current_player.shopping.page === 0;
        return;
      }

      if (current_player.shopping.page === 1) {
        var i = 0;
        Object.keys(current_player.inventory).forEach((key) => {
          if (current_player.inventory[key]?.id) {
            var inventory_one = current_player.inventory[key];
            i++;
            shop_pages.current.push({
              label: inventory_one.name,
              value: `${inventory_one.id}>${inventory_one.price_all}>${inventory_one.count}>${inventory_one.tier}`,
              description: `${inventory_one.price_all.toFixed(1)}$`,
              emoji: `${inventory_one.emoji}`,
            });
          }
        });
        if (i > 0) {
          shop_pages.current.push({
            label: `Продать всё`,
            description: `${current_player.inventory.to_sell.toFixed(1)}$`,
            value: `everything`,
            emoji: "🎒",
          });
        }

        var sell_selector = new ActionRowBuilder().addComponents([
          new StringSelectMenuBuilder()
            .setCustomId("mine_sell")
            .setPlaceholder("Выберите что хотите продать")
            .addOptions(shop_pages.current),
        ]);
        return gameMessage.edit(
          await client.tall(
            {
              embeds: [embed],
              files: [buffer_ready],
              content: " ",
              components: [sell_selector],
            },
            interaction.locale,
            { fetchReply: true }
          )
        );
      }
      if (current_player.shopping.page === 2) {
        var current_player =
          /*await mining2.get(`${key}`)*/ await client.fdb.get(
            `${key}`,
            "mining2",
            true
          );
        upgrades_update(current_player);
        upgrds.forEach((upgrade) => {
          var price = upgrade.price;
          if (upgrade.current_level > 1) {
            price =
              price *
              (Number(upgrade.current_level) - 1) *
              upgrade.price_multiply;
          }
          shop_pages.current.push({
            label: `${upgrade.name} (${upgrade.current_level})`,
            emoji: `${upgrade.emoji}`,
            value: `${upgrade.id}>${price}`,
            description: `${price.toFixed(1)}$ | ${upgrade.description}`,
          });
        });

        console.log(shop_pages.current);

        var upgrade_selector = new ActionRowBuilder().addComponents([
          new StringSelectMenuBuilder()
            .setCustomId("mine_upgrade")
            .setPlaceholder("Выберите что хотите улучшить")
            .addOptions(shop_pages.current),
        ]);
        return gameMessage.edit(
          await client.tall(
            {
              embeds: [embed],
              files: [buffer_ready],
              content: " ",
              components: [upgrade_selector],
            },
            interaction.locale,
            { fetchReply: true }
          )
        );
      }
      if (current_player.shopping.page === 3) {
        var current_player =
          /*await mining2.get(`${key}`)*/ await client.fdb.get(
            `${key}`,
            "mining2",
            true
          );
        Object.keys(current_player.tools).forEach((key) => {
          var current_tool = current_player.tools[key];
          var current_tool_extended = tools[key];
          if (current_tool.durability >= 0) {
            var repair_price =
              (current_tool.durability_max - current_tool.durability) *
              (0.02 * (1 + current_tool.level / 2));
            shop_pages.current.push({
              label: `${current_tool_extended.name}`,
              emoji: `${current_tool_extended.emoji}`,
              value: `${key}>${repair_price}`,
              description: `${repair_price.toFixed(1)} | ${
                current_tool.durability
              } > ${current_tool.durability_max} ед.`,
            });
          }
        });

        var upgrade_selector = new ActionRowBuilder().addComponents([
          new StringSelectMenuBuilder()
            .setCustomId("mine_repair")
            .setPlaceholder("Выберите что хотите починить")
            .addOptions(shop_pages.current),
        ]);

        return gameMessage.edit(
          await client.tall(
            {
              embeds: [embed],
              files: [buffer_ready],
              content: " ",
              components: [upgrade_selector],
            },
            interaction.locale,
            { fetchReply: true }
          )
        );
      }
      if (current_player.shopping.page === 4) {
        var current_player =
          /*await mining2.get(`${key}`)*/ await client.fdb.get(
            `${key}`,
            "mining2",
            true
          );
        var heal_price =
          0.15 * (current_player.health_max - current_player.health);
        var food_price = 0.1 * (current_player.food_max - current_player.food);
        shop_pages.current.push({
          label: `Восполнить голод`,
          emoji: "🥩",
          value: `food>${food_price}`,
          description: `${food_price.toFixed(1)} | ${current_player.food} > ${
            current_player.food_max
          }`,
        });
        shop_pages.current.push({
          label: `Исцеление`,
          emoji: "❤️",
          value: `heal>${heal_price}`,
          description: `${heal_price.toFixed(1)} | ${current_player.health} > ${
            current_player.health_max
          }`,
        });

        console.log(shop_pages.current);

        var food_selector = new ActionRowBuilder().addComponents([
          new StringSelectMenuBuilder()
            .setCustomId("mine_food")
            .setPlaceholder("Выберите что хотите восполнить")
            .addOptions(shop_pages.current),
        ]);

        return gameMessage.edit(
          await client.tall(
            {
              embeds: [embed],
              files: [buffer_ready],
              content: " ",
              components: [food_selector],
            },
            interaction.locale,
            { fetchReply: true }
          )
        );
      }
      if (current_player.shopping.page === 5) {
        var current_player =
          /*await mining2.get(`${key}`)*/ await client.fdb.get(
            `${key}`,
            "mining2",
            true
          );

        Object.keys(items).forEach((key) => {
          var current_item = items[key];
          shop_pages.current.push({
            label: `${current_item.name} (${
              current_player.tools_inventory.hasOwnProperty(current_item.id)
                ? current_player.tools_inventory[current_item.id].count
                : 0
            })`,
            emoji: `${current_item.emoji}`,
            value: `${key}>${current_item.shop.price}`,
            description: `${current_item.shop.price}$ | ${current_item.description}`,
          });
        });

        console.log(shop_pages.current);

        var item_selector = new ActionRowBuilder().addComponents([
          new StringSelectMenuBuilder()
            .setCustomId("mine_items")
            .setPlaceholder("Выберите что хотите сделать")
            .addOptions(shop_pages.current),
        ]);
        return gameMessage.edit(
          await client.tall(
            {
              embeds: [embed],
              files: [buffer_ready],
              content: " ",
              components: [item_selector],
            },
            interaction.locale,
            { fetchReply: true }
          )
        );
      }
      if (current_player.shopping.page === 6) {
        var current_rebirth =
          /*((await eco.get(`${key}-rebirth_mining2`)) || 0) + 1*/ (await client.fdb.get(
            `${key.replace("mining2", "")}.rebirth_mining2`
          )) + 1;
        var min_money = 45 * current_rebirth;
        var min_level = 10 * current_rebirth;

        shop_pages.current.push({
          label: `Выполнить перерождение`,
          emoji: "🔄",
          value: `rebirth>${min_level}>${min_money}`,
          description: `Вам нужно: ${min_money}$ и ${min_level}LVL+`,
        });

        var rebirth_selector = new ActionRowBuilder().addComponents([
          new StringSelectMenuBuilder()
            .setCustomId("mine_rebirth")
            .setPlaceholder("Выберите что хотите купить")
            .addOptions(shop_pages.current),
        ]);
        return gameMessage.edit(
          await client.tall(
            {
              embeds: [embed],
              files: [buffer_ready],
              content: " ",
              components: [rebirth_selector],
            },
            interaction.locale,
            { fetchReply: true }
          )
        );
      }
      if (current_player.shopping.page === 7) {
        var current_player =
          /*await mining2.get(`${key}`)*/ await client.fdb.get(
            `${key}`,
            "mining2",
            true
          );
        upgrades_update(current_player);
        upgrds.forEach((upgrade) => {
          var price = upgrade.price;
          if (upgrade.current_level > 1) {
            price =
              price *
              (Number(upgrade.current_level) - 1) *
              upgrade.price_multiply;
          }
          shop_pages.current.push({
            label: `${upgrade.name} (${upgrade.current_level})`,
            emoji: `${upgrade.emoji}`,
            value: `${upgrade.id}>${price}`,
            description: `${price.toFixed(1)}$ | ${upgrade.description}`,
          });
        });

        console.log(shop_pages.current);

        var upgrade_selector = new ActionRowBuilder().addComponents([
          new StringSelectMenuBuilder()
            .setCustomId("mine_upgrade")
            .setPlaceholder("Выберите что хотите улучшить")
            .addOptions(shop_pages.current),
        ]);
        return gameMessage.edit(
          await client.tall(
            {
              embeds: [embed],
              files: [buffer_ready],
              content: " ",
              components: [upgrade_selector],
            },
            interaction.locale,
            { fetchReply: true }
          )
        );
      }
      if (current_player.shopping.page === 8) {
        var current_player =
          /*await mining2.get(`${key}`)*/ await client.fdb.get(
            `${key}`,
            "mining2",
            true
          );
        var stats_ = {
          money: "Всего денег",
          xp: "Всего опыта",
          mobs_killed: "Убито мобов",
          blocks_breaked: "Сломано блоков",
          ores_breaked: "Из них руд",
          blocks_traveled: "Преодолено блоков",
          upgrades_bought: "Куплено улучшений",
          health_revived: "Восполнено здоровья",
          food_revived: "Восполнено голода",
        };
        var i = 0;
        Object.keys(current_player.stats).forEach((key) => {
          var current_stat = current_player.stats[key];
          i++;
          shop_pages.current.push({
            label: `${stats_[key]}`,
            value: `nan-${i}`,
            description: `${current_stat}`,
          });
        });

        var stats_viewer = new ActionRowBuilder().addComponents([
          new StringSelectMenuBuilder()
            .setCustomId("mine_stats")
            .setPlaceholder("Просмотр статистики")
            .addOptions(shop_pages.current),
        ]);
        console.log(stats_viewer.components[0].options);
        return gameMessage.edit(
          await client.tall(
            {
              embeds: [embed],
              files: [buffer_ready],
              content: " ",
              components: [stats_viewer],
            },
            interaction.locale,
            { fetchReply: true }
          )
        );
      }
    }

    // Modify updater to accept key as argument
    async function updater(collected, key) {
      console.log("s");
      // Use the passed key argument for the initial fetch
      var current_player = await client.fdb.get(
        `${key}${painting_mode === 1 ? ".painting" : ""}`,
        "mining2",
        true
      );
      console.log(`CURRENT_PLAYER:`, current_player);

      if (painting_mode === 0) {
        // Use .player prefix for reads and writes
        if (current_player.player.xp >= current_player.player.xp_needed) {
          await client.fdb.set(`${key}.player.xp`, 0);
          await client.fdb.inc(`${key}.player.level`, 1, "mining2");
          await client.fdb.set(
            `${key}.player.xp_needed`,
            Math.floor(current_player.player.xp_needed * 2.2)
          );
          // Remove potentially stale refetch
          /* current_player = await client.fdb.get(
            `${key}`,
            "mining2",
            true
          );*/
        }
        // Use .player prefix for reads and writes
        // Assume food_when_multiplier is also under player? Check schema if needed.
        if (current_player.player.food <= 0) {
          await client.fdb.dec(`${key}.player.health`, 0.25, "mining2"); // Use .player.health
          // Remove potentially stale refetch
          /* current_player = await client.fdb.get(
            `${key}`,
            "mining2",
            true
          );*/
        } else if (current_player.player.food_when <= 0) {
          // Only decrement food if it's above 0
          if (current_player.player.food > 0) {
            await client.fdb.dec(`${key}.player.food`, 1, "mining2");
          }
          // Reset food_when timer
          await client.fdb.set(
            `${key}.player.food_when`,
            Math.floor(
              randomInteger(35, 40) *
                (current_player.player.food_when_multiplier || 1) // Default multiplier to 1 if missing
            )
          );
          // Remove potentially stale refetch
          /* current_player = await client.fdb.get(`${key}`, "mining2", true); */
        }
        // Use .player prefix for reads and writes
        if (current_player.player.health <= 0) {
          // Use .player.health
          await client.fdb.set(`${key}.player.x`, 0, "mining2");
          await client.fdb.set(`${key}.player.y`, 0, "mining2");
          await client.fdb.set(
            `${key}.player.health`, // Use .player.health
            current_player.player.health_max,
            "mining2"
          );
          await client.fdb.set(
            `${key}.player.food`,
            current_player.player.food_max,
            "mining2"
          );
          // Inventory reset seems okay (top-level inventory object)
          client.db.delete(`${key}.inventory`);
          await client.fdb.set(`${key}.inventory.size`, 0);
          await client.fdb.set(`${key}.inventory.to_sell`, 0);

          // Timeout seems okay (top-level timeouts)
          // Correct the timeout key construction - should just be timeouts.${key}
          await client.fdb.createTimeout(`timeouts.${key}`, ms("30m"));

          try {
            // Correct the key used to read the timeout
            const timeoutValue = await client.fdb.get(
              `timeouts.${key}` // Read using the correct key
            );

            const remainingTime =
              timeoutValue && typeof timeoutValue === "number"
                ? timeoutValue - Date.now()
                : 0;

            return gameMessage.edit(
              await client.tall(
                {
                  content: `Вы умерли!\n\nВы сможете вернуться в игру через ${
                    remainingTime > 0
                      ? prettyMilliseconds(remainingTime)
                      : "30 минут"
                  }`,
                  embeds: [],
                  components: [],
                  files: [],
                },
                interaction.locale,
                { fetchReply: true }
              )
            );
          } catch (error) {
            console.error("Error formatting timeout:", error);
            return gameMessage.edit(
              await client.tall(
                {
                  content: `Вы умерли!\n\nВы сможете вернуться в игру через 30 минут`,
                  embeds: [],
                  components: [],
                  files: [],
                },
                interaction.locale,
                { fetchReply: true }
              )
            );
          }
        }
      }

      travelling(current_player);

      const canvas = createCanvas(400, painting_mode === 1 ? 400 : 500);
      const context = canvas.getContext("2d");
      // Apply canvas extensions
      await client.ctx_extended(context);
      context.fillStyle = "#000000";

      // Ensure current_player (fetched at the start) has all required properties
      if (!current_player) {
        console.error(
          "Failed to retrieve player data, creating default player"
        );
        current_player = DEFAULT_GAME_SCHEMAS.mining2;
      }

      // Initialize missing properties if they don't exist
      if (!current_player.shopping) {
        current_player.shopping = { status: 0, page: 0 };
      }

      if (!current_player.tools) {
        current_player.tools = {
          vision: { number: 11, level: 1 },
          sword: { durability: 50, durability_max: 50, damage: 5 },
        };
      } else if (!current_player.tools.vision) {
        current_player.tools.vision = { number: 11, level: 1 };
      }

      if (!current_player.destroying) {
        current_player.destroying = {
          mob: 0,
          x: 0,
          y: 0,
          points: 0,
          points_max: 0,
        };
      }

      if (!current_player.destroyed) {
        current_player.destroyed = [];
      }

      if (!current_player.placed) {
        current_player.placed = {};
      }

      if (!current_player.mobs) {
        current_player.mobs = {};
      }

      if (!current_player.money && current_player.money !== 0) {
        current_player.money = 0;
      }

      if (!current_player.inventory) {
        current_player.inventory = { size: 0 };
      } else if (
        !current_player.inventory.size &&
        current_player.inventory.size !== 0
      ) {
        current_player.inventory.size = 0;
      }

      if (!current_player.tools_inventory) {
        current_player.tools_inventory = { size: 0 };
      } else if (
        !current_player.tools_inventory.size &&
        current_player.tools_inventory.size !== 0
      ) {
        current_player.tools_inventory.size = 0;
      }

      if (!current_player.tools.backpack) {
        current_player.tools.backpack = { size: 10 };
      } else if (!current_player.tools.backpack.size) {
        current_player.tools.backpack.size = 10;
      }

      if (!current_player.tools.tools_backpack) {
        current_player.tools.tools_backpack = { size: 5 };
      } else if (!current_player.tools.tools_backpack.size) {
        current_player.tools.tools_backpack.size = 5;
      }

      console.log(
        current_player.y,
        current_player.x,
        current_player.tools.vision.number
      );

      var playing_area = "";
      closest_blocks = [];
      var current_location;
      var visible_area = [];

      if (painting_mode === 1) {
        var painting_generated = getDeepKeys(current_player.placed);
      }

      // Use current_player.player.x/y for loop boundaries
      for (
        var y =
          current_player.player.y +
          Math.floor(current_player.tools.vision.number / 2);
        y >=
        current_player.player.y -
          Math.floor(current_player.tools.vision.number / 2);
        y--
      ) {
        for (
          var x =
            current_player.player.x +
            Math.floor(current_player.tools.vision.number / 2);
          x >=
          current_player.player.x -
            Math.floor(current_player.tools.vision.number / 2);
          x--
        ) {
          console.log(y, x);
          // Pass player object to block function if needed, ensure block() uses player.*
          var emoji = await block({
            y: y,
            x: x,
            current_player: current_player,
          });
          visible_area.push(`${x}>${y}`);
          var destroyed_point = "";
          // Use current_player.player.x/y for checks
          if (current_player.player.x === x && current_player.player.y === y) {
            destroyed_point += "!";
          }
          if (current_player.shopping.status === 0 && painting_mode === 0) {
            // Assuming mobs is top-level or needs fixing too?
            if (current_player.mobs[`${x}>${y}`]) {
              destroyed_point += "]";
            }
          }
          // Assuming destroyed is top-level or needs fixing too?
          if (current_player.destroyed.includes(`${x}>${y}`)) {
            destroyed_point += ".";
          }

          // Assuming placed is top-level or needs fixing too?
          if (current_player.placed[`${x}>${y}`]) {
            destroyed_point += "~";
          }

          // Revert destroying checks back to top-level access
          if (
            x === current_player.destroying.x &&
            y === current_player.destroying.y &&
            current_player.destroying.points !==
              current_player.destroying.points_max &&
            current_player.destroying.points > 0
          ) {
            if (
              current_player.destroying.points_max / 4 >
              current_player.destroying.points
            ) {
              destroyed_point += "-3";
            } else if (
              current_player.destroying.points_max / 2 >
              current_player.destroying.points
            ) {
              destroyed_point += "-2";
            } else {
              destroyed_point += "-1";
            }
          }

          playing_area += `${emoji}${destroyed_point} `;
          // Use current_player.player.x/y for closest_blocks checks
          if (
            (x === current_player.player.x &&
              y === current_player.player.y - 1) ||
            (x === current_player.player.x &&
              y === current_player.player.y + 1) ||
            (x === current_player.player.x - 1 &&
              y === current_player.player.y) ||
            (x === current_player.player.x + 1 && y === current_player.player.y)
          ) {
            if (current_player?.shopping.status === 0) {
              if (current_player.destroyed.includes(`${x}>${y}`)) {
                emoji = ".";
              }
            }
            closest_blocks.push([x, y, emoji]);
            if (closest_blocks.length === 5) {
              closest_blocks.shift();
            }
          }
        }
        playing_area += "|";
      }

      if (current_player.shopping.status === 0 && painting_mode === 0) {
        await mobss(current_player, visible_area);
        current_player = /*await mining2.get(`${key}`)*/ await client.fdb.get(
          `${key}`,
          "mining2",
          true
        );
      }

      console.log("Analyzing nearby blocks...");

      // Initialize arrays with proper length
      var mine_ = [false, false, false, false];
      var fight = [false, false, false, false];
      var blocked_moving = [false, false, false, false];
      var usable = [false, false, false, false];
      var pickable = [false, false, false, false];
      var pickable_mode = 0;

      // Log the closest blocks for debugging
      console.log("Closest blocks:", closest_blocks);

      // Process each closest block
      for (var i = 0; i < closest_blocks.length; i++) {
        if (!closest_blocks[i]) {
          console.log(`Skipping undefined closest block at index ${i}`);
          continue;
        }

        var current_block = closest_blocks[i][2];
        console.log(`Processing block at index ${i}:`, closest_blocks[i]);

        var block_xy = `${closest_blocks[i][0]}>${closest_blocks[i][1]}`;
        console.log(`Block coordinates: ${block_xy}`);

        // Determine the direction index based on position relative to player
        // The game uses a coordinate system where:
        // Up (0) = Same X, Y-1
        // Left (1) = X-1, Same Y
        // Right (2) = X+1, Same Y
        // Down (3) = Same X, Y+1
        let dirIndex = -1;
        // Use player.x and player.y for adjacency checks
        if (
          closest_blocks[i][0] === current_player.player.x &&
          closest_blocks[i][1] === current_player.player.y - 1
        ) {
          dirIndex = 0; // Up
        } else if (
          closest_blocks[i][0] === current_player.player.x - 1 &&
          closest_blocks[i][1] === current_player.player.y
        ) {
          dirIndex = 1; // Left
        } else if (
          closest_blocks[i][0] === current_player.player.x + 1 &&
          closest_blocks[i][1] === current_player.player.y
        ) {
          dirIndex = 2; // Right
        } else if (
          closest_blocks[i][0] === current_player.player.x &&
          closest_blocks[i][1] === current_player.player.y + 1
        ) {
          dirIndex = 3; // Down
        }

        if (dirIndex === -1) {
          console.log(
            `Block at ${block_xy} is not adjacent to player, skipping`
          );
          continue;
        }

        // Check for mobs at this position
        if (painting_mode === 0) {
          if (current_player.mobs && current_player.mobs[block_xy]) {
            console.log(
              `Found mob at ${block_xy}:`,
              current_player.mobs[block_xy]
            );
            fight[dirIndex] = true;
          } else {
            fight[dirIndex] = false;
          }
        }

        // Check if block can be mined
        if (blocks[current_block]?.mining_blocked) {
          blocked_moving[dirIndex] = true;
          mine_[dirIndex] = false;
          console.log(
            `Block ${current_block} at ${block_xy} is mining blocked`
          );
        } else {
          if (current_block === ".") {
            mine_[dirIndex] = false;
            console.log(`Empty block at ${block_xy}, can't mine`);
          } else if (current_block !== "🟩" && current_block !== "⬜️") {
            mine_[dirIndex] = true;
            console.log(`Minable block ${current_block} at ${block_xy}`);
          } else {
            mine_[dirIndex] = false;
            console.log(`Block ${current_block} at ${block_xy} can't be mined`);
          }
          blocked_moving[dirIndex] = false;
        }

        // Check for placed items
        if (current_player.placed && current_player.placed[block_xy]) {
          var current_placed = current_player.placed[block_xy];
          pickable[
            dirIndex
          ] = `${current_placed.key}>${closest_blocks[i][0]}>${closest_blocks[i][1]}`;
          pickable_mode = 1;
          console.log(`Found placed item at ${block_xy}:`, current_placed);
        } else {
          pickable[dirIndex] = false;
        }
      }

      console.log("Mining possibilities:", mine_);
      console.log("Fighting possibilities:", fight);
      console.log("Blocked moving:", blocked_moving);
      console.log("Pickable items:", pickable);

      // Create a structure to hold blocks indexed by direction
      let directionalBlocks = { 0: null, 1: null, 2: null, 3: null };
      // If in shop mode, include fixed_pos shop blocks (distance >1) in directional blocks
      if (current_player.shopping.status === 1) {
        Object.entries(blocks).forEach(([blkEmoji, blk]) => {
          if (blk.use && blk.fixed_pos) {
            const fx = blk.fixed_pos.x;
            const fy = blk.fixed_pos.y;
            let dirIdx;
            if (fy > 0) dirIdx = 0; // Up (positive y)
            else if (fx < 0) dirIdx = 1; // Left
            else if (fx > 0) dirIdx = 2; // Right
            else if (fy < 0) dirIdx = 3; // Down
            if (dirIdx !== undefined) {
              directionalBlocks[dirIdx] = [fx, fy, blkEmoji];
            }
          }
        });
      }
      // Find the actual block for each direction from the potentially unordered closest_blocks list
      // Also use player.x/y here
      for (let i = 0; i < closest_blocks.length; i++) {
        if (!closest_blocks[i]) continue;
        const [x, y, emoji] = closest_blocks[i];
        if (
          x === current_player.player.x &&
          y === current_player.player.y - 1
        ) {
          directionalBlocks[0] = closest_blocks[i]; // Up
        } else if (
          x === current_player.player.x - 1 &&
          y === current_player.player.y
        ) {
          directionalBlocks[1] = closest_blocks[i]; // Left
        } else if (
          x === current_player.player.x + 1 &&
          y === current_player.player.y
        ) {
          directionalBlocks[2] = closest_blocks[i]; // Right
        } else if (
          x === current_player.player.x &&
          y === current_player.player.y + 1
        ) {
          directionalBlocks[3] = closest_blocks[i]; // Down
        }
      }
      console.log("Directional blocks mapped:", directionalBlocks);

      var mining_mode = 0;
      var points;
      var points_max;
      if (
        current_player.destroying.points !==
          current_player.destroying.points_max &&
        current_player.destroying.points > 0
      ) {
        points = current_player.destroying.points;
        points_max = current_player.destroying.points_max;
        mining_mode = 1;
      }

      if (current_player.shopping.page === 0) {
        // In shop mode, allow arrow keys to trigger shop blocks at fixed positions
        if (current_player.shopping.status === 1) {
          // Reset usable and set per directional fixed_pos relative to player
          usable = [false, false, false, false];
          Object.entries(blocks).forEach(([emoji, blk]) => {
            if (blk.use && blk.fixed_pos) {
              const fx = blk.fixed_pos.x;
              const fy = blk.fixed_pos.y;
              const dx = fx - current_player.player.x; // Use player.x
              const dy = fy - current_player.player.y; // Use player.y

              let dir = -1; // Use -1 to indicate no adjacent fixed block in this direction

              // Check if block is exactly 1 unit away (Manhattan distance)
              if (Math.abs(dx) + Math.abs(dy) === 1) {
                // Inverted Y-axis: dy=-1 (Below) maps to UI Down (dir=3), dy=1 (Above) maps to UI Up (dir=0)
                if (dy === -1 && dx === 0)
                  dir = 3; // Block is Below (UI Down Button)
                else if (dx === 1 && dy === 0)
                  dir = 1; // Block is Right (UI Left Button)
                else if (dx === -1 && dy === 0)
                  dir = 2; // Block is Left (UI Right Button)
                else if (dy === 1 && dx === 0) dir = 0; // Block is Above (UI Up Button)
              }

              if (dir !== -1) {
                usable[dir] = `${blk.name}|mine_use-${blk.use_id}`;
              }
            }
          });
        } else {
          // Default adjacent block use logic
          for (var i = 0; i < closest_blocks.length; i++) {
            var current_block = closest_blocks[i][2];
            if (blocks[current_block]?.use) {
              usable.push(
                `${blocks[current_block].name}|mine_use-${blocks[current_block].use_id}`
              );
            } else {
              usable.push(false);
            }
          }
        }
      } else {
        usable = [false, false, false, false];
      }

      var pickable_selector = new ActionRowBuilder();
      if (pickable_mode === 1 && painting_mode === 0) {
        pickable.forEach((pick) => {
          if (pick !== false) {
            var key = pick.split(">")[0];
            var x = pick.split(">")[1];
            var y = pick.split(">")[2];
            var current_item = items[key];
            pickable_selector.addComponents([
              new ButtonBuilder()
                .setStyle(ButtonStyle.Secondary)
                .setLabel(`${current_item.name}`)
                .setEmoji(`${current_item.emoji}`)
                .setCustomId(`mine_pickup>${key}>${current_item.id}>${x}>${y}`),
            ]);
          }
        });
      }

      var controls = new ActionRowBuilder().addComponents([
        painting_mode === 1
          ? new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setEmoji("🖌")
              .setCustomId("mine_painting_block_select")
          : new ButtonBuilder()
              .setStyle(
                mining_mode === 1 ? ButtonStyle.Danger : ButtonStyle.Secondary
              )
              .setDisabled(true)
              .setLabel(
                mining_mode === 1
                  ? `${points.toFixed(1)} / ${points_max.toFixed(1)}`
                  : ` ${current_player.player.x} : ${current_player.player.y} ` // Use player.x/y
              )
              .setCustomId("mine__"),
        // Up arrow button: UI Up maps to world Down (look dir 3)
        new ButtonBuilder()
          .setStyle(
            usable[0] !== false
              ? ButtonStyle.Primary
              : fight[3] === true
              ? ButtonStyle.Danger
              : mine_[3] === true
              ? mining_mode === 1 && current_player.player.look === 1 // Use player.look
                ? ButtonStyle.Danger
                : ButtonStyle.Primary
              : ButtonStyle.Secondary
          )
          .setDisabled(
            blocked_moving[3] === true && usable[0] === false ? true : false
          )
          .setEmoji(fight[3] === true ? `🗡️` : `🔼`)
          .setLabel(
            usable[0] !== false && typeof usable[0] === "string"
              ? usable[0].split("|")[0]
              : " "
          )
          .setCustomId(
            usable[0] !== false && typeof usable[0] === "string"
              ? usable[0].split("|")[1]
              : fight[3] === true && directionalBlocks[3]
              ? `mine_punch>${directionalBlocks[3][0]}>${directionalBlocks[3][1]}>1`
              : mine_[3] === true && directionalBlocks[3]
              ? `mine_break>${directionalBlocks[3][0]}>${directionalBlocks[3][1]}>1>${directionalBlocks[3][2]}`
              : "mine_up" // UI Up button should trigger mine_up
          ),
      ]);
      if (painting_mode === 1) {
        controls.addComponents([
          new ButtonBuilder()
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(`📦`)
            .setCustomId("mine_painting_block_place"),
        ]);
        controls.addComponents([
          new ButtonBuilder()
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(`⬆️`)
            .setCustomId("mine_painting_scale_up"),
        ]);
      }

      var shop_btn = 0;
      for (var i = 0; i < closest_blocks.length; i++) {
        var current_block = closest_blocks[i][2];
        if (current_block === "🟩") {
          shop_btn = 1;
          if (current_player.shopping.status === 0) {
            controls.addComponents([
              new ButtonBuilder()
                .setStyle(ButtonStyle.Success)
                .setLabel(`Магазин`)
                .setCustomId("mine_shop"),
            ]);
          } else {
            controls.addComponents([
              new ButtonBuilder()
                .setStyle(ButtonStyle.Danger)
                .setLabel(`Выйти из магазина`)
                .setCustomId("mine_shop-leave"),
            ]);
          }
          break;
        }
      }

      var controls2 = new ActionRowBuilder().addComponents([
        // Left arrow button: UI Left maps to world Right (dir 2)
        new ButtonBuilder()
          .setStyle(
            usable[1] !== false
              ? ButtonStyle.Primary
              : fight[2] === true
              ? ButtonStyle.Danger
              : mine_[2] === true
              ? mining_mode === 1 && current_player.player.look === 0 // Use player.look
                ? ButtonStyle.Danger
                : ButtonStyle.Primary
              : ButtonStyle.Secondary
          )
          .setEmoji(fight[2] === true ? `🗡️` : `◀️`)
          .setDisabled(
            blocked_moving[2] === true && usable[1] === false ? true : false
          )
          .setLabel(
            usable[1] !== false && typeof usable[1] === "string"
              ? usable[1].split("|")[0]
              : " "
          )
          .setCustomId(
            usable[1] !== false && typeof usable[1] === "string"
              ? usable[1].split("|")[1]
              : fight[2] === true && directionalBlocks[2]
              ? `mine_punch>${directionalBlocks[2][0]}>${directionalBlocks[2][1]}>0`
              : mine_[2] === true && directionalBlocks[2]
              ? `mine_break>${directionalBlocks[2][0]}>${directionalBlocks[2][1]}>0>${directionalBlocks[2][2]}`
              : "mine_left" // UI Left button should trigger mine_left
          ),
        // Down arrow button: UI Down maps to world Up (look dir 1)
        new ButtonBuilder()
          .setStyle(
            usable[3] !== false
              ? ButtonStyle.Primary
              : fight[0] === true
              ? ButtonStyle.Danger
              : mine_[0] === true
              ? mining_mode === 1 && current_player.player.look === 3 // Use player.look
                ? ButtonStyle.Danger
                : ButtonStyle.Primary
              : ButtonStyle.Secondary
          )
          .setEmoji(fight[0] === true ? `🗡️` : `🔽`)
          .setDisabled(
            blocked_moving[0] === true && usable[3] === false ? true : false
          )
          .setLabel(
            usable[3] !== false && typeof usable[3] === "string"
              ? usable[3].split("|")[0]
              : " "
          )
          .setCustomId(
            usable[3] !== false && typeof usable[3] === "string"
              ? usable[3].split("|")[1]
              : fight[0] === true && directionalBlocks[0]
              ? `mine_punch>${directionalBlocks[0][0]}>${directionalBlocks[0][1]}>3` // Appends 1 (Up)
              : mine_[0] === true && directionalBlocks[0]
              ? `mine_break>${directionalBlocks[0][0]}>${directionalBlocks[0][1]}>3>${directionalBlocks[0][2]}` // Appends 1 (Up)
              : "mine_down" // UI Down button should trigger mine_down
          ),
        // Right arrow button: UI Right maps to world Left (look dir 0)
        new ButtonBuilder()
          .setStyle(
            usable[2] !== false
              ? ButtonStyle.Primary
              : fight[1] === true
              ? ButtonStyle.Danger
              : mine_[1] === true
              ? mining_mode === 1 && current_player.player.look === 2 // Use player.look
                ? ButtonStyle.Danger
                : ButtonStyle.Primary
              : ButtonStyle.Secondary
          )
          .setEmoji(fight[1] === true ? `🗡️` : `▶️`)
          .setDisabled(
            blocked_moving[1] === true && usable[2] === false ? true : false
          )
          .setLabel(
            usable[2] !== false && typeof usable[2] === "string"
              ? usable[2].split("|")[0]
              : " "
          )
          .setCustomId(
            usable[2] !== false && typeof usable[2] === "string"
              ? usable[2].split("|")[1]
              : fight[1] === true && directionalBlocks[1]
              ? `mine_punch>${directionalBlocks[1][0]}>${directionalBlocks[1][1]}>2` // Appends 0 (Left)
              : mine_[1] === true && directionalBlocks[1]
              ? `mine_break>${directionalBlocks[1][0]}>${directionalBlocks[1][1]}>2>${directionalBlocks[1][2]}` // Appends 0 (Left)
              : "mine_right" // UI Right button should trigger mine_right
          ),
      ]);

      if (painting_mode === 1) {
        controls2.addComponents([
          new ButtonBuilder()
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(`⬇️`)
            .setCustomId("mine_painting_scale_down"),
        ]);
      }

      console.log(closest_blocks);

      console.log(blocks);

      var mining_embed = new EmbedBuilder()
        .setTitle(`Симулятор Шахтёра 2.0`)
        .setDescription(
          `Исследуй глубины нероскопанных шахт и найди древние руды!`
        )
        .setThumbnail(interaction.user?.displayAvatarURL() || "");

      context.font = `32px Minecraft`;
      context.fillStyle = `white`;

      if (painting_mode === 0) {
        /*await fillTextWithTwemoji(context, `👛 ${current_player.money.toFixed(1)}$`, 5, 34)*.

						context.font = `16px Minecraft`

						await fillTextWithTwemoji(
							context,
							`🎒 ${current_player.inventory.size} / ${Math.floor(
								current_player.tools.backpack.size
							)}`,
							5,
							57
						)

						await fillTextWithTwemoji(
							context,
							`👜 ${current_player.tools_inventory.size} / ${Math.floor(
								current_player.tools.tools_backpack.size
							)}`,
							5,
							78
						)*/

        await context.drawEmoji(`👛`, 5, 0, font_size / 2.5, font_size / 2.5);
        context.fillText(` ${current_player.money.toFixed(1)}$`, 40, 34);

        context.font = `16px Minecraft`;

        await context.drawEmoji(`🎒`, 5, 40, font_size / 3.5, font_size / 3.5);
        context.fillText(
          ` ${current_player.inventory.size} / ${Math.floor(
            current_player.tools.backpack.size
          )}`,
          30,
          57
        );

        await context.drawEmoji(`👜`, 5, 65, font_size / 3.5, font_size / 3.5);
        context.fillText(
          ` ${current_player.tools_inventory.size} / ${Math.floor(
            current_player.tools.tools_backpack.size
          )}`,
          30,
          81
        );
      }

      context.font = `${font_size}px Minecraft`;
      var chunks = playing_area.split("|");
      var all_emojis = [];
      for (var i = 0; i < chunks.length - 1; i++) {
        all_emojis.push(chunks[i].split(" "));
      }
      console.log(chunks);

      var answer;

      function auto_font_size() {
        answer = font_size * current_player.tools.vision.number;
        if (answer > 400.01) {
          font_size += 1 - answer / 400;
          context.font = `${font_size}px Minecraft`;
          auto_font_size();
        }
        if (answer < 399.99) {
          font_size += answer / 400;
          context.font = `${font_size}px Minecraft`;
          auto_font_size();
        }
      }

      if (
        !font_size_last_check ||
        font_size_last_check !== current_player.tools.vision.number
      ) {
        font_size_last_check = current_player.tools.vision.number;
        await gameMessage.edit(
          await client.tall(
            {
              embeds: [],
              components: [],
              files: [],
              content: `Подстраиваю размер блоков под вас...`,
            },
            interaction.locale
          )
        );
        auto_font_size();
      }

      context.font = `${font_size}px Minecraft`;

      async function loadImageSafely(imagePath) {
        try {
          console.log(`Attempting to load image from path: ${imagePath}`);
          // Try different path formats to find the right image
          const paths = [
            imagePath,
            imagePath.replace("./../../", ""),
            imagePath.startsWith("./../../")
              ? imagePath
              : `./../../${imagePath}`,
            imagePath.replace("./../../", "../"),
            join(__dirname, "../../..", imagePath.replace("./../../", "")),
          ];

          // Try each path until we find a working one
          for (const path of paths) {
            try {
              console.log(`Trying path: ${path}`);
              if (fs.existsSync(path)) {
                console.log(`Found file at: ${path}`);
                return await loadImage(fs.readFileSync(path));
              }
            } catch (err) {
              console.log(`Failed with path ${path}: ${err.message}`);
            }
          }

          // If no paths work, throw error
          throw new Error(
            `Could not find image at any resolved path for: ${imagePath}`
          );
        } catch (error) {
          console.error(`Error loading image ${imagePath}:`, error);
          // Return a simple colored rectangle as fallback
          const canvas = createCanvas(64, 64);
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#FF0000";
          ctx.fillRect(0, 0, 64, 64);
          return canvas;
        }
      }

      async function placeBlock(
        current_emoji,
        x,
        y,
        font_size,
        destroying,
        destroyed,
        player_here,
        ore_here,
        placed_here,
        real_x,
        real_y,
        mob_here,
        all_emojis
      ) {
        // ... existing code ...

        // Use the same technique for blocks
        if (
          blocks[current_emoji] &&
          blocks[current_emoji].emoji_canvas &&
          !canvas_images[current_emoji]
        ) {
          canvas_images[current_emoji] = await loadImageSafely(
            blocks[current_emoji].emoji_canvas
          );
        }

        // And for destroying animations
        if (destroying && !canvas_images[`destroying${destroying}`]) {
          canvas_images[`destroying${destroying}`] = await loadImageSafely(
            `other/minecraft/breaking-${destroying}.png`
          );
        }

        // ... and other image loading sections

        // Check if the block has a texture that we can draw directly
        const hasTexture =
          blocks[current_emoji] &&
          blocks[current_emoji].emoji_canvas &&
          canvas_images[current_emoji];

        if (painting_mode === 1) {
          if (current_player.grid_invisible === true) {
            if (blocks[current_emoji].name !== `Пустой блок`) {
              context.drawImage(
                canvas_images[current_emoji],
                x,
                y,
                font_size,
                font_size
              );
            }
          } else {
            context.drawImage(
              canvas_images[current_emoji],
              x,
              y,
              font_size,
              font_size
            );
          }
        } else {
          context.drawImage(
            canvas_images[current_emoji],
            x,
            y,
            font_size,
            font_size
          );

          const ore = ores.find((o) => o.emoji === current_emoji);

          if (ore) {
            // It's an ore, draw its texture
            const oreTextureKey = `ore_texture_${ore.tier}`;
            if (!canvas_images[oreTextureKey]) {
              canvas_images[oreTextureKey] = await loadImageSafely(
                `other/minecraft/ores/ore-${ore.tier}.png`
              );
            }
            if (canvas_images[oreTextureKey]) {
              // Check if image loaded successfully
              context.drawImage(
                canvas_images[oreTextureKey],
                x,
                y,
                font_size,
                font_size
              );
            }
          } else if (!hasTexture) {
            // Only draw emoji if we don't have a texture already rendered
            console.log(`blocks[${current_emoji}] doesnt have emoji_canvas`);
            await context.drawEmoji(
              current_emoji,
              x - 1,
              y + 17,
              font_size,
              font_size
            );
          }

          if (painting_mode === 0) {
            if (destroyed === 1 && current_player.shopping.status === 0) {
              context.fillStyle = "rgba(0, 0, 0, 0.6)";
              context.fillRect(x, y, font_size, font_size);
            } else if (destroying > 0) {
              if (!canvas_images[`destroying${destroying}`]) {
                canvas_images[`destroying${destroying}`] =
                  await loadImageSafely(
                    `other/minecraft/breaking-${destroying}.png`
                  );
              }
              context.drawImage(
                canvas_images[`destroying${destroying}`],
                x,
                y,
                font_size,
                font_size
              );
            }
          }

          if (placed_here === 1 && current_player.shopping.status === 0) {
            if (painting_mode === 1) {
              var type = current_player.placed[`${real_x}>${real_y}`].c;
              if (type === 0) {
                var current_placed =
                  all_blocks[current_player.placed[`${real_x}>${real_y}`].e];
              } else if (type === 1) {
                var current_placed =
                  ores[current_player.placed[`${real_x}>${real_y}`].t - 1];
                current_placed.emoji_canvas = `other/minecraft/ores/ore-${current_placed.tier}.png`;
                current_placed.id =
                  current_player.placed[`${real_x}>${real_y}`].t;
              } else if (type === 2) {
                var current_placed =
                  mobs[current_player.placed[`${real_x}>${real_y}`].i - 1];
              } else if (type === 3) {
                var current_placed =
                  current_player.custom_textures[
                    current_player.placed[`${real_x}>${real_y}`].i
                  ];
              }
              current_placed.key = `${type}-${current_placed.id}`;
            } else {
              var current_placed =
                items[current_player.placed[`${real_x}>${real_y}`].key];
            }
            if (!canvas_images[`${current_placed.key}`]) {
              if (current_placed.emoji_canvas.includes("http")) {
                canvas_images[`${current_placed.key}`] = await loadImageSafely(
                  await (await fetch(current_placed.emoji_canvas)).arrayBuffer()
                );
              } else {
                canvas_images[`${current_placed.key}`] = await loadImageSafely(
                  fs.readFileSync(`${current_placed.emoji_canvas}`)
                );
              }
            }
            if (painting_mode === 0) {
              context.shadowBlur = 10;
              context.shadowColor = "black";
            }
            context.drawImage(
              canvas_images[`${current_placed.key}`],
              x,
              y,
              font_size,
              font_size
            );
            if (painting_mode === 1) {
              if (destroyed === 1) {
                context.fillStyle = "rgba(0, 0, 0, 0.6)";
                context.fillRect(x, y, font_size, font_size);
              }
            } else {
              context.shadowColor = "rgba(0, 0, 0, 0.0)";
            }
          }

          if (mob_here === 1 && current_player.shopping.status === 0) {
            console.log(`${real_x}>${real_y}`);
            var current_mob = current_player.mobs[`${real_x}>${real_y}`];
            console.log(current_mob);
            if (!canvas_images[`mob-${current_mob.rank}`]) {
              canvas_images[`mob-${current_mob.rank}`] = await loadImageSafely(
                `other/minecraft/mobs/mob-${current_mob.rank}.png`
              );
            }
            console.log("using");

            context.drawImage(
              canvas_images[`mob-${current_mob.rank}`],
              x,
              y,
              font_size,
              font_size
            );
          }

          if (player_here === 1) {
            // Revert to using the correct image path and cache key
            if (!canvas_images[`player_${current_player.player.look}`]) {
              canvas_images[`player_${current_player.player.look}`] =
                await loadImageSafely(
                  `other/minecraft/entity/player/@${current_player.player.look}.png`
                );
            }
            console.log("using player image for look:", current_player.look);

            context.shadowBlur = 10;
            context.shadowColor = "black";

            if (painting_mode === 1) {
              if (current_player.player_invisible === false) {
                context.drawImage(
                  canvas_images[`player_${current_player.look}`], // Use correct cache key
                  x,
                  y,
                  font_size,
                  font_size
                );
              }
            } else {
              console.log(
                "GETTING PLAYER ICON BASED ON LOOK",
                current_player.player.look
              );
              context.drawImage(
                canvas_images[`player_${current_player.player.look}`], // Use correct cache key
                x,
                y,
                font_size,
                font_size
              );
            }

            context.shadowColor = "rgba(0, 0, 0, 0.0)";
          }

          if (current_player.shopping.status === 0) {
            if (painting_mode === 0) {
              var light = 0.7;
              var torch = 0;
              Object.keys(current_player.placed).forEach((key) => {
                var current_placed = current_player.placed[key];
                if (items[current_placed.key]?.light) {
                  var x = Number(current_placed.xy.split(">")[0]);
                  var y = Number(current_placed.xy.split(">")[1]);
                  var power = items[current_placed.key].light.power;
                  if (
                    real_x >= x - power &&
                    real_x <= x + power &&
                    real_y >= y - power &&
                    real_y <= y + power
                  ) {
                    torch = 1;
                    light -= 0.7;
                  }
                }
              });
              if (torch === 0) {
                if (
                  (real_x + 1 === current_player.x ||
                    real_x - 1 === current_player.x ||
                    real_x === current_player.x) &&
                  (real_y + 1 === current_player.y ||
                    real_y - 1 === current_player.y ||
                    real_y === current_player.y)
                ) {
                  light -= 0.3;
                }
              }

              if (light < 0) {
                light = 0;
              }
            } else {
              light = 0;
            }

            context.fillStyle = `rgba(0, 0, 0, ${light})`;
            context.fillRect(x, y, font_size, font_size);
          }
        }

        var y_ =
          current_player.y - Math.floor(current_player.tools.vision.number / 2);
        var x_ =
          current_player.x + Math.floor(current_player.tools.vision.number / 2);

        var target_x = 0;
        var target_y = 0;
        var mobs_ = [];
        var area = [];

        all_emojis = all_emojis.reverse();
        for (var i = 0; i < all_emojis.length; i++) {
          console.log(all_emojis[i].length);
          for (var c = 0; c < all_emojis[i].length - 1; c++) {
            var current_emoji = all_emojis[i][c];
            var destroying = 0;
            var destroyed = 0;
            var player_here = 0;
            var mob_here = 0;
            var ore_here = 0;
            var placed_here = 0;

            var block_x = 0 + font_size * c;
            var block_y =
              485 + all_emojis.length / 3 - font_size - font_size * i;
            if (painting_mode === 1) {
              block_y -= 80 + all_emojis.length / 1.5;
            }

            if (current_emoji.includes("!")) {
              player_here = 1;
              current_emoji = current_emoji.replace("!", "");
            }
            if (current_emoji.includes(".")) {
              destroyed = 1;
              current_emoji = current_emoji.replace(".", "");
            }
            if (current_emoji.includes("-")) {
              destroying = Number(current_emoji.split("-")[1]);
              console.log(destroying);
              current_emoji = current_emoji.slice(0, current_emoji.length - 2);
              console.log(current_emoji);
            }
            if (current_emoji.includes("]")) {
              mob_here = 1;
              current_emoji = current_emoji.replace("]", "");
            }
            if (current_emoji.includes("~")) {
              placed_here = 1;
              current_emoji = current_emoji.replace("~", "");
            }
            if (current_emoji.includes("🟪")) {
              ore_here = 1;
            }

            await placeBlock(
              current_emoji,
              block_x,
              block_y,
              font_size,
              destroying,
              destroyed,
              player_here,
              ore_here,
              placed_here,
              x_ - c,
              y_ + i,
              mob_here,
              all_emojis
            );
          }
        }

        if (painting_mode === 0) {
          context.font = `20px Minecraft`;
          context.strokeStyle = "black";
          context.lineWidth = 3;
          context.fillStyle = "#00FF00";
          /*await strokeTextWithTwemoji(context, `${current_player.level} уровень`, 5, 478)
					await fillTextWithTwemoji(context, `${current_player.level} уровень`, 5, 478)*/
          context.strokeText(
            await (
              await client.tall(
                { content: `${current_player.player.level} уровень` }, // Use current_player.player.level
                interaction.locale
              )
            ).content,
            5,
            478
          );
          context.fillText(
            await (
              await client.tall(
                { content: `${current_player.player.level} уровень` }, // Use current_player.player.level
                interaction.locale
              )
            ).content,
            5,
            478
          );
          context.textAlign = "right";
          context.fillStyle = "white";
          /*await strokeTextWithTwemoji(
						context,
						`${current_player.player.xp} / ${current_player.player.xp_needed}`,
						200,
						478
					)*/
          /*await fillTextWithTwemoji(
						context,
						`${current_player.player.xp} / ${current_player.player.xp_needed}`,
						200,
						478
					)*/
          context.strokeText(
            `(${current_player.player.xp}/${current_player.player.xp_needed})`, // Use .player.xp and .player.xp_levelup
            400,
            478
          );
          context.fillText(
            `(${current_player.player.xp}/${current_player.player.xp_needed})`, // Use .player.xp and .player.xp_levelup
            400,
            478
          );
          context.fillRect(
            0,
            485,
            (400 / current_player.player.xp_levelup) * current_player.player.xp, // Use .player.xp and .player.xp_levelup
            15
          );

          context.fillStyle = "white";
          context.textAlign = `right`;
          context.font = `20px Minecraft`;
          var tools_keys = Object.keys(current_player.tools);
          var visible_i = 0;
          for (var i = 0; i < tools_keys.length; i++) {
            var current_tool = current_player.tools[tools_keys[i]];
            console.log(current_tool);
            if (
              current_tool.durability >= 0 &&
              current_tool.durability !== current_tool.durability_max
            ) {
              visible_i++;
              var numbers = `!!! ${current_tool.durability}`;
              if (current_tool.durability <= 0) {
                numbers = "СЛОМАН";
              }
              /*await strokeTextWithTwemoji(
								context,
								`${tools[tools_keys[i]].emoji} ${numbers}`,
								390,
								180 + 30 * visible_i
							)
							await fillTextWithTwemoji(
								context,
								`${tools[tools_keys[i]].emoji} ${numbers}`,
								390,
								180 + 30 * visible_i
							)*/
              context.strokeText(
                await (
                  await client.tall({ content: numbers }, interaction.locale)
                ).content,
                360,
                180 + 30 * visible_i
              );
              context.fillText(
                await (
                  await client.tall({ content: numbers }, interaction.locale)
                ).content,
                360,
                180 + 30 * visible_i
              );
              await context.drawEmoji(
                tools[tools_keys[i]].emoji,
                365,
                160 + 30 * visible_i,
                font_size / 3,
                font_size / 3
              );
            }
          }

          for (var i = 0; i < all_emojis.length; i++) {
            for (var c = 0; c < all_emojis[i].length - 1; c++) {
              var current_emoji = all_emojis[i][c];
              if (current_emoji.includes("!")) {
                target_x = c;
                target_y = i;
              }
              if (current_emoji.includes("]")) {
                mobs_.push([c, i, x_ - c, y_ + i]);
              }
              if (current_emoji.includes(".") || current_emoji === "🟩") {
                area.push(0);
              } else {
                area.push(1);
              }
            }
          }
          console.log(`MOBS ${mobs_}`);
          console.log(`TARGET X ${target_x}`);
          console.log(`TARGET Y ${target_y}`);
          console.log(area);

          area = ndarray(
            [area],
            [
              current_player.tools.vision.number,
              current_player.tools.vision.number,
            ]
          );
          var planner = createPlanner(area);
          var moved = 0;
          mobs_.forEach(async (selected_mob) => {
            var s_mob_x = selected_mob[0];
            var s_mob_y = selected_mob[1];
            var path = [];
            planner.search(s_mob_x, s_mob_y, target_x, target_y, path);
            var ready_path = path.slice(0, 4);
            console.log(ready_path);
            var first_x = ready_path[0];
            var first_y = ready_path[1];
            var second_x = ready_path[2];
            var second_y = ready_path[3];

            var current_mob =
              current_player.mobs[`${selected_mob[2]}>${selected_mob[3]}`];
            var direction = 0;
            if (first_x < second_x && first_y === second_y) {
              //left
              direction = 0;
              current_mob.x--;
              moved = 1;
            } else if (first_x > second_x && first_y === second_y) {
              //right
              direction = 2;
              current_mob.x++;
              moved = 1;
            } else if (first_x === second_x && first_y < second_y) {
              //up
              direction = 1;
              current_mob.y++;
              moved = 1;
            } else if (first_x === second_x && first_y > second_y) {
              //down
              direction = 3;
              current_mob.y--;
              moved = 1;
            }

            if (
              current_mob.x === current_player.x &&
              current_mob.y === current_player.y
            ) {
              moved = 0;
              /*await mining2.set(`${key}.health`, current_player.health - current_mob.damage)*/
              await client.fdb.dec(
                `${key}.health`,
                current_mob.damage,
                "mining2"
              );
            }

            if (
              moved === 1 &&
              !current_player.destroyed.includes(
                `${current_mob.x}>${current_mob.y}`
              )
            ) {
              switch (direction) {
                case 0 || 2: {
                  if (direction === 0) {
                    current_mob.x++;
                  } else if (direction === 2) {
                    current_mob.x--;
                  }

                  if (
                    current_player.destroyed.includes(
                      `${current_mob.x}>${current_mob.y++}`
                    )
                  ) {
                    current_mob.y++;
                  } else if (
                    current_player.destroyed.includes(
                      `${current_mob.x}>${current_mob.y--}`
                    )
                  ) {
                    current_mob.y--;
                  }
                  break;
                }
                case 1 || 3: {
                  if (direction === 1) {
                    current_mob.y--;
                  } else if (direction === 3) {
                    current_mob.y++;
                  }

                  if (
                    current_player.destroyed.includes(
                      `${current_mob.x++}>${current_mob.y}`
                    )
                  ) {
                    current_mob.x++;
                  } else if (
                    current_player.destroyed.includes(
                      `${current_mob.x--}>${current_mob.y}`
                    )
                  ) {
                    current_mob.x--;
                  }
                  break;
                }
              }
            }

            if (
              moved === 1 &&
              current_player.destroyed.includes(
                `${current_mob.x}>${current_mob.y}`
              )
            ) {
              /*await mining2.delete(`${key}.mobs.${selected_mob[2]}>${selected_mob[3]}`)
							await mining2.set(`${key}.mobs.${current_mob.x}>${current_mob.y}`, current_mob)*/
              client.db.delete(
                `${key}.mobs.${selected_mob[2]}>${selected_mob[3]}`
              );
              Object.keys(current_mob).forEach((key2) => {
                client.db.set(
                  `${key}.mobs.${current_mob.x}>${current_mob.y}.${key2}`,
                  current_mob[key2]
                );
              });
            }
          });

          if (moved === 1) {
            current_player =
              /*await mining2.get(`${key}`)*/ await client.fdb.get(
                `${key}`,
                "mining2",
                true
              );
          }
          var i_visible = 0;
          // Calculate how many hearts to display - scale down when health_max is high
          const maxDisplayedHearts = current_player.player.health_max / 10; // Maximum number of hearts to display
          const heartScale = Math.min(
            1,
            maxDisplayedHearts / (current_player.player.health_max / 2)
          );
          const displayedHeartCount = Math.ceil(
            current_player.player.health_max * heartScale
          );

          // Calculate the display health by scaling the current health
          const displayHealth = current_player.player.health * heartScale;

          for (var i = 0; i < displayedHeartCount; i += 2) {
            var health_size = 35;
            var health_distance =
              80 /
              ((displayedHeartCount / 10) * (1 + displayedHeartCount / 600));
            var health_x =
              5 +
              (displayedHeartCount < 30 ? 4 : 0) +
              health_distance * i_visible;
            var health_y = 100;

            // Scale health value to match the displayed hearts
            const healthPercentage =
              current_player.player.health / current_player.player.health_max;
            const currentDisplayValue =
              i * (current_player.player.health_max / displayedHeartCount);

            if (healthPercentage * displayedHeartCount > i / 2) {
              // Show full or half heart based on percentage
              if (
                healthPercentage * displayedHeartCount > i / 2 + 0.5 &&
                healthPercentage * displayedHeartCount < i / 2 + 1
              ) {
                if (!canvas_images[`health-half`]) {
                  canvas_images[`health-half`] = await loadImageSafely(
                    `other/minecraft/ui/heart-half.png`
                  );
                }
                context.drawImage(
                  canvas_images[`health-half`],
                  health_x,
                  health_y,
                  health_size,
                  health_size
                );
                i_visible++;
              } else {
                if (!canvas_images[`health-full`]) {
                  canvas_images[`health-full`] = await loadImageSafely(
                    `other/minecraft/ui/heart-full.png`
                  );
                }
                context.drawImage(
                  canvas_images[`health-full`],
                  health_x,
                  health_y,
                  health_size,
                  health_size
                );
                i_visible++;
              }
            } else {
              if (!canvas_images[`health-empty`]) {
                canvas_images[`health-empty`] = await loadImageSafely(
                  `other/minecraft/ui/heart-empty.png`
                );
              }
              context.drawImage(
                canvas_images[`health-empty`],
                health_x,
                health_y,
                health_size,
                health_size
              );
              i_visible++;
            }
          }
          var i2_visible = 0;

          // Get food values from the correct location with fallbacks
          const playerFood = current_player.player?.food || 0;
          // Default food_max to 20 if not defined
          const playerFoodMax = current_player.player?.food_max || 20;

          // Calculate how many food icons to display - scale down when food_max is high
          const maxDisplayedFood = playerFoodMax / 2; // Maximum number of food icons to display
          const foodScale = Math.min(1, maxDisplayedFood / (playerFoodMax / 2));
          const displayedFoodCount = Math.ceil(playerFoodMax * foodScale);

          // Calculate the display food by scaling the current food
          const displayFood = playerFood * foodScale;

          // Only draw food bar if food properties exist
          if (playerFood !== undefined && playerFoodMax > 0) {
            for (var i2 = 0; i2 < displayedFoodCount; i2 += 2) {
              var food_size = 35;
              var food_distance =
                80 /
                ((displayedFoodCount / 10) * (1 + displayedFoodCount / 600));
              var food_x =
                5 +
                (displayedFoodCount < 30 ? 4 : 0) +
                food_distance * i2_visible;
              var food_y = 145;

              // Scale food value to match the displayed icons
              const foodPercentage = playerFood / playerFoodMax;

              if (foodPercentage * displayedFoodCount > i2 / 2) {
                if (!canvas_images[`food-full`]) {
                  canvas_images[`food-full`] = await loadImageSafely(
                    `other/minecraft/ui/food-full.png`
                  );
                }
                context.drawImage(
                  canvas_images[`food-full`],
                  food_x,
                  food_y,
                  food_size,
                  food_size
                );
                i2_visible++;
              } else {
                if (!canvas_images[`food-empty`]) {
                  canvas_images[`food-empty`] = await loadImageSafely(
                    `other/minecraft/ui/food-empty.png`
                  );
                }
                context.drawImage(
                  canvas_images[`food-empty`],
                  food_x,
                  food_y,
                  food_size,
                  food_size
                );
                i2_visible++;
              }
            }
          }

          // Fix the coordinate calculation to handle undefined values
          var xy = 0;
          if (
            typeof current_player.x === "number" &&
            typeof current_player.y === "number"
          ) {
            xy = Math.abs(current_player.x) + Math.abs(current_player.y) - 1;
            if (xy < 0) xy = 0;
          }

          // Initialize current_location with a default value to prevent undefined errors
          let current_location = {
            name: "Спавн", // Changed to actual spawn location name
            from: 0,
            to: 1,
            tier: 0,
          };

          if (current_player.shopping.page > 0) {
            current_location = {
              name: "У продавца",
              from: 0,
              to: 20,
              tier: 0,
            };
          } else if (current_player.shopping.status === 1) {
            current_location = {
              name: "Магазин",
              from: 0,
              to: 20,
              tier: 0,
            };
          } else {
            // Use for...of instead of forEach with async to ensure synchronous execution
            // Find the location based on player position
            for (const location of locations) {
              if (xy >= location.from && xy <= location.to) {
                current_location = location;
                break; // Exit loop once found
              }
            }
          }

          context.font = `13px Minecraft`;
          console.log(`LOCATION XY: ${xy}`);
          console.log(current_location);
          context.textAlign = "center";

          // Check if current_location is defined before accessing properties
          if (current_location && current_location.name) {
            context.strokeText(
              await (
                await client.tall(
                  { content: `${current_location.name}` },
                  interaction.locale
                )
              ).content,
              200,
              457
            );
            context.fillText(
              await (
                await client.tall(
                  { content: `${current_location.name}` },
                  interaction.locale
                )
              ).content,
              200,
              457
            );
          }
        }

        var buffer = canvas.toBuffer("image/png");
        var buffer_ready = new AttachmentBuilder(buffer, { name: "test.png" });
        mining_embed.setImage(`attachment://test.png`);

        if (
          current_player.shopping.page > 0 &&
          current_player.shopping.status !== 0
        ) {
          if (painting_mode == 1) {
            current_player = await client.fdb.get(`${key}`, "mining2", true);
          }
          shopping_menu({
            embed: mining_embed,
            current_player: current_player,
            buffer_ready: buffer_ready,
            interaction: interaction,
          });
        } else {
          var ready_components = [];

          if (painting_mode === 1) {
            var paint_controls = new ActionRowBuilder();

            var mas =
              /*await mining2.get(`${key}${painting_text_db || ''}.destroyed`)*/ await client.fdb.get(
                `${key}${painting_text_db || ""}.destroyed`,
                "mining2"
              );
            console.log(`${key}${painting_text_db || ""}.destroyed`);
            console.log(mas);
            if (
              current_player.placed[`${current_player.x}>${current_player.y}`]
            ) {
              var type =
                current_player.placed[`${current_player.x}>${current_player.y}`]
                  .c;
              if (type === 0) {
                var current_block =
                  all_blocks[
                    current_player.placed[
                      `${current_player.x}>${current_player.y}`
                    ].e
                  ];
              } else if (type === 1) {
                var current_block =
                  ores[
                    current_player.placed[
                      `${current_player.x}>${current_player.y}`
                    ].t - 1
                  ];
                console.log(current_block);
              } else if (type === 2) {
                var current_block =
                  mobs[
                    current_player.placed[
                      `${current_player.x}>${current_player.y}`
                    ].i - 1
                  ];
              } else if (type === 3) {
                var current_block =
                  current_player.custom_textures[
                    current_player.placed[
                      `${current_player.x}>${current_player.y}`
                    ].i
                  ];
              }
              paint_controls.addComponents([
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji(`${current_block.emoji}`)
                  .setLabel(
                    `!!! [${current_player.x}:${current_player.y}] ${current_block.name}`
                  )
                  .setDisabled(true)
                  .setCustomId("mine____"),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji(`🗑`)
                  .setCustomId("mine_painting_break"),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel(
                    mas.includes(`${current_player.x}>${current_player.y}`)
                      ? `Задний слой`
                      : `Передний слой`
                  )
                  .setCustomId("mine_painting_change_layer"),
              ]);
            } else {
              paint_controls.addComponents([
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel(`${current_player.x}:${current_player.y}`)
                  .setDisabled(true)
                  .setCustomId("mine____"),
                new ButtonBuilder()
                  .setStyle(
                    current_player.player_invisible === true
                      ? ButtonStyle.Primary
                      : ButtonStyle.Secondary
                  )
                  .setEmoji(
                    current_player.player_invisible === true ? `🔘` : `🟢`
                  )
                  .setLabel(`Игрок`)
                  .setCustomId("mine_painting_player_invisible"),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setStyle(
                    current_player.grid_invisible === true
                      ? ButtonStyle.Primary
                      : ButtonStyle.Secondary
                  )
                  .setEmoji(
                    current_player.grid_invisible === true ? `🔘` : `🟢`
                  )
                  .setLabel(`Сетка`)
                  .setCustomId("mine_painting_grid_invisible"),
              ]);
            }

            ready_components.push(paint_controls);
          }

          if (painting_mode === 0) {
            var tools_inventory_selector = new ActionRowBuilder();
            var tools2_inventory_selector = new ActionRowBuilder();
            var activated = 0;
            var activated2 = 0;

            if (current_player.tools_inventory.size > 0) {
              if (current_player.shopping.status === 0) {
                activated = 1;
                var tools_inventory_ = [];
                Object.keys(current_player.tools_inventory).forEach((key) => {
                  if (!isNaN(Number(key))) {
                    var current_ = current_player.tools_inventory[key];
                    if (current_.count > 0) {
                      if (current_.key === "torch3") current_.key = "food_pack";
                      var current_item = items[current_.key];
                      console.log(`!__________!`);
                      console.log(current_item);
                      tools_inventory_.push({
                        label: `${current_item.name}`,
                        emoji: current_item.emoji,
                        value: `${current_item.id}`,
                        description: `У вас ${current_.count} шт`,
                      });
                    }
                  }
                });
                tools_inventory_selector.addComponents([
                  new StringSelectMenuBuilder()
                    .setCustomId("mine_place")
                    .setPlaceholder(
                      `Рюкзак расходников (${current_player.tools_inventory.size})`
                    )
                    .addOptions(tools_inventory_),
                ]);
              } else {
                activated = 1;
                tools_inventory_selector.addComponents([
                  new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel(
                      `Рюкзак расходников (${current_player.tools_inventory.size})`
                    )
                    .setDisabled(true)
                    .setCustomId("mine_items_nan"),
                ]);
              }
            }
            if (current_player.inventory.size > 0) {
              if (current_player.shopping.status === 0) {
                activated2 = 1;
                var inventory_ = [];
                Object.keys(current_player.inventory).forEach((key) => {
                  if (current_player.inventory[key]?.id) {
                    var current_ = current_player.inventory[key];
                    if (current_.count > 0) {
                      inventory_.push({
                        label: `${current_.name}`,
                        emoji: current_.emoji,
                        value: `${current_.id}`,
                        description: `У вас ${current_.count} шт`,
                      });
                    }
                  }
                });
                tools2_inventory_selector.addComponents([
                  new StringSelectMenuBuilder()
                    .setCustomId("mine_blocks")
                    .setPlaceholder(
                      `Рюкзак блоков (${current_player.inventory.size})`
                    )
                    .addOptions(inventory_),
                ]);
              } else {
                activated = 1;
                tools_inventory_selector.addComponents([
                  new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel(
                      `Рюкзак блоков (${current_player.inventory.size})`
                    )
                    .setDisabled(true)
                    .setCustomId("mine_block_nan"),
                ]);
              }
            }
          }
        }
      }
    }

    // Define the listener function separately
    function collectorListener(collectorInstance) {
      collectorInstance.on("collect", async (collected) => {
        console.log("collector is working on message:", collected.message.id);
        // console.log(collected.message.id);
        // console.log(interaction.id, Number(interaction.id));

        var key = `${collected.guild.id}.${collected.user.id}.mining2${
          painting_mode === 1 ? `_paint` : ``
        }`;

        // Use the passed key argument for the initial fetch
        var current_player = await client.fdb.get(`${key}`, "mining2", true);
        console.log(`CURRENT_PLAYER:`, current_player);

        if (painting_mode === 0) {
          // Use .player prefix for reads and writes
          if (current_player.player.xp >= current_player.player.xp_needed) {
            await client.fdb.set(`${key}.player.xp`, 0);
            await client.fdb.inc(`${key}.player.level`, 1, "mining2");
            await client.fdb.set(
              `${key}.player.xp_needed`,
              Math.floor(current_player.player.xp_needed * 2.2)
            );
            // Remove potentially stale refetch
            /* current_player = await client.fdb.get(
              `${key}`,
              "mining2",
              true
            );*/
          }
          // Use .player prefix for reads and writes
          // Assume food_when_multiplier is also under player? Check schema if needed.
          if (current_player.player.food <= 0) {
            await client.fdb.dec(`${key}.player.health`, 0.25, "mining2"); // Use .player.health
            // Remove potentially stale refetch
            /* current_player = await client.fdb.get(
              `${key}`,
              "mining2",
              true
            );*/
          } else if (current_player.player.food_when <= 0) {
            // Only decrement food if it's above 0
            if (current_player.player.food > 0) {
              await client.fdb.dec(`${key}.player.food`, 1, "mining2");
            }
            // Reset food_when timer
            await client.fdb.set(
              `${key}.player.food_when`,
              Math.floor(
                randomInteger(35, 40) *
                  (current_player.player.food_when_multiplier || 1) // Default multiplier to 1 if missing
              )
            );
            // Remove potentially stale refetch
            /* current_player = await client.fdb.get(`${key}`, "mining2", true); */
          }
          // Use .player prefix for reads and writes
          if (current_player.player.health <= 0) {
            // Use .player.health
            await client.fdb.set(`${key}.player.x`, 0, "mining2");
            await client.fdb.set(`${key}.player.y`, 0, "mining2");
            await client.fdb.set(
              `${key}.player.health`, // Use .player.health
              current_player.player.health_max,
              "mining2"
            );
            await client.fdb.set(
              `${key}.player.food`,
              current_player.player.food_max,
              "mining2"
            );
            // Inventory reset seems okay (top-level inventory object)
            client.db.delete(`${key}.inventory`);
            await client.fdb.set(`${key}.inventory.size`, 0);
            await client.fdb.set(`${key}.inventory.to_sell`, 0);

            // Timeout seems okay (top-level timeouts)
            // Correct the timeout key construction - should just be timeouts.${key}
            await client.fdb.createTimeout(`timeouts.${key}`, ms("30m"));

            try {
              // Correct the key used to read the timeout
              const timeoutValue = await client.fdb.get(
                `timeouts.${key}` // Read using the correct key
              );

              const remainingTime =
                timeoutValue && typeof timeoutValue === "number"
                  ? timeoutValue - Date.now()
                  : 0;

              return gameMessage.edit(
                await client.tall(
                  {
                    content: `Вы умерли!\n\nВы сможете вернуться в игру через ${
                      remainingTime > 0
                        ? prettyMilliseconds(remainingTime)
                        : "30 минут"
                    }`,
                    embeds: [],
                    components: [],
                    files: [],
                  },
                  interaction.locale
                )
              );
            } catch (error) {
              console.error("Error formatting timeout:", error);
              return gameMessage.edit(
                await client.tall(
                  {
                    content: `Вы умерли!\n\nВы сможете вернуться в игру через 30 минут`,
                    embeds: [],
                    components: [],
                    files: [],
                  },
                  interaction.locale
                )
              );
            }
          }
        }

        travelling(current_player);

        const canvas = createCanvas(400, painting_mode === 1 ? 400 : 500);
        const context = canvas.getContext("2d");
        // Apply canvas extensions
        await client.ctx_extended(context);
        context.fillStyle = "#000000";

        // Ensure current_player (fetched at the start) has all required properties
        if (!current_player) {
          console.error(
            "Failed to retrieve player data, creating default player"
          );
          current_player = DEFAULT_GAME_SCHEMAS.mining2;
        }

        // Initialize missing properties if they don't exist
        if (!current_player.shopping) {
          current_player.shopping = { status: 0, page: 0 };
        }

        if (!current_player.tools) {
          current_player.tools = {
            vision: { number: 11, level: 1 },
            sword: { durability: 50, durability_max: 50, damage: 5 },
          };
        } else if (!current_player.tools.vision) {
          current_player.tools.vision = { number: 11, level: 1 };
        }

        if (!current_player.destroying) {
          current_player.destroying = {
            mob: 0,
            x: 0,
            y: 0,
            points: 0,
            points_max: 0,
          };
        }

        if (!current_player.destroyed) {
          current_player.destroyed = [];
        }

        if (!current_player.placed) {
          current_player.placed = {};
        }

        if (!current_player.mobs) {
          current_player.mobs = {};
        }

        if (!current_player.money && current_player.money !== 0) {
          current_player.money = 0;
        }

        if (!current_player.inventory) {
          current_player.inventory = { size: 0 };
        } else if (
          !current_player.inventory.size &&
          current_player.inventory.size !== 0
        ) {
          current_player.inventory.size = 0;
        }

        if (!current_player.tools_inventory) {
          current_player.tools_inventory = { size: 0 };
        } else if (
          !current_player.tools_inventory.size &&
          current_player.tools_inventory.size !== 0
        ) {
          current_player.tools_inventory.size = 0;
        }

        if (!current_player.tools.backpack) {
          current_player.tools.backpack = { size: 10 };
        } else if (!current_player.tools.backpack.size) {
          current_player.tools.backpack.size = 10;
        }

        if (!current_player.tools.tools_backpack) {
          current_player.tools.tools_backpack = { size: 5 };
        } else if (!current_player.tools.tools_backpack.size) {
          current_player.tools.tools_backpack.size = 5;
        }

        console.log(
          current_player.y,
          current_player.x,
          current_player.tools.vision.number
        );

        var playing_area = "";
        closest_blocks = [];
        var current_location;
        var visible_area = [];

        if (painting_mode === 1) {
          var painting_generated = getDeepKeys(current_player.placed);
        }

        // Use current_player.player.x/y for loop boundaries
        for (
          var y =
            current_player.player.y +
            Math.floor(current_player.tools.vision.number / 2);
          y >=
          current_player.player.y -
            Math.floor(current_player.tools.vision.number / 2);
          y--
        ) {
          for (
            var x =
              current_player.player.x +
              Math.floor(current_player.tools.vision.number / 2);
            x >=
            current_player.player.x -
              Math.floor(current_player.tools.vision.number / 2);
            x--
          ) {
            console.log(y, x);
            // Pass player object to block function if needed, ensure block() uses player.*
            var emoji = await block({
              y: y,
              x: x,
              current_player: current_player,
            });
            visible_area.push(`${x}>${y}`);
            var destroyed_point = "";
            // Use current_player.player.x/y for checks
            if (
              current_player.player.x === x &&
              current_player.player.y === y
            ) {
              destroyed_point += "!";
            }
            if (current_player.shopping.status === 0 && painting_mode === 0) {
              // Assuming mobs is top-level or needs fixing too?
              if (current_player.mobs[`${x}>${y}`]) {
                destroyed_point += "]";
              }
            }
            // Assuming destroyed is top-level or needs fixing too?
            if (current_player.destroyed.includes(`${x}>${y}`)) {
              destroyed_point += ".";
            }

            // Assuming placed is top-level or needs fixing too?
            if (current_player.placed[`${x}>${y}`]) {
              destroyed_point += "~";
            }

            // Revert destroying checks back to top-level access
            if (
              x === current_player.destroying.x &&
              y === current_player.destroying.y &&
              current_player.destroying.points !==
                current_player.destroying.points_max &&
              current_player.destroying.points > 0
            ) {
              if (
                current_player.destroying.points_max / 4 >
                current_player.destroying.points
              ) {
                destroyed_point += "-3";
              } else if (
                current_player.destroying.points_max / 2 >
                current_player.destroying.points
              ) {
                destroyed_point += "-2";
              } else {
                destroyed_point += "-1";
              }
            }

            playing_area += `${emoji}${destroyed_point} `;
            // Use current_player.player.x/y for closest_blocks checks
            if (
              (x === current_player.player.x &&
                y === current_player.player.y - 1) ||
              (x === current_player.player.x &&
                y === current_player.player.y + 1) ||
              (x === current_player.player.x - 1 &&
                y === current_player.player.y) ||
              (x === current_player.player.x + 1 &&
                y === current_player.player.y)
            ) {
              if (current_player?.shopping.status === 0) {
                if (current_player.destroyed.includes(`${x}>${y}`)) {
                  emoji = ".";
                }
              }
              closest_blocks.push([x, y, emoji]);
              if (closest_blocks.length === 5) {
                closest_blocks.shift();
              }
            }
          }
          playing_area += "|";
        }

        if (current_player.shopping.status === 0 && painting_mode === 0) {
          await mobss(current_player, visible_area);
          current_player = /*await mining2.get(`${key}`)*/ await client.fdb.get(
            `${key}`,
            "mining2",
            true
          );
        }

        console.log("Analyzing nearby blocks...");

        // Initialize arrays with proper length
        var mine_ = [false, false, false, false];
        var fight = [false, false, false, false];
        var blocked_moving = [false, false, false, false];
        var usable = [false, false, false, false];
        var pickable = [false, false, false, false];
        var pickable_mode = 0;

        // Log the closest blocks for debugging
        console.log("Closest blocks:", closest_blocks);

        // Process each closest block
        for (var i = 0; i < closest_blocks.length; i++) {
          if (!closest_blocks[i]) {
            console.log(`Skipping undefined closest block at index ${i}`);
            continue;
          }

          var current_block = closest_blocks[i][2];
          console.log(`Processing block at index ${i}:`, closest_blocks[i]);

          var block_xy = `${closest_blocks[i][0]}>${closest_blocks[i][1]}`;
          console.log(`Block coordinates: ${block_xy}`);

          // Determine the direction index based on position relative to player
          // The game uses a coordinate system where:
          // Up (0) = Same X, Y-1
          // Left (1) = X-1, Same Y
          // Right (2) = X+1, Same Y
          // Down (3) = Same X, Y+1
          let dirIndex = -1;
          // Use player.x and player.y for adjacency checks
          if (
            closest_blocks[i][0] === current_player.player.x &&
            closest_blocks[i][1] === current_player.player.y - 1
          ) {
            dirIndex = 0; // Up
          } else if (
            closest_blocks[i][0] === current_player.player.x - 1 &&
            closest_blocks[i][1] === current_player.player.y
          ) {
            dirIndex = 1; // Left
          } else if (
            closest_blocks[i][0] === current_player.player.x + 1 &&
            closest_blocks[i][1] === current_player.player.y
          ) {
            dirIndex = 2; // Right
          } else if (
            closest_blocks[i][0] === current_player.player.x &&
            closest_blocks[i][1] === current_player.player.y + 1
          ) {
            dirIndex = 3; // Down
          }

          if (dirIndex === -1) {
            console.log(
              `Block at ${block_xy} is not adjacent to player, skipping`
            );
            continue;
          }

          // Check for mobs at this position
          if (painting_mode === 0) {
            if (current_player.mobs && current_player.mobs[block_xy]) {
              console.log(
                `Found mob at ${block_xy}:`,
                current_player.mobs[block_xy]
              );
              fight[dirIndex] = true;
            } else {
              fight[dirIndex] = false;
            }
          }

          // Check if block can be mined
          if (blocks[current_block]?.mining_blocked) {
            blocked_moving[dirIndex] = true;
            mine_[dirIndex] = false;
            console.log(
              `Block ${current_block} at ${block_xy} is mining blocked`
            );
          } else {
            if (current_block === ".") {
              mine_[dirIndex] = false;
              console.log(`Empty block at ${block_xy}, can't mine`);
            } else if (current_block !== "🟩" && current_block !== "⬜️") {
              mine_[dirIndex] = true;
              console.log(`Minable block ${current_block} at ${block_xy}`);
            } else {
              mine_[dirIndex] = false;
              console.log(
                `Block ${current_block} at ${block_xy} can't be mined`
              );
            }
            blocked_moving[dirIndex] = false;
          }

          // Check for placed items
          if (current_player.placed && current_player.placed[block_xy]) {
            var current_placed = current_player.placed[block_xy];
            pickable[
              dirIndex
            ] = `${current_placed.key}>${closest_blocks[i][0]}>${closest_blocks[i][1]}`;
            pickable_mode = 1;
            console.log(`Found placed item at ${block_xy}:`, current_placed);
          } else {
            pickable[dirIndex] = false;
          }
        }

        console.log("Mining possibilities:", mine_);
        console.log("Fighting possibilities:", fight);
        console.log("Blocked moving:", blocked_moving);
        console.log("Pickable items:", pickable);

        // Create a structure to hold blocks indexed by direction
        let directionalBlocks = { 0: null, 1: null, 2: null, 3: null };
        // If in shop mode, include fixed_pos shop blocks (distance >1) in directional blocks
        if (current_player.shopping.status === 1) {
          Object.entries(blocks).forEach(([blkEmoji, blk]) => {
            if (blk.use && blk.fixed_pos) {
              const fx = blk.fixed_pos.x;
              const fy = blk.fixed_pos.y;
              let dirIdx;
              if (fy > 0) dirIdx = 0; // Up (positive y)
              else if (fx < 0) dirIdx = 1; // Left
              else if (fx > 0) dirIdx = 2; // Right
              else if (fy < 0) dirIdx = 3; // Down
              if (dirIdx !== undefined) {
                directionalBlocks[dirIdx] = [fx, fy, blkEmoji];
              }
            }
          });
        }
        // Find the actual block for each direction from the potentially unordered closest_blocks list
        // Also use player.x/y here
        for (let i = 0; i < closest_blocks.length; i++) {
          if (!closest_blocks[i]) continue;
          const [x, y, emoji] = closest_blocks[i];
          if (
            x === current_player.player.x &&
            y === current_player.player.y - 1
          ) {
            directionalBlocks[0] = closest_blocks[i]; // Up
          } else if (
            x === current_player.player.x - 1 &&
            y === current_player.player.y
          ) {
            directionalBlocks[1] = closest_blocks[i]; // Left
          } else if (
            x === current_player.player.x + 1 &&
            y === current_player.player.y
          ) {
            directionalBlocks[2] = closest_blocks[i]; // Right
          } else if (
            x === current_player.player.x &&
            y === current_player.player.y + 1
          ) {
            directionalBlocks[3] = closest_blocks[i]; // Down
          }
        }
        console.log("Directional blocks mapped:", directionalBlocks);

        var mining_mode = 0;
        var points;
        var points_max;
        if (
          current_player.destroying.points !==
            current_player.destroying.points_max &&
          current_player.destroying.points > 0
        ) {
          points = current_player.destroying.points;
          points_max = current_player.destroying.points_max;
          mining_mode = 1;
        }

        if (current_player.shopping.page === 0) {
          // In shop mode, allow arrow keys to trigger shop blocks at fixed positions
          if (current_player.shopping.status === 1) {
            // Reset usable and set per directional fixed_pos relative to player
            usable = [false, false, false, false];
            Object.entries(blocks).forEach(([emoji, blk]) => {
              if (blk.use && blk.fixed_pos) {
                const fx = blk.fixed_pos.x;
                const fy = blk.fixed_pos.y;
                const dx = fx - current_player.player.x; // Use player.x
                const dy = fy - current_player.player.y; // Use player.y

                let dir = -1; // Use -1 to indicate no adjacent fixed block in this direction

                // Check if block is exactly 1 unit away (Manhattan distance)
                if (Math.abs(dx) + Math.abs(dy) === 1) {
                  // Inverted Y-axis: dy=-1 (Below) maps to UI Down (dir=3), dy=1 (Above) maps to UI Up (dir=0)
                  if (dy === -1 && dx === 0)
                    dir = 3; // Block is Below (UI Down Button)
                  else if (dx === 1 && dy === 0)
                    dir = 1; // Block is Right (UI Left Button)
                  else if (dx === -1 && dy === 0)
                    dir = 2; // Block is Left (UI Right Button)
                  else if (dy === 1 && dx === 0) dir = 0; // Block is Above (UI Up Button)
                }

                if (dir !== -1) {
                  usable[dir] = `${blk.name}|mine_use-${blk.use_id}`;
                }
              }
            });
          } else {
            // Default adjacent block use logic
            for (var i = 0; i < closest_blocks.length; i++) {
              var current_block = closest_blocks[i][2];
              if (blocks[current_block]?.use) {
                usable.push(
                  `${blocks[current_block].name}|mine_use-${blocks[current_block].use_id}`
                );
              } else {
                usable.push(false);
              }
            }
          }
        } else {
          usable = [false, false, false, false];
        }

        var pickable_selector = new ActionRowBuilder();
        if (pickable_mode === 1 && painting_mode === 0) {
          pickable.forEach((pick) => {
            if (pick !== false) {
              var key = pick.split(">")[0];
              var x = pick.split(">")[1];
              var y = pick.split(">")[2];
              var current_item = items[key];
              pickable_selector.addComponents([
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel(`${current_item.name}`)
                  .setEmoji(`${current_item.emoji}`)
                  .setCustomId(
                    `mine_pickup>${key}>${current_item.id}>${x}>${y}`
                  ),
              ]);
            }
          });
        }

        var controls = new ActionRowBuilder().addComponents([
          painting_mode === 1
            ? new ButtonBuilder()
                .setStyle(ButtonStyle.Secondary)
                .setEmoji("🖌")
                .setCustomId("mine_painting_block_select")
            : new ButtonBuilder()
                .setStyle(
                  mining_mode === 1 ? ButtonStyle.Danger : ButtonStyle.Secondary
                )
                .setDisabled(true)
                .setLabel(
                  mining_mode === 1
                    ? `${points.toFixed(1)} / ${points_max.toFixed(1)}`
                    : ` ${current_player.player.x} : ${current_player.player.y} ` // Use player.x/y
                )
                .setCustomId("mine__"),
          // Up arrow button: UI Up maps to world Down (look dir 3)
          new ButtonBuilder()
            .setStyle(
              usable[0] !== false
                ? ButtonStyle.Primary
                : fight[3] === true
                ? ButtonStyle.Danger
                : mine_[3] === true
                ? mining_mode === 1 && current_player.player.look === 1 // Use player.look
                  ? ButtonStyle.Danger
                  : ButtonStyle.Primary
                : ButtonStyle.Secondary
            )
            .setDisabled(
              blocked_moving[3] === true && usable[0] === false ? true : false
            )
            .setEmoji(fight[3] === true ? `🗡️` : `🔼`)
            .setLabel(
              usable[0] !== false && typeof usable[0] === "string"
                ? usable[0].split("|")[0]
                : " "
            )
            .setCustomId(
              usable[0] !== false && typeof usable[0] === "string"
                ? usable[0].split("|")[1]
                : fight[3] === true && directionalBlocks[3]
                ? `mine_punch>${directionalBlocks[3][0]}>${directionalBlocks[3][1]}>1`
                : mine_[3] === true && directionalBlocks[3]
                ? `mine_break>${directionalBlocks[3][0]}>${directionalBlocks[3][1]}>1>${directionalBlocks[3][2]}`
                : "mine_up" // UI Up button should trigger mine_up
            ),
        ]);
        if (painting_mode === 1) {
          controls.addComponents([
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setEmoji(`📦`)
              .setCustomId("mine_painting_block_place"),
          ]);
          controls.addComponents([
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setEmoji(`⬆️`)
              .setCustomId("mine_painting_scale_up"),
          ]);
        }

        var shop_btn = 0;
        for (var i = 0; i < closest_blocks.length; i++) {
          var current_block = closest_blocks[i][2];
          if (current_block === "🟩") {
            shop_btn = 1;
            if (current_player.shopping.status === 0) {
              controls.addComponents([
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Success)
                  .setLabel(`Магазин`)
                  .setCustomId("mine_shop"),
              ]);
            } else {
              controls.addComponents([
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Danger)
                  .setLabel(`Выйти из магазина`)
                  .setCustomId("mine_shop-leave"),
              ]);
            }
            break;
          }
        }

        var controls2 = new ActionRowBuilder().addComponents([
          // Left arrow button: UI Left maps to world Right (dir 2)
          new ButtonBuilder()
            .setStyle(
              usable[1] !== false
                ? ButtonStyle.Primary
                : fight[2] === true
                ? ButtonStyle.Danger
                : mine_[2] === true
                ? mining_mode === 1 && current_player.player.look === 0 // Use player.look
                  ? ButtonStyle.Danger
                  : ButtonStyle.Primary
                : ButtonStyle.Secondary
            )
            .setEmoji(fight[2] === true ? `🗡️` : `◀️`)
            .setDisabled(
              blocked_moving[2] === true && usable[1] === false ? true : false
            )
            .setLabel(
              usable[1] !== false && typeof usable[1] === "string"
                ? usable[1].split("|")[0]
                : " "
            )
            .setCustomId(
              usable[1] !== false && typeof usable[1] === "string"
                ? usable[1].split("|")[1]
                : fight[2] === true && directionalBlocks[2]
                ? `mine_punch>${directionalBlocks[2][0]}>${directionalBlocks[2][1]}>0`
                : mine_[2] === true && directionalBlocks[2]
                ? `mine_break>${directionalBlocks[2][0]}>${directionalBlocks[2][1]}>0>${directionalBlocks[2][2]}`
                : "mine_left" // UI Left button should trigger mine_left
            ),
          // Down arrow button: UI Down maps to world Up (look dir 1)
          new ButtonBuilder()
            .setStyle(
              usable[3] !== false
                ? ButtonStyle.Primary
                : fight[0] === true
                ? ButtonStyle.Danger
                : mine_[0] === true
                ? mining_mode === 1 && current_player.player.look === 3 // Use player.look
                  ? ButtonStyle.Danger
                  : ButtonStyle.Primary
                : ButtonStyle.Secondary
            )
            .setEmoji(fight[0] === true ? `🗡️` : `🔽`)
            .setDisabled(
              blocked_moving[0] === true && usable[3] === false ? true : false
            )
            .setLabel(
              usable[3] !== false && typeof usable[3] === "string"
                ? usable[3].split("|")[0]
                : " "
            )
            .setCustomId(
              usable[3] !== false && typeof usable[3] === "string"
                ? usable[3].split("|")[1]
                : fight[0] === true && directionalBlocks[0]
                ? `mine_punch>${directionalBlocks[0][0]}>${directionalBlocks[0][1]}>3` // Appends 1 (Up)
                : mine_[0] === true && directionalBlocks[0]
                ? `mine_break>${directionalBlocks[0][0]}>${directionalBlocks[0][1]}>3>${directionalBlocks[0][2]}` // Appends 1 (Up)
                : "mine_down" // UI Down button should trigger mine_down
            ),
          // Right arrow button: UI Right maps to world Left (look dir 0)
          new ButtonBuilder()
            .setStyle(
              usable[2] !== false
                ? ButtonStyle.Primary
                : fight[1] === true
                ? ButtonStyle.Danger
                : mine_[1] === true
                ? mining_mode === 1 && current_player.player.look === 2 // Use player.look
                  ? ButtonStyle.Danger
                  : ButtonStyle.Primary
                : ButtonStyle.Secondary
            )
            .setEmoji(fight[1] === true ? `🗡️` : `▶️`)
            .setDisabled(
              blocked_moving[1] === true && usable[2] === false ? true : false
            )
            .setLabel(
              usable[2] !== false && typeof usable[2] === "string"
                ? usable[2].split("|")[0]
                : " "
            )
            .setCustomId(
              usable[2] !== false && typeof usable[2] === "string"
                ? usable[2].split("|")[1]
                : fight[1] === true && directionalBlocks[1]
                ? `mine_punch>${directionalBlocks[1][0]}>${directionalBlocks[1][1]}>2` // Appends 0 (Left)
                : mine_[1] === true && directionalBlocks[1]
                ? `mine_break>${directionalBlocks[1][0]}>${directionalBlocks[1][1]}>2>${directionalBlocks[1][2]}` // Appends 0 (Left)
                : "mine_right" // UI Right button should trigger mine_right
            ),
        ]);

        if (painting_mode === 1) {
          controls2.addComponents([
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setEmoji(`⬇️`)
              .setCustomId("mine_painting_scale_down"),
          ]);
        }

        console.log(closest_blocks);

        console.log(blocks);

        var mining_embed = new EmbedBuilder()
          .setTitle(`Симулятор Шахтёра 2.0`)
          .setDescription(
            `Исследуй глубины нероскопанных шахт и найди древние руды!`
          )
          .setThumbnail(interaction.user?.displayAvatarURL() || "");

        context.font = `32px Minecraft`;
        context.fillStyle = `white`;

        if (painting_mode === 0) {
          /*await fillTextWithTwemoji(context, `👛 ${current_player.money.toFixed(1)}$`, 5, 34)*.

							context.font = `16px Minecraft`

							await fillTextWithTwemoji(
								context,
								`🎒 ${current_player.inventory.size} / ${Math.floor(
									current_player.tools.backpack.size
								)}`,
								5,
								57
							)

							await fillTextWithTwemoji(
								context,
								`👜 ${current_player.tools_inventory.size} / ${Math.floor(
									current_player.tools.tools_backpack.size
								)}`,
								5,
								78
							);

          await context.drawEmoji(`👛`, 5, 0, font_size / 2.5, font_size / 2.5);
          context.fillText(` ${current_player.money.toFixed(1)}$`, 40, 34);

          context.font = `16px Minecraft`;

          await context.drawEmoji(`🎒`, 5, 40, font_size / 3.5, font_size / 3.5);
          context.fillText(
            ` ${current_player.inventory.size} / ${Math.floor(
              current_player.tools.backpack.size
            )}`,
            30,
            57
          );

          await context.drawEmoji(`👜`, 5, 65, font_size / 3.5, font_size / 3.5);
          context.fillText(
            ` ${current_player.tools_inventory.size} / ${Math.floor(
              current_player.tools.tools_backpack.size
            )}`,
            30,
            81
          );
        }

        context.font = `${font_size}px Minecraft`;
        var chunks = playing_area.split("|");
        var all_emojis = [];
        for (var i = 0; i < chunks.length - 1; i++) {
          all_emojis.push(chunks[i].split(" "));
        }
        console.log(chunks);

        var answer;

        function auto_font_size() {
          answer = font_size * current_player.tools.vision.number;
          if (answer > 400.01) {
            font_size += 1 - answer / 400;
            context.font = `${font_size}px Minecraft`;
            auto_font_size();
          }
          if (answer < 399.99) {
            font_size += answer / 400;
            context.font = `${font_size}px Minecraft`;
            auto_font_size();
          }
        }

        if (
          !font_size_last_check ||
          font_size_last_check !== current_player.tools.vision.number
        ) {
          font_size_last_check = current_player.tools.vision.number;
          await gameMessage.edit(
            await client.tall(
              {
                embeds: [],
                components: [],
                files: [],
                content: `Подстраиваю размер блоков под вас...`,
              },
              interaction.locale
            )
          );
          auto_font_size();
        }

        context.font = `${font_size}px Minecraft`;

        async function loadImageSafely(imagePath) {
          try {
            console.log(`Attempting to load image from path: ${imagePath}`);
            // Try different path formats to find the right image
            const paths = [
              imagePath,
              imagePath.replace("./../../", ""),
              imagePath.startsWith("./../../")
                ? imagePath
                : `./../../${imagePath}`,
              imagePath.replace("./../../", "../"),
              join(__dirname, "../../..", imagePath.replace("./../../", "")),
            ];

            // Try each path until we find a working one
            for (const path of paths) {
              try {
                console.log(`Trying path: ${path}`);
                if (fs.existsSync(path)) {
                  console.log(`Found file at: ${path}`);
                  return await loadImage(fs.readFileSync(path));
                }
              } catch (err) {
                console.log(`Failed with path ${path}: ${err.message}`);
              }
            }

            // If no paths work, throw error
            throw new Error(
              `Could not find image at any resolved path for: ${imagePath}`
            );
          } catch (error) {
            console.error(`Error loading image ${imagePath}:`, error);
            // Return a simple colored rectangle as fallback
            const canvas = createCanvas(64, 64);
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#FF0000";
            ctx.fillRect(0, 0, 64, 64);
            return canvas;
          }
        }

        async function placeBlock(
          current_emoji,
          x,
          y,
          font_size,
          destroying,
          destroyed,
          player_here,
          ore_here,
          placed_here,
          real_x,
          real_y,
          mob_here,
          all_emojis
        ) {
          // ... existing code ...

          // Use the same technique for blocks
          if (
            blocks[current_emoji] &&
            blocks[current_emoji].emoji_canvas &&
            !canvas_images[current_emoji]
          ) {
            canvas_images[current_emoji] = await loadImageSafely(
              blocks[current_emoji].emoji_canvas
            );
          }

          // And for destroying animations
          if (destroying && !canvas_images[`destroying${destroying}`]) {
            canvas_images[`destroying${destroying}`] = await loadImageSafely(
              `other/minecraft/breaking-${destroying}.png`
            );
          }

          // ... and other image loading sections

          // Check if the block has a texture that we can draw directly
          const hasTexture =
            blocks[current_emoji] &&
            blocks[current_emoji].emoji_canvas &&
            canvas_images[current_emoji];

          if (painting_mode === 1) {
            if (current_player.grid_invisible === true) {
              if (blocks[current_emoji].name !== `Пустой блок`) {
                context.drawImage(
                  canvas_images[current_emoji],
                  x,
                  y,
                  font_size,
                  font_size
                );
              }
            } else {
              context.drawImage(
                canvas_images[current_emoji],
                x,
                y,
                font_size,
                font_size
              );
            }
          } else {
            context.drawImage(
              canvas_images[current_emoji],
              x,
              y,
              font_size,
              font_size
            );

            const ore = ores.find((o) => o.emoji === current_emoji);

            if (ore) {
              // It's an ore, draw its texture
              const oreTextureKey = `ore_texture_${ore.tier}`;
              if (!canvas_images[oreTextureKey]) {
                canvas_images[oreTextureKey] = await loadImageSafely(
                  `other/minecraft/ores/ore-${ore.tier}.png`
                );
              }
              if (canvas_images[oreTextureKey]) {
                // Check if image loaded successfully
                context.drawImage(
                  canvas_images[oreTextureKey],
                  x,
                  y,
                  font_size,
                  font_size
                );
              }
            } else if (!hasTexture) {
              // Only draw emoji if we don't have a texture already rendered
              console.log(`blocks[${current_emoji}] doesnt have emoji_canvas`);
              await context.drawEmoji(
                current_emoji,
                x - 1,
                y + 17,
                font_size,
                font_size
              );
            }

            if (painting_mode === 0) {
              if (destroyed === 1 && current_player.shopping.status === 0) {
                context.fillStyle = "rgba(0, 0, 0, 0.6)";
                context.fillRect(x, y, font_size, font_size);
              } else if (destroying > 0) {
                if (!canvas_images[`destroying${destroying}`]) {
                  canvas_images[`destroying${destroying}`] =
                    await loadImageSafely(
                      `other/minecraft/breaking-${destroying}.png`
                    );
                }
                context.drawImage(
                  canvas_images[`destroying${destroying}`],
                  x,
                  y,
                  font_size,
                  font_size
                );
              }
            }

            if (placed_here === 1 && current_player.shopping.status === 0) {
              if (painting_mode === 1) {
                var type = current_player.placed[`${real_x}>${real_y}`].c;
                if (type === 0) {
                  var current_placed =
                    all_blocks[current_player.placed[`${real_x}>${real_y}`].e];
                } else if (type === 1) {
                  var current_placed =
                    ores[current_player.placed[`${real_x}>${real_y}`].t - 1];
                  current_placed.emoji_canvas = `other/minecraft/ores/ore-${current_placed.tier}.png`;
                  current_placed.id =
                    current_player.placed[`${real_x}>${real_y}`].t;
                } else if (type === 2) {
                  var current_placed =
                    mobs[current_player.placed[`${real_x}>${real_y}`].i - 1];
                } else if (type === 3) {
                  var current_placed =
                    current_player.custom_textures[
                      current_player.placed[
                        `${real_x}>${real_y}`
                      ].i
                    ];
                }
                current_placed.key = `${type}-${current_placed.id}`;
              } else {
                var current_placed =
                  items[current_player.placed[`${real_x}>${real_y}`].key];
              }
              if (!canvas_images[`${current_placed.key}`]) {
                if (current_placed.emoji_canvas.includes("http")) {
                  canvas_images[`${current_placed.key}`] = await loadImageSafely(
                    await (await fetch(current_placed.emoji_canvas)).arrayBuffer()
                  );
                } else {
                  canvas_images[`${current_placed.key}`] = await loadImageSafely(
                    fs.readFileSync(`${current_placed.emoji_canvas}`)
                  );
                }
              }
              if (painting_mode === 0) {
                context.shadowBlur = 10;
                context.shadowColor = "black";
              }
              context.drawImage(
                canvas_images[`${current_placed.key}`],
                x,
                y,
                font_size,
                font_size
              );
              if (painting_mode === 1) {
                if (destroyed === 1) {
                  context.fillStyle = "rgba(0, 0, 0, 0.6)";
                  context.fillRect(x, y, font_size, font_size);
                }
              } else {
                context.shadowColor = "rgba(0, 0, 0, 0.0)";
              }
            }

            if (mob_here === 1 && current_player.shopping.status === 0) {
              console.log(`${real_x}>${real_y}`);
              var current_mob = current_player.mobs[`${real_x}>${real_y}`];
              console.log(current_mob);
              if (!canvas_images[`mob-${current_mob.rank}`]) {
                canvas_images[`mob-${current_mob.rank}`] = await loadImageSafely(
                  `other/minecraft/mobs/mob-${current_mob.rank}.png`
                );
              }
              console.log("using");

              context.drawImage(
                canvas_images[`mob-${current_mob.rank}`],
                x,
                y,
                font_size,
                font_size
              );
            }

            if (player_here === 1) {
              // Revert to using the correct image path and cache key
              if (!canvas_images[`player_${current_player.player.look}`]) {
                canvas_images[`player_${current_player.player.look}`] =
                  await loadImageSafely(
                    `other/minecraft/entity/player/@${current_player.player.look}.png`
                  );
              }
              console.log("using player image for look:", current_player.look);

              context.shadowBlur = 10;
              context.shadowColor = "black";

              if (painting_mode === 1) {
                if (current_player.player_invisible === false) {
                  context.drawImage(
                    canvas_images[`player_${current_player.look}`], // Use correct cache key
                    x,
                    y,
                    font_size,
                    font_size
                  );
                }
              } else {
                console.log(
                  "GETTING PLAYER ICON BASED ON LOOK",
                  current_player.player.look
                );
                context.drawImage(
                  canvas_images[`player_${current_player.player.look}`], // Use correct cache key
                  x,
                  y,
                  font_size,
                  font_size
                );
              }

              context.shadowColor = "rgba(0, 0, 0, 0.0)";
            }

            if (current_player.shopping.status === 0) {
              if (painting_mode === 0) {
                var light = 0.7;
                var torch = 0;
                Object.keys(current_player.placed).forEach((key) => {
                  var current_placed = current_player.placed[key];
                  if (items[current_placed.key]?.light) {
                    var x = Number(current_placed.xy.split(">")[0]);
                    var y = Number(current_placed.xy.split(">")[1]);
                    var power = items[current_placed.key].light.power;
                    if (
                      real_x >= x - power &&
                      real_x <= x + power &&
                      real_y >= y - power &&
                      real_y <= y + power
                    ) {
                      torch = 1;
                      light -= 0.7;
                    }
                  }
                });
                if (torch === 0) {
                  if (
                    (real_x + 1 === current_player.x ||
                      real_x - 1 === current_player.x ||
                      real_x === current_player.x) &&
                    (real_y + 1 === current_player.y ||
                      real_y - 1 === current_player.y ||
                      real_y === current_player.y)
                  ) {
                    light -= 0.3;
                  }
                }

                if (light < 0) {
                  light = 0;
                }
              } else {
                light = 0;
              }

              context.fillStyle = `rgba(0, 0, 0, ${light})`;
              context.fillRect(x, y, font_size, font_size);
            }
          }

          var y_ =
            current_player.y - Math.floor(current_player.tools.vision.number / 2);
          var x_ =
            current_player.x + Math.floor(current_player.tools.vision.number / 2);

          var target_x = 0;
          var target_y = 0;
          var mobs_ = [];
          var area = [];

          all_emojis = all_emojis.reverse();
          for (var i = 0; i < all_emojis.length; i++) {
            console.log(all_emojis[i].length);
            for (var c = 0; c < all_emojis[i].length - 1; c++) {
              var current_emoji = all_emojis[i][c];
              var destroying = 0;
              var destroyed = 0;
              var player_here = 0;
              var mob_here = 0;
              var ore_here = 0;
              var placed_here = 0;

              var block_x = 0 + font_size * c;
              var block_y =
                485 + all_emojis.length / 3 - font_size - font_size * i;
              if (painting_mode === 1) {
                block_y -= 80 + all_emojis.length / 1.5;
              }

              if (current_emoji.includes("!")) {
                player_here = 1;
                current_emoji = current_emoji.replace("!", "");
              }
              if (current_emoji.includes(".")) {
                destroyed = 1;
                current_emoji = current_emoji.replace(".", "");
              }
              if (current_emoji.includes("-")) {
                destroying = Number(current_emoji.split("-")[1]);
                console.log(destroying);
                current_emoji = current_emoji.slice(0, current_emoji.length - 2);
                console.log(current_emoji);
              }
              if (current_emoji.includes("]")) {
                mob_here = 1;
                current_emoji = current_emoji.replace("]", "");
              }
              if (current_emoji.includes("~")) {
                placed_here = 1;
                current_emoji = current_emoji.replace("~", "");
              }
              if (current_emoji.includes("🟪")) {
                ore_here = 1;
              }

              await placeBlock(
                current_emoji,
                block_x,
                block_y,
                font_size,
                destroying,
                destroyed,
                player_here,
                ore_here,
                placed_here,
                x_ - c,
                y_ + i,
                mob_here,
                all_emojis
              );
            }
          }

          if (painting_mode === 0) {
            context.font = `20px Minecraft`;
            context.strokeStyle = "black";
            context.lineWidth = 3;
            context.fillStyle = "#00FF00";
            /*await strokeTextWithTwemoji(context, `${current_player.level} уровень`, 5, 478)
						await fillTextWithTwemoji(context, `${current_player.level} уровень`, 5, 478)*/
          context.strokeText(
            await (
              await client.tall(
                { content: `${current_player.player.level} уровень` }, // Use current_player.player.level
                interaction.locale
              )
            ).content,
            5,
            478
          );
          context.fillText(
            await (
              await client.tall(
                { content: `${current_player.player.level} уровень` }, // Use current_player.player.level
                interaction.locale
              )
            ).content,
            5,
            478
          );
          context.textAlign = "right";
          context.fillStyle = "white";
          /*await strokeTextWithTwemoji(
							context,
							`${current_player.player.xp} / ${current_player.player.xp_needed}`,
							200,
							478
						)*/
          /*await fillTextWithTwemoji(
							context,
							`${current_player.player.xp} / ${current_player.player.xp_needed}`,
							200,
							478
						)*/
          context.strokeText(
            `(${current_player.player.xp}/${current_player.player.xp_needed})`, // Use .player.xp and .player.xp_levelup
            400,
            478
          );
          context.fillText(
            `(${current_player.player.xp}/${current_player.player.xp_needed})`, // Use .player.xp and .player.xp_levelup
            400,
            478
          );
          context.fillRect(
            0,
            485,
            (400 / current_player.player.xp_levelup) * current_player.player.xp, // Use .player.xp and .player.xp_levelup
            15
          );

          context.fillStyle = "white";
          context.textAlign = `right`;
          context.font = `20px Minecraft`;
          var tools_keys = Object.keys(current_player.tools);
          var visible_i = 0;
          for (var i = 0; i < tools_keys.length; i++) {
            var current_tool = current_player.tools[tools_keys[i]];
            console.log(current_tool);
            if (
              current_tool.durability >= 0 &&
              current_tool.durability !== current_tool.durability_max
            ) {
              visible_i++;
              var numbers = `!!! ${current_tool.durability}`;
              if (current_tool.durability <= 0) {
                numbers = "СЛОМАН";
              }
              /*await strokeTextWithTwemoji(
									context,
									`${tools[tools_keys[i]].emoji} ${numbers}`,
									390,
									180 + 30 * visible_i
								)
								await fillTextWithTwemoji(
									context,
									`${tools[tools_keys[i]].emoji} ${numbers}`,
									390,
									180 + 30 * visible_i
								)*/
              context.strokeText(
                await (
                  await client.tall({ content: numbers }, interaction.locale)
                ).content,
                360,
                180 + 30 * visible_i
              );
              context.fillText(
                await (
                  await client.tall({ content: numbers }, interaction.locale)
                ).content,
                360,
                180 + 30 * visible_i
              );
              await context.drawEmoji(
                tools[tools_keys[i]].emoji,
                365,
                160 + 30 * visible_i,
                font_size / 3,
                font_size / 3
              );
            }
          }

          for (var i = 0; i < all_emojis.length; i++) {
            for (var c = 0; c < all_emojis[i].length - 1; c++) {
              var current_emoji = all_emojis[i][c];
              if (current_emoji.includes("!")) {
                target_x = c;
                target_y = i;
              }
              if (current_emoji.includes("]")) {
                mobs_.push([c, i, x_ - c, y_ + i]);
              }
              if (current_emoji.includes(".") || current_emoji === "🟩") {
                area.push(0);
              } else {
                area.push(1);
              }
            }
          }
          console.log(`MOBS ${mobs_}`);
          console.log(`TARGET X ${target_x}`);
          console.log(`TARGET Y ${target_y}`);
          console.log(area);

          area = ndarray(
            [area],
            [
              current_player.tools.vision.number,
              current_player.tools.vision.number,
            ]
          );
          var planner = createPlanner(area);
          var moved = 0;
          mobs_.forEach(async (selected_mob) => {
            var s_mob_x = selected_mob[0];
            var s_mob_y = selected_mob[1];
            var path = [];
            planner.search(s_mob_x, s_mob_y, target_x, target_y, path);
            var ready_path = path.slice(0, 4);
            console.log(ready_path);
            var first_x = ready_path[0];
            var first_y = ready_path[1];
            var second_x = ready_path[2];
            var second_y = ready_path[3];

            var current_mob =
              current_player.mobs[`${selected_mob[2]}>${selected_mob[3]}`];
            var direction = 0;
            if (first_x < second_x && first_y === second_y) {
              //left
              direction = 0;
              current_mob.x--;
              moved = 1;
            } else if (first_x > second_x && first_y === second_y) {
              //right
              direction = 2;
              current_mob.x++;
              moved = 1;
            } else if (first_x === second_x && first_y < second_y) {
              //up
              direction = 1;
              current_mob.y++;
              moved = 1;
            } else if (first_x === second_x && first_y > second_y) {
              //down
              direction = 3;
              current_mob.y--;
              moved = 1;
            }

            if (
              current_mob.x === current_player.x &&
              current_mob.y === current_player.y
            ) {
              moved = 0;
              /*await mining2.set(`${key}.health`, current_player.health - current_mob.damage)*/
              await client.fdb.dec(
                `${key}.health`,
                current_mob.damage,
                "mining2"
              );
            }

            if (
              moved === 1 &&
              !current_player.destroyed.includes(
                `${current_mob.x}>${current_mob.y}`
              )
            ) {
              switch (direction) {
                case 0 || 2: {
                  if (direction === 0) {
                    current_mob.x++;
                  } else if (direction === 2) {
                    current_mob.x--;
                  }

                  if (
                    current_player.destroyed.includes(
                      `${current_mob.x}>${current_mob.y++}`
                    )
                  ) {
                    current_mob.y++;
                  } else if (
                    current_player.destroyed.includes(
                      `${current_mob.x}>${current_mob.y--}`
                    )
                  ) {
                    current_mob.y--;
                  }
                  break;
                }
                case 1 || 3: {
                  if (direction === 1) {
                    current_mob.y--;
                  } else if (direction === 3) {
                    current_mob.y++;
                  }

                  if (
                    current_player.destroyed.includes(
                      `${current_mob.x++}>${current_mob.y}`
                    )
                  ) {
                    current_mob.x++;
                  } else if (
                    current_player.destroyed.includes(
                      `${current_mob.x--}>${current_mob.y}`
                    )
                  ) {
                    current_mob.x--;
                  }
                  break;
                }
              }
            }

            if (
              moved === 1 &&
              current_player.destroyed.includes(
                `${current_mob.x}>${current_mob.y}`
              )
            ) {
              /*await mining2.delete(`${key}.mobs.${selected_mob[2]}>${selected_mob[3]}`)
							await mining2.set(`${key}.mobs.${current_mob.x}>${current_mob.y}`, current_mob)*/
              client.db.delete(
                `${key}.mobs.${selected_mob[2]}>${selected_mob[3]}`
              );
              Object.keys(current_mob).forEach((key2) => {
                client.db.set(
                  `${key}.mobs.${current_mob.x}>${current_mob.y}.${key2}`,
                  current_mob[key2]
                );
              });
            }
          });

          if (moved === 1) {
            current_player =
              /*await mining2.get(`${key}`)*/ await client.fdb.get(
                `${key}`,
                "mining2",
                true
              );
          }
          var i_visible = 0;
          // Calculate how many hearts to display - scale down when health_max is high
          const maxDisplayedHearts = current_player.player.health_max / 10; // Maximum number of hearts to display
          const heartScale = Math.min(
            1,
            maxDisplayedHearts / (current_player.player.health_max / 2)
          );
          const displayedHeartCount = Math.ceil(
            current_player.player.health_max * heartScale
          );

          // Calculate the display health by scaling the current health
          const displayHealth = current_player.player.health * heartScale;

          for (var i = 0; i < displayedHeartCount; i += 2) {
            var health_size = 35;
            var health_distance =
              80 /
              ((displayedHeartCount / 10) * (1 + displayedHeartCount / 600));
            var health_x =
              5 +
              (displayedHeartCount < 30 ? 4 : 0) +
              health_distance * i_visible;
            var health_y = 100;

            // Scale health value to match the displayed hearts
            const healthPercentage =
              current_player.player.health / current_player.player.health_max;
            const currentDisplayValue =
              i * (current_player.player.health_max / displayedHeartCount);

            if (healthPercentage * displayedHeartCount > i / 2) {
              // Show full or half heart based on percentage
              if (
                healthPercentage * displayedHeartCount > i / 2 + 0.5 &&
                healthPercentage * displayedHeartCount < i / 2 + 1
              ) {
                if (!canvas_images[`health-half`]) {
                  canvas_images[`health-half`] = await loadImageSafely(
                    `other/minecraft/ui/heart-half.png`
                  );
                }
                context.drawImage(
                  canvas_images[`health-half`],
                  health_x,
                  health_y,
                  health_size,
                  health_size
                );
                i_visible++;
              } else {
                if (!canvas_images[`health-full`]) {
                  canvas_images[`health-full`] = await loadImageSafely(
                    `other/minecraft/ui/heart-full.png`
                  );
                }
                context.drawImage(
                  canvas_images[`health-full`],
                  health_x,
                  health_y,
                  health_size,
                  health_size
                );
                i_visible++;
              }
            } else {
              if (!canvas_images[`health-empty`]) {
                canvas_images[`health-empty`] = await loadImageSafely(
                  `other/minecraft/ui/heart-empty.png`
                );
              }
              context.drawImage(
                canvas_images[`health-empty`],
                health_x,
                health_y,
                health_size,
                health_size
              );
              i_visible++;
            }
          }
          var i2_visible = 0;

          // Get food values from the correct location with fallbacks
          const playerFood = current_player.player?.food || 0;
          // Default food_max to 20 if not defined
          const playerFoodMax = current_player.player?.food_max || 20;

          // Calculate how many food icons to display - scale down when food_max is high
          const maxDisplayedFood = playerFoodMax / 2; // Maximum number of food icons to display
          const foodScale = Math.min(1, maxDisplayedFood / (playerFoodMax / 2));
          const displayedFoodCount = Math.ceil(playerFoodMax * foodScale);

          // Calculate the display food by scaling the current food
          const displayFood = playerFood * foodScale;

          // Only draw food bar if food properties exist
          if (playerFood !== undefined && playerFoodMax > 0) {
            for (var i2 = 0; i2 < displayedFoodCount; i2 += 2) {
              var food_size = 35;
              var food_distance =
                80 /
                ((displayedFoodCount / 10) * (1 + displayedFoodCount / 600));
              var food_x =
                5 +
                (displayedFoodCount < 30 ? 4 : 0) +
                food_distance * i2_visible;
              var food_y = 145;

              // Scale food value to match the displayed icons
              const foodPercentage = playerFood / playerFoodMax;

              if (foodPercentage * displayedFoodCount > i2 / 2) {
                if (!canvas_images[`food-full`]) {
                  canvas_images[`food-full`] = await loadImageSafely(
                    `other/minecraft/ui/food-full.png`
                  );
                }
                context.drawImage(
                  canvas_images[`food-full`],
                  food_x,
                  food_y,
                  food_size,
                  food_size
                );
                i2_visible++;
              } else {
                if (!canvas_images[`food-empty`]) {
                  canvas_images[`food-empty`] = await loadImageSafely(
                    `other/minecraft/ui/food-empty.png`
                  );
                }
                context.drawImage(
                  canvas_images[`food-empty`],
                  food_x,
                  food_y,
                  food_size,
                  food_size
                );
                i2_visible++;
              }
            }
          }

          // Fix the coordinate calculation to handle undefined values
          var xy = 0;
          if (
            typeof current_player.x === "number" &&
            typeof current_player.y === "number"
          ) {
            xy = Math.abs(current_player.x) + Math.abs(current_player.y) - 1;
            if (xy < 0) xy = 0;
          }

          // Initialize current_location with a default value to prevent undefined errors
          let current_location = {
            name: "Спавн", // Changed to actual spawn location name
            from: 0,
            to: 1,
            tier: 0,
          };

          if (current_player.shopping.page > 0) {
            current_location = {
              name: "У продавца",
              from: 0,
              to: 20,
              tier: 0,
            };
          } else if (current_player.shopping.status === 1) {
            current_location = {
              name: "Магазин",
              from: 0,
              to: 20,
              tier: 0,
            };
          } else {
            // Use for...of instead of forEach with async to ensure synchronous execution
            // Find the location based on player position
            for (const location of locations) {
              if (xy >= location.from && xy <= location.to) {
                current_location = location;
                break; // Exit loop once found
              }
            }
          }

          context.font = `13px Minecraft`;
          console.log(`LOCATION XY: ${xy}`);
          console.log(current_location);
          context.textAlign = "center";

          // Check if current_location is defined before accessing properties
          if (current_location && current_location.name) {
            context.strokeText(
              await (
                await client.tall(
                  { content: `${current_location.name}` },
                  interaction.locale
                )
              ).content,
              200,
              457
            );
            context.fillText(
              await (
                await client.tall(
                  { content: `${current_location.name}` },
                  interaction.locale
                )
              ).content,
              200,
              457
            );
          }
        }

        var buffer = canvas.toBuffer("image/png");
        var buffer_ready = new AttachmentBuilder(buffer, { name: "test.png" });
        mining_embed.setImage(`attachment://test.png`);

        if (
          current_player.shopping.page > 0 &&
          current_player.shopping.status !== 0
        ) {
          if (painting_mode == 1) {
            current_player = await client.fdb.get(`${key}`, "mining2", true);
          }
          shopping_menu({
            embed: mining_embed,
            current_player: current_player,
            buffer_ready: buffer_ready,
            interaction: interaction,
          });
        } else {
          var ready_components = [];

          if (painting_mode === 1) {
            var paint_controls = new ActionRowBuilder();

            var mas =
              /*await mining2.get(`${key}${painting_text_db || ''}.destroyed`)*/ await client.fdb.get(
                `${key}${painting_text_db || ""}.destroyed`,
                "mining2"
              );
            console.log(`${key}${painting_text_db || ""}.destroyed`);
            console.log(mas);
            if (
              current_player.placed[`${current_player.x}>${current_player.y}`]
            ) {
              var type =
                current_player.placed[`${current_player.x}>${current_player.y}`]
                  .c;
              if (type === 0) {
                var current_block =
                  all_blocks[
                    current_player.placed[
                      `${current_player.x}>${current_player.y}`
                    ].e
                  ];
              } else if (type === 1) {
                var current_block =
                  ores[
                    current_player.placed[
                      `${current_player.x}>${current_player.y}`
                    ].t - 1
                  ];
                console.log(current_block);
              } else if (type === 2) {
                var current_block =
                  mobs[
                    current_player.placed[
                      `${current_player.x}>${current_player.y}`
                    ].i - 1
                  ];
              } else if (type === 3) {
                var current_block =
                  current_player.custom_textures[
                    current_player.placed[
                      `${current_player.x}>${current_player.y}`
                    ].i
                  ];
              }
              paint_controls.addComponents([
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji(`${current_block.emoji}`)
                  .setLabel(
                    `!!! [${current_player.x}:${current_player.y}] ${current_block.name}`
                  )
                  .setDisabled(true)
                  .setCustomId("mine____"),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji(`🗑`)
                  .setCustomId("mine_painting_break"),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel(
                    mas.includes(`${current_player.x}>${current_player.y}`)
                      ? `Задний слой`
                      : `Передний слой`
                  )
                  .setCustomId("mine_painting_change_layer"),
              ]);
            } else {
              paint_controls.addComponents([
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setLabel(`${current_player.x}:${current_player.y}`)
                  .setDisabled(true)
                  .setCustomId("mine____"),
                new ButtonBuilder()
                  .setStyle(
                    current_player.player_invisible === true
                      ? ButtonStyle.Primary
                      : ButtonStyle.Secondary
                  )
                  .setEmoji(
                    current_player.player_invisible === true ? `🔘` : `🟢`
                  )
                  .setLabel(`Игрок`)
                  .setCustomId("mine_painting_player_invisible"),
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Secondary)
                  .setStyle(
                    current_player.grid_invisible === true
                      ? ButtonStyle.Primary
                      : ButtonStyle.Secondary
                  )
                  .setEmoji(
                    current_player.grid_invisible === true ? `🔘` : `🟢`
                  )
                  .setLabel(`Сетка`)
                  .setCustomId("mine_painting_grid_invisible"),
              ]);
            }

            ready_components.push(paint_controls);
          }

          if (painting_mode === 0) {
            var tools_inventory_selector = new ActionRowBuilder();
            var tools2_inventory_selector = new ActionRowBuilder();
            var activated = 0;
            var activated2 = 0;

            if (current_player.tools_inventory.size > 0) {
              if (current_player.shopping.status === 0) {
                activated = 1;
                var tools_inventory_ = [];
                Object.keys(current_player.tools_inventory).forEach((key) => {
                  if (!isNaN(Number(key))) {
                    var current_ = current_player.tools_inventory[key];
                    if (current_.count > 0) {
                      if (current_.key === "torch3") current_.key = "food_pack";
                      var current_item = items[current_.key];
                      console.log(`!__________!`);
                      console.log(current_item);
                      tools_inventory_.push({
                        label: `${current_item.name}`,
                        emoji: current_item.emoji,
                        value: `${current_item.id}`,
                        description: `У вас ${current_.count} шт`,
                      });
                    }
                  }
                });
                tools_inventory_selector.addComponents([
                  new StringSelectMenuBuilder()
                    .setCustomId("mine_place")
                    .setPlaceholder(
                      `Рюкзак расходников (${current_player.tools_inventory.size})`
                    )
                    .addOptions(tools_inventory_),
                ]);
              } else {
                activated = 1;
                tools_inventory_selector.addComponents([
                  new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel(
                      `Рюкзак расходников (${current_player.tools_inventory.size})`
                    )
                    .setDisabled(true)
                    .setCustomId("mine_items_nan"),
                ]);
              }
            }
            if (current_player.inventory.size > 0) {
              if (current_player.shopping.status === 0) {
                activated2 = 1;
                var inventory_ = [];
                Object.keys(current_player.inventory).forEach((key) => {
                  if (current_player.inventory[key]?.id) {
                    var current_ = current_player.inventory[key];
                    if (current_.count > 0) {
                      inventory_.push({
                        label: `${current_.name}`,
                        emoji: current_.emoji,
                        value: `${current_.id}`,
                        description: `У вас ${current_.count} шт`,
                      });
                    }
                  }
                });
                tools2_inventory_selector.addComponents([
                  new StringSelectMenuBuilder()
                    .setCustomId("mine_blocks")
                    .setPlaceholder(
                      `Рюкзак блоков (${current_player.inventory.size})`
                    )
                    .addOptions(inventory_),
                ]);
              } else {
                activated = 1;
                tools_inventory_selector.addComponents([
                  new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel(
                      `Рюкзак блоков (${current_player.inventory.size})`
                    )
                    .setDisabled(true)
                    .setCustomId("mine_block_nan"),
                ]);
              }
            }
          }
        }
      });
    }
  },
};
