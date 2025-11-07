import process from "node:process";
import { bot, configureBot } from "./bot.js";
import { createServer } from "./server.js";
import {
  HOST,
  NODE_ENV,
  PORT,
  USE_WEBHOOK,
  WEBHOOK_SECRET_TOKEN,
  WEBHOOK_URL,
} from "./config.js";

async function bootstrap() {
  await configureBot();

  if (USE_WEBHOOK) {
    const app = createServer();

    const dropPendingUpdates = NODE_ENV !== "development";
    await bot.api.setWebhook(WEBHOOK_URL, {
      secret_token: WEBHOOK_SECRET_TOKEN,
      drop_pending_updates: dropPendingUpdates,
    });

    return new Promise((resolve) => {
      app.listen(PORT, HOST, () => {
        console.log(
          `Webhook server is running on http://${HOST}:${PORT}. Waiting for Telegram updates…`
        );
        console.log(`Webhook URL: ${WEBHOOK_URL}`);
        resolve();
      });
    });
  }

  await bot.api.deleteWebhook({ drop_pending_updates: false }).catch(() => undefined);
  console.log("Running in long polling mode. Press Ctrl+C to stop.");
  await bot.start({ drop_pending_updates: false });
}

bootstrap().catch((error) => {
  console.error("Failed to launch the bot", error);
  process.exit(1);
});
