import hubClient from "../api/hubClient.ts";
import {
  acquireDistributedLock,
  releaseDistributedLock,
} from "../services/runtimeRedis.ts";

type ClientLike = {
  guilds: {
    cache: {
      values: () => IterableIterator<unknown>;
    };
  };
  users: {
    fetch: (userId: string) => Promise<{
      send: (payload: { content: string }) => Promise<unknown>;
    }>;
  };
};

type GuildLike = {
  id: string;
  name: string;
};

const REMINDER_INTERVAL_MS = 60 * 60 * 1000;
const REMINDER_LOCK_KEY = "daily-crate-reminders";
const REMINDER_LOCK_TTL_MS = Math.floor(REMINDER_INTERVAL_MS * 0.9);

function getReminderText(locale: string | null | undefined, guildName: string): string {
  switch ((locale || "en").split("-")[0]) {
    case "ru":
      return `🎁 Ваш ежедневный кейс в ${guildName} уже готов. Откройте /cases, чтобы не потерять серию.`;
    case "uk":
      return `🎁 Ваш щоденний кейс у ${guildName} вже готовий. Відкрийте /cases, щоб не втратити серію.`;
    default:
      return `🎁 Your daily crate in ${guildName} is ready. Open /cases so you don't lose your streak.`;
  }
}

async function processDailyCrateReminders(client: ClientLike): Promise<void> {
  const guilds = Array.from(client.guilds.cache.values()).filter(
    (guild): guild is GuildLike =>
      guild != null && typeof guild === "object" && "id" in guild && "name" in guild
  );

  for (const guild of guilds) {
    try {
      const users = (await hubClient.getGuildUsers(guild.id)) as Array<{ id?: string }>;
      for (const entry of users || []) {
        const userId = entry?.id;
        if (!userId) {
          continue;
        }

        try {
          const dailyStatus = (await hubClient.getDailyCrateStatus(guild.id, userId)) as {
            reminderEligible?: boolean;
          };

          if (!dailyStatus?.reminderEligible) {
            continue;
          }

          const locale = await hubClient.getUserLocale(guild.id, userId).catch(() => "en");
          const user = await client.users.fetch(userId);
          await user.send({
            content: getReminderText(locale, guild.name),
          });
          await hubClient.markDailyCrateReminderSent(guild.id, userId);
        } catch (error) {
          console.warn(`Failed daily crate reminder for ${guild.id}/${userId}:`, error);
        }
      }
    } catch (error) {
      console.warn(`Failed to process daily crate reminders for guild ${guild.id}:`, error);
    }
  }
}

function startDailyCrateReminders(client: ClientLike): void {
  const runPass = async (label: string): Promise<void> => {
    const lock = await acquireDistributedLock(REMINDER_LOCK_KEY, REMINDER_LOCK_TTL_MS);

    if (!lock.acquired) {
      console.log(`[dailyCrateReminders] Skip ${label}; lock not acquired`);
      return;
    }

    try {
      await processDailyCrateReminders(client);
    } finally {
      await releaseDistributedLock(REMINDER_LOCK_KEY, lock.token);
    }
  };

  // Run immediately on startup to catch up on missed reminders during downtime
  runPass("startup").catch((error) => {
    console.error("Initial daily crate reminder pass failed:", error);
  });

  // Then run on interval
  setInterval(() => {
    runPass("interval").catch((error) => {
      console.error("Daily crate reminder loop failed:", error);
    });
  }, REMINDER_INTERVAL_MS);
}

export { startDailyCrateReminders, processDailyCrateReminders };
