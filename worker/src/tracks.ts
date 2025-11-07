import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./config.js";

interface TrackUpdateInput {
  trackId: string;
  status: "processing" | "ready" | "failed";
  audioPath?: string;
  durationMs?: number;
  publicUrl?: string;
  errorMessage?: string;
}

export async function updateTrack(
  client: SupabaseClient,
  { trackId, status, audioPath, durationMs, publicUrl, errorMessage }: TrackUpdateInput,
) {
  const updates = {
    status,
    audio_path: audioPath,
    duration_ms: durationMs,
    public_url: publicUrl,
    error_message: errorMessage,
    updated_at: new Date().toISOString(),
  };

  logger.info({ trackId, status }, "Updating track record");
  const { error } = await client.from("tracks").update(updates).eq("id", trackId);

  if (error) {
    logger.error({ trackId, error }, "Failed to update track");
  }
}
