import express from "express";
import { webhookCallback } from "grammy";
import { bot } from "./bot.js";
import { USE_WEBHOOK, WEBHOOK_SECRET_TOKEN } from "./config.js";
import { verifyInitData } from "./webapp.js";

export function createServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/webapp/verify", (req, res) => {
    const { initData } = req.body ?? {};
    const verification = verifyInitData(initData);

    if (!verification.ok) {
      return res.status(400).json({ ok: false, error: verification.reason });
    }

    const data = verification.data;
    if (data?.hash) {
      delete data.hash;
    }

    return res.json({ ok: true, data });
  });

  if (USE_WEBHOOK) {
    app.use("/webhook", webhookCallback(bot, "express", {
      secretToken: WEBHOOK_SECRET_TOKEN,
    }));
  }

  return app;
}
