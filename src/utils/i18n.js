import i18n from "i18n";
import path from "path";
import fs from "fs";

const localesDir = path.join(__dirname, "../locales");
console.log("Locales directory:", localesDir);

// Check if the directory exists
if (!fs.existsSync(localesDir)) {
  console.error("Locales directory does not exist!");
} else {
  console.log("Available locales:", fs.readdirSync(localesDir));
}

i18n.configure({
  locales: ["ru", "en", "uk"], // Add "uk" here
  defaultLocale: "ru",
  directory: localesDir,
  objectNotation: true,
  updateFiles: false,
  syncFiles: false,
  register: global,
});

console.log("Configured locales:", i18n.getLocales());

export default i18n;
