import { Injectable, Logger } from '@nestjs/common'

export interface RetryConfig {
  maxAttempts: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  retryableStatusCodes?: number[]
}

export interface RetryResult<T> {
  success: boolean
  result?: T
  attempts: number
  lastError?: Error
  errors?: Array<{ attempt: number; error: string; timestamp: string }>
}

@Injectable()
export class RetryService {
  private readonly logger = new Logger(RetryService.name)

  private readonly defaultConfig: RetryConfig = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  }

  /**
   * Executes a function with exponential backoff retry logic
   * @param fn The async function to execute
   * @param config Optional retry configuration
   * @returns Promise resolving to RetryResult with success status, result, attempts count, and last error
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    config?: Partial<RetryConfig>,
  ): Promise<RetryResult<T>> {
    const finalConfig = { ...this.defaultConfig, ...config }
    let lastError: Error | undefined
    let delay = finalConfig.initialDelayMs
    const errors: Array<{ attempt: number; error: string; timestamp: string }> = []

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      try {
        this.logger.log(`Attempt ${attempt}/${finalConfig.maxAttempts} - Executing function`)
        const result = await fn()
        
        if (attempt > 1) {
          this.logger.log(`Attempt ${attempt} succeeded after ${attempt - 1} failed attempt(s)`)
        }

        return {
          success: true,
          result,
          attempts: attempt,
          errors: errors.length > 0 ? errors : undefined,
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        const errorMessage = this.getErrorMessage(error)
        errors.push({
          attempt,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        })
        
        const shouldRetry = this.shouldRetry(error, attempt, finalConfig)
        
        this.logger.warn(
          `Attempt ${attempt}/${finalConfig.maxAttempts} failed: ${errorMessage}`,
          lastError.stack,
        )

        if (!shouldRetry) {
          this.logger.error(
            `Max attempts reached or non-retryable error. Stopping retries after ${attempt} attempt(s)`,
          )
          break
        }

        if (attempt < finalConfig.maxAttempts) {
          this.logger.log(
            `Retrying in ${delay}ms (exponential backoff: attempt ${attempt})`,
          )
          await this.sleep(delay)
          delay = Math.min(delay * finalConfig.backoffMultiplier, finalConfig.maxDelayMs)
        }
      }
    }

    return {
      success: false,
      attempts: finalConfig.maxAttempts,
      lastError,
      errors,
    }
  }

  /**
   * Extracts a meaningful error message from various error types
   * @param error The error object
   * @returns Error message string
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message
    }
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { data?: unknown; status?: number } }
      const status = axiosError.response?.status
      const data = axiosError.response?.data
      if (status) {
        return `HTTP ${status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`
      }
    }
    return String(error)
  }

  /**
   * Determines if an error should trigger a retry
   * @param error The error that occurred
   * @param attempt Current attempt number
   * @param config Retry configuration
   * @returns True if the error should trigger a retry
   */
  private shouldRetry(error: unknown, attempt: number, config: RetryConfig): boolean {
    if (attempt >= config.maxAttempts) {
      return false
    }

    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number } }
      const statusCode = axiosError.response?.status

      if (statusCode && config.retryableStatusCodes?.includes(statusCode)) {
        return true
      }

      if (statusCode && statusCode >= 400 && statusCode < 500 && statusCode !== 408 && statusCode !== 429) {
        return false
      }
    }

    return true
  }

  /**
   * Sleeps for the specified number of milliseconds
   * @param ms Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

