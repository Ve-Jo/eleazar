import i18n from "i18n";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesDir = path.join(__dirname, "../locales");

i18n.configure({
  locales: ["en", "ru", "uk"],
  defaultLocale: "en",
  directory: localesDir,
  objectNotation: true,
  updateFiles: false,
  syncFiles: false,
  register: global,
  api: {
    __: "t",
    __n: "tn",
  },
  missingKeyFn: function (locale, value) {
    return undefined;
  },
});

export default i18n;
