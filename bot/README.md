# Telegram Bot Setup

This folder contains a baseline Telegram bot built with [grammY](https://grammy.dev/) and Express. It exposes webhook and WebApp verification endpoints and demonstrates handlers for `/start`, file uploads, and inline queries.

## 1. Register the bot and obtain a token
1. Open Telegram and start a chat with [@BotFather](https://t.me/BotFather).
2. Send `/newbot` and follow the prompts to name your bot and receive the `BOT_TOKEN`.
3. Save the token – you will need it in the `.env` file.

> **Note**: Bot registration must be performed manually via Telegram. The development environment used for this repository has no network access to interact with BotFather automatically.

## 2. Configure the project
1. Duplicate `.env.example` as `.env` and fill in the variables:
   - `BOT_TOKEN`: token received from BotFather.
   - `WEBAPP_URL`: public URL of the WebApp to open from the `/start` button.
   - `WEBHOOK_URL`: public HTTPS endpoint that Telegram should call. Leave empty to use long polling locally.
   - `WEBHOOK_SECRET_TOKEN`: optional secret for validating webhook requests.
2. Install dependencies:
   ```bash
   cd bot
   npm install
   ```
   If direct access to the npm registry is restricted, configure an offline cache or private mirror before running the command.

## 3. Run locally
When `WEBHOOK_URL` is empty, the bot uses long polling.

```bash
npm run dev
```

The `/start` command responds with:
- A greeting message.
- A WebApp button (when `WEBAPP_URL` is configured).
- A link to Telegram's WebApp documentation.

File uploads (documents, photos, audio, videos) are acknowledged with their `file_id` and `file_unique_id`. Inline queries return quick help articles about file handling and WebApp verification.

### WebApp verification endpoint
The bot exposes `POST /webapp/verify`, which expects a JSON payload such as:

```json
{
  "initData": "query_id=...&user=...&hash=..."
}
```

It validates the payload using the bot token following Telegram's [verification guide](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app) and returns either an error or the parsed data (excluding the `hash`).

## 4. Switch to webhook mode
1. Ensure `WEBHOOK_URL` is set in `.env`.
2. Run `npm start` (or redeploy your hosting platform). The server will automatically:
   - Register the webhook URL with Telegram.
   - Start an Express server with:
     - `POST /webhook` – Telegram webhook endpoint (optionally protected with `WEBHOOK_SECRET_TOKEN`).
     - `POST /webapp/verify` – WebApp `initData` verification.
     - `GET /health` – simple health probe.

## 5. Deploy to Supabase Edge Functions
1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) and log in.
2. Create a new function:
   ```bash
   supabase functions new telegram-webhook
   ```
3. Replace the generated `supabase/functions/telegram-webhook/index.ts` with a handler that forwards the request body to your bot server (or re-implements the bot using the [grammY Deno adapter](https://grammy.dev/guide/deployment-types/supabase.html)). A minimal example:
   ```ts
   // supabase/functions/telegram-webhook/index.ts
   import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

   const BOT_ENDPOINT = Deno.env.get("BOT_ENDPOINT");

   if (!BOT_ENDPOINT) {
     throw new Error("BOT_ENDPOINT is not set");
   }

   serve(async (req) => {
     const secret = req.headers.get("x-telegram-bot-api-secret-token");
     const resp = await fetch(BOT_ENDPOINT, {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
         "x-telegram-bot-api-secret-token": secret ?? "",
       },
       body: await req.text(),
     });

     return new Response(await resp.text(), {
       status: resp.status,
       headers: { "Content-Type": "application/json" },
     });
   });
   ```
4. Deploy the function:
   ```bash
   supabase functions deploy telegram-webhook --project-ref YOUR_PROJECT_REF
   ```
5. Set the `WEBHOOK_URL` to the invoke URL shown after deployment (e.g., `https://YOUR_PROJECT.functions.supabase.co/telegram-webhook`).
6. Redeploy or restart the bot server so it registers the new webhook URL with Telegram.

> Alternative hosting: any HTTPS platform (Railway, Fly.io, Render, Cloudflare Workers, etc.) can be used. Ensure the `/webhook` route is reachable and stable, then set `WEBHOOK_URL` accordingly.

## 6. Inline mode activation
Inline queries require enabling inline mode with BotFather:
1. Send `/setinline` to BotFather.
2. Choose your bot and provide a placeholder description.
3. Optionally set the inline placeholder text with `/setinlineplaceholder`.

After activation, typing `@your_bot_name query` in any chat will return the inline results configured in `src/bot.js`.

## 7. Next steps
- Add persistence (database) to keep track of uploaded files.
- Secure the WebApp verification endpoint behind your own authentication if needed.
- Expand inline results with dynamic content fetched from your application.
