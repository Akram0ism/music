import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

interface DownloadRequestBody {
  youtubeUrl?: string;
  trackId?: string;
  outputFormat?: "mp3" | "m4a" | "opus" | "flac";
  metadata?: Record<string, unknown>;
}

interface QueueResponse {
  id: string;
  status: string;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const queueUrl = Deno.env.get("SUPABASE_QUEUE_URL");
const queueName = Deno.env.get("YTDL_QUEUE_NAME") ?? "youtube-downloads";

if (!supabaseUrl) {
  console.error("Missing SUPABASE_URL env");
}
if (!serviceRoleKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY env");
}
if (!queueUrl) {
  console.error("Missing SUPABASE_QUEUE_URL env");
}

const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  : undefined;

async function enqueueDownloadJob(payload: Required<DownloadRequestBody>): Promise<QueueResponse> {
  if (!queueUrl || !serviceRoleKey) {
    throw new Error("Queue configuration is not available");
  }

  const response = await fetch(`${queueUrl.replace(/\/$/, "")}/queue/${queueName}/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      payload,
      max_attempts: 5,
      run_at: new Date().toISOString(),
      ttl: 60 * 60 * 24,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to enqueue job", response.status, errorText);
    throw new Response(JSON.stringify({ error: "Failed to enqueue job", details: errorText }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = await response.json();
  return result as QueueResponse;
}

async function markTrackQueued(trackId: string, youtubeUrl: string) {
  if (!supabase) return;

  const { error } = await supabase
    .from("tracks")
    .update({
      status: "queued",
      source_url: youtubeUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", trackId);

  if (error) {
    console.error("Failed to mark track as queued", error);
  }
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        "Allow": "POST",
      },
    });
  }

  let body: DownloadRequestBody;
  try {
    body = await req.json();
  } catch (_error) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.youtubeUrl) {
    return new Response(JSON.stringify({ error: "youtubeUrl is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.trackId) {
    return new Response(JSON.stringify({ error: "trackId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload: Required<DownloadRequestBody> = {
    youtubeUrl: body.youtubeUrl,
    trackId: body.trackId,
    outputFormat: body.outputFormat ?? "mp3",
    metadata: body.metadata ?? {},
  };

  try {
    const job = await enqueueDownloadJob(payload);
    await markTrackQueued(payload.trackId, payload.youtubeUrl);

    return new Response(JSON.stringify({
      jobId: job.id,
      status: job.status,
      trackId: payload.trackId,
    }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("Unexpected error while enqueuing download", error);
    return new Response(JSON.stringify({ error: "Failed to enqueue download" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
