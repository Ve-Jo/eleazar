import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { createActivitiesApp } from "../server.ts";
import { resetDiscordRoleCache } from "./server/services/discordRolesService.ts";

const originalFetch = globalThis.fetch;

type ServerHandle = {
  close: (callback?: () => void) => void;
  address: () => { port: number } | string | null;
};

async function startServer(): Promise<{ server: ServerHandle; baseUrl: string }> {
  const app = createActivitiesApp();

  const server = await new Promise<ServerHandle>((resolve) => {
    const handle = app.listen(0, "127.0.0.1", () => resolve(handle as ServerHandle));
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    server,
    baseUrl: `http://127.0.0.1:${port}`,
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function installLauncherFetchMock(options?: {
  users?: Array<Record<string, unknown>>;
  onDeposit?: (body: Record<string, unknown>) => void;
  onCrateOpen?: (body: Record<string, unknown>) => void;
  onUpgradePurchase?: (body: Record<string, unknown>) => void;
  discordRolesPayload?: unknown;
  discordRolesStatus?: number;
}) {
  const userResponses = options?.users || [
    {
      economy: {
        balance: "123.4",
        bankBalance: "10",
        bankDistributed: "5",
        bankRate: "2",
        bankStartTime: 1000,
        upgradeDiscount: "3",
      },
      crates: [{ type: "daily", count: 2 }, { type: "weekly", count: 1 }],
      upgrades: [{ type: "games_earning", level: 3 }],
      stats: { gameWins: 7 },
      Level: { xp: 1000, gameXp: 2000 },
    },
  ];
  let userCallCount = 0;

  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input);

    if (url.startsWith("http://127.0.0.1")) {
      return originalFetch(input, init);
    }

    if (url === "https://discord.com/api/v10/guilds/g1/roles") {
      return jsonResponse(
        options?.discordRolesPayload || [
          { id: "r-text-10", name: "Text Adept", color: 5793266 },
          { id: "r-voice-4", name: "Voice Scout", color: 3451020 },
          { id: "r-gaming-12", name: "Gaming Master", color: 8953556 },
        ],
        options?.discordRolesStatus ?? 200
      );
    }

    if (url.endsWith("/colors")) {
      return jsonResponse({
        textColor: "#fff",
        secondaryTextColor: "rgba(255,255,255,0.8)",
        tertiaryTextColor: "rgba(255,255,255,0.5)",
        overlayBackground: "rgba(255,255,255,0.08)",
        backgroundGradient: "linear-gradient(145deg, #0f4a68 0%, #173e78 45%, #2f215f 100%)",
        accentColor: "#ffb648",
        dominantColor: "rgb(70,143,201)",
        isDarkText: false,
      });
    }

    if (url.includes("/guilds/g1/users/ensure")) {
      return jsonResponse({ success: true });
    }

    if (url.includes("/users/g1/u1")) {
      const payload =
        userResponses[Math.min(userCallCount, userResponses.length - 1)] || userResponses[0];
      userCallCount += 1;
      return jsonResponse(payload);
    }

    if (url.includes("/guilds/g1")) {
      return jsonResponse({ id: "g1", name: "Test Guild" });
    }

    if (url.includes("/games/records/g1/u1")) {
      return jsonResponse({ "2048": { highScore: 2048 } });
    }

    if (url.includes("/games/earnings/g1/u1/")) {
      return jsonResponse({ cap: 1200, earnedToday: 100, remainingToday: 1100 });
    }

    if (url.includes("/xp/levels/g1/u1")) {
      return jsonResponse({
        text: { level: 5, currentXP: 320, requiredXP: 640, totalXP: 1000 },
        voice: { level: 1, currentXP: 12, requiredXP: 200, totalXP: 12 },
        gaming: { level: 10, currentXP: 420, requiredXP: 900, totalXP: 2000 },
      });
    }

    if (url.includes("/guilds/g1/users")) {
      return jsonResponse([
        { id: "u1", Level: { xp: 1000, voiceXp: 12, gameXp: 2000 } },
        { id: "u2", Level: { xp: 400, voiceXp: 4, gameXp: 1200 } },
      ]);
    }

    if (url.includes("/seasons/current")) {
      return jsonResponse({
        seasonNumber: 3,
        seasonEnds: 1774224000000,
      });
    }

    if (url.includes("/levels/roles/g1")) {
      return jsonResponse([
        { roleId: "r-text-10", mode: "text", requiredLevel: 10 },
        { roleId: "r-voice-4", mode: "voice", requiredLevel: 4 },
        { roleId: "r-gaming-12", mode: "gaming", requiredLevel: 12 },
      ]);
    }

    if (url.includes("/cooldowns/g1/u1/crime")) {
      return jsonResponse({ cooldown: 0 });
    }

    if (url.includes("/marriage/status/u1?guildId=g1")) {
      return jsonResponse(null);
    }

    if (url.includes("/crates/status/g1/u1/daily")) {
      return jsonResponse({
        streak: 4,
        rewardMultiplier: 1.15,
        available: true,
        cooldownRemainingMs: 0,
        nextAvailableAt: null,
      });
    }

    if (url.includes("/cooldowns/crate/g1/u1/weekly")) {
      return jsonResponse(0);
    }

    if (url.includes("/economy/bank/calculate")) {
      return jsonResponse({
        balance: "12.5",
        cycleComplete: false,
        cycleCount: 1,
        maxInactiveMs: 7200000,
        timeIntoCycle: 1800000,
        annualRate: 0.02,
      });
    }

    if (url.includes("/economy/deposit")) {
      options?.onDeposit?.(JSON.parse(String(init?.body || "{}")) as Record<string, unknown>);
      return jsonResponse({ success: true });
    }

    if (url.includes("/crates/open")) {
      options?.onCrateOpen?.(JSON.parse(String(init?.body || "{}")) as Record<string, unknown>);
      return jsonResponse({ coins: 25, discount: 3 });
    }

    if (url.includes("/economy/upgrades/purchase")) {
      options?.onUpgradePurchase?.(
        JSON.parse(String(init?.body || "{}")) as Record<string, unknown>
      );
      return jsonResponse({ type: "games_earning", level: 4 });
    }

    return jsonResponse({ error: `Unhandled fetch URL: ${url}` }, 500);
  }) as typeof fetch;
}

