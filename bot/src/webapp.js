import crypto from "node:crypto";
import { BOT_TOKEN } from "./config.js";

const WEB_APP_DATA = "WebAppData";

export function buildDataCheckString(params) {
  return Array.from(params.entries())
    .filter(([key]) => key !== "hash")
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
}

export function calculateInitDataHash(dataCheckString) {
  const secret = crypto.createHmac("sha256", WEB_APP_DATA).update(BOT_TOKEN).digest();
  return crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
}

export function verifyInitData(initData) {
  if (!initData) {
    return { ok: false, reason: "initData payload is empty" };
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");

  if (!hash) {
    return { ok: false, reason: "hash is missing from initData" };
  }

  const dataCheckString = buildDataCheckString(params);
  const calculated = calculateInitDataHash(dataCheckString);

  if (calculated !== hash) {
    return { ok: false, reason: "Hash mismatch" };
  }

  return { ok: true, data: Object.fromEntries(params.entries()) };
}
