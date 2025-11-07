import { tmpdir } from "node:os";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { logger } from "./config.js";
import ytDlp from "yt-dlp-exec";
import { parseFile } from "music-metadata";

export interface DownloadResult {
  filePath: string;
  contentType: string;
  durationMs?: number;
  workdir: string;
}

export async function downloadAudio(
  youtubeUrl: string,
  outputFormat: string,
): Promise<DownloadResult> {
  const tmpBase = await mkdtemp(join(tmpdir(), "ytdl-"));
  const outputTemplate = join(tmpBase, `${randomUUID()}.%(ext)s`);

  logger.info({ youtubeUrl, outputFormat }, "Starting yt-dlp download");
  const result = await ytDlp(youtubeUrl, {
    output: outputTemplate,
    extractAudio: true,
    audioFormat: outputFormat,
    audioQuality: "0",
    quiet: true,
    noWarnings: true,
    preferFreeFormats: false,
  });

  logger.info({ stdout: result.stdout }, "yt-dlp completed");

  const files = await readdir(tmpBase);
  const firstFile = files.length > 0 ? join(tmpBase, files[0]) : undefined;
  if (!firstFile) {
    throw new Error("yt-dlp did not produce an output file");
  }

  const metadata = await parseFile(firstFile).catch((error) => {
    logger.warn({ error }, "Failed to parse metadata");
    return undefined;
  });

  const contentType = detectContentType(firstFile, outputFormat);

  return {
    filePath: firstFile,
    contentType,
    durationMs: metadata?.format.duration
      ? Math.round(metadata.format.duration * 1000)
      : undefined,
    workdir: tmpBase,
  };
}

export async function cleanup(path: string) {
  await rm(path, { recursive: true, force: true });
}

function detectContentType(filePath: string, format: string) {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext ?? format) {
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "opus":
      return "audio/opus";
    case "flac":
      return "audio/flac";
    default:
      return "application/octet-stream";
  }
}
