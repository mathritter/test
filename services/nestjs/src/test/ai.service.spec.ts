import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { AiService } from '../service/ai.service'
import { RetryService } from '../service/retry.service'
import { PrismaService } from '../service/prisma.service'
import { GenerationStatus } from '../constants/generation-status.enum'
import axios from 'axios'

jest.mock('axios')

const prismaMock = {
  generations: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $disconnect: jest.fn(),
  $connect: jest.fn(),
}

const retryServiceMock = {
  executeWithRetry: jest.fn(),
}

describe('AiService', () => {
  let service: AiService
  let retryService: RetryService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: RetryService,
          useValue: retryServiceMock,
        },
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: AiService,
          useFactory: (prisma: PrismaService, retryService: RetryService) => {
            return new AiService(prisma, retryService)
          },
          inject: [PrismaService, RetryService],
        },
      ],
    }).compile()

    service = module.get<AiService>(AiService)
    retryService = module.get<RetryService>(RetryService)
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.useRealTimers()
  })

  describe('generateImage', () => {
    it('should create a generation and return generationId', async () => {
      const mockGeneration = {
        id: 'test-id',
        generationId: 'test-generation-id',
        prompt: 'test prompt',
        imageHeight: 1024,
        imageWidth: 1024,
        coreModel: 'SDXL',
        createdAt: new Date(),
        updatedAt: new Date(),
        public: true,
        flagged: false,
        nsfw: false,
        generationStatus: GenerationStatus.PENDING,
        imageUrl: null,
      }

      prismaMock.generations.create.mockResolvedValue(mockGeneration)

      const result = await service.generateImage('test prompt')

      expect(prismaMock.generations.create).toHaveBeenCalledWith({
        data: {
          prompt: 'test prompt',
          imageHeight: 1024,
          imageWidth: 1024,
          coreModel: 'SDXL',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      })
      expect(result).toEqual({ generationId: 'test-generation-id' })
      
      // Wait for background processing to complete
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it('should throw error when generation creation fails', async () => {
      prismaMock.generations.create.mockRejectedValue(new Error('Database error'))

      await expect(service.generateImage('test prompt')).rejects.toThrow(
        'Failed to initiate image generation: Error: Database error',
      )
    })
  })

  describe('findGenerationById', () => {
    it('should return generation with imageUrl when status is COMPLETE', async () => {
      const mockGeneration = {
        generationStatus: GenerationStatus.COMPLETE,
        prompt: 'test prompt',
        imageUrl: 'http://image-url/test-generation-id',
      }

      prismaMock.generations.findUnique.mockResolvedValue(mockGeneration)

      const result = await service.findGenerationById('test-generation-id')

      expect(prismaMock.generations.findUnique).toHaveBeenCalledWith({
        select: {
          generationStatus: true,
          prompt: true,
          imageUrl: true,
        },
        where: { generationId: 'test-generation-id' },
      })
      expect(result).toEqual(mockGeneration)
      expect(result.imageUrl).toBe('http://image-url/test-generation-id')
    })

    it('should not return imageUrl when status is PENDING', async () => {
      const mockGeneration = {
        generationStatus: GenerationStatus.PENDING,
        prompt: 'test prompt',
        imageUrl: 'http://image-url/test-generation-id',
      }

      prismaMock.generations.findUnique.mockResolvedValue(mockGeneration)

      const result = await service.findGenerationById('test-generation-id')

      expect(result.generationStatus).toBe(GenerationStatus.PENDING)
      expect(result.prompt).toBe('test prompt')
      expect(result.imageUrl).toBeUndefined()
    })

    it('should not return imageUrl when status is FAILED', async () => {
      const mockGeneration = {
        generationStatus: GenerationStatus.FAILED,
        prompt: 'test prompt',
        imageUrl: 'http://image-url/test-generation-id',
      }

      prismaMock.generations.findUnique.mockResolvedValue(mockGeneration)

      const result = await service.findGenerationById('test-generation-id')

      expect(result.generationStatus).toBe(GenerationStatus.FAILED)
      expect(result.prompt).toBe('test prompt')
      expect(result.imageUrl).toBeUndefined()
    })

    it('should throw NotFoundException when generation is not found', async () => {
      prismaMock.generations.findUnique.mockResolvedValue(null)

      await expect(service.findGenerationById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      )
      await expect(service.findGenerationById('non-existent-id')).rejects.toThrow(
        'Data not found',
      )
    })

    it('should throw NotFoundException when database query fails', async () => {
      prismaMock.generations.findUnique.mockRejectedValue(new Error('Database error'))

      await expect(service.findGenerationById('test-generation-id')).rejects.toThrow(NotFoundException)
      await expect(service.findGenerationById('test-generation-id')).rejects.toThrow('Data not found')
    })
  })

  describe('processImageGeneration with retry', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    it('should succeed on first attempt without retry tracking', async () => {
      const generationId = 'test-generation-id'
      const imageUrl = 'http://image-url/test'

      retryServiceMock.executeWithRetry.mockResolvedValue({
        success: true,
        result: imageUrl,
        attempts: 1,
      })

      prismaMock.generations.update.mockResolvedValue({})

      const result = await (service as any).processImageGeneration('test prompt', generationId)

      expect(result).toBe(imageUrl)
      expect(retryServiceMock.executeWithRetry).toHaveBeenCalledTimes(1)
      expect(prismaMock.generations.update).toHaveBeenCalledWith({
        where: { generationId },
        data: {
          generationStatus: GenerationStatus.COMPLETE,
          imageUrl,
          retryAttempts: 0,
        },
      })
    })

    it('should retry on failure and track retry attempts', async () => {
      const generationId = 'test-generation-id'
      const imageUrl = 'http://image-url/test'
      const retryErrors = [
        { attempt: 1, error: 'Network error', timestamp: new Date().toISOString() },
      ]

      retryServiceMock.executeWithRetry.mockResolvedValue({
        success: true,
        result: imageUrl,
        attempts: 2,
        errors: retryErrors,
      })

      prismaMock.generations.update.mockResolvedValue({})

      const result = await (service as any).processImageGeneration('test prompt', generationId)

      expect(result).toBe(imageUrl)
      expect(retryServiceMock.executeWithRetry).toHaveBeenCalledTimes(1)
      expect(prismaMock.generations.update).toHaveBeenCalledWith({
        where: { generationId },
        data: {
          generationStatus: GenerationStatus.COMPLETE,
          imageUrl,
          retryAttempts: 1,
          lastRetryAt: expect.any(Date),
          retryErrors,
        },
      })
    })

    it('should mark as failed after max retry attempts', async () => {
      const generationId = 'test-generation-id'
      const retryErrors = [
        { attempt: 1, error: 'Error 1', timestamp: new Date().toISOString() },
        { attempt: 2, error: 'Error 2', timestamp: new Date().toISOString() },
        { attempt: 3, error: 'Error 3', timestamp: new Date().toISOString() },
      ]

      const error = new Error('All attempts failed')
      retryServiceMock.executeWithRetry.mockResolvedValue({
        success: false,
        attempts: 3,
        lastError: error,
        errors: retryErrors,
      })

      prismaMock.generations.update.mockResolvedValue({})

      await expect(
        (service as any).processImageGeneration('test prompt', generationId),
      ).rejects.toThrow('All attempts failed')

      expect(retryServiceMock.executeWithRetry).toHaveBeenCalledTimes(1)
      expect(prismaMock.generations.update).toHaveBeenCalledWith({
        where: { generationId },
        data: {
          generationStatus: GenerationStatus.FAILED,
          imageUrl: undefined,
          retryAttempts: 3,
          lastRetryAt: expect.any(Date),
          retryErrors,
        },
      })
    })

    it('should call retry service with correct configuration', async () => {
      const generationId = 'test-generation-id'
      const imageUrl = 'http://image-url/test'

      retryServiceMock.executeWithRetry.mockResolvedValue({
        success: true,
        result: imageUrl,
        attempts: 1,
      })

      prismaMock.generations.update.mockResolvedValue({})

      await (service as any).processImageGeneration('test prompt', generationId)

      expect(retryServiceMock.executeWithRetry).toHaveBeenCalledWith(
        expect.any(Function),
        {
          maxAttempts: 3,
          initialDelayMs: 1000,
          maxDelayMs: 10000,
          backoffMultiplier: 2,
        },
      )
    })
  })
})

