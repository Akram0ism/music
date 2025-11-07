import { Bot, GrammyError, HttpError, InlineKeyboard } from "grammy";
import { BOT_TOKEN, WEBAPP_URL } from "./config.js";

export const bot = new Bot(BOT_TOKEN);

const hasWebApp = Boolean(WEBAPP_URL);

bot.command("start", async (ctx) => {
  const keyboard = new InlineKeyboard();
  if (hasWebApp) {
    keyboard.webApp("Open WebApp", WEBAPP_URL);
  }
  keyboard.url("Help", "https://core.telegram.org/bots/webapps#initializing-mini-apps");

  const intro = [
    "👋 Welcome!",
    "Send me a file to get its metadata or use inline mode to search the help articles.",
  ];

  if (hasWebApp) {
    intro.push("Tap the button below to launch the connected WebApp.");
  } else {
    intro.push("Configure the WEBAPP_URL environment variable to enable the WebApp button.");
  }

  await ctx.reply(intro.join("\n\n"), {
    reply_markup: keyboard,
  });
});

bot.on(["message:document", "message:photo", "message:audio", "message:video"], async (ctx) => {
  const file = ctx.message.document || ctx.message.photo?.at(-1) || ctx.message.audio || ctx.message.video;
  const { file_unique_id: uniqueId, file_id: fileId, file_name: fileName } = file;
  const caption = [
    "📎 File received!",
    `Unique ID: <code>${uniqueId}</code>`,
    `File ID: <code>${fileId}</code>`,
  ];
  if (fileName) {
    caption.splice(1, 0, `Name: <b>${fileName}</b>`);
  }

  await ctx.reply(caption.join("\n"), { parse_mode: "HTML" });
});

bot.on("inline_query", async (ctx) => {
  const query = ctx.inlineQuery.query.trim().toLowerCase();
  const results = [
    {
      type: "article",
      id: "webapp",
      title: "How to verify WebApp initData",
      description: "Step-by-step instructions for validating Telegram init data.",
      input_message_content: {
        message_text:
          "Use the /start command to open the WebApp and POST the initData payload to /webapp/verify for validation.",
      },
      url: "https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app",
    },
    {
      type: "article",
      id: "files",
      title: "How file uploads are handled",
      description: "Reply with the file identifier after any upload.",
      input_message_content: {
        message_text: "Upload any file to the bot chat and it will respond with its Telegram file_id.",
      },
    },
  ];

  const filtered = query
    ? results.filter((item) =>
        [item.title, item.description].some((text) => text.toLowerCase().includes(query))
      )
    : results;

  await ctx.answerInlineQuery(filtered, { cache_time: 0, is_personal: true });
});

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`, err.error);
  if (err.error instanceof GrammyError) {
    console.error("Error in request:", err.error.description);
  } else if (err.error instanceof HttpError) {
    console.error("Could not contact Telegram:", err.error);
  }
});

export async function configureBot() {
  await bot.api.setMyCommands([
    { command: "start", description: "Get started with the bot" },
  ]);
}
