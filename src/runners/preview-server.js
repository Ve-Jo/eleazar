import express from "express";
import chokidar from "chokidar";
import path from "path";
import { fileURLToPath } from "url";
import { generateImage } from "../utils/imageGenerator.js";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const COMPONENTS_DIR = path.join(__dirname, "..", "components");

console.log(COMPONENTS_DIR);

app.get("/:componentName", async (req, res) => {
  const { componentName } = req.params;
  const componentPath = path.join(COMPONENTS_DIR, `${componentName}.jsx`);

  if (!fs.existsSync(componentPath)) {
    return res.status(404).send(`Component ${componentName} not found`);
  }

  try {
    const { default: Component } = await import(
      `file://${componentPath}?update=${Date.now()}`
    );

    const pngBuffer = await generateImage(Component, { debug: true });

    res.writeHead(200, {
      "Content-Type": "image/png",
      "Content-Length": pngBuffer.length,
    });
    res.end(pngBuffer);
  } catch (error) {
    console.error(`Error rendering ${componentName}:`, error);
    res.status(500).send(`Error rendering ${componentName}`);
  }
});

app.listen(3000, () => {
  console.log("Preview server running on http://localhost:3000");
});

chokidar.watch(COMPONENTS_DIR).on("all", (event, changedPath) => {
  console.log(`${changedPath} has changed.`);
  Object.keys(require.cache).forEach(function (key) {
    delete require.cache[key];
  });
});
