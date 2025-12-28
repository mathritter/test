import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { AiService } from '../service/ai.service'
import { PrismaClient } from '@prisma/client'
import { GenerationStatus } from '../constants/generation-status.enum'

jest.mock('axios')

const prismaMock = {
  generations: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $disconnect: jest.fn(),
}

describe('AiService', () => {
  let service: AiService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: AiService,
          useFactory: () => {
            return new AiService(prismaMock as unknown as PrismaClient)
          },
        },
      ],
    }).compile()

    service = module.get<AiService>(AiService)
  })

  afterEach(() => {
    jest.clearAllMocks()
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

  describe('onModuleDestroy', () => {
    it('should disconnect Prisma client', async () => {
      await service.onModuleDestroy()

      expect(prismaMock.$disconnect).toHaveBeenCalled()
    })
  })
})

