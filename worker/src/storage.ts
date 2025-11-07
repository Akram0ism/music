import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { EnvironmentConfig } from "./config.js";
import { logger } from "./config.js";

export interface UploadResult {
  objectPath: string;
  publicUrl?: string;
}

export function createSupabaseClient(config: EnvironmentConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false },
    global: { headers: { "X-Client-Info": "youtube-downloader-worker" } },
  });
}

export async function uploadToStorage(
  client: SupabaseClient,
  bucket: string,
  filePath: string,
  contentType: string,
): Promise<UploadResult> {
  const fileBuffer = await readFile(filePath);
  const filename = basename(filePath);
  const objectPath = `tracks/${filename}`;

  logger.info({ bucket, objectPath }, "Uploading file to storage");
  const { error } = await client.storage.from(bucket).upload(objectPath, fileBuffer, {
    cacheControl: "3600",
    upsert: true,
    contentType,
  });

  if (error) {
    throw error;
  }

  const { data } = client.storage.from(bucket).getPublicUrl(objectPath);
  return {
    objectPath,
    publicUrl: data.publicUrl,
  };
}
