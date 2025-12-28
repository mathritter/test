import { Test, TestingModule } from '@nestjs/testing'
import { AiController } from '../controller/ai.controller'
import { AiService } from '../service/ai.service'
import { GenerationStatus } from '../constants/generation-status.enum'
import { PrismaClient } from '@prisma/client'

const prismaMock = {
  generations: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $disconnect: jest.fn(),
}

describe('AiController', () => {
  let aiController: AiController
  let aiService: AiService

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        {
          provide: AiService,
          useFactory: () => {
            return new AiService(prismaMock as unknown as PrismaClient)
          },
        },
      ],
    }).compile()

    aiService = moduleRef.get<AiService>(AiService)
    aiController = moduleRef.get<AiController>(AiController)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('generateImage', () => {
    it('should return a generationId', async () => {
      const result = { generationId: '123' }
      jest.spyOn(aiService, 'generateImage').mockImplementation(async () => result)

      expect(await aiController.generateImage({ prompt: 'test' })).toBe(result)
    })
  })

  describe('findGenerationById', () => {
    it('should return generation status, prompt and imageUrl when status is COMPLETE', async () => {
      const completeResult = {
        generationStatus: GenerationStatus.COMPLETE,
        prompt: 'prompt test',
        imageUrl: 'url test',
      }
      jest.spyOn(aiService, 'findGenerationById').mockResolvedValue(completeResult)

      const result = await aiController.findGenerationById('123')

      expect(result).toEqual(completeResult)
      expect(result.imageUrl).toBeDefined()
      expect(result.imageUrl).toBe('url test')
    })

    it('should return generation status and prompt without imageUrl when status is PENDING', async () => {
      const pendingResult = {
        generationStatus: GenerationStatus.PENDING,
        prompt: 'prompt test',
        imageUrl: 'url test', // Service will remove this
      }
      jest.spyOn(aiService, 'findGenerationById').mockResolvedValue(pendingResult)

      const result = await aiController.findGenerationById('222')

      expect(result.generationStatus).toBe(GenerationStatus.PENDING)
      expect(result.prompt).toBe('prompt test')
      expect(result.imageUrl).not.toHaveProperty('url test')
    })

    it('should return generation status and prompt without imageUrl when status is FAILED', async () => {
      const failedResult = {
        generationStatus: GenerationStatus.FAILED,
        prompt: 'prompt test',
        imageUrl: 'url test', // Service will remove this
      }
      jest.spyOn(aiService, 'findGenerationById').mockResolvedValue(failedResult)

      const result = await aiController.findGenerationById('333')

      expect(result.generationStatus).toBe(GenerationStatus.FAILED)
      expect(result.prompt).toBe('prompt test')
      expect(result.imageUrl).not.toHaveProperty('url test')
    })
  })
})
