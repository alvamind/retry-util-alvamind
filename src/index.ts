// src/index.ts
import { RetryConfigInterface } from "./interfaces/general.interface";

export class RetryUtil {
  static async withRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfigInterface,
    onRetry?: (attempt: number, error: Error) => void
  ): Promise<T> {
    let lastError: Error;
    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (onRetry) onRetry(attempt, lastError);
        if (attempt === config.maxRetries) break;

        const delay = Math.min(
          config.initialDelay * Math.pow(config.factor, attempt - 1),
          config.maxDelay
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw lastError!;
  }
}
