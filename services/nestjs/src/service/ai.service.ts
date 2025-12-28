import { Injectable, NotFoundException, Logger } from '@nestjs/common'
import { PrismaService } from './prisma.service'
import axios from 'axios'
import { GenerationStatus } from '../constants/generation-status.enum'
import { RetryService } from './retry.service'

/**
 * AiService handles image generation requests and manages generation lifecycle.
 * It integrates with the mock AI server using retry logic with exponential backoff
 * to handle transient failures. All retry attempts and errors are tracked in the database.
 *
 * @example
 * ```typescript
 * constructor(private readonly aiService: AiService) {}
 *
 * const result = await this.aiService.generateImage('A beautiful sunset')
 * const generation = await this.aiService.findGenerationById(result.generationId)
 * ```
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)
  private readonly mockAiUrl = 'http://mock-ai:3001'

  /**
   * Creates an instance of AiService.
   * @param prisma - PrismaService instance for database operations
   * @param retryService - RetryService instance for handling retry logic with exponential backoff
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly retryService: RetryService,
  ) {}

  /**
   * Updates the generation status and related metadata in the database.
   * @param generationId - Unique identifier of the generation record
   * @param status - New generation status (PENDING, COMPLETE, or FAILED)
   * @param imageUrl - Optional URL of the generated image (only set when status is COMPLETE)
   * @param retryAttempts - Optional number of retry attempts made
   * @param lastRetryAt - Optional timestamp of the last retry attempt
   * @param retryErrors - Optional array of error details from retry attempts
   * @private
   */
  private async updateGenerationStatus(
    generationId: string,
    status: GenerationStatus,
    imageUrl?: string,
    retryAttempts?: number,
    lastRetryAt?: Date,
    retryErrors?: unknown[],
  ) {
    await this.prisma.generations.update({
      where: { generationId },
      data: {
        generationStatus: status,
        imageUrl,
        ...(retryAttempts !== undefined && { retryAttempts }),
        ...(lastRetryAt !== undefined && { lastRetryAt }),
        ...(retryErrors !== undefined && { retryErrors: retryErrors as any }),
      },
    })
  }

  /**
   * Processes image generation by calling the AI server with retry logic.
   * Uses exponential backoff retry strategy (3 attempts max) and tracks all retry attempts
   * and errors in the database. Updates generation status to COMPLETE on success or FAILED on failure.
   *
   * @param prompt - Text prompt describing the image to generate
   * @param generationId - Unique identifier of the generation record
   * @returns Promise resolving to the image URL on successful generation
   * @throws Error if all retry attempts fail
   * @private
   */
  private async processImageGeneration(prompt: string, generationId: string): Promise<string> {
    const retryResult = await this.retryService.executeWithRetry(
      async () => {
        this.logger.log(
          `Processing image generation for generationId: ${generationId}, prompt: ${prompt.substring(0, 50)}...`,
        )
        this.logger.debug(`Calling AI server at ${this.mockAiUrl}/generate`)

        const response = await axios.post(`${this.mockAiUrl}/generate`, {
          prompt,
          generationId,
        })

        this.logger.log(
          `Successfully received image URL for generationId: ${generationId}`,
        )
        return response.data.imageUrl
      },
      {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
      },
    )

    if (!retryResult.success) {
      const errorMessage = retryResult.lastError?.message || 'Unknown error'
      this.logger.error(
        `Image generation failed after ${retryResult.attempts} attempts for generationId: ${generationId}`,
        retryResult.lastError?.stack,
      )

      await this.updateGenerationStatus(
        generationId,
        GenerationStatus.FAILED,
        undefined,
        retryResult.attempts,
        new Date(),
        retryResult.errors,
      )

      throw retryResult.lastError || new Error(errorMessage)
    }

    if (retryResult.attempts > 1) {
      this.logger.warn(
        `Image generation succeeded after ${retryResult.attempts} attempts for generationId: ${generationId}`,
      )
    }

    await this.updateGenerationStatus(
      generationId,
      GenerationStatus.COMPLETE,
      retryResult.result,
      retryResult.attempts > 1 ? retryResult.attempts - 1 : 0,
      retryResult.attempts > 1 ? new Date() : undefined,
      retryResult.errors && retryResult.errors.length > 0 ? retryResult.errors : undefined,
    )

    return retryResult.result!
  }

  /**
   * Initiates an image generation request.
   * Creates a generation record in the database and starts background processing.
   * Returns immediately with the generationId, while image generation happens asynchronously.
   *
   * @param prompt - Text prompt describing the image to generate (max 1500 characters)
   * @returns Promise resolving to an object containing the generationId
   * @throws Error if generation record creation fails
   *
   * @example
   * ```typescript
   * const result = await aiService.generateImage('A beautiful sunset over mountains')
   * console.log(result.generationId) // UUID of the generation
   * ```
   */
  async generateImage(prompt: string) {
    try {
      const generation = await this.prisma.generations.create({
        data: {
          prompt,
          imageHeight: 1024,
          imageWidth: 1024,
          coreModel: 'SDXL',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })

      const generationId = generation.generationId
      this.logger.log(`Created generation with generationId: ${generationId}`)

      Promise.resolve().then(async () => {
        try {
          await this.processImageGeneration(prompt, generationId)
        } catch (error) {
          this.logger.error(
            `Background processing failed for generationId: ${generationId}`,
            error instanceof Error ? error.stack : undefined,
          )
        }
      })

      // Return the generationId immediately
      return { generationId }
    } catch (error) {
      throw new Error(`Failed to initiate image generation: ${error}`)
    }
  }

  /**
   * Retrieves a generation record by its unique identifier.
   * Returns generation status, prompt, and imageUrl (imageUrl is only present if status is COMPLETE).
   *
   * @param id - Unique generation identifier (UUID)
   * @returns Promise resolving to generation details including status, prompt and imageUrl
   * @throws NotFoundException if the generation record is not found
   *
   * @example
   * ```typescript
   * const generation = await aiService.findGenerationById('123e4567-e89b-12d3-a456-426614174000')
   * console.log(generation.generationStatus) // 'PENDING', 'COMPLETE', or 'FAILED'
   * console.log(generation.imageUrl) // Only present if status is 'COMPLETE'
   * console.log(generation.prompt) // Text prompt describing the image to generate
   * ```
   */
  async findGenerationById(id: string) {
    this.logger.debug(`Finding generation by id: ${id}`)
    try {
      const generations = await this.prisma.generations.findUnique({
        select: {
          generationStatus: true,
          prompt: true,
          imageUrl: true,
        },
        where: { generationId: id },
      })

      if (!generations) {
        throw new NotFoundException(`Data not found`)
      }

      if (generations.generationStatus !== GenerationStatus.COMPLETE) {
        delete generations.imageUrl
      }

      return generations
    } catch (error) {
      this.logger.error(`Error finding generation by id: ${id}`, error instanceof Error ? error.stack : undefined)
      throw new NotFoundException(`Data not found`)
    }
  }
}
