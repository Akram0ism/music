import dotenv from "dotenv";
import process from "node:process";

dotenv.config();

export const NODE_ENV = process.env.NODE_ENV ?? "production";
export const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error(
    "BOT_TOKEN is not defined. Create a .env file based on .env.example and provide your Telegram bot token."
  );
}

export const WEBHOOK_URL = process.env.WEBHOOK_URL ?? "";
export const WEBHOOK_SECRET_TOKEN = process.env.WEBHOOK_SECRET_TOKEN || undefined;
export const WEBAPP_URL = process.env.WEBAPP_URL ?? "";
export const HOST = process.env.HOST ?? "0.0.0.0";
export const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);
export const USE_WEBHOOK = Boolean(WEBHOOK_URL);
