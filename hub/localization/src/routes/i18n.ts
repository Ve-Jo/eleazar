import express from "express";
import i18n from "../i18n.ts";

const router = express.Router();

type I18nRequest = {
  body: Record<string, unknown>;
  query: Record<string, string | undefined>;
};

type I18nResponse = {
  status: (code: number) => I18nResponse;
  json: (body: unknown) => I18nResponse;
};

// Get translation
router.get("/translate", async (req: I18nRequest, res: I18nResponse) => {
  const { key, locale, variables } = req.query;
  try {
    const vars = variables ? JSON.parse(variables as string) : {};
    const translation = await i18n.__(key as string, vars, locale as string);
    res.json({ translation });
  } catch (error) {
    res.status(400).json({ error: "Invalid request" });
  }
});

// Register localizations
router.post("/register", (req: I18nRequest, res: I18nResponse) => {
  const category = typeof req.body.category === "string" ? req.body.category : "";
  const name = typeof req.body.name === "string" ? req.body.name : "";
  const localizations =
    req.body.localizations && typeof req.body.localizations === "object"
      ? (req.body.localizations as Record<string, unknown>)
      : {};
  const save = req.body.save === true;
  i18n.registerLocalizations(category, name, localizations, save);
  res.json({ success: true });
});

// Add single translation
router.post("/add", (req: I18nRequest, res: I18nResponse) => {
  const locale = typeof req.body.locale === "string" ? req.body.locale : "";
  const key = typeof req.body.key === "string" ? req.body.key : "";
  const value = req.body.value;
  const save = req.body.save === true;
  i18n.addTranslation(locale, key, value, save);
  res.json({ success: true });
});

// Get translation group
router.get("/group", (req: I18nRequest, res: I18nResponse) => {
  const { groupKey, locale } = req.query;
  const group = i18n.getTranslationGroup(groupKey as string, locale as string);
  res.json({ group });
});

// Save all translations
router.post("/save-all", (_req: I18nRequest, res: I18nResponse) => {
  i18n.saveAllTranslations();
  res.json({ success: true });
});

// Set locale
router.post("/set-locale", (req: I18nRequest, res: I18nResponse) => {
  const locale = typeof req.body.locale === "string" ? req.body.locale : undefined;
  const newLocale = i18n.setLocale(locale);
  res.json({ locale: newLocale });
});

// Get current locale
router.get("/locale", (_req: I18nRequest, res: I18nResponse) => {
  res.json({ locale: i18n.getLocale() });
});

// Get supported locales
router.get("/locales", (_req: I18nRequest, res: I18nResponse) => {
  res.json({ locales: i18n.getLocales() });
});

export default router;
