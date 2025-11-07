import { setTimeout as delay } from "node:timers/promises";
import { loadConfig, logger } from "./config.js";
import { QueueClient } from "./queue.js";
import { cleanup, downloadAudio } from "./downloader.js";
import { createSupabaseClient, uploadToStorage } from "./storage.js";
import { updateTrack } from "./tracks.js";

async function main() {
  const config = loadConfig();
  const supabase = createSupabaseClient(config);
  const queue = new QueueClient({
    queueUrl: config.queueUrl,
    queueName: config.queueName,
    serviceRoleKey: config.supabaseServiceRoleKey,
    maxAttempts: config.maxAttempts,
  });

  logger.info({ queue: config.queueName }, "Worker booted");

  while (true) {
    try {
      const task = await queue.claimTask();
      if (!task) {
        await delay(config.pollIntervalMs);
        continue;
      }

      logger.info({ taskId: task.id, trackId: task.payload.trackId }, "Processing task");
      await updateTrack(supabase, {
        trackId: task.payload.trackId,
        status: "processing",
      });

      let download: Awaited<ReturnType<typeof downloadAudio>> | undefined;
      try {
        download = await downloadAudio(task.payload.youtubeUrl, task.payload.outputFormat);
        const upload = await uploadToStorage(
          supabase,
          config.storageBucket,
          download.filePath,
          download.contentType,
        );

        await updateTrack(supabase, {
          trackId: task.payload.trackId,
          status: "ready",
          audioPath: upload.objectPath,
          durationMs: download.durationMs,
          publicUrl: upload.publicUrl,
        });

        await queue.ackTask(task.id, {
          audioPath: upload.objectPath,
          durationMs: download.durationMs,
        });
        logger.info({ taskId: task.id }, "Task completed successfully");
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error({ taskId: task.id, err }, "Task failed");

        await updateTrack(supabase, {
          trackId: task.payload.trackId,
          status: "failed",
          errorMessage: err.message,
        });

        const attempts = task.attempts ?? 0;
        const retryDelay = Math.min(60_000, 2 ** attempts * 1_000);
        await queue.failTask(task.id, err, new Date(Date.now() + retryDelay));
      } finally {
        if (download) {
          await cleanup(download.workdir).catch((cleanupError) => {
            logger.warn({ cleanupError }, "Failed to cleanup temp directory");
          });
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ err }, "Unexpected worker error");
      await delay(config.pollIntervalMs);
    }
  }
}

main().catch((error) => {
  logger.fatal({ error }, "Worker crashed");
  process.exit(1);
});