describe("Activities API integration", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "development";
    process.env.SKIP_AUTH = "true";
    process.env.ACTIVITY_DISCORD_BOT_TOKEN = "test-bot-token";
  });

  afterEach(() => {
    resetDiscordRoleCache();
    delete process.env.ACTIVITY_DISCORD_BOT_TOKEN;
    globalThis.fetch = originalFetch;
  });

  test("/api/token validates missing code", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/api/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(400);
    } finally {
      server.close();
    }
  });

  test("/api/token surfaces Discord OAuth errors", async () => {
    const { server, baseUrl } = await startServer();

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = String(input);

      if (url.startsWith("http://127.0.0.1")) {
        return originalFetch(input, init);
      }

      if (url === "https://discord.com/api/oauth2/token") {
        return jsonResponse(
          {
            error: "invalid_grant",
            error_description: "Invalid \"code\" in request.",
          },
          400
        );
      }

      return jsonResponse({ error: `Unhandled fetch URL: ${url}` }, 500);
    }) as typeof fetch;

    try {
      const response = await fetch(`${baseUrl}/api/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "bad-code" }),
      });
      const payload = (await response.json()) as any;

      expect(response.status).toBe(400);
      expect(payload.error).toBe("invalid_grant");
      expect(payload.message).toContain("Invalid \"code\"");
    } finally {
      server.close();
    }
  });

  test("/api/auth/discord/callback returns a lightweight callback page", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(
        `${baseUrl}/api/auth/discord/callback?code=test-code&state=test-state`
      );
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(html).toContain("discord-activity-oauth-callback");
      expect(html).toContain("test-code");
    } finally {
      server.close();
    }
  });

  test("/api/launcher-data returns aggregated launcher payload", async () => {
    const { server, baseUrl } = await startServer();

    installLauncherFetchMock();

    try {
      const response = await fetch(`${baseUrl}/api/launcher-data?guildId=g1`, {
        headers: {
          "x-user-id": "u1",
        },
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as any;
      expect(payload.guild?.id).toBe("g1");
      expect(payload.balance?.walletBalance).toBe(123.4);
      expect(payload.cases?.cards?.find((crate: any) => crate.type === "daily")?.count).toBe(2);
      expect(payload.games?.items?.find((game: any) => game.id === "2048")?.highScore).toBe(2048);
      expect(payload.palette?.accentColor).toBe("#ffb648");
      expect(
        payload.progression?.upcomingRoles?.find((role: any) => role.roleId === "r-gaming-12")?.roleName
      ).toBe("Gaming Master");
    } finally {
      server.close();
    }
  });

  test("/api/launcher-data keeps working when Discord role API fails", async () => {
    const { server, baseUrl } = await startServer();

    installLauncherFetchMock({
      discordRolesPayload: { message: "Missing Access" },
      discordRolesStatus: 403,
    });

    try {
      const response = await fetch(`${baseUrl}/api/launcher-data?guildId=g1`, {
        headers: {
          "x-user-id": "u1",
        },
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as any;
      const upcoming = payload.progression?.upcomingRoles || [];
      expect(upcoming.length).toBeGreaterThan(0);
      expect(upcoming[0]?.roleName).toBeUndefined();
      expect(typeof upcoming[0]?.roleId).toBe("string");
    } finally {
      server.close();
    }
  });

  test("/api/economy/move resolves percent deposits and returns refreshed launcher state", async () => {
    const { server, baseUrl } = await startServer();

    let depositBody: Record<string, unknown> | null = null;
    installLauncherFetchMock({
      users: [
        {
          economy: {
            balance: "200",
            bankBalance: "10",
            bankDistributed: "5",
            bankRate: "2",
            bankStartTime: 1000,
            upgradeDiscount: "0",
          },
          crates: [{ type: "daily", count: 2 }, { type: "weekly", count: 1 }],
          upgrades: [{ type: "games_earning", level: 3 }],
          Level: { xp: 1000, gameXp: 2000 },
        },
        {
          economy: {
            balance: "100",
            bankBalance: "110",
            bankDistributed: "5",
            bankRate: "2",
            bankStartTime: 1000,
            upgradeDiscount: "0",
          },
          crates: [{ type: "daily", count: 2 }, { type: "weekly", count: 1 }],
          upgrades: [{ type: "games_earning", level: 3 }],
          Level: { xp: 1000, gameXp: 2000 },
        },
      ],
      onDeposit: (body) => {
        depositBody = body;
      },
    });

    try {
      const response = await fetch(`${baseUrl}/api/economy/move`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "u1",
          "x-guild-id": "g1",
        },
        body: JSON.stringify({
          guildId: "g1",
          direction: "deposit",
          amountMode: "percent",
          amount: 50,
        }),
      });

      const payload = (await response.json()) as any;
      expect(response.status).toBe(200);
      expect((depositBody as Record<string, unknown> | null)?.amount).toBe(100);
      expect(payload.action?.amount).toBe(100);
      expect(payload.launcher?.balance?.walletBalance).toBe(100);
    } finally {
      server.close();
    }
  });

  test("/api/crates/open returns reward details and refreshed launcher state", async () => {
    const { server, baseUrl } = await startServer();

    let crateOpenBody: Record<string, unknown> | null = null;
    installLauncherFetchMock({
      users: [
        {
          economy: {
            balance: "148.4",
            bankBalance: "10",
            bankDistributed: "5",
            bankRate: "2",
            bankStartTime: 1000,
            upgradeDiscount: "3",
          },
          crates: [{ type: "daily", count: 1 }, { type: "weekly", count: 1 }],
          upgrades: [{ type: "games_earning", level: 3 }],
          Level: { xp: 1000, gameXp: 2000 },
        },
      ],
      onCrateOpen: (body) => {
        crateOpenBody = body;
      },
    });

    try {
      const response = await fetch(`${baseUrl}/api/crates/open`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "u1",
          "x-guild-id": "g1",
        },
        body: JSON.stringify({
          guildId: "g1",
          type: "daily",
        }),
      });

      const payload = (await response.json()) as any;
      expect(response.status).toBe(200);
      expect((crateOpenBody as Record<string, unknown> | null)?.type).toBe("daily");
      expect(payload.action?.reward?.coins).toBe(25);
      expect(payload.launcher?.cases?.cards?.find((crate: any) => crate.type === "daily")?.count).toBe(1);
    } finally {
      server.close();
    }
  });

  test("/api/upgrades/purchase returns refreshed upgrade catalog", async () => {
    const { server, baseUrl } = await startServer();

    let purchaseBody: Record<string, unknown> | null = null;
    installLauncherFetchMock({
      users: [
        {
          economy: {
            balance: "48.4",
            bankBalance: "10",
            bankDistributed: "5",
            bankRate: "2",
            bankStartTime: 1000,
            upgradeDiscount: "0",
          },
          crates: [{ type: "daily", count: 2 }, { type: "weekly", count: 1 }],
          upgrades: [{ type: "games_earning", level: 4 }],
          Level: { xp: 1000, gameXp: 2000 },
        },
      ],
      onUpgradePurchase: (body) => {
        purchaseBody = body;
      },
    });

    try {
      const response = await fetch(`${baseUrl}/api/upgrades/purchase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "u1",
          "x-guild-id": "g1",
        },
        body: JSON.stringify({
          guildId: "g1",
          upgradeType: "games_earning",
        }),
      });

      const payload = (await response.json()) as any;
      const gamesEarningCard =
        payload.launcher?.upgrades?.groups
          ?.flatMap((group: any) => group.items || [])
          .find((item: any) => item.type === "games_earning") || null;

      expect(response.status).toBe(200);
      expect((purchaseBody as Record<string, unknown> | null)?.upgradeType).toBe("games_earning");
      expect(payload.action?.upgradeType).toBe("games_earning");
      expect(gamesEarningCard?.currentLevel).toBe(4);
    } finally {
      server.close();
    }
  });

  test("/api/games/2048/complete is idempotent by submissionId", async () => {
    const { server, baseUrl } = await startServer();

    let awardCalls = 0;

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = String(input);

      if (url.startsWith("http://127.0.0.1")) {
        return originalFetch(input, init);
      }

      if (url.includes("/guilds/g1/users/ensure")) {
        return jsonResponse({ success: true });
      }

      if (url.includes("/users/g1/u1")) {
        return jsonResponse({
          upgrades: [{ type: "games_earning", level: 2 }],
        });
      }

      if (url.includes("/games/records/update")) {
        return jsonResponse({ highScore: 4096, isNewRecord: true });
      }

      if (url.includes("/games/xp/add")) {
        return jsonResponse({ levelUp: null, type: "activity" });
      }

      if (url.includes("/games/earnings/award")) {
        awardCalls += 1;
        return jsonResponse({
          requestedAmount: 10,
          effectiveRequestedAmount: 10,
          awardedAmount: 10,
          blockedAmount: 0,
          capBlockedAmount: 0,
          softLimitAwardAmount: 0,
          softLimitPayoutFactor: 0,
        });
      }

      if (url.includes("/games/earnings/g1/u1/2048")) {
        return jsonResponse({ cap: 1200, earnedToday: 200, remainingToday: 1000 });
      }

      if (url.includes("/economy/balance/g1/u1")) {
        return jsonResponse({ balance: 999, totalBankBalance: 55 });
      }

      return jsonResponse({ error: `Unhandled fetch URL: ${url}` }, 500);
    }) as typeof fetch;

    const body = {
      submissionId: "sub-1",
      guildId: "g1",
      score: 512,
      moves: 100,
      durationMs: 180000,
    };

    try {
      const first = await fetch(`${baseUrl}/api/games/2048/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "u1",
          "x-guild-id": "g1",
        },
        body: JSON.stringify(body),
      });
      expect(first.status).toBe(200);

      const second = await fetch(`${baseUrl}/api/games/2048/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "u1",
          "x-guild-id": "g1",
        },
        body: JSON.stringify(body),
      });
      const secondPayload = (await second.json()) as any;

      expect(second.status).toBe(200);
      expect(secondPayload.idempotent).toBe(true);
      expect(awardCalls).toBe(1);
    } finally {
      server.close();
    }
  });
});
