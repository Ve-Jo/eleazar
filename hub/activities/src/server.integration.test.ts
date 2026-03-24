import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { createActivitiesApp } from "../server.ts";

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

describe("Activities API integration", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "development";
    process.env.SKIP_AUTH = "true";
  });

  afterEach(() => {
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
          economy: { balance: "123.4", bankBalance: "10", bankDistributed: "5", bankRate: "0.02" },
          crates: [{ type: "daily", count: 2 }, { type: "weekly", count: 1 }],
          upgrades: [{ type: "games_earning", level: 3 }],
          stats: { gameWins: 7 },
          Level: { xp: 1000, gameXp: 2000 },
        });
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

      return jsonResponse({ error: `Unhandled fetch URL: ${url}` }, 500);
    }) as typeof fetch;

    try {
      const response = await fetch(`${baseUrl}/api/launcher-data?guildId=g1`, {
        headers: {
          "x-user-id": "u1",
        },
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as any;
      expect(payload.guild?.id).toBe("g1");
      expect(payload.economy?.balance).toBe(123.4);
      expect(payload.games?.find((game: any) => game.id === "2048")?.highScore).toBe(2048);
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
