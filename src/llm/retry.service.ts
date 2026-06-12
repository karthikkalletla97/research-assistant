import { Injectable } from '@nestjs/common';

@Injectable()
export class RetryService {
  /**
   * Execute function with exponential backoff retry
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 100,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${maxRetries}`);
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`Attempt ${attempt} failed: ${lastError.message}`);

        // Don't wait after last attempt
        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s, 8s...
          const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
          console.log(`Waiting ${delayMs}ms before retry...`);
          await this.sleep(delayMs);
        }
      }
    }

    throw new Error(
      `Failed after ${maxRetries} retries: ${lastError?.message}`,
    );
  }

  /**
   * Sleep for ms milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
