import pino from "pino";

export interface EnvironmentConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  supabaseAnonKey?: string;
  storageBucket: string;
  queueUrl: string;
  queueName: string;
  pollIntervalMs: number;
  maxAttempts: number;
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: undefined,
  transport: process.env.NODE_ENV === "production"
    ? undefined
    : {
        target: "pino-pretty",
        options: { colorize: true },
      },
});

export function loadConfig(): EnvironmentConfig {
  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_ANON_KEY,
    STORAGE_BUCKET,
    SUPABASE_QUEUE_URL,
    YTDL_QUEUE_NAME,
    QUEUE_POLL_INTERVAL_MS,
    YTDL_MAX_ATTEMPTS,
  } = process.env;

  if (!SUPABASE_URL) throw new Error("SUPABASE_URL is required");
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  if (!STORAGE_BUCKET) throw new Error("STORAGE_BUCKET is required");
  if (!SUPABASE_QUEUE_URL) throw new Error("SUPABASE_QUEUE_URL is required");

  return {
    supabaseUrl: SUPABASE_URL,
    supabaseServiceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
    supabaseAnonKey: SUPABASE_ANON_KEY,
    storageBucket: STORAGE_BUCKET,
    queueUrl: SUPABASE_QUEUE_URL.replace(/\/$/, ""),
    queueName: YTDL_QUEUE_NAME ?? "youtube-downloads",
    pollIntervalMs: Number(QUEUE_POLL_INTERVAL_MS ?? "3000"),
    maxAttempts: Number(YTDL_MAX_ATTEMPTS ?? "5"),
  };
}
