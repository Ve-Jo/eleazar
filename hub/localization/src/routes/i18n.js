import express from 'express';
import i18n from '../i18n.js';

const router = express.Router();

// Get translation
router.get('/translate', async (req, res) => {
  const { key, locale, variables } = req.query;
  try {
    const vars = variables ? JSON.parse(variables) : {};
    const translation = await i18n.__(key, vars, locale);
    res.json({ translation });
  } catch (error) {
    res.status(400).json({ error: 'Invalid request' });
  }
});

// Register localizations
router.post('/register', (req, res) => {
  const { category, name, localizations, save } = req.body;
  i18n.registerLocalizations(category, name, localizations, save);
  res.json({ success: true });
});

// Add single translation
router.post('/add', (req, res) => {
  const { locale, key, value, save } = req.body;
  i18n.addTranslation(locale, key, value, save);
  res.json({ success: true });
});

// Get translation group
router.get('/group', (req, res) => {
  const { groupKey, locale } = req.query;
  const group = i18n.getTranslationGroup(groupKey, locale);
  res.json({ group });
});

// Save all translations
router.post('/save-all', (req, res) => {
  i18n.saveAllTranslations();
  res.json({ success: true });
});

// Set locale
router.post('/set-locale', (req, res) => {
  const { locale } = req.body;
  const newLocale = i18n.setLocale(locale);
  res.json({ locale: newLocale });
});

// Get current locale
router.get('/locale', (req, res) => {
  res.json({ locale: i18n.getLocale() });
});

// Get supported locales
router.get('/locales', (req, res) => {
  res.json({ locales: i18n.getLocales() });
});

export default router;