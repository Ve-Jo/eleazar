import fs from "node:fs";
import path from "node:path";

import express from "express";

import { STATIC_CLIENT_PATH } from "../config.ts";

export function registerStaticRoutes(app: express.Express) {
  if (fs.existsSync(STATIC_CLIENT_PATH)) {
    app.use(express.static(STATIC_CLIENT_PATH));
    app.get(/^\/(?!api|\.proxy|health).*/, (_req, res) => {
      res.sendFile(path.join(STATIC_CLIENT_PATH, "index.html"));
    });
    return;
  }

  app.get("/", (_req, res) => {
    res
      .status(200)
      .send(
        "Activities API is running. Build the activity client with `bun --cwd client run build` to serve the web app from this process."
      );
  });
}
