# Music Downloader Infrastructure

This repository contains a Supabase Edge Function and an external worker that collaborate to download tracks from YouTube, convert them to audio files, and upload the results into Supabase Storage while keeping the `tracks` table in sync.

## Overview

1. **Edge Function (`downloadFromYoutube`)** – receives requests with a `youtubeUrl` and `trackId`, validates the payload, and enqueues a job in Supabase Queue. The track is immediately marked as `queued`.
2. **Worker (`worker/`)** – long-running Node.js process that polls the queue, runs `yt-dlp` to download audio, uploads the artifact to Storage, and updates the track row.
3. **Monitoring & Retries** – queue retries are scheduled with exponential backoff, and structured logging (via `pino`) is available in both the Edge Function and worker logs.

## Edge Function

Located at `supabase/functions/downloadFromYoutube/index.ts`, the function expects the following JSON payload:

```json
{
  "youtubeUrl": "https://www.youtube.com/watch?v=...",
  "trackId": "uuid-of-track",
  "outputFormat": "mp3",
  "metadata": {}
}
```

Environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_QUEUE_URL` – e.g. `https://<project-ref>.supabase.co/queue/v1`
- `YTDL_QUEUE_NAME` (optional, defaults to `youtube-downloads`)

The function enqueues the job, returning the queue `jobId` with status code **202**.

## Worker

The worker lives under `worker/` and is designed to run on Render, Fly, or any Node-compatible platform with `yt-dlp` available.

### Requirements

- Node.js 20+
- `yt-dlp` binary available in the container (the `yt-dlp-exec` package bundles it).
- `ffmpeg` binary accessible for audio conversion.

### Configuration

The worker relies on the following environment variables:

| Variable | Description |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for full access |
| `SUPABASE_ANON_KEY` | Optional anon key for public operations |
| `SUPABASE_QUEUE_URL` | Queue base URL, e.g. `https://<project>.supabase.co/queue/v1` |
| `YTDL_QUEUE_NAME` | Queue name, defaults to `youtube-downloads` |
| `STORAGE_BUCKET` | Storage bucket where audio files are stored |
| `QUEUE_POLL_INTERVAL_MS` | Polling interval (default `3000`) |
| `YTDL_MAX_ATTEMPTS` | Maximum automatic retries (default `5`) |
| `LOG_LEVEL` | Pino log level |

### Running locally

```bash
cd worker
npm install
npm run start
```

The worker polls the queue for new tasks. On success it uploads audio to the configured bucket and updates the `tracks` table with `audio_path`, `duration_ms`, `public_url`, and `status = 'ready'`.

Failures trigger an exponential retry (capped at 60 seconds) and mark the track as `failed` with an error message.

## Storage & Database Changes

- The worker uploads files to `tracks/<filename>` within the configured bucket and publishes a public URL.
- The `tracks` table is updated on each state change (`queued`, `processing`, `ready`, `failed`). Ensure these columns exist: `status`, `source_url`, `audio_path`, `duration_ms`, `public_url`, `error_message`, `updated_at`.

## Deployment Notes

- Deploy the Edge Function via `supabase functions deploy downloadFromYoutube`.
- Provision Supabase Queue (`youtube-downloads`) and allow the Edge Function and worker to use the service role key.
- Deploy the worker to Render/Fly with persistent logging; set health checks on the process to restart on crash.
- Monitor via platform logs and Supabase Queue dashboard; adjust retry settings via environment variables as needed.
