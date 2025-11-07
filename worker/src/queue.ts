import fetch from "node-fetch";
import { logger } from "./config.js";

export interface DownloadTaskPayload {
  youtubeUrl: string;
  trackId: string;
  outputFormat: string;
  metadata: Record<string, unknown>;
}

export interface QueueTask<TPayload> {
  id: string;
  payload: TPayload;
  attempts: number;
  inserted_at: string;
}

export interface QueueClientConfig {
  queueUrl: string;
  queueName: string;
  serviceRoleKey: string;
  maxAttempts: number;
}

export class QueueClient {
  constructor(private readonly config: QueueClientConfig) {}

  private get baseUrl() {
    const { queueUrl, queueName } = this.config;
    return `${queueUrl}/queue/${queueName}`;
  }

  async claimTask(): Promise<QueueTask<DownloadTaskPayload> | null> {
    const response = await fetch(`${this.baseUrl}/tasks/claim`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.serviceRoleKey}`,
      },
      body: JSON.stringify({
        max_attempts: this.config.maxAttempts,
      }),
    });

    if (response.status === 204) {
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to claim task: ${response.status} ${errorText}`);
    }

    const task = await response.json();
    return task as QueueTask<DownloadTaskPayload>;
  }

  async ackTask(taskId: string, payload: Record<string, unknown>) {
    const response = await fetch(`${this.baseUrl}/tasks/${taskId}/ack`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.serviceRoleKey}`,
      },
      body: JSON.stringify({ payload }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ taskId, errorText }, "Failed to acknowledge task");
    }
  }

  async failTask(taskId: string, error: Error, retryAt?: Date) {
    const response = await fetch(`${this.baseUrl}/tasks/${taskId}/retry`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.serviceRoleKey}`,
      },
      body: JSON.stringify({
        run_at: retryAt?.toISOString(),
        error: {
          message: error.message,
          stack: error.stack,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ taskId, errorText }, "Failed to retry task");
    }
  }
}
