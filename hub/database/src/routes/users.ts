import express from "express";
import Database from "../client.ts";
import { serializeBigInt } from "../utils/serialization.ts";
import type { RequestLike, ResponseLike } from "../types/http.ts";

const router = express.Router();

type UsersRouteRequest = RequestLike & {
  params: Record<string, string>;
  body: Record<string, unknown>;
};

type UserProfileShape = {
  realName?: unknown;
  age?: unknown;
  gender?: unknown;
  countryCode?: unknown;
  pronouns?: unknown;
  locale?: unknown;
};

router.post("/ensure", async (req: UsersRouteRequest, res: ResponseLike) => {
  try {
    const userId = typeof req.body.userId === "string" ? req.body.userId : "";
    const guildId = typeof req.body.guildId === "string" ? req.body.guildId : "";

    if (!userId || !guildId) {
      return res.status(400).json({ error: "userId and guildId are required" });
    }

    const user = await Database.ensureUser(guildId, userId);
    res.json(serializeBigInt(user));
  } catch (error) {
    console.error("Error ensuring user:", error);
    res.status(500).json({ error: "Failed to ensure user" });
  }
});

router.get("/:guildId/:userId", async (req: UsersRouteRequest, res: ResponseLike) => {
  try {
    const userId = req.params.userId ?? "";
    const guildId = req.params.guildId ?? "";

    if (!userId || !guildId) {
      return res.status(400).json({ error: "userId and guildId are required" });
    }

    const user = await Database.getUser(guildId, userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(serializeBigInt(user));
  } catch (error) {
    console.error("Error getting user:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

router.patch("/:guildId/:userId", async (req: UsersRouteRequest, res: ResponseLike) => {
  try {
    const userId = req.params.userId ?? "";
    const guildId = req.params.guildId ?? "";
    const updateData = req.body;

    if (!userId || !guildId) {
      return res.status(400).json({ error: "userId and guildId are required" });
    }

    const user = await Database.updateUser(guildId, userId, updateData);
    res.json(serializeBigInt(user));
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.get("/:guildId/:userId/locale", async (req: UsersRouteRequest, res: ResponseLike) => {
  try {
    const userId = req.params.userId ?? "";
    const guildId = req.params.guildId ?? "";

    if (!userId || !guildId) {
      return res.status(400).json({ error: "userId and guildId are required" });
    }

    await Database.ensureGuildUser(guildId, userId);
    const locale = await Database.getUserLocale(guildId, userId);
    res.json({ locale });
  } catch (error) {
    console.error("Error getting user locale:", error);
    res.json({ locale: null });
  }
});

router.put("/:guildId/:userId/locale", async (req: UsersRouteRequest, res: ResponseLike) => {
  try {
    const userId = req.params.userId ?? "";
    const guildId = req.params.guildId ?? "";
    const locale = typeof req.body.locale === "string" ? req.body.locale : "";

    if (!userId || !guildId || !locale) {
      return res.status(400).json({ error: "guildId, userId, and locale are required" });
    }

    await Database.ensureGuildUser(guildId, userId);
    await Database.setUserLocale(guildId, userId, locale);
    res.json({ success: true });
  } catch (error) {
    console.error("Error setting user locale:", error);
    res.status(500).json({ error: "Failed to set user locale" });
  }
});

router.get("/:guildId/:userId/notifications/status", async (req: UsersRouteRequest, res: ResponseLike) => {
  try {
    const userId = req.params.userId ?? "";
    const guildId = req.params.guildId ?? "";

    if (!userId || !guildId) {
      return res.status(400).json({ error: "userId and guildId are required" });
    }

    const status = await Database.getUserNotificationStatus(guildId, userId);
    res.json(serializeBigInt(status));
  } catch (error) {
    console.error("Error getting user notification status:", error);
    res.status(500).json({ error: "Failed to get user notification status" });
  }
});

router.get("/:guildId/:userId/profile", async (req: UsersRouteRequest, res: ResponseLike) => {
  try {
    const userId = req.params.userId ?? "";
    const guildId = req.params.guildId ?? "";

    if (!userId || !guildId) {
      return res.status(400).json({ error: "userId and guildId are required" });
    }

    await Database.ensureGuildUser(guildId, userId);
    const user = (await Database.getUser(guildId, userId)) as UserProfileShape | null;

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const profile = {
      realName: user.realName,
      age: user.age,
      gender: user.gender,
      countryCode: user.countryCode,
      pronouns: user.pronouns,
      locale: user.locale,
    };

    res.json(serializeBigInt(profile));
  } catch (error) {
    console.error("Error getting user profile:", error);
    res.status(500).json({ error: "Failed to get user profile" });
  }
});

router.patch("/:guildId/:userId/profile", async (req: UsersRouteRequest, res: ResponseLike) => {
  try {
    const userId = req.params.userId ?? "";
    const guildId = req.params.guildId ?? "";
    const profileData = req.body;

    if (!userId || !guildId) {
      return res.status(400).json({ error: "userId and guildId are required" });
    }

    const allowedFields = [
      "realName",
      "age",
      "gender",
      "countryCode",
      "pronouns",
      "locale",
    ] as const;
    const updateData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (profileData[field] !== undefined) {
        updateData[field] = profileData[field];
      }
    }

    await Database.ensureGuildUser(guildId, userId);
    const user = (await Database.updateUser(guildId, userId, updateData)) as UserProfileShape;

    const profile = {
      realName: user.realName,
      age: user.age,
      gender: user.gender,
      countryCode: user.countryCode,
      pronouns: user.pronouns,
      locale: user.locale,
    };

    res.json(serializeBigInt(profile));
  } catch (error) {
    console.error("Error updating user profile:", error);
    res.status(500).json({ error: "Failed to update user profile" });
  }
});

export default router;
